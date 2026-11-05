import type { Score } from '@ws-quiz/shared';

interface Props {
  readonly scores: Score[];
}

export default function Scoreboard({ scores }: Props) {
  if (scores.length === 0) return null;

  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Имя</th>
          <th>Очки</th>
        </tr>
      </thead>
      <tbody>
        {scores.map((s, i) => (
          <tr key={s.studentId}>
            <td>{i + 1}</td>
            <td>{s.name}</td>
            <td>{s.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
