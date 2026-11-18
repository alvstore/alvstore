import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight, Monitor, Speaker, Headphones, Star,
  Phone, MapPin, Mail, Menu, X as XIcon, ChevronDown, Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import Configurator from "@/components/home-theater/Configurator";
import WhatsAppFloat from "@/components/home-theater/WhatsAppFloat";
import { motion, useInView, AnimatePresence } from "framer-motion";
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
    gradient: "from-[#FFD700]/20 to-[#FF8C00]/10",
    icon: Speaker,
  },
  {
    title: "4K Laser Projection",
    tagline: "Cinema-grade visuals in your space",
    features: ["4K & 8K laser projectors", "120\"+ screen setups", "Ambient light rejection"],
    price: "₹2.5L",
    gradient: "from-[#FFD700]/15 to-[#050A18]/20",
    icon: Monitor,
  },
  {
    title: "Smart Automation",
    tagline: "One-touch control for your theater",
    features: ["Lighting scenes", "Motorized curtains & screens", "Voice & app control"],
    price: "₹1.5L",
    gradient: "from-[#FF8C00]/15 to-[#FFD700]/10",
    icon: Volume2,
  },
  {
    title: "Acoustic Design",
    tagline: "Sound perfection, engineered",
    features: ["Room analysis & treatment", "Bass trap placement", "Reflection management"],
    price: "₹1L",
    gradient: "from-[#050A18]/30 to-[#FFD700]/10",
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
function AnimatedHeading({ text, className }: { text: string; className?: string }) {
  const letters = text.split("");
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: ANIMATION.HERO_LETTER_DELAY } },
      }}
    >
      {letters.map((char, i) => (
        <motion.span
          key={i}
          className="inline-block"
          variants={{
            hidden: { opacity: 0, y: 40, filter: "blur(8px)" },
            visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: "easeOut" } },
          }}
        >
          {char === " " ? "\u00A0" : char}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ─── Section wrapper with scroll animation ───
function FadeSection({ children, className, id, style }: { children: React.ReactNode; className?: string; id?: string; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      style={style as never}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: ANIMATION.SECTION_FADE_DURATION, ease: "easeOut" }}
    >
      {children}
    </motion.section>
  );
}

// ─── 3D Flip Card ───
function FlipCard({ service, index }: { service: typeof SERVICES[0]; index: number }) {
  const [flipped, setFlipped] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = service.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * ANIMATION.STAGGER_DELAY, ease: "easeOut" }}
      className="min-w-[280px] sm:min-w-[320px] h-[380px] flex-shrink-0 cursor-pointer"
      style={{ perspective: "1000px" }}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        className="relative w-full h-full transition-transform duration-[600ms]"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-2xl border border-white/[0.08] bg-gradient-to-br ${service.gradient} backdrop-blur-sm p-8 flex flex-col justify-end`}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="h-16 w-16 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/20 flex items-center justify-center mb-6">
            <Icon className="h-8 w-8" style={{ color: CINEMA_COLORS.GOLD }} />
          </div>
          <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: TYPOGRAPHY.fontDisplay, color: CINEMA_COLORS.WARM_WHITE }}>
            {service.title}
          </h3>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{service.tagline}</p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl border border-[#FFD700]/20 bg-[#050A18] p-8 flex flex-col justify-between"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div>
            <h3 className="text-xl font-bold mb-4" style={{ fontFamily: TYPOGRAPHY.fontDisplay, color: CINEMA_COLORS.GOLD }}>
              {service.title}
            </h3>
            <ul className="space-y-3">
              {service.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                  <span style={{ color: CINEMA_COLORS.GOLD }}>◆</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>Starting from</p>
            <p className="text-3xl font-bold" style={{ color: CINEMA_COLORS.GOLD }}>{service.price}</p>
            <button
              className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
              style={{
                border: `1px solid ${CINEMA_COLORS.GOLD}`,
                color: CINEMA_COLORS.GOLD,
                background: "transparent",
              }}
              onClick={(e) => {
                e.stopPropagation();
                document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Get Quote
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section Divider ───
function GoldDivider() {
  return (
    <div className="flex justify-center py-2">
      <div className="w-32 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${CINEMA_COLORS.GOLD}60, transparent)` }} />
    </div>
  );
}

