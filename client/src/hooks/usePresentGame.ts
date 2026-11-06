import { useState, useEffect } from 'react';
import type { ServerToPresentMsg } from '@ws-quiz/shared';
import { useSocket, wsUrl } from './useSocket.ts';

type Phase = 'idle' | 'active' | 'ended';

export interface PresentGameApi {
  phase: Phase;
  questionSrc: string;
  startedAt: number;
  timeoutSec: number;
  answerCount: number;
  totalCount: number;
  correctAnswer: string;
  status: 'connecting' | 'open' | 'closed';
}

export function usePresentGame(): PresentGameApi {
  const { lastMessage, status } = useSocket<ServerToPresentMsg>(wsUrl('present'));

  const [phase, setPhase]               = useState<Phase>('idle');
  const [questionSrc, setQuestionSrc]   = useState('');
  const [startedAt, setStartedAt]       = useState(0);
  const [timeoutSec, setTimeoutSec]     = useState(60);
  const [answerCount, setAnswerCount]   = useState(0);
  const [totalCount, setTotalCount]     = useState(0);
  const [correctAnswer, setCorrectAnswer] = useState('');

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'question_started':
        setQuestionSrc(lastMessage.code);
        setStartedAt(lastMessage.startedAt);
        setTimeoutSec(lastMessage.timeoutSec);
        setAnswerCount(0);
        setTotalCount(0);
        setPhase('active');
        break;
      case 'answer_count':
        setAnswerCount(lastMessage.count);
        setTotalCount(lastMessage.total);
        break;
      case 'question_ended':
        setCorrectAnswer(lastMessage.correctAnswer);
        setPhase('ended');
        break;
    }
  }, [lastMessage]);

  return { phase, questionSrc, startedAt, timeoutSec, answerCount, totalCount, correctAnswer, status };
}
