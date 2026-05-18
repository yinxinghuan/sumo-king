import * as THREE from 'three';
import type { AiKind, Polarity } from './constants';

export type Phase = 'splash' | 'playing' | 'gameover';

export interface Stick {
  active: boolean;
  x: number; // -1..1
  y: number; // -1..1
}

export type FighterState =
  | 'idle'        // free to move, not charging
  | 'charging'    // building up dash power
  | 'dashing'     // committed dash burst (cannot turn or re-charge)
  | 'slide'       // sliding-decay phase after the dash burst
  | 'locked'      // magnetically locked to another fighter (opposite polarity)
  | 'falling'     // off the arena floor — visual drop, then despawn
  | 'down';       // KO'd, not rendered anymore

export interface Fighter {
  id: number;
  isPlayer: boolean;
  aiKind?: AiKind;
  paletteIdx: number;       // index into FIGHTER_COLORS
  polarity: Polarity;       // red or blue — drives collision behavior
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: number;              // facing angle (radians)
  state: FighterState;
  chargeT: number;
  dashT: number;
  dashDirX: number;
  dashDirZ: number;
  dashCharge: number;
  fallT: number;
  // Health — mechas take damage from collisions. Below thresholds they
  // show sparks → smoke → fire visual stages. HP=0 = KO'd (counts as a
  // kill for whoever last hit them).
  hp: number;
  maxHp: number;
  lastHitById: number | null; // for KO attribution
  damagedFx: { x: number; z: number; born: number }[]; // local impact points
  // Polarity lock
  lockedToId: number | null;
  lockT: number;
  // AI scratch
  aiNextDecisionT: number;
  aiTargetId: number | null;
  aiPolarityReviewT: number;
}

export interface FxEvent {
  key: number;
  type: 'collide' | 'ko' | 'fall';
  x: number;
  z: number;
  born: number;
}

// Debris — bits of mecha that fly off on collisions. Each piece has
// position, velocity (with gravity), and angular velocity for spin. Lives
// for ~2 seconds before being cleaned up.
export interface DebrisPiece {
  key: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Vector3;     // current rotation (x,y,z radians)
  angVel: THREE.Vector3;  // angular velocity (radians/sec on each axis)
  size: number;
  color: string;
  bornAt: number;
  grounded: boolean;
}
