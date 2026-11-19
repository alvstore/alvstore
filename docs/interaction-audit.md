# Dashboard and interaction follow-up

## Scope and reference audit — 18 November 2026

Request: scan Tendly/Halvi again, adopt comparable dashboard widgets and smooth interactions, including buttons, using the existing stack.

Public pages reviewed:

- https://codeandchill.store/templates/tendly
- https://demo.codeandchill.store/tendly/
- https://codeandchill.store/templates/halvi
- https://demo.codeandchill.store/halvi/

Available reference evidence is public textual/structural content, not paid source/assets or frame-by-frame animation capture. Tendly exposes a compact month grid, explicit progress, checklists, category totals, upcoming items and global search. Halvi exposes a prominent progress score, selectable 7/30-day metrics, highlighted day bars, a schedule/timeline and recent activity. The ERP adaptation must not invent no-spend streaks, medical scores or transactions. Motion timing and implementation are original.

## Current-project scan and plan

The existing foundation already supplied 58 MUI screens, AnimatedPage on every screen, shared stat/table/dialog/widget components, real-data Dashboard/Finance/Tasks/Calendar widgets, theme-aware colors and reduced-motion handling. The baseline passed 20 browser tests, including the repaired partitioned-cookie login. This is an incremental improvement, not a second migration or a rewrite of domain workflows.

| Gap | Implementation decision | Acceptance |
| --- | --- | --- |
| Missing compact month grid | Reusable workload calendar, calculated from persisted task due dates/statuses; selection coordinates with the dashboard agenda | Correct month boundaries/counts; day/month/today navigation; honest loading/error/empty states |
| Static segmented selections | Shared MUI ToggleButtonGroup with a Framer Motion selection pill | Keyboard arrows/Home/End; pressed semantics; no indicator animation under reduced motion |
| One chart presentation | Area variant for Dashboard sales, highlighted bars for Finance; shared actual-data calculations | Correct range/metric totals, prior-period comparison, average/best-day summaries; no invented trend |
| Inconsistent button/control feedback | Theme-level hover/press/focus treatment, fine-pointer hover only | Existing MUI buttons gain feedback without rewriting 58 screens; disabled controls stay inert; placement transforms are preserved |
| Widget animation finishes offscreen | Reveal sections, charts and counters when first visible, once per mount | Bounded opacity/translation; no repeat-on-scroll; print/reduced motion shows final content |
| Only inline page search | Role-aware Cmd/Ctrl+K navigation palette in the shared shell | MUI dialog/autocomplete keyboard behavior, Escape/focus restoration, mobile trigger, no extra creation routes outside existing navigation |
| Abrupt checklist/refresh feedback | Calm completion background/strike-through and request-driven pending states | Persisted write/rollback behavior unchanged; refresh stays disabled until requests finish |

Implementation order: shared primitives/theme → pure workload calculations/calendar → Dashboard/chart/agenda/Calendar adoption → shell palette → source/build/browser/visual verification.

Constraints retained: MUI + sx only; Box for Framer Motion hosts; GSAP only for leaf counters/scroll reading; no pinning, random business data, blanket form layout animation, auth/database changes in this follow-up, or new UI/animation dependencies. Existing large domain screens and their workflows were preserved.

## Delivered changes

- **`WorkloadCalendar`**: Monday-first month grid, due-date counts, completed/open/overdue states, month/today controls, roving day focus and arrow/Home/End/PageUp/PageDown navigation. Month calculations handle leap years and date-only fields across timezones. Its progress is explicitly by task due date, not a completion-date history or streak.
- **Dashboard composition**: calendar, sales trend and repair progress share the main bento row. Calendar selection updates the agenda; actual due tasks join calendar events in that agenda. Fixed appointments sort before due-date-only tasks so a busy task board cannot hide booked visits in the compact list.
- **`SegmentedControl`**: one isolated shared-layout selection pill per control, native MUI pressed states, arrows/Home/End and disabled-option handling. Used by chart ranges/metrics, agenda weekdays and Calendar views.
- **`TrendChart` / `ChartViewport`**: soft area rendering for Dashboard; current-day highlighted bars for Finance; common range, comparison, average and best-day calculations. A static plot remains available before entry, then the chart draws on first view; reduced motion renders the final state. Distribution plots share this behavior.
- **Theme-wide controls**: fine-pointer hover lift, subtle press scale, color/focus feedback on MUI buttons, icon buttons, checkboxes/radios and navigation icons. Individual CSS `translate`/`scale` avoid overwriting existing placement transforms. Disabled and reduced-motion states are guarded.
- **First-view motion repair**: the initial browser regression caught the shell's `AnimatePresence initial={false}` suppressing child entrances on first load. Removed that suppression. `MotionSection` now reveals once in view with capped delays; `CountUp` waits for first view, kills its GSAP tween on cleanup and exposes a separate final-value print representation.
- **`CommandPalette`**: search pages and creation shortcuts from the existing role-filtered navigation, Cmd/Ctrl+K, desktop/mobile triggers, MUI dialog/autocomplete focus handling and Escape dismissal. One shortcut listener is cleaned up when the shell unmounts. This is navigation filtering, not a replacement for API authorization.
- **Honest feedback**: completed checklist rows get a quiet success surface, pending saves remain visible, and refresh uses the real aggregate query state instead of a timer. Existing failed-write rollback still makes exactly one attempted write.

## Verification

The complete browser run used the rebuilt Next.js production server on port 3000 and the stable compiled API on port 4000.

| Gate | Result |
| --- | --- |
| `npm run check` | **Pass**: 58-screen UI audit, TypeScript, **22 root tests + 5 API/serialization tests**; the opt-in DB lifecycle test is intentionally skipped by this command |
| `npm run build` | **Pass**, 51 static pages generated plus dynamic routes |
| `npm --prefix server run build` | **Pass** |
| `npm run test:e2e` | **27/27 passed**, approximately 3.2 minutes; no skips or flaky retries |
| Full route sweep | **61 routes × 2 widths = 122 visits**, 390px/1440px; HTTP 200, no render boundaries, horizontal page overflow or collected console/page/API errors |
| Login regression | HTTPS iframe login/reload/logout with ordinary third-party cookies allowed and blocked; password and CSRF rejection remain protected |
| `git diff --check` | **Pass** |

Seven browser regressions were added: real workload counts/day coordination, workload failure/retry, request-driven refresh, selector keyboard/geometry behavior, command search/focus/mobile navigation, button press/reduced-motion behavior, and first-view/print/chart/counter behavior. The remaining 20 regressions still cover domain workflows, all themes, real-data chart controls, calendar CRUD/task linkage, public interactions, reduced motion, cleanup and print content.

Desktop/mobile Dashboard and command-palette captures were inspected. Captures wait for chart SVG geometry to settle after resize: disabling CSS animations does not fast-forward Recharts' requestAnimationFrame interpolation. Runtime screenshots/results are ignored under `.arena/interaction-audit/` and `test-results/`, not committed as application assets. E2E fixture records are temporary and cleaned up; the live dashboard is not padded with sample data.

The earlier isolated DB lifecycle/recovery test passed during the database modernization; it was not repeated for this UI-only pass. No development password or regular database was reset.

## Remaining limits

Reference animation timing/pixel identity, every browser/storage policy, live external integrations, physical printing, a complete authorization review and measured 60-fps profiling are not claimed. See [the main modernization report](ui-modernization.md#reproduction-and-limits) and [README production limitations](../README.md#production-safety--existing-limitations). The live Arena parent/proxy still needs a check in the user's own browser.
