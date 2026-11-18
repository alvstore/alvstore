import { useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Wrench, Shield, Zap, Headphones,
  Monitor, Smartphone, Speaker, Music, Star,
  CheckCircle, ChevronRight, Play,
} from "lucide-react";

const CATEGORIES = [
  {
    title: "Apple Products",
    desc: "iPhone, iPad, Mac, Apple Watch & accessories. Authorized sales with expert guidance.",
    icon: Smartphone,
    gradient: "from-blue-600 to-cyan-500",
    shadowColor: "shadow-blue-500/20",
  },
  {
    title: "Home Theater",
    desc: "Immersive cinema experiences. Projectors, AV receivers, Dolby Atmos setups & calibration.",
    icon: Monitor,
    gradient: "from-purple-600 to-pink-500",
    shadowColor: "shadow-purple-500/20",
  },
  {
    title: "Professional Audio",
    desc: "Studio monitors, PA systems, mixers & pro-grade equipment for professionals.",
    icon: Music,
    gradient: "from-amber-500 to-orange-600",
    shadowColor: "shadow-amber-500/20",
  },
];

const SERVICES = [
  { icon: Wrench, title: "Expert Repairs", desc: "Certified technicians for Apple & AV equipment" },
  { icon: Headphones, title: "Custom Installation", desc: "Professional home theater & audio setup" },
  { icon: Shield, title: "Extended Warranty", desc: "Peace of mind with comprehensive coverage" },
  { icon: Zap, title: "Trade-In Program", desc: "Upgrade your devices with best trade-in values" },
];

const BRANDS = ["Apple", "Sonos", "Bose", "JBL", "Harman Kardon", "Sony", "Denon", "Marantz", "KEF", "B&W", "Sennheiser", "Bang & Olufsen"];

