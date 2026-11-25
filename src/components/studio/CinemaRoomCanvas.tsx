"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { useReducedMotion } from "framer-motion";
import {
  createCinemaRoomScene,
  type CameraPreset,
  type CinemaRoomHandle,
} from "./cinema-room-3d";
import type { RoomConfigId, RoomLayout } from "./room-calculator";

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
}

/** React wrapper managing lifecycle and state synchronization for the WebGL cinema room scene. */
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
}: CinemaRoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<CinemaRoomHandle | null>(null);
  const selectCallbackRef = useRef(onSpeakerSelect);
  selectCallbackRef.current = onSpeakerSelect;
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    // Initialize WebGL context once on mount; subsequent updates stream through handle setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    </Box>
  );
}
