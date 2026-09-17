# Implementation Notes

## Overview

I built the dashboard around the main requirements of the assignment: authenticated access, a single machine/line timeline, individual production history, and the hourly production/downtime summary.

The implementation uses the real Fractal backend rather than mocked dashboard data.

---

## Session and token management

The login API returns an `access_token` in the response body. I chose to store this token in `localStorage`.

I chose `localStorage` mainly because the dashboard should remain logged in after a browser refresh. This also keeps the implementation simple for this assignment.

The trade-off is that a token stored in `localStorage` can be accessed by JavaScript. For a production application with stronger security requirements, an HttpOnly, Secure cookie-based session would provide better protection against token theft through XSS.

### Authentication flow

After a successful login:

1. The access token returned by `/auth/login` is stored locally.
2. The application uses the token for authenticated API requests.
3. Authenticated requests go through the central API request function in `src/services/api.ts`.
4. The API client reads the stored token and adds:

   `Authorization: Bearer <token>`

   rather than repeating authentication logic in individual API calls.

On application startup, if a stored token exists, the application calls `/auth/me` to validate and restore the session before showing the dashboard.

If an authenticated request returns `401`, the stored token is cleared and an authentication-expired event is triggered. The application then returns the user to the login screen.

A `401` from the login endpoint itself is treated differently: it means the supplied credentials were rejected, so the login page shows an inline error instead of treating it as an expired session.

Logout calls `/auth/logout` and clears the local token even if the logout request itself fails.

---

## API and backend response handling

The Fractal API responses use a common envelope containing:

- `trace_id`
- `status_code`
- `message`
- `data`

The application uses the `data` portion for successful responses and surfaces the API `message` when the backend reports an error.

The dashboard uses the real endpoints provided by the assignment for:

- authentication
- current user
- logout
- asset tree
- shift definitions
- machine intervals
- hourly cycle-time metrics

The backend base URL is configured through the Vite environment variable rather than being hard-coded into the components.

---

## Asset and shift selection

The asset selector is populated from the backend asset tree.

The assignment provides a nested hierarchy, but the dashboard only needs to let the user select one machine/line for the timeline. I therefore flatten the relevant asset nodes for selection instead of building a separate hierarchy drill-down interface.

The selected asset provides both the asset ID and asset-level ID required by the analytics request.

Shift definitions are also taken from the backend rather than hard-coded as A/B/C shifts.

The backend provides `shift_timings` as local clock start times. I use those timings to calculate the selected shift's start and end time. The last shift wraps around to the first shift when necessary.

---

## Timeline and production history

The timeline is based directly on the `runtimes`, `downtimes`, and `stoppages` returned by the machine-intervals API.

The backend already returns these segments tiled, non-overlapping, and clipped to the requested window, so the frontend does not try to perform overlap resolution or invent additional machine-state segments.

The different machine states are represented using their own colors and labels:

- Runtime
- Unplanned Production
- Planned Downtime
- Unplanned Downtime
- Minor Stoppage

Production results are shown separately from machine-state colors.

When individual production is disabled, the chart uses the hourly `produce_counts` data.

When "Show Individual produces" is enabled, the application requests the detailed `produces` data and displays the individual production events on the timeline.

The individual production response is flattened before rendering because the backend returns produces grouped into hourly buckets and the individual timestamps are not guaranteed to be sorted.

---

## Chart performance

The individual-produces mode is the most performance-sensitive part of the assignment because the live API can return approximately 10,000–20,000 production events.

I chose HTML Canvas for the timeline instead of rendering every production event as an individual React/SVG DOM element.

This keeps the number of DOM elements small and allows the chart to render many markers without creating thousands of React nodes.

### Performance decisions

- Production timestamps are parsed and converted before the actual drawing loop.
- Chart geometry is calculated from prepared data rather than repeatedly parsing dates during rendering.
- Canvas is redrawn as a single visualization rather than creating one DOM element per marker.
- Hover interaction is handled through the canvas instead of attaching individual event listeners to every production marker.
- Dense PASS markers can be screen-bucketed when many events occupy the same pixel area.
- FAIL markers are never removed during thinning/downsampling.
- Zoom changes the visible time range instead of creating a separate set of DOM elements for every zoom level.

This approach was chosen specifically to keep individual-produces mode interactive while still showing the important production information.

The assignment specifically states that FAIL markers must not be dropped when thinning points, so FAIL events are always preserved.

---

