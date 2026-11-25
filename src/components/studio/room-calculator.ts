export type RoomConfigId = "5.1" | "5.1.2" | "7.2.2" | "7.2.4";
export type SpeakerRole = "screen" | "surround" | "subwoofer" | "height";

export interface RoomInputs {
  lengthFt: number;
  widthFt: number;
  seatingRows: 1 | 2;
}

export interface RoomRecommendation {
  lengthFt: number;
  widthFt: number;
  effectiveRows: 1 | 2;
  rowCapNotice: string | null;
  areaSqFt: number;
  ceilingHeightFt: number;
  volumeCuFt: number;
  seatsPerRow: number;
  totalSeats: number;
  primarySeatDistFt: number;
  recommendedScreenIn: number;
  screenWidthFt: number;
  viewingAngleDeg: number;
  throwDistFt: number;
  recommendedConfigId: RoomConfigId;
  fitNote: string;
}

export interface LayoutSpeakerNode {
  id: string;
  role: SpeakerRole;
  pos3d: [number, number, number];
  rot3d: [number, number, number];
  cadX: number;
  cadY: number;
  distanceM: number;
  delayMs: number;
}

export interface SeatPosition {
  rowIndex: 0 | 1;
  xMeters: number;
  zMeters: number;
  cadX: number;
  cadY: number;
  riserHeightM: number;
}

export interface RoomLayout {
  widthM: number;
  lengthM: number;
  ceilingM: number;
  screenWidthM: number;
  screenHeightM: number;
  screenCenterY: number;
  frontZ: number;
  primarySeatZ: number;
  projectorZ: number;
  riserZStartM: number;
  riserHeightM: number;
  listenerHead3d: [number, number, number];
  cadRoomRect: { x: number; y: number; w: number; h: number };
  cadScreenSpan: { x1: number; x2: number; y: number };
  cadRiserY: number | null;
  seats: SeatPosition[];
  speakers: Record<string, LayoutSpeakerNode>;
}

export interface StudioRoomSelectionPayload {
  lengthFt: number;
  widthFt: number;
  rows: 1 | 2;
  totalSeats: number;
  screenIn: number;
  throwDistFt: number;
  configId: RoomConfigId;
  configLabel: string;
  amplification: string;
}

export interface SpeakerMeta {
  id: string;
  code: string;
  name: string;
  role: SpeakerRole;
  angle: string;
  crossover: string;
  frequency: string;
  detail: string;
}

export interface RoomConfigMeta {
  id: RoomConfigId;
  label: string;
  tabLabel: string;
  tag: string;
  channels: string;
  summary: string;
  speakers: SpeakerMeta[];
  inventory: { label: string; count: string; role: SpeakerRole; detail: string }[];
  amplification: string;
  startingFrom: string;
}

export const STUDIO_ROOM_SELECT_EVENT = "alv-studio-room-select";

const FT_TO_M = 0.3048;
const ASPECT_16_9_WIDTH_FACTOR = 16 / Math.sqrt(16 * 16 + 9 * 9); // ~0.8716
const PLANNER_MARKER = "[Room Planner]";

export const ROLE_COLORS: Record<SpeakerRole, { fill: string; stroke: string; glow: string; text: string }> = {
  screen: { fill: "#9C7B49", stroke: "#B28A4F", glow: "rgba(156,123,73,0.45)", text: "Screen LCR" },
  surround: { fill: "#445058", stroke: "#6A7882", glow: "rgba(106,120,130,0.45)", text: "Surrounds" },
  subwoofer: { fill: "#212428", stroke: "#E2BA7A", glow: "rgba(226,186,122,0.55)", text: "Subwoofers" },
  height: { fill: "#B88E52", stroke: "#F3D59B", glow: "rgba(243,213,155,0.55)", text: "Dolby Atmos" },
};

