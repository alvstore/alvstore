"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useReducedMotion } from "framer-motion";
import { createCinemaRoomScene, type CinemaRoomHandle } from "./cinema-room-3d";
import type { RoomConfigId } from "./SpatialRoomVisualizer";

interface CinemaRoomCanvasProps {
  configId: RoomConfigId;
  isSimulating: boolean;
  hoveredSpeakerId: string | null;
  isSweetSpotFocused: boolean;
}

export function CinemaRoomCanvas({
  configId,
  isSimulating,
  hoveredSpeakerId,
  isSweetSpotFocused,
}: CinemaRoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<CinemaRoomHandle | null>(null);
  const reduced = useReducedMotion();

  // Initialize WebGL Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = createCinemaRoomScene(canvas, {
      configId,
      isSimulating,
      reducedMotion: !!reduced,
    });
    handleRef.current = handle;

    const resizeObserver = new ResizeObserver(() => {
      handleRef.current?.resize();
    });
    resizeObserver.observe(canvas);

    return () => {
      resizeObserver.disconnect();
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []); // Run on mount

  // Sync Configuration Updates
  useEffect(() => {
    handleRef.current?.setConfig(configId);
  }, [configId]);

  // Sync Simulation State
  useEffect(() => {
    handleRef.current?.setSimulating(isSimulating);
  }, [isSimulating]);

  // Sync Hovered Speaker
  useEffect(() => {
    handleRef.current?.setHoveredSpeaker(hoveredSpeakerId);
  }, [hoveredSpeakerId]);

  // Sync Sweet Spot Focus
  useEffect(() => {
    handleRef.current?.setSweetSpotFocus(isSweetSpotFocused);
  }, [isSweetSpotFocused]);

  // Sync Reduced Motion
  useEffect(() => {
    handleRef.current?.setReducedMotion(!!reduced);
  }, [reduced]);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: "4px",
      }}
    >
      <Box
        component="canvas"
        ref={canvasRef}
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
    </Box>
  );
}
