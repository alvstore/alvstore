import { useState } from "react";
import { Monitor, Volume2, Armchair, Sparkles } from "lucide-react";

const ROOM_SIZES = [
  { id: "small", label: "Small", desc: "10×12 ft", icon: "🏠" },
  { id: "medium", label: "Medium", desc: "15×20 ft", icon: "🏡" },
  { id: "large", label: "Large", desc: "20×30 ft+", icon: "🏰" },
];

const BUDGETS = [
  { id: "basic", label: "₹2L – ₹5L", tier: "Essential" },
  { id: "premium", label: "₹5L – ₹15L", tier: "Premium" },
  { id: "ultra", label: "₹15L+", tier: "Ultra Luxury" },
];

const SETUPS = [
  { id: "stereo", label: "5.1 Surround", desc: "Classic home theater" },
  { id: "atmos", label: "7.1.4 Dolby Atmos", desc: "Immersive 3D sound" },
  { id: "cinema", label: "Dedicated Cinema", desc: "Full cinema room" },
];

interface Config {
  room: string;
  budget: string;
  setup: string;
}

const RECOMMENDATIONS: Record<string, { title: string; features: string[]; estimate: string }> = {
  "small-basic-stereo": { title: "Compact Theater", features: ["55\" 4K OLED TV", "5.1 Soundbar System", "Basic acoustic panels", "Smart remote control"], estimate: "₹2.5L – ₹4L" },
  "small-basic-atmos": { title: "Mini Atmos Setup", features: ["65\" 4K TV", "5.1.2 Atmos soundbar", "2 upfiring speakers", "Room calibration"], estimate: "₹3.5L – ₹5L" },
  "small-basic-cinema": { title: "Compact Cinema", features: ["100\" motorized screen", "HD projector", "5.1 in-ceiling speakers", "Blackout curtains"], estimate: "₹4L – ₹5L" },
  "medium-premium-stereo": { title: "Premium Surround", features: ["75\" 4K OLED", "7.1 floorstanding speakers", "AV receiver (Denon/Marantz)", "Acoustic treatment", "Smart lighting"], estimate: "₹6L – ₹10L" },
  "medium-premium-atmos": { title: "Dolby Atmos Theater", features: ["120\" ALR screen", "4K laser projector", "7.1.4 Dolby Atmos", "In-ceiling Atmos speakers", "Full acoustic treatment", "Tiered seating for 6"], estimate: "₹8L – ₹15L" },
  "medium-premium-cinema": { title: "Home Cinema Room", features: ["130\" fixed frame screen", "4K HDR projector", "7.2.4 Atmos system", "Acoustic panels + bass traps", "Motorized recliners", "LED ambient lighting"], estimate: "₹10L – ₹15L" },
  "large-ultra-stereo": { title: "Executive Surround", features: ["85\" 8K TV", "B&W / KEF reference speakers", "McIntosh amplification", "Custom furniture", "Whole-home integration"], estimate: "₹15L – ₹20L" },
  "large-ultra-atmos": { title: "Reference Atmos Theater", features: ["150\" 4K screen", "JVC/Sony native 4K projector", "9.2.6 Dolby Atmos", "Full room acoustic design", "THX certification ready", "Custom seating for 10+"], estimate: "₹18L – ₹30L" },
  "large-ultra-cinema": { title: "Ultra Luxury Cinema", features: ["180\" screen", "Dual projector system", "13.2.8 Atmos + DTS:X Pro", "ISF calibration", "Custom interior design", "Bar + lobby area", "Starlight ceiling"], estimate: "₹25L – ₹50L+" },
};

function getRecommendation(config: Config) {
  const key = `${config.room}-${config.budget}-${config.setup}`;
  return RECOMMENDATIONS[key] || {
    title: "Custom Configuration",
    features: ["Tailored to your needs", "Professional consultation", "Best-in-class equipment", "Expert installation"],
    estimate: "Contact for quote",
  };
}

export default function Configurator() {
  const [config, setConfig] = useState<Config>({ room: "", budget: "", setup: "" });
  const recommendation = config.room && config.budget && config.setup ? getRecommendation(config) : null;

  return (
    <section className="py-24 relative" id="configurator">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-medium mb-4">
            <Sparkles className="h-3.5 w-3.5" /> Interactive Tool
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Design Your Theater</h2>
          <p className="text-white/40 mt-4 max-w-2xl mx-auto">Configure your dream setup and get instant recommendations.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Selectors */}
          <div className="space-y-8">
            {/* Room Size */}
            <div>
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Armchair className="h-4 w-4" /> Room Size
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {ROOM_SIZES.map(r => (
                  <button key={r.id} onClick={() => setConfig(p => ({ ...p, room: r.id }))}
                    className={`rounded-2xl border p-4 text-center transition-all duration-300 ${config.room === r.id ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
                    <div className="text-2xl mb-2">{r.icon}</div>
                    <p className="text-sm font-semibold">{r.label}</p>
                    <p className="text-xs text-white/40 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Budget */}
            <div>
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="text-base">💰</span> Budget Range
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {BUDGETS.map(b => (
                  <button key={b.id} onClick={() => setConfig(p => ({ ...p, budget: b.id }))}
                    className={`rounded-2xl border p-4 text-center transition-all duration-300 ${config.budget === b.id ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
                    <p className="text-xs text-white/40 mb-1">{b.tier}</p>
                    <p className="text-sm font-semibold">{b.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Setup Type */}
            <div>
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Setup Type
              </h3>
              <div className="space-y-3">
                {SETUPS.map(s => (
                  <button key={s.id} onClick={() => setConfig(p => ({ ...p, setup: s.id }))}
                    className={`w-full rounded-2xl border p-4 text-left transition-all duration-300 flex items-center gap-4 ${config.setup === s.id ? "border-primary bg-primary/10 shadow-lg shadow-primary/20" : "border-white/5 bg-white/[0.02] hover:border-white/10"}`}>
                    <Monitor className={`h-5 w-5 ${config.setup === s.id ? "text-primary" : "text-white/30"}`} />
                    <div>
                      <p className="text-sm font-semibold">{s.label}</p>
                      <p className="text-xs text-white/40">{s.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div className="flex items-center">
            {recommendation ? (
              <div className="w-full rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-white/[0.02] to-transparent p-8 space-y-6 animate-in fade-in duration-500">
                <div>
                  <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-2">Recommended Setup</p>
                  <h3 className="text-2xl font-bold">{recommendation.title}</h3>
                </div>
                <div className="space-y-3">
                  {recommendation.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="text-sm text-white/70">{f}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs text-white/40 mb-1">Estimated Investment</p>
                  <p className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{recommendation.estimate}</p>
                </div>
                <button onClick={() => document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" })}
                  className="w-full rounded-xl bg-primary text-primary-foreground py-3 font-semibold text-sm hover:bg-primary/90 transition-colors">
                  Get Detailed Quote →
                </button>
              </div>
            ) : (
              <div className="w-full rounded-3xl border border-white/5 bg-white/[0.02] p-12 text-center">
                <div className="text-5xl mb-4">🎬</div>
                <p className="text-white/40">Select room size, budget, and setup type to see your personalized recommendation.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
