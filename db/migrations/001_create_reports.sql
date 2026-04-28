CREATE TABLE IF NOT EXISTS reports (
    report_id        VARCHAR(20)      PRIMARY KEY,
    raw_text         TEXT             NOT NULL,
    image_url        TEXT,
    latitude         DOUBLE PRECISION NOT NULL,
    longitude        DOUBLE PRECISION NOT NULL,
    submitted_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    need_type        VARCHAR(50),
    urgency_score    DOUBLE PRECISION CHECK (urgency_score BETWEEN 0 AND 1),
    people_affected  INTEGER,
    priority_score   DOUBLE PRECISION CHECK (priority_score BETWEEN 0 AND 10),
    is_flagged_review   BOOLEAN DEFAULT FALSE,
    is_incomplete_score BOOLEAN DEFAULT FALSE,
    duplicate_score     DOUBLE PRECISION,
    duplicate_of        VARCHAR(20) REFERENCES reports(report_id),
    processing_status   VARCHAR(20) DEFAULT 'pending'
        CHECK (processing_status IN ('pending','processing','done','failed'))
);
