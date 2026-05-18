import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import {
  CAMERA_FOV, CAMERA_POS, ARENA_RADIUS, DANGER_RADIUS,
  FIGHTER_COLORS, FIGHTER_RADIUS, CHARGE_TIME_TO_FULL,
} from '../constants';
import { useGameLoop, GameRef, SfxKey } from '../hooks/useGameLoop';
import type { Fighter, Stick } from '../types';

interface SceneProps {
  state: React.MutableRefObject<GameRef>;
  playing: boolean;
  stickRef: React.MutableRefObject<Stick>;
  onScore: (s: number) => void;
  onTimeLeft: (s: number) => void;
  onKos: (n: number) => void;
  onGameOver: (won: boolean, final: number) => void;
  playSfx: (k: SfxKey) => void;
  haptic?: (k: 'light' | 'heavy') => void;
}

// Fixed bird's-eye camera — no follow needed because all fighters share
// the arena and the player should see the whole battle.
function ArenaCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.set(CAMERA_POS[0], CAMERA_POS[1], CAMERA_POS[2]);
    (camera as THREE.PerspectiveCamera).fov = CAMERA_FOV;
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = 200;
    camera.lookAt(0, 0, 0);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

// Arena floor (ice disc with a colored ring at the danger band). Static.
function Arena() {
  return (
    <group>
      {/* dark water/void surrounding the platform */}
      <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial color="#0a1430" roughness={1} />
      </mesh>
      {/* platform under-edge — slightly darker, lifted */}
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ARENA_RADIUS + 0.2, 64]} />
        <meshStandardMaterial color="#234a76" roughness={1} />
      </mesh>
      {/* platform top — ice */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS, 64]} />
        <meshStandardMaterial color="#c0d8ea" roughness={0.75} metalness={0.05} />
      </mesh>
      {/* danger band (DANGER_RADIUS..ARENA_RADIUS) — subtle warning red */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DANGER_RADIUS, ARENA_RADIUS, 64]} />
        <meshBasicMaterial color="#ff7a55" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* arena rim — a thin torus highlight */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.10, ARENA_RADIUS, 64]} />
        <meshBasicMaterial color="#7fc4ff" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// A single penguin fighter. Bounces up + down with `bounceRef`, the
// contact shadow stays on the floor outside the bounce so the leap reads.
function PenguinFighter({ fighter }: { fighter: Fighter }) {
  const palette = FIGHTER_COLORS[fighter.paletteIdx % FIGHTER_COLORS.length];
  const groupRef = useRef<THREE.Group>(null);
  const bounceRef = useRef<THREE.Group>(null);
  const chargeRingRef = useRef<THREE.Mesh>(null);
  const chargeRingMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (fighter.state === 'down') {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    groupRef.current.position.copy(fighter.pos);
    groupRef.current.rotation.y = fighter.rot;

    // Bounce — faster when moving / dashing
    if (bounceRef.current) {
      const t = clock.getElapsedTime();
      const speed = Math.hypot(fighter.vel.x, fighter.vel.z);
      const moveFactor = Math.min(1, speed / 8);
      const hopT = t * (5.0 + moveFactor * 2.5) + fighter.id;
      const hopHeight = 0.16 + moveFactor * 0.18;
      bounceRef.current.position.y = Math.abs(Math.sin(hopT)) * hopHeight;
      bounceRef.current.rotation.z = Math.sin(hopT) * (0.05 + moveFactor * 0.10);
      // Slight forward lean when dashing
      const lean = fighter.state === 'dashing' ? 0.35 : 0;
      bounceRef.current.rotation.x = lean;
    }

    // Charge ring under the fighter
    if (chargeRingRef.current && chargeRingMat.current) {
      const charging = fighter.state === 'charging';
      chargeRingRef.current.visible = charging;
      if (charging) {
        const f = Math.min(1, fighter.chargeT / CHARGE_TIME_TO_FULL);
        chargeRingRef.current.scale.set(0.6 + f * 1.0, 1, 0.6 + f * 1.0);
        // Color shifts from yellow (low) → orange → red (full)
        const r = 255;
        const g = Math.floor(220 - f * 180);
        const b = Math.floor(80 - f * 80);
        chargeRingMat.current.color.setRGB(r / 255, g / 255, b / 255);
        chargeRingMat.current.opacity = 0.55 + f * 0.35;
      }
    }
  });
  return (
    <group ref={groupRef}>
      {/* Contact shadow stays on the floor */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FIGHTER_RADIUS * 0.8, 22]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} />
      </mesh>
      {/* Charge ring — only shown while charging */}
      <mesh ref={chargeRingRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[FIGHTER_RADIUS * 1.05, FIGHTER_RADIUS * 1.40, 36]} />
        <meshBasicMaterial ref={chargeRingMat} color="#ffd84a" transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <group ref={bounceRef}>
        {/* Body — chubby penguin: rounded box base + sphere head + cone beak */}
        <RoundedBox args={[0.92, 0.78, 0.78]} radius={0.34} smoothness={5} position={[0, 0.55, 0]} castShadow>
          <meshStandardMaterial color={palette.body} roughness={0.85} />
        </RoundedBox>
        {/* Belly — flatter rounded box overlay */}
        <RoundedBox args={[0.62, 0.62, 0.30]} radius={0.20} smoothness={5} position={[0, 0.52, 0.30]} castShadow>
          <meshStandardMaterial color={palette.belly} roughness={0.9} />
        </RoundedBox>
        {/* Head */}
        <mesh position={[0, 1.10, 0]} castShadow>
          <sphereGeometry args={[0.30, 16, 12]} />
          <meshStandardMaterial color={palette.body} roughness={0.8} />
        </mesh>
        {/* Beak */}
        <mesh position={[0, 1.05, 0.30]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08, 0.18, 10]} />
          <meshStandardMaterial color="#ffae3a" roughness={0.6} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.10, 1.18, 0.22]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.10, 1.18, 0.22]}>
          <sphereGeometry args={[0.05, 10, 8]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[-0.10, 1.18, 0.265]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[0.10, 1.18, 0.265]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        {/* Belt — colored ring around the waist for identification */}
        <mesh position={[0, 0.30, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.50, 0.06, 8, 22]} />
          <meshStandardMaterial color={palette.belt} emissive={palette.belt} emissiveIntensity={0.5} roughness={0.5} />
        </mesh>
        {/* Flipper-arms */}
        <mesh position={[-0.52, 0.62, 0]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[0.12, 0.45, 0.30]} />
          <meshStandardMaterial color={palette.body} roughness={0.85} />
        </mesh>
        <mesh position={[0.52, 0.62, 0]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.12, 0.45, 0.30]} />
          <meshStandardMaterial color={palette.body} roughness={0.85} />
        </mesh>
        {/* Feet */}
        <mesh position={[-0.20, 0.05, 0.10]}>
          <boxGeometry args={[0.22, 0.10, 0.32]} />
          <meshStandardMaterial color="#ffae3a" roughness={0.7} />
        </mesh>
        <mesh position={[0.20, 0.05, 0.10]}>
          <boxGeometry args={[0.22, 0.10, 0.32]} />
          <meshStandardMaterial color="#ffae3a" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

