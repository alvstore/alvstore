import { useRef, useEffect, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function TheaterRoom() {
  const groupRef = useRef<THREE.Group>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const handler = () => { scrollRef.current = window.scrollY; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    // Scroll-linked rotation reveal
    const scrollNorm = Math.min(scrollRef.current / 1500, 1);
    groupRef.current.rotation.y = -0.6 + scrollNorm * 0.8;
    groupRef.current.rotation.x = -0.15 + scrollNorm * 0.1;
    groupRef.current.position.y = -0.5 + Math.sin(t * 0.3) * 0.05;
  });

  const wallMat = <meshStandardMaterial color="#0a0a1a" wireframe transparent opacity={0.4} />;
  const screenMat = <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.3} transparent opacity={0.6} />;
  const seatMat = <meshStandardMaterial color="#1a1a2e" roughness={0.8} />;

  return (
    <group ref={groupRef} scale={0.8}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}>
        <planeGeometry args={[6, 5]} />
        <meshStandardMaterial color="#050510" wireframe transparent opacity={0.3} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 0.5, -2.5]}>
        <planeGeometry args={[6, 4]} />
        {wallMat}
      </mesh>

      {/* Left wall */}
      <mesh position={[-3, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[5, 4]} />
        {wallMat}
      </mesh>

      {/* Right wall */}
      <mesh position={[3, 0.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[5, 4]} />
        {wallMat}
      </mesh>

      {/* Screen */}
      <mesh position={[0, 0.8, -2.4]}>
        <planeGeometry args={[3.5, 1.8]} />
        {screenMat}
      </mesh>

      {/* Seats - 2 rows */}
      {[-1.2, -0.4, 0.4, 1.2].map((x, i) => (
        <group key={`seat1-${i}`}>
          <mesh position={[x, -1.2, 0.5]}>
            <boxGeometry args={[0.5, 0.3, 0.4]} />
            {seatMat}
          </mesh>
          <mesh position={[x, -0.9, 0.3]}>
            <boxGeometry args={[0.5, 0.35, 0.08]} />
            {seatMat}
          </mesh>
        </group>
      ))}
      {[-0.8, 0, 0.8].map((x, i) => (
        <group key={`seat2-${i}`}>
          <mesh position={[x, -1.2, 1.5]}>
            <boxGeometry args={[0.5, 0.3, 0.4]} />
            {seatMat}
          </mesh>
          <mesh position={[x, -0.9, 1.3]}>
            <boxGeometry args={[0.5, 0.35, 0.08]} />
            {seatMat}
          </mesh>
        </group>
      ))}

      {/* Speaker cones on walls */}
      <mesh position={[-2.9, 0.5, -1]} rotation={[0, Math.PI / 2, 0]}>
        <coneGeometry args={[0.15, 0.2, 8]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[2.9, 0.5, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <coneGeometry args={[0.15, 0.2, 8]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.4} />
      </mesh>

      {/* Accent lights */}
      <pointLight position={[0, 1.5, -2]} intensity={0.6} color="#FFD700" distance={5} />
      <pointLight position={[-2.5, 0, 0]} intensity={0.3} color="#FF8C00" distance={4} />
      <pointLight position={[2.5, 0, 0]} intensity={0.3} color="#FF8C00" distance={4} />
    </group>
  );
}

export default function TheaterRoom3D() {
  return (
    <div className="w-full h-[500px] md:h-[600px] relative">
      <Canvas camera={{ position: [0, 1, 5], fov: 50 }} dpr={[1, 1.5]} gl={{ alpha: true, antialias: false }}>
        <Suspense fallback={null}>
          <fog attach="fog" args={["#000000", 4, 12]} />
          <ambientLight intensity={0.1} />
          <TheaterRoom />
        </Suspense>
      </Canvas>
    </div>
  );
}