export const ALL_SPEAKERS: Record<string, SpeakerMeta> = {
  L: {
    id: "L",
    code: "L",
    name: "Front Left Channel",
    role: "screen",
    angle: "-30° azimuth",
    crossover: "80 Hz Linkwitz-Riley 24dB/oct",
    frequency: "28 Hz – 28 kHz",
    detail: "Reference 3-way floorstanding tower anchoring left screen imagery & orchestral scale",
  },
  C: {
    id: "C",
    code: "C",
    name: "Center Dialogue Channel",
    role: "screen",
    angle: "0° on-axis",
    crossover: "80 Hz Linkwitz-Riley 24dB/oct",
    frequency: "36 Hz – 28 kHz",
    detail: "Low-profile horizontal MTM dialogue channel seated beneath the 4K canvas",
  },
  R: {
    id: "R",
    code: "R",
    name: "Front Right Channel",
    role: "screen",
    angle: "+30° azimuth",
    crossover: "80 Hz Linkwitz-Riley 24dB/oct",
    frequency: "28 Hz – 28 kHz",
    detail: "Matched front right reference tower locking wide front-stage panning",
  },
  SUB1: {
    id: "SUB1",
    code: "SUB 1",
    name: "Primary Infrasonic Subwoofer",
    role: "subwoofer",
    angle: "Front-left boundary load",
    crossover: "80 Hz LPF (Linkwitz-Riley)",
    frequency: "16 Hz – 120 Hz (±1.5 dB)",
    detail: "Sealed high-excursion subwoofer pressurizing cinematic LFE impact",
  },
  SUB2: {
    id: "SUB2",
    code: "SUB 2",
    name: "Secondary Axial Subwoofer",
    role: "subwoofer",
    angle: "Rear-right opposed corner",
    crossover: "80 Hz LPF (Linkwitz-Riley)",
    frequency: "16 Hz – 120 Hz (±1.5 dB)",
    detail: "Opposed rear placement smoothing bass response across every seat row",
  },
  SL: {
    id: "SL",
    code: "SL",
    name: "Surround Left",
    role: "surround",
    angle: "-95° lateral ear-level",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "Side-wall surround placing ambient effects directly beside viewers",
  },
  SR: {
    id: "SR",
    code: "SR",
    name: "Surround Right",
    role: "surround",
    angle: "+95° lateral ear-level",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "Matched right-wall surround completing the lateral soundfield",
  },
  SBL: {
    id: "SBL",
    code: "SBL",
    name: "Surround Back Left",
    role: "surround",
    angle: "-142° rear azimuth",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "Rear-wall surround sealing acoustic movement behind multi-row seating",
  },
  SBR: {
    id: "SBR",
    code: "SBR",
    name: "Surround Back Right",
    role: "surround",
    angle: "+142° rear azimuth",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "Matched rear-right channel completing seamless 360° ear-level panning",
  },
  TML: {
    id: "TML",
    code: "TML",
    name: "Top Middle Left (Atmos)",
    role: "height",
    angle: "80° ceiling elevation",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Overhead Atmos transducer projecting vertical rain, aircraft, and ambiance",
  },
  TMR: {
    id: "TMR",
    code: "TMR",
    name: "Top Middle Right (Atmos)",
    role: "height",
    angle: "80° ceiling elevation",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Right overhead Atmos channel balancing overhead spatial motion",
  },
  TFL: {
    id: "TFL",
    code: "TFL",
    name: "Top Front Left (Atmos)",
    role: "height",
    angle: "45° forward ceiling",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Forward ceiling Atmos node linking front action seamlessly overhead",
  },
  TFR: {
    id: "TFR",
    code: "TFR",
    name: "Top Front Right (Atmos)",
    role: "height",
    angle: "45° forward ceiling",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Forward right ceiling node tracking diagonal overhead trajectories",
  },
  TRL: {
    id: "TRL",
    code: "TRL",
    name: "Top Rear Left (Atmos)",
    role: "height",
    angle: "125° rear ceiling",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Rear ceiling Atmos transducer extending the 3D overhead dome behind viewers",
  },
  TRR: {
    id: "TRR",
    code: "TRR",
    name: "Top Rear Right (Atmos)",
    role: "height",
    angle: "125° rear ceiling",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Rear right ceiling channel completing full front-to-back overhead pans",
  },
};

