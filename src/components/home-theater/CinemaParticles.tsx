import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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
    const handler = () => {
      scrollRef.current = window.scrollY;
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    // Slow drift rotation
    pointsRef.current.rotation.y += delta * 0.02;
    pointsRef.current.rotation.x += delta * 0.008;
    // Scroll-based z parallax (zoom toward viewer)
    const scrollFactor = scrollRef.current * 0.002;
    pointsRef.current.position.z = scrollFactor;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
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
      <StarField />
    </Canvas>
  );
}
