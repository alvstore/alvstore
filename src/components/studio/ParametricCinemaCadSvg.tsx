"use client";

import { Box } from "@mui/material";
import {
  ROLE_COLORS,
  type RoomLayout,
  type RoomRecommendation,
  type SpeakerMeta,
} from "./room-calculator";

export interface ParametricCinemaCadSvgProps {
  layout: RoomLayout;
  recommendation: RoomRecommendation;
  speakers: SpeakerMeta[];
  hoveredSpeakerId: string | null;
  highlightRole: string | null;
  sweetSpotHovered: boolean;
  soundCones: boolean;
  showDimensions: boolean;
  reducedMotion: boolean;
  onSelectSpeaker: (id: string | null) => void;
  onHoverSpeaker?: (id: string | null) => void;
  onHoverSweetSpot: (hovered: boolean) => void;
}

/**
 * Parametric top-down architectural CAD blueprint SVG synchronized with
 * the current room dimensions, screen diagonal, seating rows, and audio tier.
 */
export function ParametricCinemaCadSvg({
  layout,
  recommendation,
  speakers,
  hoveredSpeakerId,
  highlightRole,
  sweetSpotHovered,
  soundCones,
  showDimensions,
  reducedMotion,
  onSelectSpeaker,
  onHoverSpeaker,
  onHoverSweetSpot,
}: ParametricCinemaCadSvgProps) {
  const { cadRoomRect: r, cadScreenSpan: scr, cadRiserY, seats, speakers: nodeMap } = layout;
  const row0Seat = seats.find(s => s.rowIndex === 0);
  const sweetSpotX = 60;
  const sweetSpotY = row0Seat ? row0Seat.cadY : r.y + r.h * 0.62;
  const projectorY = r.y + r.h - 3.2;

  const slatCount = Math.max(5, Math.floor(r.h / 11));
  const seatWidthCad = Math.max(4.4, Math.min(6.4, (r.w - 14) / Math.max(2, recommendation.seatsPerRow) - 1.8));
  const seatHeightCad = Math.max(4.2, Math.min(5.6, seatWidthCad * 0.92));

  return (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 120 120"
        aria-label={`Parametric 2D blueprint for ${recommendation.widthFt} by ${recommendation.lengthFt} ft room`}
        style={{
          width: "100%",
          height: "100%",
          maxHeight: "100%",
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id="cadScreenGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9C7B49" stopOpacity="0.88" />
            <stop offset="50%" stopColor="#F5D79F" stopOpacity="1" />
            <stop offset="100%" stopColor="#9C7B49" stopOpacity="0.88" />
          </linearGradient>

          <linearGradient id="cadThrowBeam" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(243,213,155,0.2)" />
            <stop offset="55%" stopColor="rgba(243,213,155,0.06)" />
            <stop offset="100%" stopColor="rgba(243,213,155,0.015)" />
          </linearGradient>

          <radialGradient id="cadSubWave" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(226,186,122,0.35)" />
            <stop offset="50%" stopColor="rgba(226,186,122,0.12)" />
            <stop offset="100%" stopColor="rgba(226,186,122,0)" />
          </radialGradient>

          <radialGradient id="cadAtmosShower" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(243,213,155,0.42)" />
            <stop offset="60%" stopColor="rgba(184,142,82,0.14)" />
            <stop offset="100%" stopColor="rgba(184,142,82,0)" />
          </radialGradient>
        </defs>

        {/* Scaled Architectural Room Shell */}
        <rect
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx="2.2"
          fill="#1B1D20"
          stroke="rgba(226,186,122,0.45)"
          strokeWidth="0.7"
        />

        {/* Inner Acoustic Carpet Field */}
        <rect
          x={r.x + 2.8}
          y={r.y + 4.5}
          width={Math.max(8, r.w - 5.6)}
          height={Math.max(10, r.h - 7.5)}
          rx="1.2"
          fill="#242220"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="0.35"
        />

        {/* Front Slate Acoustic Baffle Wall */}
        <rect
          x={r.x + 0.5}
          y={r.y + 0.5}
          width={Math.max(6, r.w - 1)}
          height="3.2"
          rx="0.6"
          fill="#111315"
        />

        {/* Side Walnut Slat Diffusers */}
        {Array.from({ length: slatCount }).map((_, idx) => {
          const yPos = r.y + 6.5 + ((r.h - 13) * idx) / Math.max(1, slatCount - 1);
          return (
            <g key={`slat-${idx}`}>
              <rect x={r.x + 0.8} y={yPos} width="1.4" height="4.2" rx="0.4" fill="#7A5236" opacity="0.85" />
              <rect x={r.x + r.w - 2.2} y={yPos} width="1.4" height="4.2" rx="0.4" fill="#7A5236" opacity="0.85" />
            </g>
          );
        })}

        {/* Tiered Rear Riser Deck Outline (Row 2) */}
        {cadRiserY !== null && (
          <g>
            <rect
              x={r.x + 3.4}
              y={cadRiserY}
              width={Math.max(6, r.w - 6.8)}
              height={Math.max(4, r.y + r.h - 2.2 - cadRiserY)}
              rx="1"
              fill="rgba(156,123,73,0.12)"
              stroke="rgba(226,186,122,0.35)"
              strokeWidth="0.4"
            />
            <line
              x1={r.x + 3.6}
              y1={cadRiserY}
              x2={r.x + r.w - 3.6}
              y2={cadRiserY}
              stroke="#E2BA7A"
              strokeWidth="0.55"
              opacity="0.7"
            />
          </g>
        )}

        {/* 4K Laser Projector Throw Cone */}
        <polygon
          points={`60,${projectorY} ${scr.x1},${scr.y} ${scr.x2},${scr.y}`}
          fill="url(#cadThrowBeam)"
          opacity={soundCones ? 0.9 : 0.45}
        />

        {/* Rear Wall 4K Projector Lens */}
        <g transform={`translate(60, ${projectorY})`}>
          <rect x="-2.8" y="-1.4" width="5.6" height="2.8" rx="0.6" fill="#2A2E33" stroke="#E2BA7A" strokeWidth="0.45" />
          <circle cx="0" cy="-0.2" r="0.9" fill="#E2BA7A" />
        </g>

        {/* Scaled Front 4K Projection Screen */}
        <g>
          <rect
            x={scr.x1}
            y={scr.y - 1.2}
            width={Math.max(8, scr.x2 - scr.x1)}
            height="2.1"
            rx="0.4"
            fill="url(#cadScreenGrad)"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth="0.35"
          />
          <text
            x="60"
            y={r.y - 0.8}
            textAnchor="middle"
            fill="#F3D59B"
            fontSize="2.2"
            fontFamily="sans-serif"
            fontWeight="700"
            letterSpacing="0.2"
          >
            {recommendation.recommendedScreenIn}″ 4K WIDESCREEN ({recommendation.viewingAngleDeg}° FOV)
          </text>
        </g>

        {/* Dynamic Theater Seating Grid */}
        {seats.map((seat, idx) => (
          <g
            key={`seat-${idx}`}
            transform={`translate(${seat.cadX}, ${seat.cadY})`}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => onHoverSweetSpot(true)}
            onMouseLeave={() => onHoverSweetSpot(false)}
          >
            <rect
              x={-seatWidthCad / 2}
              y={-seatHeightCad / 2}
              width={seatWidthCad}
              height={seatHeightCad}
              rx="0.9"
              fill="#3F3630"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="0.38"
            />
            <rect
              x={-seatWidthCad * 0.36}
              y={seatHeightCad * 0.16}
              width={seatWidthCad * 0.72}
              height={seatHeightCad * 0.28}
              rx="0.5"
              fill="#C69F64"
            />
          </g>
        ))}

        {/* Acoustic Sweet Spot Calibration Halo on Primary Seat */}
        <g
          transform={`translate(${sweetSpotX}, ${sweetSpotY})`}
          style={{ cursor: "pointer" }}
          onMouseEnter={() => onHoverSweetSpot(true)}
          onMouseLeave={() => onHoverSweetSpot(false)}
        >
          <circle
            r={Math.min(9.5, r.w * 0.16)}
            fill="none"
            stroke="rgba(226,186,122,0.28)"
            strokeWidth="0.45"
            strokeDasharray="1.4 1.4"
          />
          <circle
            r={Math.min(5.2, r.w * 0.09)}
            fill="none"
            stroke={sweetSpotHovered ? "#F5D79F" : "rgba(226,186,122,0.5)"}
            strokeWidth="0.55"
          />
          <text
            x="0"
            y={seatHeightCad / 2 + 3.2}
            textAnchor="middle"
            fill="#F3D59B"
            fontSize="1.9"
            fontWeight="600"
            fontFamily="sans-serif"
          >
            SWEET SPOT
          </text>
        </g>

        {/* Directional Soundwave Ripples */}
        {soundCones && (
          <g opacity={reducedMotion ? 0.4 : 0.8}>
            {speakers.map((sp, idx) => {
              const node = nodeMap[sp.id];
              if (!node) return null;
              const isSub = sp.role === "subwoofer";
              const isHeight = sp.role === "height";
              return (
                <circle
                  key={`cad-wave-${sp.id}`}
                  cx={node.cadX}
                  cy={node.cadY}
                  r={isSub ? "5" : isHeight ? "3.4" : "3.8"}
                  fill={isSub ? "url(#cadSubWave)" : isHeight ? "url(#cadAtmosShower)" : "none"}
                  stroke={
                    isSub ? "rgba(226,186,122,0.5)" : isHeight ? "rgba(243,213,155,0.52)" : "rgba(184,142,82,0.42)"
                  }
                  strokeWidth="0.4"
                >
                  {!reducedMotion && (
                    <>
                      <animate
                        attributeName="r"
                        values={isSub ? "2.5;11;17" : "1.8;7;12"}
                        dur={isSub ? "2.4s" : "1.9s"}
                        begin={`${idx * 0.16}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        values="0.8;0.3;0"
                        dur={isSub ? "2.4s" : "1.9s"}
                        begin={`${idx * 0.16}s`}
                        repeatCount="indefinite"
                      />
                    </>
                  )}
                </circle>
              );
            })}
          </g>
        )}

        {/* Interactive Laser Sightlines to Primary Sweet Spot */}
        {speakers.map(sp => {
          const node = nodeMap[sp.id];
          if (!node) return null;
          const isHovered = hoveredSpeakerId === sp.id;
          const isRoleMatch = highlightRole === sp.role;
          if (!isHovered && !isRoleMatch && !sweetSpotHovered) return null;

          return (
            <g key={`cad-ray-${sp.id}`}>
              <line
                x1={node.cadX}
                y1={node.cadY}
                x2={sweetSpotX}
                y2={sweetSpotY}
                stroke="#F3D59B"
                strokeWidth={isHovered ? "0.8" : "0.55"}
                strokeDasharray="1.8 1.2"
                opacity={isHovered ? 1 : 0.65}
              />
              {!reducedMotion && (
                <circle r="0.95" fill="#FFFFFF">
                  <animateMotion
                    path={`M ${node.cadX} ${node.cadY} L ${sweetSpotX} ${sweetSpotY}`}
                    dur="1.3s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          );
        })}

        {/* Parametric Architectural Dimension Callouts */}
        {showDimensions && (
          <g>
            {/* Room Width Measure along bottom exterior */}
            <line
              x1={r.x}
              y1={r.y + r.h + 3.6}
              x2={r.x + r.w}
              y2={r.y + r.h + 3.6}
              stroke="#D9B272"
              strokeWidth="0.45"
            />
            <line x1={r.x} y1={r.y + r.h + 2.2} x2={r.x} y2={r.y + r.h + 5} stroke="#D9B272" strokeWidth="0.45" />
            <line
              x1={r.x + r.w}
              y1={r.y + r.h + 2.2}
              x2={r.x + r.w}
              y2={r.y + r.h + 5}
              stroke="#D9B272"
              strokeWidth="0.45"
            />
            <rect x="49" y={r.y + r.h + 1.6} width="22" height="4" rx="1" fill="#131517" />
            <text
              x="60"
              y={r.y + r.h + 4.3}
              textAnchor="middle"
              fill="#F3D59B"
              fontSize="2.2"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              WIDTH {recommendation.widthFt} FT
            </text>

            {/* Room Length Measure along right exterior */}
            <line
              x1={r.x + r.w + 3.8}
              y1={r.y}
              x2={r.x + r.w + 3.8}
              y2={r.y + r.h}
              stroke="#D9B272"
              strokeWidth="0.45"
            />
            <line
              x1={r.x + r.w + 2.4}
              y1={r.y}
              x2={r.x + r.w + 5.2}
              y2={r.y}
              stroke="#D9B272"
              strokeWidth="0.45"
            />
            <line
              x1={r.x + r.w + 2.4}
              y1={r.y + r.h}
              x2={r.x + r.w + 5.2}
              y2={r.y + r.h}
              stroke="#D9B272"
              strokeWidth="0.45"
            />
            <rect
              x={r.x + r.w + 0.6}
              y="57.5"
              width="12.5"
              height="4.4"
              rx="1"
              fill="#131517"
            />
            <text
              x={r.x + r.w + 6.8}
              y="60.4"
              textAnchor="middle"
              fill="#F3D59B"
              fontSize="2.1"
              fontWeight="700"
              fontFamily="sans-serif"
            >
              {recommendation.lengthFt} FT
            </text>

            {/* Throw & Primary Viewing Distance Spine */}
            <line
              x1="60"
              y1={scr.y + 2}
              x2="60"
              y2={projectorY - 2}
              stroke="rgba(226,186,122,0.55)"
              strokeWidth="0.35"
              strokeDasharray="1.2 1.2"
            />
            <rect
              x={r.w < 32 ? 49 : 46}
              y={(scr.y + sweetSpotY) / 2 - 2.2}
              width={r.w < 32 ? 22 : 28}
              height="3.8"
              rx="1"
              fill="rgba(19,21,23,0.9)"
            />
            <text
              x="60"
              y={(scr.y + sweetSpotY) / 2 + 0.3}
              textAnchor="middle"
              fill="#EAE7DD"
              fontSize={r.w < 32 ? "1.65" : "1.85"}
              fontWeight="600"
              fontFamily="sans-serif"
            >
              {r.w < 32
                ? `${recommendation.throwDistFt} FT THROW`
                : `${recommendation.primarySeatDistFt} FT VIEWING · ${recommendation.throwDistFt} FT THROW`}
            </text>
          </g>
        )}

        {/* Transducer Nodes */}
        {speakers.map(sp => {
          const node = nodeMap[sp.id];
          if (!node) return null;
          const colors = ROLE_COLORS[sp.role];
          const isHovered = hoveredSpeakerId === sp.id;
          const isRoleMatch = highlightRole === sp.role;
          const isSub = sp.role === "subwoofer";
          const isHeight = sp.role === "height";
          const isCenter = sp.id === "C";

          return (
            <g
              key={`cad-sp-${sp.id}`}
              role="button"
              tabIndex={0}
              aria-label={`${sp.name} (${sp.code})`}
              style={{ cursor: "pointer", outline: "none" }}
              onClick={() => onSelectSpeaker(isHovered ? null : sp.id)}
              onMouseEnter={() => onHoverSpeaker?.(sp.id)}
              onMouseLeave={() => onHoverSpeaker?.(null)}
              onKeyDown={event => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectSpeaker(isHovered ? null : sp.id);
                }
              }}
            >
              {(isHovered || isRoleMatch) && (
                <circle
                  cx={node.cadX}
                  cy={node.cadY}
                  r={isSub ? "5.2" : "4.4"}
                  fill={colors.glow}
                  stroke="#F5D79F"
                  strokeWidth="0.55"
                />
              )}

              {isSub ? (
                <rect
                  x={node.cadX - 2.6}
                  y={node.cadY - 2.6}
                  width="5.2"
                  height="5.2"
                  rx="0.7"
                  fill={colors.fill}
                  stroke={isHovered ? "#F5D79F" : colors.stroke}
                  strokeWidth={isHovered ? "0.75" : "0.5"}
                />
              ) : isHeight ? (
                <circle
                  cx={node.cadX}
                  cy={node.cadY}
                  r="2.4"
                  fill={colors.fill}
                  stroke={isHovered ? "#FFFFFF" : colors.stroke}
                  strokeWidth={isHovered ? "0.75" : "0.5"}
                />
              ) : isCenter ? (
                <rect
                  x={node.cadX - 3.6}
                  y={node.cadY - 1.4}
                  width="7.2"
                  height="2.8"
                  rx="0.6"
                  fill={colors.fill}
                  stroke={isHovered ? "#F5D79F" : colors.stroke}
                  strokeWidth={isHovered ? "0.75" : "0.5"}
                />
              ) : (
                <rect
                  x={node.cadX - 2}
                  y={node.cadY - 2.4}
                  width="4"
                  height="4.8"
                  rx="0.6"
                  fill={colors.fill}
                  stroke={isHovered ? "#F5D79F" : colors.stroke}
                  strokeWidth={isHovered ? "0.75" : "0.5"}
                />
              )}

              <text
                x={node.cadX}
                y={node.cadY + 0.65}
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="1.65"
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
  );
}
