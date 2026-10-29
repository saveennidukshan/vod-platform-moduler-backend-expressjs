# VOD-backend-nodejs

Backend for a Video On Demand (VOD) platform built with Node.js.

## Authentication module

The backend follows a production-oriented layered and feature-based structure:

```text
src/
├── app.js                         # Express application composition
├── server.js                      # HTTP process bootstrap and shutdown
├── config/                        # Environment-backed application configuration
│   └── auth.js
├── http/
│   └── middleware/                # Transport-level request middleware
├── infrastructure/
│   ├── database/                  # Prisma/PostgreSQL database client
│   ├── mail/                      # SMTP transport
│   ├── persistence/               # In-memory development/test adapters
│   └── storage/                   # Upload/storage adapters
├── modules/
│   ├── auth/                      # Authentication feature
│   │   └── repositories/          # Auth persistence adapters
│   ├── users/                     # User management feature
│   │   └── repositories/
│   └── movies/                    # Movie feature boundary
└── shared/
    ├── errors/                    # Application error types
    ├── http/                      # Shared response helpers
    ├── messaging/                 # Email/message helpers
    └── security/                  # Crypto, JWT, HMAC, and password helpers
```

Feature modules own their routes, controllers, validation, services, and repositories.
Infrastructure is kept outside the domain modules so database, mail, and storage providers
can be replaced without changing API contracts.

## Security decisions

- Password hashing with `bcryptjs` (`BCRYPT_SALT_ROUNDS` configurable).
- Access + refresh JWT with separate secrets and expirations.
- Refresh token rotation with token-family invalidation on reuse detection.
- Refresh tokens stored as HMAC hashes (never plaintext).
- HTTP-only refresh cookie + SameSite + Secure controls.
- CSRF check for cookie refresh flow using double-submit token header (`x-csrf-token`).
- Validation for all auth endpoints with Joi.
- Account lockout + progressive delay for failed logins.
- Rate limiting for login/reset endpoints.
- Reset and email verification via signed, expiring, one-time tokens.
- Helmet enabled and credential-safe CORS config.
- Audit-style auth event logs without logging secrets.

## Required environment variables

Use secure values in production:

```env
APP_PORT=3000
NODE_ENV=development

JWT_ACCESS_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
JWT_ACTION_SECRET=change_me_action
ACCESS_TOKEN_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
EMAIL_VERIFY_TOKEN_EXPIRES_IN=24h
RESET_TOKEN_EXPIRES_IN=15m
BCRYPT_SALT_ROUNDS=12

FRONTEND_ORIGIN=http://localhost:3000
TRUST_PROXY=0
COOKIE_SECURE=false
COOKIE_SAMESITE=strict
REFRESH_TOKEN_COOKIE_NAME=refreshToken
CSRF_COOKIE_NAME=csrfToken

REQUIRE_EMAIL_VERIFICATION=false
AUTH_LOCK_THRESHOLD=5
AUTH_LOCK_MINUTES=15
AUTH_PROGRESSIVE_DELAY_MS=250
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=10
RESET_RATE_LIMIT_WINDOW_MS=900000
RESET_RATE_LIMIT_MAX=5
REFRESH_TOKEN_HASH_SECRET=change_me_hash_secret

# PostgreSQL database URL. If omitted, in-memory storage is used.
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/vod_platform?schema=public

# Optional email
EMAIL_USER=
EMAIL_PASS=
APP_NAME=vod-platform
```

In production, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACTION_SECRET`, and
`REFRESH_TOKEN_HASH_SECRET` must be independently generated secrets of at least 32
characters. The application rejects insecure defaults at startup. Set `COOKIE_SECURE=true`
when serving over HTTPS and configure `TRUST_PROXY` only when the deployment is behind a
trusted reverse proxy.

## Auth endpoints

Base path: `/api/v1/auth`

- `POST /register`
- `POST /signup` (backward-compatible alias)
- `POST /login`
- `POST /logout`
- `POST /refresh-token`
- `GET /me`
- `POST /forgot-password`
- `POST /reset-password`
- `POST /change-password`
- `POST /verify-email`
- `POST /resend-verification-email`
- `GET /protected-sample` (example protected route)

## Example flow (register/login/refresh/logout)

1. **Register**: `POST /auth/register` with email/password.
   - Returns access token in JSON.
   - Sets refresh token cookie (`HttpOnly`) and CSRF cookie.
2. **Call protected APIs** with an Authorization header containing the access token.
3. **Refresh**: `POST /auth/refresh-token`
   - For cookie flow, send `x-csrf-token` header with CSRF cookie value.
   - Returns new access token and rotates refresh token.
4. **Logout**: `POST /auth/logout` to revoke refresh token and clear cookies.

## Request/response examples

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPass@1234"
}
```

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "role": "user",
      "isEmailVerified": false
    },
    "accessToken": "..."
  }
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "StrongPass@1234"
}
```

### Refresh token

```http
POST /api/v1/auth/refresh-token
x-csrf-token: <csrf cookie value>
```

### Current user

```http
GET /api/v1/auth/me
Authorization: ******
```

## Local setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run lint
npm test -- --runInBand tests/auth.test.js
npm run dev
```

The application uses Prisma ORM with PostgreSQL. Set `DATABASE_URL` before starting the
server, then run `npm run prisma:migrate -- --name init` for a local development database.
Use `npm run prisma:deploy` in deployment environments. When `DATABASE_URL` is not set,
the existing in-memory adapters are used for tests and local development.

Operational endpoints:

- `GET /health/live` — process liveness probe.
- `GET /health/ready` — application readiness probe.

All responses include an `x-request-id` header and a request ID in error responses. Clients
may provide a safe `x-request-id` value for distributed tracing; otherwise one is generated.

## Testing coverage added

`tests/auth.test.js` validates:

- Register + `/me` happy path
- Invalid credentials
- Invalid access token
- Account lockout behavior
- Refresh token reuse detection
- Reset token expiry
