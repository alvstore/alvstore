import { useRef, useEffect, useState, Suspense, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const FRAMES = [
  { tier: "Bookshelf", caption: "Where it begins.", spec: "2-Way · 5″ Driver · Compact" },
  { tier: "Compact Tower", caption: "Where rooms become stages.", spec: "2-Way · Dual 5″ · Floorstand" },
  { tier: "Floor-Standing", caption: "Where you stop watching, and feel.", spec: "3-Way · Triple 6″ · Reference" },
  { tier: "Reference Tower", caption: "Where Luxury Meets Entertainment.", spec: "4-Way · Quad 8″ · Flagship" },
];

// ─── Parametric Speaker driven by progress 0..1 ───
function ParametricSpeaker({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const cabinetRef = useRef<THREE.Mesh>(null);
  const baseRef = useRef<THREE.Mesh>(null);
  const wooferRefs = useRef<(THREE.Group | null)[]>([]);
  const tweeterRef = useRef<THREE.Mesh>(null);
  const spotlightRef = useRef<THREE.SpotLight>(null);

  // Wood materials lerped via color
  const cabinetMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#8B6F47", roughness: 0.55, metalness: 0.15 }),
    []
  );

  useFrame((state) => {
    const p = progressRef.current; // 0..1
    const t = state.clock.elapsedTime;

    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.18 - 0.1;
      groupRef.current.position.y = Math.sin(t * 0.6) * 0.04 - 0.4;
    }

    if (cabinetRef.current) {
      // Cabinet grows from 1 → 3.4 in height, slight depth growth
      const h = 1.2 + p * 2.6;
      const w = 0.7 + p * 0.25;
      const d = 0.55 + p * 0.2;
      cabinetRef.current.scale.set(w, h / 1.2, d / 0.55);
      cabinetRef.current.position.y = (h - 1.2) / 2;
    }

    if (baseRef.current) {
      // Base appears > 0.4 progress
      const v = Math.max(0, (p - 0.35) / 0.65);
      baseRef.current.scale.set(0.9 + v * 0.3, v, 0.7 + v * 0.3);
      baseRef.current.position.y = -0.62;
      (baseRef.current.material as THREE.MeshStandardMaterial).opacity = v;
    }

    // Lerp wood color: oak (#C9A876) → walnut (#6B4423) → ebony (#2A1810)
    const c = new THREE.Color();
    if (p < 0.5) {
      c.lerpColors(new THREE.Color("#C9A876"), new THREE.Color("#6B4423"), p / 0.5);
    } else {
      c.lerpColors(new THREE.Color("#6B4423"), new THREE.Color("#2A1810"), (p - 0.5) / 0.5);
    }
    cabinetMat.color.copy(c);

    // Woofer positions distribute along cabinet height
    const cabinetTop = 1.2 + p * 2.6 - 0.2;
    const tweeterY = cabinetTop - 0.2;
    if (tweeterRef.current) tweeterRef.current.position.y = tweeterY;

    const wooferCount = Math.min(4, Math.floor(1 + p * 3.2));
    wooferRefs.current.forEach((w, i) => {
      if (!w) return;
      if (i < wooferCount) {
        w.visible = true;
        const span = (1.2 + p * 2.6) - 0.6;
        const startY = tweeterY - 0.4;
        const step = wooferCount > 1 ? span / (wooferCount + 0.5) : 0;
        w.position.y = startY - i * step;
        // Driver size grows slightly
        const ds = 0.85 + p * 0.5 + (i === wooferCount - 1 ? 0.1 : 0);
        w.scale.setScalar(ds);
      } else {
        w.visible = false;
      }
    });

    if (spotlightRef.current) {
      spotlightRef.current.intensity = 0.6 + p * 1.6;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Spot key light */}
      <spotLight
        ref={spotlightRef}
        position={[2.5, 4, 3]}
        angle={0.6}
        penumbra={0.6}
        intensity={0.8}
        color="#E8B86C"
        castShadow={false}
      />
      <pointLight position={[-2, 1, 2]} intensity={0.3} color="#C97B6E" />
      <ambientLight intensity={0.25} />

      {/* Base / floor plinth */}
      <mesh ref={baseRef} position={[0, -0.62, 0]}>
        <boxGeometry args={[0.95, 0.08, 0.8]} />
        <meshStandardMaterial color="#1A1228" roughness={0.4} metalness={0.6} transparent />
      </mesh>

      {/* Cabinet */}
      <mesh ref={cabinetRef} material={cabinetMat}>
        <boxGeometry args={[1, 1.2, 1]} />
      </mesh>

      {/* Front baffle accent (gold trim) */}
      <mesh position={[0, 0, 0.281]} scale={[0.7, 1, 1]}>
        <planeGeometry args={[1, 0.005]} />
        <meshStandardMaterial color="#E8B86C" emissive="#E8B86C" emissiveIntensity={0.3} />
      </mesh>

      {/* Tweeter */}
      <mesh ref={tweeterRef} position={[0, 0.7, 0.28]}>
        <circleGeometry args={[0.07, 24]} />
        <meshStandardMaterial color="#1a0f08" emissive="#E8B86C" emissiveIntensity={0.25} metalness={0.9} roughness={0.3} />
      </mesh>

      {/* Up to 4 woofers */}
      {[0, 1, 2, 3].map((i) => (
        <group
          key={i}
          ref={(el) => { wooferRefs.current[i] = el; }}
          position={[0, 0, 0.28]}
        >
          {/* Cone */}
          <mesh>
            <circleGeometry args={[0.18, 32]} />
            <meshStandardMaterial color="#0a0a12" roughness={0.7} metalness={0.4} />
          </mesh>
          {/* Dust cap */}
          <mesh position={[0, 0, 0.005]}>
            <circleGeometry args={[0.05, 24]} />
            <meshStandardMaterial color="#E8B86C" emissive="#E8B86C" emissiveIntensity={0.2} metalness={0.8} />
          </mesh>
          {/* Surround ring */}
          <mesh position={[0, 0, -0.001]}>
            <ringGeometry args={[0.18, 0.21, 32]} />
            <meshStandardMaterial color="#3d2817" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Floor reflection plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]}>
        <planeGeometry args={[5, 4]} />
        <meshStandardMaterial color="#0E0B14" metalness={0.6} roughness={0.4} />
      </mesh>
    </group>
  );
}

function SpeakerCanvas({ progressRef }: { progressRef: React.MutableRefObject<number> }) {
  return (
    <Canvas
      camera={{ position: [0, 0.6, 4.2], fov: 38 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <fog attach="fog" args={["#0E0B14", 5, 14]} />
        <ParametricSpeaker progressRef={progressRef} />
      </Suspense>
    </Canvas>
  );
}

// ─── Mobile fallback: 4 static frames in a strip ───
function MobileFrameStrip() {
  return (
    <div className="px-4 py-12 bg-stage-deep film-grain relative overflow-hidden">
      <div className="text-center mb-8 relative z-10">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-champagne mb-3">The Evolution</p>
        <h2 className="text-3xl font-bold text-warm" style={{ fontFamily: "'Cinzel', serif" }}>
          From Bookshelf <span className="text-champagne-gradient">to Reference</span>
        </h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide relative z-10">
        {FRAMES.map((f, i) => (
          <div key={i} className="film-frame bg-[#0E0B14] min-w-[200px] h-[280px] p-4 flex flex-col justify-between snap-center flex-shrink-0">
            <div className="flex-1 flex items-end justify-center">
              {/* Simple SVG speaker that grows */}
              <svg viewBox="0 0 60 200" className="h-full">
                <rect
                  x="20" y={180 - (40 + i * 35)}
                  width="20" height={40 + i * 35}
                  fill="url(#wood)" rx="2"
                />
                <defs>
                  <linearGradient id="wood" x1="0" x2="1">
                    <stop offset="0%" stopColor="#6B4423" />
                    <stop offset="100%" stopColor="#2A1810" />
                  </linearGradient>
                </defs>
                <circle cx="30" cy={180 - (40 + i * 35) + 10} r="3" fill="#E8B86C" />
                {Array.from({ length: Math.min(4, i + 1) }).map((_, j) => (
                  <circle key={j} cx="30" cy={180 - (40 + i * 35) + 25 + j * 18} r="6" fill="#0a0a12" stroke="#3d2817" strokeWidth="1" />
                ))}
              </svg>
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-champagne mb-1">{f.tier}</p>
              <p className="text-xs text-warm/70 italic">"{f.caption}"</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main: Pinned scroll-driven hero ───
export default function SpeakerEvolution() {
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const [activeFrame, setActiveFrame] = useState(0);

  useEffect(() => {
    if (isMobile) return;
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const trigger = ScrollTrigger.create({
        trigger: containerRef.current,
        start: "top top",
        end: "+=3000",
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const idx = Math.min(FRAMES.length - 1, Math.floor(self.progress * FRAMES.length));
          setActiveFrame(idx);
        },
      });
      return () => trigger.kill();
    }, containerRef);

    return () => ctx.revert();
  }, [isMobile]);

  if (isMobile) return <MobileFrameStrip />;

  const frame = FRAMES[activeFrame];

  return (
    <div ref={containerRef} className="relative h-screen overflow-hidden bg-stage-plum film-grain">
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(232,184,108,0.18), transparent 70%)" }} />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(201,123,110,0.12), transparent 70%)" }} />

      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* LEFT — Film frame with 3D speaker */}
        <div className="relative flex items-center justify-center h-full">
          <div className="film-frame w-full max-w-[480px] aspect-[3/4] bg-[#0a0710] relative overflow-hidden">
            {/* Frame label */}
            <div className="absolute top-3 left-3 z-20 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-champagne/30">
              <p className="text-[9px] uppercase tracking-[0.25em] text-champagne font-mono">
                Frame {String(activeFrame + 1).padStart(2, "0")} / 04
              </p>
            </div>
            <div className="absolute bottom-3 right-3 z-20 px-2 py-1 rounded bg-black/60 backdrop-blur-sm border border-champagne/30">
              <p className="text-[9px] uppercase tracking-[0.25em] text-champagne font-mono">REC ●</p>
            </div>
            <div className="absolute inset-0">
              <SpeakerCanvas progressRef={progressRef} />
            </div>
            {/* Scan-line overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-20"
              style={{
                backgroundImage: "repeating-linear-gradient(0deg, rgba(232,184,108,0.08) 0px, transparent 2px, transparent 4px)",
              }}
            />
          </div>
        </div>

        {/* RIGHT — Animated copy */}
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 bg-champagne/10 border border-champagne/30">
            <div className="h-1.5 w-1.5 rounded-full bg-champagne animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-champagne font-medium">
              ALV Store · Cinematic Audio
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeFrame}
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -20, filter: "blur(8px)" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-sm uppercase tracking-[0.3em] text-champagne-deep mb-3">
                {frame.tier}
              </p>
              <h1
                className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.05] mb-6 text-warm"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                {frame.caption.split(",").map((part, i) => (
                  <span key={i} className={i === 1 ? "block text-champagne-gradient" : "block"}>
                    {part.trim()}
                  </span>
                ))}
              </h1>
              <p className="text-sm text-warm/60 mb-8 font-mono">
                {frame.spec}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots */}
          <div className="flex gap-2 mb-8">
            {FRAMES.map((_, i) => (
              <div
                key={i}
                className="h-1 rounded-full transition-all duration-500"
                style={{
                  width: i === activeFrame ? 40 : 16,
                  background: i <= activeFrame ? "#E8B86C" : "rgba(232,184,108,0.2)",
                  boxShadow: i === activeFrame ? "0 0 12px rgba(232,184,108,0.6)" : "none",
                }}
              />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              className="px-7 py-3 rounded-lg text-sm font-semibold transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #F4D9A8, #E8B86C, #B8862E)",
                color: "#1A1228",
                boxShadow: "0 8px 30px rgba(232,184,108,0.35)",
              }}
              onClick={() => document.getElementById("services")?.scrollIntoView({ behavior: "smooth" })}
            >
              Explore Our Theaters
            </button>
            <button
              className="px-7 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{
                border: "1px solid rgba(232,184,108,0.4)",
                color: "#E8B86C",
                background: "rgba(232,184,108,0.05)",
              }}
              onClick={() => document.getElementById("consultation")?.scrollIntoView({ behavior: "smooth" })}
            >
              Book Consultation
            </button>
          </div>

          {/* Scroll cue */}
          <p className="absolute -bottom-12 left-0 text-[10px] uppercase tracking-[0.3em] text-warm/30">
            ↓ Scroll to evolve
          </p>
        </div>
      </div>
    </div>
  );
}
