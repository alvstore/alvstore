# Workspace sidebar redesign

## Scope and reference audit

Redesign the shared authenticated sidebar, using the public Tendly and Halvi template/demo pages as inspiration. The public pages establish the dashboard scope, themes and shared search patterns. Page extraction does not expose a complete visual/motion recording of either sidebar: this is an original ALVStore implementation, not a pixel-identical reproduction or use of paid source/assets.

References reviewed:
- https://codeandchill.store/templates/tendly
- https://demo.codeandchill.store/tendly/
- https://codeandchill.store/templates/halvi
- https://demo.codeandchill.store/halvi/

### Existing gaps

- An edge-to-edge drawer with repeated dividers made the 10-group operations navigation visually dense.
- Active rows used a hard inset rail; the dedicated sidebar palette tokens were unused.
- Compact navigation lacked a profile dock; search was only in the page header.
- Drawer width/desktop content offsets were separately hardcoded.
- Saved expanded-group JSON was unvalidated, and a previously closed group could hide the current nested route.
- The temporary drawer could remain modal when resizing to desktop.

## Plan — completed

1. Preserve the canonical route catalog and role selection. Add tested, UI-independent helpers for route matching, validated saved groups, role labels, and shared sidebar dimensions.
2. Build an inset rounded desktop surface, compact icon rail, calmer collapsible groups, soft shared-layout active pill, consistent icon sizing and a fixed real-user profile/settings dock.
3. Open the same command palette from sidebar, header and keyboard; do not mount duplicate dialogs or listeners. Hand off focus after the mobile drawer closes.
4. Coordinate the content offset and drawer dimensions. Keep mobile full-width content, automatic close after route selection or crossing the desktop breakpoint, keyboard group controls, focus restoration, reduced-motion/static states and print hiding.
5. Run unit/UI/type checks, production builds and the complete browser suite. Inspect desktop, compact, dark/light and narrow-mobile screenshots.

## Delivered implementation

- **Inset desktop panel:** 12px outer gutter, 21px rounded surface, subtle border/elevation and theme-specific sidebar colors. The expanded desktop shell reserves 288px; the compact rail reserves 88px. Shared constants prevent drift between drawer and content offset.
- **Navigation hierarchy:** all existing 28 admin/staff destinations and 10 category groups are unchanged. Quieter headings replace repeated expanded-mode dividers. Native links and buttons retain labels, `aria-current`, `aria-expanded`, visible focus and keyboard activation.
- **Selection and motion:** a softly tinted shared-layout pill moves between active links; each responsive surface has its own layout group. The scrolling nav declares `layoutScroll` for selection geometry. Width/content shifts share one 240ms easing. Group transitions are bounded; reduced motion disables shared-layout movement, width animation and drawer/group transitions.
- **Compact rail:** every destination remains available with named icons and hover/focus tooltips. The toggle sits beside the brand rather than overlapping search. The real-user profile link stays docked below the scrollable menu.
- **Profile dock:** actual session metadata/email initials and role label, with a working link to existing Settings. No fake workspace switcher, unread badges, subscription level or online status was introduced.
- **One shared search:** shell-controlled state opens the existing palette from either sidebar, either header trigger, or Cmd/Ctrl+K. Queries reset on reopening; existing role-filtered creation commands are preserved. Mobile search waits for the drawer's exit and restores eventual dialog focus to a still-mounted header control.
- **State resilience:** existing `sidebarCollapsed` and `sidebar-expanded` preference keys are retained. Malformed/non-object JSON, unknown/non-boolean group entries and unavailable storage are tolerated. Deep links reopen their current group without resetting unrelated groups. The existing Customers → `/crm` redirect retains the Customers highlight without changing route URLs or permissions. Current links are revealed within the nav on navigation/resize without scrolling the document. The animation frame and ResizeObserver are cleaned up on unmount.
- **Mobile and print:** a rounded, full-height temporary drawer at 320px/390px, fixed footer with safe-area padding, focus trap/Escape/restoration, navigation-close and breakpoint-close behavior. Print hides navigation and removes the desktop offset.

No new dependency, backend/auth change, external asset, GSAP pin or second UI system was introduced. Components use MUI/`sx` and Box motion hosts.

## Verification

Tested against the compiled web/API servers:

| Check | Result |
| --- | --- |
| `npm run check` | **Pass:** 58-screen UI guardrails, TypeScript, **30 root tests + 5 API/serialization tests**. The separate opt-in DB lifecycle test is intentionally skipped. |
| `npm run build` | **Pass:** 51 static pages generated. |
| `npm --prefix server run build` | **Pass.** No server source was changed. |
| `npm run test:e2e` | **36/36 passed**, approximately 5.1 minutes; no skips, unexpected failures or flaky retries. |
| Existing route sweep | **61 routes × 390px/1440px = 122 visits**, all HTTP 200 and rendered, zero horizontal overflow or collected console/page/backend errors. |
| Sidebar layouts | Expanded/compact persistence, mobile 320px/390px, desktop breakpoints 900px/1024px/1440px and short 640px windows. |
| Sidebar text contrast | Sampled inactive, selected and section text all meet **4.5:1** in all seven palettes; the lowest accepted sample was **4.61:1** in Donezo. This is a targeted contrast check, not a complete WCAG audit. |
| Navigation and overlays | All 28 admin/staff links, nested-route and Customers → CRM activation, frame-sampled selection movement after page scroll, corrupt/blocked storage, one shared search, keyboard focus, mobile focus wrapping/dismissal/search handoff, breakpoint scroll unlock, profile settings navigation, reduced motion and print. |
| Role presentation | Customer, technician, staff and mixed admin/customer UI navigation and palette commands verified with overridden session-role responses. This does not test or replace API authorization. |
| Preserved workflows | Existing HTTPS/third-party-cookie/CSRF regressions, task/calendar persistence and rollback, financial widgets, seven-theme restoration, public motion/sticky behavior and barcode/print tests all passed. |

The fresh local preview database was initialized with the existing non-destructive Prisma setup; no reset was used. The isolated database disconnect/recovery lifecycle test was not rerun for this sidebar-only change. External providers and the actual Arena parent-frame/browser cookie policy are outside this verification.

### Captures

Reviewed `.arena/sidebar/desktop-dark.png`, `desktop-light.png`, `desktop-compact.png`, `mobile-dark.png`, `sidebar-forest.png` and `sidebar-arctic.png`. Captures, contrast samples and browser reports remain ignored local diagnostics, not committed assets.

Implementation: `src/components/layout/{AppSidebar,AppLayout,AppHeader,CommandPalette}.tsx`, `src/lib/sidebar-state.ts`. Regressions: `tests/sidebar-state.test.mjs`, `tests/e2e/sidebar.spec.mjs`.
