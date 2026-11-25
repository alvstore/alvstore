"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useReducedMotion } from "framer-motion";
import {
  createCinemaRoomScene,
  type CameraPreset,
  type CinemaRoomHandle,
} from "./cinema-room-3d";
import type { RoomConfigId, RoomLayout } from "./room-calculator";
import { STUDIO, TYPE } from "./tokens";

export interface CinemaRoomCanvasProps {
  configId: RoomConfigId;
  layout: RoomLayout;
  lightsOn: boolean;
  cameraPreset: CameraPreset;
  soundCones: boolean;
  showDimensions: boolean;
  hoveredSpeakerId: string | null;
  highlightRole: string | null;
  isSweetSpotFocused: boolean;
  onSpeakerSelect?: (speakerId: string | null) => void;
  resetSignal?: number;
  paused?: boolean;
}

/** React wrapper managing lifecycle, visibility pausing, and fallback state for the WebGL cinema room. */
export function CinemaRoomCanvas({
  configId,
  layout,
  lightsOn,
  cameraPreset,
  soundCones,
  showDimensions,
  hoveredSpeakerId,
  highlightRole,
  isSweetSpotFocused,
  onSpeakerSelect,
  resetSignal = 0,
  paused = false,
}: CinemaRoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<CinemaRoomHandle | null>(null);
  const selectCallbackRef = useRef(onSpeakerSelect);
  selectCallbackRef.current = onSpeakerSelect;
  const reduced = useReducedMotion();
  const [webglFailed, setWebglFailed] = useState(false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handle = createCinemaRoomScene(canvas, {
      configId,
      layout,
      lightsOn,
      cameraPreset,
      soundCones,
      showDimensions,
      reducedMotion: !!reduced,
      onSpeakerSelect: id => selectCallbackRef.current?.(id),
    });

    if (!handle) {
      setWebglFailed(true);
      return;
    }

    handleRef.current = handle;

    const resizeObserver = new ResizeObserver(() => {
      handleRef.current?.resize();
    });
    resizeObserver.observe(canvas);

    const io = new IntersectionObserver(
      entries => {
        setInView(entries[0]?.isIntersecting ?? true);
      },
      { threshold: 0.02 },
    );
    io.observe(container);

    return () => {
      io.disconnect();
      resizeObserver.disconnect();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // Initialize WebGL context once on mount; subsequent updates stream through handle setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setPaused(paused || !inView);
  }, [paused, inView]);

  useEffect(() => {
    if (!paused) handleRef.current?.resize();
  }, [paused]);

  useEffect(() => {
    handleRef.current?.setConfig(configId);
  }, [configId]);

  useEffect(() => {
    handleRef.current?.setLayout(layout);
  }, [layout]);

  useEffect(() => {
    handleRef.current?.setLightsOn(lightsOn);
  }, [lightsOn]);

  useEffect(() => {
    handleRef.current?.setCameraPreset(cameraPreset);
  }, [cameraPreset]);

  useEffect(() => {
    handleRef.current?.setSoundCones(soundCones);
  }, [soundCones]);

  useEffect(() => {
    handleRef.current?.setShowDimensions(showDimensions);
  }, [showDimensions]);

  useEffect(() => {
    handleRef.current?.setHoveredSpeaker(hoveredSpeakerId);
  }, [hoveredSpeakerId]);

  useEffect(() => {
    handleRef.current?.setHighlightRole(highlightRole);
  }, [highlightRole]);

  useEffect(() => {
    handleRef.current?.setSweetSpotFocus(isSweetSpotFocused);
  }, [isSweetSpotFocused]);

  useEffect(() => {
    handleRef.current?.setReducedMotion(!!reduced);
  }, [reduced]);

  useEffect(() => {
    if (resetSignal > 0) {
      handleRef.current?.resetCamera();
    }
  }, [resetSignal]);

  return (
    <Box
      ref={containerRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: "4px",
      }}
    >
      {webglFailed ? (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            px: 3,
            bgcolor: "#1B1D20",
          }}
        >
          <Typography sx={{ ...TYPE.label, color: STUDIO.brass, mb: 0.75 }}>
            3D WebGL Preview Unavailable
          </Typography>
          <Typography sx={{ ...TYPE.placard, color: "rgba(255,255,255,0.7)", fontSize: "0.84rem", maxWidth: "36ch" }}>
            Your browser graphics context is currently unavailable. Switch to the Parametric 2D CAD Blueprint tab for full acoustic and seating layout controls.
          </Typography>
        </Box>
      ) : (
        <Box
          component="canvas"
          ref={canvasRef}
          aria-label="Interactive 3D private cinema room studio"
          sx={{
            display: "block",
            width: "100%",
            height: "100%",
            cursor: "grab",
            touchAction: "none",
            "&:active": {
              cursor: "grabbing",
            },
          }}
        />
      )}
    </Box>
  );
}
