import { useRef, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Environment, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function Speaker({ position, scale = 1, color = "#6366f1" }: { position: [number, number, number]; scale?: number; color?: string }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });
  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <mesh ref={mesh} position={position} scale={scale}>
        <boxGeometry args={[0.6, 1, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Speaker cone */}
      <mesh position={[position[0], position[1], position[2] + 0.26]} scale={scale}>
        <circleGeometry args={[0.2, 32]} />
        <meshStandardMaterial color="#111" roughness={0.5} metalness={0.9} />
      </mesh>
    </Float>
  );
}

function Screen() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mesh.current) {
      const material = mesh.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });
  return (
    <mesh ref={mesh} position={[0, 0.5, -2]}>
      <planeGeometry args={[4, 2.2]} />
      <meshStandardMaterial color="#1a1a2e" emissive="#4338ca" emissiveIntensity={0.3} roughness={0.1} metalness={0.9} />
    </mesh>
  );
}

function SoundWave({ position, delay = 0 }: { position: [number, number, number]; delay?: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (mesh.current) {
      const t = state.clock.elapsedTime + delay;
      const scale = 0.5 + Math.sin(t * 3) * 0.3;
      mesh.current.scale.set(scale, scale, scale);
      (mesh.current.material as THREE.MeshStandardMaterial).opacity = 0.15 + Math.sin(t * 3) * 0.1;
    }
  });
  return (
    <mesh ref={mesh} position={position}>
      <torusGeometry args={[0.8, 0.02, 16, 64]} />
      <meshStandardMaterial color="#818cf8" transparent opacity={0.2} emissive="#818cf8" emissiveIntensity={0.5} />
    </mesh>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    camera.position.x = Math.sin(t * 0.15) * 0.3;
    camera.position.y = 0.5 + Math.sin(t * 0.2) * 0.15;
    camera.lookAt(0, 0, -1);
  });
  return null;
}

function RoomElements() {
  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#0a0a0f" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 1, -3]}>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial color="#0f0f1a" roughness={0.9} />
      </mesh>

      <Screen />

      {/* Speakers */}
      <Speaker position={[-2.5, -0.2, -1.5]} color="#2d2d4a" />
      <Speaker position={[2.5, -0.2, -1.5]} color="#2d2d4a" />
      <Speaker position={[-1.5, 1.5, -2.5]} scale={0.6} color="#3d3d5c" />
      <Speaker position={[1.5, 1.5, -2.5]} scale={0.6} color="#3d3d5c" />

      {/* Sound waves */}
      <SoundWave position={[-2.5, 0, -0.5]} delay={0} />
      <SoundWave position={[2.5, 0, -0.5]} delay={1} />
      <SoundWave position={[0, 0.5, -1.5]} delay={2} />

      {/* Ambient orb */}
      <Float speed={1.5} floatIntensity={0.8}>
        <mesh position={[0, 2, -1]}>
          <sphereGeometry args={[0.15, 32, 32]} />
          <MeshDistortMaterial color="#a78bfa" emissive="#7c3aed" emissiveIntensity={2} distort={0.4} speed={3} transparent opacity={0.6} />
        </mesh>
      </Float>

      {/* Accent lights */}
      <pointLight position={[-3, 2, -1]} intensity={0.5} color="#6366f1" />
      <pointLight position={[3, 2, -1]} intensity={0.5} color="#8b5cf6" />
      <pointLight position={[0, 3, 0]} intensity={0.3} color="#a78bfa" />
    </>
  );
}

export default function TheaterScene() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0.5, 3], fov: 60 }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <fog attach="fog" args={["#050510", 3, 12]} />
          <ambientLight intensity={0.15} />
          <directionalLight position={[5, 5, 5]} intensity={0.3} />
          <CameraRig />
          <RoomElements />
          <Environment preset="night" />
        </Suspense>
      </Canvas>
    </div>
  );
}
