# Widget and motion modernization

## Reference audit — 18 November 2026

Reviewed the public product pages and live demo content for [Tendly](https://codeandchill.store/templates/tendly), [Tendly demo](https://demo.codeandchill.store/tendly/), [Halvi](https://codeandchill.store/templates/halvi), and [Halvi demo](https://demo.codeandchill.store/halvi/).

The audit used publicly available textual/structural page content, not proprietary source or a screenshot-level comparison. The result is an original ERP adaptation of comparable widget and interaction patterns using the existing stack, not a copy of paid source/assets or a pixel-identical reproduction.

| Reference pattern | ALV application | Data / behavior |
| --- | --- | --- |
| Tendly challenge calendar and day progress | Business calendar and selectable-day agenda | Actual calendar events and due tasks |
| Tendly money-kept trend / Halvi Your week | Interactive sales and cash-flow widgets | Real daily transactions, 7/30-day controls, explicit empty states |
| Halvi score and Tendly goal rings | Repair/task completion and invoice collection | Defined completed/total calculations, not an invented business-health score |
| Tendly daily habits / Halvi doses | Today's work checklist | Persisted tasks with pending feedback and failure rollback |
| Upcoming bills / booked visits | Coming-up agenda | Actual business events and task due dates |
| Recent activity and compact summaries | Recent invoices and category distributions | Existing records, accessible summaries and drill-through actions |

## Repository audit and decisions

The starting UI had mixed primitives/utility styles, isolated animation timings, repeated charts/cards, and incomplete browser regression coverage. Those concerns are addressed through one shared foundation rather than separate redesigns of every domain workflow.

- All **58 screen modules** use `AnimatedPage`; the application has **61 App Router page entries**, including aliases/redirects and dynamic/share routes.
- MUI/Emotion components styled with `sx` are the UI system. The old shadcn directory, Radix dependencies, Tailwind configuration/utilities, and one-shot migration scaffolding have been removed.
- Motion hosts use `Box component={motion.*}`, never `Stack component={motion.*}`.
- GSAP is limited to leaf-text counters and reading public speaker scroll progress. No pinning/reparenting of React-owned DOM.
- Seven existing palettes and domain forms, tables, navigation, public-share and print routes are retained.
- MUI's JavaScript color functions receive normalized comma-separated HSL. Browser CSS custom properties retain their native syntax, avoiding invalid/NaN derived colors.
- No generated financial trends, disconnected business controls, or fabricated business-health score are added. An empty result is different from a failed request.

## Delivered implementation

### Shared kit and motion

`src/components/mui/` contains the reusable page/header/stat/table/dialog/search/tab/status/empty-state foundation, plus:

- `MotionSection` and `WidgetCard`: responsive surfaces, finite entrances, error/retry feedback, accessible section titles.
- `Sparkline` and `ProgressRing`: bounded/finite geometry, explicit accessible values and reduced-motion behavior.
- `TrendChart`: area/bar variants, real daily totals, 7/30-day range controls, selectable metrics, disjoint prior-period comparison, average/best-day summaries and loading/empty/error states.
- `WorkloadCalendar`: a compact actual-task due-date month grid, completion/open/overdue states, keyboard/day/month controls and coordinated agenda selection.
- `SegmentedControl` / `ChartViewport`: keyboard-operable moving selection surfaces and first-visible chart drawing with static reduced-motion content.
- `ChecklistWidget`: task completion, progress, pending/disabled feedback and keyboard-operable checkboxes.
- `AgendaWidget`: selectable week/day buttons and event/task summaries with drill-through actions.
- `DistributionWidget`: actual categories/statuses, totals and a correctly labelled remaining-category bucket.
- `Marquee`: public decorative text/testimonials/brands, user pause/resume, hover/focus pause, offscreen/hidden-document gating, inaccessible/inert duplicate content, and static horizontally scrollable content for reduced motion.

`src/lib/motion-presets.ts` centralizes durations/easing and caps entrance delays at 270ms. Page/header, card and table-row entrances are short and finite; forms and editable tables do not use blanket layout animation. MUI dialogs/drawers own their focus traps and restore focus on close. Print styles disable entrances and retain actual document/barcode content. The follow-up removed shell-level suppression of initial child animations, added first-visible section/counter/chart behavior, theme-wide composable control feedback and a Cmd/Ctrl+K navigation palette. See [the follow-up audit and implementation report](interaction-audit.md) for the gap analysis and verification.

Direct JSX adoption from the AST audit (not a count of all transitive uses):

| Primitive | Screen modules |
| --- | ---: |
| AnimatedPage | 58 |
| PageHeader | 45 |
| StatCard | 24 |
| DataTable | 33 |
| FormDialog | 26 |
| SearchToolbar | 23 |
| StatusChip | 33 |
| EmptyState | 4 |

Destructive confirmations use the shared `confirmAction`/`ConfirmDialogHost`; zero direct screen-level `ConfirmDialog` tags does not mean confirmations are missing. `tools/check-ui.mjs` rejects legacy UI imports/dependencies, utility classes, unsafe motion hosts, missing page wrappers and GSAP pins.

### Main integrations

| Screen | Implemented behavior |
| --- | --- |
| Dashboard | Responsive bento grid; actual sales/cash/repair/customer/stock totals; workload month calendar; 7/30-day POS area trend; repair completion; persisted focus checklist; coordinated event/task agenda; invoice collection, recent invoices and repair pipeline; actual-request refresh feedback |
| Finance | Shared actual cash-flow trend and category distribution; existing account/category/transaction/ledger/cash-control/audit workflows retained |
| Tasks | Completion and overdue summaries with the existing management table/dialogs; user-keyed shared cache; optimistic feedback, per-task pending state and rollback without automatic write replay |
| Calendar | Month/week/day/list controls, agenda and category/task filters; validated create/edit/delete; optional created task stores the saved calendar event's actual ID |
| Other ERP screens | Shared MUI shell, page/header/stat/table/dialog/tab components and theme/motion language, without replacing their domain workflows |

### Public pages and responsive repairs

- Reduced-motion-aware section scrolling lives in `src/lib/scroll.ts`.
- Public speaker evolution uses CSS sticky positioning and cleans up its ScrollTrigger; mobile/reduced-motion users see a static frame strip. Its page wrapper uses `overflow: clip`, not a new `overflow: hidden` scroll container that would silently break sticky positioning.
- Canvas/rAF/SVG decoration is activity-gated and cleans up when unmounted. Unnecessary perpetual badge pulses were removed.
- Navigation uses a MUI Drawer; the project lightbox uses `FormDialog`. Project cards support Enter/Space and FAQ controls expose expansion state.
- Public marquees are pausable and use a static presentation for reduced motion.
- Contact links target existing home-page sections rather than nonexistent routes.
- The customer portal treats an absent linked customer as an optional result and exposes retry on a real failure.
- Mobile layout clears the desktop sidebar margin immediately instead of animating a large margin across the breakpoint. Chart measurements are allowed to settle through ResizeObserver.

### Preserved backend/authentication work

- All three Auth.js preview cookies explicitly use `sameSite: "none"`, `secure: true`, and `partitioned: true`, with host-only `__Host-alv.*` names. This retains the required security attributes while supporting browsers that block ordinary third-party cookies; CSRF validation remains enabled.
- A follow-up login report exposed `MissingCSRF` in the web log while direct backend authentication succeeded. The same failure was reproduced with Chromium third-party-cookie blocking before the repair. Auth failures no longer all masquerade as bad credentials: missing CSRF, provider availability, and missing retained-session failures have distinct feedback and a new-tab fallback. Signup also checks automatic sign-in instead of silently ignoring failure. Renamed cookies require a one-time sign-in again, and partitions intentionally isolate standalone/embedded sessions.
- Prisma schema push → client/metadata generation → idempotent seed replaces migration replay. The schema contains 64 public models and two auth models; runtime SQL supplies triggers/functions, not tables.
- Native date filters/writes and Decimal serialization are handled at the query boundary. Audit actors are transaction-local and cannot leak through a reused pool connection.
- API errors propagate through Express 4 middleware; DB outages return `503 DB_UNAVAILABLE` and `Retry-After: 2` while liveness remains up. The pool reconnects after recovery; uncertain writes are not replayed.
- Unchanged generated metadata is not rewritten, preventing no-op setup/reseed from unnecessarily restarting an API development watcher.

## Verification results

The final browser run used a fresh **Next.js production build** and the **compiled production API**, not stale build output or a hot-reloading API watcher.

| Gate | Result |
| --- | --- |
| `npm run check:ui` | Pass: 58 screens; no prohibited UI/motion constructs |
| `npm run typecheck` | Pass |
| `npm run check` | Pass: 22 root unit/contract tests and 5 API/serialization tests; DB integration is intentionally skipped in this default command |
| `npm --prefix server run build` | Pass |
| `npm run build` | Pass; production page generation completed |
| `npm run test:db` | **1/1 pass** during the database phase, approximately 83 seconds, including no-op metadata stability; not repeated for the UI-only follow-up |
| `npm run test:e2e` | **27/27 pass**, approximately 3.2 minutes, including login and dashboard/control follow-up regressions |
| Route sweep within E2E | **61 routes × 2 widths = 122 visits** at 390px and 1440px; all HTTP 200, rendered, no horizontal page overflow or collected console/page/API errors |
| `git diff --check` | Pass |

Browser coverage includes:

1. Credentials login, cookie attributes and session persistence after reload; genuine invalid passwords remain rejected. Negative cases use fresh unauthenticated browser contexts and cover real CSRF rejection, simulated provider unavailability and a callback without a retained session.
2. Cross-site HTTPS iframe login, authenticated-subframe reload and logout with third-party cookies both allowed and blocked. A control cookie observed by the TLS server proves that the restricted case really blocks unpartitioned cookies; the auth cookies retain the expected top-level partition key.
3. Complete route inventory, disposable records for detail/share routes, mobile first; Settings, Finance, Apple Pricing and large repair routes checked last.
4. Task creation, status tabs, dashboard completion and persisted reload state.
5. Destructive confirmation and restored keyboard focus.
6. Chart range/metric controls, bounded repair ring, selected-day agenda, calendar views and desktop-to-mobile resize.
7. Calendar validation, create/edit/delete and exact event-to-task ID linkage.
8. All seven themes, restored preference, notifications and mobile navigation.
9. Barcode SVG content and invoice content under print-media emulation.
10. Large-screen tabs and repeated **client-side** public-page unmount/remount without pin-spacers or DOM cleanup errors; the speaker stage remains stuck in view while scrolling and advances to the expected frame.
11. Reduced motion on Dashboard, Finance, Tasks and Calendar.
12. Financial-widget failure/retry distinct from zero activity.
13. A rejected checklist write rolling back with exactly one attempted write.
14. Public reduced-motion behavior, MUI Drawer/lightbox keyboard close/focus restoration, and keyboard project activation.
15. Public marquee offscreen pause and working pause/resume controls.
16. Persisted workload-month counts, keyboard date navigation and coordinated agenda selection; explicit workload failure/retry instead of invented zero tasks.
17. Actual-request refresh loading/disabled feedback, selector keyboard focus and selection-pill geometry.
18. Cmd/Ctrl+K search/creation navigation, Escape/focus restoration and mobile trigger; role-filtered command construction is also unit-tested.
19. Button hover/press geometry and reduced-motion suppression; first-view section/chart/counter behavior, once-only visibility and final counter values under print media.

The disposable DB integration separately verifies schema setup, idempotent seed preserving the admin password/identity/roles and category count, staff signup, date round trips/invalid-date rejection, audit identity/no actor leakage, and real disconnect/restart recovery with the same pool. It never stops or resets the developer's regular database.

A verification run made while metadata generation restarted the old development API watcher correctly failed the zero-error gate. The no-op metadata write was removed, its stability is now asserted by the lifecycle test, and the complete browser suite was rerun successfully against the compiled API. No failing requests were filtered out to obtain the passing result.

## Reproduction and limits

See [the README](../README.md#verification) for setup and commands. Run schema/lifecycle checks before the browser sweep; use stable production API/web processes for release verification. E2E requires Chromium and OpenSSL. In this sandbox, the browser was invoked with an existing executable via `CHROMIUM_EXECUTABLE_PATH` and its platform libraries via `LD_LIBRARY_PATH`.

`tests/e2e/https-preview.mjs` creates temporary test certificates and proxies the app between two genuinely cross-site HTTPS hostnames (`arena.test` and `preview.e2b.app`), locally resolved by Chromium. Certificates/servers are cleaned up. The fixture includes a test-only endpoint that reports whether its unpartitioned control cookie arrived; it never echoes cookie/token values and is not part of the application server. CDP enables third-party-cookie restrictions for the blocked case. This proves cookie/session behavior, including CHIPS and logout, in that Chromium fixture, **not** the live external Arena parent/proxy or every browser's storage policy. Real deployment-origin verification remains necessary; a new-tab sign-in is available for stricter/unsupported browsers.

Additional boundaries:

- Browser workflows cover the seeded admin and public pages, not an exhaustive permissions audit or every field/CRUD path of every ERP module.
- External fonts/images/provider requests are stubbed in the browser suite because of the sandbox network restrictions. Payment, messaging, email, Hikvision and PDF-AI services were not live-tested.
- Print-media DOM/content is tested, not physical printers or every native print/PDF dialog.
- The DB lifecycle test covers embedded PostgreSQL; external PostgreSQL deployment must be tested in its target environment.
- This is not a completed authorization/security review. Public-share/per-record API scoping, development password-reset behavior, and previously tracked secrets require the production hardening described in the README before internet exposure.
