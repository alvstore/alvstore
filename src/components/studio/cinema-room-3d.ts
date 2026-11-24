/**
 * Realistic 3D Private Cinema Room Scene using Three.js.
 *
 * Implements a photorealistic architectural screening room with PBR materials,
 * volumetric 4K laser projector beam, physical loudspeaker cabinets with
 * animated driver excursion physics, Dolby Atmos downward acoustic cones,
 * interactive 3D ray tracing, and mouse/touch orbital parallax.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RoomConfigId } from "./SpatialRoomVisualizer";

export interface CinemaRoomOptions {
  configId: RoomConfigId;
  isSimulating: boolean;
  reducedMotion: boolean;
  onSpeakerSelect?: (speakerId: string | null) => void;
}

export interface CinemaRoomHandle {
  setConfig: (configId: RoomConfigId) => void;
  setSimulating: (simulating: boolean) => void;
  setHoveredSpeaker: (speakerId: string | null) => void;
  setSweetSpotFocus: (focus: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  resetCamera: () => void;
  resize: () => void;
  destroy: () => void;
}

interface Speaker3DDef {
  id: string;
  code: string;
  name: string;
  role: "screen" | "surround" | "subwoofer" | "height";
  pos: [number, number, number]; // x, y, z in meters
  rot: [number, number, number]; // pitch, yaw, roll in radians
}

const ALL_SPEAKERS_3D: Record<string, Speaker3DDef> = {
  L: {
    id: "L",
    code: "L",
    name: "Front Left Channel",
    role: "screen",
    pos: [-2.15, 0, -3.55],
    rot: [0, Math.PI / 12, 0],
  },
  C: {
    id: "C",
    code: "C",
    name: "Center Channel",
    role: "screen",
    pos: [0, 0.45, -3.65],
    rot: [0, 0, 0],
  },
  R: {
    id: "R",
    code: "R",
    name: "Front Right Channel",
    role: "screen",
    pos: [2.15, 0, -3.55],
    rot: [0, -Math.PI / 12, 0],
  },
  SUB1: {
    id: "SUB1",
    code: "SUB 1",
    name: "Primary Infrasonic Subwoofer",
    role: "subwoofer",
    pos: [-2.9, 0, -3.1],
    rot: [0, Math.PI / 6, 0],
  },
  SUB2: {
    id: "SUB2",
    code: "SUB 2",
    name: "Secondary Axial Subwoofer",
    role: "subwoofer",
    pos: [2.9, 0, 2.8],
    rot: [0, -Math.PI * 0.85, 0],
  },
  SL: {
    id: "SL",
    code: "SL",
    name: "Surround Left",
    role: "surround",
    pos: [-3.45, 1.25, 0.85],
    rot: [0, Math.PI / 2, 0],
  },
  SR: {
    id: "SR",
    code: "SR",
    name: "Surround Right",
    role: "surround",
    pos: [3.45, 1.25, 0.85],
    rot: [0, -Math.PI / 2, 0],
  },
  SBL: {
    id: "SBL",
    code: "SBL",
    name: "Surround Back Left",
    role: "surround",
    pos: [-1.45, 1.35, 3.85],
    rot: [0, Math.PI * 0.9, 0],
  },
  SBR: {
    id: "SBR",
    code: "SBR",
    name: "Surround Back Right",
    role: "surround",
    pos: [1.45, 1.35, 3.85],
    rot: [0, -Math.PI * 0.9, 0],
  },
  TML: {
    id: "TML",
    code: "TML",
    name: "Top Middle Left (Atmos)",
    role: "height",
    pos: [-1.2, 2.75, 0.75],
    rot: [Math.PI / 2, 0, 0],
  },
  TMR: {
    id: "TMR",
    code: "TMR",
    name: "Top Middle Right (Atmos)",
    role: "height",
    pos: [1.2, 2.75, 0.75],
    rot: [Math.PI / 2, 0, 0],
  },
  TFL: {
    id: "TFL",
    code: "TFL",
    name: "Top Front Left (Atmos)",
    role: "height",
    pos: [-1.2, 2.75, -1.2],
    rot: [Math.PI / 2, 0, 0],
  },
  TFR: {
    id: "TFR",
    code: "TFR",
    name: "Top Front Right (Atmos)",
    role: "height",
    pos: [1.2, 2.75, -1.2],
    rot: [Math.PI / 2, 0, 0],
  },
  TRL: {
    id: "TRL",
    code: "TRL",
    name: "Top Rear Left (Atmos)",
    role: "height",
    pos: [-1.2, 2.75, 2.4],
    rot: [Math.PI / 2, 0, 0],
  },
  TRR: {
    id: "TRR",
    code: "TRR",
    name: "Top Rear Right (Atmos)",
    role: "height",
    pos: [1.2, 2.75, 2.4],
    rot: [Math.PI / 2, 0, 0],
  },
};

const CONFIG_SPEAKERS_3D: Record<RoomConfigId, string[]> = {
  "5.1": ["L", "C", "R", "SUB1", "SL", "SR"],
  "5.1.2": ["L", "C", "R", "SUB1", "SL", "SR", "TML", "TMR"],
  "7.2.2": ["L", "C", "R", "SUB1", "SUB2", "SL", "SR", "SBL", "SBR", "TML", "TMR"],
  "7.2.4": ["L", "C", "R", "SUB1", "SUB2", "SL", "SR", "SBL", "SBR", "TFL", "TFR", "TRL", "TRR"],
};

export function createCinemaRoomScene(
  canvas: HTMLCanvasElement,
  options: CinemaRoomOptions,
): CinemaRoomHandle | null {
  const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
  if (!gl) return null;

  let currentConfig = options.configId;
  let isSimulating = options.isSimulating;
  let isReducedMotion = options.reducedMotion;
  let hoveredSpeakerId: string | null = null;
  let isSweetSpotFocused = false;

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e1012);

  const camera = new THREE.PerspectiveCamera(46, canvas.clientWidth / canvas.clientHeight, 0.1, 40);
  const DEFAULT_CAM_POS = new THREE.Vector3(3.8, 3.2, 5.8);
  const DEFAULT_TARGET = new THREE.Vector3(0, 0.95, -0.4);
  camera.position.copy(DEFAULT_CAM_POS);
  camera.lookAt(DEFAULT_TARGET);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Shared PBR Materials
  const mats = {
    floor: new THREE.MeshStandardMaterial({
      color: 0x141618,
      roughness: 0.38,
      metalness: 0.12,
    }),
    carpet: new THREE.MeshStandardMaterial({
      color: 0x191c1f,
      roughness: 0.92,
      metalness: 0.02,
    }),
    acousticWall: new THREE.MeshStandardMaterial({
      color: 0x181a1c,
      roughness: 0.85,
      metalness: 0.04,
    }),
    slatWood: new THREE.MeshStandardMaterial({
      color: 0x30241b,
      roughness: 0.42,
      metalness: 0.08,
    }),
    proscenium: new THREE.MeshStandardMaterial({
      color: 0x0c0d0f,
      roughness: 0.95,
      metalness: 0.0,
    }),
    screenFrame: new THREE.MeshStandardMaterial({
      color: 0x111214,
      roughness: 0.8,
      metalness: 0.1,
    }),
    screenFabric: new THREE.MeshStandardMaterial({
      color: 0xf5f0e1,
      emissive: 0xfff0d4,
      emissiveIntensity: 0.52,
      roughness: 0.65,
      metalness: 0.0,
    }),
    speakerCabinet: new THREE.MeshStandardMaterial({
      color: 0x1d2023,
      roughness: 0.45,
      metalness: 0.28,
    }),
    brassTrim: new THREE.MeshStandardMaterial({
      color: 0xc49a57,
      roughness: 0.3,
      metalness: 0.95,
    }),
    driverCone: new THREE.MeshStandardMaterial({
      color: 0x121416,
      roughness: 0.55,
      metalness: 0.4,
    }),
    reclinerLeather: new THREE.MeshStandardMaterial({
      color: 0x1f2226,
      roughness: 0.62,
      metalness: 0.14,
    }),
    laserRay: new THREE.MeshBasicMaterial({
      color: 0xf3d59b,
      transparent: true,
      opacity: 0.88,
    }),
    waveRing: new THREE.MeshBasicMaterial({
      color: 0xe2ba7a,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };

  // Lighting Rig
  const ambientLight = new THREE.AmbientLight(0xffeedd, 0.7);
  scene.add(ambientLight);

  // Soft directional down-light from proscenium
  const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.4);
  keyLight.position.set(2.5, 5, 2);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 15;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // Warm screen bounce glow (simulating 4K projection bounce on room)
  const screenGlowLight = new THREE.PointLight(0xffe8c2, 2.2, 7.5, 1.6);
  screenGlowLight.position.set(0, 1.4, -3.2);
  scene.add(screenGlowLight);

  // Warm rear ceiling accent
  const rearAccent = new THREE.PointLight(0xb28a4f, 0.8, 6.0);
  rearAccent.position.set(0, 2.8, 3.8);
  scene.add(rearAccent);

  // Room Shell (Floor, Acoustic Walls, Proscenium)
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);

  // 1. Floor
  const floorGeo = new THREE.PlaneGeometry(8, 10);
  const floorMesh = new THREE.Mesh(floorGeo, mats.floor);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  roomGroup.add(floorMesh);

  // Center Carpet
  const carpetGeo = new THREE.PlaneGeometry(4.4, 6.6);
  const carpetMesh = new THREE.Mesh(carpetGeo, mats.carpet);
  carpetMesh.rotation.x = -Math.PI / 2;
  carpetMesh.position.set(0, 0.005, 0.6);
  carpetMesh.receiveShadow = true;
  roomGroup.add(carpetMesh);

  // 2. Front Proscenium Baffle Wall
  const prosceniumMesh = new THREE.Mesh(
    new THREE.BoxGeometry(8, 3.4, 0.4),
    mats.proscenium,
  );
  prosceniumMesh.position.set(0, 1.7, -4.0);
  prosceniumMesh.receiveShadow = true;
  roomGroup.add(prosceniumMesh);

  // 3. Side Acoustic Walls with Timber Diffusers
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 10), mats.acousticWall);
  leftWall.position.set(-3.95, 1.7, 0);
  roomGroup.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 10), mats.acousticWall);
  rightWall.position.set(3.95, 1.7, 0);
  roomGroup.add(rightWall);

  // 4. Acoustic Diffuser Slats (Vertical 3D wooden ribs on walls)
  [-3.75, 3.75].forEach(xPos => {
    for (let z = -2.5; z <= 2.5; z += 0.45) {
      const slat = new THREE.Mesh(new RoundedBoxGeometry(0.08, 2.2, 0.06, 2, 0.01), mats.slatWood);
      slat.position.set(xPos, 1.45, z);
      slat.castShadow = true;
      slat.receiveShadow = true;
      roomGroup.add(slat);
    }
  });

  // 5. 160″ 4K Curved Reference Screen
  const screenGroup = new THREE.Group();
  screenGroup.position.set(0, 1.45, -3.72);
  roomGroup.add(screenGroup);

  const screenFrame = new THREE.Mesh(
    new RoundedBoxGeometry(4.8, 2.15, 0.08, 3, 0.02),
    mats.screenFrame,
  );
  screenFrame.castShadow = true;
  screenGroup.add(screenFrame);

  const screenSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 1.95),
    mats.screenFabric,
  );
  screenSurface.position.z = 0.045;
  screenGroup.add(screenSurface);

  // 6. Volumetric 4K Projector Light Beam
  const projectorBeamGeo = new THREE.CylinderGeometry(0.08, 2.3, 7.8, 32, 1, true);
  const projectorBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffedd2,
    transparent: true,
    opacity: 0.075,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const projectorBeam = new THREE.Mesh(projectorBeamGeo, projectorBeamMat);
  projectorBeam.position.set(0, 1.9, 0.1);
  projectorBeam.rotation.x = Math.PI / 2 - 0.16;
  roomGroup.add(projectorBeam);

  // Ceiling Projector Housing
  const projectorBox = new THREE.Mesh(
    new RoundedBoxGeometry(0.5, 0.25, 0.45, 2, 0.02),
    mats.speakerCabinet,
  );
  projectorBox.position.set(0, 2.65, 3.8);
  roomGroup.add(projectorBox);

  // 7. VIP Cinema Recliner (The Sweet Spot)
  const reclinerGroup = new THREE.Group();
  reclinerGroup.position.set(0, 0, 1.2);
  roomGroup.add(reclinerGroup);

  // Chair base
  const seatBase = new THREE.Mesh(
    new RoundedBoxGeometry(0.85, 0.38, 0.95, 3, 0.04),
    mats.reclinerLeather,
  );
  seatBase.position.y = 0.22;
  seatBase.castShadow = true;
  seatBase.receiveShadow = true;
  reclinerGroup.add(seatBase);

  // Backrest & Headrest
  const backrest = new THREE.Mesh(
    new RoundedBoxGeometry(0.72, 0.85, 0.24, 3, 0.03),
    mats.reclinerLeather,
  );
  backrest.position.set(0, 0.72, 0.36);
  backrest.rotation.x = -0.12;
  backrest.castShadow = true;
  reclinerGroup.add(backrest);

  const headrest = new THREE.Mesh(
    new RoundedBoxGeometry(0.46, 0.22, 0.16, 2, 0.02),
    mats.brassTrim,
  );
  headrest.position.set(0, 1.18, 0.44);
  reclinerGroup.add(headrest);

  // Armrests
  [-0.48, 0.48].forEach(x => {
    const arm = new THREE.Mesh(
      new RoundedBoxGeometry(0.18, 0.52, 0.9, 2, 0.03),
      mats.reclinerLeather,
    );
    arm.position.set(x, 0.38, 0.05);
    arm.castShadow = true;
    reclinerGroup.add(arm);
  });

  // Sweet Spot Target Halo on Floor
  const sweetSpotRingGeo = new THREE.RingGeometry(0.9, 0.98, 48);
  const sweetSpotRingMat = new THREE.MeshBasicMaterial({
    color: 0xb28a4f,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
  });
  const sweetSpotRing = new THREE.Mesh(sweetSpotRingGeo, sweetSpotRingMat);
  sweetSpotRing.rotation.x = -Math.PI / 2;
  sweetSpotRing.position.set(0, 0.01, 1.2);
  roomGroup.add(sweetSpotRing);

  // 8. Physical 3D Loudspeaker Nodes Registry
  const speakerMeshes: Map<
    string,
    {
      group: THREE.Group;
      def: Speaker3DDef;
      wooferCone?: THREE.Mesh;
      pulseRing?: THREE.Mesh;
    }
  > = new Map();

  const rayLinesGroup = new THREE.Group();
  scene.add(rayLinesGroup);

  // Build each physical speaker model
  Object.values(ALL_SPEAKERS_3D).forEach(sp => {
    const group = new THREE.Group();
    group.position.set(...sp.pos);
    group.rotation.set(...sp.rot);
    group.userData = { speakerId: sp.id };

    let wooferCone: THREE.Mesh | undefined;

    if (sp.role === "screen") {
      // Reference 3-Way Floor-standing Tower
      const cabinet = new THREE.Mesh(
        new RoundedBoxGeometry(0.42, 1.28, 0.46, 3, 0.025),
        mats.speakerCabinet,
      );
      cabinet.position.y = 0.64;
      cabinet.castShadow = true;
      cabinet.receiveShadow = true;
      group.add(cabinet);

      // Brass isolation feet
      [-0.18, 0.18].forEach(x => {
        [-0.2, 0.2].forEach(z => {
          const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.01, 0.05, 12), mats.brassTrim);
          foot.position.set(x, 0.02, z);
          group.add(foot);
        });
      });

      // Tweeter pod (top)
      const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 24), mats.brassTrim);
      tweeter.rotation.x = Math.PI / 2;
      tweeter.position.set(0, 1.12, 0.23);
      group.add(tweeter);

      // Midrange driver
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24), mats.driverCone);
      mid.rotation.x = Math.PI / 2;
      mid.position.set(0, 0.88, 0.23);
      group.add(mid);

      // Dual bass drivers
      [0.54, 0.26].forEach(y => {
        const bass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 24), mats.driverCone);
        bass.rotation.x = Math.PI / 2;
        bass.position.set(0, y, 0.23);
        group.add(bass);
      });
    } else if (sp.role === "subwoofer") {
      // Infrasonic Subwoofer Cabinet
      const subBox = new THREE.Mesh(
        new RoundedBoxGeometry(0.68, 0.68, 0.68, 3, 0.03),
        mats.speakerCabinet,
      );
      subBox.position.y = 0.34;
      subBox.castShadow = true;
      subBox.receiveShadow = true;
      group.add(subBox);

      // Heavy Subwoofer Driver with excursion capability
      const driverBezel = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.025, 16, 32),
        mats.brassTrim,
      );
      driverBezel.position.set(0, 0.34, 0.34);
      group.add(driverBezel);

      wooferCone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.21, 0.06, 0.06, 32),
        mats.driverCone,
      );
      wooferCone.rotation.x = Math.PI / 2;
      wooferCone.position.set(0, 0.34, 0.33);
      group.add(wooferCone);
    } else if (sp.role === "surround") {
      // In-wall / On-wall Architectural Surround
      const box = new THREE.Mesh(
        new RoundedBoxGeometry(0.28, 0.48, 0.18, 2, 0.015),
        mats.speakerCabinet,
      );
      box.castShadow = true;
      group.add(box);

      const driver = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 0.02, 24),
        mats.brassTrim,
      );
      driver.rotation.x = Math.PI / 2;
      driver.position.z = 0.095;
      group.add(driver);
    } else if (sp.role === "height") {
      // In-Ceiling Dolby Atmos Height Transducer
      const trimRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.18, 0.02, 16, 32),
        mats.brassTrim,
      );
      group.add(trimRing);

      const grille = new THREE.Mesh(
        new THREE.CircleGeometry(0.16, 24),
        mats.speakerCabinet,
      );
      grille.position.z = 0.01;
      group.add(grille);

      // Downward conical sound shower guide
      const showerCone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.85, 2.2, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xf3d59b,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      showerCone.position.z = -1.1;
      showerCone.rotation.x = Math.PI;
      group.add(showerCone);
    }

    // Radiating Acoustic Pulse Ring
    const pulseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.22, 32),
      mats.waveRing.clone(),
    );
    pulseRing.position.z = 0.36;
    pulseRing.visible = false;
    group.add(pulseRing);

    scene.add(group);
    speakerMeshes.set(sp.id, { group, def: sp, wooferCone, pulseRing });
  });

  // Function to update visible speakers according to room config
  function updateConfig(configId: RoomConfigId) {
    currentConfig = configId;
    const activeIds = new Set(CONFIG_SPEAKERS_3D[configId] || []);

    speakerMeshes.forEach((item, id) => {
      const active = activeIds.has(id);
      item.group.visible = active;
      if (!active && hoveredSpeakerId === id) {
        hoveredSpeakerId = null;
      }
    });

    rebuildRayLines();
  }

  // Laser Ray Tracing in 3D: Connects speaker nodes to listener head (0, 1.15, 1.2)
  const LISTENER_HEAD = new THREE.Vector3(0, 1.15, 1.2);

  function rebuildRayLines() {
    // Clear existing ray geometries
    while (rayLinesGroup.children.length > 0) {
      const child = rayLinesGroup.children[0];
      rayLinesGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
      }
    }

    const activeIds = new Set(CONFIG_SPEAKERS_3D[currentConfig] || []);

    speakerMeshes.forEach((item, id) => {
      if (!activeIds.has(id)) return;

      const isHovered = hoveredSpeakerId === id;
      const shouldShow = isHovered || isSweetSpotFocused;
      if (!shouldShow) return;

      const spPos = new THREE.Vector3(...item.def.pos);
      if (item.def.role === "screen") spPos.y += 0.85;
      if (item.def.role === "subwoofer") spPos.y += 0.35;

      const points = [spPos, LISTENER_HEAD.clone()];
      const geom = new THREE.BufferGeometry().setFromPoints(points);

      const line = new THREE.Line(
        geom,
        new THREE.LineDashedMaterial({
          color: isHovered ? 0xf3d59b : 0xe2ba7a,
          dashSize: 0.15,
          gapSize: 0.08,
          transparent: true,
          opacity: isHovered ? 1.0 : 0.65,
        }),
      );
      line.computeLineDistances();
      rayLinesGroup.add(line);
    });
  }

  // Interactive Orbit & Parallax Physics
  let isDragging = false;
  let prevMouseX = 0;
  let prevMouseY = 0;
  let targetOrbitAngleX = 0;
  let targetOrbitAngleY = 0;
  let currentOrbitAngleX = 0;
  let currentOrbitAngleY = 0;

  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    prevMouseX = clientX;
    prevMouseY = clientY;
  };

  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    if (isDragging) {
      const dx = clientX - prevMouseX;
      const dy = clientY - prevMouseY;
      prevMouseX = clientX;
      prevMouseY = clientY;

      targetOrbitAngleY -= dx * 0.005;
      targetOrbitAngleX = Math.max(-0.4, Math.min(0.4, targetOrbitAngleX - dy * 0.004));
    } else if ("clientX" in e) {
      // Subtle mouse-move parallax
      const rect = canvas.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetOrbitAngleY = -nx * 0.12;
      targetOrbitAngleX = -ny * 0.08;
    }
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  canvas.addEventListener("mousedown", onPointerDown);
  canvas.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("touchstart", onPointerDown, { passive: true });
  canvas.addEventListener("touchmove", onPointerMove, { passive: true });
  window.addEventListener("touchend", onPointerUp);

  // Initialize with initial configuration
  updateConfig(currentConfig);

  // Animation Loop
  let animId = 0;
  let clock = new THREE.Clock();

  function animate() {
    animId = requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    // Smooth camera orbit damping
    currentOrbitAngleX += (targetOrbitAngleX - currentOrbitAngleX) * 0.08;
    currentOrbitAngleY += (targetOrbitAngleY - currentOrbitAngleY) * 0.08;

    const baseDistance = DEFAULT_CAM_POS.length();
    const elevatedY = DEFAULT_CAM_POS.y + currentOrbitAngleX * 2.2;
    const radius = Math.sqrt(Math.max(1, baseDistance * baseDistance - elevatedY * elevatedY));

    const baseAngle = Math.atan2(DEFAULT_CAM_POS.x, DEFAULT_CAM_POS.z);
    camera.position.x = Math.sin(baseAngle + currentOrbitAngleY) * radius;
    camera.position.z = Math.cos(baseAngle + currentOrbitAngleY) * radius;
    camera.position.y = elevatedY;
    camera.lookAt(DEFAULT_TARGET);

    // Audio Simulation Dynamics
    if (isSimulating && !isReducedMotion) {
      // 1. Volumetric projector light flicker
      projectorBeamMat.opacity = 0.07 + Math.sin(elapsedTime * 12) * 0.012;

      // 2. Speaker Driver Excursions & Shockwave Pulse Rings
      speakerMeshes.forEach(item => {
        if (!item.group.visible) return;

        // Subwoofer cone physical excursion stroke
        if (item.wooferCone) {
          const bassStroke = Math.sin(elapsedTime * 8) * 0.035;
          item.wooferCone.position.z = 0.33 + bassStroke;
        }

        // Concentric acoustic pulse rings
        if (item.pulseRing) {
          item.pulseRing.visible = true;
          const cycle = (elapsedTime * 1.6) % 1;
          const scale = 1 + cycle * 4.5;
          item.pulseRing.scale.set(scale, scale, 1);
          (item.pulseRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 * (1 - cycle));
        }
      });

      // Sweet spot target pulse
      sweetSpotRingMat.opacity = 0.45 + Math.sin(elapsedTime * 4) * 0.2;
    } else {
      speakerMeshes.forEach(item => {
        if (item.pulseRing) item.pulseRing.visible = false;
        if (item.wooferCone) item.wooferCone.position.z = 0.33;
      });
      projectorBeamMat.opacity = 0.075;
      sweetSpotRingMat.opacity = 0.5;
    }

    renderer.render(scene, camera);
  }

  animate();

  return {
    setConfig(configId: RoomConfigId) {
      updateConfig(configId);
    },
    setSimulating(sim: boolean) {
      isSimulating = sim;
    },
    setHoveredSpeaker(spId: string | null) {
      hoveredSpeakerId = spId;
      rebuildRayLines();
    },
    setSweetSpotFocus(focus: boolean) {
      isSweetSpotFocused = focus;
      rebuildRayLines();
    },
    setReducedMotion(reduced: boolean) {
      isReducedMotion = reduced;
    },
    resetCamera() {
      targetOrbitAngleX = 0;
      targetOrbitAngleY = 0;
    },
    resize() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    },
    destroy() {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown", onPointerDown);
      canvas.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      canvas.removeEventListener("touchstart", onPointerDown);
      canvas.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);

      renderer.dispose();
      scene.clear();
    },
  };
}
