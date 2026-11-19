"use client";

import { scrollToSection } from "@/lib/scroll";

import { Box, Button, ButtonBase, Drawer, IconButton, MenuItem, SxProps, TextField, Theme, Typography } from "@mui/material";
import { AnimatedPage, FormDialog, Marquee, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Monitor, Speaker, Headphones, Star, Phone, MapPin, Mail, Menu, X as XIcon, ChevronDown, Volume2, } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import Configurator from "@/components/home-theater/Configurator";
import WhatsAppFloat from "@/components/home-theater/WhatsAppFloat";
import { motion, useInView, AnimatePresence, useReducedMotion } from "framer-motion";
import { CINEMA_COLORS, TYPOGRAPHY, ANIMATION } from "@/lib/design-system";
const CinemaParticles = lazy(() => import("@/components/home-theater/CinemaParticles"));
const TheaterRoom3D = lazy(() => import("@/components/home-theater/TheaterRoom3D"));
const SpeakerEvolution = lazy(() => import("@/components/home-theater/SpeakerEvolution"));
const SoundstageSection = lazy(() => import("@/components/home-theater/SoundstageSection"));
// ─── Data ────────────────────────────────────────
const SERVICES = [
    {
        title: "Dolby Atmos Systems",
        tagline: "Immersive surround that moves around you",
        features: ["7.1.4 / 9.1.6 configurations", "Ceiling & height speakers", "ISF/THX calibration"],
        price: "₹3L",
        gradient: { "--alv-gradient-from": "rgb(255 215 0 / 0.2) var(--alv-gradient-from-position)", "--alv-gradient-to": "rgb(255 140 0 / 0.1) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)" },
        icon: Speaker,
    },
    {
        title: "4K Laser Projection",
        tagline: "Cinema-grade visuals in your space",
        features: ["4K & 8K laser projectors", "120\"+ screen setups", "Ambient light rejection"],
        price: "₹2.5L",
        gradient: { "--alv-gradient-from": "rgb(255 215 0 / 0.15) var(--alv-gradient-from-position)", "--alv-gradient-to": "rgb(5 10 24 / 0.2) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)" },
        icon: Monitor,
    },
    {
        title: "Smart Automation",
        tagline: "One-touch control for your theater",
        features: ["Lighting scenes", "Motorized curtains & screens", "Voice & app control"],
        price: "₹1.5L",
        gradient: { "--alv-gradient-from": "rgb(255 140 0 / 0.15) var(--alv-gradient-from-position)", "--alv-gradient-to": "rgb(255 215 0 / 0.1) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)" },
        icon: Volume2,
    },
    {
        title: "Acoustic Design",
        tagline: "Sound perfection, engineered",
        features: ["Room analysis & treatment", "Bass trap placement", "Reflection management"],
        price: "₹1L",
        gradient: { "--alv-gradient-from": "rgb(5 10 24 / 0.3) var(--alv-gradient-from-position)", "--alv-gradient-to": "rgb(255 215 0 / 0.1) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)" },
        icon: Headphones,
    },
];
const PROJECTS = [
    { title: "Luxury Villa Cinema", location: "Udaipur", config: "9.2.6 Dolby Atmos" },
    { title: "Penthouse Theater", location: "Jaipur", config: "7.1.4 DTS:X" },
    { title: "Farmhouse Cinema", location: "Jodhpur", config: "13.2.8 Reference" },
    { title: "Corporate AV Room", location: "Udaipur", config: "5.1.2 Atmos" },
    { title: "Basement Theater", location: "Mumbai", config: "7.2.4 THX" },
    { title: "Studio Screening Room", location: "Delhi", config: "9.1.6 Atmos" },
];
const TESTIMONIALS = [
    { name: "Rajesh Sharma", city: "Udaipur", text: "ALV Store transformed our living room into an incredible cinema. The Dolby Atmos setup is phenomenal!", rating: 5 },
    { name: "Priya Mehra", city: "Jaipur", text: "Professional installation, excellent sound calibration. Best home theater experience in Rajasthan.", rating: 5 },
    { name: "Vikram Singh", city: "Udaipur", text: "From consultation to installation, the ALV team delivered a premium cinema room. Highly recommended!", rating: 5 },
    { name: "Anita Patel", city: "Ahmedabad", text: "The 7.1.4 Atmos setup is beyond anything I've experienced. Every movie feels like a theater!", rating: 5 },
    { name: "Karan Malhotra", city: "Mumbai", text: "Incredible attention to detail. The acoustic treatment made a massive difference.", rating: 5 },
    { name: "Neha Agarwal", city: "Delhi", text: "ALV Store's team delivered beyond expectations. Our home cinema is the envy of the neighbourhood.", rating: 5 },
];
const FAQS = [
    { q: "What is the cost of a home theater installation?", a: "Setups range from ₹2L to ₹25L+ depending on room size, equipment, and configuration. We offer free consultations." },
    { q: "Do you provide Dolby Atmos setup?", a: "Yes! We specialize in 5.1.2, 7.1.4, and 9.1.6 Atmos configurations with ceiling and upfiring speakers." },
    { q: "What brands do you work with?", a: "Premium brands including Sony, JBL, Harman Kardon, Denon, Marantz, KEF, B&W, Sonos, Bose, and more." },
    { q: "Do you offer after-installation support?", a: "Absolutely. Warranty support, calibration services, and ongoing maintenance for all installations." },
];
const NAV_LINKS = [
    { label: "Services", href: "#services" },
    { label: "Configurator", href: "#configurator" },
    { label: "Projects", href: "#projects" },
    { label: "Contact", href: "#consultation" },
];
// ─── Animated letter-by-letter heading ───
function AnimatedHeading({ text, sx }: {
    text: string;
    sx?: SxProps<Theme>;
}) {
    const reduced = useReducedMotion();
    const letters = text.split("");
    return (<Box initial={reduced ? false : "hidden"} animate="visible" variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduced ? 0 : ANIMATION.HERO_LETTER_DELAY } },
    }} component={motion.span} sx={sx}>
      {letters.map((char, i) => (<Box key={i} variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.5, ease: "easeOut" } },
        }} component={motion.span} sx={{ display: "inline-block" }}>
          {char === " " ? "\u00A0" : char}
        </Box>))}
    </Box>);
}
// ─── Section wrapper with scroll animation ───
function FadeSection({ children, sx, id, style }: {
    children: React.ReactNode;
    sx?: SxProps<Theme>;
    id?: string;
    style?: React.CSSProperties;
}) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: "-80px" });
    const reduced = useReducedMotion();
    return (<Box ref={ref} id={id} initial={reduced ? false : { opacity: 0, y: 16 }} animate={reduced || inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduced ? 0 : ANIMATION.SECTION_FADE_DURATION, ease: "easeOut" }} style={style as never} component={motion.section} sx={sx}>
      {children}
    </Box>);
}
// ─── 3D Flip Card ───
function FlipCard({ service, index }: {
    service: typeof SERVICES[0];
    index: number;
}) {
    const [flipped, setFlipped] = useState(false);
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: "-60px" });
    const Icon = service.icon;
    const reduced = useReducedMotion();
    return (<Box ref={ref} initial={reduced ? false : { opacity: 0, y: 16 }} animate={reduced || inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : Math.min(index * ANIMATION.STAGGER_DELAY, .24), ease: "easeOut" }} onMouseEnter={() => setFlipped(true)} onMouseLeave={() => setFlipped(false)} onClick={() => setFlipped(f => !f)} style={{ perspective: "1000px" }} component={motion.div} sx={{ minWidth: "280px", "@media (min-width: 640px)": { minWidth: "320px" }, height: "380px", flexShrink: "0", cursor: "pointer" }}>
      <Box sx={mergeSx({ position: "relative", width: "100%", height: "100%", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "600ms" }, {
        transformStyle: "preserve-3d",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
    })}>
        {/* Front */}
        <Box sx={mergeSx(mergeSx({ position: "absolute", inset: "0px", borderRadius: "1rem", borderWidth: "1px", borderColor: "rgb(255 255 255 / 0.08)", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))" }, service.gradient, { "--alv-backdrop-blur": "blur(4px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "flex-end" }), { backfaceVisibility: "hidden" })}>
          <Box sx={{ height: "4rem", width: "4rem", borderRadius: "0.75rem", backgroundColor: "rgb(255 215 0 / 0.1)", borderWidth: "1px", borderColor: "rgb(255 215 0 / 0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1.5rem" }}>
            <Box component={Icon} sx={mergeSx({ height: "2rem", width: "2rem" }, { color: CINEMA_COLORS.GOLD })}/>
          </Box>
          <Typography component="h3" variant="h3" sx={mergeSx({ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", marginBottom: "0.5rem" }, { fontFamily: TYPOGRAPHY.fontDisplay, color: CINEMA_COLORS.WARM_WHITE })}>
            {service.title}
          </Typography>
          <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem" }, { color: "rgba(255,255,255,0.5)" })}>{service.tagline}</Typography>
        </Box>

        {/* Back */}
        <Box sx={mergeSx({ position: "absolute", inset: "0px", borderRadius: "1rem", borderWidth: "1px", borderColor: "rgb(255 215 0 / 0.2)", backgroundColor: "rgb(5 10 24 / 1)", padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }, { backfaceVisibility: "hidden", transform: "rotateY(180deg)" })}>
          <Box>
            <Typography component="h3" variant="h3" sx={mergeSx({ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", marginBottom: "1rem" }, { fontFamily: TYPOGRAPHY.fontDisplay, color: CINEMA_COLORS.GOLD })}>
              {service.title}
            </Typography>
            <Box component="ul" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              {service.features.map(f => (<Box key={f} component="li" sx={mergeSx({ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem" }, { color: "rgba(255,255,255,0.7)" })}>
                  <Box component="span" sx={{ color: CINEMA_COLORS.GOLD }}>◆</Box>
                  {f}
                </Box>))}
            </Box>
          </Box>
          <Box>
            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", marginBottom: "0.75rem" }, { color: "rgba(255,255,255,0.4)" })}>Starting from</Typography>
            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "1.875rem", lineHeight: "2.25rem", fontWeight: "700" }, { color: CINEMA_COLORS.GOLD })}>{service.price}</Typography>
            <ButtonBase onClick={(e) => {
        e.stopPropagation();
        scrollToSection("consultation");
    }} type="button" sx={mergeSx({ marginTop: "1rem", width: "100%", paddingTop: "0.625rem", paddingBottom: "0.625rem", borderRadius: "var(--radius)", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, {
        border: `1px solid ${CINEMA_COLORS.GOLD}`,
        color: CINEMA_COLORS.GOLD,
        background: "transparent",
    })}>
              Get Quote
            </ButtonBase>
          </Box>
        </Box>
      </Box>
    </Box>);
}
// ─── Section Divider ───
function GoldDivider() {
    return (<Box sx={{ display: "flex", justifyContent: "center", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
      <Box sx={mergeSx({ width: "8rem", height: "1px" }, { background: `linear-gradient(90deg, transparent, ${CINEMA_COLORS.GOLD}60, transparent)` })}/>
    </Box>);
}
// ─── Ambient Glow Orb ───
function GlowOrb({ sx }: {
    sx?: SxProps<Theme>;
}) {
    return (<Box sx={mergeSx(mergeSx({ position: "absolute", borderRadius: "9999px", "--alv-blur": "blur(120px)", filter: "var(--alv-blur) var(--alv-brightness) var(--alv-contrast) var(--alv-grayscale) var(--alv-hue-rotate) var(--alv-invert) var(--alv-saturate) var(--alv-sepia) var(--alv-drop-shadow)", pointerEvents: "none" }, sx), { background: `radial-gradient(circle, ${CINEMA_COLORS.GOLD}12, transparent 70%)` })}/>);
}
// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function HomeTheaterHome() {
    const navigate = useNavigate();
    const isMobile = useIsMobile();
    const reduced = useReducedMotion();
    const [formData, setFormData] = useState({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" });
    const [submitting, setSubmitting] = useState(false);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const [mobileMenu, setMobileMenu] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [lightbox, setLightbox] = useState<number | null>(null);
    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 60);
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, []);
    // SEO: Dynamic title & meta
    useEffect(() => {
        document.title = "ALV Store — Premium Home Theater & Dolby Atmos Installation | Udaipur, Rajasthan";
        const setMeta = (name: string, content: string) => {
            let el = document.querySelector(`meta[name="${name}"]`);
            if (!el) {
                el = document.createElement("meta");
                el.setAttribute("name", name);
                document.head.appendChild(el);
            }
            el.setAttribute("content", content);
        };
        setMeta("description", "Premium Dolby Atmos home theater installations, 4K laser projection, acoustic design & Apple products. Expert installations in Udaipur, Jaipur & across Rajasthan.");
        setMeta("robots", "index, follow");
        // Canonical
        let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
        if (!canonical) {
            canonical = document.createElement("link");
            canonical.rel = "canonical";
            document.head.appendChild(canonical);
        }
        canonical.href = window.location.origin + "/";
    }, []);
    const handleLeadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.phone.trim()) {
            toast.error("Name and phone are required");
            return;
        }
        setSubmitting(true);
        const notes = [
            formData.requirement && `Requirement: ${formData.requirement}`,
            formData.budget && `Budget: ${formData.budget}`,
            formData.room_size && `Room Size: ${formData.room_size}`,
            formData.city && `City: ${formData.city}`,
        ].filter(Boolean).join("\n");
        const { error } = await supabase.from("leads").insert({
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            source: "website",
            notes,
            status: "new",
        });
        if (error)
            toast.error("Something went wrong. Please try again.");
        else {
            toast.success("Thank you! We'll contact you within 24 hours.");
            setFormData({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" });
        }
        setSubmitting(false);
    };
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "ALV Store - Home Theater Solutions",
        description: "Premium home theater installation and luxury home cinema solutions in Udaipur, Rajasthan.",
        url: window.location.origin,
        telephone: "+91-XXXXXXXXXX",
        address: { "@type": "PostalAddress", addressLocality: "Udaipur", addressRegion: "Rajasthan", addressCountry: "IN" },
        areaServed: "Udaipur, Jaipur, Rajasthan",
        priceRange: "₹₹₹",
    };
    return <AnimatedPage><Box sx={mergeSx({ minHeight: "100vh", color: "rgb(255 255 255 / 1)", overflow: "clip", background: "#0E0B14" }, { fontFamily: TYPOGRAPHY.fontBody })}>
      <Box type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} component="script"/>

      {/* ══════ FIXED NAV ══════ */}
      <Box component="nav" sx={mergeSx(mergeSx({ position: "fixed", top: "0px", width: "100%", zIndex: "50", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "500ms", animationDuration: "500ms" }, scrolled ? { "--alv-backdrop-blur": "blur(40px)", WebkitBackdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", backdropFilter: "var(--alv-backdrop-blur) var(--alv-backdrop-brightness) var(--alv-backdrop-contrast) var(--alv-backdrop-grayscale) var(--alv-backdrop-hue-rotate) var(--alv-backdrop-invert) var(--alv-backdrop-saturate) var(--alv-backdrop-sepia)", borderBottomWidth: "1px", "--alv-shadow": "0 25px 50px -12px rgb(0 0 0 / 0.25)", "--alv-shadow-colored": "0 25px 50px -12px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" } : { backgroundColor: "transparent" }), {
        background: scrolled ? "rgba(14,11,20,0.85)" : "transparent",
        borderColor: scrolled ? "rgba(232,184,108,0.15)" : "transparent",
    })}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1rem", paddingBottom: "1rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Box sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }, { background: `linear-gradient(135deg, ${CINEMA_COLORS.GOLD}, ${CINEMA_COLORS.AMBER})` })}>
              <Box component={Speaker} sx={{ height: "1.25rem", width: "1.25rem", color: "rgb(0 0 0 / 1)" }}/>
            </Box>
            <Box component="span" sx={mergeSx({ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", letterSpacing: "-0.025em" }, { fontFamily: TYPOGRAPHY.fontDisplay })}>ALV Cinema</Box>
          </Box>

          <Box sx={{ display: "none", "@media (min-width: 768px)": { display: "flex" }, alignItems: "center", gap: "2rem" }}>
            {NAV_LINKS.map(l => (<Box key={l.href} href={l.href} component="a" sx={mergeSx({ color: "inherit", textDecoration: "none" }, { fontSize: "0.875rem", lineHeight: "1.25rem", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", "&:hover": { color: "rgb(255 215 0 / 1)" } }, { color: "rgba(255,255,255,0.5)" })}>
                {l.label}
              </Box>))}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <ButtonBase onClick={() => scrollToSection("consultation")} type="button" sx={mergeSx({ display: "none", "@media (min-width: 640px)": { display: "flex" }, alignItems: "center", gap: "0.5rem", paddingLeft: "1.25rem", paddingRight: "1.25rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", borderRadius: "var(--radius)", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, {
        border: `1px solid ${CINEMA_COLORS.GOLD}`,
        color: CINEMA_COLORS.GOLD,
        background: "transparent",
        boxShadow: `0 0 20px ${CINEMA_COLORS.GOLD}22`,
    })}>
              Get Quote <Box component={ArrowRight} sx={{ height: "0.875rem", width: "0.875rem" }}/>
            </ButtonBase>
            <ButtonBase aria-label="Open site navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(true)} type="button" sx={mergeSx({ "@media (min-width: 768px)": { display: "none" } }, { color: "rgba(255,255,255,0.6)" })}>
              {mobileMenu ? <Box component={XIcon} sx={{ height: "1.5rem", width: "1.5rem" }}/> : <Box component={Menu} sx={{ height: "1.5rem", width: "1.5rem" }}/>}
            </ButtonBase>
          </Box>
        </Box>

        <Drawer anchor="right" open={mobileMenu} onClose={() => setMobileMenu(false)}
          slotProps={{ paper: { sx: { width: "min(340px, 100vw)", bgcolor: CINEMA_COLORS.DEEP_NAVY, color: CINEMA_COLORS.WARM_WHITE, p: 3 } } }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 4 }}>
            <Typography variant="h6">ALV Cinema</Typography><IconButton aria-label="Close site navigation" onClick={() => setMobileMenu(false)} sx={{ color: "inherit" }}><XIcon size={20} /></IconButton>
          </Box>
          <Box component="nav" aria-label="Site navigation" sx={{ display: "grid", gap: 1 }}>
            {NAV_LINKS.map(link => <Button key={link.href} component="a" href={link.href} onClick={() => setMobileMenu(false)} sx={{ color: "inherit", justifyContent: "flex-start", py: 1.5 }}>{link.label}</Button>)}
          </Box>
        </Drawer>
      </Box>

      {/* ══════ HERO — Speaker Evolution (scroll-pinned) ══════ */}
      <Suspense fallback={<Box sx={{ height: "100vh", background: "linear-gradient(135deg, #2A1B3D 0%, #1A1228 60%, #0E0B14 100%)" }}/>}>
        <SpeakerEvolution />
      </Suspense>

      {/* Curtain divider */}
      <Box sx={{ position: "relative", height: "80px", background: "linear-gradient(180deg, transparent 0%, rgba(232,184,108,0.05) 50%, transparent 100%)", overflow: "hidden", "&::before,&::after": { content: "''", position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", height: "1px", width: "200px", background: "linear-gradient(90deg, transparent, #E8B86C, transparent)" }, "&::after": { width: "6px", height: "6px", borderRadius: "50%", background: "#E8B86C", boxShadow: "0 0 20px rgba(232,184,108,0.6)" } }}/>

      {/* ══════ SOUNDSTAGE — 7.1.4 Atmos diagram ══════ */}
      <Suspense fallback={<Box sx={{ height: "600px", background: "linear-gradient(180deg, #1A1228 0%, #0E0B14 100%)" }}/>}>
        <SoundstageSection />
      </Suspense>

      <Box sx={{ position: "relative", height: "80px", background: "linear-gradient(180deg, transparent 0%, rgba(232,184,108,0.05) 50%, transparent 100%)", overflow: "hidden", "&::before,&::after": { content: "''", position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", height: "1px", width: "200px", background: "linear-gradient(90deg, transparent, #E8B86C, transparent)" }, "&::after": { width: "6px", height: "6px", borderRadius: "50%", background: "#E8B86C", boxShadow: "0 0 20px rgba(232,184,108,0.6)" } }}/>

      {/* ══════ SERVICES — Ivory lobby section ══════ */}
      <Box sx={{ background: "linear-gradient(180deg, #F7F3EC 0%, #EFE7D8 100%)", position: "relative" }}>
        <FadeSection id="services" sx={{ paddingTop: "6rem", paddingBottom: "6rem", position: "relative" }}>
          <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
            <Box sx={{ textAlign: "center", marginBottom: "4rem" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: "1rem", color: "rgb(184 134 46 / 1)" }}>
                Our Signature Systems
              </Typography>
              <Typography component="h2" variant="h2" sx={mergeSx({ color: "rgb(43 31 18 / 1)" }, { fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, lineHeight: TYPOGRAPHY.scale.h2.lineHeight })}>
                Crafted For <Box component="span" sx={{ background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Perfection</Box>
              </Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "1rem", maxWidth: "36rem", marginLeft: "auto", marginRight: "auto", color: "rgb(43 31 18 / 0.6)" }}>
                Four signature systems. Designed, installed, calibrated.
              </Typography>
              <Box initial={reduced ? false : { width: 0 }} animate={reduced ? { width: 80 } : undefined} whileInView={{ width: 80 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : 0.8, delay: reduced ? 0 : 0.3 }} style={{ background: `linear-gradient(90deg, transparent, ${CINEMA_COLORS.CHAMPAGNE}, transparent)` }} component={motion.div} sx={{ height: "2px", marginLeft: "auto", marginRight: "auto", marginTop: "1.5rem" }}/>
            </Box>

            <Box sx={{ display: "flex", "@media (min-width: 768px)": { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", overflow: "visible", paddingBottom: "0px" }, gap: "1.5rem", overflowX: "auto", paddingBottom: "1rem", scrollSnapType: "x var(--alv-scroll-snap-strictness)", "--alv-scroll-snap-strictness": "mandatory", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {SERVICES.map((s, i) => (<Box key={s.title} sx={{ scrollSnapAlign: "center" }}>
                  <FlipCard service={s} index={i}/>
                </Box>))}
            </Box>
          </Box>
        </FadeSection>
      </Box>

      <Box sx={{ position: "relative", height: "80px", background: "linear-gradient(180deg, transparent 0%, rgba(232,184,108,0.05) 50%, transparent 100%)", overflow: "hidden", "&::before,&::after": { content: "''", position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", height: "1px", width: "200px", background: "linear-gradient(90deg, transparent, #E8B86C, transparent)" }, "&::after": { width: "6px", height: "6px", borderRadius: "50%", background: "#E8B86C", boxShadow: "0 0 20px rgba(232,184,108,0.6)" } }}/>

      {/* ══════ 3D THEATER ROOM PREVIEW ══════ */}
      <FadeSection sx={{ paddingTop: "4rem", paddingBottom: "4rem", position: "relative" }}>
        <GlowOrb sx={{ width: "400px", height: "400px", top: "0px", left: "25%" }}/>
        {/* Ambient particle field (canvas + framer-motion, no WebGL) */}
        <Suspense fallback={null}>
          <CinemaParticles />
        </Suspense>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem", textAlign: "center", marginBottom: "2rem", position: "relative", zIndex: "10" }}>
          <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: "1rem" }, { color: CINEMA_COLORS.GOLD })}>3D Room Preview</Typography>
          <Typography component="h2" variant="h2" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, color: CINEMA_COLORS.WARM_WHITE }}>
            Your Cinema, Visualized
          </Typography>
          <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "0.75rem", maxWidth: "32rem", marginLeft: "auto", marginRight: "auto" }, { color: "rgba(255,255,255,0.4)" })}>
            Scroll to explore a wireframe theater room — speakers, screen, and seating come alive as you move.
          </Typography>
        </Box>
        {!isMobile && (<Suspense fallback={<Box sx={{ height: "500px" }}/>}>
            <TheaterRoom3D />
          </Suspense>)}
        {isMobile && (<Box sx={mergeSx({ height: "300px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "1rem", marginLeft: "1.5rem", marginRight: "1.5rem" }, { background: "rgba(255,215,0,0.03)", border: "1px solid rgba(255,215,0,0.08)" })}>
            <Box sx={{ textAlign: "center" }}>
              <Box component={Monitor} sx={mergeSx({ height: "4rem", width: "4rem", marginLeft: "auto", marginRight: "auto", marginBottom: "1rem" }, { color: "rgba(255,215,0,0.15)" })}/>
              <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem" }, { color: "rgba(255,255,255,0.3)" })}>View on desktop for 3D experience</Typography>
            </Box>
          </Box>)}
      </FadeSection>

      <GoldDivider />

      {/* ══════ CONFIGURATOR ══════ */}
      <Configurator />

      <GoldDivider />

      {/* ══════ PROJECT GALLERY — "Now Showing" on ivory ══════ */}
      <Box sx={{ background: "linear-gradient(180deg, #F7F3EC 0%, #EFE7D8 100%)", position: "relative" }}>
        <FadeSection id="projects" sx={{ paddingTop: "6rem", paddingBottom: "6rem", position: "relative" }}>
          <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
            <Box sx={{ textAlign: "center", marginBottom: "3rem" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: "1rem", color: "rgb(184 134 46 / 1)" }}>Portfolio</Typography>
              <Typography component="h2" variant="h2" sx={mergeSx({ color: "rgb(43 31 18 / 1)", marginBottom: "1rem" }, { fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size })}>
                Now <Box component="span" sx={{ background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Showing</Box>
              </Typography>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "rgb(43 31 18 / 0.6)", maxWidth: "28rem", marginLeft: "auto", marginRight: "auto" }}>
                Real installations across Rajasthan, Mumbai & Delhi.
              </Typography>
            </Box>

            {/* Marquee strip */}
            <Box sx={{ overflow: "hidden", marginBottom: "3rem", paddingTop: "1rem", paddingBottom: "1rem", borderTopWidth: "1px", borderBottomWidth: "1px", borderColor: "rgb(184 134 46 / 0.2)" }}>
              <Marquee label="Featured projects" gap={6}>
                {PROJECTS.map((p, i) => (<Box key={i} component="span" sx={mergeSx({ color: "rgb(184 134 46 / 1)", fontSize: "0.75rem", lineHeight: "1rem", textTransform: "uppercase", letterSpacing: "0.4em" }, { fontFamily: TYPOGRAPHY.fontDisplay })}>
                    ★ {p.title} · {p.location}
                  </Box>))}
              </Marquee>
            </Box>

            <Box sx={{ columns: "1", "@media (min-width: 640px)": { columns: "2" }, "@media (min-width: 1024px)": { columns: "3" }, gap: "1.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              {PROJECTS.map((p, i) => {
            const heights = [{ height: "16rem" }, { height: "20rem" }, { height: "14rem" }, { height: "18rem" }, { height: "15rem" }, { height: "20rem" }];
            return (<Box key={p.title} data-ui-group role="button" tabIndex={0} aria-label={`View ${p.title}`} initial={reduced ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : Math.min(i * .045, .24) }} onClick={() => setLightbox(i)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setLightbox(i); } }} style={{ background: `linear-gradient(135deg, #1A1228, #0E0B14)`, border: "1px solid rgba(232,184,108,0.2)" }} component={motion.div} sx={mergeSx(heights[i], { breakInside: "avoid", borderRadius: "1rem", overflow: "hidden", position: "relative", cursor: "pointer", "--alv-shadow": "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 20px 25px -5px var(--alv-shadow-color), 0 8px 10px -6px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" })}>
                    <Box sx={{ position: "absolute", inset: "0px", display: "flex", alignItems: "center", justifyContent: "center", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "500ms", animationDuration: "500ms", "[data-ui-group]:hover &": { "--alv-scale-x": "1.1", "--alv-scale-y": "1.1", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } }}>
                      <Box component={Monitor} sx={mergeSx({ height: "4rem", width: "4rem" }, { color: "rgba(232,184,108,0.18)" })}/>
                    </Box>
                    <Box sx={{ position: "absolute", inset: "0px", backgroundImage: "linear-gradient(to top, var(--alv-gradient-stops))", "--alv-gradient-from": "rgb(0 0 0 / 0.85) var(--alv-gradient-from-position)", "--alv-gradient-to": "transparent var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), rgb(0 0 0 / 0.3) var(--alv-gradient-via-position), var(--alv-gradient-to)", opacity: "0", "[data-ui-group]:hover &, [data-ui-group]:focus-visible &": { opacity: "1" }, transitionProperty: "opacity", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: "1.5rem", gap: "0.25rem" }}>
                      <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "700", color: "rgb(232 184 108 / 1)" }, { fontFamily: TYPOGRAPHY.fontDisplay })}>{p.title}</Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "rgb(245 239 227 / 0.7)" }}>
                        <Box component={MapPin} sx={{ height: "0.75rem", width: "0.75rem", display: "inline", marginRight: "0.25rem" }}/>{p.location}
                      </Typography>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "rgb(245 239 227 / 0.5)" }}>{p.config}</Typography>
                    </Box>
                  </Box>);
        })}
            </Box>
          </Box>
        </FadeSection>
      </Box>

      <Box sx={{ position: "relative", height: "80px", background: "linear-gradient(180deg, transparent 0%, rgba(232,184,108,0.05) 50%, transparent 100%)", overflow: "hidden", "&::before,&::after": { content: "''", position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", height: "1px", width: "200px", background: "linear-gradient(90deg, transparent, #E8B86C, transparent)" }, "&::after": { width: "6px", height: "6px", borderRadius: "50%", background: "#E8B86C", boxShadow: "0 0 20px rgba(232,184,108,0.6)" } }}/>

      <FormDialog open={lightbox !== null} onClose={() => setLightbox(null)} title={lightbox !== null ? PROJECTS[lightbox].title : "Project"}
        paperSx={{ bgcolor: CINEMA_COLORS.DEEP_NAVY, color: CINEMA_COLORS.WARM_WHITE }}
        actions={<Button variant="contained" onClick={() => { setLightbox(null); scrollToSection("consultation"); }} sx={{ bgcolor: CINEMA_COLORS.GOLD, color: CINEMA_COLORS.BLACK }}>Enquire About This Setup</Button>}>
        {lightbox !== null && <Box sx={{ textAlign: "center" }}>
          <Box sx={{ height: 180, borderRadius: 3, mb: 3, display: "grid", placeItems: "center", bgcolor: "rgba(255,215,0,.05)" }}><Monitor size={64} color="rgba(255,215,0,.25)" /></Box>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,.7)", mb: 1 }}>{PROJECTS[lightbox].location}</Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,.6)" }}>{PROJECTS[lightbox].config}</Typography>
        </Box>}
      </FormDialog>

      <GoldDivider />

      {/* ══════ TESTIMONIALS — Auto-Scroll Carousel ══════ */}
      <FadeSection sx={mergeSx({ paddingTop: "6rem", paddingBottom: "6rem", overflow: "hidden" }, { background: CINEMA_COLORS.DEEP_NAVY })}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <Box sx={{ textAlign: "center", marginBottom: "4rem" }}>
            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: "1rem" }, { color: CINEMA_COLORS.GOLD })}>Testimonials</Typography>
            <Typography component="h2" variant="h2" sx={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, color: CINEMA_COLORS.WARM_WHITE }}>
              What Our Clients Say
            </Typography>
          </Box>
        </Box>

        {/* Infinite scrolling row */}
        <Box data-ui-group sx={{ position: "relative" }}>
          <Marquee label="Client testimonials" duration={ANIMATION.CAROUSEL_SPEED}>
            {TESTIMONIALS.map((t, i) => (<Box key={i} sx={mergeSx({ display: "inline-block", width: "340px", borderRadius: "1rem", padding: "1.5rem", flexShrink: "0", whiteSpace: "normal" }, {
            background: CINEMA_COLORS.GLASS_BG,
            border: `1px solid ${CINEMA_COLORS.GLASS_BORDER}`,
            backdropFilter: "blur(12px)",
        })}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  <Box sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "700" }, { background: "rgba(255,215,0,0.1)", color: CINEMA_COLORS.GOLD })}>
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </Box>
                  <Box>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }, { color: CINEMA_COLORS.WARM_WHITE })}>{t.name}</Typography>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem" }, { color: "rgba(255,255,255,0.3)" })}>{t.city}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", gap: "0.125rem", marginBottom: "0.75rem" }}>
                  {Array.from({ length: t.rating }).map((_, j) => (<Box key={j} component={Star} sx={mergeSx({ height: "0.875rem", width: "0.875rem", fill: "currentColor" }, { color: CINEMA_COLORS.GOLD })}/>))}
                </Box>
                <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.625" }, { color: "rgba(255,255,255,0.6)" })}>"{t.text}"</Typography>
              </Box>))}
          </Marquee>
        </Box>
      </FadeSection>

      <GoldDivider />

      {/* ══════ CONSULTATION / CONTACT FORM ══════ */}
      <FadeSection id="consultation" sx={{ paddingTop: "6rem", paddingBottom: "6rem", position: "relative" }}>
        <GlowOrb sx={{ width: "350px", height: "350px", bottom: "0px", left: "0px" }}/>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "4rem" }}>
            <Box>
              <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.25em", marginBottom: "1rem" }, { color: CINEMA_COLORS.GOLD })}>Get In Touch</Typography>
              <Typography component="h2" variant="h2" sx={mergeSx({ marginBottom: "1.5rem" }, { fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, color: CINEMA_COLORS.WARM_WHITE })}>
                Free Consultation
              </Typography>
              <Typography component="p" variant="body1" sx={mergeSx({ marginBottom: "2rem" }, { color: "rgba(255,255,255,0.4)" })}>
                Tell us about your space and requirements. Our experts will design the perfect cinema experience for you.
              </Typography>

              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <Box sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center" }, { background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" })}>
                    <Box component={Phone} sx={mergeSx({ height: "1rem", width: "1rem" }, { color: CINEMA_COLORS.GOLD })}/>
                  </Box>
                  <Box>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }, { color: CINEMA_COLORS.WARM_WHITE })}>Call Us</Typography>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem" }, { color: "rgba(255,255,255,0.4)" })}>+91-XXXXXXXXXX</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <Box sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center" }, { background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" })}>
                    <Box component={Mail} sx={mergeSx({ height: "1rem", width: "1rem" }, { color: CINEMA_COLORS.GOLD })}/>
                  </Box>
                  <Box>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }, { color: CINEMA_COLORS.WARM_WHITE })}>Email</Typography>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem" }, { color: "rgba(255,255,255,0.4)" })}>info@alvstore.com</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <Box sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center" }, { background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" })}>
                    <Box component={MapPin} sx={mergeSx({ height: "1rem", width: "1rem" }, { color: CINEMA_COLORS.GOLD })}/>
                  </Box>
                  <Box>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }, { color: CINEMA_COLORS.WARM_WHITE })}>Visit</Typography>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.875rem", lineHeight: "1.25rem" }, { color: "rgba(255,255,255,0.4)" })}>Udaipur, Rajasthan, India</Typography>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box onSubmit={handleLeadSubmit} component="form" sx={mergeSx({ borderRadius: "1rem", padding: "2rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.25rem" } }, { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" })}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box>

                  <TextField value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="Your name" label={"Name *"} size="small" fullWidth sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.2)" } }}/>
                </Box>
                <Box>

                  <TextField value={formData.phone} onChange={e => setFormData(d => ({ ...d, phone: e.target.value }))} placeholder="+91" label={"Phone *"} size="small" fullWidth sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.2)" } }}/>
                </Box>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box>

                  <TextField value={formData.city} onChange={e => setFormData(d => ({ ...d, city: e.target.value }))} placeholder="Udaipur" label={"City"} size="small" fullWidth sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.2)" } }}/>
                </Box>
                <Box>

                  <TextField value={formData.budget} label={"Budget Range"} select size="small" fullWidth onChange={event => (v => setFormData(d => ({ ...d, budget: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)" }}><MenuItem value="" disabled>{"Select"}</MenuItem>
                      <MenuItem value="2-5L">₹2-5 Lakhs</MenuItem>
                      <MenuItem value="5-10L">₹5-10 Lakhs</MenuItem>
                      <MenuItem value="10-25L">₹10-25 Lakhs</MenuItem>
                      <MenuItem value="25L+">₹25 Lakhs+</MenuItem>
                    </TextField>
                </Box>
              </Box>
              <Box>

                <TextField value={formData.room_size} label={"Room Size"} select size="small" fullWidth onChange={event => (v => setFormData(d => ({ ...d, room_size: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)" }}><MenuItem value="" disabled>{"Select"}</MenuItem>
                    <MenuItem value="small">Small (up to 150 sqft)</MenuItem>
                    <MenuItem value="medium">Medium (150-300 sqft)</MenuItem>
                    <MenuItem value="large">Large (300-500 sqft)</MenuItem>
                    <MenuItem value="xlarge">Extra Large (500+ sqft)</MenuItem>
                  </TextField>
              </Box>
              <Box>

                <TextField value={formData.requirement} onChange={e => setFormData(d => ({ ...d, requirement: e.target.value }))} placeholder="Describe your dream home theater..." label={"Requirements"} size="small" fullWidth multiline sx={{ backgroundColor: "rgb(255 255 255 / 0.05)", borderColor: "rgb(255 255 255 / 0.1)", color: "rgb(255 255 255 / 1)", "&::placeholder": { color: "rgb(255 255 255 / 0.2)" }, minHeight: "100px" }}/>
              </Box>
              <ButtonBase type="submit" disabled={submitting} sx={mergeSx({ width: "100%", paddingTop: "0.75rem", paddingBottom: "0.75rem", borderRadius: "var(--radius)", fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "600", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", "&:disabled": { opacity: "0.5" } }, {
        background: CINEMA_COLORS.GOLD,
        color: CINEMA_COLORS.BLACK,
        boxShadow: `0 0 20px ${CINEMA_COLORS.GOLD}22`,
    })}>
                {submitting ? "Sending..." : "Request Free Consultation"}
              </ButtonBase>
            </Box>
          </Box>
        </Box>
      </FadeSection>

      {/* ══════ FAQ — Ivory ══════ */}
      <Box sx={{ background: "linear-gradient(180deg, #F7F3EC 0%, #EFE7D8 100%)" }}>
        <FadeSection sx={{ paddingTop: "6rem", paddingBottom: "6rem" }}>
          <Box sx={{ maxWidth: "48rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
            <Box sx={{ textAlign: "center", marginBottom: "3rem" }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: "1rem", color: "rgb(184 134 46 / 1)" }}>FAQ</Typography>
              <Typography component="h2" variant="h2" sx={mergeSx({ color: "rgb(43 31 18 / 1)" }, { fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size })}>
                Questions, <Box component="span" sx={{ background: "linear-gradient(135deg, #F4D9A8 0%, #E8B86C 50%, #B8862E 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Answered</Box>
              </Typography>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              {FAQS.map((faq, i) => (<Box key={i} sx={mergeSx({ borderRadius: "0.75rem", overflow: "hidden", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", borderWidth: "1px" }, {
            background: expandedFaq === i ? "rgba(232,184,108,0.08)" : "rgba(255,255,255,0.6)",
            borderColor: expandedFaq === i ? "rgba(232,184,108,0.4)" : "rgba(184,134,46,0.15)",
            boxShadow: expandedFaq === i ? "0 8px 24px rgba(232,184,108,0.12)" : "0 2px 8px rgba(43,31,18,0.04)",
        })}>
                  <ButtonBase aria-expanded={expandedFaq === i} aria-controls={`faq-${i}`} onClick={() => setExpandedFaq(expandedFaq === i ? null : i)} type="button" sx={{ width: "100%", textAlign: "left", paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingTop: "1.25rem", paddingBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "rgb(43 31 18 / 1)" }}>{faq.q}</Box>
                    <Box component={ChevronDown} sx={mergeSx({ height: "1rem", width: "1rem", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", color: "rgb(184 134 46 / 1)" }, expandedFaq === i ? { "--alv-rotate": "180deg", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" } : {})}/>
                  </ButtonBase>
                  <AnimatePresence>
                    {expandedFaq === i && (<Box id={`faq-${i}`} initial={reduced ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: reduced ? 0 : 0.28 }} component={motion.div}>
                        <Typography component="p" variant="body1" sx={{ paddingLeft: "1.5rem", paddingRight: "1.5rem", paddingBottom: "1.25rem", fontSize: "0.875rem", lineHeight: "1.625", color: "rgb(43 31 18 / 0.7)" }}>{faq.a}</Typography>
                      </Box>)}
                  </AnimatePresence>
                </Box>))}
            </Box>
          </Box>
        </FadeSection>
      </Box>

      {/* ══════ FOOTER ══════ */}
      <Box component="footer" sx={mergeSx({ paddingTop: "3rem", paddingBottom: "3rem" }, { borderTop: "1px solid rgba(255,255,255,0.05)" })}>
        <Box sx={{ maxWidth: "80rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1.5rem", paddingRight: "1.5rem" }}>
          <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 768px)": { flexDirection: "row" }, alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Box sx={mergeSx({ height: "2.25rem", width: "2.25rem", borderRadius: "var(--radius)", display: "flex", alignItems: "center", justifyContent: "center" }, { background: `linear-gradient(135deg, ${CINEMA_COLORS.GOLD}, ${CINEMA_COLORS.AMBER})` })}>
                <Box component={Speaker} sx={{ height: "1rem", width: "1rem", color: "rgb(0 0 0 / 1)" }}/>
              </Box>
              <Box component="span" sx={mergeSx({ fontSize: "1rem", lineHeight: "1.5rem", fontWeight: "700" }, { fontFamily: TYPOGRAPHY.fontDisplay })}>ALV Cinema</Box>
            </Box>
            <Box sx={mergeSx({ display: "flex", alignItems: "center", gap: "1.5rem", fontSize: "0.75rem", lineHeight: "1rem" }, { color: "rgba(255,255,255,0.25)" })}>
              <Box component="span">Dolby Atmos</Box>
              <Box component="span">4K Projection</Box>
              <Box component="span">Acoustic Design</Box>
              <Box component="span">Smart Automation</Box>
            </Box>
            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem" }, { color: "rgba(255,255,255,0.15)" })}>© {new Date().getFullYear()} ALV Store. All rights reserved.</Typography>
          </Box>
        </Box>
      </Box>

      <WhatsAppFloat />
    </Box></AnimatedPage>;
}
