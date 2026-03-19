import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight, Monitor, Speaker, Headphones, Star, CheckCircle,
  Phone, MapPin, Mail, Tv, Film, Volume2, Menu, X,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import Configurator from "@/components/home-theater/Configurator";
import WhatsAppFloat from "@/components/home-theater/WhatsAppFloat";

const TheaterScene = lazy(() => import("@/components/home-theater/TheaterScene"));

const SERVICES = [
  { icon: Tv, title: "Home Theater Installation", desc: "Complete Dolby Atmos and DTS:X setups tailored to your room, from design to calibration.", gradient: "from-blue-600 to-cyan-500" },
  { icon: Film, title: "Luxury Home Cinema", desc: "Dedicated cinema rooms with 4K/8K projection, acoustic treatment, and ambient lighting.", gradient: "from-purple-600 to-pink-500" },
  { icon: Volume2, title: "Multi-Room Audio", desc: "Seamless whole-home audio with Sonos, Bose, and custom speaker installations.", gradient: "from-amber-500 to-orange-600" },
  { icon: Monitor, title: "AV Room Design", desc: "Professional acoustic design, seating layout, and equipment consultation.", gradient: "from-emerald-500 to-teal-600" },
];

const FEATURES = [
  "Dolby Atmos 7.1.4 & 9.1.6 Configurations",
  "4K & 8K Laser Projector Setups",
  "Acoustic Room Treatment",
  "Custom Seating & Ambient Lighting",
  "Smart Home Integration",
  "Professional Calibration (ISF/THX)",
];

const TESTIMONIALS = [
  { name: "Rajesh Sharma", city: "Udaipur", text: "ALV Store transformed our living room into an incredible cinema. The Dolby Atmos setup is phenomenal!", rating: 5 },
  { name: "Priya Mehra", city: "Jaipur", text: "Professional installation, excellent sound calibration. Best home theater experience in Rajasthan.", rating: 5 },
  { name: "Vikram Singh", city: "Udaipur", text: "From consultation to installation, the ALV team delivered a premium cinema room. Highly recommended!", rating: 5 },
  { name: "Anita Patel", city: "Ahmedabad", text: "The 7.1.4 Atmos setup is beyond anything I've experienced. Every movie feels like a theater!", rating: 5 },
];

const PROJECTS = [
  { title: "Luxury Villa Cinema", location: "Udaipur", config: "9.2.6 Dolby Atmos", color: "from-blue-600/20 to-indigo-600/10" },
  { title: "Penthouse Theater", location: "Jaipur", config: "7.1.4 DTS:X", color: "from-purple-600/20 to-pink-600/10" },
  { title: "Farmhouse Cinema", location: "Jodhpur", config: "13.2.8 Reference", color: "from-amber-600/20 to-orange-600/10" },
  { title: "Corporate AV Room", location: "Udaipur", config: "5.1.2 Atmos", color: "from-emerald-600/20 to-teal-600/10" },
  { title: "Basement Theater", location: "Mumbai", config: "7.2.4 THX", color: "from-rose-600/20 to-red-600/10" },
  { title: "Studio Screening Room", location: "Delhi", config: "9.1.6 Atmos", color: "from-cyan-600/20 to-blue-600/10" },
];

const FAQS = [
  { q: "What is the cost of a home theater installation in Udaipur?", a: "Home theater setups range from ₹2L to ₹25L+ depending on room size, equipment, and configuration. We offer free consultations to provide accurate estimates." },
  { q: "Do you provide Dolby Atmos setup?", a: "Yes! We specialize in Dolby Atmos configurations including 5.1.2, 7.1.4, and 9.1.6 setups with ceiling and upfiring speakers." },
  { q: "What brands do you work with?", a: "We work with premium brands including Sony, JBL, Harman Kardon, Denon, Marantz, KEF, B&W, Sonos, Bose, and more." },
  { q: "Do you offer after-installation support?", a: "Absolutely. We provide warranty support, calibration services, and ongoing maintenance for all installations." },
];

