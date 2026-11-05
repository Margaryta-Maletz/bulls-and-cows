import Scoreboard from '../components/Scoreboard.tsx';
import Chat from '../components/Chat.tsx';
import { useHostGame } from '../hooks/useHostGame.ts';
import { HOST } from '../labels.ts';

const hReconnecting   = HOST.reconnecting;
const hTitle          = HOST.title;
const hTokenHint      = HOST.tokenHint;
const hLoginBtn       = HOST.loginBtn;
const hQuestionPrefix = HOST.questionPrefix;
const hAnsweredPrefix = HOST.answeredPrefix;
const hSeparator      = HOST.separator;
const hEndRound       = HOST.endRound;
const hPanelTitle     = HOST.panelTitle;
const hStudentsPrefix = HOST.studentsPrefix;
const hRoundResults   = HOST.roundResults;
const hResultCorrect  = HOST.resultCorrect;
const hResultWrong    = HOST.resultWrong;
const hAddPoint       = HOST.addPoint;
const hRemovePoint    = HOST.removePoint;
const hStartQuestion  = HOST.startQuestion;
const hFileLabel      = HOST.fileLabel;
const hChatTitle      = HOST.chatTitle;
const hChatSelectHint = HOST.chatSelectHint;
const hUnreadBadge    = HOST.unreadBadge;

export default function HostPage() {
  const g = useHostGame();

  if (g.status === 'closed') {
    return <p>{hReconnecting}</p>;
  }

  const phase           = g.phase;
  const tokenInput      = g.tokenInput;
  const authError       = g.authError;
  const questionFiles   = g.questionFiles;
  const questionFile    = g.questionFile;
  const questions       = g.questions;
  const selectedId      = g.selectedId;
  const activeId        = g.activeId;
  const timeoutSec      = g.timeoutSec;
  const students        = g.students;
  const studentCount    = g.studentCount;
  const answeredCount   = g.answeredCount;
  const results         = g.results;
  const scores          = g.scores;
  const hostChats       = g.hostChats;
  const chatStudentId   = g.chatStudentId;
  const unreadCount     = g.unreadCount;

  const handleAuth              = g.handleAuth;
  const handleStart             = g.handleStart;
  const handleEnd               = g.handleEnd;
  const handleTokenChange       = g.handleTokenChange;
  const handleSelectChange      = g.handleSelectChange;
  const handleTimeoutChange     = g.handleTimeoutChange;
  const handleFileChange        = g.handleFileChange;
  const handleOverride          = g.handleOverride;
  const handleChatStudentChange = g.handleChatStudentChange;
  const handleHostChatSend      = g.handleHostChatSend;

  const isAuth         = phase === 'auth';
  const isRunning      = phase === 'running';
  const isReadyOrEnded = phase === 'ready' || phase === 'ended';
  const hasResults     = phase === 'ended' && results.length > 0;

  // Pre-compute form elements
  const tokenInputEl   = <input type="password" value={tokenInput} onChange={handleTokenChange} placeholder={hTokenHint} />;
  const timeoutInputEl = <input type="number" value={timeoutSec} min={10} max={300} onChange={handleTimeoutChange} />;
  const scoreboardEl   = <Scoreboard scores={scores} />;

  const fileSelectEl = (
    <select value={questionFile} onChange={handleFileChange}>
      {questionFiles.map(f => <option key={f} value={f}>{f}</option>)}
    </select>
  );

  const questionSelectEl = (
    <select value={selectedId} onChange={handleSelectChange}>
      {questions.map(q => <option key={q.id} value={q.id}>{q.id}</option>)}
    </select>
  );

  const chatStudentSelectEl = (
    <select value={chatStudentId} onChange={handleChatStudentChange}>
      <option value="">{hChatSelectHint}</option>
      {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  );

  // Pre-compute conditional elements
  const authErrorEl = authError !== '' ? <p className="error">{authError}</p> : null;
  const unreadEl    = unreadCount > 0 ? <span className="badge">{String(unreadCount) + ' ' + hUnreadBadge}</span> : null;

  const currentChatMsgs = hostChats.filter(m => m.studentId === chatStudentId);
  const chatEl = chatStudentId !== '' ? <Chat messages={currentChatMsgs} onSend={handleHostChatSend} /> : null;

  const resultItems = results.map(r => (
    <li key={r.studentId}>
      {r.name}{': '}<code>{r.answer}</code>
      {r.correct ? hResultCorrect : hResultWrong}
      <button type="button" onClick={handleOverride(r.studentId, true)}>{hAddPoint}</button>
      <button type="button" onClick={handleOverride(r.studentId, false)}>{hRemovePoint}</button>
    </li>
  ));

  const resultsEl = hasResults ? (
    <section>
      <h2>{hRoundResults}</h2>
      <ul>{resultItems}</ul>
    </section>
  ) : null;

  // Pre-compute phase blocks
  const authBlock = isAuth ? (
    <form onSubmit={handleAuth}>
      <h1>{hTitle}</h1>
      {authErrorEl}
      {tokenInputEl}
      <button type="submit">{hLoginBtn}</button>
    </form>
  ) : null;

  const runningBlock = isRunning ? (
    <div>
      <h1>{hQuestionPrefix + activeId}</h1>
      <p>{hAnsweredPrefix + String(answeredCount) + hSeparator + String(studentCount)}</p>
      <button type="button" onClick={handleEnd}>{hEndRound}</button>
    </div>
  ) : null;

  const panelBlock = isReadyOrEnded ? (
    <div>
      <h1>{hPanelTitle}</h1>
      <p>{hStudentsPrefix + String(studentCount)}</p>
      {resultsEl}
      <form onSubmit={handleStart}>
        <label>
          {hFileLabel}
          {fileSelectEl}
        </label>
        {questionSelectEl}
        {timeoutInputEl}
        <button type="submit">{hStartQuestion}</button>
      </form>
      {scoreboardEl}
      <section>
        <h2>{hChatTitle}{unreadEl}</h2>
        {chatStudentSelectEl}
        {chatEl}
      </section>
    </div>
  ) : null;

  return (
    <>
      {authBlock}
      {runningBlock}
      {panelBlock}
    </>
  );
}
