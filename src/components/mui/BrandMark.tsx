"use client";

import { useId } from "react";
import { Box, type SxProps, type Theme } from "@mui/material";

const ALV_SCULPTED_A =
  "M 152 196 C 152 138, 198 112, 284 112 C 372 112, 410 144, 410 206 L 410 348 H 430 V 384 H 348 V 353 C 318 378, 280 388, 230 388 C 168 388, 130 354, 130 304 C 130 252, 170 226, 248 221 L 348 215 L 348 200 C 348 175, 322 165, 282 165 C 242 165, 222 176, 216 196 Z M 194 300 C 194 280, 210 270, 248 268 L 348 263 L 348 296 C 348 322, 320 335, 260 335 C 214 335, 194 323, 194 300 Z";

/**
 * High-definition Obsidian Titanium Lens Crest derived from the official ALVStore emblem.
 */
export function BrandMark({
  size = 36,
  badgeColor,
  foregroundColor = "#FFFFFF",
  crescentColor,
  variant = "squircle",
  sx,
}: {
  size?: number;
  badgeColor?: string;
  foregroundColor?: string;
  crescentColor?: string;
  variant?: "squircle" | "circle";
  sx?: SxProps<Theme>;
}) {
  const gradId = `alv-bm-${useId().replace(/:/g, "")}`;
  const isDefaultObsidian = !badgeColor;
  const rx = variant === "circle" ? "256" : "122";

  return (
    <Box
      component="svg"
      viewBox="0 0 512 512"
      aria-hidden="true"
      sx={[
        {
          width: size,
          height: size,
          flexShrink: 0,
          display: "block",
          borderRadius: variant === "circle" ? "50%" : `${Math.round(size * 0.24)}px`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <defs>
        <radialGradient id={`${gradId}-bg`} cx="32%" cy="20%" r="86%">
          <stop offset="0%" stopColor="#27272A" />
          <stop offset="52%" stopColor="#111114" />
          <stop offset="100%" stopColor="#040406" />
        </radialGradient>
        <linearGradient id={`${gradId}-arc`} x1="60" y1="90" x2="290" y2="420" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={crescentColor || "#FFFFFF"} stopOpacity="0.88" />
          <stop offset="100%" stopColor={crescentColor || "#FFFFFF"} stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect
        x="8"
        y="8"
        width="496"
        height="496"
        rx={rx}
        fill={isDefaultObsidian ? `url(#${gradId}-bg)` : badgeColor}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="12"
      />
      <circle
        cx="242"
        cy="256"
        r="192"
        fill="none"
        stroke={`url(#${gradId}-arc)`}
        strokeWidth="18"
        strokeDasharray="550 720"
        strokeDashoffset="-172"
        strokeLinecap="round"
      />
      <path fillRule="evenodd" d={ALV_SCULPTED_A} fill={foregroundColor} />
      <circle cx="404" cy="108" r="10" fill={foregroundColor} opacity="0.9" />
    </Box>
  );
}
