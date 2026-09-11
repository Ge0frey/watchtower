import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The primitive vocabulary.
 *
 * Every screen is built from these, so a panel on the vault page and a panel on an
 * incident page are the same object — which is what makes the application feel like
 * one document rather than six pages.
 *
 * Rules encoded here rather than left to each caller:
 *  - soft corners, hairline rules, a raised paper surface. No shadows.
 *  - generous internal padding. Nothing in this file is tighter than 24px, because
 *    the fastest way to make a dense application unreadable is to save 8px.
 *  - tone is semantic, never decorative. `proven` is magenta and means the
 *    precompile verified it; `breach` vermilion; `pending` amber; `settled` green.
 *  - tone lives in a rule, a label and type — not in a filled panel. A page that
 *    tints whole surfaces to say "note" ends up looking like a page of warnings.
 *  - anything the chain produced is set in mono.
 */

export type Tone = 'neutral' | 'proven' | 'breach' | 'pending' | 'settled';

/** Type colour. The deep cut of the accent, so a proven value can simply be magenta. */
const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink/55',
  proven: 'text-accent-deep',
  breach: 'text-breach',
  pending: 'text-open',
  settled: 'text-settled',
};

/** The rule around a toned object. */
const TONE_BORDER: Record<Tone, string> = {
  neutral: 'border-ink/12',
  proven: 'border-accent/40',
  breach: 'border-breach/35',
  pending: 'border-open/35',
  settled: 'border-settled/30',
};

/** A mono, uppercase, wide-tracked micro-heading. The only label style there is. */
export function Label({
  children,
  className = '',
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <span className={`label ${tone === 'neutral' ? 'text-ink/50' : TONE_TEXT[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** A surface. Everything that groups content sits on one of these. */
export function Panel({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Tag className={`rounded-lg border border-ink/12 bg-card ${className}`}>{children}</Tag>;
}

/** Panel with the section's name in the corner — the default grouping on app pages. */
export function Section({
  title,
  aside,
  children,
  className = '',
  bodyClassName = 'p-7',
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Panel as="section" className={className}>
      <header className="flex items-center justify-between gap-4 border-b border-ink/10 px-7 py-4">
        <Label>{title}</Label>
        {aside}
      </header>
      <div className={bodyClassName}>{children}</div>
    </Panel>
  );
}

/**
 * A single number with its name.
 *
 * The number is always mono, because every one of them came off the chain, and it is
 * always the largest thing in its box — a statistic that has to compete with its own
 * label is not being reported, it is being decorated.
 *
 * The tile itself never takes a tint. A row of five statistics with two of them
 * filled in reads as a warning; the tone belongs on the value.
 */
export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  size = 'md',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
}) {
  const valueSize =
    size === 'lg'
      ? 'text-[32px] md:text-[40px]'
      : size === 'sm'
        ? 'text-xl'
        : 'text-[26px] md:text-[30px]';

  return (
    <div className="flex flex-col justify-between rounded-lg border border-ink/12 bg-card p-6">
      <Label className="mb-6 block">{label}</Label>
      <p
        className={`font-mono ${valueSize} leading-[0.95] tracking-tight ${
          tone === 'neutral' ? 'text-ink' : TONE_TEXT[tone]
        }`}
      >
        {value}
      </p>
      {sub && <p className="mt-3 font-mono text-[11px] leading-snug text-ink/40">{sub}</p>}
    </div>
  );
}

/**
 * A status tag. Hairline, mono, soft-cornered — never a pill and never dotted.
 * The tone is the type colour and the rule around it; nothing is added beside it.
 */
export function Badge({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${TONE_BORDER[tone]} ${TONE_TEXT[tone]}`}
    >
      {children}
    </span>
  );
}

