import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function StarField() {
  const pointsRef = useRef<THREE.Points>(null);
  const scrollRef = useRef(0);
  const COUNT = 500;

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const goldR = 1, goldG = 0.843, goldB = 0;
    const amberR = 1, amberG = 0.549, amberB = 0;
    const whiteR = 0.96, whiteG = 0.94, whiteB = 0.91;

    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;

      const t = Math.random();
      if (t < 0.4) {
        col[i * 3] = goldR; col[i * 3 + 1] = goldG; col[i * 3 + 2] = goldB;
      } else if (t < 0.7) {
        col[i * 3] = amberR; col[i * 3 + 1] = amberG; col[i * 3 + 2] = amberB;
      } else {
        col[i * 3] = whiteR; col[i * 3 + 1] = whiteG; col[i * 3 + 2] = whiteB;
      }
    }
    return [pos, col];
  }, []);

  useEffect(() => {
    const handler = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.02;
    pointsRef.current.rotation.x += delta * 0.008;
    pointsRef.current.position.z = scrollRef.current * 0.002;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} vertexColors transparent opacity={0.8} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ─── Floating Speaker Box ─── */
function FloatingSpeaker({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const handler = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.3 + scrollRef.current * 0.001;
    ref.current.position.y = position[1] + Math.sin(t * 0.8) * 0.15;
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.3}>
      <group ref={ref} position={position}>
        {/* Speaker body */}
        <mesh>
          <boxGeometry args={[0.5, 0.8, 0.4]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.9} />
        </mesh>
        {/* Cone */}
        <mesh position={[0, 0.1, 0.21]}>
          <circleGeometry args={[0.15, 32]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} roughness={0.5} metalness={0.8} />
        </mesh>
        {/* Tweeter */}
        <mesh position={[0, -0.2, 0.21]}>
          <circleGeometry args={[0.06, 16]} />
          <meshStandardMaterial color="#FF8C00" emissive="#FF8C00" emissiveIntensity={0.4} />
        </mesh>
      </group>
    </Float>
  );
}

/* ─── Floating Projector ─── */
function FloatingProjector({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const handler = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = -t * 0.2 + scrollRef.current * 0.0008;
    ref.current.rotation.z = Math.sin(t * 0.5) * 0.05;
  });

  return (
    <Float speed={1} rotationIntensity={0.15} floatIntensity={0.4}>
      <group ref={ref} position={position}>
        {/* Body */}
        <mesh>
          <boxGeometry args={[0.7, 0.25, 0.5]} />
          <meshStandardMaterial color="#0f0f1a" roughness={0.2} metalness={0.95} />
        </mesh>
        {/* Lens */}
        <mesh position={[0.36, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.1, 0.12, 16]} />
          <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.6} transparent opacity={0.9} />
        </mesh>
      </group>
    </Float>
  );
}

/* ─── Sound Wave Rings ─── */
function SoundRing({ position, delay = 0 }: { position: [number, number, number]; delay?: number }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime + delay;
    const scale = 0.5 + Math.sin(t * 2) * 0.3;
    ref.current.scale.set(scale, scale, scale);
    (ref.current.material as THREE.MeshStandardMaterial).opacity = 0.12 + Math.sin(t * 2) * 0.08;
    ref.current.rotation.x = t * 0.3;
  });

  return (
    <mesh ref={ref} position={position}>
      <torusGeometry args={[0.6, 0.015, 16, 48]} />
      <meshStandardMaterial color="#FFD700" transparent opacity={0.15} emissive="#FFD700" emissiveIntensity={0.5} />
    </mesh>
  );
}

/* ─── Gold Dust Particles (foreground, faster scroll) ─── */
function GoldDust() {
  const ref = useRef<THREE.Points>(null);
  const scrollRef = useRef(0);
  const COUNT = 120;

  const positions = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 + 2;
    }
    return pos;
  }, []);

  useEffect(() => {
    const handler = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.01;
    ref.current.position.z = scrollRef.current * 0.004;
    ref.current.position.y = -scrollRef.current * 0.001;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.025} color="#FFD700" transparent opacity={0.5} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export default function CinemaParticles() {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 60 }}
      style={{ position: "absolute", inset: 0 }}
      gl={{ antialias: false, alpha: true }}
      dpr={[1, 1.5]}
    >
      <ambientLight intensity={0.15} />
      <pointLight position={[-4, 3, 2]} intensity={0.4} color="#FFD700" />
      <pointLight position={[4, -2, 3]} intensity={0.3} color="#FF8C00" />

      <StarField />
      <GoldDust />

      {/* Floating 3D objects */}
      <FloatingSpeaker position={[-3.5, 1.5, -2]} />
      <FloatingSpeaker position={[3.8, -1.2, -3]} />
      <FloatingProjector position={[0, 2.5, -4]} />

      {/* Sound wave rings */}
      <SoundRing position={[-3.5, 1.5, -1.5]} delay={0} />
      <SoundRing position={[3.8, -1.2, -2.5]} delay={1.5} />
      <SoundRing position={[0, 0, -3]} delay={3} />
    </Canvas>
  );
}