const STATS = [
  { number: "500+", label: "Devices Repaired" },
  { number: "1000+", label: "Products Sold" },
  { number: "98%", label: "Satisfaction Rate" },
  { number: "5+", label: "Years Experience" },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[hsl(0,0%,4%)] text-white overflow-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[hsl(0,0%,4%)]/80 backdrop-blur-2xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Speaker className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">ALV Store</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/5" onClick={() => navigate("/login")}>Sign In</Button>
            <Button size="sm" className="bg-white text-black hover:bg-white/90 rounded-xl" onClick={() => navigate("/signup")}>
              Get Started <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center justify-center">
        {/* Ambient gradient orbs */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-medium backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              Premium Apple & Audio Experience
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05]">
              Sound.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Vision.</span>
              <br />
              Perfection.
            </h1>
            <p className="text-lg text-white/50 max-w-lg leading-relaxed">
              Your destination for Apple products, home theater systems, and professional audio equipment. Premium experience, expert service.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-xl px-8 h-12 text-base font-semibold shadow-2xl shadow-white/10" onClick={() => navigate("/signup")}>
                Explore Store <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button size="lg" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl h-12 px-6" onClick={() => navigate("/login")}>
                <Play className="h-4 w-4 mr-2 fill-current" /> Watch Demo
              </Button>
            </div>
          </div>

          {/* 3D Product Cards */}
          <div className="relative hidden lg:block h-[500px]" style={{ perspective: "1200px" }}>
            {/* Card 1 - iPhone silhouette */}
            <div
              className="absolute top-0 right-10 w-56 h-72 rounded-3xl bg-gradient-to-br from-blue-600/30 to-blue-800/20 border border-white/10 backdrop-blur-sm p-6 flex flex-col justify-end shadow-2xl shadow-blue-500/10 transition-transform duration-700 hover:scale-105"
              style={{ transform: "rotateY(-15deg) rotateX(5deg)" }}
            >
              <Smartphone className="h-16 w-16 text-blue-400/60 mb-4" />
              <p className="text-lg font-bold text-white/90">iPhone</p>
              <p className="text-xs text-white/40 mt-1">Latest models available</p>
            </div>

            {/* Card 2 - Home Theater */}
            <div
              className="absolute top-24 left-0 w-60 h-64 rounded-3xl bg-gradient-to-br from-purple-600/30 to-purple-900/20 border border-white/10 backdrop-blur-sm p-6 flex flex-col justify-end shadow-2xl shadow-purple-500/10 transition-transform duration-700 hover:scale-105"
              style={{ transform: "rotateY(10deg) rotateX(-5deg)" }}
            >
              <Monitor className="h-14 w-14 text-purple-400/60 mb-4" />
              <p className="text-lg font-bold text-white/90">Home Theater</p>
              <p className="text-xs text-white/40 mt-1">Cinematic experience</p>
            </div>

            {/* Card 3 - Audio */}
            <div
              className="absolute bottom-0 right-0 w-52 h-60 rounded-3xl bg-gradient-to-br from-amber-500/30 to-amber-800/20 border border-white/10 backdrop-blur-sm p-6 flex flex-col justify-end shadow-2xl shadow-amber-500/10 transition-transform duration-700 hover:scale-105"
              style={{ transform: "rotateY(-8deg) rotateX(8deg)" }}
            >
              <Headphones className="h-14 w-14 text-amber-400/60 mb-4" />
              <p className="text-lg font-bold text-white/90">Pro Audio</p>
              <p className="text-xs text-white/40 mt-1">Studio-grade sound</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Categories */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">Our Collections</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Premium Categories</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {CATEGORIES.map(cat => (
              <div
                key={cat.title}
                className={`group relative rounded-3xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-500 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-2xl ${cat.shadowColor} cursor-pointer overflow-hidden`}
                style={{ perspective: "600px" }}
              >
                <div className="transition-transform duration-500 group-hover:translate-y-[-4px]">
                  <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-6 shadow-lg ${cat.shadowColor}`}>
                    <cat.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{cat.title}</h3>
                  <p className="text-white/40 leading-relaxed text-sm">{cat.desc}</p>
                  <div className="flex items-center gap-2 mt-6 text-white/60 group-hover:text-white transition-colors">
                    <span className="text-sm font-medium">Explore</span>
                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
                {/* Hover glow */}
                <div className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${cat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-24 bg-white/[0.01] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-white/40 uppercase tracking-widest mb-3">What We Offer</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Expert Services</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map(s => (
              <div key={s.title} className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm hover:border-white/10 transition-all duration-300">
                <div className="h-12 w-12 rounded-xl bg-white/5 flex items-center justify-center mb-4">
                  <s.icon className="h-6 w-6 text-white/60" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{s.number}</p>
                <p className="text-sm text-white/40 mt-2 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brands Marquee */}
      <section className="py-16 border-y border-white/5 overflow-hidden">
        <div className="relative">
          <div className="flex animate-marquee gap-12 whitespace-nowrap">
            {[...BRANDS, ...BRANDS].map((brand, i) => (
              <span key={i} className="text-2xl font-bold text-white/10 tracking-wider uppercase flex-shrink-0">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-600/5 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium mb-8">
            <Star className="h-3.5 w-3.5 text-amber-400" /> Trusted by audio enthusiasts
          </div>
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Elevate your
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"> experience</span>
          </h2>
          <p className="text-lg text-white/40 max-w-xl mx-auto mb-10">
            Visit our store or get in touch for personalized recommendations and expert consultation.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 rounded-xl px-10 h-12 text-base font-semibold shadow-2xl shadow-white/10" onClick={() => navigate("/signup")}>
              Get Started <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl h-12 px-8" onClick={() => navigate("/login")}>
              Sign In
            </Button>
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
              <span className="text-base font-bold">ALV Store</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <span>Apple Products</span>
              <span>Home Theater</span>
              <span>Professional Audio</span>
              <span>Repairs</span>
            </div>
            <p className="text-xs text-white/20">© {new Date().getFullYear()} ALV Store. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Marquee animation style */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
