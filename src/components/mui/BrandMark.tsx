"use client";

import { Box, type SxProps, type Theme } from "@mui/material";

const ALV_A_PATH =
  "M 150 202 C 150 140, 198 110, 290 110 C 386 110, 428 144, 428 210 L 428 388 L 356 388 L 356 356 C 324 384, 282 396, 228 396 C 162 396, 124 360, 124 308 C 124 252, 166 226, 248 221 L 356 215 L 356 200 C 356 173, 328 162, 284 162 C 242 162, 220 174, 214 202 Z M 196 304 C 196 281, 212 271, 250 269 L 356 264 L 356 298 C 356 327, 326 342, 260 342 C 214 342, 196 329, 196 304 Z";

/**
 * Vector monogram emblem derived from the official ALVStore circular "a" mark.
 */
export function BrandMark({
  size = 36,
  badgeColor,
  foregroundColor = "#FFFFFF",
  crescentColor = "rgba(0, 0, 0, 0.22)",
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
  return (
    <Box
      component="svg"
      viewBox="0 0 512 512"
      aria-hidden="true"
      sx={[
        theme => ({
          width: size,
          height: size,
          flexShrink: 0,
          display: "block",
          borderRadius: variant === "circle" ? "50%" : `${Math.round(size * 0.24)}px`,
          color: badgeColor || theme.palette.primary.main,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <rect width="512" height="512" rx={variant === "circle" ? "256" : "124"} fill="currentColor" />
      <circle cx="242" cy="256" r="192" fill={crescentColor} />
      <path fillRule="evenodd" d={ALV_A_PATH} fill={foregroundColor} />
    </Box>
  );
}
