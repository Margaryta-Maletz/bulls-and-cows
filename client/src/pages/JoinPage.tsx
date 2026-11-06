import CodeBlock from '../components/CodeBlock.tsx';
import Chat from '../components/Chat.tsx';
import { useJoinGame } from '../hooks/useJoinGame.ts';
import { LABELS } from '../labels.ts';

const reconnecting      = LABELS.reconnecting;
const toastMsg          = LABELS.toastReconnected;
const gameTitle         = LABELS.gameTitle;
const nickname      = LABELS.nickname;
const joinBtn       = LABELS.joinBtn;
const waiting       = LABELS.waiting;
const answerPrompt  = LABELS.answerPrompt;
const submitBtn     = LABELS.submitBtn;
const waitingResult = LABELS.waitingResult;

export default function JoinPage() {
  const game = useJoinGame();

  if (game.status === 'closed') {
    return <p>{reconnecting}</p>;
  }

  const phase       = game.phase;
  const error       = game.error;
  const submitting  = game.isSubmitting;
  const showBonus   = game.showBonus;
  const msgs        = game.chatMsgs;
  const hideBonus   = game.hideBonus;
  const rejoined    = game.reconnected;
  const nick        = game.nameInput;
  const reply       = game.answer;
  const onJoin      = game.handleJoin;
  const onReply     = game.handleAnswer;
  const onNickType  = game.handleNameChange;
  const onReplyType = game.handleAnswerChange;
  const onSendMsg   = game.handleChatSend;

  const isJoin      = phase === 'join';
  const isWaiting   = phase === 'waiting';
  const snippet     = game.questionCode;
  const isAnswering = phase === 'answering' && snippet !== '';
  const isAnswered  = phase === 'answered';
  const qType       = game.question?.questionType ?? 'input';
  const options     = game.question?.options;
  const selOpts     = game.selectedOptions;
  const onToggle    = game.handleOptionToggle;

  const errEl  = error !== '' && <p className="error">{error}</p>;
  const msgEl  = <Chat messages={msgs} onSend={onSendMsg} />;
  const taskEl = <CodeBlock>{snippet}</CodeBlock>;
  const nickEl = <input value={nick} onChange={onNickType} placeholder={nickname} />;

  const f0 = <form onSubmit={onJoin}>
    <h1>{gameTitle}</h1>
    {errEl}
    {nickEl}
    <button type="submit">{joinBtn}</button>
  </form>;

  const optionsEl = (qType === 'single' || qType === 'multiple') && options ? (
    <div className="options-list">
      {options.map(opt => (
        <label key={opt} className={selOpts.includes(opt) ? 'option-row option-row-selected' : 'option-row'}>
          <input
            type={qType === 'single' ? 'radio' : 'checkbox'}
            name="quiz-option"
            value={opt}
            checked={selOpts.includes(opt)}
            onChange={() => onToggle(opt)}
            disabled={submitting}
          />
          <code>{opt}</code>
        </label>
      ))}
    </div>
  ) : null;

  const inputEl = qType === 'input'
    ? <input value={reply} onChange={onReplyType} placeholder={answerPrompt} disabled={submitting} />
    : null;

  const canSubmit = qType === 'input' ? reply.trim() !== '' : selOpts.length > 0;

  const f1 = <form onSubmit={onReply}>
    {errEl}
    {optionsEl}
    {inputEl}
    <button type="submit" disabled={submitting || !canSubmit}>{submitBtn}</button>
  </form>;

  return (
    <>
      {showBonus && <div className="bonus-anim" onAnimationEnd={hideBonus}>+1</div>}
      {rejoined && <div className="toast">{toastMsg}</div>}
      {isJoin && f0}
      {isWaiting && (
        <div>
          <p>{waiting}</p>
          {msgEl}
        </div>
      )}
      {isAnswering && (
        <div>
          {taskEl}
          {f1}
        </div>
      )}
      {isAnswered && (
        <div>
          <p>{waitingResult}</p>
          {msgEl}
        </div>
      )}
    </>
  );
}