export default function HomeTheaterHome() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [formData, setFormData] = useState({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" });
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [testimonialIdx, setTestimonialIdx] = useState(0);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Auto-scroll testimonials
  useEffect(() => {
    const interval = setInterval(() => setTestimonialIdx(i => (i + 1) % TESTIMONIALS.length), 4000);
    return () => clearInterval(interval);
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
    description: "Premium home theater installation and luxury home cinema solutions in Udaipur, Rajasthan. Dolby Atmos, 4K projection, multi-room audio.",
    url: window.location.origin,
    telephone: "+91-XXXXXXXXXX",
    address: { "@type": "PostalAddress", addressLocality: "Udaipur", addressRegion: "Rajasthan", addressCountry: "IN" },
    areaServed: "Udaipur, Jaipur, Rajasthan",
    priceRange: "₹₹₹",
  };

  return (
    <div className="min-h-screen bg-[hsl(0,0%,3%)] text-white overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 ${scrollY > 50 ? "bg-[hsl(0,0%,3%)]/95 backdrop-blur-2xl border-b border-white/5 shadow-2xl" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <Speaker className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">ALV Home Theater</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/50">
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#configurator" className="hover:text-white transition-colors">Configurator</a>
            <a href="#projects" className="hover:text-white transition-colors">Projects</a>
            <a href="#consultation" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" className="hidden sm:flex bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl" onClick={() => document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" })}>
              Free Consultation <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
            <button className="md:hidden text-white/60" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-[hsl(0,0%,5%)] border-t border-white/5 px-6 py-4 space-y-3">
            {["services", "configurator", "projects", "consultation"].map(s => (
              <a key={s} href={`#${s}`} onClick={() => setMobileMenu(false)} className="block text-white/60 hover:text-white py-2 capitalize">{s}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ══════════ HERO ══════════ */}
      <section className="relative min-h-screen flex items-center pt-20">
        {/* 3D Scene (desktop only) */}
        {!isMobile && (
          <div className="absolute inset-0 z-0">
            <Suspense fallback={<div className="absolute inset-0 bg-gradient-to-b from-[hsl(258,50%,8%)] to-[hsl(0,0%,3%)]" />}>
              <TheaterScene />
            </Suspense>
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(0,0%,3%)]/90 via-[hsl(0,0%,3%)]/60 to-transparent" />
          </div>
        )}

        {/* Mobile fallback gradient */}
        {isMobile && (
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[hsl(258,60%,12%)] via-[hsl(258,40%,6%)] to-[hsl(0,0%,3%)]" />
            <div className="absolute top-20 left-1/4 w-[300px] h-[300px] bg-primary/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-40 right-1/4 w-[200px] h-[200px] bg-accent/15 rounded-full blur-[80px]" />
          </div>
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full">
          <div className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-medium backdrop-blur-xl">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              #1 Home Theater Experts in Udaipur
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.02]">
              Immersive
              <br />
              <span className="bg-gradient-to-r from-primary via-accent to-pink-400 bg-clip-text text-transparent">Cinema</span>
              <br />
              At Home.
            </h1>
            <p className="text-lg md:text-xl text-white/50 max-w-lg leading-relaxed">
              Premium Dolby Atmos home theater installation, luxury cinema rooms, and professional audio solutions in Udaipur & Rajasthan.
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-4 pt-2">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-xl px-8 h-13 text-base font-semibold shadow-2xl shadow-white/10"
                onClick={() => document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" })}>
                Get Free Consultation <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-xl px-8 h-13 text-base border-white/10 text-white hover:bg-white/5"
                onClick={() => document.getElementById("configurator")?.scrollIntoView({ behavior: "smooth" })}>
                Design Your Theater
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-4 text-sm text-white/30">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 border-2 border-[hsl(0,0%,3%)] flex items-center justify-center text-[10px] font-bold">
                      {["RS", "PM", "VS", "AP"][i-1]}
                    </div>
                  ))}
                </div>
                <span>50+ Happy Clients</span>
              </div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />)}
                <span className="ml-1">4.9/5</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SERVICES ══════════ */}
      <section className="py-24 relative" id="services">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Our Services</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Home Theater Solutions</h2>
            <p className="text-white/40 mt-4 max-w-2xl mx-auto">From consultation to calibration, we deliver end-to-end home theater experiences.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SERVICES.map((s, i) => (
              <div key={s.title}
                className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-500 hover:border-white/15 hover:bg-white/[0.04] overflow-hidden"
                style={{ perspective: "1000px" }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width - 0.5;
                  const y = (e.clientY - rect.top) / rect.height - 0.5;
                  e.currentTarget.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
                }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "rotateY(0) rotateX(0)"; }}
              >
                <div className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-br ${s.gradient} rounded-full blur-[80px] opacity-0 group-hover:opacity-20 transition-opacity duration-700`} />
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-6 shadow-lg transition-transform duration-500 group-hover:scale-110`}>
                  <s.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-white/40 leading-relaxed text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section className="py-24 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Why Choose Us</p>
              <h2 className="text-4xl font-bold tracking-tight mb-8">Premium Home Theater Experience</h2>
              <div className="space-y-4">
                {FEATURES.map(f => (
                  <div key={f} className="flex items-center gap-3 group">
                    <CheckCircle className="h-5 w-5 text-primary shrink-0 transition-transform group-hover:scale-110" />
                    <span className="text-white/70 group-hover:text-white/90 transition-colors">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-accent/5 border border-white/5 p-12 text-center">
              <div className="text-7xl font-extrabold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">50+</div>
              <p className="text-white/40 mt-2 text-lg">Home Theaters Installed</p>
              <div className="flex justify-center gap-1 mt-6">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-6 w-6 text-amber-400 fill-amber-400" />)}
              </div>
              <p className="text-white/40 mt-2 text-sm">Rated 4.9/5 by our clients</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ INTERACTIVE CONFIGURATOR ══════════ */}
      <Configurator />

      {/* ══════════ PROJECTS / PORTFOLIO ══════════ */}
      <section className="py-24 border-t border-white/5" id="projects">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Portfolio</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Our Projects</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PROJECTS.map((p, i) => (
              <div key={p.title}
                className="group rounded-3xl border border-white/5 bg-white/[0.02] overflow-hidden transition-all duration-500 hover:border-white/15 hover:shadow-2xl hover:shadow-primary/5"
                style={{ perspective: "800px" }}
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width - 0.5;
                  const y = (e.clientY - rect.top) / rect.height - 0.5;
                  e.currentTarget.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
                }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "rotateY(0) rotateX(0) scale(1)"; }}
              >
                <div className={`h-48 bg-gradient-to-br ${p.color} flex items-center justify-center`}>
                  <Monitor className="h-16 w-16 text-white/20 group-hover:text-white/30 transition-colors" />
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg">{p.title}</h3>
                  <p className="text-sm text-white/40 mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.location}</p>
                  <p className="text-xs text-primary/70 mt-2 font-medium">{p.config}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS (Auto-scroll) ══════════ */}
      <section className="py-24 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Client Reviews</p>
            <h2 className="text-4xl font-bold tracking-tight">What Our Clients Say</h2>
          </div>
          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-4 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04]">
                <div className="flex gap-1 mb-4">{[1,2,3,4,5].map(j => <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />)}</div>
                <p className="text-sm text-white/60 leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-white/40">{t.city}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Mobile carousel */}
          <div className="md:hidden">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="flex gap-1 mb-4">{[1,2,3,4,5].map(j => <Star key={j} className="h-4 w-4 text-amber-400 fill-amber-400" />)}</div>
              <p className="text-sm text-white/60 leading-relaxed mb-4">"{TESTIMONIALS[testimonialIdx].text}"</p>
              <p className="text-sm font-semibold">{TESTIMONIALS[testimonialIdx].name}</p>
              <p className="text-xs text-white/40">{TESTIMONIALS[testimonialIdx].city}</p>
            </div>
            <div className="flex justify-center gap-2 mt-4">
              {TESTIMONIALS.map((_, i) => (
                <button key={i} onClick={() => setTestimonialIdx(i)} className={`h-2 rounded-full transition-all ${i === testimonialIdx ? "w-6 bg-primary" : "w-2 bg-white/20"}`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ LEAD CAPTURE FORM ══════════ */}
      <section id="consultation" className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-primary uppercase tracking-widest mb-3">Get Started</p>
            <h2 className="text-4xl font-bold tracking-tight">Free Consultation</h2>
            <p className="text-white/40 mt-4">Tell us about your dream home theater and we'll design the perfect solution.</p>
          </div>
          <form onSubmit={handleLeadSubmit} className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Name *</Label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl h-11" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Phone *</Label>
                <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl h-11" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">City</Label>
                <Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="Udaipur" className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60 text-sm">Budget Range</Label>
                <Select value={formData.budget} onValueChange={v => setFormData(p => ({ ...p, budget: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white rounded-xl h-11"><SelectValue placeholder="Select budget" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2-5L">₹2L - ₹5L</SelectItem>
                    <SelectItem value="5-10L">₹5L - ₹10L</SelectItem>
                    <SelectItem value="10-25L">₹10L - ₹25L</SelectItem>
                    <SelectItem value="25L+">₹25L+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 text-sm">Room Size</Label>
              <Input value={formData.room_size} onChange={e => setFormData(p => ({ ...p, room_size: e.target.value }))} placeholder="e.g. 15x20 ft" className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60 text-sm">Requirement</Label>
              <Textarea value={formData.requirement} onChange={e => setFormData(p => ({ ...p, requirement: e.target.value }))} placeholder="Describe your home theater requirements..." className="bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl" rows={3} />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button type="submit" disabled={submitting} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-12 text-base font-semibold">
                {submitting ? "Submitting..." : "Get Free Consultation"} <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <a href="tel:+919999999999" className="flex items-center justify-center gap-2 px-6 h-12 rounded-xl border border-white/10 text-white/70 hover:bg-white/5 transition-colors">
                <Phone className="h-4 w-4" /> Call Now
              </a>
            </div>
          </form>
        </div>
      </section>

      {/* ══════════ FAQ ══════════ */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <button key={idx} onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                className="w-full text-left rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium pr-4">{faq.q}</span>
                  <span className={`text-white/40 transition-transform ${expandedFaq === idx ? "rotate-45" : ""}`}>+</span>
                </div>
                {expandedFaq === idx && <p className="text-sm text-white/40 mt-3 leading-relaxed">{faq.a}</p>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Speaker className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold">ALV Home Theater</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Udaipur, Rajasthan</span>
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> +91-XXXXXXXXXX</span>
              <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> info@alvstore.in</span>
            </div>
          </div>
          <p className="text-center text-xs text-white/20 mt-8">© {new Date().getFullYear()} ALV Store. All rights reserved.</p>
        </div>
      </footer>

      {/* WhatsApp Float */}
      <WhatsAppFloat />
    </div>
  );
}
