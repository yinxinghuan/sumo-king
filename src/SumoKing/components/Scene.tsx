import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import {
  CAMERA_FOV, CAMERA_POS, CAMERA_FOLLOW, CAMERA_LERP,
  ARENA_RADIUS, DANGER_RADIUS,
  FIGHTER_COLORS, FIGHTER_RADIUS, FIGHTER_VISUAL_SCALE, CHARGE_TIME_TO_FULL,
  POLARITY_RED, POLARITY_BLUE,
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

// Soft-follow camera — anchored slightly toward the player so they never
// hug the edge of the frame, but staying mostly centered on the arena so
// the whole platform is visible. Player.pos × CAMERA_FOLLOW = target.
function ArenaCamera({ state }: { state: React.MutableRefObject<GameRef> }) {
  const { camera, size } = useThree();
  const offset = useRef(new THREE.Vector3(...CAMERA_POS));
  const targetCur = useRef(new THREE.Vector3());
  const lookAtCur = useRef(new THREE.Vector3());
  useEffect(() => {
    (camera as THREE.PerspectiveCamera).fov = CAMERA_FOV;
    (camera as THREE.PerspectiveCamera).near = 0.1;
    (camera as THREE.PerspectiveCamera).far = 200;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  useFrame(() => {
    const player = state.current.fighters.find(f => f.isPlayer);
    const px = player ? player.pos.x : 0;
    const pz = player ? player.pos.z : 0;
    // Soft follow — only shift partway toward the player.
    const lookX = px * CAMERA_FOLLOW;
    const lookZ = pz * CAMERA_FOLLOW;
    targetCur.current.set(lookX + offset.current.x, offset.current.y, lookZ + offset.current.z);
    camera.position.lerp(targetCur.current, CAMERA_LERP);
    lookAtCur.current.set(lookX, 0, lookZ);
    camera.lookAt(lookAtCur.current);
  });
  return null;
}

// Mecha arena — brushed steel platform over an animated lava bed. Cyan
// neon rim trims the safe area; magenta marks the danger band.
function Arena() {
  const lavaMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (lavaMat.current) {
      const t = clock.getElapsedTime();
      // Pulse the lava glow so the pit feels alive.
      lavaMat.current.emissiveIntensity = 1.4 + Math.sin(t * 1.2) * 0.35 + Math.sin(t * 3.7) * 0.12;
    }
  });
  return (
    <group>
      {/* Lava pit beneath the platform — bright emissive */}
      <mesh position={[0, -0.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[80, 64]} />
        <meshStandardMaterial
          ref={lavaMat}
          color="#3a0c08"
          emissive="#ff5a18"
          emissiveIntensity={1.4}
          roughness={0.85}
        />
      </mesh>
      {/* Outer ring of charred slag right under the platform edge */}
      <mesh position={[0, -0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ARENA_RADIUS + 0.4, 64]} />
        <meshStandardMaterial color="#1a0a08" roughness={1} />
      </mesh>
      {/* Platform top — DARK navy/charcoal so mechas have strong contrast */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[ARENA_RADIUS, 64]} />
        <meshStandardMaterial color="#0e1626" roughness={0.55} metalness={0.40} />
      </mesh>
      {/* Inner platform pattern */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[ARENA_RADIUS * 0.55, 48]} />
        <meshStandardMaterial color="#070d18" roughness={0.5} metalness={0.50} />
      </mesh>
      {/* Danger band — magenta neon strip */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[DANGER_RADIUS, ARENA_RADIUS - 0.15, 64]} />
        <meshBasicMaterial color="#ff36a8" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Outer rim — cyan neon */}
      <mesh position={[0, 0.020, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ARENA_RADIUS - 0.12, ARENA_RADIUS, 64]} />
        <meshBasicMaterial color="#36e4ff" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* A faint lava-glow halo right outside the platform (gives the
          edge a "danger heat" lift even before fighters get pushed off) */}
      <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ARENA_RADIUS, ARENA_RADIUS + 1.6, 64]} />
        <meshBasicMaterial color="#ff8838" transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// Gold ground ring — appears ONLY under the player. The gold color is
// not used anywhere else, so the player instantly knows "the gold ring
// is me". Pulses to feel alive but stays a stable identity marker.
function PlayerGroundRing({ fighter }: { fighter: Fighter }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!matRef.current || !meshRef.current) return;
    const t = clock.getElapsedTime();
    const pulse = 0.85 + Math.sin(t * 3.4) * 0.18;
    meshRef.current.scale.set(pulse, 1, pulse);
    matRef.current.opacity = 0.70 + Math.sin(t * 3.4) * 0.20;
    // Hint at facing — rotate a bit so the arrow chevron points forward
    meshRef.current.rotation.z = -fighter.rot;
  });
  return (
    <mesh ref={meshRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[FIGHTER_RADIUS * 1.10, FIGHTER_RADIUS * 1.95, 56]} />
      <meshBasicMaterial ref={matRef} color="#ffd84a" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
    </mesh>
  );
}