export const ROOM_CONFIGS: RoomConfigMeta[] = [
  {
    id: "5.1",
    label: "5.1 Traditional Surround",
    tabLabel: "5.1 Surround",
    tag: "CLASSIC CINEMA",
    channels: "6 Channels · 5 Ear-Level + 1 Sub",
    summary:
      "Tailored for intimate media rooms and living spaces. Crisp dialogue anchors to the screen while two lateral surrounds and a dedicated sub deliver clean cinema impact.",
    speakers: [ALL_SPEAKERS.L, ALL_SPEAKERS.C, ALL_SPEAKERS.R, ALL_SPEAKERS.SUB1, ALL_SPEAKERS.SL, ALL_SPEAKERS.SR],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "Left & Right towers + below-screen Center" },
      { label: "Lateral Surrounds", count: "2 Speakers", role: "surround", detail: "90°–110° side wall ambience" },
      { label: "Active Subwoofer", count: "1 Unit", role: "subwoofer", detail: "Boundary loaded deep-bass sub" },
      { label: "Overhead Atmos", count: "None", role: "height", detail: "Ear-level surround architecture" },
    ],
    amplification: "Denon AVR-X2800H / Marantz Cinema 60 (7.2-ch discrete AVR)",
    startingFrom: "₹4.5 L",
  },
  {
    id: "5.1.2",
    label: "5.1.2 Dolby Atmos",
    tabLabel: "5.1.2 Atmos",
    tag: "3D SPATIAL AUDIO",
    channels: "8 Channels · 5 Ear-Level + 1 Sub + 2 Atmos",
    summary:
      "Adds height above your seating so rain, score swells, and atmospheric effects float naturally overhead while keeping the room footprint clean and unobstructed.",
    speakers: [
      ALL_SPEAKERS.L,
      ALL_SPEAKERS.C,
      ALL_SPEAKERS.R,
      ALL_SPEAKERS.SUB1,
      ALL_SPEAKERS.SL,
      ALL_SPEAKERS.SR,
      ALL_SPEAKERS.TML,
      ALL_SPEAKERS.TMR,
    ],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "Front stage L/R + dedicated center" },
      { label: "Lateral Surrounds", count: "2 Speakers", role: "surround", detail: "Lateral ear-level surrounds" },
      { label: "Overhead Atmos", count: "2 Speakers", role: "height", detail: "In-ceiling height pair above prime seats" },
      { label: "Active Subwoofer", count: "1 Unit", role: "subwoofer", detail: "Acoustically tuned deep-bass driver" },
    ],
    amplification: "Denon AVC-X3800H / Marantz Cinema 50 (9.4-ch with Dirac Live)",
    startingFrom: "₹7.2 L",
  },
  {
    id: "7.2.2",
    label: "7.2.2 Master Cinema",
    tabLabel: "7.2.2 Immersion",
    tag: "EXPANDED THEATER",
    channels: "11 Channels · 7 Ear-Level + 2 Subs + 2 Atmos",
    summary:
      "Built for deeper rooms with full rear wrap-around sound and dual opposed subwoofers, ensuring uniform bass warmth across front and elevated rear seating.",
    speakers: [
      ALL_SPEAKERS.L,
      ALL_SPEAKERS.C,
      ALL_SPEAKERS.R,
      ALL_SPEAKERS.SUB1,
      ALL_SPEAKERS.SUB2,
      ALL_SPEAKERS.SL,
      ALL_SPEAKERS.SR,
      ALL_SPEAKERS.SBL,
      ALL_SPEAKERS.SBR,
      ALL_SPEAKERS.TML,
      ALL_SPEAKERS.TMR,
    ],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "Reference KEF / B&W front stage" },
      { label: "Surrounds (Side + Rear)", count: "4 Speakers", role: "surround", detail: "Full 360° ear-level envelope" },
      { label: "Overhead Atmos", count: "2 Speakers", role: "height", detail: "Top Middle overhead spatial layer" },
      { label: "Dual Subwoofers", count: "2 Units", role: "subwoofer", detail: "Opposed subs eliminating dead spots" },
    ],
    amplification: "Marantz Cinema 40 / Denon AVC-X4800H (11.4-ch processing)",
    startingFrom: "₹11.5 L",
  },
  {
    id: "7.2.4",
    label: "7.2.4 Reference Spatial",
    tabLabel: "7.2.4 Reference",
    tag: "FLAGSHIP MASTER ROOM",
    channels: "13 Channels · 7 Ear-Level + 2 Subs + 4 Atmos",
    summary:
      "Our signature private theater layout: four overhead Atmos speakers trace objects front-to-back across the ceiling while dual reference subwoofers deliver effortless cinema slam.",
    speakers: [
      ALL_SPEAKERS.L,
      ALL_SPEAKERS.C,
      ALL_SPEAKERS.R,
      ALL_SPEAKERS.SUB1,
      ALL_SPEAKERS.SUB2,
      ALL_SPEAKERS.SL,
      ALL_SPEAKERS.SR,
      ALL_SPEAKERS.SBL,
      ALL_SPEAKERS.SBR,
      ALL_SPEAKERS.TFL,
      ALL_SPEAKERS.TFR,
      ALL_SPEAKERS.TRL,
      ALL_SPEAKERS.TRR,
    ],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "High-SPL towers + console center" },
      { label: "Surrounds (Side + Rear)", count: "4 Speakers", role: "surround", detail: "Architectural 360° surround ring" },
      { label: "Overhead 3D Atmos", count: "4 Speakers", role: "height", detail: "Front & rear ceiling Atmos dome" },
      { label: "Dual Reference Subs", count: "2 Units", role: "subwoofer", detail: "Dual infrasonic sealed subwoofers" },
    ],
    amplification: "Marantz AV10 Reference Processor + AMP10 16-Channel Power Amplifier",
    startingFrom: "₹16.8 L",
  },
];

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeInputs(inputs: RoomInputs): { lengthFt: number; widthFt: number; requestedRows: 1 | 2 } {
  const lengthFt = Math.round(clampNumber(inputs.lengthFt, 12, 32, 24));
  const widthFt = Math.round(clampNumber(inputs.widthFt, 10, 24, 16));
  const requestedRows: 1 | 2 = inputs.seatingRows === 1 ? 1 : 2;
  return { lengthFt, widthFt, requestedRows };
}

