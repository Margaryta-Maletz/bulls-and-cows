import { useState, useEffect } from 'react';
import type { ServerToPresentMsg } from '@ws-quiz/shared';
import { useSocket, wsUrl } from '../hooks/useSocket.ts';
import Timer from '../components/Timer.tsx';
import CodeBlock from '../components/CodeBlock.tsx';

type Phase = 'idle' | 'active' | 'ended';

interface ActiveQuestion {
  code: string;
  startedAt: number;
  timeoutSec: number;
}

export default function PresentPage() {
  const { lastMessage, status } = useSocket<ServerToPresentMsg>(wsUrl('present'));

  const [phase, setPhase]               = useState<Phase>('idle');
  const [question, setQuestion]         = useState<ActiveQuestion | null>(null);
  const [answerCount, setAnswerCount]   = useState(0);
  const [totalCount, setTotalCount]     = useState(0);
  const [correctAnswer, setCorrectAnswer] = useState('');

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'question_started':
        // oxlint-disable-next-line react/set-state-in-effect -- WebSocket messages drive this component's state.
        setQuestion({ code: lastMessage.code, startedAt: lastMessage.startedAt, timeoutSec: lastMessage.timeoutSec });
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

  if (status === 'closed') {
    return <p>{'Переподключение...'}</p>;
  }

  return (
    <>
      {phase === 'idle' && (
        <p>{'Ожидаем вопрос...'}</p>
      )}
      {phase === 'active' && question !== null && (
        <div>
          <Timer startedAt={question.startedAt} timeoutSec={question.timeoutSec} />
          <CodeBlock>{question.code}</CodeBlock>
          <p>{'Ответили: ' + String(answerCount) + ' / ' + String(totalCount)}</p>
        </div>
      )}
      {phase === 'ended' && (
        <div>
          <p>{'Правильный ответ:'}</p>
          <CodeBlock>{correctAnswer}</CodeBlock>
        </div>
      )}
    </>
  );
}
