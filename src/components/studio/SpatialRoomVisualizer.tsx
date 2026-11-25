"use client";

import { useState } from "react";
import { Box, Button, Typography, Tooltip } from "@mui/material";
import {
  ArrowOutward,
  PlayArrow,
  Pause,
  ViewInAr,
  GridOn,
  VolumeUp,
  GraphicEq,
} from "@mui/icons-material";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CinemaRoomCanvas } from "./CinemaRoomCanvas";
import { EASE, STUDIO, TYPE, FONT } from "./tokens";

export type RoomConfigId = "5.1" | "5.1.2" | "7.2.2" | "7.2.4";

export interface Speaker {
  id: string;
  code: string;
  name: string;
  role: "screen" | "surround" | "subwoofer" | "height";
  x: number; // 0..100 percentage
  y: number; // 0..100 percentage
  angle: string;
  distance: string;
  delay: string;
  crossover: string;
  frequency: string;
  detail: string;
}

export interface RoomConfig {
  id: RoomConfigId;
  label: string;
  tabLabel: string;
  tag: string;
  channels: string;
  roomSize: string;
  volume: string;
  splPeak: string;
  summary: string;
  speakers: Speaker[];
  inventory: { label: string; count: string; role: "screen" | "surround" | "subwoofer" | "height"; detail: string }[];
  amplification: string;
  startingFrom: string;
}

const ALL_SPEAKERS: Record<string, Speaker> = {
  L: {
    id: "L",
    code: "L",
    name: "Front Left Channel",
    role: "screen",
    x: 22,
    y: 11,
    angle: "-30° azimuth",
    distance: "3.85 m",
    delay: "11.2 ms",
    crossover: "80 Hz Linkwitz-Riley 24dB/oct",
    frequency: "28 Hz – 28 kHz",
    detail: "Reference 3-way tower behind acoustically transparent woven micro-perforated screen",
  },
  C: {
    id: "C",
    code: "C",
    name: "Center Dialogue Channel",
    role: "screen",
    x: 50,
    y: 11,
    angle: "0° on-axis",
    distance: "3.60 m",
    delay: "10.5 ms",
    crossover: "80 Hz Linkwitz-Riley 24dB/oct",
    frequency: "32 Hz – 28 kHz",
    detail: "Dedicated dialogue transducer anchored at exact actor eye & mouth level",
  },
  R: {
    id: "R",
    code: "R",
    name: "Front Right Channel",
    role: "screen",
    x: 78,
    y: 11,
    angle: "+30° azimuth",
    distance: "3.85 m",
    delay: "11.2 ms",
    crossover: "80 Hz Linkwitz-Riley 24dB/oct",
    frequency: "28 Hz – 28 kHz",
    detail: "Reference 3-way tower voicing matched to front left for seamless panning",
  },
  SUB1: {
    id: "SUB1",
    code: "SUB 1",
    name: "Primary Infrasonic Subwoofer",
    role: "subwoofer",
    x: 12,
    y: 14,
    angle: "Front-left corner boundary loaded",
    distance: "4.15 m",
    delay: "12.1 ms",
    crossover: "80 Hz LPF (Linkwitz-Riley)",
    frequency: "16 Hz – 120 Hz (±1.5 dB)",
    detail: "Sealed/ported infrasonic sub-bass driver with high-excursion piston travel",
  },
  SUB2: {
    id: "SUB2",
    code: "SUB 2",
    name: "Secondary Axial Subwoofer",
    role: "subwoofer",
    x: 88,
    y: 86,
    angle: "Rear-right opposed corner",
    distance: "3.80 m",
    delay: "11.0 ms",
    crossover: "80 Hz LPF (Linkwitz-Riley)",
    frequency: "16 Hz – 120 Hz (±1.5 dB)",
    detail: "Opposed room placement cancelling axial standing wave resonance nodes",
  },
  SL: {
    id: "SL",
    code: "SL",
    name: "Surround Left",
    role: "surround",
    x: 9,
    y: 64,
    angle: "-95° lateral ear-level",
    distance: "2.80 m",
    delay: "8.1 ms",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "90°–110° side wall surround firing directly at the primary listening position",
  },
  SR: {
    id: "SR",
    code: "SR",
    name: "Surround Right",
    role: "surround",
    x: 91,
    y: 64,
    angle: "+95° lateral ear-level",
    distance: "2.80 m",
    delay: "8.1 ms",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "90°–110° side wall surround completing the ear-level lateral soundstage",
  },
  SBL: {
    id: "SBL",
    code: "SBL",
    name: "Surround Back Left",
    role: "surround",
    x: 33,
    y: 90,
    angle: "-142° rear azimuth",
    distance: "3.15 m",
    delay: "9.2 ms",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "135°–150° rear surround preventing acoustic voids behind audience rows",
  },
  SBR: {
    id: "SBR",
    code: "SBR",
    name: "Surround Back Right",
    role: "surround",
    x: 67,
    y: 90,
    angle: "+142° rear azimuth",
    distance: "3.15 m",
    delay: "9.2 ms",
    crossover: "80 Hz High-Pass",
    frequency: "45 Hz – 24 kHz",
    detail: "135°–150° rear surround providing seamless 360° rear-to-front panning",
  },
  TML: {
    id: "TML",
    code: "TML",
    name: "Top Middle Left (Atmos)",
    role: "height",
    x: 35,
    y: 54,
    angle: "80° vertical elevation",
    distance: "2.35 m",
    delay: "6.8 ms",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Overhead 3D height channel for vertical acoustic hemisphere dimension",
  },
  TMR: {
    id: "TMR",
    code: "TMR",
    name: "Top Middle Right (Atmos)",
    role: "height",
    x: 65,
    y: 54,
    angle: "80° vertical elevation",
    distance: "2.35 m",
    delay: "6.8 ms",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "Overhead 3D height channel providing directional ceiling flyovers",
  },
  TFL: {
    id: "TFL",
    code: "TFL",
    name: "Top Front Left (Atmos)",
    role: "height",
    x: 33,
    y: 35,
    angle: "45° forward elevation",
    distance: "2.90 m",
    delay: "8.4 ms",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "45° forward elevation ceiling channel for front-to-overhead trajectories",
  },
  TFR: {
    id: "TFR",
    code: "TFR",
    name: "Top Front Right (Atmos)",
    role: "height",
    x: 67,
    y: 35,
    angle: "45° forward elevation",
    distance: "2.90 m",
    delay: "8.4 ms",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "45° forward elevation ceiling channel matching front stage trajectories",
  },
  TRL: {
    id: "TRL",
    code: "TRL",
    name: "Top Rear Left (Atmos)",
    role: "height",
    x: 33,
    y: 74,
    angle: "125° rear elevation",
    distance: "2.75 m",
    delay: "8.0 ms",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "125° rear elevation ceiling channel completing 4-speaker 3D overhead dome",
  },
  TRR: {
    id: "TRR",
    code: "TRR",
    name: "Top Rear Right (Atmos)",
    role: "height",
    x: 67,
    y: 74,
    angle: "125° rear elevation",
    distance: "2.75 m",
    delay: "8.0 ms",
    crossover: "100 Hz High-Pass",
    frequency: "65 Hz – 22 kHz",
    detail: "125° rear elevation ceiling channel completing 4-speaker 3D overhead dome",
  },
};

