"use client";

import { Box, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { PROCESS, REPAIRS } from "./content";
import { EASE, STUDIO, TYPE, FONT } from "./tokens";

const STEP_TAGS = [
  "Survey & Acoustics",
  "CAD & Sightlines",
  "Turnkey Install",
] as const;

const STEP_DELIVERABLES = [
  "Dimensions, sound reflections & sightlines audit",
  "4K projector throw, speaker angles & isolation blueprint",
  "Turnkey installation & Dirac Live reference tuning",
] as const;

/**
 * The studio's method as an annotated architectural drawing:
 * Framer-motion driven timeline drawing, pulsating brass milestone nodes,
 * and interactive step cards with deliverable badges.
 */
export function ProcessSection() {
  const reduced = useReducedMotion();

  return (
    <Box component="section" sx={{ position: "relative", bgcolor: STUDIO.plaster, overflow: "hidden" }}>
      <Box sx={{ mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 9, md: 13 } }}>
        {/* Section Header with Staggered Motion */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 2fr" },
            gap: { xs: 3, md: 8 },
            alignItems: "end",
            mb: { xs: 6, md: 9 },
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
                How a room gets made
              </Typography>
            </Box>
            <Typography component="h2" sx={{ ...TYPE.section, color: STUDIO.graphite, textWrap: "balance" }}>
              Three steps,
              <Box
                component="span"
                sx={{
                  display: "block",
                  fontFamily: FONT.text,
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: "0.86em",
                  letterSpacing: "-0.01em",
                }}
              >
                in this order.
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
            <Typography sx={{ ...TYPE.lead, color: STUDIO.slate, maxWidth: "54ch", justifySelf: { md: "end" } }}>
              Most installers begin with a shopping list. We begin with the room: its dimensions,
              its windows, where you actually sit, and what it does to a voice before any equipment
              is switched on.
            </Typography>
          </Box>
        </Box>

        {/* Process Timeline Grid */}
        <Box sx={{ position: "relative" }}>
          {/* Animated Connecting Baseline on Desktop */}
          <Box
            aria-hidden="true"
            sx={{
              display: { xs: "none", md: "block" },
              position: "absolute",
              left: 16,
              right: 16,
              top: 16,
              height: "1px",
              bgcolor: STUDIO.hairStrong,
              zIndex: 0,
            }}
          />
          <Box
            aria-hidden="true"
            component={motion.div}
            initial={reduced ? false : { scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: reduced ? 0 : 1.4, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "left" }}
            sx={{
              display: { xs: "none", md: "block" },
              position: "absolute",
              left: 16,
              right: 16,
              top: 16,
              height: "2px",
              background: `linear-gradient(90deg, ${STUDIO.brass} 0%, rgba(156,123,73,0.7) 70%, ${STUDIO.hairStrong} 100%)`,
              zIndex: 1,
            }}
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: { xs: 4, md: 5 },
              position: "relative",
              zIndex: 2,
            }}
          >
            {PROCESS.map((step, i) => (
              <Box
                key={step.step}
                component={motion.div}
                initial={reduced ? false : { opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  delay: reduced ? 0 : 0.2 + i * 0.2,
                  duration: reduced ? 0 : 0.75,
                  ease: [0.16, 1, 0.3, 1],
                }}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Milestone Node on Timeline */}
                <Box
                  sx={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    height: 32,
                    mb: { xs: 1.5, md: 2.5 },
                  }}
                >
                  {/* Pulsing Ripple Halo */}
                  <Box
                    component={motion.div}
                    animate={
                      reduced
                        ? undefined
                        : {
                            scale: [1, 1.8, 1],
                            opacity: [0.55, 0, 0.55],
                          }
                    }
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      delay: i * 0.75,
                      ease: "easeInOut",
                    }}
                    sx={{
                      position: "absolute",
                      left: 2,
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      bgcolor: "rgba(156,123,73,0.24)",
                    }}
                  />
                  {/* Core Brass Milestone Bead */}
                  <Box
                    component={motion.div}
                    initial={reduced ? false : { scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{
                      delay: reduced ? 0 : 0.35 + i * 0.22,
                      type: "spring",
                      stiffness: 340,
                      damping: 22,
                    }}
                    sx={{
                      position: "relative",
                      left: 10,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      bgcolor: STUDIO.brass,
                      boxShadow: `0 0 0 3px ${STUDIO.plaster}, 0 0 10px rgba(156,123,73,0.5)`,
                      zIndex: 3,
                    }}
                  />
                </Box>

                {/* Step Card with Interactive Elevation & High-Taste Styling */}
                <Box
                  sx={{
                    p: { xs: 2.5, sm: 3, md: 3.5 },
                    bgcolor: "rgba(246,244,238,0.72)",
                    border: `1px solid ${STUDIO.hair}`,
                    borderRadius: "3px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    flexGrow: 1,
                    transition: `transform 260ms ${EASE}, border-color 260ms ${EASE}, background-color 260ms ${EASE}, box-shadow 260ms ${EASE}`,
                    cursor: "default",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: STUDIO.brass,
                      bgcolor: STUDIO.chalk,
                      boxShadow: "0 10px 30px rgba(156,123,73,0.12)",
                      "& [data-step-num]": {
                        color: STUDIO.brass,
                      },
                    },
                  }}
                >
                  <Box>
                    {/* Step Card Top: Numeral + Phase Pill */}
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1.5 }}>
                      <Typography
                        data-step-num="true"
                        sx={{
                          fontFamily: FONT.display,
                          fontSize: "1.8rem",
                          fontWeight: 700,
                          lineHeight: 1,
                          letterSpacing: "-0.02em",
                          color: "rgba(22,24,26,0.22)",
                          transition: `color 220ms ${EASE}`,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </Typography>
                      <Typography
                        sx={{
                          ...TYPE.label,
                          fontSize: "0.58rem",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: STUDIO.brass,
                          px: 0.8,
                          py: 0.3,
                          borderRadius: "2px",
                          bgcolor: "rgba(156,123,73,0.08)",
                          border: "1px solid rgba(156,123,73,0.2)",
                        }}
                      >
                        {STEP_TAGS[i]}
                      </Typography>
                    </Box>

                    {/* Step Title */}
                    <Typography
                      component="h3"
                      sx={{
                        ...TYPE.exhibit,
                        fontSize: "clamp(1.25rem, 1.8vw, 1.55rem)",
                        color: STUDIO.graphite,
                        mb: 1.25,
                      }}
                    >
                      {step.step}
                    </Typography>

                    {/* Step Body */}
                    <Typography
                      sx={{
                        ...TYPE.placard,
                        color: STUDIO.slate,
                        fontSize: "0.88rem",
                        lineHeight: 1.55,
                      }}
                    >
                      {step.body}
                    </Typography>
                  </Box>

                  {/* Step Deliverable Metadata Footer */}
                  <Box
                    sx={{
                      mt: 3,
                      pt: 2,
                      borderTop: `1px solid ${STUDIO.hair}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        bgcolor: STUDIO.brass,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      sx={{
                        ...TYPE.label,
                        color: STUDIO.slate,
                        fontSize: "0.64rem",
                        letterSpacing: "0.03em",
                        lineHeight: 1.3,
                      }}
                    >
                      {STEP_DELIVERABLES[i]}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* The lab: inversion of the room — dark, technical, hands at work */}
      <Box id="lab" component="section" sx={{ bgcolor: STUDIO.ink, color: STUDIO.chalk, scrollMarginTop: 44, position: "relative", overflow: "hidden" }}>
        <LabGrid />
        <Box sx={{ position: "relative", mx: "auto", maxWidth: 1520, px: { xs: 2.5, sm: 4, lg: 6 }, py: { xs: 9, md: 12 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" }, gap: { xs: 5, md: 9 } }}>
            {/* Left Column: Mission & Metrics with Scroll Motion */}
            <Box
              component={motion.div}
              initial={reduced ? false : { opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: reduced ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <Typography sx={{ ...TYPE.label, color: STUDIO.brass, mb: 1.5 }}>After-sales &amp; lifetime service</Typography>
              <Typography component="h2" sx={{ ...TYPE.section, color: STUDIO.chalk, textWrap: "balance" }}>
                We protect what
                <Box component="span" sx={{ display: "block", fontFamily: FONT.text, fontStyle: "italic", fontWeight: 400, fontSize: "0.86em", letterSpacing: "-0.01em", color: "rgba(246,244,238,0.78)" }}>
                  we engineer.
                </Box>
              </Typography>
              <Typography sx={{ ...TYPE.lead, color: "rgba(246,244,238,0.72)", mt: 2.5, maxWidth: "48ch" }}>
                A reference home theater is a long-term investment in your home. When you commission a cinema
                with ALVStore, our engineers stay connected: scheduled Dirac Live re-calibrations,
                projector optical maintenance, HDMI 2.1 source updates, and priority on-site support across India.
              </Typography>
              <Box sx={{ mt: 4, pt: 3, borderTop: `1px solid ${STUDIO.hairLight}`, display: "flex", flexWrap: "wrap", gap: { xs: 4, sm: 6 } }}>
                {[
                  { k: "Calibration", v: "Annual Dirac re-tuning" },
                  { k: "Support", v: "Direct engineer access" },
                  { k: "Warranty", v: "Authorized brand coverage" },
                ].map((fact, idx) => (
                  <Box
                    key={fact.k}
                    component={motion.div}
                    initial={reduced ? false : { opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ delay: reduced ? 0 : 0.2 + idx * 0.1, duration: 0.5 }}
                  >
                    <Typography sx={{ ...TYPE.label, color: "rgba(246,244,238,0.5)", fontSize: "0.64rem", mb: 0.5 }}>{fact.k}</Typography>
                    <Typography sx={{ fontFamily: FONT.text, fontSize: "1.1rem", color: STUDIO.chalk }}>{fact.v}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Right Column: Staggered Technical Service Cards */}
            <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
              {REPAIRS.map((item, i) => (
                <Box
                  component="li"
                  key={item.title}
                >
                  <Box
                    component={motion.div}
                    initial={reduced ? false : { opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.15 }}
                    transition={{
                      delay: reduced ? 0 : 0.15 + i * 0.1,
                      duration: reduced ? 0 : 0.6,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    sx={{
                      py: 2.4,
                      px: { xs: 0, sm: 1.5 },
                      borderBottom: `1px solid ${STUDIO.hairLight}`,
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 0.75,
                      transition: `background-color 260ms ${EASE}, transform 260ms ${EASE}`,
                      borderRadius: "2px",
                      "&:hover": {
                        bgcolor: "rgba(246,244,238,0.03)",
                        transform: "translateX(6px)",
                        "& h3": { color: STUDIO.brass },
                      },
                    }}
                  >
                    <Typography component="h3" sx={{ fontFamily: FONT.text, fontSize: "1.14rem", fontWeight: 500, color: STUDIO.chalk, transition: `color 240ms ${EASE}` }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ ...TYPE.placard, color: "rgba(246,244,238,0.68)", fontSize: "0.92rem", lineHeight: 1.55 }}>{item.body}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

/** A quiet technical substructure: a faint instrument grid, drawn in CSS only. */
function LabGrid() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        opacity: 0.5,
        backgroundImage:
          "linear-gradient(rgba(246,244,238,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(246,244,238,0.035) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        backgroundPosition: "center top",
        maskImage: "radial-gradient(90% 70% at 70% 10%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(90% 70% at 70% 10%, black 30%, transparent 100%)",
      }}
    />
  );
}
