"use client";

import { Box, Button, ButtonBase, Chip, Typography } from "@mui/material";
import { AnimatedPage, Marquee, PageHeader } from "@/components/mui";
import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import {
  ArrowRight,
  Wrench,
  Shield,
  Zap,
  Headphones,
  Monitor,
  Smartphone,
  Speaker,
  Music,
  Star,
  Search,
  CheckCircle2,
  ChevronRight,
  Play,
  Activity,
  Layers,
  Award,
} from "lucide-react";
import { CINEMA_COLORS, TYPOGRAPHY } from "@/lib/design-system";
import {
  ConsultationModal,
  RepairIntakeModal,
  TrackOrderModal,
} from "@/components/home-theater/CinemaModals";
import WhatsAppFloat from "@/components/home-theater/WhatsAppFloat";

const CATEGORIES = [
  {
    title: "Dolby Atmos Home Cinema",
    desc: "Turnkey private theaters, 4K/8K laser projection, 9.4.6 spatial audio & ISF room calibration.",
    icon: Monitor,
    badge: "Cinema & Acoustics",
    action: "/#soundstage",
  },
  {
    title: "Authorized Apple Sales",
    desc: "iPhone Pro, iPad, MacBook Pro, Apple Silicon Mac Studio & audiophile accessories.",
    icon: Smartphone,
    badge: "Authorized Experience",
    action: "/#consultation",
  },
  {
    title: "Audiophile Sound Systems",
    desc: "Bowers & Wilkins, KEF, McIntosh, Marantz, Denon, SVS reference subwoofers & turntable setups.",
    icon: Music,
    badge: "High-Fidelity Audio",
    action: "/#services",
  },
];

const SERVICES = [
  {
    icon: Wrench,
    title: "Specialist Repair Lab",
    desc: "Certified diagnostics & component-level repair for Apple Silicon, Marantz, Denon & McIntosh.",
  },
  {
    icon: Headphones,
    title: "Architectural Acoustics",
    desc: "Custom timber diffusers, acoustic isolation, and RT60 decay modal room analysis.",
  },
  {
    icon: Shield,
    title: "5-Year Master Warranty",
    desc: "Turnkey on-site maintenance, semi-annual audio-visual recalibration & priority support.",
  },
  {
    icon: Zap,
    title: "Smart Cinema Automation",
    desc: "Crestron & Lutron one-touch scene integration for lighting, drapes & optics.",
  },
];

const BRANDS = [
  "Bowers & Wilkins",
  "KEF",
  "McIntosh",
  "Marantz",
  "Denon",
  "Sony 4K Laser",
  "JVC D-ILA",
  "Apple",
  "Trinnov Audio",
  "SVS Subwoofers",
  "Crestron",
  "Lutron",
  "Bang & Olufsen",
  "Sennheiser",
];

