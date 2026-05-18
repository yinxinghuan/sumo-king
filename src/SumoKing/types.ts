import * as THREE from 'three';
import type { AiKind } from './constants';

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
  | 'falling'     // off the arena floor — visual drop, then despawn
  | 'down';       // KO'd, not rendered anymore

export interface Fighter {
  id: number;
  isPlayer: boolean;
  aiKind?: AiKind;
  paletteIdx: number;       // index into FIGHTER_COLORS
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: number;              // facing angle (radians)
  state: FighterState;
  chargeT: number;          // 0..CHARGE_TIME_TO_FULL while charging
  dashT: number;            // 0..(DASH_PEAK + DASH_SLIDE) during dash/slide
  dashDirX: number;         // unit vec of committed dash direction
  dashDirZ: number;
  dashCharge: number;       // 0..1 — how full the dash was at release
  fallT: number;            // time since falling started — drives drop anim
  // AI scratch state
  aiNextDecisionT: number;  // game time when to re-evaluate target/action
  aiTargetId: number | null;
}

export interface FxEvent {
  key: number;
  type: 'collide' | 'ko' | 'fall';
  x: number;
  z: number;
  born: number;
}