/** Calculates screen size, seating capacity, projector throw, and matching audio package. */
export function calculateRoomRecommendation(inputs: RoomInputs): RoomRecommendation {
  const { lengthFt, widthFt, requestedRows } = normalizeInputs(inputs);
  const canFitTwoRows = lengthFt >= 16;
  const effectiveRows: 1 | 2 = canFitTwoRows ? requestedRows : 1;
  const rowCapNotice =
    !canFitTwoRows && requestedRows === 2
      ? "1 row recommended below 16 ft length for clear sightlines and rear surround spacing."
      : null;

  const areaSqFt = Math.round(lengthFt * widthFt);
  const ceilingHeightFt = areaSqFt >= 360 ? 10 : 9.5;
  const volumeCuFt = Math.round(areaSqFt * ceilingHeightFt);
  const seatsPerRow = Math.max(2, Math.min(5, Math.floor((widthFt - 4.5) / 2.6)));
  const totalSeats = seatsPerRow * effectiveRows;

  const primarySeatDistFt = Number(clampNumber(lengthFt * 0.6, 8.5, 19.5, 14.4).toFixed(1));
  const idealWidthFt = 2 * primarySeatDistFt * Math.tan((42 * Math.PI) / 360);
  const maxWidthFt = widthFt * 0.72;
  const boundedTargetWidthFt = Math.min(idealWidthFt, maxWidthFt);

  const rawDiagIn = (boundedTargetWidthFt / ASPECT_16_9_WIDTH_FACTOR) * 12;
  const maxDiagByWall = Math.floor(((maxWidthFt / ASPECT_16_9_WIDTH_FACTOR) * 12) / 5) * 5;
  const roundedDiagIn = Math.round(rawDiagIn / 5) * 5;
  const recommendedScreenIn = Math.max(90, Math.min(200, Math.min(roundedDiagIn, Math.max(90, maxDiagByWall))));
  const screenWidthFt = Number(((recommendedScreenIn / 12) * ASPECT_16_9_WIDTH_FACTOR).toFixed(2));
  const viewingAngleDeg = Math.round(
    ((2 * Math.atan(screenWidthFt / 2 / primarySeatDistFt)) * 180) / Math.PI,
  );
  const throwDistFt = Number(Math.max(9.5, lengthFt - 1.8).toFixed(1));

  let recommendedConfigId: RoomConfigId;
  if (areaSqFt <= 220) {
    recommendedConfigId = "5.1";
  } else if (areaSqFt <= 320) {
    recommendedConfigId = "5.1.2";
  } else if (areaSqFt < 380 && lengthFt < 24) {
    recommendedConfigId = "7.2.2";
  } else {
    recommendedConfigId = "7.2.4";
  }

  const fitNote =
    recommendedConfigId === "7.2.4"
      ? `Ideal for ${effectiveRows === 2 ? "two-tier seating" : "expansive single-row immersion"} — four overhead Atmos points preserve cohesive sound overhead across ${areaSqFt} sq ft.`
      : recommendedConfigId === "7.2.2"
        ? `Dual subwoofers even out low-end bass across your ${lengthFt} ft room depth without dead zones.`
        : recommendedConfigId === "5.1.2"
          ? `Adds a vivid overhead height layer to your ${widthFt} ft stage without overwhelming medium room acoustics.`
          : `Delivers clean dialogue focus and lateral surround envelopment sized naturally for a ${areaSqFt} sq ft room.`;

  return {
    lengthFt,
    widthFt,
    effectiveRows,
    rowCapNotice,
    areaSqFt,
    ceilingHeightFt,
    volumeCuFt,
    seatsPerRow,
    totalSeats,
    primarySeatDistFt,
    recommendedScreenIn,
    screenWidthFt,
    viewingAngleDeg,
    throwDistFt,
    recommendedConfigId,
    fitNote,
  };
}

