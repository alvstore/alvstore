# ALVStore Private Cinema Configurator & 3D Studio Overhaul

**Date:** 2026-11-25  
**Scope:** `CollectionSection`, `SpatialRoomVisualizer`, `CinemaRoomCanvas`, `cinema-room-3d`, `VisitSection` (`#collection` -> `#visit` funnel)  
**Selected Approach:** Approach B — Interactive Room Sizer + Bright Architectural Cinema Explorer  

---

## 1. Intent & Why

Currently, the 3D visualizer inside `#collection` renders on a pitch-black WebGL canvas (`#0E1012`) with dark walls, dark carpet, dark furniture, an obstructing floor-standing tower blocking the center of the bright projection screen, and oversized additive `pulseRing` sprites. First-time cinema buyers cannot distinguish room architecture or furniture, receive raw engineering telemetry upfront (`85 dB SPL REF`, `Dirac Live FIR`) before plain-English value, and cannot test how different room dimensions or seating layouts translate to screen size and surround architecture.

Guided by our audit of Audio Advice's Home Theater Designer paired with ALVStore's warm architectural gallery aesthetic (`#F6F4EE` chalk, `#EAE7DD` plaster, `#16181A` graphite, `#9C7B49` warm brass), this redesign turns the section into an approachable, tactile private-cinema planner:

1. **Clarity first through architectural lighting:** Default to a well-lit warm walnut & limestone cutaway studio where walls, acoustic slats, tiered seating, screen, and speakers read effortlessly, paired with an animated **Dim Lights (Cinema Mode)** toggle.
2. **Smooth purposeful camera & acoustic animations:** Interpolated camera glides between **3D Studio**, **Viewer Seat POV**, and **Top View**, staggered transducer reveals across `5.1` → `7.2.4`, discrete acoustic dispersion cones toward the sweet spot, and interactive laser throw/sightlines.
3. **Interactive customer room planner:** Compact room length/width sliders and seating row selector compute ideal screen diagonal, viewing angle, projector throw range, and recommended package (`5.1` to `7.2.4`), then pre-fill the consultation note when the buyer clicks through to `#visit`.

---

## 2. Goals, Non-Goals & Anti-Goals

### Goals
- Replace the dark, low-contrast 3D box with a warm cutaway studio room (Daylight/Lit Studio default + animated Dim Lights cinema transition).
- Eliminate center-channel obstruction of the screen by mounting a dedicated horizontal center channel on a recessed front console below the lifted 4K screen.
- Replace noisy additive `pulseRing` discs with restrained translucent dispersion cones and sweet-spot laser tracing triggered reliably via click/tap (3D raycasting + SVG click + right-panel interaction).
- Add smooth camera preset transitions (`3D Studio`, `Seat POV`, `Top View`) and interactive `2D CAD Blueprint` + `Dimensions` overlay.
- Provide intuitive `Room Length`, `Room Width`, and `Seating Rows` controls backed by a pure calculation module (`room-calculator.ts`) with automated unit tests.
- Handoff configured room specs directly into `VisitSection`'s consultation form (`#visit`).

### Non-Goals
- Full CAD wall-opening / door / window editor, third-party projector SKU catalog, or saved user accounts/database persistence (left out deliberately per Ponytail simplicity).
- Changing ERP internal pages or the upper GSAP hero scroll stage (`ExhibitsStage` / `gallery-scene.ts`).

### Anti-Goals
- Overloading buyers with deep scrollable accordions or unlabeled mystery icons.
- Introducing cold bright-blue e-commerce chrome that breaks ALVStore's warm limestone/brass typography tokens.
- Violating `tools/check-ui.mjs` AST rules (raw HTML tags, `className`, `Stack component={motion.*}`, or blocking WebGL lifecycle leaks).

---

## 3. Constraint Summary

