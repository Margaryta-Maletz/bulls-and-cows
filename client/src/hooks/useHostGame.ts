import { useState, useEffect, useCallback, useRef } from 'react';
import type { Question, Score, ServerToHostMsg, StudentRoundResult } from '@ws-quiz/shared';
import { useSocket, wsUrl, apiUrl } from './useSocket.ts';
import type { ChatMsg } from '../components/Chat.tsx';
import { HOST } from '../labels.ts';

type Phase      = 'auth' | 'ready';
type FormSubmit = { preventDefault(): void };
type InputChange = { currentTarget: { value: string } };

export interface Student {
  id: string;
  name: string;
}

export type HostChatMsg = ChatMsg & { readonly studentId: string };

export interface QuestionStat {
  status: 'idle' | 'active' | 'ended';
  answeredCount: number;
  totalStudents: number;
  correctCount: number;
}

let chatSeq = 0;

export interface HostGameApi {
  phase: Phase;
  tokenInput: string;
  authError: string;
  questionFiles: string[];
  questionFile: string;
  questions: Question[];
  timeoutSec: number;
  activeId: string;
  students: Student[];
  studentCount: number;
  questionStats: Record<string, QuestionStat>;
  scores: Score[];
  hostChats: HostChatMsg[];
  chatStudentId: string;
  unreadCount: number;
  status: 'connecting' | 'open' | 'closed';
  reconnected: boolean;
  handleAuth: (e: FormSubmit) => void;
  handleTokenChange: (e: InputChange) => void;
  handleTimeoutChange: (e: InputChange) => void;
  handleFileChange: (e: InputChange) => void;
  handleCardClick: (questionId: string) => void;
  handleReset: () => void;
  handleOverride: (studentId: string, correct: boolean) => () => void;
  handleChatStudentChange: (e: InputChange) => void;
  handleHostChatSend: (text: string) => void;
}

