# Noviga Fractal Timeline Dashboard

Final React 18 + TypeScript + Vite + MUI v6 implementation for the Noviga Senior Frontend Timeline Dashboard assignment.

## Run locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

Copy `.env.example` to `.env` only if you need to override the backend URL.

## Test account

- Username: `analytics_user`
- Password: `dashboard123`

The supplied backend data is available for 22–25 June 2026.

## Implemented assignment features

- Real login, `/auth/me`, logout and session restoration
- Centralized bearer authorization and 401 handling
- Backend-driven asset tree and shift timings
- IST shift window → UTC API request conversion and UTC → IST display conversion
- Real machine interval and hourly cycle-time requests
- Manual refresh only; no polling/auto-refresh
- Production History timeline with backend segment bands
- Cumulative production view and individual produce view
- PASS/FAIL markers with FAIL preservation during thinning
- Shift+drag zoom, double-click reset and marker hover tooltip
- Hourly production/downtime summary with interval cutting at hour boundaries
- Loading, empty, 403, 422 and 500/retry states
- Canvas rendering for dense individual-produce data

See `NOTES.md` for implementation decisions and assumptions.
