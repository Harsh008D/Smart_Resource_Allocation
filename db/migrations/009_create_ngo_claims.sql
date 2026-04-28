CREATE TABLE IF NOT EXISTS ngo_claims (
    claim_id     VARCHAR(20)  PRIMARY KEY,
    task_id      VARCHAR(20)  NOT NULL REFERENCES tasks(task_id),
    ngo_id       VARCHAR(20)  NOT NULL REFERENCES ngos(ngo_id),
    status       VARCHAR(20)  NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','accepted','rejected','timed_out')),
    sent_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ngo_claims_task_id ON ngo_claims(task_id);
CREATE INDEX IF NOT EXISTS idx_ngo_claims_ngo_id  ON ngo_claims(ngo_id);