/** A key/value row. Used wherever the chain is quoted back at the reader. */
export function Row({
  label,
  value,
  mono = true,
  tone = 'neutral',
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
  tone?: Tone;
}) {
  return (
    <div className="flex items-baseline justify-between gap-8 border-b border-ink/8 py-3 last:border-b-0">
      <span className="text-[13px] leading-snug text-ink/50">{label}</span>
      <span
        className={`text-right text-[13px] ${mono ? 'font-mono' : ''} ${
          tone === 'neutral' ? 'text-ink' : TONE_TEXT[tone]
        }`}
      >
        {value}
      </span>
    </div>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'ink';

const BUTTON: Record<ButtonVariant, string> = {
  /** The accent action. Magenta is the product's one loud colour and it is spent here. */
  primary: 'border-accent bg-accent text-ink hover:border-accent-deep hover:bg-accent-deep hover:text-paper',
  ink: 'border-ink bg-ink text-paper hover:border-accent hover:bg-accent hover:text-ink',
  ghost: 'border-ink/25 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-paper',
  danger: 'border-breach/40 bg-transparent text-breach hover:border-breach hover:bg-breach hover:text-paper',
};

/**
 * One button.
 *
 * Disabled is a flat grey control, never a faded accent — a washed-out pink button
 * reads as broken rendering rather than as "not yet".
 */
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...rest
}: { children: ReactNode; variant?: ButtonVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 disabled:pointer-events-none disabled:border-ink/10 disabled:bg-paper-dim disabled:text-ink/35 ${BUTTON[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/** A labelled input. Values are mono because most of them are hashes or amounts. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-2.5 block text-ink/50">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-[12px] leading-snug text-ink/40">{hint}</span>}
    </label>
  );
}

const INPUT =
  'w-full rounded-md border border-ink/20 bg-paper px-3.5 py-3 font-mono text-[13px] text-ink placeholder:text-ink/30 transition-colors focus:border-accent focus:bg-card focus:outline-none';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${INPUT} ${props.className ?? ''}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT} resize-y leading-relaxed ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT} appearance-none ${props.className ?? ''}`} />;
}

/**
 * A notice.
 *
 * A hairline card and nothing else — no tinted fill, no coloured edge, no dot. A
 * filled beige block is the single most dated thing a paper interface can do and a
 * thick coloured bar down one side is the second. The tone is carried by the type,
 * which is the only ornament that also has to be read.
 */
export function Notice({
  children,
  tone = 'pending',
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-ink/12 bg-card px-5 py-4">
      {title && <Label tone={tone} className="mb-2 block">{title}</Label>}
      <div
        className={`text-[13.5px] leading-relaxed ${
          // With a heading the tone is already stated, so the body stays quiet. Without
          // one the type is the only thing left to carry it.
          title || tone === 'neutral' ? 'text-ink/65' : TONE_TEXT[tone]
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/** Nothing here yet — said in a way that distinguishes empty from broken. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-ink/20 px-6 py-20 text-center">
      <p className="display text-2xl text-ink/70">{title}</p>
      {children && (
        <p className="mx-auto mt-3 max-w-[56ch] text-[14px] leading-relaxed text-ink/45">{children}</p>
      )}
    </div>
  );
}

/**
 * The page's own title block.
 *
 * An eyebrow set as marginalia, a display line that owns the top of the screen, and a
 * single sentence of lede. The generous bottom margin is load-bearing: it is the gap
 * that tells a reader where the chrome ends and the page begins.
 */
export function PageHead({
  eyebrow,
  title,
  lede,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-14 border-b border-ink/12 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-3xl">
          {eyebrow && <p className="label mb-5 text-ink/50">{eyebrow}</p>}
          <h1 className="display text-[clamp(2.75rem,7vw,4.75rem)]">{title}</h1>
          {lede && <p className="mt-6 max-w-[62ch] text-[17px] leading-relaxed text-ink/60">{lede}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}

/**
 * A heading for a band inside a page. Smaller than `PageHead`, same left edge, and it
 * always carries its "see everything" link on the far right so the reader never has
 * to hunt for the full list.
 */
export function SectionHead({
  eyebrow,
  title,
  aside,
  className = '',
}: {
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-8 flex flex-wrap items-end justify-between gap-5 ${className}`}>
      <div>
        {eyebrow && <p className="label mb-3 text-ink/45">{eyebrow}</p>}
        <h2 className="display text-[clamp(1.6rem,3vw,2.25rem)]">{title}</h2>
      </div>
      {aside}
    </header>
  );
}

/** The inline text link used everywhere a page hands off to another page. */
export function ArrowLink({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`group/arrow inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink transition-colors hover:text-accent-deep ${className}`}
    >
      {children}
      <span className="transition-transform duration-200 group-hover/arrow:translate-x-1">→</span>
    </span>
  );
}

/* ------------------------------------------------------------------ bento
 *
 * The card vocabulary.
 *
 * A row of three identical boxes is the most template-looking thing an interface
 * can do, so cards here are built from four moves instead:
 *
 *  1. UNEQUAL SPANS. A twelve-column grid where cells take 5/7 or 6/3/3, so the
 *     layout states a hierarchy rather than laying everything out as a list.
 *  2. AN OVERSIZED GLYPH on the bottom corner, grazing the card's edge. It is set
 *     in the interface face at a size no text ever reaches, at an opacity that
 *     keeps it texture rather than content — the number is already in the copy,
 *     this is the same number made architectural. One graphic per card: a ring
 *     behind it as well just produced two decorations competing.
 *  3. INK AND PAPER IN THE SAME GRID. One inverted cell per group gives the row a
 *     rhythm, and it reuses the page's existing paper/ink banding at card scale.
 *  4. CONTENT ANCHORED TO THE BOTTOM. The empty top half is the point; it is what
 *     stops a card reading as a filled-in form field.
 *
 * Deliberately not borrowed from the reference sheets: the soft gradient washes.
 * A blurred colour bloom behind a card belongs to a different, softer design
 * language than hairline rules and a single flat accent, and mixing the two reads
 * as indecision rather than as range.
 */

export type CardTone = 'paper' | 'ink';

const CARD_SURFACE: Record<CardTone, string> = {
  paper: 'border-ink/12 bg-card text-ink',
  ink: 'border-ink bg-ink text-paper',
};

/** The cropped glyph behind a card. Texture, never content. */
function Ghost({ children, tone }: { children: ReactNode; tone: CardTone }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -bottom-[0.07em] -right-[0.03em] select-none font-sans text-[clamp(5rem,10vw,8.5rem)] font-extrabold leading-[0.74] tracking-[-0.06em] ${
        tone === 'ink' ? 'text-paper/[0.09]' : 'text-ink/[0.06]'
      }`}
    >
      {children}
    </span>
  );
}

/**
 * One bento cell. Give it a column span and it takes its place in the grid; give
 * it an href and the whole card becomes the target.
 */
export function BentoCard({
  children,
  span = 'col-span-12',
  tone = 'paper',
  ghost,
  href,
  className = '',
}: {
  children: ReactNode;
  span?: string;
  tone?: CardTone;
  /** The oversized glyph anchored to the bottom-right corner. */
  ghost?: ReactNode;
  href?: string;
  className?: string;
}) {
  const shell = `group relative isolate flex min-w-0 flex-col overflow-hidden rounded-lg border transition-colors ${CARD_SURFACE[tone]} ${span} ${className}`;

  const inner = (
    <>
      {ghost !== undefined && <Ghost tone={tone}>{ghost}</Ghost>}
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`${shell} ${tone === 'ink' ? 'hover:border-accent' : 'hover:border-accent'}`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={shell}>{inner}</div>;
}

/**
 * The twelve-column bed every bento group sits in.
 *
 * `mobileCols` is explicit rather than inherited: a cell carrying `col-span-2` in a
 * single-column grid quietly creates an implicit second track, and implicit tracks
 * are auto-sized, so a two-up row built that way comes out uneven.
 */
export function Bento({
  children,
  className = '',
  mobileCols = 1,
}: {
  children: ReactNode;
  className?: string;
  mobileCols?: 1 | 2;
}) {
  return (
    <div
      className={`grid gap-4 md:grid-cols-12 ${mobileCols === 2 ? 'grid-cols-2' : 'grid-cols-1'} ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * One of the three ways in, used identically on the landing page and inside the
 * application so the model a visitor learns before signing up is the model they
 * meet after.
 */
export function DoorCard({
  href,
  step,
  title,
  body,
  cta,
  span,
  tone = 'paper',
  wide = false,
  compact = false,
}: {
  href: string;
  step: string;
  title: string;
  body: string;
  cta: string;
  span: string;
  tone?: CardTone;
  /** Lays the card out along its width, for a cell that spans the full grid. */
  wide?: boolean;
  /** Shorter, for the orientation strip inside the application. */
  compact?: boolean;
}) {
  const dim = tone === 'ink' ? 'text-paper/55' : 'text-ink/55';
  const faint = tone === 'ink' ? 'text-paper/40' : 'text-ink/40';
  const arrow = tone === 'ink' ? 'text-paper' : 'text-ink';

  // The wide cell keeps every word in a column on the left and hands the whole
  // right-hand half to the glyph. Pushing the call to action to the far edge put it
  // on top of the numeral and left a hole in the middle of the card.
  if (wide) {
    return (
      <BentoCard href={href} span={span} tone={tone} ghost={step}>
        <div className="flex min-h-[13rem] flex-col justify-end p-8 md:p-10">
          <p className={`label mb-5 ${faint}`}>Step {step}</p>
          <h3 className="display text-[clamp(1.5rem,2.6vw,2rem)]">{title}</h3>
          <p className={`mt-4 max-w-[58ch] text-[14.5px] leading-relaxed ${dim}`}>{body}</p>
          <span
            className={`mt-8 inline-flex w-fit items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] ${arrow}`}
          >
            {cta}
            <span className="transition-transform duration-200 group-hover:translate-x-1.5">→</span>
          </span>
        </div>
      </BentoCard>
    );
  }

  return (
    <BentoCard href={href} span={span} tone={tone} ghost={step}>
      <div className={`flex h-full flex-col justify-end p-8 md:p-10 ${compact ? 'min-h-[13.5rem]' : 'min-h-[17rem]'}`}>
        <p className={`label mb-5 ${faint}`}>Step {step}</p>
        <h3 className="display text-[clamp(1.5rem,2.6vw,2rem)]">{title}</h3>
        <p className={`mt-4 max-w-[34ch] text-[14.5px] leading-relaxed ${dim}`}>{body}</p>
        <span
          className={`mt-8 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] ${arrow}`}
        >
          {cta}
          <span className="transition-transform duration-200 group-hover:translate-x-1.5">→</span>
        </span>
      </div>
    </BentoCard>
  );
}
