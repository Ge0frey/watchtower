# Using Watchtower

Everything is a **subject**: a pool, a bridge, a custodian, a price feed. Each is bound to one rule
that says what can be proven about it. Cover, capital and bounties all attach to subjects, and three
groups of people meet around them.

| You are | You want | What you do |
|---|---|---|
| a trader or holder | protection against something provable | buy cover on a subject |
| an underwriter | premium income, in exchange for payout risk | stake to a subject's tranche |
| a sponsor | a contract watched | fund its bounty pool |
| a prosecutor | bounties | prove incidents, relayed or self-signed |
| a challenger | a bad claim overturned | prove a skipped transaction, take the bond |

Start at `/` for what Watchtower is and why it can exist, then `/dashboard` for what it is currently
doing. Everything below reads without a wallet; only spending needs one.

---

## Buying cover

**`/subjects` → open one → Buy cover.**

The subject page tells you what its rule actually proves, what the chain currently says about it
(reserve ratio for a custodian, payouts to date for a pool), how much capital stands behind it, the
per-block payout cap, and — importantly — the **proven head**: the exact `(block, index)` the system
has verified up to. How current the evidence is matters as much as the numbers.

Enter a dollar amount. The premium is 1% of cover per 30 days, and it is quoted by reading
`usdToCtc` from the vault and applying the contract's own formula, so the figure shown is the figure
the contract will demand. One signature.

**Then nothing.** You never file a claim, because the claim is the proof. If the rule is ever proven
against that subject and you are the beneficiary, restitution arrives in your wallet, capped by your
cover, by the subject's staked tranche, and by the per-block cap.

## Underwriting

**`/vault` for the overview, `/subjects/[id]` to act.**

Stake CTC to a tranche and premiums accrue as buyers arrive. Withdrawals are blocked while that
subject has an unresolved breach — underwriters cannot exit between a proven violation and its
settlement. The UI says so rather than silently disabling the button.

## Funding a watch

**Any subject page → Fund a watch.**

Prosecutors are paid from bounty pools, and anyone can top one up. Fresh evidence earns the full
bounty; evidence past the 24-hour checkpoint cliff earns 20% of it, because its continuity proof
costs roughly ten times the gas. The schedule is derived from the protocol's own cost curve rather
than from a clock.

## Prosecuting

**`/prosecute`.** Paste transaction hashes — three from one block reads as a sandwich, one reads as a
failed transaction. Two modes:

- **Relayed** — the worker builds the proof, pays the gas, and takes the bounty. No wallet needed,
  so anyone can try it.
- **Sign it myself** — the worker returns ready-to-sign calldata, your wallet submits it, and the
  bounty is yours.

Neither mode can forge anything. The worker only assembles proofs; the Attestcoin Smart Contract
re-verifies every one inside the settling transaction, so a dishonest submission reverts rather than
pays.

Attestation takes about eight minutes end to end. Each step is narrated live — waiting for
attestation, building Merkle and continuity proofs, verifying on Creditcoin — because silence reads
as a hang.

## Challenging

**`/incidents/[id]` on an open breach.**

You cannot prove a negative on-chain, so a solvency claim is never self-evident: it depends on the
prosecutor having skipped nothing. Rather than pretend otherwise, such claims are bonded and left
open for a challenge window, shown as a countdown.

Prove one transaction from that custodian that falls inside the range they claimed to cover, and the
accumulator rolls back to its snapshot while their bond becomes yours. The fraud proof is an ordinary
verified window — one transaction wide, through the same entrypoint. Watchtower's defence runs on
Watchtower.

Once the window closes unchallenged, anyone can settle the breach and the payout goes through.

---

## Where each number comes from

| Shown | Source | Why |
|---|---|---|
| Reserves, cover, stakes, payout caps, proven head, price | **Creditcoin, via multicall** every 3s | Authoritative. Nothing that decides money is trusted to our backend. |
| Incident history, decoded evidence, leaderboard | worker REST | Presentation only. |
| Pipeline narration | worker SSE | The attestation wait needs a voice. |
| Cover, staking, bounties, challenges, self-prosecution | your wallet | User-signed, on Creditcoin. |

If the chain and the API ever disagree, the chain wins.

**Every page renders without a wallet.** Only spending needs one.

## Known limits

- **Solvency payouts go to the subject's first cover buyer.** `primaryHolder` is set by whoever buys
  cover first, and `ReserveConservation` returns no explicit beneficiary, so a second buyer on the
  same custodian would not be paid from a breach. Sandwich and failed-transaction verdicts name their
  beneficiary directly and are unaffected. Pro-rata settlement across policies is the fix.
- **Unstaking has no cooldown** beyond the frozen check — an underwriter can exit right up until a
  breach is proven.
- **Cover is per subject, not per position size.** A $2 policy pays at most $2, regardless of how
  much you were actually trading.
