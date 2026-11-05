import { WebSocket } from 'ws';
import type { RawData } from 'ws';
import type {
  ClientToServerMsg,
  Question,
  ServerToHostMsg,
  ServerToStudentMsg,
} from '@ws-quiz/shared';
import type { GameSession } from './session.js';

export interface ConnectionInfo {
  role: 'student' | 'host' | 'present' | null;
  studentId?: string;
}

interface HandlerCtx {
  session: GameSession;
  connections: Map<WebSocket, ConnectionInfo>;
  questions: Map<string, Question>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function send(ws: WebSocket, msg: ServerToStudentMsg | ServerToHostMsg): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastRole(
  connections: Map<WebSocket, ConnectionInfo>,
  roles: ConnectionInfo['role'][],
  msg: ServerToStudentMsg | ServerToHostMsg,
): void {
  for (const [ws, info] of connections) {
    if (roles.includes(info.role)) send(ws, msg);
  }
}

function hostWs(connections: Map<WebSocket, ConnectionInfo>): WebSocket | null {
  for (const [ws, info] of connections) {
    if (info.role === 'host') return ws;
  }
  return null;
}

function rawToText(raw: RawData): string {
  if (Array.isArray(raw)) return Buffer.concat(raw).toString('utf-8');
  if (raw instanceof ArrayBuffer) return Buffer.from(new Uint8Array(raw)).toString('utf-8');
  return (raw as Buffer).toString('utf-8');
}

// ── Per-message handlers ──────────────────────────────────────────────────────

function onStudentJoin(
  ws: WebSocket,
  msg: Extract<ClientToServerMsg, { type: 'student_join' }>,
  info: ConnectionInfo,
  ctx: HandlerCtx,
): void {
  const { session, connections, questions } = ctx;

  if (msg.reconnectToken) {
    const studentId = session.rejoinStudent(ws, msg.reconnectToken);
    if (studentId) {
      info.role = 'student';
      info.studentId = studentId;
      const record = session.students.get(studentId)!;
      send(ws, { type: 'welcome', studentId, reconnectToken: record.reconnectToken });
      if (session.activeQuestion) {
        const q = questions.get(session.activeQuestion.id);
        if (q) {
          send(ws, {
            type: 'question_started',
            questionId: q.id,
            code: q.code,
            timeoutSec: session.activeQuestion.timeoutSec,
            startedAt: session.activeQuestion.startedAt,
          });
        }
      }
      return;
    }
  }

  const result = session.joinStudent(ws, msg.name);
  if ('error' in result) {
    send(ws, { type: 'join_failed', reason: result.error });
    return;
  }
  info.role = 'student';
  info.studentId = result.studentId;
  send(ws, { type: 'welcome', studentId: result.studentId, reconnectToken: result.reconnectToken });
  const host = hostWs(connections);
  if (host) send(host, { type: 'student_joined', id: result.studentId, name: msg.name });
}

function onHostAuth(
  ws: WebSocket,
  msg: Extract<ClientToServerMsg, { type: 'host_auth' }>,
  info: ConnectionInfo,
): void {
  const token = process.env.HOST_TOKEN;
  if (!token || msg.token !== token) {
    send(ws, { type: 'auth_failed', reason: 'invalid token' });
    return;
  }
  info.role = 'host';
  send(ws, { type: 'auth_success' });
}

function onStartQuestion(
  msg: Extract<ClientToServerMsg, { type: 'start_question' }>,
  info: ConnectionInfo,
  ctx: HandlerCtx,
): void {
  if (info.role !== 'host') return;
  const { session, connections, questions } = ctx;
  const q = questions.get(msg.questionId);
  if (!q) return;
  session.startQuestion(msg.questionId, msg.timeoutSec);
  broadcastRole(connections, ['student', 'present'], {
    type: 'question_started',
    questionId: q.id,
    code: q.code,
    timeoutSec: msg.timeoutSec,
    startedAt: session.activeQuestion!.startedAt,
  });
}

function onSubmitAnswer(
  ws: WebSocket,
  msg: Extract<ClientToServerMsg, { type: 'submit_answer' }>,
  info: ConnectionInfo,
  ctx: HandlerCtx,
): void {
  if (info.role !== 'student' || !info.studentId) return;
  const { session, connections, questions } = ctx;
  if (!session.activeQuestion) {
    send(ws, { type: 'answer_rejected', reason: 'no active question' });
    return;
  }
  const q = questions.get(session.activeQuestion.id);
  // Stub normalizer — будет заменён в шаге 1.6
  const normalized = msg.answer.trim().toLowerCase();
  const correctAnswers = (q?.answers ?? []).map((a) => a.trim().toLowerCase());
  const status = session.submitAnswer(info.studentId, normalized, correctAnswers);
  if (status === 'rejected') {
    send(ws, { type: 'answer_rejected', reason: 'already submitted' });
    return;
  }
  send(ws, { type: 'answer_received' });
  const host = hostWs(connections);
  if (host) send(host, { type: 'student_answered', studentId: info.studentId });
}

function onEndQuestion(
  ws: WebSocket,
  info: ConnectionInfo,
  ctx: HandlerCtx,
): void {
  if (info.role !== 'host') return;
  const { session, connections, questions } = ctx;
  const activeQ = session.activeQuestion;
  const correctAnswer = activeQ ? (questions.get(activeQ.id)?.answers[0] ?? '') : '';
  const results = session.endQuestion();

  send(ws, { type: 'round_results', results });
  for (const r of results) {
    const record = session.students.get(r.studentId);
    if (record) {
      send(record.ws, {
        type: 'round_result',
        correct: r.correct,
        correctAnswer,
        points: r.correct ? 1 : 0,
        totalPoints: record.points,
      });
    }
  }
  const scores = session.scoreboard();
  broadcastRole(connections, ['student', 'present'], { type: 'leaderboard', scores });
  send(ws, { type: 'scoreboard_update', scores });
}

function onOverrideScore(
  ws: WebSocket,
  msg: Extract<ClientToServerMsg, { type: 'override_score' }>,
  info: ConnectionInfo,
  ctx: HandlerCtx,
): void {
  if (info.role !== 'host') return;
  const { session, connections } = ctx;
  const record = session.students.get(msg.studentId);
  if (!record) return;
  record.points += msg.correct ? 1 : -1;
  const scores = session.scoreboard();
  broadcastRole(connections, ['student', 'present'], { type: 'leaderboard', scores });
  send(ws, { type: 'scoreboard_update', scores });
}

function onChatToHost(
  msg: Extract<ClientToServerMsg, { type: 'chat_to_host' }>,
  info: ConnectionInfo,
  ctx: HandlerCtx,
): void {
  if (info.role !== 'student' || !info.studentId) return;
  const { session, connections } = ctx;
  const record = session.students.get(info.studentId);
  if (!record) return;
  const host = hostWs(connections);
  if (host) send(host, { type: 'chat_from_student', studentId: info.studentId, name: record.name, text: msg.text });
}

function onChatToStudent(
  msg: Extract<ClientToServerMsg, { type: 'chat_to_student' }>,
  info: ConnectionInfo,
  ctx: HandlerCtx,
): void {
  if (info.role !== 'host') return;
  const target = ctx.session.students.get(msg.studentId);
  if (target) send(target.ws, { type: 'chat_from_host', text: msg.text });
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function handleMessage(ws: WebSocket, raw: RawData, ctx: HandlerCtx): void {
  const info = ctx.connections.get(ws);
  if (!info) return;

  let msg: ClientToServerMsg;
  try {
    msg = JSON.parse(rawToText(raw)) as ClientToServerMsg;
  } catch {
    return;
  }

  switch (msg.type) {
    case 'student_join':    return onStudentJoin(ws, msg, info, ctx);
    case 'host_auth':       return onHostAuth(ws, msg, info);
    case 'start_question':  return onStartQuestion(msg, info, ctx);
    case 'submit_answer':   return onSubmitAnswer(ws, msg, info, ctx);
    case 'end_question':    return onEndQuestion(ws, info, ctx);
    case 'override_score':  return onOverrideScore(ws, msg, info, ctx);
    case 'chat_to_host':    return onChatToHost(msg, info, ctx);
    case 'chat_to_student': return onChatToStudent(msg, info, ctx);
  }
}