export const ROOM_CONFIGS: RoomConfig[] = [
  {
    id: "5.1",
    label: "5.1 Traditional Surround",
    tabLabel: "5.1 Surround",
    tag: "CLASSIC CINEMA",
    channels: "6 Channels · 5 Ear-Level + 1 Sub",
    roomSize: "16 × 12 ft · 190+ sq ft",
    volume: "1,520 cu ft",
    splPeak: "105 dB reference",
    summary:
      "The benchmark layout for dedicated media rooms. Three front screen channels provide razor-sharp dialogue and wide spatial imaging, two ear-level side surrounds deliver ambient envelopment, and an infrasonic subwoofer pressurizes the room.",
    speakers: [ALL_SPEAKERS.L, ALL_SPEAKERS.C, ALL_SPEAKERS.R, ALL_SPEAKERS.SUB1, ALL_SPEAKERS.SL, ALL_SPEAKERS.SR],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "Left, Center, Right behind screen" },
      { label: "Lateral Surrounds", count: "2 Speakers", role: "surround", detail: "90°–110° lateral soundstage" },
      { label: "Active Subwoofer", count: "1 Unit", role: "subwoofer", detail: "Boundary loaded deep-bass sub" },
      { label: "Overhead Atmos", count: "None", role: "height", detail: "Ear-level traditional surround" },
    ],
    amplification: "Denon AVR-X2800H / Marantz Cinema 60 (7.2-ch discrete AVR)",
    startingFrom: "₹4.5 L",
  },
  {
    id: "5.1.2",
    label: "5.1.2 Dolby Atmos Entry",
    tabLabel: "5.1.2 Atmos",
    tag: "3D SPATIAL AUDIO",
    channels: "8 Channels · 5 Ear-Level + 1 Sub + 2 Atmos",
    roomSize: "20 × 14 ft · 280+ sq ft",
    volume: "2,240 cu ft",
    splPeak: "108 dB reference",
    summary:
      "Introduces the vertical acoustic hemisphere. Two calibrated in-ceiling Dolby Atmos channels place rain, thunder, aircraft, and three-dimensional ambient sound directly overhead while front speakers lock dialogue to the screen.",
    speakers: [ALL_SPEAKERS.L, ALL_SPEAKERS.C, ALL_SPEAKERS.R, ALL_SPEAKERS.SUB1, ALL_SPEAKERS.SL, ALL_SPEAKERS.SR, ALL_SPEAKERS.TML, ALL_SPEAKERS.TMR],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "Left, Center, Right behind screen" },
      { label: "Lateral Surrounds", count: "2 Speakers", role: "surround", detail: "Lateral ear-level surrounds" },
      { label: "Overhead Atmos", count: "2 Speakers", role: "height", detail: "Top Middle in-ceiling height array" },
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
    roomSize: "24 × 16 ft · 380+ sq ft",
    volume: "3,040 cu ft",
    splPeak: "112 dB reference",
    summary:
      "Engineered for deep rooms with multiple seating tiers. Rear back surrounds seal the soundfield behind the listener, while dual opposed subwoofers cancel axial room resonance for smooth, linear seat-to-seat bass response.",
    speakers: [ALL_SPEAKERS.L, ALL_SPEAKERS.C, ALL_SPEAKERS.R, ALL_SPEAKERS.SUB1, ALL_SPEAKERS.SUB2, ALL_SPEAKERS.SL, ALL_SPEAKERS.SR, ALL_SPEAKERS.SBL, ALL_SPEAKERS.SBR, ALL_SPEAKERS.TML, ALL_SPEAKERS.TMR],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "Bowers & Wilkins / KEF Architectural" },
      { label: "Surrounds (Side + Rear)", count: "4 Speakers", role: "surround", detail: "Seamless 360° ear-level envelope" },
      { label: "Overhead Atmos", count: "2 Speakers", role: "height", detail: "Top Middle spatial height array" },
      { label: "Dual Subwoofers", count: "2 Units", role: "subwoofer", detail: "Front/Rear opposed bass mode cancel" },
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
    roomSize: "28 × 18 ft · 500+ sq ft",
    volume: "4,500+ cu ft",
    splPeak: "118 dB reference",
    summary:
      "The definitive reference private cinema. Four discrete in-ceiling Atmos height channels deliver full front-to-back overhead object panning across a 360° hemisphere of sound. Dual reference subwoofers pressurize the room without localized distortion.",
    speakers: [ALL_SPEAKERS.L, ALL_SPEAKERS.C, ALL_SPEAKERS.R, ALL_SPEAKERS.SUB1, ALL_SPEAKERS.SUB2, ALL_SPEAKERS.SL, ALL_SPEAKERS.SR, ALL_SPEAKERS.SBL, ALL_SPEAKERS.SBR, ALL_SPEAKERS.TFL, ALL_SPEAKERS.TFR, ALL_SPEAKERS.TRL, ALL_SPEAKERS.TRR],
    inventory: [
      { label: "Front LCR Array", count: "3 Speakers", role: "screen", detail: "Custom high-SPL reference towers" },
      { label: "Surrounds (Side + Rear)", count: "4 Speakers", role: "surround", detail: "Wide dispersion architectural in-walls" },
      { label: "Overhead 3D Atmos", count: "4 Speakers", role: "height", detail: "Top Front & Top Rear 4-point dome" },
      { label: "Dual Reference Subs", count: "2 Units", role: "subwoofer", detail: "Dual infrasonic sealed subwoofers" },
    ],
    amplification: "Marantz AV10 Reference Processor + AMP10 16-Channel Power Amplifier",
    startingFrom: "₹16.8 L",
  },
];