const STATS = [
  { number: "500+", label: "Luxury Theaters Built" },
  { number: "10,000+", label: "Precision Devices Repaired" },
  { number: "99.8%", label: "Acoustical Satisfaction" },
  { number: "15+", label: "Years Master Experience" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);

  return (
    <AnimatedPage>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#09070F",
          color: CINEMA_COLORS.WARM_WHITE,
          overflowX: "clip",
          fontFamily: TYPOGRAPHY.fontBody,
        }}
      >
        {/* Navigation Bar */}
        <Box
          component="nav"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            bgcolor: "rgba(9, 7, 15, 0.9)",
            backdropFilter: "blur(24px)",
            borderBottom: "1px solid rgba(232, 184, 108, 0.15)",
          }}
        >
          <Box
            sx={{
              maxWidth: "84rem",
              mx: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: { xs: 2, sm: 3, md: 4 },
              py: 1.5,
            }}
          >
            {/* Logo */}
            <Box
              onClick={() => navigate("/")}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                cursor: "pointer",
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: "0.75rem",
                  bgcolor: "rgba(232, 184, 108, 0.15)",
                  border: "1px solid rgba(232, 184, 108, 0.4)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 16px rgba(232, 184, 108, 0.3)",
                }}
              >
                <Box component={Speaker} sx={{ width: 18, height: 18, color: CINEMA_COLORS.GOLD }} />
              </Box>
              <Box>
                <Typography
                  component="span"
                  variant="h6"
                  sx={{
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    color: CINEMA_COLORS.WARM_WHITE,
                    display: "block",
                    lineHeight: 1.1,
                  }}
                >
                  ALV STORE
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  sx={{
                    fontSize: "0.625rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: CINEMA_COLORS.GOLD,
                    fontWeight: 600,
                  }}
                >
                  Cinema · Audio · Repairs
                </Typography>
              </Box>
            </Box>

            {/* Quick Actions */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <ButtonBase
                onClick={() => setTrackModalOpen(true)}
                type="button"
                sx={{
                  display: { xs: "none", sm: "inline-flex" },
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "rgba(245, 239, 227, 0.8)",
                  bgcolor: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  "&:hover": { bgcolor: "rgba(255, 255, 255, 0.08)" },
                }}
              >
                <Box component={Search} sx={{ width: 13, height: 13 }} />
                Track Order
              </ButtonBase>

              <ButtonBase
                onClick={() => setRepairModalOpen(true)}
                type="button"
                sx={{
                  display: { xs: "none", sm: "inline-flex" },
                  alignItems: "center",
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#C97B6E",
                  bgcolor: "rgba(201, 123, 110, 0.1)",
                  border: "1px solid rgba(201, 123, 110, 0.3)",
                  "&:hover": { bgcolor: "rgba(201, 123, 110, 0.2)" },
                }}
              >
                <Box component={Wrench} sx={{ width: 13, height: 13 }} />
                Repair Intake
              </ButtonBase>

              <Button
                onClick={() => navigate("/login")}
                variant="text"
                size="small"
                sx={{
                  color: "rgba(245, 239, 227, 0.7)",
                  "&:hover": { color: "#fff", bgcolor: "rgba(255, 255, 255, 0.05)" },
                }}
              >
                Portal Sign In
              </Button>

              <ButtonBase
                onClick={() => setConsultModalOpen(true)}
                type="button"
                sx={{
                  px: 2.25,
                  py: 0.875,
                  borderRadius: "0.625rem",
                  bgcolor: CINEMA_COLORS.GOLD,
                  color: "#0E0B14",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  boxShadow: "0 0 20px rgba(232, 184, 108, 0.3)",
                  transition: "all 0.2s ease",
                  "&:hover": { bgcolor: "#F4D9A8" },
                }}
              >
                Book Consultation
              </ButtonBase>
            </Box>
          </Box>
        </Box>

        {/* Hero Section with PageHeader */}
        <Box
          component="section"
          sx={{
            position: "relative",
            minHeight: "85vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: { xs: 2, sm: 3, md: 4 },
            pt: { xs: 6, md: 8 },
            pb: { xs: 8, md: 10 },
            backgroundImage: "radial-gradient(ellipse at 50% 30%, rgba(42, 27, 61, 0.5), transparent 75%)",
          }}
        >
          {/* Ambient Glow Orbs */}
          <Box
            sx={{
              position: "absolute",
              top: "15%",
              left: "20%",
              width: "450px",
              height: "450px",
              borderRadius: "50%",
              bgcolor: "rgba(232, 184, 108, 0.08)",
              filter: "blur(120px)",
              pointerEvents: "none",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              bottom: "10%",
              right: "20%",
              width: "400px",
              height: "400px",
              borderRadius: "50%",
              bgcolor: "rgba(201, 123, 110, 0.07)",
              filter: "blur(110px)",
              pointerEvents: "none",
            }}
          />

          <Box sx={{ maxWidth: "72rem", mx: "auto", textAlign: "center", position: "relative", zIndex: 1 }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 2,
                py: 0.5,
                borderRadius: 99,
                bgcolor: "rgba(232, 184, 108, 0.08)",
                border: "1px solid rgba(232, 184, 108, 0.25)",
                mb: 3,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4ade80" }} />
              <Typography component="span" variant="caption" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                Premier Home Theater & Audiophile Service
              </Typography>
            </Box>

            <PageHeader
              title={
                <Box
                  component="span"
                  sx={{
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    fontSize: { xs: "2.5rem", sm: "3.75rem", md: "4.75rem" },
                    lineHeight: 1.1,
                    display: "block",
                    color: CINEMA_COLORS.WARM_WHITE,
                  }}
                >
                  Bespoke Sound.{" "}
                  <Box
                    component="span"
                    sx={{
                      background: "linear-gradient(135deg, #FFF1D6 0%, #E8B86C 50%, #B8862E 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      display: "inline-block",
                    }}
                  >
                    Cinema Perfection.
                  </Box>
                </Box>
              }
              subtitle="India's leading destination for turnkey private Dolby Atmos cinemas, architectural room acoustics, authorized Apple Silicon sales, and master electronics restoration."
              actions={
                <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2, mt: 3 }}>
                  <ButtonBase
                    onClick={() => setConsultModalOpen(true)}
                    type="button"
                    sx={{
                      px: 3.5,
                      py: 1.5,
                      borderRadius: "0.75rem",
                      bgcolor: CINEMA_COLORS.GOLD,
                      color: "#0E0B14",
                      fontWeight: 700,
                      fontSize: "0.9375rem",
                      boxShadow: "0 0 30px rgba(232, 184, 108, 0.35)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      "&:hover": { bgcolor: "#F4D9A8" },
                    }}
                  >
                    Book Private Consultation
                    <Box component={ArrowRight} sx={{ width: 16, height: 16 }} />
                  </ButtonBase>

                  <ButtonBase
                    onClick={() => navigate("/")}
                    type="button"
                    sx={{
                      px: 3,
                      py: 1.5,
                      borderRadius: "0.75rem",
                      bgcolor: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(232, 184, 108, 0.3)",
                      color: CINEMA_COLORS.WARM_WHITE,
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      "&:hover": { bgcolor: "rgba(232, 184, 108, 0.12)" },
                    }}
                  >
                    <Box component={Activity} sx={{ width: 16, height: 16, color: CINEMA_COLORS.GOLD }} />
                    Explore 3D Sound Engine
                  </ButtonBase>

                  <ButtonBase
                    onClick={() => setRepairModalOpen(true)}
                    type="button"
                    sx={{
                      px: 2.5,
                      py: 1.5,
                      borderRadius: "0.75rem",
                      bgcolor: "rgba(201, 123, 110, 0.1)",
                      border: "1px solid rgba(201, 123, 110, 0.3)",
                      color: "#C97B6E",
                      fontWeight: 600,
                      fontSize: "0.9375rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      "&:hover": { bgcolor: "rgba(201, 123, 110, 0.2)" },
                    }}
                  >
                    <Box component={Wrench} sx={{ width: 16, height: 16 }} />
                    Repair Lab Intake
                  </ButtonBase>
                </Box>
              }
            />
          </Box>
        </Box>

        {/* Featured Collections Section */}
        <Box
          component="section"
          sx={{
            py: { xs: 8, md: 10 },
            borderTop: "1px solid rgba(232, 184, 108, 0.15)",
            bgcolor: "#0E0B14",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ textAlign: "center", mb: 6 }}>
              <Typography
                component="p"
                variant="caption"
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.25em",
                  color: CINEMA_COLORS.GOLD,
                  mb: 1.5,
                }}
              >
                Curated Excellence
              </Typography>
              <Typography
                component="h2"
                variant="h2"
                sx={{
                  fontFamily: TYPOGRAPHY.fontDisplay,
                  fontSize: { xs: "2rem", md: "2.75rem" },
                  fontWeight: 700,
                  color: CINEMA_COLORS.WARM_WHITE,
                }}
              >
                Signature Collections
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
                gap: 3,
              }}
            >
              {CATEGORIES.map((cat) => {
                const IconComponent = cat.icon;
                return (
                  <Box
                    key={cat.title}
                    onClick={() => navigate(cat.action)}
                    sx={{
                      p: 3.5,
                      borderRadius: "1.25rem",
                      bgcolor: "rgba(18, 14, 28, 0.8)",
                      border: "1px solid rgba(232, 184, 108, 0.2)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        borderColor: CINEMA_COLORS.GOLD,
                        boxShadow: "0 15px 35px rgba(232, 184, 108, 0.15)",
                      },
                    }}
                  >
                    <Box>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                        <Box
                          sx={{
                            width: 48,
                            height: 48,
                            borderRadius: "0.875rem",
                            bgcolor: "rgba(232, 184, 108, 0.12)",
                            border: "1px solid rgba(232, 184, 108, 0.3)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Box component={IconComponent} sx={{ width: 22, height: 22, color: CINEMA_COLORS.GOLD }} />
                        </Box>
                        <Chip
                          label={cat.badge}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: "0.6875rem",
                            bgcolor: "rgba(232, 184, 108, 0.1)",
                            color: CINEMA_COLORS.GOLD,
                          }}
                        />
                      </Box>

                      <Typography
                        component="h3"
                        variant="h6"
                        sx={{
                          fontFamily: TYPOGRAPHY.fontDisplay,
                          fontWeight: 700,
                          color: CINEMA_COLORS.WARM_WHITE,
                          mb: 1,
                        }}
                      >
                        {cat.title}
                      </Typography>
                      <Typography component="p" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.6)", lineHeight: 1.6, mb: 2 }}>
                        {cat.desc}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: CINEMA_COLORS.GOLD, fontSize: "0.8125rem", fontWeight: 600 }}>
                      Explore Showcase
                      <Box component={ChevronRight} sx={{ width: 14, height: 14 }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Master Services Strip */}
        <Box
          component="section"
          sx={{
            py: { xs: 8, md: 10 },
            borderTop: "1px solid rgba(255, 255, 255, 0.06)",
            bgcolor: "#09070F",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                gap: 2.5,
              }}
            >
              {SERVICES.map((s) => {
                const IconComponent = s.icon;
                return (
                  <Box
                    key={s.title}
                    sx={{
                      p: 3,
                      borderRadius: "1rem",
                      bgcolor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "0.625rem",
                        bgcolor: "rgba(232, 184, 108, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 2,
                      }}
                    >
                      <Box component={IconComponent} sx={{ width: 18, height: 18, color: CINEMA_COLORS.GOLD }} />
                    </Box>
                    <Typography component="h4" variant="subtitle2" sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 700, mb: 0.75 }}>
                      {s.title}
                    </Typography>
                    <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", lineHeight: 1.5, display: "block" }}>
                      {s.desc}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Live Metrics Strip */}
        <Box
          component="section"
          sx={{
            py: 6,
            bgcolor: "#0E0B14",
            borderTop: "1px solid rgba(232, 184, 108, 0.15)",
            borderBottom: "1px solid rgba(232, 184, 108, 0.15)",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 3, textAlign: "center" }}>
              {STATS.map((st) => (
                <Box key={st.label}>
                  <Typography
                    component="p"
                    variant="h3"
                    sx={{
                      fontFamily: TYPOGRAPHY.fontDisplay,
                      fontWeight: 700,
                      color: CINEMA_COLORS.GOLD,
                      mb: 0.5,
                    }}
                  >
                    {st.number}
                  </Typography>
                  <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.55)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {st.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Brands Marquee */}
        <Box
          component="section"
          sx={{
            py: 4,
            overflow: "hidden",
            bgcolor: "#09070F",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          <Marquee label="Partner Brands" gap={6}>
            {BRANDS.map((brand, i) => (
              <Box
                key={i}
                component="span"
                sx={{
                  fontSize: "1.125rem",
                  fontWeight: 700,
                  color: "rgba(245, 239, 227, 0.25)",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  fontFamily: TYPOGRAPHY.fontDisplay,
                  px: 2,
                }}
              >
                {brand}
              </Box>
            ))}
          </Marquee>
        </Box>

        {/* Storefront Footer */}
        <Box component="footer" sx={{ py: 6, bgcolor: "#06040A" }}>
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "center", justifyContent: "space-between", gap: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "0.5rem",
                    bgcolor: "rgba(232, 184, 108, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Box component={Speaker} sx={{ width: 16, height: 16, color: CINEMA_COLORS.GOLD }} />
                </Box>
                <Typography component="span" variant="subtitle2" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: CINEMA_COLORS.WARM_WHITE }}>
                  ALV Store & Cinema
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                <ButtonBase onClick={() => navigate("/")} sx={{ color: "rgba(245, 239, 227, 0.5)", fontSize: "0.8125rem", "&:hover": { color: CINEMA_COLORS.GOLD } }}>
                  Home Theater Experience
                </ButtonBase>
                <ButtonBase onClick={() => setRepairModalOpen(true)} sx={{ color: "rgba(245, 239, 227, 0.5)", fontSize: "0.8125rem", "&:hover": { color: CINEMA_COLORS.GOLD } }}>
                  Repair Lab Intake
                </ButtonBase>
                <ButtonBase onClick={() => setTrackModalOpen(true)} sx={{ color: "rgba(245, 239, 227, 0.5)", fontSize: "0.8125rem", "&:hover": { color: CINEMA_COLORS.GOLD } }}>
                  Track Order
                </ButtonBase>
                <ButtonBase onClick={() => navigate("/login")} sx={{ color: "rgba(245, 239, 227, 0.5)", fontSize: "0.8125rem", "&:hover": { color: CINEMA_COLORS.GOLD } }}>
                  Sign In
                </ButtonBase>
              </Box>

              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.35)", fontSize: "0.75rem" }}>
                © {new Date().getFullYear()} ALV Store. All rights reserved.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Integrated Modals & WhatsApp Concierge */}
        <ConsultationModal open={consultModalOpen} onClose={() => setConsultModalOpen(false)} />
        <RepairIntakeModal open={repairModalOpen} onClose={() => setRepairModalOpen(false)} />
        <TrackOrderModal open={trackModalOpen} onClose={() => setTrackModalOpen(false)} />
        <WhatsAppFloat />
      </Box>
    </AnimatedPage>
  );
}
