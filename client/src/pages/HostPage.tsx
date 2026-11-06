import Scoreboard from '../components/Scoreboard.tsx';
import Chat from '../components/Chat.tsx';
import { useHostGame } from '../hooks/useHostGame.ts';
import type { QuestionStat } from '../hooks/useHostGame.ts';
import { HOST, LABELS } from '../labels.ts';

function cardClass(stat: QuestionStat | undefined): string {
  if (!stat || stat.status === 'idle') return 'q-card';
  if (stat.status === 'active') return 'q-card q-card-active';
  const pass = stat.totalStudents > 0
    ? stat.correctCount / stat.totalStudents >= 0.5
    : stat.correctCount > 0;
  return pass ? 'q-card q-card-pass' : 'q-card q-card-fail';
}

export default function HostPage() {
  const g = useHostGame();

  if (g.status === 'closed') {
    return <p>{HOST.reconnecting}</p>;
  }

  if (g.phase === 'auth') {
    return (
      <form onSubmit={g.handleAuth}>
        <h1>{HOST.title}</h1>
        {g.authError && <p className="error">{g.authError}</p>}
        <input type="password" value={g.tokenInput} onChange={g.handleTokenChange} placeholder={HOST.tokenHint} />
        <button type="submit">{HOST.loginBtn}</button>
      </form>
    );
  }

  const unreadEl = g.unreadCount > 0
    ? <span className="badge">{String(g.unreadCount) + ' ' + HOST.unreadBadge}</span>
    : null;

  const cards = g.questions.map(q => {
    const stat = g.questionStats[q.id];
    const st = stat?.status ?? 'idle';

    let statsEl = null;
    if (st === 'active') {
      statsEl = <span className="q-card-stats">{stat.answeredCount}{HOST.cardAnswered}{stat.totalStudents}</span>;
    } else if (st === 'ended') {
      statsEl = <span className="q-card-stats">{stat.answeredCount}{HOST.cardAnswered}{stat.totalStudents} · {stat.correctCount}{HOST.cardCorrect}</span>;
    }

    return (
      <button
        key={q.id}
        type="button"
        className={cardClass(stat)}
        onClick={() => g.handleCardClick(q.id)}
        title={q.comment}
      >
        <span className="q-card-id">{q.id}</span>
        <pre className="q-card-code">{q.code}</pre>
        {q.comment && <span className="q-card-comment">{q.comment}</span>}
        <div className="q-card-footer">
          <span className="q-card-answer">{q.answers[0]}</span>
          {statsEl}
        </div>
      </button>
    );
  });

  const chatEl = g.chatStudentId
    ? <Chat messages={g.hostChats.filter(m => m.studentId === g.chatStudentId)} onSend={g.handleHostChatSend} />
    : null;

  return (
    <>
      {g.reconnected && <div className="toast">{LABELS.toastReconnected}</div>}
      <div className="host-layout">
        <div className="host-panel">
          <h1>{HOST.panelTitle}</h1>
          <div className="host-controls">
            <label>
              {HOST.fileLabel}
              <select value={g.questionFile} onChange={g.handleFileChange}>
                {g.questionFiles.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label>
              {HOST.timeLabel}
              <input type="number" value={g.timeoutSec} min={10} max={300} onChange={g.handleTimeoutChange} />
            </label>
          </div>
          <div className="question-cards">{cards}</div>
          <Scoreboard scores={g.scores} />
        </div>

        <div className="host-chat-col">
          <div className="students-row">
            <p className="students-count">{HOST.studentsPrefix + String(g.studentCount)}</p>
            <button type="button" className="reset-btn" onClick={g.handleReset}>{HOST.resetSession}</button>
          </div>
          <select value={g.chatStudentId} onChange={g.handleChatStudentChange}>
            <option value="">{HOST.chatSelectHint}</option>
            {g.students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <h2>{HOST.chatTitle}{unreadEl}</h2>
          {chatEl}
        </div>
      </div>
    </>
  );
}
