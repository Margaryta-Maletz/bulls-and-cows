import { useState, useEffect, useCallback } from 'react';
import type { Score, ServerToStudentMsg } from '@ws-quiz/shared';
import { useSocket, wsUrl } from '../hooks/useSocket.ts';
import Scoreboard from '../components/Scoreboard.tsx';
import CodeBlock from '../components/CodeBlock.tsx';
import { LABELS } from '../labels.ts';

type FormSubmit  = { preventDefault(): void };
type InputChange = { currentTarget: { value: string } };

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

  const handleJoin = useCallback((e: FormSubmit) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    try { sessionStorage.setItem('studentName', trimmed); } catch {}
    send({ type: 'student_join', name: trimmed });
  }, [nameInput, send]);

  const handleAnswer = useCallback((e: FormSubmit) => {
    e.preventDefault();
    if (!question || !answer.trim()) return;
    send({ type: 'submit_answer', questionId: question.id, answer: answer.trim() });
  }, [question, answer, send]);

  const handleNameChange   = useCallback((e: InputChange) => { setNameInput(e.currentTarget.value); }, []);
  const handleAnswerChange = useCallback((e: InputChange) => { setAnswer(e.currentTarget.value); }, []);
  const codeSnippet        = question?.code ?? '';

  if (status === 'closed') {
    return <p>{LABELS.reconnecting}</p>;
  }

  return (
    <>
      {phase === 'join' && (
        <form onSubmit={handleJoin}>
          <h1>{LABELS.gameTitle}</h1>
          {error && <p className="error">{error}</p>}
          <input
            value={nameInput}
            onChange={handleNameChange}
            placeholder={LABELS.nickname}
          />
          <button type="submit">{LABELS.joinBtn}</button>
        </form>
      )}
      {phase === 'waiting' && (
        <p>{LABELS.waiting}</p>
      )}
      {phase === 'answering' && question !== null && (
        <form onSubmit={handleAnswer}>
          {error && <p className="error">{error}</p>}
          <CodeBlock>{codeSnippet}</CodeBlock>
          <input
            value={answer}
            onChange={handleAnswerChange}
            placeholder={LABELS.answerPrompt}
          />
          <button type="submit">{LABELS.submitBtn}</button>
        </form>
      )}
      {phase === 'answered' && (
        <p>{LABELS.waitingResult}</p>
      )}
      {phase === 'result' && result !== null && (
        <div>
          <p>{result.correct ? LABELS.correct : LABELS.incorrect}</p>
          <p>{LABELS.rightAnswer + result.correctAnswer}</p>
          <p>{LABELS.totalPoints + String(result.totalPoints)}</p>
          <Scoreboard scores={scores} />
        </div>
      )}
    </>
  );
}
