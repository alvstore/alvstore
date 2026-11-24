"use client";

import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { AnimatedPage } from "@/components/mui";
import { StudioHeader } from "@/components/studio/StudioHeader";
import { ExhibitsStage } from "@/components/studio/ExhibitsStage";
import { CollectionSection } from "@/components/studio/CollectionSection";
import { ProcessSection } from "@/components/studio/ProcessSection";
import { VisitSection } from "@/components/studio/VisitSection";
import { StudioFooter } from "@/components/studio/StudioFooter";
import { EASE, STUDIO, TYPE, FONT } from "@/components/studio/tokens";

const BRANDS = [
  { name: "Denon", badge: "DEN", role: "AV Receivers & Multi-Room Audio", tag: "Spatial AVR" },
  { name: "Marantz", badge: "MAR", role: "Reference Cinema Separates", tag: "Reference Audio" },
  { name: "JBL", badge: "JBL", role: "High-SPL Architectural Speakers", tag: "Cinema Sound" },
  { name: "JBL Synthesis", badge: "SYN", role: "Master Reference Theatre Systems", tag: "Synthesis Lab" },
  { name: "Arcam", badge: "ARC", role: "Audiophile Class G Amplification", tag: "Class G Power" },
  { name: "Polk Audio", badge: "POLK", role: "Dynamic Balance Cinema Sound", tag: "Dynamic Audio" },
  { name: "Bowers & Wilkins", badge: "B&W", role: "Reference Studio Loudspeakers", tag: "Studio Reference" },
  { name: "KEF", badge: "KEF", role: "Uni-Q Architectural Audio", tag: "Uni-Q Array" },
  { name: "Sony", badge: "SONY", role: "Native 4K SXRD Laser Cinema", tag: "Laser 4K" },
  { name: "JVC", badge: "JVC", role: "D-ILA Laser Optical Engines", tag: "D-ILA Optics" },
] as const;

const containerMotion = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const itemMotion = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

/**
 * The public studio: a scroll-driven gallery of the pieces ALV builds
 * rooms around, then the collection, after-sales service and the consultation.
 */
