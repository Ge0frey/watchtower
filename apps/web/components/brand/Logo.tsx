/**
 * The mark, and the mark set with the name.
 *
 * Drawn rather than loaded from /public so the register takes its colour from
 * whatever it is sitting on: the ring and ticks are currentColor, so the mark is
 * ink inside a paper header and paper inside the closing black band without a
 * second file being fetched. Only the axis is fixed, and it is the one thing in
 * the system that should be: the register changes colour to suit the ground it
 * is printed on, the proof does not. Sage means PROVEN, on every ground.
 *
 * The SVGs in /public are the same geometry for anywhere React is not — the tab
 * icon, a README, a deck, a slide.
 */

export function Logo({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
      strokeWidth={2.6}
      strokeLinecap="round"
    >
      <g stroke="currentColor">
        <circle cx="13.2" cy="16" r="9.2" />
        <path d="M13.2 4V8.4" />
        <path d="M13.2 23.6V28" />
      </g>
      {/* the proven axis — the only part that is coloured, and the only part that leaves the ring */}
      <path stroke="var(--color-accent)" d="M3.9 16H28" />
    </svg>
  );
}

/**
 * Mark and wordmark, one clear space apart.
 *
 * The gap is the ring's radius. The sage axis runs out of the ring and points
 * into the name, so this is not decoration sitting next to a word — the mark is
 * aimed at it, and closing the gap would put the beam through the W.
 *
 * The wordmark keeps the setting it already had: mono, bold, 0.24em, filed like
 * a field heading rather than signed like a signature.
 */
export function Lockup({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Logo size={size} />
      <span className="font-mono text-[13px] font-bold uppercase tracking-[0.24em]">Watchtower</span>
    </span>
  );
}
