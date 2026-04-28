CREATE TABLE IF NOT EXISTS feedback (
    feedback_id          VARCHAR(20)   PRIMARY KEY,
    task_id              VARCHAR(20)   NOT NULL REFERENCES tasks(task_id),
    volunteer_id         VARCHAR(20)   NOT NULL REFERENCES volunteers(volunteer_id),
    report_id            VARCHAR(20)   NOT NULL REFERENCES reports(report_id),
    completion_status    VARCHAR(20)   NOT NULL
        CHECK (completion_status IN ('success','partial','failed')),
    ground_reality_text  TEXT,
    difficulty_rating    INTEGER       CHECK (difficulty_rating BETWEEN 1 AND 5),
    submitted_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
