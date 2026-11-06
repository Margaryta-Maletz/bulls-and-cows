import { useReducer, useState, useEffect, useCallback } from 'react';
import type { ServerToStudentMsg, QuestionType } from '@ws-quiz/shared';
import { useSocket, wsUrl } from './useSocket.ts';
import type { ChatMsg } from '../components/Chat.tsx';
import { LABELS } from '../labels.ts';

type FormSubmit  = { preventDefault(): void };
type InputChange = { currentTarget: { value: string } };

export type Phase = 'join' | 'waiting' | 'answering' | 'answered';

export interface ActiveQuestion {
  id: string;
  code: string;
  questionType: QuestionType;
  options?: string[];
}

interface GameState {
  phase: Phase;
  error: string;
  question: ActiveQuestion | null;
  isSubmitting: boolean;
  chatMsgs: ChatMsg[];
  showBonus: boolean;
}

type GameAction =
  | ServerToStudentMsg
  | { type: 'submit' }
  | { type: 'chat_sent'; text: string; from: string }
  | { type: 'answer_sent'; questionId: string; answer: string; from: string }
  | { type: 'hide_bonus' };

const INIT: GameState = {
  phase: 'join',
  error: '',
  question: null,
  isSubmitting: false,
  chatMsgs: [],
  showBonus: false,
};

let msgSeq = 0;

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'welcome':
      return { ...state, phase: 'waiting', error: '' };
    case 'join_failed':
      return { ...state, error: action.reason };
    case 'question_started':
      return {
        ...state,
        phase: 'answering',
        error: '',
        isSubmitting: false,
        question: { id: action.questionId, code: action.code, questionType: action.questionType, options: action.options },
        chatMsgs: [...state.chatMsgs, {
          id: String(++msgSeq),
          from: action.questionId,
          text: action.code,
          own: false,
        }],
      };
    case 'answer_received':
      return { ...state, phase: 'answered' };
    case 'answer_rejected':
      return { ...state, isSubmitting: false, error: action.reason };
    case 'round_result': {
      const verdict = action.correct ? LABELS.correct : LABELS.incorrect;
      const resultText = verdict
        + ' ' + LABELS.chatRightAnswer + action.correctAnswer
        + LABELS.chatTotalPoints + String(action.totalPoints) + LABELS.chatPoints;
      return {
        ...state,
        phase: 'waiting',
        isSubmitting: false,
        showBonus: action.correct,
        chatMsgs: [...state.chatMsgs, {
          id: String(++msgSeq),
          from: LABELS.chatSystem,
          text: resultText,
          own: false,
        }],
      };
    }
    case 'hide_bonus':
      return { ...state, showBonus: false };
    case 'leaderboard':
      return state;
    case 'chat_from_host':
      return {
        ...state,
        chatMsgs: [...state.chatMsgs, {
          id: String(++msgSeq),
          from: LABELS.hostName,
          text: action.text,
          own: false,
        }],
      };
    case 'submit':
      return { ...state, isSubmitting: true };
    case 'chat_sent':
      return {
        ...state,
        chatMsgs: [...state.chatMsgs, {
          id: String(++msgSeq),
          from: action.from,
          text: action.text,
          own: true,
        }],
      };
    case 'answer_sent':
      return {
        ...state,
        chatMsgs: [...state.chatMsgs, {
          id: String(++msgSeq),
          from: action.from,
          text: LABELS.chatMyAnswer + action.answer,
          own: true,
        }],
      };
    default:
      return state;
  }
}

export interface JoinGameApi {
  phase: Phase;
  error: string;
  question: ActiveQuestion | null;
  questionCode: string;
  isSubmitting: boolean;
  chatMsgs: ChatMsg[];
  showBonus: boolean;
  nameInput: string;
  answer: string;
  selectedOptions: string[];
  status: 'connecting' | 'open' | 'closed';
  reconnected: boolean;
  handleJoin: (e: FormSubmit) => void;
  handleAnswer: (e: FormSubmit) => void;
  handleNameChange: (e: InputChange) => void;
  handleAnswerChange: (e: InputChange) => void;
  handleOptionToggle: (option: string) => void;
  handleChatSend: (text: string) => void;
  hideBonus: () => void;
}

export function useJoinGame(): JoinGameApi {
  const { send, lastMessage, status, reconnected } = useSocket<ServerToStudentMsg>(wsUrl());

  const [game, dispatch]              = useReducer(gameReducer, INIT);
  const [nameInput, setNameInput]     = useState('');
  const [answer, setAnswer]           = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [studentName, setStudentName] = useState('');

  useEffect(() => {
    if (status !== 'open') return;
    try {
      const storedName  = sessionStorage.getItem('studentName');
      const storedToken = sessionStorage.getItem('reconnectToken');
      if (storedName && storedToken) {
        send({ type: 'student_join', name: storedName, reconnectToken: storedToken });
      }
    } catch { /* sessionStorage unavailable */ }
  }, [status, send]);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'welcome') {
      try { sessionStorage.setItem('reconnectToken', lastMessage.reconnectToken); } catch {}
    }
    if (lastMessage.type === 'question_started') setSelectedOptions([]);
    dispatch(lastMessage);
  }, [lastMessage]);

  const handleJoin = useCallback((e: FormSubmit) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setStudentName(trimmed);
    try { sessionStorage.setItem('studentName', trimmed); } catch {}
    send({ type: 'student_join', name: trimmed });
  }, [nameInput, send]);

  const handleAnswer = useCallback((e: FormSubmit) => {
    e.preventDefault();
    if (!game.question || game.isSubmitting) return;
    const qType = game.question.questionType;

    let finalAnswer: string;
    if (qType === 'multiple') {
      if (selectedOptions.length === 0) return;
      finalAnswer = [...selectedOptions].sort((a, b) => a.localeCompare(b)).join(',');
    } else if (qType === 'single') {
      if (selectedOptions.length === 0) return;
      finalAnswer = selectedOptions[0];
    } else {
      const trimmed = answer.trim();
      if (!trimmed) return;
      finalAnswer = trimmed;
    }

    dispatch({ type: 'submit' });
    dispatch({ type: 'answer_sent', questionId: game.question.id, answer: finalAnswer, from: studentName });
    send({ type: 'submit_answer', questionId: game.question.id, answer: finalAnswer });
  }, [game.question, game.isSubmitting, answer, selectedOptions, studentName, send]);

  const handleNameChange   = useCallback((e: InputChange) => { setNameInput(e.currentTarget.value); }, []);
  const handleAnswerChange = useCallback((e: InputChange) => { setAnswer(e.currentTarget.value); }, []);

  const handleOptionToggle = useCallback((option: string) => {
    setSelectedOptions(prev => {
      if (game.question?.questionType === 'single') return [option];
      return prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option];
    });
  }, [game.question?.questionType]);

  const handleChatSend = useCallback((text: string) => {
    send({ type: 'chat_to_host', text });
    dispatch({ type: 'chat_sent', text, from: studentName });
  }, [send, studentName]);

  const hideBonus = useCallback(() => { dispatch({ type: 'hide_bonus' }); }, []);

  const { phase, error, question, isSubmitting, chatMsgs, showBonus } = game;
  return {
    phase, error, question, questionCode: question !== null ? question.code : '',
    isSubmitting, chatMsgs, showBonus,
    nameInput, answer, selectedOptions, status, reconnected,
    handleJoin, handleAnswer, handleNameChange, handleAnswerChange,
    handleOptionToggle, handleChatSend, hideBonus,
  };
}
