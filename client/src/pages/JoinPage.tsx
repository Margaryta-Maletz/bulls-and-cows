import { useState, useEffect, useCallback } from 'react';
import type { Score, ServerToStudentMsg } from '@ws-quiz/shared';
import { useSocket, wsUrl } from '../hooks/useSocket.ts';
import Scoreboard from '../components/Scoreboard.tsx';

const errorStyle = { color: 'red' } as const;

type Phase = 'join' | 'waiting' | 'answering' | 'answered' | 'result';

interface ActiveQuestion {
  id: string;
  code: string;
}

interface RoundResult {
  correct: boolean;
  correctAnswer: string;
  totalPoints: number;
}

export default function JoinPage() {
  const { send, lastMessage, status } = useSocket<ServerToStudentMsg>(wsUrl());

  const [phase, setPhase]           = useState<Phase>('join');
  const [nameInput, setNameInput]   = useState('');
  const [answer, setAnswer]         = useState('');
  const [error, setError]           = useState('');
  const [question, setQuestion]     = useState<ActiveQuestion | null>(null);
  const [result, setResult]         = useState<RoundResult | null>(null);
  const [scores, setScores]         = useState<Score[]>([]);

  useEffect(() => {
    if (status !== 'open') return;
    try {
      const storedName  = sessionStorage.getItem('studentName');
      const storedToken = sessionStorage.getItem('reconnectToken');
      if (storedName && storedToken) {
        send({ type: 'student_join', name: storedName, reconnectToken: storedToken });
      }
    } catch { /* sessionStorage unavailable in some contexts */ }
  }, [status, send]);

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'welcome':
        try { sessionStorage.setItem('reconnectToken', lastMessage.reconnectToken); } catch {}
        setPhase('waiting');
        setError('');
        break;
      case 'join_failed':
        setError(lastMessage.reason);
        break;
      case 'question_started':
        setAnswer('');
        setError('');
        setQuestion({ id: lastMessage.questionId, code: lastMessage.code });
        setPhase('answering');
        break;
      case 'answer_received':
        setPhase('answered');
        break;
      case 'answer_rejected':
        setError(lastMessage.reason);
        break;
      case 'round_result':
        setResult({
          correct: lastMessage.correct,
          correctAnswer: lastMessage.correctAnswer,
          totalPoints: lastMessage.totalPoints,
        });
        setPhase('result');
        break;
      case 'leaderboard':
        setScores(lastMessage.scores);
        break;
    }
  }, [lastMessage]);

  const handleJoin = useCallback((e: { preventDefault(): void }) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try { sessionStorage.setItem('studentName', trimmed); } catch {}
    send({ type: 'student_join', name: trimmed });
  }, [nameInput, send]);

  const handleAnswer = useCallback((e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!question || !answer.trim()) return;
    send({ type: 'submit_answer', questionId: question.id, answer: answer.trim() });
  }, [question, answer, send]);

  if (status === 'closed') {
    return <p>{'Переподключение...'}</p>;
  }

  return (
    <>
      {phase === 'join' && (
        <form onSubmit={handleJoin}>
          <h1>{'Войти в игру'}</h1>
          {error && <p style={errorStyle}>{error}</p>}
          <input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder={'Никнейм'}
          />
          <button type="submit">{'Войти'}</button>
        </form>
      )}
      {phase === 'waiting' && (
        <p>{'Ожидаем вопрос...'}</p>
      )}
      {phase === 'answering' && question !== null && (
        <form onSubmit={handleAnswer}>
          <pre><code>{question.code}</code></pre>
          {error && <p style={errorStyle}>{error}</p>}
          <input
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder={'Что выведет консоль?'}
          />
          <button type="submit">{'Отправить'}</button>
        </form>
      )}
      {phase === 'answered' && (
        <p>{'Ответ принят, ждём результатов...'}</p>
      )}
      {phase === 'result' && result !== null && (
        <div>
          <p>{result.correct ? 'Верно!' : 'Неверно!'}</p>
          <p>{'Правильный ответ: ' + result.correctAnswer}</p>
          <p>{'Всего очков: ' + String(result.totalPoints)}</p>
          <Scoreboard scores={scores} />
        </div>
      )}
    </>
  );
}
