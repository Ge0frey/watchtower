'use client';

import Link from 'next/link';
import { SubjectTile } from '@/components/SubjectTile';
import { useChainState } from '@/hooks/useChainState';

/** The catalogue: everything Watchtower is currently willing to insure. */
export default function SubjectsPage() {
  const { data: subjects = [], isLoading, isError } = useChainState();

  return (
    <>
      <div className="page-head">
        <h2>Subjects</h2>
        <p className="dim">
          A subject is one thing being watched, bound to one rule that says what can be proven about
          it. Cover, capital and bounties all attach here.
        </p>
      </div>

      {isLoading && <div className="dim small">reading the registry…</div>}
      {isError && <div className="notice">Could not reach Creditcoin.</div>}

      <div className="tile-grid">
        {subjects.map((subject) => (
          <Link key={subject.id} href={`/subjects/${subject.id}`} className="tile-link">
            <SubjectTile subject={subject} />
          </Link>
        ))}
      </div>
    </>
  );
}
