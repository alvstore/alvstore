# ALVStore Private Cinema Configurator & 3D Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `#collection` into a well-lit warm walnut & limestone architectural 3D + parametric 2D CAD cinema room planner where buyers dial in room size/seating, toggle Lights On vs. Cinema Dark Mode and camera perspectives, inspect acoustic coverage, and hand off specs to `#visit`.

**Architecture:** Extract all room math, screen/package recommendations, 3D metric coordinates, 2D normalized coordinates, and safe consultation note merging into a pure module (`room-calculator.ts`). Drive both the rebuilt bright-by-default Three.js room (`cinema-room-3d.ts`) and a dedicated parametric 2D `<svg>` component (`ParametricCinemaCadSvg.tsx`) from `computeRoomLayout()`, wired together cleanly inside `SpatialRoomVisualizer.tsx` -> `VisitSection.tsx`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, MUI `@mui/material` / `@mui/icons-material`, Three.js (`THREE`), Framer Motion (`Box component={motion.*}`), `node:test` + TypeScript transpiled unit tests, Playwright headless Chrome (`--use-angle=swiftshader`).

**Spec:** [2026-11-25-cinema-room-configurator-design.md](file:///Users/rajat/Downloads/alvstore/docs/superpowers/specs/2026-11-25-cinema-room-configurator-design.md)

## Global Constraints
- Follow ALVStore studio tokens (`STUDIO.chalk` `#F6F4EE`, `STUDIO.plaster` `#EAE7DD`, `STUDIO.graphite` `#16181A`, `STUDIO.brass` `#9C7B49`, `EASE`, `TYPE`, `FONT`).
- Comply strictly with `tools/check-ui.mjs`: no raw HTML elements (`div`, `span`, `p`, `h1`, `h2`, `button`, `input`, `select`, `table`) inside `src/screens/` or `src/components/` (`svg` primitives allowed), no `className`, wrap Framer Motion only inside `<Box component={motion.*}>`, no GSAP `pin`.
- Honor `useReducedMotion()` in Framer Motion, SVG `<animate>`, and `cinema-room-3d.ts` (instant camera/lighting state switches, zero continuous bounce/wave oscillation).
- Default `24 × 16 ft · 2 Rows` must compute cleanly to `150″` (`16:9`) and recommend `"7.2.4"` (`384 sq ft`).
- `npm run check` (`check:ui && typecheck && test`) and `rm -rf .next && npm run build` must pass with 0 errors.
- Mobile (`375×812`) through desktop (`1440×900`) must have `docOverflow === 0` and touch targets `>= 36px` with zero dock/slider clipping.

## Review Focus
1. **Extreme / non-finite room inputs:** `lengthFt` or `widthFt` passed out-of-bounds (`< 12`, `> 32`, `NaN`, `Infinity`) must clamp cleanly without producing `NaN`, `0` seats, or inverted geometry.
2. **Short rooms (`lengthFt < 16`) with 2 rows requested:** Must auto-cap `effectiveRows` to `1` and surface `rowCapNotice` so rear seats cannot collide with front console or rear speakers.
3. **Narrow vs. shallow wide aspect ratios (`32 × 10 ft` vs. `12 × 24 ft`):** `recommendedScreenIn` must remain within `100..200` and physical screen width must stay `<= widthFt * 0.72` so front L/R towers stay inside side walls.
4. **Manual tier override & consultation note guard:** Moving sliders preserves manually selected `activeTab` while surfacing `recommendedConfigId`; `mergeConsultationNote` overwrites only empty or previously auto-generated configurator notes, never manually edited customer text.
5. **Dual-mode & WebGL cleanup:** Switching `3D <-> 2D CAD`, toggling `Lights`, dragging sliders rapidly, and unmounting must dispose replaced Three.js geometries cleanly and keep relevant dock buttons contextual without overflowing `375px`.

---

### Task 1: Pure Room Calculator, Geometry Layout & Consultation Note Helper

**Files:**
- Create: `src/components/studio/room-calculator.ts`
- Test: `tests/room-calculator.test.mjs`

**Interfaces:**
- Produces:
  - `export type RoomConfigId = "5.1" | "5.1.2" | "7.2.2" | "7.2.4"`
  - `export type SpeakerRole = "screen" | "surround" | "subwoofer" | "height"`
  - `export type RoomInputs = { lengthFt: number; widthFt: number; seatingRows: 1 | 2 }`
  - `export type RoomRecommendation = { lengthFt: number; widthFt: number; effectiveRows: 1 | 2; rowCapNotice: string | null; areaSqFt: number; ceilingHeightFt: number; volumeCuFt: number; seatsPerRow: number; totalSeats: number; primarySeatDistFt: number; recommendedScreenIn: number; screenWidthFt: number; viewingAngleDeg: number; throwDistFt: number; recommendedConfigId: RoomConfigId; fitNote: string }`
  - `export type LayoutSpeakerNode = { id: string; role: SpeakerRole; pos3d: [number, number, number]; rot3d: [number, number, number]; cadX: number; cadY: number; distanceM: number; delayMs: number }`
  - `export type SeatPosition = { rowIndex: 0 | 1; xMeters: number; zMeters: number; cadX: number; cadY: number; riserHeightM: number }`
  - `export type RoomLayout = { widthM: number; lengthM: number; ceilingM: number; screenWidthM: number; screenHeightM: number; screenCenterY: number; riserZStartM: number; riserHeightM: number; listenerHead3d: [number, number, number]; cadRoomRect: { x: number; y: number; w: number; h: number }; seats: SeatPosition[]; speakers: Record<string, LayoutSpeakerNode> }`
  - `export type StudioRoomSelectionPayload = { lengthFt: number; widthFt: number; rows: 1 | 2; totalSeats: number; screenIn: number; throwDistFt: number; configId: RoomConfigId; configLabel: string; amplification: string }`
  - `export const STUDIO_ROOM_SELECT_EVENT = "alv-studio-room-select"`
  - `export function calculateRoomRecommendation(inputs: RoomInputs): RoomRecommendation`
  - `export function computeRoomLayout(inputs: RoomInputs): RoomLayout`
  - `export function formatConsultationNote(payload: StudioRoomSelectionPayload): string`
  - `export function mergeConsultationNote(existingNote: string, generatedNote: string): string`

- [ ] **Step 1: Write the failing unit tests in `tests/room-calculator.test.mjs`**

Create `tests/room-calculator.test.mjs` using the repo's `ts.transpileModule` pattern (`node:test` + `node:assert/strict`) covering all 5 Review Focus conditions plus default calibration:
- Default `24 × 16 ft, 2 rows` → `recommendedScreenIn === 150`, `recommendedConfigId === "7.2.4"`, `effectiveRows === 2`, `rowCapNotice === null`, `seatsPerRow === 4`, `totalSeats === 8`, `areaSqFt === 384`, `throwDistFt === 22.2`.
- Short room `14 × 12 ft, 2 rows` → `effectiveRows === 1`, non-null `rowCapNotice`, `recommendedConfigId === "5.1"`.
- Clamping `NaN / 5 / 99` lengths & `2 / 50` widths → clamped within `12..32 ft` and `10..24 ft`, finite `totalSeats >= 2`, `recommendedScreenIn` in `100..200`.
- Extreme narrow (`32 × 10 ft`) & wide (`12 × 24 ft`) → `screenWidthFt <= widthFt * 0.72 + 0.01`, L/C/R `pos3d[0]` strictly inside `[-widthM / 2, +widthM / 2]`, Center `C` sits lower than screen bottom bezel (`screenCenterY - screenHeightM / 2 > pos3d[1] + 0.12`).
- Parametric 2D CAD coords (`cadRoomRect`, `seats`, `speakers`) stay within `0..120` SVG bounds and proportional `cadRoomRect.w / cadRoomRect.h` approximates `widthFt / lengthFt`.
- `mergeConsultationNote` replaces empty text or previous `[Room Planner]` block cleanly, while appending below manually edited customer prose without deleting the user's text.

- [ ] **Step 2: Run unit test to confirm failure before implementation**

Run: `node --test tests/room-calculator.test.mjs`
Expected: FAIL (`ENOENT` on `src/components/studio/room-calculator.ts`).

- [ ] **Step 3: Implement `src/components/studio/room-calculator.ts`**

Implement pure clamped math & layout computation:
- Feet→meters constant `FT_TO_M = 0.3048`.
- `recommendedScreenIn`: target `42°` horizontal FoV at `primarySeatDistFt = clamp(lengthFt * 0.6, 8.5, 19.5)`, clamped so `screenWidthFt <= widthFt * 0.72`, `16:9` diagonal `(widthFt / 0.8716) * 12` rounded to nearest `5″` inside `100..200`.
- Tier thresholds: `5.1` (`areaSqFt <= 220`), `5.1.2` (`areaSqFt <= 320`), `7.2.2` (`areaSqFt < 380 && lengthFt < 24`), `7.2.4` (`areaSqFt >= 380 || lengthFt >= 24`).
- `computeRoomLayout`: computes symmetric 3D coords in meters (`frontZ = -lengthM / 2 + 0.32`), lifts `screenCenterY = Math.max(1.58, ceilingM * 0.56)` so horizontal center speaker `C` at `[0, 0.26, frontZ + 0.32]` never touches the screen bottom, places `L`/`R` cleanly flanking screen (`±Math.min(widthM * 0.41, screenWidthM * 0.56 + 0.32)`), places `seats` across `effectiveRows` (row 2 on `0.24m` riser), and maps all positions into scaled SVG `viewBox="0 0 120 120"` coordinates (`cadRoomRect`).
- `formatConsultationNote` & `mergeConsultationNote`: prefixes auto-generated summary with `[Room Planner]` header marker so repeated `Consult` clicks update the block idempotently while preserving user text written outside it.

- [ ] **Step 4: Run unit tests to verify pass**

Run: `node --test tests/room-calculator.test.mjs`
Expected: All tests in `tests/room-calculator.test.mjs` PASS (`0` failures).

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/studio/room-calculator.ts tests/room-calculator.test.mjs
git commit -m "feat: add parametric cinema room calculator and layout engine with unit tests"
```

---

### Task 2: Bright Architectural 3D Studio, Animated Dimmer, Camera Presets & Raycaster

**Files:**
- Modify: `src/components/studio/cinema-room-3d.ts` (full architectural lighting & dynamic geometry refactor)
- Modify: `src/components/studio/CinemaRoomCanvas.tsx` (sync new props & speaker click callback)

**Interfaces:**
- Consumes: `RoomConfigId`, `RoomLayout`, `LayoutSpeakerNode` from `./room-calculator`.
- Produces on `CinemaRoomHandle` (`src/components/studio/cinema-room-3d.ts`):
  - `setConfig(configId: RoomConfigId): void`
  - `setLayout(layout: RoomLayout): void`
  - `setLightsOn(lightsOn: boolean): void`
  - `setCameraPreset(preset: CameraPreset): void` (`export type CameraPreset = "studio" | "seat" | "top"`)
  - `setSoundCones(show: boolean): void`
  - `setShowDimensions(show: boolean): void`
  - `setHoveredSpeaker(speakerId: string | null): void`
  - `setHighlightRole(role: string | null): void`
  - `setSweetSpotFocus(focus: boolean): void`
  - `setReducedMotion(reduced: boolean): void`
  - `resetCamera(): void`
  - `resize(): void`
  - `destroy(): void`
- Consumes on `CinemaRoomCanvasProps` (`src/components/studio/CinemaRoomCanvas.tsx`):
  - `configId`, `layout: RoomLayout`, `lightsOn: boolean`, `cameraPreset: CameraPreset`, `soundCones: boolean`, `showDimensions: boolean`, `hoveredSpeakerId: string | null`, `highlightRole: string | null`, `isSweetSpotFocused: boolean`, `onSpeakerSelect?: (speakerId: string | null) => void`

- [ ] **Step 1: Extract room-shell builder, movie screen `CanvasTexture`, and speaker meshes in `src/components/studio/cinema-room-3d.ts`**

Refactor `cinema-room-3d.ts` cleanly using helper builders (zero duplicated logic):
- Generate crisp procedural widescreen frame texture (`createCinemaScreenTexture()`) onto an offscreen `HTMLCanvasElement` (`512×288`) depicting warm sunlit desert/mountain vista + subtle film grain + cinema vignette so the projection screen never looks like a flat white rectangle when Lights Dim.
- Warm studio architectural palette:
  - Cutaway travertine outer platform & walls (`0xd8d0c2`), walnut acoustic slats (`0x745037`), warm taupe carpet (`0x6b645c`), front baffle slate velvet surround (`0x262422`), tiered wood riser with brass nose trim (`0xc49a57`), tailored leather seats (`0x3e3833` + champagne headrest accents `0xc8a36a`), ceiling tray soffits with emissive `2700K` LED strips.
  - `Center ("C")` speaker built as a sleek horizontal MTM box (`0.72 × 0.22 × 0.32m`) with triple brass/graphite drivers resting on a low travertine/brass pedestal at `[0, 0.26, frontZ + 0.32]` completely below the screen.
- Replace opaque flat `pulseRing` sprites with subtle directional **dispersion cones** (`ConeGeometry` pointing from each active speaker toward `LISTENER_HEAD` at `opacity 0.05..0.13`, gently breathing on sine wave when `soundCones && !reducedMotion`) + clean thin ring on selected/hovered speaker.

- [ ] **Step 2: Implement animated `litProgress` dimmer, dynamic `setLayout(layout)`, `setShowDimensions`, and `CameraPreset` camera glide**

- Smoothly lerp `litProgress` toward `targetLightsOn ? 1 : 0` (`alpha = 0.08`, instant under `reducedMotion`), animating:
  - `scene.background` between warm gallery slate (`0x26231e`) and theater dark (`0x0c0d0f`).
  - `hemiLight` + `keyLight` + ceiling cove intensities (`1.25 / 1.55` down to `0.28 / 0.36`), while bumping screen emissive (`0.22 -> 0.92`), riser step trim LEDs, and volumetric projector beam (`0.015 -> 0.14`).
- `rebuildRoomFromLayout(newLayout)` properly disposes temporary geometries in `roomShellGroup` & `dimensionLinesGroup` (shared materials preserved) and recreates walls, slat panels, riser, dynamic seat grid (`1` or `2` rows × `seatsPerRow`), screen frame, projector position, active speakers (`L/C/R/SUB1/SUB2/SL/SR/SBL/SBR/TFL/TFR/TRL/TRR/TML/TMR`), dispersion cones, laser ray lines, and optional `Dimensions` brass guide bars on the floor.
- `setCameraPreset("studio" | "seat" | "top")` smoothly interpolates spherical orbit & target toward:
  - `"studio"`: 3/4 cutaway overview scaling proportionally with `layout.widthM` & `layout.lengthM`.
  - `"seat"`: primary row center eye height (`[0, 1.18, primarySeatZ]`) looking straight down at screen (`fov = 50`).
  - `"top"`: high overhead architectural view (`[0, Math.max(8.0, layout.lengthM * 1.15), 0.35]`, `fov = 38`).
- Wire `THREE.Raycaster` inside pointer click (`< 6px` drag threshold so orbiting does not trigger click) & `mousemove` to detect `[data-speaker]` groups (`userData.speakerId`), changing canvas cursor to `"pointer"` on hover and invoking `options.onSpeakerSelect?.(speakerId)` on tap/click!

- [ ] **Step 3: Update `src/components/studio/CinemaRoomCanvas.tsx` to bridge all new handles and callbacks**

Accept updated props (`layout`, `lightsOn`, `cameraPreset`, `soundCones`, `showDimensions`, `highlightRole`, `onSpeakerSelect`), invoke corresponding `handleRef.current` setters in focused `useEffect`s cleanly, keep latest `onSpeakerSelect` in a ref so the Three.js instance isn't recreated on callback identity changes, and render subtle aria-label on `<Box component="canvas" ... />`.

- [ ] **Step 4: Run static check & typecheck after Tasks 2 edits**

Run: `npm run check:ui && npm run typecheck`
(Typecheck may show temporarily mismatched props in `SpatialRoomVisualizer.tsx` until Task 4 wires it; verify syntax cleanly in `cinema-room-3d.ts` and `CinemaRoomCanvas.tsx` before moving straight to Task 3+4 or check targeted `tsc` once Task 4 lands.)

---

### Task 3: Parametric 2D CAD Blueprint SVG Component

**Files:**
- Create: `src/components/studio/ParametricCinemaCadSvg.tsx`

**Interfaces:**
- Consumes: `RoomConfigId`, `RoomLayout`, `RoomRecommendation`, `Speaker` metadata from `./room-calculator` & `./SpatialRoomVisualizer` (keep shared metadata exports cleanly importable with zero circular dependency — put speaker descriptions/config catalog in `room-calculator.ts` or `./studio-configs.ts`).
- Produces: `export function ParametricCinemaCadSvg(props: { layout: RoomLayout; recommendation: RoomRecommendation; speakers: SpeakerCatalogItem[]; hoveredSpeakerId: string | null; highlightRole: string | null; sweetSpotHovered: boolean; soundCones: boolean; showDimensions: boolean; reducedMotion: boolean; onSelectSpeaker: (id: string | null) => void; onHoverSweetSpot: (hovered: boolean) => void }): JSX.Element`

- [ ] **Step 1: Move static `ALL_SPEAKERS`, `ROOM_CONFIGS`, and `ROLE_COLORS` catalog data cleanly into `src/components/studio/room-calculator.ts` (or `cinema-catalog.ts`)**

Keep `SpatialRoomVisualizer.tsx` and `ParametricCinemaCadSvg.tsx` free of circular imports and duplication by exporting speaker catalog descriptors & `ROOM_CONFIGS` directly from `room-calculator.ts` (so every unit test can also verify `ROOM_CONFIGS` speaker counts!).

- [ ] **Step 2: Build `src/components/studio/ParametricCinemaCadSvg.tsx`**

Render a responsive architectural `viewBox="0 0 120 120"` CAD blueprint strictly driven by `layout.cadRoomRect`, `layout.seats`, `layout.speakers`, and `recommendation`:
- Warm dark blueprint board (`#15181A`) with architectural perimeter rectangle matching exact `lengthFt : widthFt` room aspect ratio (`cadRoomRect`), timber slat wall hatches along left/right inner edges, rear riser tier outline when `effectiveRows === 2`.
- Dynamically scaled front 4K screen centered on top inner wall (`screenSpanCad`), non-obstructing horizontal `C` speaker tucked cleanly on its plinth in front/below the top line, `L / R` towers flanking outside screen edges, dynamic array of `seats` across `1` or `2` rows with brass headrest bars + Sweet Spot calibration target centered on row 1.
- Projector throw beam triangle stretching dynamically from rear lens position (`rearWallY`) to screen edges.
- Conditional `soundCones` ripples + clickable speaker icons (`onClick` & `onMouseEnter` -> `onSelectSpeaker`) + ray-traced dashed sightlines with animated photon pulse (`!reducedMotion`) when selected/hovered or role-highlighted.
- Conditional `showDimensions` CAD callout bars: outer top width bar (`16 ft`), right-side length bar (`24 ft`), screen width callout (`150″ 4K`), and dashed laser throw indicator (`22.2 ft Throw`) positioned cleanly outside/alongside room edges without crowding seating labels.

---

### Task 4: SpatialRoomVisualizer Planners, Progressive Specs Drawer & `#visit` Handoff

**Files:**
- Modify: `src/components/studio/SpatialRoomVisualizer.tsx`
- Modify: `src/components/studio/CollectionSection.tsx`
- Modify: `src/components/studio/VisitSection.tsx`

**Interfaces:**
- Consumes: `calculateRoomRecommendation`, `computeRoomLayout`, `formatConsultationNote`, `mergeConsultationNote`, `STUDIO_ROOM_SELECT_EVENT`, `ROOM_CONFIGS`, `ROLE_COLORS`, `CinemaRoomCanvas`, `ParametricCinemaCadSvg`.
- Emits on `#visit` CTA click: `window.dispatchEvent(new CustomEvent(STUDIO_ROOM_SELECT_EVENT, { detail: StudioRoomSelectionPayload }))`.

- [ ] **Step 1: Add the customer Room Size & Seating planner bar in `SpatialRoomVisualizer.tsx`**

Build a crisp plaster-and-brass control card (`boxShadow: none`, subtle hairline borders `STUDIO.hair`) above the dual stage:
- **Room Length slider** (`12–32 ft`, step `1`, MUI `Slider` with accessible `aria-label="Room length in feet"`, live value badge `24 ft`).
- **Room Width slider** (`10–24 ft`, step `1`, MUI `Slider` with accessible `aria-label="Room width in feet"`, live value badge `16 ft`).
- **Seating Rows** pill switcher (`1 Row` · `2 Rows`, disables `2 Rows` cleanly with inline caption `"1 row recommended below 16 ft"` when `lengthFt < 16`).
- **Smart Auto-Fit Readout + Configurator Tabs:** Default `activeTab = recommendation.recommendedConfigId` (`"7.2.4"`). Keep auto-sync active as sliders change until the visitor manually clicks a specific tab (`5.1`, `5.1.2`, `7.2.2`, `7.2.4`), after which show a `"Apply Best Fit (${recommendation.recommendedConfigId})"` pill so they can re-sync with one tap; mark the recommended tab with a subtle brass indicator dot.

- [ ] **Step 2: Build the unified dual-mode viewport, floating/mobile control dock, and speaker inspector**

- Top bar switches smoothly between **`3D Architectural Room`** (`isometric`) and **`2D CAD Blueprint`** (`plan`), alongside live room readout (`24 × 16 ft · 150″ Screen · 8 Seats`).
- Keep `<CinemaRoomCanvas>` and `<ParametricCinemaCadSvg>` responsive across `375px–1920px` (set `<Box sx={{ position: "relative" }}>` container; on mobile `< sm` place the control dock cleanly below the canvas edge inside the dark viewport frame so buttons never overlap the room or clip!).
- **Contextual Control Dock (`>= 36px` tall targets):**
  - When **`3D Architectural Room`** is active: `Lights On / Dim Lights` · `3D Studio / Seat POV / Top View` · `Sound Cones` · `Dimensions` · `Reset`.
  - When **`2D CAD Blueprint`** is active: cleanly show `Back to 3D` · `Sound Cones` · `Dimensions` (`Dimensions` defaults cleanly or stays independent).
- Clicking/tapping a speaker in 3D canvas, 2D SVG, or right-hand Speaker Breakdown locks/highlights that speaker in the bottom Transducer Inspector bar (`selectedSpeaker` click toggle + hover preview on desktop, plus a clear `"Clear"` close button or second tap to deselect on mobile!).
- On `Lights On`, add crisp subtle station edge dimension pills when `Dimensions` is ON (`Room: 24 × 16 ft` · `Screen: 150″` · `Throw: 22.2 ft`) overlaid neatly in the corner away from controls.

- [ ] **Step 3: Refactor right-hand details column & wire `"Plan this room with us"` to `VisitSection.tsx`**

- Lead with customer-friendly cards:
  1. Outcome 3-up strip (`Ideal Screen`, `Seating`, `Projector Throw`).
  2. Plain-English room narrative + fit insight (`recommendation.fitNote`).
  3. Interactive Speaker Array breakdown (`onClick` + `onMouseEnter` highlight across 3D/2D).
  4. Collapsible `"Engineering & Acoustic Specs"` drawer using MUI `Collapse`: reveals Frequency Target Curve bars, Dirac Live FIR note, Reference Amplification, and Commissioning guidance (`config.startingFrom`) without crowding default view.
- Primary CTA `"Plan this ${recommendation.recommendedConfigId} room"` dispatches `STUDIO_ROOM_SELECT_EVENT` and smoothly scrolls to `#visit`.
- Update `CollectionSection.tsx` lead paragraph to invite customers cleanly into sizing their own room and toggling Lights / Seat POV.
- Update `VisitSection.tsx` (`useEffect` listener on `STUDIO_ROOM_SELECT_EVENT`): sets `room` to `"A private cinema"`, applies `mergeConsultationNote(prev, formatConsultationNote(detail))` cleanly, and briefly displays a subtle confirmation caption under `"Write to us"` (using `Alert`/`Typography`) confirming `"Loaded your ${lengthFt}×${widthFt} ft · ${configId} room plan into your note."`

- [ ] **Step 4: Commit Tasks 2–4 & verify static checks + unit tests + production build**

Run: `npm run check && rm -rf .next && npm run build`
Expected: `check:ui` passes 0 errors across all screens/components, `tsc --noEmit` exits 0, all root unit tests (including `room-calculator.test.mjs`) pass, and `next build` succeeds cleanly.

---

### Task 5: End-to-End Multi-Device Visual, Animation & Interactive Verification + Deployment

**Files:**
- Verification script in scratch dir (`/Users/rajat/.gemini/antigravity/brain/4bd428be-9216-4c5b-afc6-dfd9d6150d39/scratch/verify_configurator.mjs`)

- [ ] **Step 1: Verify interactively across desktop (`1280×800`, `1440×900`), tablet (`768×1024`), and mobile (`375×812`) with Playwright**

Against a production server (`npx next start -p 3099`):
- Assert initial load at `#collection` shows **Lights On** bright walnut/limestone 3D render (verify canvas pixel brightness median inside room center is clearly lit, NOT pitch black), `150″`, `7.2.4`, `8 Seats`, and **zero obstruction** in front of the screen.
- Click **Dim Lights** → capture before/after screenshot verifying smooth lighting dim & glowing cinema projection image + volumetric beam.
- Click **Seat POV** and **Top View** → capture screenshots confirming camera transitions cleanly to listener seat view looking at the screen and overhead room view.
- Move sliders (`14 × 12 ft`) → assert `1 Row` cap notice renders cleanly, screen diagonal updates, recommendation updates (`5.1`), and **Parametric 2D CAD Blueprint** view shows scaled narrow room + `1 Row` chairs (`docOverflow === 0` on `375px`, `768px`, `1280px`, `1440px`).
- Expand `"Engineering & Acoustic Specs"`, click `"Plan this room with us"` → verify smooth scroll to `#visit`, `room === "A private cinema"`, and consultation textarea contains the configured room dimensions & tier specs.

- [ ] **Step 2: Visual screenshot inspection + fix any visual/spacing flaw found**

Inspect every captured Playwright PNG directly with `read_file` before declaring complete.

- [ ] **Step 3: Final Commit, Push & Production Live Check**

```bash
git status && git add -A && git commit -m "Overhaul 3D cinema room visualizer and interactive room planner" && git push origin main
```
Fast-forward pull Hostinger backend `/home/u502706970/backend`, wait for `hbuilds` swap to complete, and confirm live `https://alvstore.com/#collection` renders the updated bright architectural configurator.

---

### Plan Self-Review Summary (Internal Check)
- **Spec coverage:** Every item in Sections 5.1–5.4 & Section 6 maps cleanly across Tasks 1–5 (`room-calculator.ts`, `cinema-room-3d.ts`, `CinemaRoomCanvas.tsx`, `ParametricCinemaCadSvg.tsx`, `SpatialRoomVisualizer.tsx`, `CollectionSection.tsx`, `VisitSection.tsx`, `tests/room-calculator.test.mjs`).
- **Type & name consistency:** `RoomConfigId`, `RoomInputs`, `RoomRecommendation`, `RoomLayout`, `CameraPreset`, `STUDIO_ROOM_SELECT_EVENT`, `calculateRoomRecommendation`, `computeRoomLayout`, `formatConsultationNote`, `mergeConsultationNote` match identically across Tasks 1–4.
- **Review Focus coverage:** All 5 Review Focus failure modes have explicit assertions in `tests/room-calculator.test.mjs` and Playwright checks in Task 5.