/** Produces unified 3D metric coordinates and proportional 2D CAD SVG coordinates for the room. */
export function computeRoomLayout(inputs: RoomInputs): RoomLayout {
  const rec = calculateRoomRecommendation(inputs);
  const widthM = rec.widthFt * FT_TO_M;
  const lengthM = rec.lengthFt * FT_TO_M;
  const ceilingM = rec.ceilingHeightFt * FT_TO_M;

  const screenWidthM = Math.min(widthM * 0.72, rec.screenWidthFt * FT_TO_M);
  const screenHeightM = (screenWidthM * 9) / 16;
  const screenCenterY = Math.max(1.56, ceilingM * 0.56);
  const frontZ = -lengthM / 2 + 0.32;

  const primarySeatDistM = rec.primarySeatDistFt * FT_TO_M;
  const primarySeatZ = Math.min(lengthM / 2 - 1.25, Math.max(-0.4, frontZ + primarySeatDistM));
  const row2Z = Math.min(lengthM / 2 - 0.75, primarySeatZ + 1.38);
  const riserHeightM = 0.24;
  const riserZStartM = primarySeatZ + 0.72;
  const listenerHead3d: [number, number, number] = [0, 1.16, primarySeatZ];

  const projectorZ = lengthM / 2 - 0.45;

  // Map metric room footprint proportionally into 0..120 SVG CAD viewBox
  const maxCadSpan = 82;
  const scale = maxCadSpan / Math.max(widthM, lengthM);
  const cadW = widthM * scale;
  const cadH = lengthM * scale;
  const cadX0 = (120 - cadW) / 2;
  const cadY0 = (120 - cadH) / 2;
  const toCadX = (xM: number) => Number((cadX0 + (xM / widthM + 0.5) * cadW).toFixed(2));
  const toCadY = (zM: number) => Number((cadY0 + (zM / lengthM + 0.5) * cadH).toFixed(2));

  // Build seating grid
  const seatSpacingM = Math.min(0.86, Math.max(0.66, (widthM - 1.2) / Math.max(1, rec.seatsPerRow)));
  const seats: SeatPosition[] = [];
  for (let row = 0; row < rec.effectiveRows; row++) {
    const rowIdx = row as 0 | 1;
    const zM = rowIdx === 0 ? primarySeatZ : row2Z;
    const riserY = rowIdx === 0 ? 0 : riserHeightM;
    for (let s = 0; s < rec.seatsPerRow; s++) {
      const xM = (s - (rec.seatsPerRow - 1) / 2) * seatSpacingM;
      seats.push({
        rowIndex: rowIdx,
        xMeters: Number(xM.toFixed(3)),
        zMeters: Number(zM.toFixed(3)),
        cadX: toCadX(xM),
        cadY: toCadY(zM),
        riserHeightM: riserY,
      });
    }
  }

  // Front L / C / R coordinates (never overlap walls or screen)
  const frontX = Math.min(widthM / 2 - 0.34, Math.max(screenWidthM / 2 + 0.34, widthM * 0.36));
  const rearZ = lengthM / 2 - 0.32;
  const surroundSideX = widthM / 2 - 0.24;
  const surroundSideZ = clampNumber(primarySeatZ + 0.15, -lengthM * 0.1, lengthM * 0.35, 0.4);
  const atmosX = Math.min(widthM * 0.26, 1.45);
  const atmosY = ceilingM - 0.14;
  const rearSpeakerX = Math.min(widthM * 0.28, 1.55);

  const rawSpeakers: Array<{ id: string; role: LayoutSpeakerNode["role"]; pos: [number, number, number]; rot: [number, number, number] }> = [
    { id: "L", role: "screen", pos: [-frontX, 0, frontZ + 0.34], rot: [0, Math.PI / 14, 0] },
    { id: "C", role: "screen", pos: [0, 0.24, frontZ + 0.34], rot: [0, 0, 0] },
    { id: "R", role: "screen", pos: [frontX, 0, frontZ + 0.34], rot: [0, -Math.PI / 14, 0] },
    { id: "SUB1", role: "subwoofer", pos: [-(widthM / 2 - 0.46), 0, frontZ + 0.48], rot: [0, Math.PI / 7, 0] },
    { id: "SUB2", role: "subwoofer", pos: [widthM / 2 - 0.46, 0, rearZ - 0.55], rot: [0, -Math.PI * 0.85, 0] },
    { id: "SL", role: "surround", pos: [-surroundSideX, 1.25, surroundSideZ], rot: [0, Math.PI / 2, 0] },
    { id: "SR", role: "surround", pos: [surroundSideX, 1.25, surroundSideZ], rot: [0, -Math.PI / 2, 0] },
    { id: "SBL", role: "surround", pos: [-rearSpeakerX, 1.32, rearZ - 0.15], rot: [0, Math.PI * 0.92, 0] },
    { id: "SBR", role: "surround", pos: [rearSpeakerX, 1.32, rearZ - 0.15], rot: [0, -Math.PI * 0.92, 0] },
    { id: "TML", role: "height", pos: [-atmosX, atmosY, primarySeatZ - 0.15], rot: [Math.PI / 2, 0, 0] },
    { id: "TMR", role: "height", pos: [atmosX, atmosY, primarySeatZ - 0.15], rot: [Math.PI / 2, 0, 0] },
    { id: "TFL", role: "height", pos: [-atmosX, atmosY, primarySeatZ - lengthM * 0.2], rot: [Math.PI / 2, 0, 0] },
    { id: "TFR", role: "height", pos: [atmosX, atmosY, primarySeatZ - lengthM * 0.2], rot: [Math.PI / 2, 0, 0] },
    { id: "TRL", role: "height", pos: [-atmosX, atmosY, Math.min(rearZ - 0.5, primarySeatZ + lengthM * 0.16)], rot: [Math.PI / 2, 0, 0] },
    { id: "TRR", role: "height", pos: [atmosX, atmosY, Math.min(rearZ - 0.5, primarySeatZ + lengthM * 0.16)], rot: [Math.PI / 2, 0, 0] },
  ];

  const speakers: Record<string, LayoutSpeakerNode> = {};
  for (const sp of rawSpeakers) {
    const dx = sp.pos[0] - listenerHead3d[0];
    const dy = sp.pos[1] + (sp.role === "screen" && sp.id !== "C" ? 0.85 : sp.role === "subwoofer" ? 0.34 : 0) - listenerHead3d[1];
    const dz = sp.pos[2] - listenerHead3d[2];
    const distanceM = Number(Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(2));
    const delayMs = Number(((distanceM / 0.343)).toFixed(1));
    speakers[sp.id] = {
      id: sp.id,
      role: sp.role,
      pos3d: sp.pos,
      rot3d: sp.rot,
      cadX: toCadX(sp.pos[0]),
      cadY: toCadY(sp.pos[2]),
      distanceM,
      delayMs,
    };
  }

  return {
    widthM,
    lengthM,
    ceilingM,
    screenWidthM,
    screenHeightM,
    screenCenterY,
    frontZ,
    primarySeatZ,
    projectorZ,
    riserZStartM,
    riserHeightM,
    listenerHead3d,
    cadRoomRect: {
      x: Number(cadX0.toFixed(2)),
      y: Number(cadY0.toFixed(2)),
      w: Number(cadW.toFixed(2)),
      h: Number(cadH.toFixed(2)),
    },
    cadScreenSpan: {
      x1: toCadX(-screenWidthM / 2),
      x2: toCadX(screenWidthM / 2),
      y: Number((cadY0 + 3.2).toFixed(2)),
    },
    cadRiserY: rec.effectiveRows === 2 ? toCadY(riserZStartM) : null,
    seats,
    speakers,
  };
}

/** Formats a clean consultation note summary for handoff into VisitSection. */
export function formatConsultationNote(payload: StudioRoomSelectionPayload): string {
  return [
    `${PLANNER_MARKER} ${payload.lengthFt} × ${payload.widthFt} ft · ${payload.rows} ${payload.rows === 1 ? "Row" : "Rows"} (${payload.totalSeats} Seats)`,
    `Package: ${payload.configLabel} (${payload.configId})`,
    `Target Display: ${payload.screenIn}″ 4K Screen · ~${payload.throwDistFt} ft Projector Throw`,
    `Preferred System: ${payload.amplification}`,
  ].join("\n");
}

/** Merges an auto-generated room planner block cleanly without erasing custom user text. */
export function mergeConsultationNote(existingNote: string, generatedNote: string): string {
  const trimmed = existingNote.trim();
  if (!trimmed) return generatedNote;

  const markerIdx = existingNote.indexOf(PLANNER_MARKER);
  if (markerIdx !== -1) {
    const prefix = existingNote.slice(0, markerIdx).trimEnd();
    return prefix ? `${prefix}\n\n${generatedNote}` : generatedNote;
  }

  return `${trimmed}\n\n${generatedNote}`;
}
