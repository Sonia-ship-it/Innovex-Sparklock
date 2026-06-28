-- SparkLock History Service Schema
-- Spring Boot runs this automatically on startup (spring.sql.init.mode=always)

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
