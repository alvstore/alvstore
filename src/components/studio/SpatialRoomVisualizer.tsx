"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Button, Collapse, Slider, Tooltip, Typography } from "@mui/material";
import {
  ArrowOutward,
  Close,
  ExpandMore,
  GraphicEq,
  GridOn,
  Lightbulb,
  LightbulbOutlined,
  RestartAlt,
  Straighten,
  ThreeDRotation,
  VerticalAlignTop,
  ViewInAr,
  Weekend,
} from "@mui/icons-material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CameraPreset } from "./cinema-room-3d";
import { CinemaRoomCanvas } from "./CinemaRoomCanvas";
import { ParametricCinemaCadSvg } from "./ParametricCinemaCadSvg";
import {
  ALL_SPEAKERS,
  calculateRoomRecommendation,
  computeRoomLayout,
  formatConsultationNote,
  ROLE_COLORS,
  ROOM_CONFIGS,
  STUDIO_ROOM_SELECT_EVENT,
  type RoomConfigId,
  type SpeakerMeta,
  type StudioRoomSelectionPayload,
} from "./room-calculator";
import { EASE, FONT, STUDIO, TYPE } from "./tokens";

export type { RoomConfigId };

/**
 * Interactive Private Cinema Room Planner & Dual 3D/2D Explorer.
 * Pairs live room dimension/seating sizing with a bright architectural 3D studio
 * (plus animated Dim Lights Cinema Mode), smooth camera POV presets, and a synchronized
 * parametric 2D CAD blueprint.
 */
