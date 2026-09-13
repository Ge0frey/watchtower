import Link from 'next/link';
import { creditcoinAddressUrl } from '@watchtower/shared';

const CORE = process.env.NEXT_PUBLIC_WATCHTOWER_CORE;

/**
 * The footer's job is to be checkable.
 *
 * It ends the page on a contract address rather than a slogan, because the whole
 * argument above it is "do not take our word for anything" — and the last thing a
 * reader sees should be the link that lets them stop taking our word for it.
 *
 * It is also the page's closing black band: the document ends on ink, which is the
 * closing black band, and the document ends on ink.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-ink bg-ink text-paper">
      <div className="shell py-20">
        <div className="grid gap-14 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <p className="display text-[clamp(2rem,4vw,3rem)] text-paper">
              Do not take
              <br />
              our word for it.
            </p>
            <p className="mt-6 max-w-[44ch] text-[14px] leading-relaxed text-paper/50">
              Proof-native insurance for Ethereum, underwritten on Creditcoin. Every claim is a
              cryptographic proof of an Ethereum transaction, verified on-chain by the Attestcoin
              Protocol&rsquo;s block prover precompile.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterColumn title="Application">
              <FooterLink href="/dashboard">Dashboard</FooterLink>
              <FooterLink href="/subjects">Subjects</FooterLink>
              <FooterLink href="/incidents">Incidents</FooterLink>
              <FooterLink href="/vault">Vault</FooterLink>
              <FooterLink href="/prosecute">Prosecute</FooterLink>
              <FooterLink href="/docs">Docs</FooterLink>
            </FooterColumn>

            <FooterColumn title="Understand">
              <FooterLink href="/#problem">The problem</FooterLink>
              <FooterLink href="/#insight">The insight</FooterLink>
              <FooterLink href="/#engine">The engine</FooterLink>
              <FooterLink href="/#honest">What we admit</FooterLink>
              <FooterLink href="/docs/architecture">Architecture</FooterLink>
              <FooterLink href="/docs/attestcoin">Protocol integration</FooterLink>
            </FooterColumn>

            <FooterColumn title="Verify">
              {CORE && (
                <a
                  className="block font-mono text-[12px] text-accent transition-colors hover:text-paper"
                  href={creditcoinAddressUrl(CORE)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WatchtowerCore ↗
                </a>
              )}
              <span className="block font-mono text-[12px] text-paper/40">
                Creditcoin CC3 Testnet · 102031
              </span>
              <span className="block font-mono text-[12px] text-paper/40">Precompile 0x0FD2</span>
            </FooterColumn>
          </div>
        </div>
      </div>

      <div className="border-t border-paper/12">
        <div className="shell flex flex-wrap items-center justify-between gap-4 py-6">
          <p className="label text-paper/35">
            Ethereum Sepolia · chainKey 1 &nbsp;/&nbsp; Ethereum Mainnet · chainKey 3
          </p>
          <p className="label text-paper/35">Built for BUIDL CTC 2026 Fall</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label mb-5 text-paper/35">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block text-[14px] text-paper/60 transition-colors hover:text-accent">
      {children}
    </Link>
  );
}
