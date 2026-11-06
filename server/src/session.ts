import { randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import type { Score, StudentRoundResult } from '@ws-quiz/shared';

interface StudentRecord {
  name: string;
  points: number;
  reconnectToken: string;
  ws: WebSocket;
}

interface ActiveQuestion {
  id: string;
  startedAt: number;
  timeoutSec: number;
}

interface AnswerRecord {
  answer: string;
  correct: boolean;
}

export class GameSession {
  readonly students = new Map<string, StudentRecord>();
  activeQuestion: ActiveQuestion | null = null;

  private readonly byToken = new Map<string, string>(); // reconnectToken → studentId
  private readonly byName  = new Map<string, string>(); // name → studentId
  private answers          = new Map<string, AnswerRecord>(); // studentId → answer
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  joinStudent(
    ws: WebSocket,
    name: string,
  ): { studentId: string; reconnectToken: string } | { error: string } {
    if (this.byName.has(name)) {
      const existingId = this.byName.get(name)!;
      const existing   = this.students.get(existingId)!;
      if (existing.ws.readyState === WebSocket.CLOSED) {
        existing.ws = ws;
        return { studentId: existingId, reconnectToken: existing.reconnectToken };
      }
      return { error: 'name taken' };
    }
    const studentId      = randomUUID();
    const reconnectToken = randomUUID();
    this.students.set(studentId, { name, points: 0, reconnectToken, ws });
    this.byName.set(name, studentId);
    this.byToken.set(reconnectToken, studentId);
    return { studentId, reconnectToken };
  }

  rejoinStudent(ws: WebSocket, reconnectToken: string): string | null {
    const studentId = this.byToken.get(reconnectToken);
    if (!studentId) return null;
    const record = this.students.get(studentId);
    if (!record) return null;
    record.ws = ws;
    return studentId;
  }

  startQuestion(
    questionId: string,
    timeoutSec: number,
    onTick: (remaining: number) => void,
    onTimeout: () => void,
  ): void {
    this.clearTimer();
    this.activeQuestion = { id: questionId, startedAt: Date.now(), timeoutSec };
    this.answers = new Map();
    let remaining = timeoutSec;
    this.tickTimer = setInterval(() => {
      remaining -= 1;
      onTick(remaining);
      if (remaining <= 0) {
        this.clearTimer();
        onTimeout();
      }
    }, 1000);
  }

  answerCount(): number {
    return this.answers.size;
  }

  submitAnswer(
    studentId: string,
    answer: string,
    correctAnswers: string[],
  ): 'accepted' | 'rejected' {
    if (!this.activeQuestion) return 'rejected';
    if (this.answers.has(studentId)) return 'rejected';
    const correct = correctAnswers.includes(answer);
    this.answers.set(studentId, { answer, correct });
    return 'accepted';
  }

  endQuestion(): StudentRoundResult[] {
    this.clearTimer();
    const results: StudentRoundResult[] = [];
    for (const [studentId, { answer, correct }] of this.answers) {
      const record = this.students.get(studentId);
      if (!record) continue;
      if (correct) record.points += 1;
      results.push({ studentId, name: record.name, answer, correct });
    }
    this.activeQuestion = null;
    return results;
  }

  private clearTimer(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  reset(): void {
    this.clearTimer();
    this.students.clear();
    this.byToken.clear();
    this.byName.clear();
    this.answers.clear();
    this.activeQuestion = null;
  }

  scoreboard(): Score[] {
    return [...this.students.entries()]
      .map(([studentId, r]) => ({ studentId, name: r.name, points: r.points }))
      .sort((a, b) => b.points - a.points);
  }
}
