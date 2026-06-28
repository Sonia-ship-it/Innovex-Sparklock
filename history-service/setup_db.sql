-- Run this as the postgres superuser (in pgAdmin or psql -U postgres)
-- This grants sparklock user the ability to create tables in sparklock_history

\c sparklock_history

-- Grant schema usage and creation rights
GRANT USAGE ON SCHEMA public TO sparklock;
GRANT CREATE ON SCHEMA public TO sparklock;

-- Create tables with IF NOT EXISTS (safe to run multiple times)
CREATE TABLE IF NOT EXISTS events (
    id         BIGSERIAL PRIMARY KEY,
    type       VARCHAR(255) NOT NULL,
    sensor_id  VARCHAR(255),
    severity   VARCHAR(255) NOT NULL DEFAULT 'INFO',
    data       TEXT,
    location   VARCHAR(255),
    message    TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id              BIGSERIAL PRIMARY KEY,
    event_id        BIGINT NOT NULL,
    notified_users  TEXT,
    channel         VARCHAR(255),
    status          VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_actions (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    action     VARCHAR(255) NOT NULL,
    details    TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Grant table permissions to sparklock user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sparklock;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sparklock;

-- Make future tables auto-grant as well
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sparklock;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sparklock;

SELECT 'Setup complete! Tables created and permissions granted.' AS status;
