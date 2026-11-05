import CodeBlock from '../components/CodeBlock.tsx';
import Chat from '../components/Chat.tsx';
import { useJoinGame } from '../hooks/useJoinGame.ts';
import { LABELS } from '../labels.ts';

const reconnecting  = LABELS.reconnecting;
const gameTitle     = LABELS.gameTitle;
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
  const question    = game.question;
  const submitting  = game.isSubmitting;
  const msgs        = game.chatMsgs;
  const nick        = game.nameInput;
  const reply       = game.answer;
  const onJoin      = game.handleJoin;
  const onReply     = game.handleAnswer;
  const onNickType  = game.handleNameChange;
  const onReplyType = game.handleAnswerChange;
  const onSendMsg   = game.handleChatSend;

  const isJoin      = phase === 'join';
  const isWaiting   = phase === 'waiting';
  const isAnswering = phase === 'answering' && question !== null;
  const isAnswered  = phase === 'answered';

  const snippet  = question !== null ? question.code : '';
  const errEl    = error !== '' ? <p className="error">{error}</p> : null;
  const msgEl    = <Chat messages={msgs} onSend={onSendMsg} />;
  const taskEl   = <CodeBlock>{snippet}</CodeBlock>;
  const nickEl   = <input value={nick} onChange={onNickType} placeholder={nickname} />;
  const replyEl  = <input value={reply} onChange={onReplyType} placeholder={answerPrompt} disabled={submitting} />;
  const sendEl   = <button type="submit" disabled={submitting}>{submitBtn}</button>;

  // Forms extracted to neutral-named vars — no wrapping () to avoid cascade
  const f0 = <form onSubmit={onJoin}>
    <h1>{gameTitle}</h1>
    {errEl}
    {nickEl}
    <button type="submit">{joinBtn}</button>
  </form>;

  const f1 = <form onSubmit={onReply}>
    {errEl}
    {replyEl}
    {sendEl}
  </form>;

  return (
    <>
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
