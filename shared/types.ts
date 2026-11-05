export type Role = 'student' | 'host' | 'present';

export interface Question {
  id: string;
  code: string;
  answers: string[];
}

export interface Score {
  studentId: string;
  name: string;
  points: number;
}

// ── Student → Server ──────────────────────────────────────────────────────────

export interface StudentJoinMsg {
  type: 'student_join';
  name: string;
  reconnectToken?: string;
}

export interface SubmitAnswerMsg {
  type: 'submit_answer';
  questionId: string;
  answer: string;
}

export interface ChatToHostMsg {
  type: 'chat_to_host';
  text: string;
}

export type StudentToServerMsg = StudentJoinMsg | SubmitAnswerMsg | ChatToHostMsg;

// ── Host → Server ─────────────────────────────────────────────────────────────

export interface HostAuthMsg {
  type: 'host_auth';
  token: string;
}

export interface StartQuestionMsg {
  type: 'start_question';
  questionId: string;
  timeoutSec: number;
}

export interface EndQuestionMsg {
  type: 'end_question';
  questionId: string;
}

export interface OverrideScoreMsg {
  type: 'override_score';
  studentId: string;
  correct: boolean;
}

export interface ChatToStudentMsg {
  type: 'chat_to_student';
  studentId: string;
  text: string;
}

export type HostToServerMsg =
  | HostAuthMsg
  | StartQuestionMsg
  | EndQuestionMsg
  | OverrideScoreMsg
  | ChatToStudentMsg;

// ── Server → Student ──────────────────────────────────────────────────────────

export interface WelcomeMsg {
  type: 'welcome';
  studentId: string;
  reconnectToken: string;
}

export interface JoinFailedMsg {
  type: 'join_failed';
  reason: string;
}

export interface QuestionStartedMsg {
  type: 'question_started';
  questionId: string;
  code: string;
  timeoutSec: number;
  startedAt: number;
}

export interface AnswerReceivedMsg {
  type: 'answer_received';
}

export interface AnswerRejectedMsg {
  type: 'answer_rejected';
  reason: string;
}

export interface RoundResultMsg {
  type: 'round_result';
  correct: boolean;
  correctAnswer: string;
  points: number;
  totalPoints: number;
}

export interface LeaderboardMsg {
  type: 'leaderboard';
  scores: Score[];
}

export interface ChatFromHostMsg {
  type: 'chat_from_host';
  text: string;
}

export type ServerToStudentMsg =
  | WelcomeMsg
  | JoinFailedMsg
  | QuestionStartedMsg
  | AnswerReceivedMsg
  | AnswerRejectedMsg
  | RoundResultMsg
  | LeaderboardMsg
  | ChatFromHostMsg;

// ── Server → Host ─────────────────────────────────────────────────────────────

export interface AuthSuccessMsg {
  type: 'auth_success';
}

export interface AuthFailedMsg {
  type: 'auth_failed';
  reason: string;
}

export interface StudentJoinedMsg {
  type: 'student_joined';
  id: string;
  name: string;
}

export interface StudentAnsweredMsg {
  type: 'student_answered';
  studentId: string;
}

export interface StudentRoundResult {
  studentId: string;
  name: string;
  answer: string;
  correct: boolean;
}

export interface RoundResultsMsg {
  type: 'round_results';
  results: StudentRoundResult[];
}

export interface ScoreboardUpdateMsg {
  type: 'scoreboard_update';
  scores: Score[];
}

export interface ChatFromStudentMsg {
  type: 'chat_from_student';
  studentId: string;
  name: string;
  text: string;
}

export type ServerToHostMsg =
  | AuthSuccessMsg
  | AuthFailedMsg
  | StudentJoinedMsg
  | StudentAnsweredMsg
  | RoundResultsMsg
  | ScoreboardUpdateMsg
  | ChatFromStudentMsg;

// ── Server → Present ──────────────────────────────────────────────────────────

export interface TimerTickMsg {
  type: 'timer_tick';
  remaining: number;
}

export interface AnswerCountMsg {
  type: 'answer_count';
  count: number;
  total: number;
}

export interface QuestionEndedMsg {
  type: 'question_ended';
  questionId: string;
}

export type ServerToPresentMsg =
  | QuestionStartedMsg
  | TimerTickMsg
  | AnswerCountMsg
  | QuestionEndedMsg;

// ── Union всех входящих сообщений (удобно для switch на сервере) ───────────────

export type ClientToServerMsg = StudentToServerMsg | HostToServerMsg;
