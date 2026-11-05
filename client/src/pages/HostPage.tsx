import { useState, useEffect, useCallback } from 'react';
import type { Question, Score, ServerToHostMsg, StudentRoundResult } from '@ws-quiz/shared';
import { useSocket, wsUrl } from '../hooks/useSocket.ts';
import Scoreboard from '../components/Scoreboard.tsx';
import { HOST } from '../labels.ts';

type Phase       = 'auth' | 'ready' | 'running' | 'ended';
type FormSubmit  = { preventDefault(): void };
type InputChange = { currentTarget: { value: string } };

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
        // oxlint-disable-next-line react/set-state-in-effect -- WebSocket messages drive this component's state.
        setPhase('ready');
        setAuthError('');
        fetch('/questions/week-09.json')
          .then(r => r.json() as Promise<Question[]>)
          .then(qs => {
            setQuestions(qs);
            if (qs.length > 0) setSelectedId(qs[0].id);
          })
          .catch(() => { /* no questions available */ });
        break;
      case 'auth_failed':
        setTokenInput('');
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

  const handleAuth = useCallback((e: FormSubmit) => {
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

  const handleEnd = useCallback(() => {
    send({ type: 'end_question', questionId: activeId });
  }, [activeId, send]);

  const handleTokenChange    = useCallback((e: InputChange) => { setTokenInput(e.currentTarget.value); }, []);
  const handleSelectChange   = useCallback((e: InputChange) => { setSelectedId(e.currentTarget.value); }, []);
  const handleTimeoutChange  = useCallback((e: InputChange) => { setTimeoutSec(Number(e.currentTarget.value)); }, []);
  const handleOverride       = useCallback((studentId: string, correct: boolean) => () => {
    send({ type: 'override_score', studentId, correct });
  }, [send]);

  const questionOptions = questions.map(q => (
    <option key={q.id} value={q.id}>{q.id}</option>
  ));

  const resultItems = results.map(r => (
    <li key={r.studentId}>
      {r.name}{': '}<code>{r.answer}</code>
      {r.correct ? HOST.resultCorrect : HOST.resultWrong}
      <button type="button" onClick={handleOverride(r.studentId, true)}>{HOST.addPoint}</button>
      <button type="button" onClick={handleOverride(r.studentId, false)}>{HOST.removePoint}</button>
    </li>
  ));

  if (status === 'closed') {
    return <p>{HOST.reconnecting}</p>;
  }

  return (
    <>
      {phase === 'auth' && (
        <form onSubmit={handleAuth}>
          <h1>{HOST.title}</h1>
          {authError && <p className="error">{authError}</p>}
          <input
            type="password"
            value={tokenInput}
            onChange={handleTokenChange}
            placeholder={HOST.tokenHint}
          />
          <button type="submit">{HOST.loginBtn}</button>
        </form>
      )}
      {phase === 'running' && (
        <div>
          <h1>{HOST.questionPrefix + activeId}</h1>
          <p>{HOST.answeredPrefix + String(answeredCount) + HOST.separator + String(studentCount)}</p>
          <button type="button" onClick={handleEnd}>{HOST.endRound}</button>
        </div>
      )}
      {(phase === 'ready' || phase === 'ended') && (
        <div>
          <h1>{HOST.panelTitle}</h1>
          <p>{HOST.studentsPrefix + String(studentCount)}</p>
          {phase === 'ended' && results.length > 0 && (
            <section>
              <h2>{HOST.roundResults}</h2>
              <ul>{resultItems}</ul>
            </section>
          )}
          <form onSubmit={handleStart}>
            <select value={selectedId} onChange={handleSelectChange}>
              {questionOptions}
            </select>
            <input
              type="number"
              value={timeoutSec}
              min={10}
              max={300}
              onChange={handleTimeoutChange}
            />
            <button type="submit">{HOST.startQuestion}</button>
          </form>
          <Scoreboard scores={scores} />
        </div>
      )}
    </>
  );
}