// Polarity is shown by a glowing red/blue ball floating above the
// fighter's head — NOT a ground ring. Keeps two visual languages clean:
//   • Ground ring  = identity ("this is YOU", gold, player only)
//   • Floating ball = polarity (red or blue, everyone has one)
function PolarityBall({ fighter }: { fighter: Fighter }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!matRef.current || !meshRef.current) return;
    const t = clock.getElapsedTime();
    const isLocked = fighter.state === 'locked';
    const freq = isLocked ? 6.5 : 2.6;
    const pulse = 0.85 + Math.sin(t * freq + fighter.id) * (isLocked ? 0.25 : 0.15);
    const c = fighter.polarity === 'red' ? POLARITY_RED : POLARITY_BLUE;
    matRef.current.color.set(c);
    matRef.current.emissive.set(c);
    meshRef.current.position.y = 5.20 + Math.sin(t * 1.6 + fighter.id) * 0.18;
    meshRef.current.scale.setScalar(pulse);
  });
  return (
    <group ref={meshRef} position={[0, 5.20, 0]}>
      {/* Solid colored core — non-additive so red/blue reads true */}
      <mesh>
        <sphereGeometry args={[0.70, 20, 16]} />
        <meshStandardMaterial ref={matRef} color={POLARITY_BLUE} emissive={POLARITY_BLUE} emissiveIntensity={2.6} roughness={0.2} metalness={0.4} />
      </mesh>
      {/* Outer glow halo — additive bloom */}
      <mesh>
        <sphereGeometry args={[1.10, 20, 14]} />
        <meshBasicMaterial color={POLARITY_BLUE} transparent opacity={0.25} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// A single mecha fighter. Chassis is steel boxes + a sensor-eye sphere +
// antenna. The belt is now a glowing LED stripe around the waist matching
// the fighter's color slot. Bounce + lean animation preserved from v0.
function MechaFighter({ fighter }: { fighter: Fighter }) {
  const palette = FIGHTER_COLORS[fighter.paletteIdx % FIGHTER_COLORS.length];
  const groupRef = useRef<THREE.Group>(null);
  const bounceRef = useRef<THREE.Group>(null);
  const chargeRingRef = useRef<THREE.Mesh>(null);
  const chargeRingMat = useRef<THREE.MeshBasicMaterial>(null);
  const sensorRef = useRef<THREE.MeshStandardMaterial>(null);
  // Player-only persistent markers — pulsing ring on the floor + a
  // downward arrow floating above the head so the player can instantly
  // pick themselves out from the 3 identical-shape AI fighters.
  const youRingRef = useRef<THREE.Mesh>(null);
  const youRingMat = useRef<THREE.MeshBasicMaterial>(null);
  const youArrowRef = useRef<THREE.Group>(null);
  const aimArrowRef = useRef<THREE.Group>(null);
  const aimArrowMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (fighter.state === 'down') {
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;
    groupRef.current.position.copy(fighter.pos);
    groupRef.current.rotation.y = fighter.rot;

    if (bounceRef.current) {
      const t = clock.getElapsedTime();
      const speed = Math.hypot(fighter.vel.x, fighter.vel.z);
      const moveFactor = Math.min(1, speed / 8);
      const hopT = t * (5.0 + moveFactor * 2.5) + fighter.id;
      const hopHeight = 0.10 + moveFactor * 0.16;
      // Mecha bobs less than a penguin — more "servo strut" than "hop"
      bounceRef.current.position.y = Math.abs(Math.sin(hopT)) * hopHeight;
      bounceRef.current.rotation.z = Math.sin(hopT) * (0.04 + moveFactor * 0.08);
      const lean = fighter.state === 'dashing' ? 0.35 : 0;
      bounceRef.current.rotation.x = lean;
    }

    // Sensor eye breathes when charging — pulses brighter as charge fills.
    if (sensorRef.current) {
      if (fighter.state === 'charging') {
        const f = Math.min(1, fighter.chargeT / CHARGE_TIME_TO_FULL);
        sensorRef.current.emissiveIntensity = 1.5 + f * 2.8 + Math.sin(clock.getElapsedTime() * 14) * 0.4;
      } else if (fighter.state === 'dashing') {
        sensorRef.current.emissiveIntensity = 4.0;
      } else {
        sensorRef.current.emissiveIntensity = 1.5;
      }
    }

    if (chargeRingRef.current && chargeRingMat.current) {
      const charging = fighter.state === 'charging';
      chargeRingRef.current.visible = charging;
      if (charging) {
        const f = Math.min(1, fighter.chargeT / CHARGE_TIME_TO_FULL);
        chargeRingRef.current.scale.set(0.6 + f * 1.1, 1, 0.6 + f * 1.1);
        // Cyan (low) → magenta (mid) → red plasma (full)
        const r = Math.floor(60 + f * 195);
        const g = Math.floor(220 - f * 200);
        const b = Math.floor(255 - f * 175);
        chargeRingMat.current.color.setRGB(r / 255, g / 255, b / 255);
        chargeRingMat.current.opacity = 0.60 + f * 0.35;
      }
    }

    // YOU markers — only on the player
    if (fighter.isPlayer) {
      const t = clock.getElapsedTime();
      if (youRingRef.current && youRingMat.current) {
        const pulse = 0.65 + Math.sin(t * 4.0) * 0.20;
        youRingRef.current.scale.set(pulse, 1, pulse);
        youRingMat.current.opacity = 0.55 + Math.sin(t * 4.0) * 0.18;
      }
      if (youArrowRef.current) {
        youArrowRef.current.position.y = 2.05 + Math.sin(t * 3.0) * 0.08;
        youArrowRef.current.rotation.y = t * 1.5;
      }
      // Aim arrow — appears in front of the player only while charging,
      // length scales with charge, color matches charge progression.
      if (aimArrowRef.current && aimArrowMat.current) {
        const charging = fighter.state === 'charging';
        aimArrowRef.current.visible = charging;
        if (charging) {
          const f = Math.min(1, fighter.chargeT / CHARGE_TIME_TO_FULL);
          // Arrow extends from radius 1.2 out to 1.2 + 2.5*charge
          aimArrowRef.current.scale.set(1, 1, 0.5 + f * 2.0);
          const r = Math.floor(60 + f * 195);
          const g = Math.floor(220 - f * 200);
          const b = Math.floor(255 - f * 175);
          aimArrowMat.current.color.setRGB(r / 255, g / 255, b / 255);
          aimArrowMat.current.opacity = 0.75 + f * 0.20;
        }
      }
    }
  });
  return (
    <group ref={groupRef}>
      {/* Contact shadow stays on the floor */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[FIGHTER_RADIUS * 0.85, 22]} />
        <meshBasicMaterial color="#000" transparent opacity={0.40} />
      </mesh>
      {/* PLAYER-ONLY: gold ground ring — this is "YOU". No other fighter
          gets a ground ring, no other fighter uses gold. Eliminates the
          previous confusion where everyone had a glowing ring. */}
      {fighter.isPlayer && (
        <PlayerGroundRing fighter={fighter} />
      )}
      {/* POLARITY BALL — floats above every fighter's head, color = polarity */}
      <PolarityBall fighter={fighter} />
      {/* PLAYER-ONLY: pulsing cyan "YOU" ring on the floor */}
      {fighter.isPlayer && (
        <mesh ref={youRingRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[FIGHTER_RADIUS * 1.50, FIGHTER_RADIUS * 1.85, 40]} />
          <meshBasicMaterial ref={youRingMat} color="#4afcff" transparent opacity={0.65} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}
      {/* PLAYER-ONLY: floating downward arrow above the head */}
      {fighter.isPlayer && (
        <group ref={youArrowRef} position={[0, 2.05, 0]}>
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.18, 0.36, 4]} />
            <meshStandardMaterial color="#4afcff" emissive="#4afcff" emissiveIntensity={2.2} />
          </mesh>
        </group>
      )}
      {/* PLAYER-ONLY: aim arrow on the floor in front, only during charge.
          Pre-rotated so its long axis is local +Z (the rotation.y of the
          parent group puts it in the dash direction). */}
      {fighter.isPlayer && (
        <group ref={aimArrowRef} visible={false}>
          <mesh position={[0, 0.06, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.45, 2.0]} />
            <meshBasicMaterial ref={aimArrowMat} color="#4afcff" transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          {/* Arrowhead */}
          <mesh position={[0, 0.07, 2.20]} rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.35, 0.55, 3]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      )}
      {/* Charge ring — only shown while charging */}
      <mesh ref={chargeRingRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[FIGHTER_RADIUS * 1.05, FIGHTER_RADIUS * 1.40, 36]} />
        <meshBasicMaterial ref={chargeRingMat} color={palette.belt} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* All body parts scale up uniformly via FIGHTER_VISUAL_SCALE so the
          mechas read clearly on a phone without changing collision math. */}
      <group ref={bounceRef} scale={FIGHTER_VISUAL_SCALE}>
        {/* Lower hull — wider base */}
        <mesh position={[0, 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.48, 0.52, 0.30, 10]} />
          <meshStandardMaterial color={palette.body} roughness={0.55} metalness={0.50} />
        </mesh>
        {/* Mid chassis — chest plate (square + slight bevel via two boxes) */}
        <RoundedBox args={[0.92, 0.65, 0.78]} radius={0.10} smoothness={3} position={[0, 0.75, 0]} castShadow>
          <meshStandardMaterial color={palette.body} roughness={0.50} metalness={0.55} />
        </RoundedBox>
        {/* Inner chest plate — darker accent on the front */}
        <RoundedBox args={[0.66, 0.46, 0.24]} radius={0.06} smoothness={3} position={[0, 0.78, 0.32]}>
          <meshStandardMaterial color={palette.chest} roughness={0.45} metalness={0.6} />
        </RoundedBox>
        {/* LED stripe — wraps the chest seam, glows in belt color */}
        <mesh position={[0, 0.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.50, 0.045, 6, 24]} />
          <meshStandardMaterial color={palette.belt} emissive={palette.belt} emissiveIntensity={1.6} roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Shoulder bumpers */}
        <mesh position={[-0.50, 1.00, 0]} castShadow>
          <sphereGeometry args={[0.20, 14, 10]} />
          <meshStandardMaterial color={palette.chest} roughness={0.55} metalness={0.55} />
        </mesh>
        <mesh position={[0.50, 1.00, 0]} castShadow>
          <sphereGeometry args={[0.20, 14, 10]} />
          <meshStandardMaterial color={palette.chest} roughness={0.55} metalness={0.55} />
        </mesh>
        {/* Head — boxy dome */}
        <mesh position={[0, 1.32, 0]} castShadow>
          <boxGeometry args={[0.45, 0.36, 0.42]} />
          <meshStandardMaterial color={palette.body} roughness={0.45} metalness={0.55} />
        </mesh>
        {/* Sensor eye visor — single glowing band across the face */}
        <mesh position={[0, 1.33, 0.215]}>
          <boxGeometry args={[0.34, 0.10, 0.02]} />
          <meshStandardMaterial ref={sensorRef} color="#ffffff" emissive={palette.belt} emissiveIntensity={1.5} />
        </mesh>
        {/* Antenna */}
        <mesh position={[0, 1.62, -0.10]} rotation={[0.18, 0, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 0.30, 6]} />
          <meshStandardMaterial color="#181c24" roughness={0.6} metalness={0.5} />
        </mesh>
        <mesh position={[0, 1.78, -0.13]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color={palette.belt} emissive={palette.belt} emissiveIntensity={1.8} />
        </mesh>
        {/* Arms — chunky hydraulic pistons */}
        <mesh position={[-0.55, 0.70, 0]} rotation={[0, 0, 0.18]}>
          <cylinderGeometry args={[0.10, 0.10, 0.55, 10]} />
          <meshStandardMaterial color={palette.chest} roughness={0.55} metalness={0.6} />
        </mesh>
        <mesh position={[0.55, 0.70, 0]} rotation={[0, 0, -0.18]}>
          <cylinderGeometry args={[0.10, 0.10, 0.55, 10]} />
          <meshStandardMaterial color={palette.chest} roughness={0.55} metalness={0.6} />
        </mesh>
        {/* Hands — squat fists */}
        <mesh position={[-0.58, 0.40, 0]} castShadow>
          <boxGeometry args={[0.20, 0.18, 0.22]} />
          <meshStandardMaterial color={palette.body} roughness={0.5} metalness={0.55} />
        </mesh>
        <mesh position={[0.58, 0.40, 0]} castShadow>
          <boxGeometry args={[0.20, 0.18, 0.22]} />
          <meshStandardMaterial color={palette.body} roughness={0.5} metalness={0.55} />
        </mesh>
        {/* Feet — wide pads */}
        <mesh position={[-0.20, 0.08, 0.06]} castShadow>
          <boxGeometry args={[0.28, 0.16, 0.40]} />
          <meshStandardMaterial color={palette.chest} roughness={0.6} metalness={0.5} />
        </mesh>
        <mesh position={[0.20, 0.08, 0.06]} castShadow>
          <boxGeometry args={[0.28, 0.16, 0.40]} />
          <meshStandardMaterial color={palette.chest} roughness={0.6} metalness={0.5} />
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
        <MechaFighter key={f.id} fighter={f} />
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
      <ArenaCamera state={state} />
      {/* Warm lava-pit ambient bleeds up from below; cool industrial sky
          fills the steel deck from above for a strong hot/cool contrast. */}
      <fog attach="fog" args={['#1c0a08', 32, 86]} />
      <ambientLight intensity={0.50} color="#dceaff" />
      <hemisphereLight args={['#a8c4ff', '#ff5a18', 0.55]} />
      <directionalLight
        position={[12, 22, 8]}
        intensity={1.20}
        color="#cfe2ff"
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