export function SpatialRoomVisualizer() {
  const [lengthFt, setLengthFt] = useState<number>(24);
  const [widthFt, setWidthFt] = useState<number>(16);
  const [seatingRows, setSeatingRows] = useState<1 | 2>(2);

  const [activeTab, setActiveTab] = useState<RoomConfigId>("7.2.4");
  const [manualTabLocked, setManualTabLocked] = useState<boolean>(false);

  const [viewMode, setViewMode] = useState<"isometric" | "plan">("isometric");
  const [lightsOn, setLightsOn] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("studio");
  const [soundCones, setSoundCones] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [resetSignal, setResetSignal] = useState<number>(0);

  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null);
  const [hoveredSpeakerId, setHoveredSpeakerId] = useState<string | null>(null);
  const [highlightRole, setHighlightRole] = useState<string | null>(null);
  const [sweetSpotHovered, setSweetSpotHovered] = useState<boolean>(false);
  const [techSpecsOpen, setTechSpecsOpen] = useState<boolean>(false);

  const reduced = useReducedMotion();

  const recommendation = useMemo(
    () => calculateRoomRecommendation({ lengthFt, widthFt, seatingRows }),
    [lengthFt, widthFt, seatingRows],
  );

  const layout = useMemo(
    () => computeRoomLayout({ lengthFt, widthFt, seatingRows }),
    [lengthFt, widthFt, seatingRows],
  );

  // Sync recommended package tier automatically as room sliders move unless user manually chose a tier
  useEffect(() => {
    if (!manualTabLocked) {
      setActiveTab(recommendation.recommendedConfigId);
    }
  }, [manualTabLocked, recommendation.recommendedConfigId]);

  const config = ROOM_CONFIGS.find(c => c.id === activeTab) ?? ROOM_CONFIGS[3];
  const focusedSpeakerId = hoveredSpeakerId ?? selectedSpeakerId;
  const focusedSpeaker: SpeakerMeta | null = focusedSpeakerId
    ? config.speakers.find(s => s.id === focusedSpeakerId) ?? null
    : null;
  const focusedNode = focusedSpeaker ? layout.speakers[focusedSpeaker.id] : null;

  const isRecommendedMatch = activeTab === recommendation.recommendedConfigId;

  const handleSelectTab = (tabId: RoomConfigId) => {
    setActiveTab(tabId);
    setManualTabLocked(true);
    setSelectedSpeakerId(null);
    setHoveredSpeakerId(null);
  };

  const handleApplyRecommended = () => {
    setActiveTab(recommendation.recommendedConfigId);
    setManualTabLocked(false);
    setSelectedSpeakerId(null);
  };

  const handleCameraSwitch = (preset: CameraPreset) => {
    setCameraPreset(preset);
    if (viewMode === "plan") {
      setViewMode("isometric");
    }
  };

  const handleResetView = () => {
    setCameraPreset("studio");
    setSelectedSpeakerId(null);
    setHoveredSpeakerId(null);
    setHighlightRole(null);
    setResetSignal(n => n + 1);
  };

  const handleConsultClick = () => {
    const payload: StudioRoomSelectionPayload = {
      lengthFt: recommendation.lengthFt,
      widthFt: recommendation.widthFt,
      rows: recommendation.effectiveRows,
      totalSeats: recommendation.totalSeats,
      screenIn: recommendation.recommendedScreenIn,
      throwDistFt: recommendation.throwDistFt,
      configId: config.id,
      configLabel: config.label,
      amplification: config.amplification,
    };

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(STUDIO_ROOM_SELECT_EVENT, {
          detail: {
            ...payload,
            formattedNote: formatConsultationNote(payload),
          },
        }),
      );
    }

    const visitEl = document.getElementById("visit");
    visitEl?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  };

  const dockButtonSx = (active: boolean) => ({
    ...TYPE.label,
    fontSize: { xs: "0.62rem", sm: "0.66rem" },
    px: { xs: 1.15, sm: 1.35 },
    py: 0.65,
    minHeight: 36,
    minWidth: "auto",
    whiteSpace: "nowrap",
    borderRadius: "3px",
    border: active ? "1px solid rgba(226,186,122,0.55)" : "1px solid rgba(255,255,255,0.12)",
    bgcolor: active ? STUDIO.brass : "rgba(255,255,255,0.06)",
    color: active ? "#121315" : "rgba(255,255,255,0.78)",
    transition: `all 180ms ${EASE}`,
    "&:hover": {
      bgcolor: active ? "#B28A4F" : "rgba(255,255,255,0.12)",
      color: active ? "#121315" : "#FFFFFF",
    },
  });

  return (
    <Box sx={{ width: "100%", my: { xs: 3, md: 5 } }}>
      {/* Step 1: Customer Room Dimension & Seating Planner Bar */}
      <Box
        sx={{
          p: { xs: 2, sm: 2.5, md: 3 },
          mb: 3,
          bgcolor: "rgba(246,244,238,0.85)",
          border: `1px solid ${STUDIO.hairStrong}`,
          borderRadius: "6px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            mb: 2.25,
          }}
        >
          <Box>
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, mb: 0.4 }}>
              <Box
                component="span"
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  bgcolor: STUDIO.brass,
                }}
              />
              <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.64rem", letterSpacing: "0.09em", textTransform: "uppercase" }}>
                Step 1 · Enter Your Room Dimensions
              </Typography>
            </Box>
            <Typography sx={{ fontFamily: FONT.display, fontSize: { xs: "1.05rem", md: "1.2rem" }, fontWeight: 600, color: STUDIO.graphite }}>
              Dial in your space to preview screen size, seating &amp; acoustic fit
            </Typography>
          </Box>

          {/* Smart Live Fit Summary + Auto-Sync Chip */}
          <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: "4px",
                bgcolor: "rgba(22,24,26,0.045)",
                border: `1px solid ${STUDIO.hair}`,
              }}
            >
              <Typography sx={{ ...TYPE.label, color: STUDIO.graphite, fontSize: "0.68rem", fontWeight: 600 }}>
                Suggests {recommendation.recommendedScreenIn}″ 4K · {recommendation.totalSeats} Seats ·{" "}
                <Box component="span" sx={{ color: STUDIO.brass }}>
                  {recommendation.recommendedConfigId} Best Fit
                </Box>
              </Typography>
            </Box>

            <AnimatePresence>
              {!isRecommendedMatch && (
                <Box
                  component={motion.div}
                  initial={reduced ? false : { opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    size="small"
                    onClick={handleApplyRecommended}
                    sx={{
                      ...TYPE.label,
                      fontSize: "0.64rem",
                      px: 1.4,
                      minHeight: 34,
                      bgcolor: STUDIO.brass,
                      color: "#121315",
                      borderRadius: "3px",
                      "&:hover": { bgcolor: "#B28A4F" },
                    }}
                  >
                    Apply Best Fit ({recommendation.recommendedConfigId})
                  </Button>
                </Box>
              )}
            </AnimatePresence>
          </Box>
        </Box>

        {/* Three Tactile Inputs: Room Length, Room Width, Seating Rows */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr auto" },
            gap: { xs: 2, md: 3.5 },
            alignItems: "center",
          }}
        >
          {/* Room Length Slider */}
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
              <Typography sx={{ ...TYPE.label, color: STUDIO.slate, fontSize: "0.68rem" }}>
                Room Length (Screen to Back Wall)
              </Typography>
              <Typography sx={{ fontFamily: FONT.display, fontWeight: 700, fontSize: "0.95rem", color: STUDIO.graphite }}>
                {lengthFt} ft
              </Typography>
            </Box>
            <Slider
              aria-label="Room length in feet"
              min={12}
              max={32}
              step={1}
              value={lengthFt}
              onChange={(_, val) => setLengthFt(Array.isArray(val) ? val[0] : val)}
              sx={{
                color: STUDIO.brass,
                py: 1,
                "& .MuiSlider-thumb": {
                  width: 18,
                  height: 18,
                  bgcolor: STUDIO.graphite,
                  border: `2px solid ${STUDIO.brass}`,
                  "&:hover, &.Mui-focusVisible": { boxShadow: "0 0 0 6px rgba(156,123,73,0.18)" },
                },
                "& .MuiSlider-rail": { bgcolor: STUDIO.hairStrong, opacity: 1 },
              }}
            />
          </Box>

          {/* Room Width Slider */}
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
              <Typography sx={{ ...TYPE.label, color: STUDIO.slate, fontSize: "0.68rem" }}>
                Room Width (Wall to Wall)
              </Typography>
              <Typography sx={{ fontFamily: FONT.display, fontWeight: 700, fontSize: "0.95rem", color: STUDIO.graphite }}>
                {widthFt} ft
              </Typography>
            </Box>
            <Slider
              aria-label="Room width in feet"
              min={10}
              max={24}
              step={1}
              value={widthFt}
              onChange={(_, val) => setWidthFt(Array.isArray(val) ? val[0] : val)}
              sx={{
                color: STUDIO.brass,
                py: 1,
                "& .MuiSlider-thumb": {
                  width: 18,
                  height: 18,
                  bgcolor: STUDIO.graphite,
                  border: `2px solid ${STUDIO.brass}`,
                  "&:hover, &.Mui-focusVisible": { boxShadow: "0 0 0 6px rgba(156,123,73,0.18)" },
                },
                "& .MuiSlider-rail": { bgcolor: STUDIO.hairStrong, opacity: 1 },
              }}
            />
          </Box>

          {/* Seating Rows Selector */}
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" } }}>
            <Typography sx={{ ...TYPE.label, color: STUDIO.slate, fontSize: "0.68rem", mb: 0.8 }}>
              Seating Layout ({recommendation.totalSeats} seats)
            </Typography>
            <Box
              sx={{
                display: "inline-flex",
                p: 0.4,
                bgcolor: "rgba(22,24,26,0.05)",
                border: `1px solid ${STUDIO.hair}`,
                borderRadius: "4px",
                gap: 0.5,
              }}
            >
              {[1, 2].map(rowCount => {
                const count = rowCount as 1 | 2;
                const disabled = count === 2 && lengthFt < 16;
                const active = recommendation.effectiveRows === count;
                return (
                  <Button
                    key={count}
                    size="small"
                    disabled={disabled}
                    onClick={() => setSeatingRows(count)}
                    sx={{
                      ...TYPE.label,
                      fontSize: "0.66rem",
                      px: 1.5,
                      minHeight: 36,
                      borderRadius: "3px",
                      bgcolor: active ? STUDIO.graphite : "transparent",
                      color: active ? STUDIO.chalk : STUDIO.slate,
                      "&:hover": { bgcolor: active ? STUDIO.ink : "rgba(22,24,26,0.06)" },
                      "&.Mui-disabled": { color: STUDIO.mist, opacity: 0.55 },
                    }}
                  >
                    {count === 1 ? "1 Row" : "2 Rows (Tiered)"}
                  </Button>
                );
              })}
            </Box>
          </Box>
        </Box>

        {recommendation.rowCapNotice && (
          <Typography sx={{ ...TYPE.placard, fontSize: "0.78rem", color: STUDIO.brass, mt: 1.25 }}>
            {recommendation.rowCapNotice}
          </Typography>
        )}
      </Box>

      {/* Step 2 Header Bar + Audio Package Tabs */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
          pb: 2,
          borderBottom: `1px solid ${STUDIO.hairStrong}`,
        }}
      >
        <Box>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.9, mb: 0.4 }}>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: STUDIO.brass }} />
            <Typography sx={{ ...TYPE.label, color: STUDIO.brass, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: "0.64rem" }}>
              Step 2 · Compare Audio Systems in Your Room
            </Typography>
          </Box>
          <Typography component="h3" sx={{ ...TYPE.exhibit, fontSize: { xs: "1.45rem", md: "1.85rem" }, color: STUDIO.graphite }}>
            Interactive 3D Studio &amp; CAD Blueprint.
          </Typography>
        </Box>

        {/* Configuration Tab Switcher with Spring Pill + Best Fit Indicator */}
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
            const isBestFit = tab.id === recommendation.recommendedConfigId;
            return (
              <Box
                key={tab.id}
                component="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectTab(tab.id)}
                sx={{
                  all: "unset",
                  boxSizing: "border-box",
                  cursor: "pointer",
                  position: "relative",
                  zIndex: 2,
                  px: { xs: 1.25, sm: 1.75, md: 2.1 },
                  py: 0.9,
                  minHeight: 38,
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.65,
                  whiteSpace: "nowrap",
                  transition: `color 220ms ${EASE}`,
                  color: isActive ? STUDIO.chalk : STUDIO.graphite,
                  "&:focus-visible": { outline: `2px solid ${STUDIO.brass}`, outlineOffset: -1 },
                }}
              >
                {isActive && (
                  <Box
                    component={motion.div}
                    layoutId="activeRoomTabPill"
                    transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32 }}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      bgcolor: STUDIO.graphite,
                      borderRadius: "3px",
                      zIndex: -1,
                      boxShadow: "0 2px 8px rgba(22,24,26,0.16)",
                    }}
                  />
                )}
                {isBestFit && (
                  <Box
                    component="span"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: isActive ? "#E6BE79" : STUDIO.brass,
                      flexShrink: 0,
                    }}
                  />
                )}
                <Typography sx={{ ...TYPE.label, fontSize: { xs: "0.66rem", md: "0.74rem" }, fontWeight: isActive ? 600 : 500, color: "inherit", letterSpacing: "0.04em" }}>
                  {tab.tabLabel}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Main Split Stage: Dual 3D/2D Visualizer + Outcome Details */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.35fr 1fr" },
          gap: { xs: 3, md: 4.5 },
          alignItems: "stretch",
        }}
      >
        {/* Left Stage: Dual Architectural 3D & Parametric 2D Blueprint Container */}
        <Box
          sx={{
            position: "relative",
            minWidth: 0,
            bgcolor: "#141619",
            borderRadius: "6px",
            p: { xs: 1.5, sm: 2.25, md: 2.5 },
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 18px 46px rgba(17,19,21,0.14)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflow: "hidden",
          }}
        >
          {/* Top HUD: Dual Engine Switch (3D Room vs Parametric 2D CAD) + Live Summary */}
          <Box
            sx={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.25,
              pb: 1.25,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
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
                  fontSize: { xs: "0.6rem", sm: "0.64rem" },
                  px: { xs: 1.1, sm: 1.4 },
                  minHeight: 34,
                  whiteSpace: "nowrap",
                  color: viewMode === "isometric" ? "#121315" : "rgba(255,255,255,0.7)",
                  bgcolor: viewMode === "isometric" ? STUDIO.brass : "transparent",
                  borderRadius: "2px",
                  "&:hover": { bgcolor: viewMode === "isometric" ? "#B28A4F" : "rgba(255,255,255,0.1)" },
                }}
              >
                3D Studio Room
              </Button>
              <Button
                size="small"
                onClick={() => setViewMode("plan")}
                startIcon={<GridOn sx={{ fontSize: "0.85rem !important" }} />}
                sx={{
                  ...TYPE.label,
                  fontSize: { xs: "0.6rem", sm: "0.64rem" },
                  px: { xs: 1.1, sm: 1.4 },
                  minHeight: 34,
                  whiteSpace: "nowrap",
                  color: viewMode === "plan" ? "#121315" : "rgba(255,255,255,0.7)",
                  bgcolor: viewMode === "plan" ? STUDIO.brass : "transparent",
                  borderRadius: "2px",
                  "&:hover": { bgcolor: viewMode === "plan" ? "#B28A4F" : "rgba(255,255,255,0.1)" },
                }}
              >
                2D CAD Blueprint
              </Button>
            </Box>

            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.25 }}>
              <Typography sx={{ ...TYPE.label, color: "#E6BE79", fontSize: "0.64rem", letterSpacing: "0.05em" }}>
                {recommendation.lengthFt}×{recommendation.widthFt} FT · {recommendation.recommendedScreenIn}″ 4K · {config.id}
              </Typography>
            </Box>
          </Box>

          {/* Viewport Stage */}
          <Box
            sx={{
              position: "relative",
              width: "100%",
              height: { xs: 330, sm: 390, md: 430 },
              my: 1.25,
              borderRadius: "4px",
              overflow: "hidden",
            }}
          >
            {viewMode === "isometric" ? (
              <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
                <CinemaRoomCanvas
                  configId={activeTab}
                  layout={layout}
                  lightsOn={lightsOn}
                  cameraPreset={cameraPreset}
                  soundCones={soundCones}
                  showDimensions={showDimensions}
                  hoveredSpeakerId={focusedSpeakerId}
                  highlightRole={highlightRole}
                  isSweetSpotFocused={sweetSpotHovered}
                  onSpeakerSelect={id => setSelectedSpeakerId(id)}
                  resetSignal={resetSignal}
                />

                {/* Non-blocking Corner Dimension Pill & Lighting Indicator in 3D */}
                {showDimensions && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      pointerEvents: "none",
                      px: 1.2,
                      py: 0.5,
                      borderRadius: "3px",
                      bgcolor: "rgba(18,19,21,0.78)",
                      backdropFilter: "blur(6px)",
                      border: "1px solid rgba(226,186,122,0.28)",
                    }}
                  >
                    <Typography sx={{ ...TYPE.label, color: "#F3D59B", fontSize: "0.58rem" }}>
                      {recommendation.lengthFt} × {recommendation.widthFt} ft · Screen {recommendation.recommendedScreenIn}″ · Throw {recommendation.throwDistFt} ft
                    </Typography>
                  </Box>
                )}

                <Box
                  sx={{
                    position: "absolute",
                    bottom: 8,
                    right: 10,
                    pointerEvents: "none",
                    px: 1,
                    py: 0.35,
                    borderRadius: "3px",
                    bgcolor: "rgba(18,19,21,0.72)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.58)", fontSize: "0.56rem" }}>
                    Drag to orbit · Click any speaker to inspect
                  </Typography>
                </Box>
              </Box>
            ) : (
              <ParametricCinemaCadSvg
                layout={layout}
                recommendation={recommendation}
                speakers={config.speakers}
                hoveredSpeakerId={focusedSpeakerId}
                highlightRole={highlightRole}
                sweetSpotHovered={sweetSpotHovered}
                soundCones={soundCones}
                showDimensions={showDimensions}
                reducedMotion={!!reduced}
                onSelectSpeaker={id => setSelectedSpeakerId(id)}
                onHoverSweetSpot={setSweetSpotHovered}
              />
            )}
          </Box>

          {/* Bottom Tactile Studio Dock: Lights On/Dim + Camera Presets + Sound/Dimensions */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              py: 1.25,
              borderTop: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {viewMode === "isometric" ? (
              <>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                  <Tooltip title={lightsOn ? "Dim overhead studio lighting for cinema viewing" : "Turn on architectural studio lighting"}>
                    <Button
                      size="small"
                      onClick={() => setLightsOn(v => !v)}
                      startIcon={
                        lightsOn ? (
                          <Lightbulb sx={{ fontSize: "0.95rem !important", color: "#121315" }} />
                        ) : (
                          <LightbulbOutlined sx={{ fontSize: "0.95rem !important" }} />
                        )
                      }
                      sx={dockButtonSx(lightsOn)}
                    >
                      {lightsOn ? "Lights On" : "Cinema Dark"}
                    </Button>
                  </Tooltip>

                  <Box sx={{ display: "inline-flex", gap: 0.5 }}>
                    <Button
                      size="small"
                      onClick={() => handleCameraSwitch("studio")}
                      startIcon={<ThreeDRotation sx={{ fontSize: "0.85rem !important" }} />}
                      sx={dockButtonSx(cameraPreset === "studio")}
                    >
                      3D Room
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleCameraSwitch("seat")}
                      startIcon={<Weekend sx={{ fontSize: "0.85rem !important" }} />}
                      sx={dockButtonSx(cameraPreset === "seat")}
                    >
                      Seat POV
                    </Button>
                    <Button
                      size="small"
                      onClick={() => handleCameraSwitch("top")}
                      startIcon={<VerticalAlignTop sx={{ fontSize: "0.85rem !important" }} />}
                      sx={dockButtonSx(cameraPreset === "top")}
                    >
                      Top View
                    </Button>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                  <Button
                    size="small"
                    onClick={() => setSoundCones(v => !v)}
                    startIcon={<GraphicEq sx={{ fontSize: "0.85rem !important" }} />}
                    sx={dockButtonSx(soundCones)}
                  >
                    Sound Cones
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setShowDimensions(v => !v)}
                    startIcon={<Straighten sx={{ fontSize: "0.85rem !important" }} />}
                    sx={dockButtonSx(showDimensions)}
                  >
                    Dimensions
                  </Button>
                  <Tooltip title="Reset 3D camera & selection">
                    <Button
                      size="small"
                      aria-label="Reset 3D camera"
                      onClick={handleResetView}
                      sx={{ ...dockButtonSx(false), px: 1 }}
                    >
                      <RestartAlt sx={{ fontSize: "0.95rem" }} />
                    </Button>
                  </Tooltip>
                </Box>
              </>
            ) : (
              <>
                <Button
                  size="small"
                  onClick={() => setViewMode("isometric")}
                  startIcon={<ViewInAr sx={{ fontSize: "0.85rem !important" }} />}
                  sx={dockButtonSx(true)}
                >
                  Back to 3D Room
                </Button>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}>
                  <Button
                    size="small"
                    onClick={() => setSoundCones(v => !v)}
                    startIcon={<GraphicEq sx={{ fontSize: "0.85rem !important" }} />}
                    sx={dockButtonSx(soundCones)}
                  >
                    Sound Cones
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setShowDimensions(v => !v)}
                    startIcon={<Straighten sx={{ fontSize: "0.85rem !important" }} />}
                    sx={dockButtonSx(showDimensions)}
                  >
                    Dimensions
                  </Button>
                </Box>
              </>
            )}
          </Box>

          {/* Blueprint Footer: Live Selected Transducer Card OR Role Filter Legend */}
          <Box sx={{ pt: 1.25, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <AnimatePresence mode="wait">
              {focusedSpeaker ? (
                <Box
                  key={focusedSpeaker.id}
                  component={motion.div}
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    alignItems: { xs: "flex-start", sm: "center" },
                    justifyContent: "space-between",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Typography sx={{ ...TYPE.label, color: "#F3D59B", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em" }}>
                        {focusedSpeaker.code} · {focusedSpeaker.name}
                      </Typography>
                      <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.48)", fontSize: "0.62rem" }}>
                        [{focusedSpeaker.angle}]
                      </Typography>
                    </Box>
                    <Typography sx={{ ...TYPE.placard, color: "rgba(255,255,255,0.82)", fontSize: "0.78rem", mt: 0.25 }}>
                      {focusedSpeaker.detail}
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    {focusedNode && (
                      <Box>
                        <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.45)", fontSize: "0.56rem", textTransform: "uppercase" }}>
                          From Sweet Spot
                        </Typography>
                        <Typography sx={{ fontFamily: FONT.display, color: "#FFFFFF", fontSize: "0.78rem", fontWeight: 600 }}>
                          {focusedNode.distanceM} m · {focusedNode.delayMs} ms
                        </Typography>
                      </Box>
                    )}
                    <Button
                      size="small"
                      aria-label="Clear speaker selection"
                      onClick={() => {
                        setSelectedSpeakerId(null);
                        setHoveredSpeakerId(null);
                      }}
                      sx={{ minWidth: 32, minHeight: 32, p: 0.5, color: "rgba(255,255,255,0.6)" }}
                    >
                      <Close sx={{ fontSize: "0.95rem" }} />
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.25 }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
                    {Object.entries(ROLE_COLORS).map(([key, val]) => {
                      const active = highlightRole === key;
                      return (
                        <Button
                          key={key}
                          size="small"
                          onClick={() => setHighlightRole(active ? null : key)}
                          onMouseEnter={() => setHighlightRole(key)}
                          onMouseLeave={() => setHighlightRole(prev => (prev === key ? null : prev))}
                          sx={{
                            ...TYPE.label,
                            minWidth: "auto",
                            minHeight: 30,
                            px: 0.85,
                            py: 0.25,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 0.65,
                            borderRadius: "3px",
                            bgcolor: active ? "rgba(255,255,255,0.1)" : "transparent",
                            color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
                            fontSize: "0.62rem",
                          }}
                        >
                          <Box sx={{ width: 8, height: 8, borderRadius: key === "height" ? "50%" : "2px", bgcolor: val.fill, border: `1px solid ${val.stroke}` }} />
                          {val.text}
                        </Button>
                      );
                    })}
                  </Box>

                  <Typography sx={{ ...TYPE.label, color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>
                    Tap a transducer or group to trace sightlines to seats
                  </Typography>
                </Box>
              )}
            </AnimatePresence>
          </Box>
        </Box>

        {/* Right Column: Buyer-Friendly Outcomes + Interactive Array + Progressive Tech Specs */}
        <Box
          sx={{
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            p: { xs: 2.5, sm: 3.25, md: 3.75 },
            bgcolor: "rgba(246,244,238,0.82)",
            border: `1px solid ${STUDIO.hairStrong}`,
            borderRadius: "6px",
          }}
        >
          <Box>
            {/* Package Badge & Channel Description */}
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
              <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}>
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
                    bgcolor: "rgba(156,123,73,0.09)",
                    border: "1px solid rgba(156,123,73,0.22)",
                  }}
                >
                  {isRecommendedMatch ? "Recommended For Your Room" : config.tag}
                </Typography>
              </Box>
              <Typography sx={{ ...TYPE.label, color: STUDIO.slate, fontSize: "0.66rem" }}>
                {config.channels}
              </Typography>
            </Box>

            <Typography component="h4" sx={{ ...TYPE.exhibit, fontSize: { xs: "1.45rem", md: "1.75rem" }, color: STUDIO.graphite, mb: 1.5 }}>
              {config.label}
            </Typography>

            {/* 3 Clear Customer Outcomes: Screen, Seating, Projector Throw */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 1.15,
                mb: 2.25,
              }}
            >
              <Box sx={{ p: 1.25, bgcolor: "rgba(255,255,255,0.65)", border: `1px solid ${STUDIO.hair}`, borderRadius: "4px" }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.58rem", textTransform: "uppercase" }}>
                  Ideal Screen
                </Typography>
                <Typography sx={{ fontFamily: FONT.display, fontWeight: 700, fontSize: "1.05rem", color: STUDIO.graphite, mt: 0.25 }}>
                  {recommendation.recommendedScreenIn}″ 4K
                </Typography>
                <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.7rem" }}>
                  {recommendation.viewingAngleDeg}° FoV
                </Typography>
              </Box>

              <Box sx={{ p: 1.25, bgcolor: "rgba(255,255,255,0.65)", border: `1px solid ${STUDIO.hair}`, borderRadius: "4px" }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.58rem", textTransform: "uppercase" }}>
                  Seating
                </Typography>
                <Typography sx={{ fontFamily: FONT.display, fontWeight: 700, fontSize: "1.05rem", color: STUDIO.graphite, mt: 0.25 }}>
                  {recommendation.totalSeats} Seats
                </Typography>
                <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.7rem" }}>
                  {recommendation.effectiveRows === 2 ? "2 Tiered Rows" : "1 Prime Row"}
                </Typography>
              </Box>

              <Box sx={{ p: 1.25, bgcolor: "rgba(255,255,255,0.65)", border: `1px solid ${STUDIO.hair}`, borderRadius: "4px" }}>
                <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.58rem", textTransform: "uppercase" }}>
                  4K Throw
                </Typography>
                <Typography sx={{ fontFamily: FONT.display, fontWeight: 700, fontSize: "1.05rem", color: STUDIO.brass, mt: 0.25 }}>
                  {recommendation.throwDistFt} ft
                </Typography>
                <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.7rem" }}>
                  {recommendation.areaSqFt} sq ft
                </Typography>
              </Box>
            </Box>

            {/* Buyer-First Room Explanation */}
            <Typography sx={{ ...TYPE.placard, color: STUDIO.graphite, fontSize: "0.92rem", lineHeight: 1.55, mb: 0.85 }}>
              {config.summary}
            </Typography>
            <Typography sx={{ ...TYPE.placard, color: STUDIO.brass, fontSize: "0.84rem", lineHeight: 1.5, mb: 2.25 }}>
              {recommendation.fitNote}
            </Typography>

            {/* Interactive Speaker Placement Cards (Tap or Hover to Highlight Rays) */}
            <Box sx={{ borderTop: `1px solid ${STUDIO.hair}`, pt: 2, mb: 2 }}>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", mb: 1.25 }}>
                Where Speakers Go (Tap or Hover Group)
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.1 }}>
                {config.inventory.map(item => {
                  const isRoleHovered = highlightRole === item.role;
                  return (
                    <Box
                      key={item.label}
                      onClick={() => setHighlightRole(isRoleHovered ? null : item.role)}
                      onMouseEnter={() => setHighlightRole(item.role)}
                      onMouseLeave={() => setHighlightRole(prev => (prev === item.role ? null : prev))}
                      sx={{
                        p: 1.2,
                        bgcolor: isRoleHovered ? "rgba(156,123,73,0.12)" : "rgba(255,255,255,0.6)",
                        border: `1px solid ${isRoleHovered ? STUDIO.brass : STUDIO.hair}`,
                        borderRadius: "4px",
                        cursor: "pointer",
                        transition: `all 180ms ${EASE}`,
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                        <Typography sx={{ ...TYPE.label, color: STUDIO.graphite, fontSize: "0.72rem", fontWeight: 600 }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.62rem", flexShrink: 0 }}>
                          {item.count}
                        </Typography>
                      </Box>
                      <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.74rem", mt: 0.3, lineHeight: 1.35 }}>
                        {item.detail}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Progressive Disclosure: Optional Technical & Acoustic Engineering Drawer */}
            <Box sx={{ borderTop: `1px solid ${STUDIO.hair}`, pt: 1.25 }}>
              <Button
                fullWidth
                size="small"
                onClick={() => setTechSpecsOpen(o => !o)}
                endIcon={
                  <ExpandMore
                    sx={{
                      transform: techSpecsOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: `transform 220ms ${EASE}`,
                    }}
                  />
                }
                sx={{
                  ...TYPE.label,
                  justifyContent: "space-between",
                  color: STUDIO.slate,
                  fontSize: "0.66rem",
                  py: 0.75,
                  minHeight: 36,
                  px: 0.5,
                  "&:hover": { bgcolor: "rgba(22,24,26,0.03)", color: STUDIO.graphite },
                }}
              >
                View technical &amp; acoustic engineering specs
              </Button>

              <Collapse in={techSpecsOpen} timeout={reduced ? 0 : 240}>
                <Box sx={{ pt: 1.25, pb: 0.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.75 }}>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.58rem", textTransform: "uppercase" }}>
                      Harman Room Curve (20 Hz – 20 kHz)
                    </Typography>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.brass, fontSize: "0.58rem" }}>
                      Dirac Live FIR · {recommendation.volumeCuFt.toLocaleString()} cu ft
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 0.5,
                      height: 32,
                      p: 0.6,
                      bgcolor: "rgba(22,24,26,0.03)",
                      border: `1px solid ${STUDIO.hair}`,
                      borderRadius: "3px",
                      mb: 1.5,
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
                        }}
                      />
                    ))}
                  </Box>

                  <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.58rem", textTransform: "uppercase", mb: 0.3 }}>
                    Reference Electronics ({ALL_SPEAKERS.C.crossover})
                  </Typography>
                  <Typography sx={{ fontFamily: FONT.text, fontSize: "0.88rem", color: STUDIO.graphite, fontWeight: 500, lineHeight: 1.4 }}>
                    {config.amplification}
                  </Typography>
                </Box>
              </Collapse>
            </Box>
          </Box>

          {/* Bottom Pricing Guidance + Handoff CTA to #visit */}
          <Box
            sx={{
              mt: 3,
              pt: 2.25,
              borderTop: `1px solid ${STUDIO.hairStrong}`,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box>
              <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.6rem", textTransform: "uppercase" }}>
                Turnkey Room Guide From
              </Typography>
              <Typography sx={{ fontFamily: FONT.display, fontSize: "1.3rem", fontWeight: 700, color: STUDIO.graphite }}>
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
                px: 2.5,
                py: 1.25,
                minHeight: 44,
                borderRadius: "2px",
                letterSpacing: "0.04em",
                transition: `transform 200ms ${EASE}, background-color 200ms ${EASE}`,
                "&:hover": { bgcolor: STUDIO.ink, transform: "translateY(-1px)" },
                "&:active": { transform: "scale(0.98)" },
              }}
            >
              Plan this {config.id} room
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