## Zoom and interaction

The timeline supports:

- Shift + drag to select a time range and zoom in.
- Double-click to reset the timeline to the complete shift.
- Hovering near production markers to inspect production information.

Pan was intentionally not implemented because it is not required by the assignment.

---

## Time handling: UTC and IST

The backend works in UTC while the dashboard UI is intended to display IST (Asia/Kolkata, UTC+05:30).

This was treated as an important part of the implementation because applying the wrong timezone would shift the entire timeline by 5½ hours.

The flow is:

1. The selected date and shift are interpreted as IST.
2. The shift start and end are converted to UTC.
3. UTC timestamps are sent to the analytics APIs.
4. API timestamps returned in UTC are converted back to IST before being displayed.
5. The same conversion is used for the timeline, axis labels, production timestamps, and hourly table.

This keeps the API request format and the user-facing dashboard time consistent.

---

## Hourly production and downtime table

The hourly table is calculated from the same machine interval and production data used by the timeline so that the two views remain consistent.

The table contains one column for each hour of the selected shift and includes:

- Total
- Pass
- Fail
- Runtime
- Unplanned Production
- Stoppage
- Unknown Downtime
- Ideal Cycle Time
- Actual Cycle Time

### Segment bucketing

The machine-state segments can cross hour boundaries, so I don't simply assign an entire segment to the hour in which it starts.

Instead, each segment is intersected with the relevant hourly buckets and only the overlapping duration is added to that hour.

For example, a segment from 08:33 to 10:12 contributes:

- 27 minutes to 08:00–09:00
- 60 minutes to 09:00–10:00
- 12 minutes to 10:00–11:00

The same approach is used for runtime, unplanned production, stoppage, and unknown downtime.

The backend already returns the segments tiled and clipped, so the frontend only needs to perform timezone conversion and hourly bucketing.

### Production counts

`produce_counts` contains hourly OK/NG counts grouped by part model.

The application sums the part-model counts for each hour:

- Total = OK + NG
- Pass = OK
- Fail = NG

### Cycle time

Ideal and Actual Cycle Time are retrieved from the separate `/analytics-query` endpoint using hourly distribution.

The returned `bucket_start` is matched with the corresponding hourly bucket after timezone conversion.

If a cycle-time value is `null`, the corresponding table cell is left blank rather than displaying an artificial zero.

### In-progress shifts

If the selected shift is currently in progress, future hourly buckets are left empty rather than being displayed as zero minutes or zero production.

As an additional sanity check, elapsed hours should approximately satisfy:

`Runtime + Unplanned Production + Stoppage + Unknown Downtime ≈ 60 minutes`

with small differences possible because of rounding.

---

## Loading, empty, and error states

The dashboard explicitly handles the main data states:

- Loading while API requests are running.
- Error state with retry capability when the backend request fails.
- Empty state when the selected shift contains no data.
- In-progress shifts where future hours have not elapsed yet.

For authentication, an expired session results in the stored token being cleared and the user being returned to the login screen.

---

## Refresh behavior

The dashboard provides a manual Refresh action.

Changing the main dashboard filters also causes the relevant data to be requested again.

I did not implement automatic polling because the assignment explicitly lists auto-refresh/polling as out of scope.

---

## Scope and assumptions

I intentionally kept the implementation focused on the requested single-machine/line dashboard.

The following were not implemented because they are explicitly outside the assignment scope:

- Automatic refresh / polling
- Segment classification dialogs
- Create downtime / unplanned-production dialogs
- CSV export
- PDF export
- Internationalization
- Multi-theme/settings area
- Full asset hierarchy drill-down
- Multi-machine dashboards

The asset tree is still used to select the relevant asset, but I did not build a separate hierarchy-navigation experience because that is not required.

I also kept the dashboard focused on the supplied target/reference composition rather than adding unrelated dashboard features.

---

## UI decisions

The UI follows the supplied reference screenshots while keeping the data driven by the real API.

The dashboard includes:

- Product header and logged-in username
- Asset level and asset selection
- Optional machine selection
- Date selection
- Backend-driven shift selection
- Manual refresh
- Production History
- Machine-state legend
- PASS / FAIL / WIP indicators
- Point-label toggle
- Individual-produces toggle
- Timeline zoom/reset interaction
- Last-observed production information
- Hourly production and downtime summary

The colors used for the timeline state bands are kept separate from the production-result markers so that machine state and production result are not confused.

