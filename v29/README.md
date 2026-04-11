# HR Portal Starter v11 - Security Layer v1

This starter now includes a first real security layer:

- JWT access token authentication
- Refresh token flow
- Password hashing with bcryptjs
- Account lock after 5 failed attempts
- System Owner unlock flow
- Permission middleware on protected routes
- Maintenance mode enforcement
- Protected attachment access
- Rate limiting on auth endpoints
- Login attempts and security events stored in memory

## Demo Accounts
- owner / owner123
- hrmanager / hr123
- engineer / eng123
- pmzuluf / pm123
- cmzuluf / cm123

## Important Notes
- This is still a starter project using an in-memory store.
- Refresh tokens, security events, and login attempts reset when the server restarts.
- Attachment links now go through a protected `/files/request/:id` route.
- For a production system, move the store to PostgreSQL and use HTTP-only cookies.


## Security Layer v2
- Security & Audit page
- Locked accounts management
- Recent login attempts
- Recent security events
- Recent audit logs
- Better user scoping in /users


## PostgreSQL Persistence Layer
This version can persist the entire application state into PostgreSQL without rewriting all existing routes.

### How it works
- Current routes still use the same in-memory `db` object.
- On startup, if `DB_DRIVER=postgres` or `DATABASE_URL` is set, the server loads the latest saved state from PostgreSQL.
- The full application state is auto-saved every few seconds and again on graceful shutdown.
- Health check endpoint: `GET /health/db`

### Environment
Use the backend `.env.example` values:
- `DB_DRIVER=postgres`
- `DATABASE_URL=postgresql://...`
- `DB_AUTOSAVE_MS=10000`
- `PGSSL=false`

### Notes
- This is the safest migration step for the current starter because it preserves all existing route logic.
- Next production step would be moving from snapshot persistence to fully normalized PostgreSQL tables and repository-based queries.

## v25 - PostgreSQL normalization (phase 1)
This version starts the transition from a JSON snapshot to normalized PostgreSQL tables.

Implemented now:
- `users` table
- `employees` table
- auth reads from PostgreSQL when enabled
- users management reads/writes from PostgreSQL when enabled
- data is still synced back to the in-memory store so the rest of the starter app keeps working

### Environment
Set in `backend/.env`:
- `DB_DRIVER=postgres`
- `DATABASE_URL=postgres://...`
- `PGSSL=false` for local development if needed

### What changed
- New repository: `src/data/userEmployeeRepository.js`
- PostgreSQL bootstrap seeds `users` and `employees` if tables are empty
- Users create/edit/unlock/archive/reset/transfer now persist to PostgreSQL in postgres mode


## v31 Payroll Phase 2
- Employee compensation stored in PostgreSQL
- Manual payroll adjustments (allowance / deduction / advance)
- Payroll summary now calculates base pay, overtime pay, gross, deductions, and net amount
- Payroll slip endpoint: GET /payroll/runs/:id/payslip/:employeeId
- New endpoints for compensation and adjustments
