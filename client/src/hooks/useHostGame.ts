import { useState, useEffect, useCallback } from 'react';
import type { Question, Score, ServerToHostMsg, StudentRoundResult } from '@ws-quiz/shared';
import { useSocket, wsUrl } from './useSocket.ts';
import type { ChatMsg } from '../components/Chat.tsx';
import { HOST } from '../labels.ts';

type Phase       = 'auth' | 'ready' | 'running' | 'ended';
type FormSubmit  = { preventDefault(): void };
type InputChange = { currentTarget: { value: string } };

export interface Student {
  id: string;
  name: string;
}

export type HostChatMsg = ChatMsg & { readonly studentId: string };

let chatSeq = 0;

export interface HostGameApi {
  phase: Phase;
  tokenInput: string;
  authError: string;
  questionFiles: string[];
  questionFile: string;
  questions: Question[];
  selectedId: string;
  activeId: string;
  timeoutSec: number;
  students: Student[];
  studentCount: number;
  answeredCount: number;
  results: StudentRoundResult[];
  scores: Score[];
  hostChats: HostChatMsg[];
  chatStudentId: string;
  unreadCount: number;
  status: 'connecting' | 'open' | 'closed';
  reconnected: boolean;
  handleAuth: (e: FormSubmit) => void;
  handleStart: (e: FormSubmit) => void;
  handleEnd: () => void;
  handleTokenChange: (e: InputChange) => void;
  handleSelectChange: (e: InputChange) => void;
  handleTimeoutChange: (e: InputChange) => void;
  handleFileChange: (e: InputChange) => void;
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
  const [selectedId, setSelectedId]     = useState('');
  const [activeId, setActiveId]         = useState('');
  const [timeoutSec, setTimeoutSec]     = useState(60);
  const [students, setStudents]         = useState<Student[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [results, setResults]           = useState<StudentRoundResult[]>([]);
  const [scores, setScores]             = useState<Score[]>([]);
  const [hostChats, setHostChats]       = useState<HostChatMsg[]>([]);
  const [chatStudentId, setChatStudentId] = useState('');
  const [unreadCount, setUnreadCount]   = useState(0);

  const loadFile = useCallback((filename: string) => {
    setQuestionFile(filename);
    fetch('/questions/' + filename)
      .then(r => r.json() as Promise<Question[]>)
      .then(qs => {
        setQuestions(qs);
        if (qs.length > 0) setSelectedId(qs[0].id);
      })
      .catch(() => { /* no questions */ });
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'auth_success':
        setPhase('ready');
        setAuthError('');
        fetch('/questions/index.json')
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
        break;
      }
      case 'student_answered':
        setAnsweredCount(n => n + 1);
        break;
      case 'round_results':
        setResults(lastMessage.results);
        setPhase('ended');
        break;
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
  }, [lastMessage, loadFile]);

  const handleAuth  = useCallback((e: FormSubmit) => {
    e.preventDefault();
    send({ type: 'host_auth', token: tokenInput });
  }, [tokenInput, send]);

  const handleStart = useCallback((e: FormSubmit) => {
    e.preventDefault();
    if (!selectedId) return;
    setActiveId(selectedId);
    setAnsweredCount(0);
    setResults([]);
    send({ type: 'start_question', questionId: selectedId, timeoutSec });
    setPhase('running');
  }, [selectedId, timeoutSec, send]);

  const handleEnd   = useCallback(() => {
    send({ type: 'end_question', questionId: activeId });
  }, [activeId, send]);

  const handleTokenChange   = useCallback((e: InputChange) => { setTokenInput(e.currentTarget.value); }, []);
  const handleSelectChange  = useCallback((e: InputChange) => { setSelectedId(e.currentTarget.value); }, []);
  const handleTimeoutChange = useCallback((e: InputChange) => { setTimeoutSec(Number(e.currentTarget.value)); }, []);
  const handleFileChange    = useCallback((e: InputChange) => { loadFile(e.currentTarget.value); }, [loadFile]);

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
    const ownMsg: HostChatMsg = {
      id: String(++chatSeq),
      from: HOST.chatOwn,
      text,
      own: true,
      studentId: chatStudentId,
    };
    setHostChats(prev => [...prev, ownMsg]);
  }, [send, chatStudentId]);

  return {
    phase, tokenInput, authError, questionFiles, questionFile,
    questions, selectedId, activeId, timeoutSec,
    students, studentCount, answeredCount, results, scores,
    hostChats, chatStudentId, unreadCount, status, reconnected,
    handleAuth, handleStart, handleEnd,
    handleTokenChange, handleSelectChange, handleTimeoutChange, handleFileChange,
    handleOverride, handleChatStudentChange, handleHostChatSend,
  };
}
