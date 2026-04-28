CREATE TABLE IF NOT EXISTS notifications (
    notification_id  VARCHAR(20)   PRIMARY KEY,
    volunteer_id     VARCHAR(20)   NOT NULL REFERENCES volunteers(volunteer_id),
    task_id          VARCHAR(20)   NOT NULL REFERENCES tasks(task_id),
    channel          VARCHAR(10)   NOT NULL,
    sent_at          TIMESTAMPTZ,
    responded_at     TIMESTAMPTZ,
    response         VARCHAR(10)   CHECK (response IN ('accepted','rejected'))
);
