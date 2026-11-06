import { useState, useEffect } from 'react';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
import type { ServerToPresentMsg, QuestionType } from '@ws-quiz/shared';
import { useSocket, wsUrl } from './useSocket.ts';

type Phase = 'idle' | 'active' | 'ended';

export interface PresentGameApi {
  phase: Phase;
  questionSrc: string;
  questionType: QuestionType;
  options: string[];
  startedAt: number;
  timeoutSec: number;
  answerCount: number;
  totalCount: number;
  correctAnswer: string;
  isPreview: boolean;
  status: 'connecting' | 'open' | 'closed';
}

export function usePresentGame(): PresentGameApi {
  const { lastMessage, status } = useSocket<ServerToPresentMsg>(wsUrl('present'));

  const [phase, setPhase]               = useState<Phase>('idle');
  const [questionSrc, setQuestionSrc]   = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('input');
  const [options, setOptions]           = useState<string[]>([]);
  const [startedAt, setStartedAt]       = useState(0);
  const [timeoutSec, setTimeoutSec]     = useState(60);
  const [answerCount, setAnswerCount]   = useState(0);
  const [totalCount, setTotalCount]     = useState(0);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [isPreview, setIsPreview]       = useState(false);

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'question_started':
        setQuestionSrc(lastMessage.code);
        setQuestionType(lastMessage.questionType ?? 'input');
        setOptions(lastMessage.options ? shuffle(lastMessage.options) : []);
        setIsPreview(lastMessage.timeoutSec === 0);
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

  return { phase, questionSrc, questionType, options, startedAt, timeoutSec, answerCount, totalCount, correctAnswer, isPreview, status };
}
