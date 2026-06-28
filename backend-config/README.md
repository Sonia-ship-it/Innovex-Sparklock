# 🔥 Sparklock — Fire Detection & Prevention Platform

A microservices-based fire detection and prevention system that collects IoT sensor data, detects hazards in real-time, dispatches emergency notifications, and maintains a full audit history.

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  IoT Sensors │────▶│  Monitoring Svc   │────▶│    Kafka Broker      │
│  (MQTT/HTTP) │     │  (Node.js:3001)   │     │                     │
└─────────────┘     └──────────────────┘     └──────┬──────┬───────┘
                                                      │      │
                                               ┌──────▼──┐ ┌─▼──────────┐
                                               │Notif Svc│ │History Svc │
                                               │(NestJS) │ │(Spring Boot│
                                               │ :3000   │ │  :8082)    │
                                               └─────────┘ └────────────┘

┌─────────────┐     ┌──────────────────┐
│   Clients   │────▶│   Nginx Gateway  │────▶ Routes to all services
│  (Browser)  │     │     (:8080)      │
└─────────────┘     └──────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Auth Svc   │
                    │(Spring Boot)│
                    │   :8081     │
                    └─────────────┘
```

## 📦 Services

| Service | Tech Stack | Port | Description |
|---------|-----------|------|-------------|
| **Auth** | Spring Boot 4, JWT, BCrypt, Redis | 8081 | Registration, login, OTP reset, RBAC |
| **Monitoring** | Node.js, Express, TimescaleDB, MQTT | 3001 | Sensor ingestion, hazard detection |
| **Notification** | NestJS 11, TypeORM, Firebase/Twilio/Resend | 3000 | Multi-channel alerts with retry |
| **History** | Spring Boot 4, Kafka, PostgreSQL | 8082 | Event logs, analytics, audit trail |

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Java 21+ (for Spring Boot services)
- Node.js 20+ (for Node/NestJS services)

### 1. Start Infrastructure
```bash
cd backend-config
docker compose up -d
```
This starts PostgreSQL, Redis, Kafka, TimescaleDB, and Nginx gateway.

### 2. Start Services

**Auth Service** (port 8081):
```bash
cd auth-service
./mvnw spring-boot:run
```

**Monitoring Service** (port 3001):
```bash
cd monitoring-service
npm install
npm start
```

**Notification Service** (port 3000):
```bash
cd notification-service
npm install
npm run start:dev
```

**History Service** (port 8082):
```bash
cd history-service
./mvnw spring-boot:run
```

## 📡 API Reference

### Auth Service (`/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/signup` | ✗ | Register new user |
| POST | `/auth/login` | ✗ | Login → JWT token |
| POST | `/auth/logout` | ✓ | Logout |
| POST | `/auth/reset-password` | ✗ | Request OTP for password reset |
| POST | `/auth/verify-otp` | ✗ | Verify OTP & set new password |
| GET | `/auth/me` | ✓ | Get current user profile |

### Monitoring Service (`/monitor`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/monitor/data` | Push sensor data |
| GET | `/monitor/pcm/live` | Fetch latest PCM sensor readings |
| GET | `/monitor/pcm/live/all` | Fetch all historical PCM sensor readings |
| GET | `/monitor/kcm/live` | Fetch latest KCM (flame/gas) sensor readings |
| GET | `/monitor/kcm/live/all` | Fetch all historical KCM (flame/gas) sensor readings |
| GET | `/monitor/status` | Service health check |

### Notification Service (`/notify`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/notify/send` | Send notification (push/SMS/email) |
| POST | `/notify/dispatch` | Trigger emergency dispatch |
| GET | `/notify/status/:id` | Check notification delivery status |

### History Service (`/history`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/history/events` | List events (paginated) |
| GET | `/history/events/:id` | Event detail with alerts |
| GET | `/history/stats` | Aggregated analytics |

## ⚙️ Integration Flow

1. **Monitoring Service** receives sensor data via MQTT or REST API
2. **Rule Engine** evaluates thresholds (temperature, smoke, electrical load, gas, humidity)
3. If hazard detected → publishes to Kafka `hazard-events` topic
4. **Notification Service** consumes event → sends alerts → creates emergency dispatch
5. **History Service** consumes event → persists for audit trail and analytics
6. **Auth Service** secures all dashboard/API access with JWT tokens

## 🔐 Environment Variables

### Auth Service
- `jwt.secret` — JWT signing key
- `jwt.expiration-ms` — Token expiry (default: 24h)

### Monitoring Service
- `TIMESCALE_HOST/PORT/DB/USER/PASSWORD` — TimescaleDB connection
- `KAFKA_BROKERS` — Kafka bootstrap servers
- `MQTT_BROKER` — MQTT broker URL

### Notification Service
- `FIREBASE_SERVER_KEY` — Firebase FCM (optional, stub mode without)
- `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER` — Twilio SMS (optional)
- `RESEND_API_KEY` — Resend email (optional)
- `KAFKA_BROKERS` — Kafka bootstrap servers

## 🐳 Docker

Each service has its own `Dockerfile`. Use `docker compose` from `backend-config/` for backing services.

## 📜 License

ISC
