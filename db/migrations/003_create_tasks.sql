CREATE TABLE IF NOT EXISTS tasks (
    task_id              VARCHAR(20)      PRIMARY KEY,
    report_id            VARCHAR(20)      NOT NULL REFERENCES reports(report_id),
    priority_score       DOUBLE PRECISION NOT NULL,
    status               VARCHAR(20)      NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','in_progress','completed','cancelled')),
    assigned_volunteer_ids TEXT[],
    required_skills      TEXT[],
    latitude             DOUBLE PRECISION NOT NULL,
    longitude            DOUBLE PRECISION NOT NULL,
    required_time_window TSTZRANGE,
    is_understaffed      BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    accepted_at          TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    last_rematched_at    TIMESTAMPTZ
);
