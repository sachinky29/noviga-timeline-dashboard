# Implementation Notes

## Session/token management
- The backend returns `access_token` in the JSON login response.
- The token is stored in `localStorage` so a browser refresh can restore the session.
- Every authenticated request goes through one central `request()` function in `src/services/api.ts`, which reads the token and adds `Authorization: Bearer <token>`.
- On app load, the token is validated with `GET /auth/me` before the dashboard is shown.
- Any authenticated HTTP 401 clears the token and dispatches an `auth-expired` event; the app returns to login.
- Login HTTP 401 is handled locally as invalid credentials.
- Logout calls `POST /auth/logout` and clears the token in a `finally` block.
- Trade-off: localStorage survives refresh but is readable by JavaScript, so an HttpOnly cookie would provide stronger XSS protection in a production system. The assignment explicitly permits localStorage and asks for the trade-off to be documented.

## Chart performance
- The timeline is rendered on a single HTML Canvas rather than creating thousands of React/SVG nodes.
- Individual produces are flattened and timestamp-parsed once with `useMemo`.
- At dense zoom levels, PASS markers are screen-bucketed so multiple PASS events occupying the same pixel area do not all need to be painted.
- FAIL markers are never thinned or removed.
- Hover uses one canvas mouse handler and nearest-marker lookup instead of one DOM listener per produce.
- Shift+drag zooms to a selected time range; double-click resets the view. Pan is intentionally not implemented because it is out of scope.

## Time handling
- The API speaks UTC and the UI speaks IST (Asia/Kolkata).
- Shift start/end are first interpreted as local IST clock times.
- The selected shift window is converted to UTC ISO timestamps for API requests.
- Returned timestamps are converted to IST only for display.

## Hourly table
- The backend's runtime/downtime/stoppage segments are already tiled and clipped, so the app does not resolve overlaps.
- Each segment is intersected with each shift-aligned one-hour bucket and its overlap is accumulated in minutes.
- `produce_counts` are grouped by bucket and summed across part models.
- Cycle time comes from the separate `/analytics-query` request with `distribution: hourly` and is matched by bucket start.
- Future buckets in an in-progress shift are left blank rather than zero-filled.
- The screenshot uses shift-aligned hour columns (for example 08:30–09:30); this implementation follows the supplied screenshot for visual consistency.

## Asset and shift assumptions
- The full asset tree is flattened for selection rather than exposing a browsable hierarchy.
- The selected asset or optional descendant machine supplies both `asset_id` and `asset_level_id` to the analytics request.
- Shift definitions are generated from backend `shift_timings`; A/B/C are not hard-coded.

## Scope
Intentionally not implemented because the assignment lists them as out of scope:
- auto-refresh/polling
- segment classification/create dialogs
- CSV/PDF export
- settings/theme/i18n
- full hierarchy drill-down
- multi-machine dashboards

The reference screenshot contains some controls/features that are explicitly out of scope in the written assignment; the implementation follows the written scope for those items.


## Target UI refinement
- The dashboard header keeps the required product title and now displays `Username · <username>` with logout aligned to the right.
- Filters remain in a compact single card with Asset Level, Asset, optional Machine, Date, Shift, context chips, and an independent manual Refresh button.
- Point labels and Show Individual produces are visualization controls inside Production History, separate from Refresh.
- Production History uses a top-right state legend, result legend, compact timeline, interaction hints, last-observed and unknown-segment badges.
- The visual layout intentionally follows the supplied target/reference composition without hard-coding backend production values.
