'use client';

import { SubjectTile } from '@/components/SubjectTile';
import { Empty, Notice, PageHead } from '@/components/ui';
import { useChainState } from '@/hooks/useChainState';

/** The catalogue: everything Watchtower is currently willing to insure. */
export default function SubjectsPage() {
  const { data: all = [], isLoading, isError } = useChainState();
  // Retired subjects keep their page and their history, and stay listed in the Vault so nobody's
  // stake is hidden from them. They just leave the catalogue.
  const subjects = all.filter((s) => s.active);

  return (
    <>
      <PageHead
        eyebrow="The catalogue"
        title="Subjects"
        lede="A subject is one thing being watched, bound to one rule that says what can be proven about it. Cover, capital and bounties all attach here — open one to act on it."
      />

      {isError && (
        <div className="mb-12">
          <Notice tone="breach">Could not reach Creditcoin. Nothing below is current.</Notice>
        </div>
      )}

      {subjects.length === 0 ? (
        <Empty title={isLoading ? 'Reading the registry…' : 'No subjects registered'}>
          {!isLoading &&
            'Watchtower watches nothing by default. Register a contract with `pnpm watch <address>` and it becomes insurable.'}
        </Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((subject) => (
            <SubjectTile key={subject.id} subject={subject} />
          ))}
        </div>
      )}
    </>
  );
}
