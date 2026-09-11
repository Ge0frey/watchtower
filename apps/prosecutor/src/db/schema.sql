-- Production deployment path for the worker's durable state.
--
-- The default driver is an atomically-replaced JSON file (src/db/store.ts), which needs no
-- infrastructure and satisfies the protocol's robustness requirements: records survive a restart,
-- in-flight candidates replay, and cursors only advance after a confirmed receipt. This schema is the
-- same shape in Postgres, for when more than one worker shares state.

CREATE TABLE IF NOT EXISTS cursors (
    subject_id   TEXT PRIMARY KEY,
    height       BIGINT NOT NULL,
    tx_index     INTEGER NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidates (
    id           TEXT PRIMARY KEY,
    subject_id   TEXT NOT NULL,
    rule_id      TEXT NOT NULL,
    chain_key    INTEGER NOT NULL,
    tx_hashes    TEXT[] NOT NULL,
    block_height BIGINT NOT NULL,
    state        TEXT NOT NULL,
    attempts     INTEGER NOT NULL DEFAULT 0,
    last_error   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS candidates_state_idx ON candidates (state);

CREATE TABLE IF NOT EXISTS incidents (
    id                 TEXT PRIMARY KEY,
    subject_id         TEXT NOT NULL,
    rule_id            TEXT NOT NULL,
    prosecutor         TEXT,
    beneficiary        TEXT,
    damages_usd_e8     NUMERIC NOT NULL DEFAULT 0,
    paid_wei           NUMERIC NOT NULL DEFAULT 0,
    status             TEXT NOT NULL,
    challenge_deadline BIGINT,
    continuity_length  INTEGER,
    evidence           JSONB NOT NULL DEFAULT '[]'::jsonb,
    creditcoin_tx_hash TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_txs (
    incident_id  TEXT NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    position     INTEGER NOT NULL,
    chain_key    INTEGER NOT NULL,
    block_height BIGINT NOT NULL,
    tx_index     INTEGER NOT NULL,
    tx_hash      TEXT NOT NULL,
    from_addr    TEXT,
    to_addr      TEXT,
    status       BOOLEAN,
    PRIMARY KEY (incident_id, position)
);

CREATE TABLE IF NOT EXISTS prosecutors (
    address      TEXT PRIMARY KEY,
    submissions  INTEGER NOT NULL DEFAULT 0,
    bounties_wei NUMERIC NOT NULL DEFAULT 0,
    slashed_wei  NUMERIC NOT NULL DEFAULT 0
);
