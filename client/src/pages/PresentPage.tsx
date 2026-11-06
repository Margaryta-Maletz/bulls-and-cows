import Timer from '../components/Timer.tsx';
import CodeBlock from '../components/CodeBlock.tsx';
import { usePresentGame } from '../hooks/usePresentGame.ts';
import { PRESENT } from '../labels.ts';

const pReconnecting = PRESENT.reconnecting;
const pWaiting      = PRESENT.waiting;
const pAnswered     = PRESENT.answered;
const pSeparator    = PRESENT.separator;
const pRightAnswer  = PRESENT.rightAnswer;

export default function PresentPage() {
  const g = usePresentGame();

  if (g.status === 'closed') {
    return <p>{pReconnecting}</p>;
  }

  const phase         = g.phase;
  const questionSrc   = g.questionSrc;
  const startedAt     = g.startedAt;
  const timeoutSec    = g.timeoutSec;
  const answerCount   = g.answerCount;
  const totalCount    = g.totalCount;
  const correctAnswer = g.correctAnswer;

  const isIdle   = phase === 'idle';
  const isActive = phase === 'active' && questionSrc !== '';
  const isEnded  = phase === 'ended';

  const counterText = pAnswered + String(answerCount) + pSeparator + String(totalCount);

  return (
    <>
      {isIdle && <p>{pWaiting}</p>}
      {isActive && (
        <div>
          <Timer startedAt={startedAt} timeoutSec={timeoutSec} />
          <div className="present-code">
            <CodeBlock>{questionSrc}</CodeBlock>
          </div>
          {g.options.length > 0 && (
            <div className="present-options">
              {g.options.map((opt, i) => (
                <div key={opt} className="present-option">
                  <span className="present-option-label">{String.fromCodePoint(65 + i)}</span>
                  <code>{opt}</code>
                </div>
              ))}
            </div>
          )}
          <p className="present-counter">{counterText}</p>
        </div>
      )}
      {isEnded && (
        <div>
          <div className="present-code">
            <CodeBlock>{questionSrc}</CodeBlock>
          </div>
          {g.options.length > 0 ? (
            <div className="present-options">
              {g.options.map((opt, i) => (
                <div key={opt} className={opt === correctAnswer ? 'present-option present-option-correct' : 'present-option'}>
                  <span className="present-option-label">{String.fromCodePoint(65 + i)}</span>
                  <code>{opt}</code>
                </div>
              ))}
            </div>
          ) : (
            <p className="present-answer-inline">
              {pRightAnswer} <code>{correctAnswer}</code>
            </p>
          )}
          <p className="present-counter">{counterText}</p>
        </div>
      )}
    </>
  );
}