- **UI System & AST Rules:** Must use `@mui/material` components cleanly (`Box`, `Typography`, `Button`, `Slider`, `Collapse`, `Tooltip`), wrap Framer Motion only inside `Box component={motion.*}`, avoid raw HTML JSX tags (`div`, `span`, `p`, `h1`, `h2`, `button`, etc.) and `className`, and pass `npm run check` (`check-ui.mjs` + `tsc --noEmit` + `npm test`) and `npm run build`.
- **Accessibility & Motion:** Honor `useReducedMotion()` in both React/Framer Motion and `cinema-room-3d.ts` (instant camera/lighting jumps, static subtle indicators instead of continuous oscillation). All buttons and controls require accessible labels and `>= 36px` touch targets; mobile (`375px`) must have zero horizontal overflow or control clipping.
- **WebGL Lifecycle:** Cleanly dispose all dynamically created geometries/materials on room resize/config updates and on unmount.

---

## 4. Alternatives Considered & Selection

| Option | Summary | Trade-off | Status |
| :--- | :--- | :--- | :--- |
| **A: Gallery Cinema Explorer** | Fixed 4 tiers (`5.1`–`7.2.4`), bright/dark toggle, Seat POV, clean outcomes copy | Zero room-size personalization | Not picked |
| **B: Interactive Room Sizer + Cinema Explorer** | Approach A + live Room Length/Width sliders, 1 vs 2 Seating Rows, dynamically resized 3D room, calculated screen diagonal & package recommendation, `#visit` prefill | Moderate UI & 3D geometry rebuild logic; avoids SKU bloat while answering buyer's #1 question | **Selected** |
| **C: Multi-Step Wizard** | Sequenced 4-step guided flow inside `#collection` | Heavy funnel chrome, competes with `#exhibits` scroll narrative | Not picked |

---

## 5. Detailed Design

### 5.1 Pure Room & Projection Calculator (`src/components/studio/room-calculator.ts`)
Pure TypeScript functions exported cleanly for unit testing and shared between `SpatialRoomVisualizer`, the Parametric 2D SVG CAD, and `cinema-room-3d`:
- **Inputs (`RoomInputs`):**
  - `lengthFt`: clamped `12..32` (default `24`)
  - `widthFt`: clamped `10..24` (default `16`)
  - `seatingRows`: `1 | 2` (default `2` when `lengthFt >= 16`; automatically capped to `1` when `lengthFt < 16` with an inline notice `"1 row recommended below 16 ft length for clear sightlines and surround spacing"`, disabling the `2 Rows` control cleanly)
- **Outputs (`RoomRecommendation`):**
  - `effectiveRows`: `lengthFt < 16 ? 1 : seatingRows`
  - `areaSqFt`: `Math.round(lengthFt * widthFt)`
  - `ceilingHeightFt`: `areaSqFt >= 360 ? 10 : 9.5`
  - `volumeCuFt`: `Math.round(areaSqFt * ceilingHeightFt)`
  - `seatsPerRow`: derived cleanly from width minus side aisles (`Math.max(2, Math.min(5, Math.floor((widthFt - 4.5) / 2.6)))`)
  - `totalSeats`: `seatsPerRow * effectiveRows`
  - `primarySeatDistFt`: primary viewing distance from screen (`clamp(lengthFt * 0.6, 8.5, 19.5)`, `14.4 ft` at default `24 ft`)
  - `recommendedScreenIn`: `16:9` screen diagonal computed from a `42°` cinema horizontal viewing angle at `primarySeatDistFt` (`width = 2 * primarySeatDistFt * tan(21°)`), bounded safely so screen width `<= widthFt * 0.72` (preserving front L/R speaker clearance), rounded to the nearest `5″` within `100″..200″` (evaluates cleanly to **`150″`** at the default `24 × 16 ft` room)
  - `viewingAngleDeg`: actual horizontal viewing angle in degrees from `primarySeatDistFt` (`~42°` at default)
  - `throwDistFt`: recommended projector lens placement (`+(lengthFt - 1.8).toFixed(1)`)
  - `recommendedConfigId`:
    - `"5.1"`: `areaSqFt <= 220`
    - `"5.1.2"`: `areaSqFt <= 320`
    - `"7.2.2"`: `areaSqFt < 380 && lengthFt < 24`
    - `"7.2.4"`: `areaSqFt >= 380 || lengthFt >= 24` (evaluates cleanly to **`"7.2.4"`** at the default `24 × 16 ft` = `384 sq ft` room)
  - `fitNote`: plain-English 1-sentence insight explaining why that screen size & audio layout fit the room dimensions.

