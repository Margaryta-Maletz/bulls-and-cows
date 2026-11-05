import Scoreboard from '../components/Scoreboard.tsx';
import CodeBlock from '../components/CodeBlock.tsx';
import Chat from '../components/Chat.tsx';
import { useJoinGame } from '../hooks/useJoinGame.ts';
import { LABELS } from '../labels.ts';

// Module-level — no JSX context, no S6747 risk
const reconnecting  = LABELS.reconnecting;
const gameTitle     = LABELS.gameTitle;
const nickname      = LABELS.nickname;
const joinBtn       = LABELS.joinBtn;
const waiting       = LABELS.waiting;
const answerPrompt  = LABELS.answerPrompt;
const submitBtn     = LABELS.submitBtn;
const waitingResult = LABELS.waitingResult;
const lblCorrect    = LABELS.correct;
const lblIncorrect  = LABELS.incorrect;
const rightAnswer   = LABELS.rightAnswer;
const totalPoints   = LABELS.totalPoints;

export default function JoinPage() {
  const game = useJoinGame();

  if (game.status === 'closed') {
    return <p>{reconnecting}</p>;
  }

  // Individual assignments — no destructuring block, no {} for Sonar to misread
  const phase         = game.phase;
  const error         = game.error;
  const question      = game.question;
  const result        = game.result;
  const scores        = game.scores;
  const isSubmitting  = game.isSubmitting;
  const chatMsgs      = game.chatMsgs;
  const nameInput     = game.nameInput;
  const answer        = game.answer;
  const handleJoin         = game.handleJoin;
  const handleAnswer       = game.handleAnswer;
  const handleNameChange   = game.handleNameChange;
  const handleAnswerChange = game.handleAnswerChange;
  const handleChatSend     = game.handleChatSend;

  const codeSnippet = question !== null ? question.code : '';
  const correctness = result?.correct ? lblCorrect : lblIncorrect;
  const resultText  = result !== null ? correctness : '';
  const resultRight = result !== null ? rightAnswer + result.correctAnswer : '';
  const resultPts   = result !== null ? totalPoints + String(result.totalPoints) : '';

  const errorEl   = error !== '' ? <p className="error">{error}</p> : null;
  const chatPanel = <Chat messages={chatMsgs} onSend={handleChatSend} />;
  const codeBlock = <CodeBlock>{codeSnippet}</CodeBlock>;
  const board     = <Scoreboard scores={scores} />;

  return (
    <>
      {phase === 'join' && (
        <form onSubmit={handleJoin}>
          <h1>{gameTitle}</h1>
          {errorEl}
          <input value={nameInput} onChange={handleNameChange} placeholder={nickname} />
          <button type="submit">{joinBtn}</button>
        </form>
      )}
      {phase === 'waiting' && (
        <div>
          <p>{waiting}</p>
          {chatPanel}
        </div>
      )}
      {phase === 'answering' && question !== null && (
        <form onSubmit={handleAnswer}>
          {errorEl}
          {codeBlock}
          <input value={answer} onChange={handleAnswerChange} placeholder={answerPrompt} disabled={isSubmitting} />
          <button type='submit' disabled={isSubmitting}>{submitBtn}</button>
        </form>
      )}
      {phase === 'answered' && (
        <div>
          <p>{waitingResult}</p>
          {chatPanel}
        </div>
      )}
      {phase === 'result' && result !== null && (
        <div>
          <p>{resultText}</p>
          <p>{resultRight}</p>
          <p>{resultPts}</p>
          {board}
          {chatPanel}
        </div>
      )}
    </>
  );
}
