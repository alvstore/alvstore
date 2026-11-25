"use client";

import { Box, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { SpatialRoomVisualizer } from "./SpatialRoomVisualizer";
import { STUDIO, TYPE, FONT } from "./tokens";

/**
 * Dedicated spatial cinema architectures section:
 * Interactive 5.1, 5.1.2, 7.2.2, and 7.2.4 room models with animated speaker
 * wave propagation, CAD blueprints, and acoustic specifications.
 */
export function CollectionSection() {
  const reduced = useReducedMotion();

  return (
    <Box component="section" id="collection" sx={{ bgcolor: STUDIO.chalk, scrollMarginTop: 44, position: "relative" }}>
      <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 9, md: 13 } }}>
        {/* Section Header with Staggered Scroll Motion */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" },
            gap: { xs: 3, md: 8 },
            alignItems: "end",
            mb: { xs: 4, md: 6 },
          }}
        >
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reduced ? 0 : 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 1.5 }}>
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
                Acoustic Engineering &amp; Layouts
              </Typography>
            </Box>
            <Typography component="h2" sx={{ ...TYPE.section, color: STUDIO.graphite, textWrap: "balance" }}>
              Cinema architectures,
              <Box component="span" sx={{ display: "block", fontFamily: FONT.text, fontStyle: "italic", fontWeight: 400, letterSpacing: "-0.01em", fontSize: "0.86em" }}>
                engineered to the room.
              </Box>
            </Typography>
          </Box>
          <Box
            component={motion.div}
            initial={reduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reduced ? 0 : 0.65, delay: reduced ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <Typography sx={{ ...TYPE.lead, color: STUDIO.slate, maxWidth: "52ch", justifySelf: { md: "end" } }}>
              Enter your room dimensions below to preview a sunlit architectural room or dim the lights into cinema mode — inspect screen size, step inside Seat POV, or review the synchronized 2D blueprint before booking a consultation.
            </Typography>
          </Box>
        </Box>

        {/* Enhanced Spatial Room Visualizer with 5.1, 5.1.2, 7.2.2, 7.2.4 Tabs */}
        <SpatialRoomVisualizer />
      </Box>
    </Box>
  );
}