export default function AlvStudioHome() {
  return (
    <AnimatedPage sx={{ bgcolor: STUDIO.plaster }}>
      <Box data-static-speaker-evolution>
        <StudioHeader overStage />
        <Box component="main">
          <ExhibitsStage />

          {/* Animated Studio Statement Section */}
          <Box
            component="section"
            aria-label="Studio statement"
            sx={{
              bgcolor: STUDIO.plaster,
              borderTop: `1px solid ${STUDIO.hairStrong}`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <Box
              component={motion.div}
              variants={containerMotion}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              sx={{
                mx: "auto",
                maxWidth: 1520,
                px: { xs: 2.5, sm: 4, lg: 6 },
                py: { xs: 8, md: 12 },
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 2.4fr" },
                gap: { xs: 4, md: 8 },
              }}
            >
              {/* Left Column: Heritage & Metrics */}
              <Box component={motion.div} variants={itemMotion} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                  <Box
                    component="span"
                    sx={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      bgcolor: STUDIO.brass,
                      boxShadow: `0 0 0 3px rgba(156,123,73,0.22)`,
                    }}
                  />
                  <Typography sx={{ ...TYPE.label, color: STUDIO.brass, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: "0.68rem" }}>
                    Established 2009
                  </Typography>
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "1fr" }, gap: { xs: 2.5, md: 3 }, pt: { md: 1 } }}>
                  <Box>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Experience
                    </Typography>
                    <Typography sx={{ fontFamily: FONT.display, fontSize: "1.4rem", fontWeight: 600, color: STUDIO.graphite, lineHeight: 1.2, mt: 0.4 }}>
                      16+ Years
                    </Typography>
                    <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.82rem", mt: 0.2 }}>
                      Cinema engineering &amp; acoustic design
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Reach
                    </Typography>
                    <Typography sx={{ fontFamily: FONT.display, fontSize: "1.4rem", fontWeight: 600, color: STUDIO.graphite, lineHeight: 1.2, mt: 0.4 }}>
                      Pan-India
                    </Typography>
                    <Typography sx={{ ...TYPE.placard, color: STUDIO.slate, fontSize: "0.82rem", mt: 0.2 }}>
                      On-site surveys, engineering &amp; acoustic calibration nationwide
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Right Column: Statement & Brand Ecosystem */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Box component={motion.div} variants={itemMotion}>
                  <Typography
                    sx={{
                      fontFamily: FONT.text,
                      fontSize: { xs: "1.35rem", sm: "1.65rem", md: "2.05rem" },
                      lineHeight: 1.38,
                      fontWeight: 400,
                      color: STUDIO.graphite,
                      letterSpacing: "-0.01em",
                      textWrap: "balance",
                    }}
                  >
                    <Box component="strong" sx={{ fontWeight: 600, color: STUDIO.graphite }}>
                      We design
                    </Box>
                    , engineer and install bespoke private cinemas and reference home theaters.
                    Every system brings together native 4K laser projection, immersive spatial acoustics, and
                    reference Denon &amp; Marantz amplification.
                  </Typography>
                </Box>

                <Box
                  component={motion.div}
                  variants={itemMotion}
                  sx={{
                    pt: 3.5,
                    borderTop: `1px solid ${STUDIO.hairStrong}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2.5,
                  }}
                >
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.slate, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Authorised Cinema Partners
                    </Typography>
                    <Typography sx={{ ...TYPE.label, color: STUDIO.mist, fontSize: "0.62rem" }}>
                      Official Indian distribution &amp; direct warranty
                    </Typography>
                  </Box>

                  {/* Brand Cards Grid: 10 partners with unified monogram emblem badges */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
                      gap: 1.5,
                    }}
                  >
                    {BRANDS.map(brand => (
                      <Box
                        key={brand.name}
                        component={motion.div}
                        variants={itemMotion}
                        sx={{
                          p: { xs: 1.75, sm: 2 },
                          bgcolor: "rgba(246,244,238,0.72)",
                          border: `1px solid ${STUDIO.hair}`,
                          borderRadius: "3px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          minHeight: { xs: 140, sm: 148 },
                          position: "relative",
                          transition: `transform 240ms ${EASE}, border-color 240ms ${EASE}, background-color 240ms ${EASE}, box-shadow 240ms ${EASE}`,
                          cursor: "default",
                          "&:hover": {
                            transform: "translateY(-3px)",
                            borderColor: STUDIO.brass,
                            bgcolor: STUDIO.chalk,
                            boxShadow: "0 8px 24px rgba(156,123,73,0.12)",
                            "& [data-brand-badge]": {
                              borderColor: STUDIO.brass,
                              bgcolor: "rgba(156,123,73,0.15)",
                              color: STUDIO.brass,
                              boxShadow: "0 0 12px rgba(156,123,73,0.25)",
                            },
                            "& h4": { color: STUDIO.brass },
                          },
                        }}
                      >
                        {/* Top: Uniform Pattern Emblem Badge + Tag */}
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
                          <Box
                            data-brand-badge="true"
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              border: `1px solid ${STUDIO.hairStrong}`,
                              bgcolor: "rgba(156,123,73,0.06)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: `all 220ms ${EASE}`,
                              flexShrink: 0,
                            }}
                          >
                            <Typography
                              sx={{
                                fontFamily: FONT.display,
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                color: STUDIO.graphite,
                                lineHeight: 1,
                              }}
                            >
                              {brand.badge}
                            </Typography>
                          </Box>
                          <Typography
                            sx={{
                              ...TYPE.label,
                              fontSize: "0.55rem",
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: STUDIO.brass,
                              px: 0.7,
                              py: 0.2,
                              borderRadius: "2px",
                              bgcolor: "rgba(156,123,73,0.08)",
                              lineHeight: 1.2,
                            }}
                          >
                            {brand.tag}
                          </Typography>
                        </Box>

                        {/* Bottom: Brand Name & Specialty */}
                        <Box sx={{ mt: "auto" }}>
                          <Typography
                            component="h4"
                            sx={{
                              fontFamily: FONT.display,
                              fontSize: { xs: "0.95rem", sm: "1.02rem" },
                              fontWeight: 600,
                              color: STUDIO.graphite,
                              transition: `color 200ms ${EASE}`,
                              m: 0,
                              lineHeight: 1.2,
                            }}
                          >
                            {brand.name}
                          </Typography>
                          <Typography
                            sx={{
                              ...TYPE.placard,
                              color: STUDIO.slate,
                              fontSize: "0.72rem",
                              mt: 0.4,
                              lineHeight: 1.3,
                            }}
                          >
                            {brand.role}
                          </Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  <Typography
                    sx={{
                      ...TYPE.placard,
                      color: STUDIO.slate,
                      fontSize: "0.85rem",
                      mt: 1,
                      lineHeight: 1.5,
                    }}
                  >
                    Flagship engineering lab · Turnkey pan-India installation · Lifetime after-sales care on every room.
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>

          <CollectionSection />
          <ProcessSection />
          <VisitSection />
        </Box>
        <StudioFooter />
      </Box>
    </AnimatedPage>
  );
}