- **Room Layout Geometry Export (`computeRoomLayout`):**
  - Pure helper returning normalized `[0..100%]` 2D CAD coordinates and metric `3D` positions `(x, y, z)` for room walls (`roomW`, `roomL`), `16:9` screen width, front/rear seating row centers, L/C/R towers + horizontal center plinth, subwoofers, surrounds, and Atmos ceiling channels so **3D WebGL** and **2D Parametric CAD SVG** always stay 100% geometrically synchronized.

### 5.2 3D Architectural Room & Lighting Engine (`src/components/studio/cinema-room-3d.ts`)
- **Dual-State Animated Lighting (`litProgress` smoothly lerped `1 -> 0`):**
  - **Studio Lights On (Default, `litProgress = 1`):**
    - Scene background: warm stone shadow (`0x26231e`) framing an open-ceiling architectural cutaway diorama so the room reads crisp and architectural against the `#141517` stage container.
    - Architectural palette: warm plaster upper walls (`0xd8d0c2`), walnut vertical acoustic slat panels (`0x745037`), warm taupe acoustic carpet (`0x6b645c`), travertine floor border (`0xa69d8e`), cognac/charcoal tailored leather seats (`0x3a342f`) with champagne stitching/headrest accent (`0xc8a36a`), ceiling soffit trim with illuminated `2700K` cove light strips.
    - Strong balanced illumination: warm hemisphere light (`sky 0xfff7ea`, `ground 0x7a6d5e`, `intensity 1.15`), directional soft key light casting natural depth shadows, warm linear ceiling soffit fill lights.
  - **Cinema Dark Mode (`litProgress = 0` via "Dim Lights" button):**
    - Overhead fill lights smoothly dim down (`1.15 -> 0.25`), scene background deepens (`0x0c0d0f`), floor aisle/riser brass LED trim stays warmly glowing (`emissiveIntensity` bumps slightly), **4K projection screen** shifts from a clean architectural canvas showing subtle cinema framing grids to an atmospheric high-contrast 4K movie showcase texture (generated dynamically onto an offscreen `HTMLCanvasElement` `CanvasTexture` — widescreen warm cinema vista, zero external image fetch needed!), and the additive volumetric projector light beam blooms (`opacity 0.02 -> 0.14`).
- **Unobstructed Screen & Realistic Speaker Geometry:**
  - Lift `screenGroup` (`y = 1.68` in world meters, centered proportionally on the front baffle wall) so its bottom bezel stays well above floor hardware.
  - `ALL_SPEAKERS_3D.C` uses a dedicated **horizontal 3-driver center channel silhouette** (`0.72 × 0.24 × 0.34m`) sitting on a low travertine/brass plinth at `y = 0.28m, z = frontZ + 0.32m` — completely below the screen frame with zero overlap.
  - `L` and `R` reference towers flank cleanly outside the screen edges.
  - Replace giant cloudy flat `pulseRing` sprites with subtle **translucent directional dispersion cones** (`ConeGeometry` aimed from each speaker toward `LISTENER_HEAD`, soft opacity `0.06..0.14`, gently breathing along scale/opacity when `Acoustic Waves` simulation is active) + subtle brass acoustic ring halo only when selected/hovered.
