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
  // Polarity lock
  lockedToId: number | null; // id of the partner fighter when state='locked'
  lockT: number;             // remaining lock time
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