function Fighters({ state }: { state: React.MutableRefObject<GameRef> }) {
  // Need to force re-render if a fighter goes 'down' (visibility flips
  // are per-frame, but rendering removed fighters at all costs perf).
  const [, force] = useState(0);
  const lastDown = useRef('');
  useFrame(() => {
    const key = state.current.fighters.map(f => f.state === 'down' ? '1' : '0').join('');
    if (key !== lastDown.current) { lastDown.current = key; force(x => x + 1); }
  });
  return (
    <>
      {state.current.fighters.map(f => (
        <PenguinFighter key={f.id} fighter={f} />
      ))}
    </>
  );
}

// Collide sparks — small additive burst on each FxEvent of type 'collide'.
// We piggyback on the fx ring buffer in state.
function CollideSparks({ state }: { state: React.MutableRefObject<GameRef> }) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRefs = useRef<Map<number, THREE.Mesh>>(new Map());
  const ringMats = useRef<Map<number, THREE.MeshBasicMaterial>>(new Map());
  const [, force] = useState(0);
  const lastCount = useRef(0);
  useFrame(() => {
    const d = state.current;
    const collideFx = d.fx.filter(f => f.type === 'collide');
    if (collideFx.length !== lastCount.current) {
      lastCount.current = collideFx.length;
      force(x => x + 1);
    }
    for (const fx of collideFx) {
      const mesh = ringRefs.current.get(fx.key);
      const mat = ringMats.current.get(fx.key);
      if (!mesh || !mat) continue;
      const age = d.time - fx.born;
      if (age < 0 || age > 0.5) {
        mesh.visible = false;
        continue;
      }
      mesh.visible = true;
      const t = age / 0.5;
      mesh.position.set(fx.x, 0.1, fx.z);
      mesh.scale.setScalar(0.3 + t * 2.2);
      mat.opacity = 0.9 * (1 - t);
    }
  });
  const d = state.current;
  return (
    <group ref={groupRef}>
      {d.fx.filter(f => f.type === 'collide').map(fx => (
        <mesh
          key={fx.key}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
          ref={el => {
            if (el) {
              ringRefs.current.set(fx.key, el);
              ringMats.current.set(fx.key, el.material as THREE.MeshBasicMaterial);
            } else {
              ringRefs.current.delete(fx.key);
              ringMats.current.delete(fx.key);
            }
          }}
        >
          <ringGeometry args={[0.3, 0.6, 24]} />
          <meshBasicMaterial color="#fff2c0" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

export function Scene(props: SceneProps) {
  const { state, playing, stickRef } = props;
  useGameLoop({
    state, playing, stick: stickRef.current,
    onScore: props.onScore,
    onTimeLeft: props.onTimeLeft,
    onKos: props.onKos,
    onGameOver: props.onGameOver,
    playSfx: props.playSfx,
    haptic: props.haptic,
  });
  return (
    <>
      <ArenaCamera />
      <fog attach="fog" args={['#0a1430', 30, 80]} />
      <ambientLight intensity={0.55} color="#d8e8ff" />
      <hemisphereLight args={['#a8c8ff', '#102030', 0.6]} />
      <directionalLight
        position={[12, 22, 8]}
        intensity={1.25}
        color="#fff4d8"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={5}
        shadow-camera-far={60}
      />
      <Arena />
      <CollideSparks state={state} />
      <Fighters state={state} />
    </>
  );
}
