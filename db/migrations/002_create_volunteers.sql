CREATE TABLE IF NOT EXISTS volunteers (
    volunteer_id   VARCHAR(20)      PRIMARY KEY,
    name           VARCHAR(255)     NOT NULL,
    email          VARCHAR(255)     UNIQUE NOT NULL,
    phone          VARCHAR(30),
    skills         TEXT[]           NOT NULL,
    latitude       DOUBLE PRECISION NOT NULL,
    longitude      DOUBLE PRECISION NOT NULL,
    availability   BOOLEAN          NOT NULL DEFAULT TRUE,
    rating         DOUBLE PRECISION DEFAULT 5.0 CHECK (rating BETWEEN 0 AND 5),
    notification_pref VARCHAR(10)   DEFAULT 'email'
        CHECK (notification_pref IN ('push','sms','email')),
    created_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
