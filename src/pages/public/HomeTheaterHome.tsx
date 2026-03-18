import { useState } from "react";
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
  Phone, MapPin, Mail, Play, Tv, Film, Volume2, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

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
];

const FAQS = [
  { q: "What is the cost of a home theater installation in Udaipur?", a: "Home theater setups range from ₹2L to ₹25L+ depending on room size, equipment, and configuration. We offer free consultations to provide accurate estimates." },
  { q: "Do you provide Dolby Atmos setup?", a: "Yes! We specialize in Dolby Atmos configurations including 5.1.2, 7.1.4, and 9.1.6 setups with ceiling and upfiring speakers." },
  { q: "What brands do you work with?", a: "We work with premium brands including Sony, JBL, Harman Kardon, Denon, Marantz, KEF, B&W, Sonos, Bose, and more." },
  { q: "Do you offer after-installation support?", a: "Absolutely. We provide warranty support, calibration services, and ongoing maintenance for all installations." },
];

export default function HomeTheaterHome() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: "", phone: "", city: "", requirement: "", budget: "", room_size: "" });
  const [submitting, setSubmitting] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

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

  // JSON-LD Schema
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
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white overflow-hidden">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[hsl(0,0%,4%)]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Speaker className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">ALV Home Theater</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/60">
            <Link to="/" className="hover:text-white transition-colors">Home</Link>
            <Link to="/about" className="hover:text-white transition-colors">About</Link>
            <Link to="/solutions" className="hover:text-white transition-colors">Solutions</Link>
            <Link to="/gallery" className="hover:text-white transition-colors">Gallery</Link>
            <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-white text-black hover:bg-white/90 rounded-xl" onClick={() => navigate("/contact")}>
              Free Consultation <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center">
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-medium">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              #1 Home Theater Experts in Udaipur
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
              Immersive
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Cinema</span>
              <br />
              At Home.
            </h1>
            <p className="text-lg text-white/50 max-w-lg leading-relaxed">
              Premium Dolby Atmos home theater installation, luxury cinema rooms, and professional audio solutions in Udaipur & Rajasthan.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-xl px-8 h-12 text-base font-semibold shadow-2xl shadow-white/10" onClick={() => document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" })}>
                Get Free Consultation <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          <div className="relative hidden lg:block h-[500px]" style={{ perspective: "1200px" }}>
            <div className="absolute top-0 right-10 w-56 h-72 rounded-3xl bg-gradient-to-br from-blue-600/30 to-blue-800/20 border border-white/10 backdrop-blur-sm p-6 flex flex-col justify-end shadow-2xl shadow-blue-500/10 transition-transform duration-700 hover:scale-105" style={{ transform: "rotateY(-15deg) rotateX(5deg)" }}>
              <Tv className="h-16 w-16 text-blue-400/60 mb-4" />
              <p className="text-lg font-bold text-white/90">Dolby Atmos</p>
              <p className="text-xs text-white/40 mt-1">7.1.4 Surround Sound</p>
            </div>
            <div className="absolute top-24 left-0 w-60 h-64 rounded-3xl bg-gradient-to-br from-purple-600/30 to-purple-900/20 border border-white/10 backdrop-blur-sm p-6 flex flex-col justify-end shadow-2xl shadow-purple-500/10 transition-transform duration-700 hover:scale-105" style={{ transform: "rotateY(10deg) rotateX(-5deg)" }}>
              <Film className="h-14 w-14 text-purple-400/60 mb-4" />
              <p className="text-lg font-bold text-white/90">4K Cinema</p>
              <p className="text-xs text-white/40 mt-1">Laser projection</p>
            </div>
            <div className="absolute bottom-0 right-0 w-52 h-60 rounded-3xl bg-gradient-to-br from-amber-500/30 to-amber-800/20 border border-white/10 backdrop-blur-sm p-6 flex flex-col justify-end shadow-2xl shadow-amber-500/10 transition-transform duration-700 hover:scale-105" style={{ transform: "rotateY(-8deg) rotateX(8deg)" }}>
              <Headphones className="h-14 w-14 text-amber-400/60 mb-4" />
              <p className="text-lg font-bold text-white/90">Multi-Room</p>
              <p className="text-xs text-white/40 mt-1">Whole-home audio</p>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Our Services</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Home Theater Solutions</h2>
            <p className="text-white/40 mt-4 max-w-2xl mx-auto">From consultation to calibration, we deliver end-to-end home theater experiences.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SERVICES.map(s => (
              <div key={s.title} className="group relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04] overflow-hidden">
                <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <s.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-white/40 leading-relaxed text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Why Choose Us</p>
              <h2 className="text-4xl font-bold tracking-tight mb-8">Premium Home Theater Experience</h2>
              <div className="space-y-4">
                {FEATURES.map(f => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-blue-400 shrink-0" />
                    <span className="text-white/70">{f}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/10 border border-white/5 p-12 text-center">
              <div className="text-6xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">50+</div>
              <p className="text-white/40 mt-2 text-lg">Home Theaters Installed</p>
              <div className="flex justify-center gap-1 mt-4">
                {[1,2,3,4,5].map(i => <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />)}
              </div>
              <p className="text-white/40 mt-2 text-sm">Rated 4.9/5 by our clients</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Client Reviews</p>
            <h2 className="text-4xl font-bold tracking-tight">What Our Clients Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
                <div className="flex gap-1 mb-4">{[1,2,3,4,5].map(i => <Star key={i} className="h-4 w-4 text-amber-400 fill-amber-400" />)}</div>
                <p className="text-sm text-white/60 leading-relaxed mb-4">"{t.text}"</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-white/40">{t.city}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Lead Capture Form */}
      <section id="consultation" className="py-24 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Get Started</p>
            <h2 className="text-4xl font-bold tracking-tight">Free Consultation</h2>
            <p className="text-white/40 mt-4">Tell us about your dream home theater and we'll design the perfect solution.</p>
          </div>
          <form onSubmit={handleLeadSubmit} className="rounded-3xl border border-white/10 bg-white/[0.03] p-8 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-white/60">Name *</Label>
                <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="Your full name" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60">Phone *</Label>
                <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+91 XXXXX XXXXX" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60">City</Label>
                <Input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="Udaipur" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-white/60">Budget Range</Label>
                <Select value={formData.budget} onValueChange={v => setFormData(p => ({ ...p, budget: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue placeholder="Select budget" /></SelectTrigger>
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
              <Label className="text-white/60">Room Size</Label>
              <Input value={formData.room_size} onChange={e => setFormData(p => ({ ...p, room_size: e.target.value }))} placeholder="e.g. 15x20 ft" className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/60">Requirement</Label>
              <Textarea value={formData.requirement} onChange={e => setFormData(p => ({ ...p, requirement: e.target.value }))} placeholder="Describe your home theater requirements..." className="bg-white/5 border-white/10 text-white placeholder:text-white/30" rows={3} />
            </div>
            <Button type="submit" disabled={submitting} className="w-full bg-white text-black hover:bg-white/90 rounded-xl h-12 text-base font-semibold">
              {submitting ? "Submitting..." : "Get Free Consultation"} <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </form>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, idx) => (
              <button key={idx} onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)} className="w-full text-left rounded-2xl border border-white/5 bg-white/[0.02] p-5 transition-all hover:border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold pr-4">{faq.q}</h3>
                  <ChevronRight className={`h-4 w-4 text-white/40 shrink-0 transition-transform ${expandedFaq === idx ? "rotate-90" : ""}`} />
                </div>
                {expandedFaq === idx && <p className="text-sm text-white/50 mt-3 leading-relaxed">{faq.a}</p>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Speaker className="h-4 w-4 text-white" />
              </div>
              <span className="text-base font-bold">ALV Home Theater</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <Link to="/about" className="hover:text-white/60">About</Link>
              <Link to="/solutions" className="hover:text-white/60">Solutions</Link>
              <Link to="/gallery" className="hover:text-white/60">Gallery</Link>
              <Link to="/contact" className="hover:text-white/60">Contact</Link>
              <Link to="/login" className="hover:text-white/60">Sign In</Link>
            </div>
            <p className="text-xs text-white/20">© {new Date().getFullYear()} ALV Store. Home Theater Solutions, Udaipur.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