export function useHostGame(): HostGameApi {
  const { send, lastMessage, status, reconnected } = useSocket<ServerToHostMsg>(wsUrl());

  const [phase, setPhase]               = useState<Phase>('auth');
  const [tokenInput, setTokenInput]     = useState('');
  const [authError, setAuthError]       = useState('');
  const [questionFiles, setQuestionFiles] = useState<string[]>([]);
  const [questionFile, setQuestionFile] = useState('');
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [timeoutSec, setTimeoutSec]     = useState(60);
  const [activeId, setActiveId]         = useState('');
  const [students, setStudents]         = useState<Student[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [questionStats, setQuestionStats] = useState<Record<string, QuestionStat>>({});
  const [scores, setScores]             = useState<Score[]>([]);
  const [hostChats, setHostChats]       = useState<HostChatMsg[]>([]);
  const [chatStudentId, setChatStudentId] = useState('');
  const [unreadCount, setUnreadCount]   = useState(0);

  const activeIdRef     = useRef('');
  const endingIdRef     = useRef('');
  const studentCountRef = useRef(0);

  const updateActiveId = useCallback((id: string) => {
    setActiveId(id);
    activeIdRef.current = id;
  }, []);

  const loadFile = useCallback((filename: string) => {
    setQuestionFile(filename);
    fetch(apiUrl('/questions/' + filename))
      .then(r => r.json() as Promise<Question[]>)
      .then(qs => { setQuestions(qs); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'auth_success':
        setPhase('ready');
        setAuthError('');
        fetch(apiUrl('/questions/index.json'))
          .then(r => r.json() as Promise<string[]>)
          .then(files => { setQuestionFiles(files); loadFile(files[0] ?? 'week-09.json'); })
          .catch(() => { loadFile('week-09.json'); });
        break;
      case 'auth_failed':
        setTokenInput('');
        setAuthError(lastMessage.reason);
        break;
      case 'student_joined': {
        const joined = { id: lastMessage.id, name: lastMessage.name };
        setStudents(prev => [...prev, joined]);
        setStudentCount(n => n + 1);
        studentCountRef.current++;
        break;
      }
      case 'student_answered': {
        const qId = activeIdRef.current;
        if (qId) {
          setQuestionStats(prev => {
            const cur = prev[qId] ?? { status: 'active' as const, answeredCount: 0, totalStudents: 0, correctCount: 0 };
            return { ...prev, [qId]: { ...cur, answeredCount: cur.answeredCount + 1 } };
          });
        }
        break;
      }
      case 'round_results': {
        const endedId = endingIdRef.current || activeIdRef.current;
        endingIdRef.current = '';
        if (activeIdRef.current === endedId) updateActiveId('');
        if (endedId) {
          const results = lastMessage.results;
          const correct = results.filter((r: StudentRoundResult) => r.correct).length;
          setQuestionStats(prev => ({
            ...prev,
            [endedId]: {
              status: 'ended',
              answeredCount: results.length,
              totalStudents: studentCountRef.current,
              correctCount: correct,
            },
          }));
        }
        break;
      }
      case 'scoreboard_update':
        setScores(lastMessage.scores);
        break;
      case 'chat_from_student': {
        const msg: HostChatMsg = {
          id: String(++chatSeq),
          from: lastMessage.name,
          text: lastMessage.text,
          own: false,
          studentId: lastMessage.studentId,
        };
        setHostChats(prev => [...prev, msg]);
        setUnreadCount(n => n + 1);
        break;
      }
    }
  }, [lastMessage, loadFile, updateActiveId]);

  const handleAuth = useCallback((e: FormSubmit) => {
    e.preventDefault();
    send({ type: 'host_auth', token: tokenInput });
  }, [tokenInput, send]);

  const handleTokenChange   = useCallback((e: InputChange) => { setTokenInput(e.currentTarget.value); }, []);
  const handleTimeoutChange = useCallback((e: InputChange) => { setTimeoutSec(Number(e.currentTarget.value)); }, []);
  const handleFileChange    = useCallback((e: InputChange) => { loadFile(e.currentTarget.value); }, [loadFile]);

  const handleCardClick = useCallback((questionId: string) => {
    const stat = questionStats[questionId];

    if (stat?.status === 'ended') {
      send({ type: 'preview_question', questionId });
      return;
    }

    if (stat?.status === 'active') {
      endingIdRef.current = questionId;
      updateActiveId('');
      send({ type: 'end_question', questionId });
      return;
    }

    // idle → start (possibly ending current active first)
    const currentActive = activeIdRef.current;
    if (currentActive) {
      endingIdRef.current = currentActive;
      send({ type: 'end_question', questionId: currentActive });
    }

    updateActiveId(questionId);
    setQuestionStats(prev => ({
      ...prev,
      [questionId]: {
        status: 'active',
        answeredCount: 0,
        totalStudents: studentCountRef.current,
        correctCount: 0,
      },
    }));
    send({ type: 'start_question', questionId, timeoutSec });
  }, [questionStats, timeoutSec, send, updateActiveId]);

  const handleReset = useCallback(() => {
    send({ type: 'reset_session' });
    setStudents([]);
    setStudentCount(0);
    studentCountRef.current = 0;
    setScores([]);
    setQuestionStats({});
    updateActiveId('');
  }, [send, updateActiveId]);

  const handleOverride = useCallback((studentId: string, correct: boolean) => () => {
    send({ type: 'override_score', studentId, correct });
  }, [send]);

  const handleChatStudentChange = useCallback((e: InputChange) => {
    setChatStudentId(e.currentTarget.value);
    setUnreadCount(0);
  }, []);

  const handleHostChatSend = useCallback((text: string) => {
    if (!chatStudentId) return;
    send({ type: 'chat_to_student', studentId: chatStudentId, text });
    setHostChats(prev => [...prev, {
      id: String(++chatSeq),
      from: HOST.chatOwn,
      text,
      own: true,
      studentId: chatStudentId,
    }]);
  }, [send, chatStudentId]);

  return {
    phase, tokenInput, authError, questionFiles, questionFile,
    questions, timeoutSec, activeId,
    students, studentCount, questionStats, scores,
    hostChats, chatStudentId, unreadCount, status, reconnected,
    handleAuth, handleTokenChange, handleTimeoutChange, handleFileChange,
    handleCardClick, handleReset, handleOverride, handleChatStudentChange, handleHostChatSend,
  };
}