// ─── Ambient Glow Orb ───
function GlowOrb({ className }: { className?: string }) {
  return (
    <div
      className={`absolute rounded-full blur-[120px] pointer-events-none ${className}`}
      style={{ background: `radial-gradient(circle, ${CINEMA_COLORS.GOLD}12, transparent 70%)` }}
    />
  );
}

// ═══════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════
export default function HomeTheaterHome() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
      if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", "Premium Dolby Atmos home theater installations, 4K laser projection, acoustic design & Apple products. Expert installations in Udaipur, Jaipur & across Rajasthan.");
    setMeta("robots", "index, follow");

    // Canonical
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
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
    if (error) toast.error("Something went wrong. Please try again.");
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

  return (
    <div className="min-h-screen text-white overflow-hidden bg-stage" style={{ fontFamily: TYPOGRAPHY.fontBody }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ══════ FIXED NAV ══════ */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-500 ${
          scrolled ? "backdrop-blur-2xl border-b shadow-2xl" : "bg-transparent"
        }`}
        style={{
          background: scrolled ? "rgba(14,11,20,0.85)" : "transparent",
          borderColor: scrolled ? "rgba(232,184,108,0.15)" : "transparent",
        }}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${CINEMA_COLORS.GOLD}, ${CINEMA_COLORS.AMBER})` }}>
              <Speaker className="h-5 w-5 text-black" />
            </div>
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: TYPOGRAPHY.fontDisplay }}>ALV Cinema</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} className="text-sm transition-colors hover:text-[#FFD700]" style={{ color: "rgba(255,255,255,0.5)" }}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                border: `1px solid ${CINEMA_COLORS.GOLD}`,
                color: CINEMA_COLORS.GOLD,
                background: "transparent",
                boxShadow: `0 0 20px ${CINEMA_COLORS.GOLD}22`,
              }}
              onClick={() => document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" })}
            >
              Get Quote <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button className="md:hidden" style={{ color: "rgba(255,255,255,0.6)" }} onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile overlay menu */}
        <AnimatePresence>
          {mobileMenu && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "100vh" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden fixed inset-0 top-[64px] z-40 flex flex-col items-center justify-center gap-8"
              style={{ background: CINEMA_COLORS.BLACK }}
            >
              {NAV_LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenu(false)}
                  className="text-2xl font-semibold transition-colors hover:text-[#FFD700]"
                  style={{ fontFamily: TYPOGRAPHY.fontDisplay, color: "rgba(255,255,255,0.7)" }}
                >
                  {l.label}
                </a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ══════ HERO — Speaker Evolution (scroll-pinned) ══════ */}
      <Suspense fallback={<div className="h-screen bg-stage-plum" />}>
        <SpeakerEvolution />
      </Suspense>

      {/* Curtain divider */}
      <div className="curtain-divider" />

      {/* ══════ SOUNDSTAGE — 7.1.4 Atmos diagram ══════ */}
      <Suspense fallback={<div className="h-[600px] bg-stage-deep" />}>
        <SoundstageSection />
      </Suspense>

      <div className="curtain-divider" />

      {/* ══════ SERVICES — Ivory lobby section ══════ */}
      <div className="bg-lobby-warm relative">
        <FadeSection id="services" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-medium uppercase tracking-[0.3em] mb-4 text-champagne-deep">
                Our Signature Systems
              </p>
              <h2 className="text-stage-dark" style={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, lineHeight: TYPOGRAPHY.scale.h2.lineHeight }}>
                Crafted For <span className="text-champagne-gradient">Perfection</span>
              </h2>
              <p className="text-sm mt-4 max-w-xl mx-auto text-stage-dark/60">
                Four signature systems. Designed, installed, calibrated.
              </p>
              <motion.div
                className="h-[2px] mx-auto mt-6"
                initial={{ width: 0 }}
                whileInView={{ width: 80 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.3 }}
                style={{ background: `linear-gradient(90deg, transparent, ${CINEMA_COLORS.CHAMPAGNE}, transparent)` }}
              />
            </div>

            <div className="flex md:grid md:grid-cols-4 gap-6 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-x snap-mandatory scrollbar-hide">
              {SERVICES.map((s, i) => (
                <div key={s.title} className="snap-center">
                  <FlipCard service={s} index={i} />
                </div>
              ))}
            </div>
          </div>
        </FadeSection>
      </div>

      <div className="curtain-divider" />

      {/* ══════ 3D THEATER ROOM PREVIEW ══════ */}
      <FadeSection className="py-16 relative">
        <GlowOrb className="w-[400px] h-[400px] top-0 left-1/4" />
        <div className="max-w-7xl mx-auto px-6 text-center mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.25em] mb-4" style={{ color: CINEMA_COLORS.GOLD }}>3D Room Preview</p>
          <h2 style={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, color: CINEMA_COLORS.WARM_WHITE }}>
            Your Cinema, Visualized
          </h2>
          <p className="text-sm mt-3 max-w-lg mx-auto" style={{ color: "rgba(255,255,255,0.4)" }}>
            Scroll to explore a wireframe theater room — speakers, screen, and seating come alive as you move.
          </p>
        </div>
        {!isMobile && (
          <Suspense fallback={<div className="h-[500px]" />}>
            <TheaterRoom3D />
          </Suspense>
        )}
        {isMobile && (
          <div className="h-[300px] flex items-center justify-center rounded-2xl mx-6" style={{ background: "rgba(255,215,0,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
            <div className="text-center">
              <Monitor className="h-16 w-16 mx-auto mb-4" style={{ color: "rgba(255,215,0,0.15)" }} />
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>View on desktop for 3D experience</p>
            </div>
          </div>
        )}
      </FadeSection>

      <GoldDivider />

      {/* ══════ CONFIGURATOR ══════ */}
      <Configurator />

      <GoldDivider />

      {/* ══════ PROJECT GALLERY — "Now Showing" on ivory ══════ */}
      <div className="bg-lobby-warm relative">
        <FadeSection id="projects" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-medium uppercase tracking-[0.3em] mb-4 text-champagne-deep">Portfolio</p>
              <h2 className="text-stage-dark mb-4" style={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size }}>
                Now <span className="text-champagne-gradient">Showing</span>
              </h2>
              <p className="text-sm text-stage-dark/60 max-w-md mx-auto">
                Real installations across Rajasthan, Mumbai & Delhi.
              </p>
            </div>

            {/* Marquee strip */}
            <div className="overflow-hidden mb-12 py-4 border-y border-champagne-deep/20">
              <div className="flex gap-12 whitespace-nowrap animate-marquee" style={{ width: "max-content" }}>
                {[...PROJECTS, ...PROJECTS].map((p, i) => (
                  <span key={i} className="text-champagne-deep text-xs uppercase tracking-[0.4em]" style={{ fontFamily: TYPOGRAPHY.fontDisplay }}>
                    ★ {p.title} · {p.location}
                  </span>
                ))}
              </div>
            </div>

            <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
              {PROJECTS.map((p, i) => {
                const heights = ["h-64", "h-80", "h-56", "h-72", "h-60", "h-80"];
                return (
                  <motion.div
                    key={p.title}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className={`${heights[i]} break-inside-avoid rounded-2xl overflow-hidden relative group cursor-pointer shadow-xl`}
                    style={{ background: `linear-gradient(135deg, #1A1228, #0E0B14)`, border: "1px solid rgba(232,184,108,0.2)" }}
                    onClick={() => setLightbox(i)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center transition-transform duration-500 group-hover:scale-110">
                      <Monitor className="h-16 w-16" style={{ color: "rgba(232,184,108,0.18)" }} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-end pb-6 gap-1">
                      <p className="text-lg font-bold text-champagne" style={{ fontFamily: TYPOGRAPHY.fontDisplay }}>{p.title}</p>
                      <p className="text-sm text-warm/70">
                        <MapPin className="h-3 w-3 inline mr-1" />{p.location}
                      </p>
                      <p className="text-xs text-warm/50">{p.config}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </FadeSection>
      </div>

      <div className="curtain-divider" />

      {/* Lightbox modal */}
      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-6"
            style={{ background: "rgba(0,0,0,0.9)" }}
            onClick={() => setLightbox(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-lg w-full rounded-2xl p-8 text-center"
              style={{ background: CINEMA_COLORS.DEEP_NAVY, border: `1px solid rgba(255,215,0,0.15)` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-48 rounded-xl mb-6 flex items-center justify-center" style={{ background: "rgba(255,215,0,0.05)" }}>
                <Monitor className="h-20 w-20" style={{ color: "rgba(255,215,0,0.15)" }} />
              </div>
              <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: TYPOGRAPHY.fontDisplay, color: CINEMA_COLORS.GOLD }}>
                {PROJECTS[lightbox].title}
              </h3>
              <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                <MapPin className="h-3 w-3 inline mr-1" />{PROJECTS[lightbox].location}
              </p>
              <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>{PROJECTS[lightbox].config}</p>
              <button
                className="px-6 py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: CINEMA_COLORS.GOLD, color: CINEMA_COLORS.BLACK }}
                onClick={() => {
                  setLightbox(null);
                  document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Enquire About This Setup
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <GoldDivider />

      {/* ══════ TESTIMONIALS — Auto-Scroll Carousel ══════ */}
      <FadeSection className="py-24 overflow-hidden" style={{ background: CINEMA_COLORS.DEEP_NAVY }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.25em] mb-4" style={{ color: CINEMA_COLORS.GOLD }}>Testimonials</p>
            <h2 style={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, color: CINEMA_COLORS.WARM_WHITE }}>
              What Our Clients Say
            </h2>
          </div>
        </div>

        {/* Infinite scrolling row */}
        <div className="relative group">
          <div
            className="flex gap-6 whitespace-nowrap"
            style={{
              animation: `scroll-testimonials ${ANIMATION.CAROUSEL_SPEED}s linear infinite`,
              width: "max-content",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.animationPlayState = "paused"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.animationPlayState = "running"; }}
          >
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div
                key={i}
                className="inline-block w-[340px] rounded-2xl p-6 flex-shrink-0 whitespace-normal"
                style={{
                  background: CINEMA_COLORS.GLASS_BG,
                  border: `1px solid ${CINEMA_COLORS.GLASS_BORDER}`,
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: "rgba(255,215,0,0.1)", color: CINEMA_COLORS.GOLD }}>
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: CINEMA_COLORS.WARM_WHITE }}>{t.name}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{t.city}</p>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-3.5 w-3.5 fill-current" style={{ color: CINEMA_COLORS.GOLD }} />
                  ))}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>"{t.text}"</p>
              </div>
            ))}
          </div>
        </div>
      </FadeSection>

      <GoldDivider />

      {/* ══════ CONSULTATION / CONTACT FORM ══════ */}
      <FadeSection id="consultation" className="py-24 relative">
        <GlowOrb className="w-[350px] h-[350px] bottom-0 left-0" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] mb-4" style={{ color: CINEMA_COLORS.GOLD }}>Get In Touch</p>
              <h2 className="mb-6" style={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size, color: CINEMA_COLORS.WARM_WHITE }}>
                Free Consultation
              </h2>
              <p className="mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
                Tell us about your space and requirements. Our experts will design the perfect cinema experience for you.
              </p>

              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" }}>
                    <Phone className="h-4 w-4" style={{ color: CINEMA_COLORS.GOLD }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: CINEMA_COLORS.WARM_WHITE }}>Call Us</p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>+91-XXXXXXXXXX</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" }}>
                    <Mail className="h-4 w-4" style={{ color: CINEMA_COLORS.GOLD }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: CINEMA_COLORS.WARM_WHITE }}>Email</p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>info@alvstore.com</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" }}>
                    <MapPin className="h-4 w-4" style={{ color: CINEMA_COLORS.GOLD }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: CINEMA_COLORS.WARM_WHITE }}>Visit</p>
                    <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Udaipur, Rajasthan, India</p>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleLeadSubmit} className="rounded-2xl p-8 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/50 text-xs mb-1.5 block">Name *</Label>
                  <Input value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))} placeholder="Your name" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                </div>
                <div>
                  <Label className="text-white/50 text-xs mb-1.5 block">Phone *</Label>
                  <Input value={formData.phone} onChange={e => setFormData(d => ({ ...d, phone: e.target.value }))} placeholder="+91" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-white/50 text-xs mb-1.5 block">City</Label>
                  <Input value={formData.city} onChange={e => setFormData(d => ({ ...d, city: e.target.value }))} placeholder="Udaipur" className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                </div>
                <div>
                  <Label className="text-white/50 text-xs mb-1.5 block">Budget Range</Label>
                  <Select value={formData.budget} onValueChange={v => setFormData(d => ({ ...d, budget: v }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2-5L">₹2-5 Lakhs</SelectItem>
                      <SelectItem value="5-10L">₹5-10 Lakhs</SelectItem>
                      <SelectItem value="10-25L">₹10-25 Lakhs</SelectItem>
                      <SelectItem value="25L+">₹25 Lakhs+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-white/50 text-xs mb-1.5 block">Room Size</Label>
                <Select value={formData.room_size} onValueChange={v => setFormData(d => ({ ...d, room_size: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (up to 150 sqft)</SelectItem>
                    <SelectItem value="medium">Medium (150-300 sqft)</SelectItem>
                    <SelectItem value="large">Large (300-500 sqft)</SelectItem>
                    <SelectItem value="xlarge">Extra Large (500+ sqft)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/50 text-xs mb-1.5 block">Requirements</Label>
                <Textarea value={formData.requirement} onChange={e => setFormData(d => ({ ...d, requirement: e.target.value }))} placeholder="Describe your dream home theater..." className="bg-white/5 border-white/10 text-white placeholder:text-white/20 min-h-[100px]" />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-lg text-base font-semibold transition-all disabled:opacity-50"
                style={{
                  background: CINEMA_COLORS.GOLD,
                  color: CINEMA_COLORS.BLACK,
                  boxShadow: `0 0 20px ${CINEMA_COLORS.GOLD}22`,
                }}
              >
                {submitting ? "Sending..." : "Request Free Consultation"}
              </button>
            </form>
          </div>
        </div>
      </FadeSection>

      {/* ══════ FAQ — Ivory ══════ */}
      <div className="bg-lobby-warm">
        <FadeSection className="py-24">
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-medium uppercase tracking-[0.3em] mb-4 text-champagne-deep">FAQ</p>
              <h2 className="text-stage-dark" style={{ fontFamily: TYPOGRAPHY.fontDisplay, fontSize: TYPOGRAPHY.scale.h2.size }}>
                Questions, <span className="text-champagne-gradient">Answered</span>
              </h2>
            </div>
            <div className="space-y-3">
              {FAQS.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden transition-all border"
                  style={{
                    background: expandedFaq === i ? "rgba(232,184,108,0.08)" : "rgba(255,255,255,0.6)",
                    borderColor: expandedFaq === i ? "rgba(232,184,108,0.4)" : "rgba(184,134,46,0.15)",
                    boxShadow: expandedFaq === i ? "0 8px 24px rgba(232,184,108,0.12)" : "0 2px 8px rgba(43,31,18,0.04)",
                  }}
                >
                  <button className="w-full text-left px-6 py-5 flex items-center justify-between" onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}>
                    <span className="text-sm font-semibold text-stage-dark">{faq.q}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform text-champagne-deep ${expandedFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {expandedFaq === i && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                        <p className="px-6 pb-5 text-sm text-stage-dark/70 leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </FadeSection>
      </div>

      {/* ══════ FOOTER ══════ */}
      <footer className="py-12" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${CINEMA_COLORS.GOLD}, ${CINEMA_COLORS.AMBER})` }}>
                <Speaker className="h-4 w-4 text-black" />
              </div>
              <span className="text-base font-bold" style={{ fontFamily: TYPOGRAPHY.fontDisplay }}>ALV Cinema</span>
            </div>
            <div className="flex items-center gap-6 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
              <span>Dolby Atmos</span>
              <span>4K Projection</span>
              <span>Acoustic Design</span>
              <span>Smart Automation</span>
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>© {new Date().getFullYear()} ALV Store. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Carousel keyframes */}
      <style>{`
        @keyframes scroll-testimonials {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <WhatsAppFloat />
    </div>
  );
}