- **Dynamic Room Resizing (`setRoomDimensions`):**
  - Converts `lengthFt` and `widthFt` (`ft * 0.3048` meters, smoothly interpolated or cleanly rebuilt in a `roomShellGroup`) so walls, floor, front baffle, scaled projection screen, dynamic seat rows (`1` or `2` rows, rear tier raised on a lit wooden riser platform), L/C/R towers, side/rear surrounds, subwoofers, and ceiling Atmos nodes reposition proportionally inside the room.
  - **Dimension Guides & Architectural Rulers (`Dimensions` toggle):** Renders crisp subtle brass dashed dimension bars directly inside the 3D floor perimeter / 2D SVG CAD, paired with clean stationary edge readout pills (`Room Length × Width`, `Recommended Screen`, `Throw Distance`) — zero per-frame React DOM projection thrash.
- **Smooth Camera Choreography & Raycast Selection:**
  - `setCameraPreset("studio" | "seat" | "top")`:
    - `"studio"`: elevated 3/4 open cutaway view (`pos ~ [roomW * 0.72 + 1.4, 3.65, roomL * 0.68 + 1.8]`, `look = [0, 1.0, -0.3]`, `fov = 44`).
    - `"seat"`: glides smoothly to first-person primary row listener eye height (`[0, 1.18, seatZ]`, `look = [0, 1.45, -roomL/2]`, `fov = 50`) so customers preview exact viewing immersion! Touch/drag orbit disabled or gently clamped to look around from the seat.
    - `"top"`: overhead architectural perspective (`[0, Math.max(8.2, roomL * 1.15), 0.35]`, `look = [0, 0, 0]`, `fov = 36`).
  - `THREE.Raycaster` handles click/tap + pointer hover over speakers (`role` group meshes carry `userData.speakerId`), firing `onSpeakerSelect(id)` and updating cursor to `pointer`.

### 5.3 Dual Engine & Parametric 2D CAD Blueprint (`SpatialRoomVisualizer.tsx`)
- **Parametric 2D CAD Blueprint (Rebuilt in Sync):**
  - Keep both **`3D Architectural Room`** and **`2D CAD Blueprint`** modes at the top of the viewport card (so `<CinemaRoomCanvas>` stays cleanly mounted or toggles smoothly without losing room state).
  - Dynamically scale the `<svg viewBox="0 0 120 120">` room perimeter rectangle proportional to `widthFt / lengthFt` (centered inside an architectural grid), showing scaled `16:9` screen width, horizontal `L / C / R` placement outside/below the screen (no center obstruction), dynamic `seatsPerRow × effectiveRows` chairs + rear riser deck outline, scaled projector throw beam, **Sound Cones** ripples/rays, and crisp **Dimensions** callouts (`widthFt`, `lengthFt`, `screenIn″`, `throwDistFt`).
- **Top Planner Strip (Above/Integrated with Visualizer):**
  - **1. Room Size & Seating Bar:** Clean glass/plaster strip with:
    - `Room Length` MUI `Slider` (`12–32 ft`, default `24 ft`).
    - `Room Width` MUI `Slider` (`10–24 ft`, default `16 ft`).
    - `Seating Rows` segmented pill (`1 Row` · `2 Rows`, auto-capped cleanly to `1 Row` under `16 ft`).
    - Live auto-fit summary chip: e.g., `Suggests 150″ Screen · 8 Seats · Best match: 7.2.4 Reference`.
  - **2. Configuration Tabs (`5.1`, `5.1.2`, `7.2.2`, `7.2.4`):**
    - Initial load sets `activeTab = recommendedConfigId` (`"7.2.4"`).
    - While exploring sliders, `activeTab` stays automatically synced to `recommendedConfigId` until the user manually clicks a specific tab; once overridden manually, a crisp `"Apply Best Fit (<tier>)"` chip appears beside the summary so the user can re-sync with one click.
- **Viewport Bottom Control Bar (`<= 6` clean controls, responsive stacking on `< sm`):**
  - In **3D Room** mode: `Lights On / Dim Lights` · `3D Studio / Seat POV / Top View` · `Sound Cones` · `Dimensions` · `Reset` (and on mobile `< sm`, moves cleanly right below the canvas frame so touch targets never clip `375px`).
  - In **2D CAD Blueprint** mode: 3D-only camera/lighting buttons cleanly hide/dim so only relevant `Sound Cones` · `Dimensions` · `Back to 3D` controls show cleanly (clicking `3D` or any 3D camera pill returns straight to WebGL).
