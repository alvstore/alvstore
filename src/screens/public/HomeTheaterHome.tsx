"use client";

import { scrollToSection } from "@/lib/scroll";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Drawer,
  IconButton,
  MenuItem,
  SxProps,
  TextField,
  Theme,
  Typography,
} from "@mui/material";
import { AnimatedPage, FormDialog, Marquee, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  Monitor,
  Speaker,
  Headphones,
  Star,
  Phone,
  MapPin,
  Mail,
  Menu,
  X as XIcon,
  ChevronDown,
  Volume2,
  Wrench,
  ShieldCheck,
  Award,
  Sparkles,
  Sliders,
  CheckCircle2,
  Search,
  ExternalLink,
  Layers,
  Activity,
  Cpu,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Configurator from "@/components/home-theater/Configurator";
import WhatsAppFloat from "@/components/home-theater/WhatsAppFloat";
import AcousticFieldVisualizer from "@/components/home-theater/AcousticFieldVisualizer";
import {
  ConsultationModal,
  RepairIntakeModal,
  TrackOrderModal,
} from "@/components/home-theater/CinemaModals";
import { motion, useInView, AnimatePresence, useReducedMotion } from "framer-motion";
import { CINEMA_COLORS, TYPOGRAPHY, ANIMATION } from "@/lib/design-system";

const CinemaParticles = lazy(() => import("@/components/home-theater/CinemaParticles"));
const TheaterRoom3D = lazy(() => import("@/components/home-theater/TheaterRoom3D"));
const SoundstageSection = lazy(() => import("@/components/home-theater/SoundstageSection"));

// ─── Data: Signature Systems ────────────────────────────────────────
const SERVICES = [
  {
    title: "Dolby Atmos Systems",
    tagline: "Immersive 3D audio moving with pinpoint object precision",
    features: [
      "7.2.4 & 9.4.6 Discrete channel configurations",
      "Acoustically transparent screen-matched LCR",
      "THX Certified Level III & ISF acoustical calibration",
      "Quad active subwoofer standing wave cancellation",
    ],
    price: "₹3.5L – ₹25L+",
    icon: Speaker,
  },
  {
    title: "4K/8K Laser Projection",
    tagline: "Ultra-high contrast, DCI-P3 cinema color fidelity",
    features: [
      "Sony & JVC native 4K D-ILA / SXRD laser engines",
      "120″ to 220″ Micro-perforated woven screens",
      "Motorized multi-aspect ratio masking (16:9 / 2.35:1)",
      "Zero-reflectance ambient light rejection (ALR)",
    ],
    price: "₹4L – ₹30L+",
    icon: Monitor,
  },
  {
    title: "Smart Cinema Automation",
    tagline: "Single-touch environment & cinema automation",
    features: [
      "Crestron, Control4 & Lutron architectural control",
      "One-touch scenes: lights fade, screen drops, projector wakes",
      "Automated acoustic velvet drape & masking integration",
      "Bespoke iPad & waterproof custom tactile remotes",
    ],
    price: "₹1.8L – ₹12L+",
    icon: Volume2,
  },
  {
    title: "Architectural Acoustics",
    tagline: "Lab-grade RT60 decay, diffusion & sound isolation",
    features: [
      "3D room resonance impulse analysis & modal tuning",
      "Custom timber quadratic residue diffusers (QRD)",
      "Room-within-a-room acoustic decoupling (STC 65+)",
      "High-density fabric wrapped fiberglass absorption panels",
    ],
    price: "₹2.5L – ₹15L+",
    icon: Headphones,
  },
];

// ─── Data: Trust & Accreditations ────────────────────────────────────────
const ACCREDITATIONS = [
  { title: "THX Certified", desc: "Level III Acoustic Engineering" },
  { title: "Dolby Atmos Partner", desc: "Official Cinema Integration Specialist" },
  { title: "ISF Video Calibration", desc: "DCI Color Science Precision" },
  { title: "CEDIA Member", desc: "Custom Electronic Design Association" },
  { title: "5-Year Master Warranty", desc: "Turnkey On-Site Technical Coverage" },
];

// ─── Data: Projects / Case Studies ────────────────────────────────────────
const PROJECTS = [
  {
    title: "Royal Lakefront Villa Cinema",
    location: "Udaipur, Rajasthan",
    config: "9.4.6 Dolby Atmos · 165″ Woven Screen",
    gear: "Trinnov Altitude 32 · Bowers & Wilkins Custom Theatre · Sony 4K Laser",
    desc: "Private 12-seat palace screening theater with bespoke acoustic timber panels, dual 18″ infrasonic subs, and motorized Starlight ceiling.",
    tag: "Ultra Luxury",
  },
  {
    title: "Sea-Facing Penthouse Cinema",
    location: "Worli, Mumbai",
    config: "7.2.4 Dolby Atmos · 140″ Micro-Perf",
    gear: "Marantz Cinema 30 · KEF Ci-Reference THX · JVC D-ILA 4K",
    desc: "Architecturally decoupled room-within-a-room cinema providing 65dB acoustic isolation without structural floor transmission.",
    tag: "Acoustic Decoupled",
  },
  {
    title: "Heritage Farmhouse Theater",
    location: "Jaipur, Rajasthan",
    config: "13.4.8 Reference DCI Cinema",
    gear: "StormAudio ISP · Wisdom Audio Line Source · Christie 4K Projector",
    desc: "Grand 18-seat private cinema hall featuring quad corner bass equalization, luxury motorized Italian leather recliners, and D-BOX haptics.",
    tag: "Flagship DCI",
  },
  {
    title: "Studio Sound Screening Suite",
    location: "Hauz Khas, New Delhi",
    config: "7.2.4 Atmos Mix & Screening Room",
    gear: "Anthem AVM 70 · Genelec SAM Active Array · Barco Laser",
    desc: "Precision RT60 0.24s mastering acoustic environment designed for both film director previews and immersive spatial audio playback.",
    tag: "Studio Mastering",
  },
  {
    title: "Hilltop Manor Cinema Lounge",
    location: "Mount Abu, Rajasthan",
    config: "7.2.4 THX Surround · 135″ ALR Frame",
    gear: "Denon AVC-A1H · B&W CT-700 Series · SVS Dual Subwoofers",
    desc: "Intimate family screening lounge with concealed architectural speakers, suede wall treatments, and one-touch Lutron lighting automation.",
    tag: "Media Lounge",
  },
  {
    title: "Executive Corporate AV Theater",
    location: "Gurugram, NCR",
    config: "9.2.4 Spatial Audio & 220″ Video Wall",
    gear: "Crestron NVX · QSC Q-Sys DSP · Micro-LED Display",
    desc: "Multi-functional boardroom and keynote cinema hall with beamforming ceiling microphones and reference audio clarity.",
    tag: "Corporate Flagship",
  },
];

// ─── Data: Testimonials ────────────────────────────────────────
const TESTIMONIALS = [
  {
    name: "Maharaja Vikramaditya Singh",
    city: "Udaipur",
    text: "ALV Store designed our villa cinema to perfection. The 9.4.6 Dolby Atmos setup delivers depth that rivals any commercial IMAX auditorium.",
    rating: 5,
    tag: "Villa Cinema 9.4.6",
  },
  {
    name: "Priya & Rajesh Singhania",
    city: "Jaipur",
    text: "From 3D raytracing acoustics to the final ISF color calibration, the craftsmanship was impeccable. Truly India's finest cinema installers.",
    rating: 5,
    tag: "Reference 7.2.4",
  },
  {
    name: "Arjun Mathur",
    city: "Mumbai",
    text: "The acoustic isolation was the real miracle. I can play action movies at reference 105 dB at 2 AM without disturbing the bedrooms next door.",
    rating: 5,
    tag: "Acoustic Decoupled Suite",
  },
  {
    name: "Karan Johar Group Executive",
    city: "Delhi NCR",
    text: "Our studio screening suite needed perfect RT60 decay and accurate dialogue clarity. ALV's acoustic engineers delivered textbook perfection.",
    rating: 5,
    tag: "Mastering Studio",
  },
  {
    name: "Dr. Anita Mehta",
    city: "Ahmedabad",
    text: "Also got my vintage McIntosh amplifier restored at their specialist lab. Both their installation and repair services are world-class.",
    rating: 5,
    tag: "McIntosh Repair & Cinema",
  },
];

// ─── Data: FAQs ────────────────────────────────────────
const FAQS = [
  {
    q: "What makes ALV Store's Dolby Atmos cinemas superior to standard home theaters?",
    a: "Unlike typical consumer AV installations, ALV Store treats each space with architectural acoustics: we compute room mode resonances, apply custom absorption and diffusion panels to hit an optimal 0.25-0.30s RT60 decay time, and install timbre-matched in-wall or in-ceiling speakers laser-aligned to Dolby Atmos specifications.",
  },
  {
    q: "How much does a bespoke home cinema turnkey installation cost?",
    a: "Turnkey installations range from ₹3.5 Lakhs for compact media dens up to ₹50 Lakhs+ for dedicated private screening estates with multi-tiered motorized leather seating, native 4K laser projection, Starlight ceiling, and 9.4.6 Dolby Atmos sound. We offer detailed itemized quotes following our initial consultation.",
  },
  {
    q: "What brands and equipment do you partner with?",
    a: "We are authorized system integrators and service partners for Bowers & Wilkins, KEF, Trinnov Audio, Marantz, Denon, McIntosh, Sony 4K Laser, JVC D-ILA, SVS Subwoofers, Crestron, Lutron, and Apple Products.",
  },
  {
    q: "Can you soundproof an existing room without sound leaking into bedrooms?",
    a: "Yes! We specialize in 'room-within-a-room' acoustic isolation (STC 60-68dB rating). This involves decoupled resilient channels, multi-layer high-density drywall with viscoelastic damping compounds, acoustic perimeter seals, and isolated duct baffles.",
  },
  {
    q: "Do you offer diagnostic and repair services for existing high-end audio equipment?",
    a: "Yes. Our specialist electronics repair lab performs component-level micro-soldering, amplifier recapping, optical engine laser servicing, speaker driver re-coning, and Apple Silicon hardware diagnostics.",
  },
  {
    q: "What ongoing maintenance and warranty do you provide after installation?",
    a: "Every ALV installation is backed by our 5-Year Comprehensive On-Site Warranty, including semi-annual audio-visual recalibration visits, firmware optimization, and priority 24/7 technical assistance.",
  },
];

const NAV_LINKS = [
  { label: "3D Acoustic Engine", href: "#acoustic-field" },
  { label: "Systems", href: "#services" },
  { label: "Soundstage", href: "#soundstage" },
  { label: "Configurator", href: "#configurator" },
  { label: "Portfolio", href: "#projects" },
  { label: "Repair Lab", href: "#repair-lab" },
  { label: "Reviews", href: "#testimonials" },
  { label: "FAQ", href: "#faq" },
];

export default function HomeTheaterHome() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const reduced = useReducedMotion();

  // Navigation & Modals State
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [consultModalOpen, setConsultModalOpen] = useState(false);
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [consultSpec, setConsultSpec] = useState<string | undefined>(undefined);

  // Gallery Filter & Lightbox
  const [activeProjectFilter, setActiveProjectFilter] = useState("All");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // FAQ Expand
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Quick Consultation Form in Page
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "Udaipur",
    requirement: "",
    budget: "₹8L - ₹15L",
    room_size: "medium",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // SEO & Schema Markup
  useEffect(() => {
    document.title = "ALV Store — Bespoke Home Cinema, Dolby Atmos & Acoustic Engineering";
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta(
      "description",
      "Premier bespoke home theater installations, architectural acoustics, Dolby Atmos cinema engineering, smart automation, and specialist audio & Apple repair lab."
    );
  }, []);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error("Name and phone number are required");
      return;
    }
    setSubmitting(true);
    const notes = [
      `Requirement: ${formData.requirement}`,
      `Budget: ${formData.budget}`,
      `Room Size: ${formData.room_size}`,
      `City: ${formData.city}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("leads").insert({
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      source: "website-inline-form",
      notes,
      status: "new",
    });

    setSubmitting(false);
    if (error) {
      toast.error("Something went wrong. Please call us directly.");
    } else {
      toast.success("Thank you! Our chief acoustic engineer will contact you within 24 hours.");
      setFormData({ name: "", phone: "", city: "Udaipur", requirement: "", budget: "₹8L - ₹15L", room_size: "medium" });
    }
  };

  const openConsultWithSpec = (specTitle: string) => {
    setConsultSpec(specTitle);
    setConsultModalOpen(true);
  };

  const filteredProjects =
    activeProjectFilter === "All"
      ? PROJECTS
      : PROJECTS.filter((p) => p.tag.toLowerCase().includes(activeProjectFilter.toLowerCase()));

  return (
    <AnimatedPage>
      <Box
        sx={{
          minHeight: "100vh",
          color: CINEMA_COLORS.WARM_WHITE,
          bgcolor: "#09070F",
          overflowX: "clip",
          fontFamily: TYPOGRAPHY.fontBody,
        }}
      >
        {/* ══════════════════════════════════════════════════
            1. FIXED LUXURY NAVIGATION BAR & ACTION CENTER
        ══════════════════════════════════════════════════ */}
        <Box
          component="nav"
          sx={{
            position: "fixed",
            top: 0,
            width: "100%",
            zIndex: 100,
            transition: "all 0.4s ease",
            bgcolor: scrolled ? "rgba(9, 7, 15, 0.92)" : "rgba(9, 7, 15, 0.6)",
            backdropFilter: "blur(20px)",
            borderBottom: scrolled ? "1px solid rgba(232, 184, 108, 0.2)" : "1px solid rgba(255, 255, 255, 0.05)",
            boxShadow: scrolled ? "0 10px 30px rgba(0, 0, 0, 0.8)" : "none",
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
              py: { xs: 1.25, md: 1.75 },
            }}
          >
            {/* Logo */}
            <Box
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
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
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    color: CINEMA_COLORS.GOLD,
                    fontWeight: 600,
                  }}
                >
                  Cinema & Acoustics
                </Typography>
              </Box>
            </Box>

            {/* Desktop Navigation Links */}
            <Box
              sx={{
                display: { xs: "none", lg: "flex" },
                alignItems: "center",
                gap: 2.5,
              }}
            >
              {NAV_LINKS.map((link) => (
                <Box
                  key={link.href}
                  component="a"
                  href={link.href}
                  sx={{
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    color: "rgba(245, 239, 227, 0.7)",
                    textDecoration: "none",
                    transition: "all 0.2s ease",
                    letterSpacing: "0.02em",
                    "&:hover": {
                      color: CINEMA_COLORS.GOLD,
                    },
                  }}
                >
                  {link.label}
                </Box>
              ))}
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 1.5 } }}>
              {/* Track Order CTA */}
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
                  color: "rgba(245, 239, 227, 0.75)",
                  bgcolor: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  "&:hover": {
                    bgcolor: "rgba(255, 255, 255, 0.08)",
                    color: "#fff",
                  },
                }}
              >
                <Box component={Search} sx={{ width: 13, height: 13 }} />
                Track Order
              </ButtonBase>

              {/* Repair Intake CTA */}
              <ButtonBase
                onClick={() => setRepairModalOpen(true)}
                type="button"
                sx={{
                  display: { xs: "none", md: "inline-flex" },
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
                  "&:hover": {
                    bgcolor: "rgba(201, 123, 110, 0.18)",
                  },
                }}
              >
                <Box component={Wrench} sx={{ width: 13, height: 13 }} />
                Repair Intake
              </ButtonBase>

              {/* Book Consultation Primary CTA */}
              <ButtonBase
                onClick={() => {
                  setConsultSpec(undefined);
                  setConsultModalOpen(true);
                }}
                type="button"
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  px: { xs: 2, sm: 2.5 },
                  py: 0.875,
                  borderRadius: "0.625rem",
                  fontSize: "0.8125rem",
                  fontWeight: 700,
                  bgcolor: CINEMA_COLORS.GOLD,
                  color: "#0E0B14",
                  boxShadow: "0 0 20px rgba(232, 184, 108, 0.3)",
                  transition: "all 0.25s ease",
                  "&:hover": {
                    bgcolor: "#F4D9A8",
                    boxShadow: "0 0 28px rgba(232, 184, 108, 0.5)",
                  },
                }}
              >
                Book Consultation
                <Box component={ArrowRight} sx={{ width: 14, height: 14 }} />
              </ButtonBase>

              {/* Mobile Menu Toggle */}
              <IconButton
                aria-label="Toggle Navigation"
                onClick={() => setMobileMenu(true)}
                sx={{
                  display: { xs: "inline-flex", lg: "none" },
                  color: "rgba(245, 239, 227, 0.8)",
                }}
              >
                <Box component={Menu} sx={{ width: 22, height: 22 }} />
              </IconButton>
            </Box>
          </Box>

          {/* Mobile Drawer */}
          <Drawer
            anchor="right"
            open={mobileMenu}
            onClose={() => setMobileMenu(false)}
            slotProps={{
              paper: {
                sx: {
                  width: "min(340px, 90vw)",
                  bgcolor: "#0E0B14",
                  color: CINEMA_COLORS.WARM_WHITE,
                  p: 3,
                  borderLeft: "1px solid rgba(232, 184, 108, 0.2)",
                },
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
              <Typography variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: CINEMA_COLORS.GOLD }}>
                ALV Cinema
              </Typography>
              <IconButton aria-label="Close navigation" onClick={() => setMobileMenu(false)} sx={{ color: "inherit" }}>
                <Box component={XIcon} sx={{ width: 20, height: 20 }} />
              </IconButton>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
              {NAV_LINKS.map((link) => (
                <Button
                  key={link.href}
                  component="a"
                  href={link.href}
                  onClick={() => setMobileMenu(false)}
                  sx={{
                    color: "rgba(245, 239, 227, 0.85)",
                    justifyContent: "flex-start",
                    py: 1,
                    fontSize: "0.9375rem",
                    "&:hover": { color: CINEMA_COLORS.GOLD },
                  }}
                >
                  {link.label}
                </Button>
              ))}
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setMobileMenu(false);
                  setTrackModalOpen(true);
                }}
                startIcon={<Search size={16} />}
                sx={{ borderColor: "rgba(232, 184, 108, 0.3)", color: CINEMA_COLORS.GOLD }}
              >
                Track Order Status
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setMobileMenu(false);
                  setRepairModalOpen(true);
                }}
                startIcon={<Wrench size={16} />}
                sx={{ borderColor: "rgba(201, 123, 110, 0.4)", color: "#C97B6E" }}
              >
                Repair Lab Intake
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  setMobileMenu(false);
                  setConsultModalOpen(true);
                }}
                sx={{ bgcolor: CINEMA_COLORS.GOLD, color: "#000", fontWeight: 700, mt: 1 }}
              >
                Book Free Consultation
              </Button>
            </Box>
          </Drawer>
        </Box>

        {/* ══════════════════════════════════════════════════
            2. HERO SECTION — IMMERSIVE LUXURY ATMOSPHERE
        ══════════════════════════════════════════════════ */}
        <Box
          component="section"
          sx={{
            position: "relative",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            pt: { xs: 14, md: 16 },
            pb: { xs: 8, md: 12 },
            overflow: "hidden",
            backgroundImage: "radial-gradient(ellipse at 50% 20%, rgba(42, 27, 61, 0.6), transparent 75%)",
          }}
        >
          {/* Ambient Particles in background */}
          <Suspense fallback={null}>
            <CinemaParticles />
          </Suspense>

          {/* Radial Gold Orbs */}
          <Box
            sx={{
              position: "absolute",
              top: "15%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "800px",
              height: "450px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(232, 184, 108, 0.09), transparent 70%)",
              filter: "blur(120px)",
              pointerEvents: "none",
            }}
          />

          <Box sx={{ maxWidth: "84rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 }, textAlign: "center", position: "relative", zIndex: 10 }}>
            {/* Top Badge */}
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 1,
                px: 2.5,
                py: 0.75,
                borderRadius: 99,
                bgcolor: "rgba(232, 184, 108, 0.08)",
                border: "1px solid rgba(232, 184, 108, 0.25)",
                mb: 3,
                boxShadow: "0 0 20px rgba(232, 184, 108, 0.15)",
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4ade80", boxShadow: "0 0 8px #4ade80" }} />
              <Typography component="span" variant="caption" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                THX Level III & Dolby Atmos Premier Integrator
              </Typography>
            </Box>

            {/* Headline */}
            <Typography
              component="h1"
              variant="h1"
              sx={{
                fontFamily: TYPOGRAPHY.fontDisplay,
                fontSize: { xs: "2.75rem", sm: "4rem", md: "5.25rem" },
                fontWeight: 700,
                lineHeight: 1.05,
                color: CINEMA_COLORS.WARM_WHITE,
                maxWidth: "68rem",
                mx: "auto",
                mb: 3,
                letterSpacing: "-0.02em",
              }}
            >
              Acoustic Perfection.{" "}
              <Box
                component="span"
                sx={{
                  background: "linear-gradient(135deg, #FFF1D6 0%, #E8B86C 50%, #B8862E 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  display: "inline-block",
                }}
              >
                Cinematic Splendor.
              </Box>
            </Typography>

            {/* Sub-headline */}
            <Typography
              component="p"
              variant="body1"
              sx={{
                fontSize: { xs: "1rem", sm: "1.125rem", md: "1.25rem" },
                color: "rgba(245, 239, 227, 0.65)",
                maxWidth: "46rem",
                mx: "auto",
                lineHeight: 1.6,
                mb: 5,
              }}
            >
              Bespoke private screening rooms, architectural acoustic treatments, 9.4.6 Dolby Atmos calibration,
              smart Crestron automation, and master audiophile equipment restoration across India.
            </Typography>

            {/* CTA Buttons Row */}
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                mb: { xs: 6, md: 8 },
              }}
            >
              <ButtonBase
                onClick={() => {
                  setConsultSpec(undefined);
                  setConsultModalOpen(true);
                }}
                type="button"
                sx={{
                  px: 4,
                  py: 1.75,
                  borderRadius: "0.75rem",
                  bgcolor: CINEMA_COLORS.GOLD,
                  color: "#0E0B14",
                  fontWeight: 700,
                  fontSize: "1rem",
                  boxShadow: "0 0 35px rgba(232, 184, 108, 0.4)",
                  transition: "all 0.25s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1.25,
                  "&:hover": {
                    bgcolor: "#F4D9A8",
                    boxShadow: "0 0 50px rgba(232, 184, 108, 0.6)",
                  },
                }}
              >
                Book Private Consultation
                <Box component={ArrowRight} sx={{ width: 18, height: 18 }} />
              </ButtonBase>

              <ButtonBase
                onClick={() => scrollToSection("acoustic-field")}
                type="button"
                sx={{
                  px: 3.5,
                  py: 1.75,
                  borderRadius: "0.75rem",
                  bgcolor: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(232, 184, 108, 0.3)",
                  color: CINEMA_COLORS.WARM_WHITE,
                  fontWeight: 600,
                  fontSize: "1rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 1,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    bgcolor: "rgba(232, 184, 108, 0.12)",
                    borderColor: CINEMA_COLORS.GOLD,
                  },
                }}
              >
                <Box component={Activity} sx={{ width: 18, height: 18, color: CINEMA_COLORS.GOLD }} />
                Explore 3D Sound Engine
              </ButtonBase>
            </Box>

            {/* Trust Badges Strip */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)", md: "repeat(5, 1fr)" },
                gap: 2,
                pt: 4,
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                maxWidth: "72rem",
                mx: "auto",
              }}
            >
              {ACCREDITATIONS.map((acc, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 1.5,
                    borderRadius: "0.75rem",
                    bgcolor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    textAlign: "center",
                  }}
                >
                  <Typography component="p" variant="subtitle2" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700, fontSize: "0.8125rem" }}>
                    {acc.title}
                  </Typography>
                  <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", fontSize: "0.6875rem" }}>
                    {acc.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* ══════════════════════════════════════════════════
            3. INTERACTIVE 3D ACOUSTIC FIELD ENGINE
        ══════════════════════════════════════════════════ */}
        <AcousticFieldVisualizer />

        {/* ══════════════════════════════════════════════════
            4. 3D ISOMETRIC THEATER ROOM PREVIEW
        ══════════════════════════════════════════════════ */}
        <Box
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            bgcolor: "#0E0B14",
            borderBottom: "1px solid rgba(232, 184, 108, 0.12)",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 }, textAlign: "center", mb: 4 }}>
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
              3D Spatial Architecture
            </Typography>
            <Typography
              component="h2"
              variant="h2"
              sx={{
                fontFamily: TYPOGRAPHY.fontDisplay,
                fontSize: { xs: "2rem", md: "3rem" },
                fontWeight: 700,
                color: CINEMA_COLORS.WARM_WHITE,
              }}
            >
              Your Private Cinema, Visualized
            </Typography>
            <Typography
              component="p"
              variant="body1"
              sx={{
                color: "rgba(245, 239, 227, 0.6)",
                maxWidth: "34rem",
                mx: "auto",
                mt: 1,
                fontSize: "0.875rem",
              }}
            >
              Scroll through to inspect the isometric wireframe: acoustic diffusers, screen placement, and multi-tier seating.
            </Typography>
          </Box>

          <Suspense fallback={<Box sx={{ height: { xs: "360px", md: "500px" } }} />}>
            <TheaterRoom3D />
          </Suspense>
        </Box>

        {/* ══════════════════════════════════════════════════
            5. DOLBY ATMOS SOUNDSTAGE SECTION
        ══════════════════════════════════════════════════ */}
        <Suspense fallback={<Box sx={{ height: "600px", bgcolor: "#1A1228" }} />}>
          <SoundstageSection />
        </Suspense>

        {/* ══════════════════════════════════════════════════
            6. SIGNATURE SYSTEMS (FOUR SIGNATURE PACKAGES)
        ══════════════════════════════════════════════════ */}
        <Box
          id="services"
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            background: "linear-gradient(180deg, #F7F3EC 0%, #EFE7D8 100%)",
            color: "#2B1F12",
            scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
              <Typography
                component="p"
                variant="caption"
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.3em",
                  color: "#B8862E",
                  mb: 1.5,
                }}
              >
                Signature Engineering
              </Typography>
              <Typography
                component="h2"
                variant="h2"
                sx={{
                  fontFamily: TYPOGRAPHY.fontDisplay,
                  fontSize: { xs: "2.25rem", md: "3.25rem" },
                  fontWeight: 700,
                  color: "#2B1F12",
                }}
              >
                Crafted for{" "}
                <Box
                  component="span"
                  sx={{
                    background: "linear-gradient(135deg, #B8862E 0%, #E8B86C 50%, #8A5F1C 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Pure Immersion
                </Box>
              </Typography>
              <Typography
                component="p"
                variant="body1"
                sx={{
                  color: "rgba(43, 31, 18, 0.7)",
                  maxWidth: "36rem",
                  mx: "auto",
                  mt: 1.5,
                  fontSize: "0.9375rem",
                }}
              >
                Four core disciplines integrated under one master engineering blueprint.
              </Typography>
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" },
                gap: 3,
              }}
            >
              {SERVICES.map((s, i) => {
                const IconComponent = s.icon;
                return (
                  <Box
                    key={s.title}
                    sx={{
                      p: 3,
                      borderRadius: "1.25rem",
                      bgcolor: "rgba(255, 255, 255, 0.8)",
                      border: "1px solid rgba(184, 134, 46, 0.2)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      boxShadow: "0 10px 25px rgba(43, 31, 18, 0.06)",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-6px)",
                        boxShadow: "0 20px 40px rgba(184, 134, 46, 0.15)",
                        borderColor: "#B8862E",
                      },
                    }}
                  >
                    <Box>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: "0.875rem",
                          bgcolor: "rgba(184, 134, 46, 0.12)",
                          border: "1px solid rgba(184, 134, 46, 0.25)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          mb: 2.5,
                        }}
                      >
                        <Box component={IconComponent} sx={{ width: 24, height: 24, color: "#B8862E" }} />
                      </Box>
                      <Typography
                        component="h3"
                        variant="h6"
                        sx={{
                          fontFamily: TYPOGRAPHY.fontDisplay,
                          fontWeight: 700,
                          color: "#2B1F12",
                          mb: 1,
                        }}
                      >
                        {s.title}
                      </Typography>
                      <Typography component="p" variant="body2" sx={{ color: "rgba(43, 31, 18, 0.7)", mb: 2.5, fontSize: "0.8125rem", lineHeight: 1.5 }}>
                        {s.tagline}
                      </Typography>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 3 }}>
                        {s.features.map((feat, idx) => (
                          <Box key={idx} sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                            <Box component="span" sx={{ color: "#B8862E", fontSize: "0.75rem", mt: 0.25 }}>
                              ◆
                            </Box>
                            <Typography component="p" variant="caption" sx={{ color: "rgba(43, 31, 18, 0.75)", fontSize: "0.75rem", lineHeight: 1.4 }}>
                              {feat}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ pt: 2, borderTop: "1px solid rgba(184, 134, 46, 0.15)" }}>
                      <Typography component="p" variant="caption" sx={{ color: "rgba(43, 31, 18, 0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Starting From
                      </Typography>
                      <Typography component="p" variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: "#B8862E", mb: 1.5 }}>
                        {s.price}
                      </Typography>
                      <ButtonBase
                        onClick={() => openConsultWithSpec(`${s.title} Package`)}
                        type="button"
                        sx={{
                          width: "100%",
                          py: 1,
                          borderRadius: "0.5rem",
                          border: "1px solid #B8862E",
                          color: "#2B1F12",
                          fontWeight: 700,
                          fontSize: "0.8125rem",
                          transition: "all 0.2s ease",
                          "&:hover": {
                            bgcolor: "#B8862E",
                            color: "#fff",
                          },
                        }}
                      >
                        Enquire Setup
                      </ButtonBase>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* ══════════════════════════════════════════════════
            7. SPECIALIST REPAIR LAB & INTAKE SECTION
        ══════════════════════════════════════════════════ */}
        <Box
          id="repair-lab"
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            bgcolor: "#0E0B14",
            scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
            borderTop: "1px solid rgba(232, 184, 108, 0.15)",
            borderBottom: "1px solid rgba(232, 184, 108, 0.15)",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box
              sx={{
                p: { xs: 3, sm: 4, md: 6 },
                borderRadius: "1.5rem",
                bgcolor: "rgba(18, 14, 28, 0.75)",
                border: "1px solid rgba(201, 123, 110, 0.3)",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" },
                gap: 4,
                alignItems: "center",
                backgroundImage: "radial-gradient(circle at top left, rgba(201, 123, 110, 0.08), transparent 70%)",
              }}
            >
              <Box>
                <Chip
                  label="Certified Electronics Lab"
                  size="small"
                  sx={{
                    bgcolor: "rgba(201, 123, 110, 0.15)",
                    color: "#C97B6E",
                    border: "1px solid rgba(201, 123, 110, 0.35)",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    mb: 2,
                  }}
                />
                <Typography
                  component="h2"
                  variant="h3"
                  sx={{
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    fontSize: { xs: "1.75rem", md: "2.5rem" },
                    fontWeight: 700,
                    color: CINEMA_COLORS.WARM_WHITE,
                    mb: 1.5,
                  }}
                >
                  Master Audiophile & Apple Repair Lab
                </Typography>
                <Typography component="p" variant="body1" sx={{ color: "rgba(245, 239, 227, 0.65)", lineHeight: 1.6, mb: 3 }}>
                  ALV Store operates a specialized hardware diagnostic and restoration laboratory in Rajasthan. From
                  discrete power transistor recapping in vintage McIntosh/Marantz amplifiers, to laser optical block servicing
                  and Apple Silicon board repairs with original diagnostic schematics.
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 4 }}>
                  {[
                    "Component-Level Micro Soldering",
                    "AV Receiver Protection Circuit Reset",
                    "Audiophile Loudspeaker Re-Coning",
                    "Laser Optical Engine Realignment",
                    "Apple Silicon Mac Logic Board Repair",
                    "Genuine OEM Parts with 90-Day Warranty",
                  ].map((item, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box component={CheckCircle2} sx={{ width: 16, height: 16, color: "#4ade80", flexShrink: 0 }} />
                      <Typography component="span" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.8)", fontSize: "0.8125rem" }}>
                        {item}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  <ButtonBase
                    onClick={() => setRepairModalOpen(true)}
                    type="button"
                    sx={{
                      px: 3,
                      py: 1.25,
                      borderRadius: "0.625rem",
                      bgcolor: "#C97B6E",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      boxShadow: "0 0 20px rgba(201, 123, 110, 0.35)",
                      "&:hover": { bgcolor: "#d98d80" },
                    }}
                  >
                    <Box component={Wrench} sx={{ width: 16, height: 16 }} />
                    Log Repair Intake
                  </ButtonBase>

                  <ButtonBase
                    onClick={() => setTrackModalOpen(true)}
                    type="button"
                    sx={{
                      px: 2.5,
                      py: 1.25,
                      borderRadius: "0.625rem",
                      bgcolor: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: CINEMA_COLORS.WARM_WHITE,
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 1,
                      "&:hover": { bgcolor: "rgba(255, 255, 255, 0.1)" },
                    }}
                  >
                    <Box component={Search} sx={{ width: 16, height: 16 }} />
                    Track Repair Status
                  </ButtonBase>
                </Box>
              </Box>

              {/* Lab Visual Card */}
              <Box
                sx={{
                  p: 3,
                  borderRadius: "1rem",
                  bgcolor: "rgba(10, 8, 16, 0.7)",
                  border: "1px solid rgba(232, 184, 108, 0.2)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography component="p" variant="subtitle2" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700 }}>
                    Lab Diagnostic Queue
                  </Typography>
                  <Chip label="Live Bench Status" size="small" sx={{ height: 18, fontSize: "0.625rem", bgcolor: "rgba(74, 222, 128, 0.15)", color: "#4ade80" }} />
                </Box>
                {[
                  { device: "Marantz Cinema 40 AVR", issue: "HDMI 2.1 Handshake Diagnostic", status: "Bench 1: Testing" },
                  { device: "B&W 800 Diamond D3", issue: "Crossover Capacitor Calibration", status: "Bench 2: Soak Run" },
                  { device: "MacBook Pro M3 Max", issue: "Anode Power Rail Micro-Solder", status: "Bench 3: Completed" },
                ].map((row, idx) => (
                  <Box key={idx} sx={{ p: 1.5, borderRadius: "0.5rem", bgcolor: "rgba(255, 255, 255, 0.03)" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography component="p" variant="caption" sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 700 }}>
                        {row.device}
                      </Typography>
                      <Typography component="p" variant="caption" sx={{ color: CINEMA_COLORS.GOLD, fontSize: "0.6875rem" }}>
                        {row.status}
                      </Typography>
                    </Box>
                    <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.45)" }}>
                      {row.issue}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ══════════════════════════════════════════════════
            8. INTERACTIVE CONFIGURATOR
        ══════════════════════════════════════════════════ */}
        <Configurator onBookSetup={openConsultWithSpec} />

        {/* ══════════════════════════════════════════════════
            9. PORTFOLIO GALLERY ("NOW SHOWING")
        ══════════════════════════════════════════════════ */}
        <Box
          id="projects"
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            bgcolor: "#09070F",
            scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ textAlign: "center", mb: { xs: 4, md: 6 } }}>
              <Typography
                component="p"
                variant="caption"
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.3em",
                  color: CINEMA_COLORS.GOLD,
                  mb: 1.5,
                }}
              >
                Exclusive Portfolio
              </Typography>
              <Typography
                component="h2"
                variant="h2"
                sx={{
                  fontFamily: TYPOGRAPHY.fontDisplay,
                  fontSize: { xs: "2.25rem", md: "3.25rem" },
                  fontWeight: 700,
                  color: CINEMA_COLORS.WARM_WHITE,
                  mb: 1.5,
                }}
              >
                Now{" "}
                <Box
                  component="span"
                  sx={{
                    background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Showing
                </Box>
              </Typography>
              <Typography
                component="p"
                variant="body1"
                sx={{
                  color: "rgba(245, 239, 227, 0.6)",
                  maxWidth: "34rem",
                  mx: "auto",
                  fontSize: "0.9375rem",
                }}
              >
                Award-winning residential and commercial theater installations across India.
              </Typography>

              {/* Filter Pills */}
              <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1, mt: 3 }}>
                {["All", "Ultra Luxury", "Acoustic Decoupled", "Flagship DCI", "Studio Mastering"].map((filter) => {
                  const isSelected = activeProjectFilter === filter;
                  return (
                    <ButtonBase
                      key={filter}
                      onClick={() => setActiveProjectFilter(filter)}
                      type="button"
                      sx={{
                        px: 2,
                        py: 0.75,
                        borderRadius: "99px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        border: isSelected ? "1px solid #E8B86C" : "1px solid rgba(255, 255, 255, 0.1)",
                        bgcolor: isSelected ? "rgba(232, 184, 108, 0.15)" : "rgba(255, 255, 255, 0.03)",
                        color: isSelected ? CINEMA_COLORS.GOLD : "rgba(245, 239, 227, 0.65)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {filter}
                    </ButtonBase>
                  );
                })}
              </Box>
            </Box>

            {/* Marquee Strip of Cities */}
            <Box
              sx={{
                mb: 4,
                py: 1.5,
                borderTop: "1px solid rgba(232, 184, 108, 0.15)",
                borderBottom: "1px solid rgba(232, 184, 108, 0.15)",
                overflow: "hidden",
              }}
            >
              <Marquee label="Featured project locations" gap={6}>
                {PROJECTS.map((p, i) => (
                  <Box
                    key={i}
                    component="span"
                    sx={{
                      color: CINEMA_COLORS.GOLD,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      letterSpacing: "0.25em",
                      textTransform: "uppercase",
                    }}
                  >
                    ★ {p.title} · {p.location}
                  </Box>
                ))}
              </Marquee>
            </Box>

            {/* Projects Grid */}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" },
                gap: 3,
              }}
            >
              {filteredProjects.map((proj, idx) => (
                <Box
                  key={proj.title}
                  onClick={() => setLightboxIndex(idx)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details of ${proj.title}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setLightboxIndex(idx);
                    }
                  }}
                  sx={{
                    borderRadius: "1.25rem",
                    bgcolor: "rgba(18, 14, 28, 0.8)",
                    border: "1px solid rgba(232, 184, 108, 0.2)",
                    p: 3,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "260px",
                    transition: "all 0.3s ease",
                    position: "relative",
                    overflow: "hidden",
                    "&:hover": {
                      transform: "translateY(-4px)",
                      borderColor: CINEMA_COLORS.GOLD,
                      boxShadow: "0 15px 35px rgba(232, 184, 108, 0.15)",
                    },
                  }}
                >
                  <Box>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                      <Chip
                        label={proj.tag}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: "0.6875rem",
                          bgcolor: "rgba(232, 184, 108, 0.12)",
                          color: CINEMA_COLORS.GOLD,
                          border: "1px solid rgba(232, 184, 108, 0.25)",
                        }}
                      />
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "rgba(245, 239, 227, 0.5)", fontSize: "0.75rem" }}>
                        <Box component={MapPin} sx={{ width: 12, height: 12, color: CINEMA_COLORS.GOLD }} />
                        {proj.location}
                      </Box>
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
                      {proj.title}
                    </Typography>
                    <Typography component="p" variant="body2" sx={{ color: CINEMA_COLORS.GOLD, fontSize: "0.8125rem", fontWeight: 600, mb: 1 }}>
                      {proj.config}
                    </Typography>
                    <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.55)", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.5 }}>
                      {proj.desc}
                    </Typography>
                  </Box>

                  <Box sx={{ pt: 2, mt: 2, borderTop: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography component="span" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
                      Click to inspect blueprints & gear
                    </Typography>
                    <Box component={ExternalLink} sx={{ width: 14, height: 14, color: CINEMA_COLORS.GOLD }} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Project Detail Lightbox Modal (MUI FormDialog) */}
        <FormDialog
          open={lightboxIndex !== null}
          onClose={() => setLightboxIndex(null)}
          title={lightboxIndex !== null ? filteredProjects[lightboxIndex]?.title : "Cinema Showcase"}
          paperSx={{ bgcolor: "#120E1C", color: CINEMA_COLORS.WARM_WHITE, border: "1px solid rgba(232, 184, 108, 0.3)" }}
          actions={
            <Button
              variant="contained"
              onClick={() => {
                const title = lightboxIndex !== null ? filteredProjects[lightboxIndex]?.title : "Featured Cinema";
                setLightboxIndex(null);
                openConsultWithSpec(`Inquiry regarding setup similar to ${title}`);
              }}
              sx={{ bgcolor: CINEMA_COLORS.GOLD, color: "#000", fontWeight: 700 }}
            >
              Enquire About This Setup
            </Button>
          }
        >
          {lightboxIndex !== null && (
            <Box sx={{ py: 1 }}>
              <Box
                sx={{
                  height: 160,
                  borderRadius: 2,
                  mb: 2.5,
                  display: "grid",
                  placeItems: "center",
                  bgcolor: "rgba(232, 184, 108, 0.08)",
                  border: "1px dashed rgba(232, 184, 108, 0.3)",
                }}
              >
                <Box component={Monitor} sx={{ width: 56, height: 56, color: CINEMA_COLORS.GOLD, opacity: 0.6 }} />
              </Box>
              <Typography component="p" variant="subtitle1" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700, mb: 0.5 }}>
                {filteredProjects[lightboxIndex]?.config}
              </Typography>
              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.6)", display: "block", mb: 2 }}>
                Location: {filteredProjects[lightboxIndex]?.location}
              </Typography>
              <Typography component="p" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.8)", mb: 2, lineHeight: 1.6 }}>
                {filteredProjects[lightboxIndex]?.desc}
              </Typography>
              <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <Typography component="p" variant="caption" sx={{ color: CINEMA_COLORS.GOLD, fontWeight: 700, display: "block", mb: 0.5 }}>
                  Commissioned Engineering Stack:
                </Typography>
                <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.65)" }}>
                  {filteredProjects[lightboxIndex]?.gear}
                </Typography>
              </Box>
            </Box>
          )}
        </FormDialog>

        {/* ══════════════════════════════════════════════════
            10. TESTIMONIALS & CASE STUDIES
        ══════════════════════════════════════════════════ */}
        <Box
          id="testimonials"
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            bgcolor: "#0E0B14",
            scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
            borderTop: "1px solid rgba(232, 184, 108, 0.12)",
            borderBottom: "1px solid rgba(232, 184, 108, 0.12)",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 }, textAlign: "center", mb: 6 }}>
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
              Client Acclaim
            </Typography>
            <Typography
              component="h2"
              variant="h2"
              sx={{
                fontFamily: TYPOGRAPHY.fontDisplay,
                fontSize: { xs: "2rem", md: "3rem" },
                fontWeight: 700,
                color: CINEMA_COLORS.WARM_WHITE,
              }}
            >
              What Our Patrons Say
            </Typography>
          </Box>

          <Box sx={{ position: "relative" }}>
            <Marquee label="Client testimonials" duration={ANIMATION.CAROUSEL_SPEED}>
              {TESTIMONIALS.map((t, i) => (
                <Box
                  key={i}
                  sx={{
                    display: "inline-block",
                    width: "360px",
                    borderRadius: "1.25rem",
                    p: 3,
                    bgcolor: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(232, 184, 108, 0.2)",
                    backdropFilter: "blur(12px)",
                    whiteSpace: "normal",
                    mx: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          bgcolor: "rgba(232, 184, 108, 0.15)",
                          color: CINEMA_COLORS.GOLD,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                        }}
                      >
                        {t.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </Box>
                      <Box>
                        <Typography component="p" variant="subtitle2" sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 700 }}>
                          {t.name}
                        </Typography>
                        <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.45)" }}>
                          {t.city}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", color: CINEMA_COLORS.GOLD }}>
                      {Array.from({ length: t.rating }).map((_, rIdx) => (
                        <Box key={rIdx} component={Star} sx={{ width: 14, height: 14, fill: "currentColor" }} />
                      ))}
                    </Box>
                  </Box>

                  <Chip
                    label={t.tag}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: "0.625rem",
                      bgcolor: "rgba(232, 184, 108, 0.1)",
                      color: CINEMA_COLORS.GOLD,
                      mb: 1.5,
                    }}
                  />

                  <Typography component="p" variant="body2" sx={{ color: "rgba(245, 239, 227, 0.75)", lineHeight: 1.6, fontStyle: "italic" }}>
                    "{t.text}"
                  </Typography>
                </Box>
              ))}
            </Marquee>
          </Box>
        </Box>

        {/* ══════════════════════════════════════════════════
            11. FREQUENTLY ASKED QUESTIONS
        ══════════════════════════════════════════════════ */}
        <Box
          id="faq"
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            bgcolor: "#09070F",
            scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
          }}
        >
          <Box sx={{ maxWidth: "52rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box sx={{ textAlign: "center", mb: 5 }}>
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
                Engineering Clarity
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
                Questions & Answers
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {FAQS.map((faq, i) => {
                const isOpen = expandedFaq === i;
                return (
                  <Box
                    key={i}
                    sx={{
                      borderRadius: "1rem",
                      bgcolor: isOpen ? "rgba(232, 184, 108, 0.08)" : "rgba(255, 255, 255, 0.02)",
                      border: isOpen ? "1px solid rgba(232, 184, 108, 0.35)" : "1px solid rgba(255, 255, 255, 0.06)",
                      overflow: "hidden",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <ButtonBase
                      onClick={() => setExpandedFaq(isOpen ? null : i)}
                      type="button"
                      sx={{
                        width: "100%",
                        p: { xs: 2, sm: 2.5 },
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        color: CINEMA_COLORS.WARM_WHITE,
                      }}
                    >
                      <Typography component="span" variant="subtitle2" sx={{ fontWeight: 600, fontSize: "0.9375rem", pr: 2 }}>
                        {faq.q}
                      </Typography>
                      <Box
                        component={ChevronDown}
                        sx={{
                          width: 18,
                          height: 18,
                          color: CINEMA_COLORS.GOLD,
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s ease",
                          flexShrink: 0,
                        }}
                      />
                    </ButtonBase>

                    <AnimatePresence>
                      {isOpen && (
                        <Box
                          component={motion.div}
                          initial={reduced ? false : { height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <Typography
                            component="p"
                            variant="body2"
                            sx={{
                              px: { xs: 2, sm: 2.5 },
                              pb: 2.5,
                              color: "rgba(245, 239, 227, 0.7)",
                              lineHeight: 1.6,
                              fontSize: "0.875rem",
                            }}
                          >
                            {faq.a}
                          </Typography>
                        </Box>
                      )}
                    </AnimatePresence>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* ══════════════════════════════════════════════════
            12. ON-PAGE CONSULTATION BOOKING SECTION
        ══════════════════════════════════════════════════ */}
        <Box
          id="consultation"
          component="section"
          sx={{
            py: { xs: 8, md: 12 },
            position: "relative",
            bgcolor: "#0E0B14",
            scrollMarginTop: { xs: "4.5rem", md: "5.5rem" },
            borderTop: "1px solid rgba(232, 184, 108, 0.15)",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1fr 1.2fr" },
                gap: { xs: 4, md: 6 },
                alignItems: "center",
              }}
            >
              {/* Left Column: Direct Contact Info */}
              <Box>
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
                  Initiate Your Project
                </Typography>
                <Typography
                  component="h2"
                  variant="h2"
                  sx={{
                    fontFamily: TYPOGRAPHY.fontDisplay,
                    fontSize: { xs: "2.25rem", md: "3rem" },
                    fontWeight: 700,
                    color: CINEMA_COLORS.WARM_WHITE,
                    mb: 2,
                  }}
                >
                  Schedule an On-Site Acoustic Consultation
                </Typography>
                <Typography component="p" variant="body1" sx={{ color: "rgba(245, 239, 227, 0.65)", mb: 4, lineHeight: 1.6 }}>
                  Our lead acoustic consultant and THX calibration engineers will assess your room volume, wall materials,
                  and speaker directivity to formulate a bespoke proposal.
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                  {[
                    { icon: Phone, title: "Direct Lab Phone", value: "+91 98290 00000" },
                    { icon: Mail, title: "Executive Inquiries", value: "consult@alvstore.com" },
                    { icon: MapPin, title: "Flagship Showroom", value: "Udaipur & Jaipur, Rajasthan, India" },
                  ].map((c, i) => {
                    const IconComp = c.icon;
                    return (
                      <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: "0.75rem",
                            bgcolor: "rgba(232, 184, 108, 0.1)",
                            border: "1px solid rgba(232, 184, 108, 0.25)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Box component={IconComp} sx={{ width: 18, height: 18, color: CINEMA_COLORS.GOLD }} />
                        </Box>
                        <Box>
                          <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {c.title}
                          </Typography>
                          <Typography component="p" variant="body2" sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 600 }}>
                            {c.value}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* Right Column: Form Card */}
              <Box
                component="form"
                onSubmit={handleLeadSubmit}
                sx={{
                  p: { xs: 3, sm: 4 },
                  borderRadius: "1.5rem",
                  bgcolor: "rgba(18, 14, 28, 0.8)",
                  border: "1px solid rgba(232, 184, 108, 0.25)",
                  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.6)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <Typography component="h3" variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: CINEMA_COLORS.GOLD, mb: 1 }}>
                  Request Consultation & 3D Layout
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <TextField
                    label="Full Name *"
                    size="small"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                    sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                  />
                  <TextField
                    label="Phone Number *"
                    size="small"
                    required
                    placeholder="+91"
                    value={formData.phone}
                    onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                    sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                  />
                </Box>

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <TextField
                    label="City / Region"
                    size="small"
                    value={formData.city}
                    onChange={(e) => setFormData((d) => ({ ...d, city: e.target.value }))}
                    sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                  />
                  <TextField
                    label="Target Budget"
                    size="small"
                    select
                    value={formData.budget}
                    onChange={(e) => setFormData((d) => ({ ...d, budget: e.target.value }))}
                    sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                  >
                    <MenuItem value="₹3L - ₹6L">₹3 Lakhs – ₹6 Lakhs</MenuItem>
                    <MenuItem value="₹8L - ₹15L">₹8 Lakhs – ₹15 Lakhs</MenuItem>
                    <MenuItem value="₹15L - ₹30L">₹15 Lakhs – ₹30 Lakhs</MenuItem>
                    <MenuItem value="₹30L+ Bespoke">₹30 Lakhs+ (Ultra Flagship)</MenuItem>
                  </TextField>
                </Box>

                <TextField
                  label="Space Details & Preferred Cinema System"
                  size="small"
                  multiline
                  rows={3}
                  placeholder="Tell us about your room (e.g. 15×22ft living room, basement cinema, 9.4.6 Atmos requirements)..."
                  value={formData.requirement}
                  onChange={(e) => setFormData((d) => ({ ...d, requirement: e.target.value }))}
                  sx={{ bgcolor: "rgba(255, 255, 255, 0.04)" }}
                />

                <ButtonBase
                  type="submit"
                  disabled={submitting}
                  sx={{
                    width: "100%",
                    py: 1.5,
                    borderRadius: "0.75rem",
                    bgcolor: CINEMA_COLORS.GOLD,
                    color: "#0E0B14",
                    fontWeight: 700,
                    fontSize: "0.9375rem",
                    boxShadow: "0 0 24px rgba(232, 184, 108, 0.35)",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "#F4D9A8",
                      boxShadow: "0 0 32px rgba(232, 184, 108, 0.5)",
                    },
                    "&:disabled": { opacity: 0.6 },
                  }}
                >
                  {submitting ? "Sending Request..." : "Request Free Architectural Consultation"}
                </ButtonBase>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ══════════════════════════════════════════════════
            13. LUXURY STOREFRONT FOOTER
        ══════════════════════════════════════════════════ */}
        <Box
          component="footer"
          sx={{
            py: 6,
            bgcolor: "#06040A",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <Box sx={{ maxWidth: "80rem", mx: "auto", px: { xs: 2, sm: 3, md: 4 } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
                gap: 4,
                mb: 6,
              }}
            >
              <Box>
                <Typography component="h4" variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontWeight: 700, color: CINEMA_COLORS.GOLD, mb: 1.5 }}>
                  ALV Store & Cinema
                </Typography>
                <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", lineHeight: 1.6, display: "block" }}>
                  India's premier turnkey home cinema engineering company. Certified Dolby Atmos systems, bespoke room acoustics,
                  and specialist audio equipment restoration.
                </Typography>
              </Box>

              <Box>
                <Typography component="h5" variant="subtitle2" sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 700, mb: 1.5 }}>
                  Cinema Engineering
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {["Dolby Atmos 9.4.6 Systems", "4K Laser Projection", "Acoustic Suede Paneling", "Crestron Cinema Automation"].map((t) => (
                    <Typography key={t} component="span" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)" }}>
                      {t}
                    </Typography>
                  ))}
                </Box>
              </Box>

              <Box>
                <Typography component="h5" variant="subtitle2" sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 700, mb: 1.5 }}>
                  Specialist Services
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <ButtonBase onClick={() => setRepairModalOpen(true)} sx={{ justifyContent: "flex-start", color: "rgba(245, 239, 227, 0.5)", fontSize: "0.75rem", "&:hover": { color: CINEMA_COLORS.GOLD } }}>
                    Audio & AVR Lab Repair Intake
                  </ButtonBase>
                  <ButtonBase onClick={() => setTrackModalOpen(true)} sx={{ justifyContent: "flex-start", color: "rgba(245, 239, 227, 0.5)", fontSize: "0.75rem", "&:hover": { color: CINEMA_COLORS.GOLD } }}>
                    Track Repair Job Status
                  </ButtonBase>
                  <ButtonBase onClick={() => navigate("/login")} sx={{ justifyContent: "flex-start", color: "rgba(245, 239, 227, 0.5)", fontSize: "0.75rem", "&:hover": { color: CINEMA_COLORS.GOLD } }}>
                    Staff & Client Portal Login
                  </ButtonBase>
                </Box>
              </Box>

              <Box>
                <Typography component="h5" variant="subtitle2" sx={{ color: CINEMA_COLORS.WARM_WHITE, fontWeight: 700, mb: 1.5 }}>
                  Accreditations
                </Typography>
                <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.5)", lineHeight: 1.6, display: "block" }}>
                  THX Level III Acoustic Integrator · Dolby Atmos Certified · ISF Level III Video Calibration Specialist.
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                pt: 3,
                borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.35)", fontSize: "0.75rem" }}>
                © {new Date().getFullYear()} ALV Store Private Limited. All rights reserved.
              </Typography>
              <Typography component="p" variant="caption" sx={{ color: "rgba(245, 239, 227, 0.35)", fontSize: "0.75rem" }}>
                Crafted for elite acoustics and bespoke entertainment spaces.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ══════════════════════════════════════════════════
            14. ACTION MODALS & WHATSAPP FLOATER
        ══════════════════════════════════════════════════ */}
        <ConsultationModal
          open={consultModalOpen}
          onClose={() => setConsultModalOpen(false)}
          initialSpec={consultSpec}
        />
        <RepairIntakeModal
          open={repairModalOpen}
          onClose={() => setRepairModalOpen(false)}
        />
        <TrackOrderModal
          open={trackModalOpen}
          onClose={() => setTrackModalOpen(false)}
        />

        <WhatsAppFloat />
      </Box>
    </AnimatedPage>
  );
}
