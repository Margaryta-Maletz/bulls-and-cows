import { useState, useEffect, useCallback } from 'react';
import type { Question, Score, ServerToHostMsg, StudentRoundResult } from '@ws-quiz/shared';
import { useSocket, wsUrl } from '../hooks/useSocket.ts';

type Phase = 'auth' | 'ready' | 'running' | 'ended';

export default function HostPage() {
  const { send, lastMessage, status } = useSocket<ServerToHostMsg>(wsUrl());

  const [phase, setPhase]               = useState<Phase>('auth');
  const [tokenInput, setTokenInput]     = useState('');
  const [authError, setAuthError]       = useState('');
  const [questions, setQuestions]       = useState<Question[]>([]);
  const [selectedId, setSelectedId]     = useState('');
  const [activeId, setActiveId]         = useState('');
  const [timeoutSec, setTimeoutSec]     = useState(60);
  const [studentCount, setStudentCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [results, setResults]           = useState<StudentRoundResult[]>([]);
  const [scores, setScores]             = useState<Score[]>([]);

  useEffect(() => {
    if (!lastMessage) return;
    switch (lastMessage.type) {
      case 'auth_success':
        setPhase('ready');
        setAuthError('');
        fetch('/questions/week-09.json')
          .then(r => r.json() as Promise<Question[]>)
          .then(qs => {
            setQuestions(qs);
            if (qs.length > 0) setSelectedId(qs[0].id);
          })
          .catch(() => {/* no questions available */});
        break;
      case 'auth_failed':
        setAuthError(lastMessage.reason);
        break;
      case 'student_joined':
        setStudentCount(n => n + 1);
        break;
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
    }
  }, [lastMessage]);

  const handleAuth = useCallback((e: { preventDefault(): void }) => {
    e.preventDefault();
    send({ type: 'host_auth', token: tokenInput });
  }, [tokenInput, send]);

  const handleStart = useCallback((e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!selectedId) return;
    setActiveId(selectedId);
    setAnsweredCount(0);
    setResults([]);
    send({ type: 'start_question', questionId: selectedId, timeoutSec });
    setPhase('running');
  }, [selectedId, timeoutSec, send]);

  const handleEnd = useCallback(() => {
    send({ type: 'end_question', questionId: activeId });
  }, [activeId, send]);

  if (status === 'closed') return <p>Переподключение...</p>;

  if (phase === 'auth') {
    return (
      <form onSubmit={handleAuth}>
        <h1>Ведущий</h1>
        {authError && <p style={{ color: 'red' }}>{authError}</p>}
        <input
          type="password"
          value={tokenInput}
          onChange={e => setTokenInput(e.target.value)}
          placeholder="Токен ведущего"
        />
        <button type="submit">Войти</button>
      </form>
    );
  }

  if (phase === 'running') {
    return (
      <div>
        <h1>Вопрос: {activeId}</h1>
        <p>Ответили: {answeredCount} / {studentCount}</p>
        <button type="button" onClick={handleEnd}>Завершить раунд</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Панель ведущего</h1>
      <p>Студентов в сессии: {studentCount}</p>

      {phase === 'ended' && results.length > 0 && (
        <section>
          <h2>Результаты раунда</h2>
          <ul>
            {results.map(r => (
              <li key={r.studentId}>
                {r.name}: <code>{r.answer}</code> — {r.correct ? 'верно' : 'неверно'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <form onSubmit={handleStart}>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
        >
          {questions.map(q => (
            <option key={q.id} value={q.id}>{q.id}</option>
          ))}
        </select>
        <input
          type="number"
          value={timeoutSec}
          min={10}
          max={300}
          onChange={e => setTimeoutSec(Number(e.target.value))}
        />
        <button type="submit">Запустить вопрос</button>
      </form>

      {scores.length > 0 && (
        <section>
          <h2>Рейтинг</h2>
          <ol>
            {scores.map(s => <li key={s.studentId}>{s.name} — {s.points}</li>)}
          </ol>
        </section>
      )}
    </div>
  );
}