- **Below Canvas — Transducer Inspector Bar:** Showing clicked/hovered speaker in plain English (*what it does in the room + distance + timing*) alongside clickable/hoverable role filter chips (`Screen LCR`, `Surrounds`, `Subwoofers`, `Dolby Atmos`).
- **Right/Detail Column — Customer-First Clarity + Progressive Spec Drawer:**
  - **Outcome Grid (3 crisp tiles):** `Ideal Screen` (`150″ 4K`), `Seating` (`2 Rows · 8 Seats`), `Throw` (`22.2 ft`).
  - **Plain-English Narrative:** Customer-centered explanation of how this layout feels inside *their* configured dimensions.
  - **Interactive Speaker Breakdown Grid:** Hover or tap (`onClick` for touch screens!) highlights speakers + laser rays inside both 3D & 2D modes and focuses the inspector bar.
  - **Collapsible "Engineering & Acoustic Specs" Drawer (`Collapse`):** Moves technical data (Freq Response Curve bars, Dirac Live FIR note, DSP Crossover, Amplification model & Starting Price guidance) into an optional expand toggle (`View technical & acoustic specs`), keeping the primary interface calm and scannable.
- **Consultation Handoff CTA:**
  - Primary CTA button `"Plan this room with us"` (`24×16 ft · 7.2.4 · 150″`) smoothly scrolls to `#visit` and dispatches a custom `window` event (`"alv-studio-room-select"`) containing `{ roomSize, seatingRows, totalSeats, configLabel, screenIn, amplification }`.

### 5.4 Consultation Pre-Fill (`src/components/studio/VisitSection.tsx`)
- Listen for `"alv-studio-room-select"` events cleanly in a `useEffect`: set `room` to `"A private cinema"`, pre-fill `note` with a concise, editable structured room summary (only overriding untouched empty or prior auto-filled notes so manually typed customer notes are never overwritten), and show a subtle confirmation caption under `"Write to us"` (or highlight the textarea briefly) so the customer knows their room config came with them.

---

## 6. Files Touched (Expected)
- **Create:** `src/components/studio/room-calculator.ts` (pure calculation + unit tests)
- **Create:** `tests/room-calculator.test.mjs`
- **Modify:** `src/components/studio/cinema-room-3d.ts` (lit walnut architecture, animated dimmer, camera presets, horizontal center speaker, dispersion cones, dynamic dimensions/seats, click raycaster)
- **Modify:** `src/components/studio/CinemaRoomCanvas.tsx` (pass room dimensions, lighting state, camera preset, speaker selection callback)
- **Modify:** `src/components/studio/SpatialRoomVisualizer.tsx` (room size + seating controls, recommended fit badge, bottom control dock, customer outcomes layout + collapsible tech specs, `#visit` handoff)
- **Modify:** `src/components/studio/CollectionSection.tsx` (align lead copy smoothly with the interactive room planner)
- **Modify:** `src/components/studio/VisitSection.tsx` (listen for configured room handoff & pre-fill consultation note safely)

---

## 7. Builder Handoff & Verification Criteria
Left to the implementation plan (`writing-plans`):
- Exact slider debouncing / WebGL geometry update batching so dragging room width/length sliders stays 60fps without reallocating shader programs unnecessarily.
- Responsive Playwright verification across `375×812`, `768×1024`, `1024×768`, `1280×800`, and `1440×900` checking `Lights On` default legibility, `Dim Lights` animation, `Seat POV` camera framing, and `#visit` prefill.
- `npm run check` (`check-ui.mjs`, `tsc --noEmit`, `npm test` including `room-calculator.test.mjs`) and `rm -rf .next && npm run build`.