const ROLE_COLORS = {
  screen: { fill: "#9C7B49", stroke: "#B28A4F", glow: "rgba(156,123,73,0.45)", text: "Screen LCR" },
  surround: { fill: "#445058", stroke: "#6A7882", glow: "rgba(106,120,130,0.45)", text: "Surrounds" },
  subwoofer: { fill: "#212428", stroke: "#E2BA7A", glow: "rgba(226,186,122,0.55)", text: "Subwoofers" },
  height: { fill: "#B88E52", stroke: "#F3D59B", glow: "rgba(243,213,155,0.55)", text: "Dolby Atmos" },
};

export function SpatialRoomVisualizer() {
  const [activeTab, setActiveTab] = useState<RoomConfigId>("7.2.4");
  const [viewMode, setViewMode] = useState<"isometric" | "plan">("isometric");
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [hoveredSpeaker, setHoveredSpeaker] = useState<Speaker | null>(null);
  const [highlightRole, setHighlightRole] = useState<string | null>(null);
  const [sweetSpotHovered, setSweetSpotHovered] = useState<boolean>(false);
  const reduced = useReducedMotion();

  const config = ROOM_CONFIGS.find(c => c.id === activeTab) ?? ROOM_CONFIGS[3];

  const handleConsultClick = () => {
    const el = document.getElementById("visit");
    if (!el) return;
    el.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  return (
    <Box sx={{ width: "100%", my: { xs: 4, md: 6 } }}>
      {/* Top Header Bar: Section Label + Configuration Tab Switcher */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: { xs: "flex-start", lg: "center" },
          justifyContent: "space-between",
          gap: 2.5,
          pb: 3,
          borderBottom: `1px solid ${STUDIO.hairStrong}`,
        }}
      >
        <Box>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 0.75 }}>
            <Box
              component="span"
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: STUDIO.brass,
                boxShadow: "0 0 0 3px rgba(156,123,73,0.22)",
              }}
            />
            <Typography sx={{ ...TYPE.label, color: STUDIO.brass, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.68rem" }}>
              Acoustic Engineering &amp; Speaker Architectures
            </Typography>
          </Box>
          <Typography component="h3" sx={{ ...TYPE.section, fontSize: "clamp(1.4rem, 2.2vw, 1.95rem)", color: STUDIO.graphite, m: 0 }}>
            Spatial cinema configurations.
          </Typography>
        </Box>

        {/* Tab Controls with Sliding Pill */}
        <Box
          role="tablist"
          aria-label="Room audio configurations"
          sx={{
            display: { xs: "grid", sm: "inline-flex" },
            gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "none" },
            gap: { xs: 0.5, sm: 0 },
            p: 0.5,
            bgcolor: "rgba(22,24,26,0.04)",
            border: `1px solid ${STUDIO.hair}`,
            borderRadius: "4px",
            position: "relative",
            width: { xs: "100%", sm: "auto" },
          }}
        >
          {ROOM_CONFIGS.map(tab => {
            const isActive = tab.id === activeTab;
            return (
              <Box
                key={tab.id}
                component="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveTab(tab.id);
                  setHoveredSpeaker(null);
                }}
                sx={{
                  all: "unset",
                  boxSizing: "border-box",
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 2,
                  px: { xs: 1.25, sm: 1.85, md: 2.2 },
                  py: 0.9,
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  whiteSpace: "nowrap",
                  flexGrow: { xs: 0, sm: "initial" },
                  transition: `color 220ms ${EASE}`,
                  color: isActive ? STUDIO.chalk : STUDIO.graphite,
                  "&:focus-visible": { outline: `2px solid ${STUDIO.brass}`, outlineOffset: -1 },
                }}
              >
                {isActive && (
                  <Box
                    component={motion.div}
                    layoutId="activeRoomTabPill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      bgcolor: STUDIO.graphite,
                      borderRadius: "3px",
                      zIndex: -1,
                      boxShadow: "0 2px 8px rgba(22,24,26,0.18)",
                    }}
                  />
                )}
                <Typography sx={{ ...TYPE.label, fontSize: { xs: "0.68rem", md: "0.74rem" }, fontWeight: isActive ? 600 : 500, color: "inherit", letterSpacing: "0.04em" }}>
                  {tab.tabLabel}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Main Visualizer Split: ThreeUI-Grade 3D Blueprint Canvas + Engineering Placard */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.3fr 1fr" },
          gap: { xs: 4, md: 5 },
          alignItems: "stretch",
          mt: 3.5,
        }}
      >
        {/* Left Column: 3D Isometric / 2D CAD Interactive Canvas */}
        <Box
          sx={{
            bgcolor: "#111315",
            borderRadius: "6px",
            border: `1px solid rgba(156,123,73,0.35)`,
            p: { xs: 2, sm: 2.5, md: 3 },
            position: "relative",
            overflow: "hidden",
            boxShadow: "inset 0 0 80px rgba(0,0,0,0.85), 0 20px 48px rgba(0,0,0,0.22)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: { xs: 520, sm: 580, md: 620 },
          }}
        >
          {/* Subtle Precision CAD Grid Background */}
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              inset: 0,
              opacity: 0.12,
              backgroundImage:
                "linear-gradient(rgba(246,244,238,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(246,244,238,0.12) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              pointerEvents: "none",
            }}
          />

          {/* Interactive HUD Toolbar: View Toggle (3D Iso / 2D Plan) + Audio Simulation Switch + Telemetry */}
          <Box
            sx={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              pb: 1.5,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Viewport Mode Switch: 3D Isometric vs 2D CAD Plan */}
            <Box sx={{ display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: { xs: 0.75, sm: 1 } }}>
              <Box
                sx={{
                  display: "inline-flex",
                  p: 0.35,
                  bgcolor: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "3px",
                }}
              >
                <Button
                  size="small"
                  onClick={() => setViewMode("isometric")}
                  startIcon={<ViewInAr sx={{ fontSize: "0.85rem !important" }} />}
                  sx={{
                    ...TYPE.label,
                    fontSize: { xs: "0.58rem", sm: "0.62rem" },
                    px: { xs: 1, sm: 1.2 },
                    py: 0.45,
                    minWidth: "auto",
                    whiteSpace: "nowrap",
                    color: viewMode === "isometric" ? "#111315" : "rgba(255,255,255,0.6)",
                    bgcolor: viewMode === "isometric" ? STUDIO.brass : "transparent",
                    borderRadius: "2px",
                    "&:hover": {
                      bgcolor: viewMode === "isometric" ? "#B28A4F" : "rgba(255,255,255,0.08)",
                      color: viewMode === "isometric" ? "#111315" : "#FFFFFF",
                    },
                  }}
                >
                  3D Realistic Room
                </Button>
                <Button
                  size="small"
                  onClick={() => setViewMode("plan")}
                  startIcon={<GridOn sx={{ fontSize: "0.85rem !important" }} />}
                  sx={{
                    ...TYPE.label,
                    fontSize: { xs: "0.58rem", sm: "0.62rem" },
                    px: { xs: 1, sm: 1.2 },
                    py: 0.45,
                    minWidth: "auto",
                    whiteSpace: "nowrap",
                    color: viewMode === "plan" ? "#111315" : "rgba(255,255,255,0.6)",
                    bgcolor: viewMode === "plan" ? STUDIO.brass : "transparent",
                    borderRadius: "2px",
                    "&:hover": {
                      bgcolor: viewMode === "plan" ? "#B28A4F" : "rgba(255,255,255,0.08)",
                      color: viewMode === "plan" ? "#111315" : "#FFFFFF",
                    },
                  }}
                >
                  2D CAD Blueprint
                </Button>
              </Box>

              {/* Simulation Mode Toggle Button */}
              <Button
                size="small"
                onClick={() => setIsSimulating(!isSimulating)}
                startIcon={isSimulating ? <Pause sx={{ fontSize: "0.8rem !important" }} /> : <PlayArrow sx={{ fontSize: "0.8rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  fontSize: { xs: "0.58rem", sm: "0.62rem" },
                  px: { xs: 1, sm: 1.2 },
                  py: 0.45,
                  minWidth: "auto",
                  whiteSpace: "nowrap",
                  border: "1px solid rgba(226,186,122,0.3)",
                  bgcolor: isSimulating ? "rgba(156,123,73,0.18)" : "transparent",
                  color: isSimulating ? "#E2BA7A" : "rgba(255,255,255,0.5)",
                  borderRadius: "3px",
                  transition: `all 200ms ${EASE}`,
                  "&:hover": {
                    bgcolor: "rgba(156,123,73,0.3)",
                    color: "#FFFFFF",
                  },
                }}
              >
                {isSimulating ? "Acoustic Simulation" : "Simulation Paused"}
              </Button>
            </Box>

            {/* Live Audio Telemetry: SPL dB VU Meter + Transducer Count */}
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <GraphicEq sx={{ fontSize: "0.9rem", color: isSimulating ? "#E2BA7A" : "rgba(255,255,255,0.35)" }} />
                <Typography sx={{ ...TYPE.label, fontSize: "0.62rem", color: isSimulating ? "#E2BA7A" : "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>
                  {isSimulating ? "85 dB SPL REF" : "MUTED"}
                </Typography>
                {/* 5-segment VU LED level bars */}
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.3 }}>
                  {[1, 2, 3, 4, 5].map(barIdx => (
                    <Box
                      key={barIdx}
                      sx={{
                        width: 2.5,
                        height: 7 + barIdx * 1.5,
                        borderRadius: "1px",
                        bgcolor:
                          !isSimulating
                            ? "rgba(255,255,255,0.12)"
                            : barIdx <= 3
                            ? "#4CAF50"
                            : barIdx === 4
                            ? "#FFB300"
                            : "#E53935",
                        opacity: isSimulating ? 0.9 : 0.3,
                        transition: "opacity 150ms ease",
                      }}
                    />
                  ))}
                </Box>
              </Box>

              <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.45)", fontSize: "0.6rem" }}>
                {config.speakers.length} NODES
              </Typography>
            </Box>
          </Box>

          {/* Main Stage Viewport: Realistic 3D Cinema Room vs. 2D Architectural CAD Blueprint */}
          <Box
            sx={{
              position: "relative",
              my: "auto",
              width: "100%",
              height: { xs: 370, sm: 420, md: 460 },
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderRadius: "4px",
            }}
          >
            {viewMode === "isometric" ? (
              <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
                <CinemaRoomCanvas
                  configId={activeTab}
                  isSimulating={isSimulating}
                  hoveredSpeakerId={hoveredSpeaker?.id ?? null}
                  isSweetSpotFocused={sweetSpotHovered}
                />
                <Box
                  sx={{
                    position: "absolute",
                    bottom: 8,
                    right: 10,
                    pointerEvents: "none",
                    bgcolor: "rgba(17,19,21,0.78)",
                    backdropFilter: "blur(6px)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "3px",
                    px: 1,
                    py: 0.35,
                  }}
                >
                  <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.5)", fontSize: "0.56rem", letterSpacing: "0.04em" }}>
                    3D WebGL Cinema · Drag to orbit · Parallax active
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box
                sx={{
                  width: "100%",
                  height: "100%",
                  maxHeight: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  viewBox="0 0 100 100"
                  style={{
                    width: "100%",
                    height: "100%",
                    overflow: "visible",
                  }}
                >
                <defs>
                  {/* Front AT 4K Screen Gradient */}
                  <linearGradient id="screenGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#9C7B49" stopOpacity="0.85" />
                    <stop offset="50%" stopColor="#F3D59B" stopOpacity="1" />
                    <stop offset="100%" stopColor="#9C7B49" stopOpacity="0.85" />
                  </linearGradient>

                  {/* 4K Laser Optical Projector Cone */}
                  <linearGradient id="projectorBeam" x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0%" stopColor="rgba(243,213,155,0.2)" />
                    <stop offset="50%" stopColor="rgba(243,213,155,0.06)" />
                    <stop offset="100%" stopColor="rgba(243,213,155,0.01)" />
                  </linearGradient>

                  {/* Dual Subwoofer Low-Frequency Infrasonic Wavefront */}
                  <radialGradient id="subwooferWave" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(226,186,122,0.4)" />
                    <stop offset="45%" stopColor="rgba(226,186,122,0.15)" />
                    <stop offset="100%" stopColor="rgba(226,186,122,0)" />
                  </radialGradient>

                  {/* Overhead Dolby Atmos Downward Sound Shower */}
                  <radialGradient id="atmosShower" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(243,213,155,0.5)" />
                    <stop offset="60%" stopColor="rgba(184,142,82,0.18)" />
                    <stop offset="100%" stopColor="rgba(184,142,82,0)" />
                  </radialGradient>

                  {/* Floor Reflection Gradient */}
                  <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(156,123,73,0.14)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                  </radialGradient>
                </defs>

                {/* Simulated Hardwood / Acoustic Carpet Floor Slab with 3D Depth */}
                <rect
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  rx="3"
                  fill="#15181A"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="0.6"
                />

                {/* Ambient Floor Acoustic Center Glow */}
                <ellipse cx="50" cy="55" rx="42" ry="38" fill="url(#floorGlow)" />

                {/* Acoustic Perimeter Baffle Walls with Slat Diffusers */}
                <rect
                  x="5"
                  y="5"
                  width="90"
                  height="90"
                  rx="2"
                  fill="none"
                  stroke="rgba(156,123,73,0.3)"
                  strokeWidth="0.8"
                  strokeDasharray="2 2"
                />

                {/* Slat Diffuser Panels along the lateral boundary walls */}
                {[-1, 1].map(side => (
                  <g key={`diffusers-${side}`}>
                    {[22, 34, 46, 58, 70, 82].map(yPos => (
                      <rect
                        key={`slat-${side}-${yPos}`}
                        x={side === -1 ? 3.5 : 94.5}
                        y={yPos}
                        width="2"
                        height="8"
                        rx="0.5"
                        fill="#2A2F34"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.3"
                      />
                    ))}
                  </g>
                ))}

                {/* 4K Laser Projector Beam Throw (from rear wall projector to front screen) */}
                <polygon
                  points="50,93 24,7 76,7"
                  fill="url(#projectorBeam)"
                  opacity={isSimulating ? 0.95 : 0.4}
                />

                {/* Rear Wall Native 4K Projector Lens */}
                <g transform="translate(50, 93.5)">
                  <rect x="-3" y="-1.5" width="6" height="3" rx="0.6" fill="#2A2E32" stroke="#E2BA7A" strokeWidth="0.5" />
                  <circle cx="0" cy="-0.2" r="1.1" fill="#E2BA7A" opacity="0.9" />
                  {isSimulating && !reduced && (
                    <circle cx="0" cy="-0.2" r="1.8" fill="none" stroke="#E2BA7A" strokeWidth="0.4">
                      <animate attributeName="r" values="1.2;2.8;1.2" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>

                {/* Front Wall: Acoustically Transparent 4K Woven Screen Structure */}
                <g transform="translate(0, 0)">
                  {/* Screen Frame Shadow */}
                  <rect x="23.5" y="6.8" width="53" height="3.2" rx="0.8" fill="rgba(0,0,0,0.7)" />
                  {/* Front Screen */}
                  <rect
                    x="24"
                    y="6"
                    width="52"
                    height="2.6"
                    rx="0.5"
                    fill="url(#screenGrad)"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="0.4"
                  />
                  <text
                    x="50"
                    y="4.5"
                    textAnchor="middle"
                    fill="#F3D59B"
                    fontSize="2.3"
                    fontFamily="sans-serif"
                    letterSpacing="0.25"
                    fontWeight="700"
                  >
                    160″ 4K WOVEN REFERENCE SCREEN
                  </text>
                </g>

                {/* Acoustic Sweet Spot (VIP Cinema Recliner + Calibration Target) */}
                <g
                  transform="translate(50, 65)"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setSweetSpotHovered(true)}
                  onMouseLeave={() => setSweetSpotHovered(false)}
                >
                  {/* Target Calibration Rings */}
                  <circle r="11" fill="none" stroke="rgba(156,123,73,0.2)" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
                  <circle r="6.5" fill="none" stroke={sweetSpotHovered ? "#E2BA7A" : "rgba(156,123,73,0.4)"} strokeWidth="0.6" />
                  
                  {/* VIP Cinema Recliner Geometry with 3D Depth */}
                  {/* Chair Shadow */}
                  <rect x="-4.5" y="-3.5" width="9" height="8.5" rx="1.5" fill="rgba(0,0,0,0.6)" />
                  {/* Chair Base */}
                  <rect x="-4" y="-3.8" width="8" height="7.6" rx="1.2" fill="#23272B" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
                  {/* Armrests */}
                  <rect x="-4.4" y="-2" width="1.2" height="5" rx="0.4" fill="#32383E" />
                  <rect x="3.2" y="-2" width="1.2" height="5" rx="0.4" fill="#32383E" />
                  {/* Cushion */}
                  <rect x="-2.8" y="-2.2" width="5.6" height="4.8" rx="0.8" fill="#181B1D" />
                  {/* Headrest */}
                  <rect x="-2.2" y="-4.6" width="4.4" height="1.6" rx="0.6" fill="#9C7B49" />
                  
                  <text x="0" y="8" textAnchor="middle" fill="#FFFFFF" fontSize="2.2" fontWeight="600" fontFamily="sans-serif">
                    SWEET SPOT
                  </text>
                  <text x="0" y="10.2" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="1.6" fontFamily="sans-serif">
                    Dirac Live Calibrated
                  </text>
                </g>

                {/* Acoustic Soundwave Ripples & Driver Excursion Physics */}
                {isSimulating && (
                  <g opacity={reduced ? 0.4 : 0.85}>
                    {config.speakers.map((sp, idx) => {
                      const isSub = sp.role === "subwoofer";
                      const isHeight = sp.role === "height";

                      return (
                        <g key={`wave-${sp.id}`}>
                          {/* Radiating soundwave ring 1 */}
                          <circle
                            cx={sp.x}
                            cy={sp.y}
                            r={isSub ? "6" : isHeight ? "4" : "4.5"}
                            fill={isSub ? "url(#subwooferWave)" : isHeight ? "url(#atmosShower)" : "none"}
                            stroke={isSub ? "rgba(226,186,122,0.55)" : isHeight ? "rgba(243,213,155,0.6)" : "rgba(156,123,73,0.4)"}
                            strokeWidth={isSub ? "0.6" : "0.4"}
                          >
                            {!reduced && (
                              <animate
                                attributeName="r"
                                values={isSub ? "3;16;24" : isHeight ? "2;9;15" : "2;8;14"}
                                dur={isSub ? "2.6s" : "2.0s"}
                                begin={`${idx * 0.18}s`}
                                repeatCount="indefinite"
                              />
                            )}
                            {!reduced && (
                              <animate
                                attributeName="opacity"
                                values="0.85;0.35;0"
                                dur={isSub ? "2.6s" : "2.0s"}
                                begin={`${idx * 0.18}s`}
                                repeatCount="indefinite"
                              />
                            )}
                          </circle>

                          {/* Radiating soundwave ring 2 (Phase offset for smooth continuous ripple) */}
                          {!reduced && (
                            <circle
                              cx={sp.x}
                              cy={sp.y}
                              r={isSub ? "4" : "3"}
                              fill="none"
                              stroke={isSub ? "rgba(226,186,122,0.35)" : isHeight ? "rgba(243,213,155,0.4)" : "rgba(156,123,73,0.25)"}
                              strokeWidth="0.35"
                            >
                              <animate
                                attributeName="r"
                                values={isSub ? "2;12;20" : "1.5;6;11"}
                                dur={isSub ? "2.6s" : "2.0s"}
                                begin={`${idx * 0.18 + 0.9}s`}
                                repeatCount="indefinite"
                              />
                              <animate
                                attributeName="opacity"
                                values="0.7;0.25;0"
                                dur={isSub ? "2.6s" : "2.0s"}
                                begin={`${idx * 0.18 + 0.9}s`}
                                repeatCount="indefinite"
                              />
                            </circle>
                          )}
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Laser Acoustic Ray Tracing to Sweet Spot (Active on hover or sweet-spot focus) */}
                {config.speakers.map(sp => {
                  const isHovered = hoveredSpeaker?.id === sp.id;
                  const isRoleMatch = highlightRole === sp.role;
                  const showRay = isHovered || isRoleMatch || sweetSpotHovered;
                  if (!showRay) return null;

                  return (
                    <g key={`ray-${sp.id}`}>
                      {/* Laser beam connecting speaker to listener */}
                      <line
                        x1={sp.x}
                        y1={sp.y}
                        x2={50}
                        y2={65}
                        stroke="#F3D59B"
                        strokeWidth="0.8"
                        strokeDasharray="2 1.5"
                        opacity={isHovered ? 1 : 0.65}
                      />
                      {/* Animated traveling photon pulse */}
                      {!reduced && (
                        <circle r="1.1" fill="#FFFFFF">
                          <animateMotion
                            path={`M ${sp.x} ${sp.y} L 50 65`}
                            dur="1.4s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}
                    </g>
                  );
                })}

                {/* Speaker Transducers (3D Extruded Enclosures & Driver Cones) */}
                {config.speakers.map(sp => {
                  const isHovered = hoveredSpeaker?.id === sp.id;
                  const isRoleMatch = highlightRole === sp.role;
                  const colors = ROLE_COLORS[sp.role];
                  const isSub = sp.role === "subwoofer";
                  const isHeight = sp.role === "height";

                  return (
                    <g
                      key={sp.id}
                      onClick={() => setHoveredSpeaker(sp)}
                      onMouseEnter={() => setHoveredSpeaker(sp)}
                      onMouseLeave={() => setHoveredSpeaker(null)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* Interactive Focus Halo */}
                      {(isHovered || isRoleMatch) && (
                        <circle
                          cx={sp.x}
                          cy={sp.y}
                          r={isSub ? "6.8" : isHeight ? "5.5" : "5.8"}
                          fill={colors.glow}
                          stroke="#F3D59B"
                          strokeWidth="0.7"
                        />
                      )}

                      {/* Transducer Enclosure Geometry based on Channel Role */}
                      {isSub ? (
                        // Heavy Infrasonic Subwoofer Cabinet
                        <g>
                          {/* 3D Drop Shadow */}
                          <rect x={sp.x - 3.2} y={sp.y - 3} width="6.4" height="6.6" rx="0.8" fill="rgba(0,0,0,0.6)" />
                          {/* Sub Box */}
                          <rect
                            x={sp.x - 3.2}
                            y={sp.y - 3.4}
                            width="6.4"
                            height="6.4"
                            rx="0.8"
                            fill={colors.fill}
                            stroke={isHovered ? "#F3D59B" : colors.stroke}
                            strokeWidth={isHovered ? "0.9" : "0.6"}
                          />
                          {/* Subwoofer Driver Cone (Pumping with low-frequency excursion) */}
                          <circle
                            cx={sp.x}
                            cy={sp.y - 0.2}
                            r="2.2"
                            fill="#151719"
                            stroke="#9C7B49"
                            strokeWidth="0.5"
                          >
                            {isSimulating && !reduced && (
                              <animate
                                attributeName="r"
                                values="2.0;2.6;2.0"
                                dur="0.9s"
                                repeatCount="indefinite"
                              />
                            )}
                          </circle>
                          <circle cx={sp.x} cy={sp.y - 0.2} r="0.8" fill="#E2BA7A" />
                        </g>
                      ) : isHeight ? (
                        // In-Ceiling Dolby Atmos Height Driver
                        <g>
                          {/* Height Transducer Ring */}
                          <circle
                            cx={sp.x}
                            cy={sp.y}
                            r="3.0"
                            fill={colors.fill}
                            stroke={isHovered ? "#FFFFFF" : colors.stroke}
                            strokeWidth={isHovered ? "0.9" : "0.6"}
                          />
                          {/* Waveguide Aperture */}
                          <circle cx={sp.x} cy={sp.y} r="1.8" fill="#1C1F22" stroke="rgba(255,255,255,0.4)" strokeWidth="0.4" />
                          <circle cx={sp.x} cy={sp.y} r="0.7" fill="#F3D59B" />
                        </g>
                      ) : (
                        // Ear-Level Screen LCR or Lateral Surround Tower
                        <g>
                          {/* 3D Drop Shadow */}
                          <rect x={sp.x - 2.2} y={sp.y - 2.5} width="4.4" height="6.0" rx="0.6" fill="rgba(0,0,0,0.6)" />
                          {/* Speaker Tower Cabinet */}
                          <rect
                            x={sp.x - 2.2}
                            y={sp.y - 3.0}
                            width="4.4"
                            height="5.8"
                            rx="0.6"
                            fill={colors.fill}
                            stroke={isHovered ? "#F3D59B" : colors.stroke}
                            strokeWidth={isHovered ? "0.9" : "0.6"}
                          />
                          {/* Tweeter & Midrange Cones */}
                          <circle cx={sp.x} cy={sp.y - 1.6} r="0.7" fill="#E2BA7A" />
                          <circle cx={sp.x} cy={sp.y + 0.8} r="1.1" fill="#181B1E" stroke="#9C7B49" strokeWidth="0.3" />
                        </g>
                      )}

                      {/* Transducer Code Badge */}
                      <text
                        x={sp.x}
                        y={sp.y + 0.8}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="1.8"
                        fontWeight="700"
                        fontFamily="sans-serif"
                        pointerEvents="none"
                      >
                        {sp.code}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </Box>
          )}
        </Box>

          {/* Blueprint Footer: Live Transducer Telemetry Card / Role Legend */}
          <Box sx={{ position: "relative", zIndex: 10, pt: 1.5, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <AnimatePresence mode="wait">
              {hoveredSpeaker ? (
                <Box
                  key={hoveredSpeaker.id}
                  component={motion.div}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 1.5,
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography sx={{ ...TYPE.label, color: "#F3D59B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em" }}>
                        {hoveredSpeaker.code} · {hoveredSpeaker.name}
                      </Typography>
                      <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.45)", fontSize: "0.62rem" }}>
                        [{hoveredSpeaker.angle}]
                      </Typography>
                    </Box>
                    <Typography sx={{ ...TYPE.placard, color: "rgba(255,255,255,0.8)", fontSize: "0.76rem", mt: 0.25 }}>
                      {hoveredSpeaker.detail}
                    </Typography>
                  </Box>

                  {/* Telemetry Metrics: Distance, Delay, Crossover */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    <Box>
                      <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.4)", fontSize: "0.56rem", textTransform: "uppercase" }}>
                        Distance &amp; Delay
                      </Typography>
                      <Typography sx={{ fontFamily: FONT.display, color: "#FFFFFF", fontSize: "0.78rem", fontWeight: 600 }}>
                        {hoveredSpeaker.distance} · {hoveredSpeaker.delay}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.4)", fontSize: "0.56rem", textTransform: "uppercase" }}>
                        DSP Crossover
                      </Typography>
                      <Typography sx={{ fontFamily: FONT.display, color: "#F3D59B", fontSize: "0.78rem", fontWeight: 600 }}>
                        {hoveredSpeaker.crossover.split(" ")[0]} {hoveredSpeaker.crossover.split(" ")[1]}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                  {/* Channel Role Legend */}
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
                    {Object.entries(ROLE_COLORS).map(([key, val]) => (
                      <Box
                        key={key}
                        onMouseEnter={() => setHighlightRole(key)}
                        onMouseLeave={() => setHighlightRole(null)}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.75,
                          cursor: "pointer",
                          opacity: highlightRole && highlightRole !== key ? 0.45 : 1,
                          transition: "opacity 180ms ease",
                        }}
                      >
                        <Box sx={{ width: 8, height: 8, borderRadius: key === "height" ? "50%" : "2px", bgcolor: val.fill, border: `1px solid ${val.stroke}` }} />
                        <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.65)", fontSize: "0.62rem" }}>
                          {val.text}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.4)", fontSize: "0.58rem" }}>
                    Hover any transducer or the Sweet Spot for laser acoustic ray tracing
                  </Typography>
                </Box>
              )}
            </AnimatePresence>
          </Box>
        </Box>

        {/* Right Column: Engineering Placard, Inventory Breakdown & FFT Spectrum */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            p: { xs: 3, sm: 3.5, md: 4 },
            bgcolor: "rgba(246,244,238,0.75)",
            border: `1px solid ${STUDIO.hair}`,
            borderRadius: "6px",
            position: "relative",
          }}
        >
          <Box>
            {/* Tag + Channel Count Header */}
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
              <Typography
                sx={{
                  ...TYPE.label,
                  fontSize: "0.6rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: STUDIO.brass,
                  px: 0.9,
                  py: 0.35,
                  borderRadius: "2px",
                  bgcolor: "rgba(156,123,73,0.08)",
                  border: "1px solid rgba(156,123,73,0.22)",
                }}
              >
                {config.tag}
              </Typography>
              <Typography sx={{ ...TYPE.label, color: STUDIO.slate, fontSize: "0.66rem" }}>
                {config.channels}
              </Typography>
            </Box>

            {/* Config Title */}
            <Typography component="h4" sx={{ ...TYPE.exhibit, fontSize: { xs: "1.45rem", md: "1.75rem" }, color: STUDIO.graphite, mb: 1 }}>
              {config.label}
            </Typography>

            {/* Room Size & Volumetric Cubic Specification */}
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, mb: 2 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.64rem", textTransform: "uppercase" }}>
                  Ideal Footprint:
                </Typography>
                <Typography sx={{ fontFamily: FONT.display, fontSize: "0.85rem", fontWeight: 600, color: STUDIO.graphite }}>
                  {config.roomSize}
                </Typography>
              </Box>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.64rem", textTransform: "uppercase" }}>
                  Acoustic Volume:
                </Typography>
                <Typography sx={{ fontFamily: FONT.display, fontSize: "0.85rem", fontWeight: 600, color: STUDIO.brass }}>
                  {config.volume}
                </Typography>
              </Box>
            </Box>

            {/* Narrative Summary */}
            <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.9rem", lineHeight: 1.6, mb: 2.5 }}>
              {config.summary}
            </Typography>

            {/* Real-Time FFT Acoustic Frequency Spectrum (Harmon In-Room Target Curve) */}
            <Box sx={{ borderTop: `1px solid ${STUDIO.hairStrong}`, pt: 2, mb: 2.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Acoustic Frequency Response (20 Hz – 20 kHz)
                </Typography>
                <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.62rem" }}>
                  Dirac Live FIR Corrected
                </Typography>
              </Box>
              {/* Equalizer Spectrum Bars */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 0.6,
                  height: 38,
                  p: 0.75,
                  bgcolor: "rgba(22,24,26,0.03)",
                  border: `1px solid ${STUDIO.hair}`,
                  borderRadius: "3px",
                }}
              >
                {[
                  { band: "20Hz", height: "85%" },
                  { band: "40Hz", height: "92%" },
                  { band: "80Hz", height: "78%" },
                  { band: "250Hz", height: "70%" },
                  { band: "1kHz", height: "66%" },
                  { band: "4kHz", height: "64%" },
                  { band: "10kHz", height: "60%" },
                  { band: "20kHz", height: "55%" },
                ].map((eq, i) => (
                  <Box
                    key={eq.band}
                    sx={{
                      flex: 1,
                      height: eq.height,
                      bgcolor: i < 3 ? STUDIO.brass : STUDIO.graphite,
                      opacity: 0.85,
                      borderRadius: "1px",
                      position: "relative",
                      transition: "height 300ms ease",
                    }}
                  />
                ))}
              </Box>
            </Box>

            {/* Acoustic Inventory Checklist (Hovering highlights corresponding speaker role) */}
            <Box sx={{ borderTop: `1px solid ${STUDIO.hair}`, pt: 2, mb: 3 }}>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.5 }}>
                Transducer Inventory &amp; Layout
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.25 }}>
                {config.inventory.map(item => {
                  const isRoleHovered = highlightRole === item.role;
                  return (
                    <Box
                      key={item.label}
                      onMouseEnter={() => setHighlightRole(item.role)}
                      onMouseLeave={() => setHighlightRole(null)}
                      sx={{
                        p: 1.25,
                        bgcolor: isRoleHovered ? "rgba(156,123,73,0.1)" : "rgba(255,255,255,0.6)",
                        border: `1px solid ${isRoleHovered ? STUDIO.brass : STUDIO.hair}`,
                        borderRadius: "3px",
                        cursor: "pointer",
                        transition: `all 180ms ${EASE}`,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography sx={{ ...TYPE.label, color: STUDIO.graphite, fontSize: "0.72rem", fontWeight: 600 }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.64rem" }}>
                          {item.count}
                        </Typography>
                      </Box>
                      <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.74rem", mt: 0.25, lineHeight: 1.3 }}>
                        {item.detail}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Amplification Architecture */}
            <Box sx={{ borderTop: `1px solid ${STUDIO.hair}`, pt: 2 }}>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", mb: 0.5 }}>
                Reference Amplification
              </Typography>
              <Typography sx={{ fontFamily: FONT.text, fontSize: "0.95rem", color: STUDIO.graphite, fontWeight: 500, lineHeight: 1.4 }}>
                {config.amplification}
              </Typography>
            </Box>
          </Box>

          {/* Pricing Entry & Consultation CTA */}
          <Box
            sx={{
              mt: 4,
              pt: 2.5,
              borderTop: `1px solid ${STUDIO.hairStrong}`,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase" }}>
                Commissioning From
              </Typography>
              <Typography sx={{ fontFamily: FONT.display, fontSize: "1.35rem", fontWeight: 700, color: STUDIO.graphite }}>
                {config.startingFrom}
              </Typography>
            </Box>

            <Button
              onClick={handleConsultClick}
              variant="contained"
              disableElevation
              endIcon={<ArrowOutward sx={{ fontSize: "0.95rem !important" }} />}
              sx={{
                ...TYPE.label,
                bgcolor: STUDIO.graphite,
                color: STUDIO.chalk,
                px: 2.8,
                py: 1.2,
                borderRadius: "2px",
                letterSpacing: "0.05em",
                transition: `transform 200ms ${EASE}, background-color 200ms ${EASE}`,
                "&:hover": { bgcolor: STUDIO.ink, transform: "translateY(-1px)" },
                "&:active": { transform: "scale(0.98)" },
              }}
            >
              Consult for {config.id}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
