CREATE TABLE IF NOT EXISTS users (
    user_id       VARCHAR(20)  PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('public_user','ngo_admin','volunteer')),
    ngo_id        VARCHAR(20),
    volunteer_id  VARCHAR(20),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
