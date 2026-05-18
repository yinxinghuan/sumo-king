import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  ARENA_RADIUS, FALL_RADIUS, FIGHTER_RADIUS, BASE_SPEED,
  CHARGE_TIME_TO_FULL, DASH_PEAK_SPEED, DASH_PEAK_DURATION, DASH_SLIDE_DURATION,
  FRICTION_PER_SEC, COLLIDE_TRANSFER, COLLIDE_BOUNCE,
  ROUND_TIME, PLAYER_COUNT_AI, SCORE_KO, SCORE_PER_SECOND_SURVIVED,
  AI_REACT_INTERVAL_MIN, AI_REACT_INTERVAL_MAX,
  AI_LINEUP, GRACE_PERIOD,
  POLARITY_LOCK_DURATION, POLARITY_RELEASE_KICK,
  AI_POLARITY_REVIEW_MIN, AI_POLARITY_REVIEW_MAX, LOCK_FRICTION_PER_SEC,
  FIGHTER_MAX_HP, DAMAGE_PER_IMPACT_UNIT, KO_EXPLOSION_VELOCITY,
} from '../constants';
import type { Polarity } from '../constants';
import type { DebrisPiece, Fighter, FxEvent, Stick } from '../types';
import { FIGHTER_COLORS } from '../constants';

export type SfxKey = 'charge_start' | 'dash' | 'collide' | 'ko' | 'fall' | 'game_over' | 'victory' | 'polarity_flip' | 'magnet_lock' | 'magnet_release';

export interface GameRef {
  fighters: Fighter[];
  time: number;
  roundT: number;
  score: number;
  kos: number;
  fx: FxEvent[];
  debris: DebrisPiece[];   // flying mecha parts from collisions
  initialized: boolean;
  gameOver: boolean;
  victory: boolean;
  shake: number;
}

let nextId = 1;
const newId = () => nextId++;

function emitFx(d: GameRef, type: FxEvent['type'], x: number, z: number) {
  d.fx.push({ key: Math.random(), type, x, z, born: d.time });
  if (d.fx.length > 50) d.fx = d.fx.filter(f => d.time - f.born < 2.5);
}

function spawnRingPosition(idx: number, total: number): THREE.Vector3 {
  // Spawn all four fighters close together (ringR=6) so they're all visible
  // in the camera's tighter follow frame from the start. AI quickly fan out
  // once the round begins.
  const ringR = 6;
  const startAngle = -Math.PI / 2;
  const a = startAngle + (idx / total) * Math.PI * 2;
  return new THREE.Vector3(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
}

function alive(f: Fighter) {
  return f.state !== 'down' && f.state !== 'falling';
}

// Player input — flips the player's polarity. Wired from the UI.
export function flipPlayerPolarity(d: GameRef): Polarity | null {
  const player = d.fighters.find(f => f.isPlayer);
  if (!player || !alive(player)) return null;
  player.polarity = player.polarity === 'red' ? 'blue' : 'red';
  // If we were locked to someone, check whether the new polarity now
  // matches — if so, release immediately with a kick.
  if (player.state === 'locked' && player.lockedToId !== null) {
    const partner = d.fighters.find(f => f.id === player.lockedToId);
    if (partner && partner.polarity === player.polarity) {
      releaseLock(player, partner, true);
    }
  }
  return player.polarity;
}

function releaseLock(a: Fighter, b: Fighter, kick: boolean) {
  a.lockedToId = null;
  b.lockedToId = null;
  a.lockT = 0;
  b.lockT = 0;
  a.state = 'slide';
  b.state = 'slide';
  a.dashT = DASH_PEAK_DURATION; // start in slide-decay window
  b.dashT = DASH_PEAK_DURATION;
  if (kick) {
    // Push them apart along the line between them
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const dist = Math.max(0.001, Math.hypot(dx, dz));
    const nx = dx / dist;
    const nz = dz / dist;
    a.vel.x = -nx * POLARITY_RELEASE_KICK;
    a.vel.z = -nz * POLARITY_RELEASE_KICK;
    b.vel.x =  nx * POLARITY_RELEASE_KICK;
    b.vel.z =  nz * POLARITY_RELEASE_KICK;
  }
}

function liveFighters(d: GameRef) {
  return d.fighters.filter(alive);
}

export function createGameState(): GameRef {
  const fighters: Fighter[] = [];
  const total = 1 + PLAYER_COUNT_AI;
  fighters.push({
    id: newId(),
    isPlayer: true,
    paletteIdx: 0,
    polarity: 'blue',
    pos: spawnRingPosition(0, total),
    vel: new THREE.Vector3(),
    rot: Math.PI,
    state: 'idle',
    chargeT: 0,
    dashT: 0,
    dashDirX: 0, dashDirZ: 0, dashCharge: 0,
    fallT: 0,
    hp: FIGHTER_MAX_HP,
    maxHp: FIGHTER_MAX_HP,
    lastHitById: null,
    damagedFx: [],
    lockedToId: null,
    lockT: 0,
    aiNextDecisionT: 0,
    aiTargetId: null,
    aiPolarityReviewT: 0,
  });
  for (let i = 0; i < PLAYER_COUNT_AI; i++) {
    const p = spawnRingPosition(i + 1, total);
    fighters.push({
      id: newId(),
      isPlayer: false,
      aiKind: AI_LINEUP[i % AI_LINEUP.length],
      paletteIdx: i + 1,
      polarity: Math.random() < 0.5 ? 'red' : 'blue',
      pos: p,
      vel: new THREE.Vector3(),
      rot: Math.atan2(-p.x, -p.z),
      state: 'idle',
      chargeT: 0,
      dashT: 0,
      dashDirX: 0, dashDirZ: 0, dashCharge: 0,
      fallT: 0,
      hp: FIGHTER_MAX_HP,
      maxHp: FIGHTER_MAX_HP,
      lastHitById: null,
      damagedFx: [],
      lockedToId: null,
      lockT: 0,
      aiNextDecisionT: GRACE_PERIOD + (AI_REACT_INTERVAL_MIN + Math.random() * (AI_REACT_INTERVAL_MAX - AI_REACT_INTERVAL_MIN)),
      aiTargetId: null,
      aiPolarityReviewT: GRACE_PERIOD + Math.random() * AI_POLARITY_REVIEW_MAX,
    });
  }
  return {
    fighters,
    time: 0,
    roundT: 0,
    score: 0,
    kos: 0,
    fx: [],
    initialized: true,
    gameOver: false,
    victory: false,
    shake: 0,
    debris: [],
  };
}

let debrisKey = 1;
function spawnDebris(d: GameRef, x: number, z: number, color: string, n: number, impact: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8 + impact * 2;
    const up = 5 + Math.random() * 4 + impact * 1.5;
    d.debris.push({
      key: debrisKey++,
      pos: new THREE.Vector3(x, 1.0 + Math.random() * 0.4, z),
      vel: new THREE.Vector3(Math.cos(a) * speed, up, Math.sin(a) * speed),
      rot: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
      angVel: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18),
      size: 0.18 + Math.random() * 0.22,
      color,
      bornAt: d.time,
      grounded: false,
    });
  }
  // Cap total debris so old/grounded pieces drop off
  if (d.debris.length > 80) d.debris.splice(0, d.debris.length - 80);
}

function chooseAiTarget(d: GameRef, self: Fighter): Fighter | null {
  const others = liveFighters(d).filter(o => o.id !== self.id);
  if (others.length === 0) return null;
  if (self.aiKind === 'sniper') {
    let best: Fighter | null = null;
    let bestEdge = -Infinity;
    for (const o of others) {
      const r = Math.hypot(o.pos.x, o.pos.z);
      if (r > bestEdge) { bestEdge = r; best = o; }
    }
    return best;
  }
  if (self.aiKind === 'rookie') {
    const human = others.find(o => o.isPlayer);
    if (human) return human;
  }
  let nearest: Fighter | null = null;
  let nd = Infinity;
  for (const o of others) {
    const d2 = (o.pos.x - self.pos.x) ** 2 + (o.pos.z - self.pos.z) ** 2;
    if (d2 < nd) { nd = d2; nearest = o; }
  }
  return nearest;
}

function releaseDash(f: Fighter, ux: number, uz: number) {
  const charge = Math.max(0, Math.min(1, f.chargeT / CHARGE_TIME_TO_FULL));
  f.dashCharge = charge;
  f.dashDirX = ux;
  f.dashDirZ = uz;
  f.dashT = 0;
  f.state = 'dashing';
  f.chargeT = 0;
  // Wider variation than before — 0.25-1.0× peak speed. Combined with the
  // duration scaling below, distance traveled ranges ~12× between a tap
  // release and a full hold.
  const peak = DASH_PEAK_SPEED * (0.25 + charge * 0.75);
  f.vel.x = ux * peak;
  f.vel.z = uz * peak;
}

function aiPolarityThink(d: GameRef, self: Fighter) {
  if (d.time < self.aiPolarityReviewT) return;
  self.aiPolarityReviewT = d.time + AI_POLARITY_REVIEW_MIN + Math.random() * (AI_POLARITY_REVIEW_MAX - AI_POLARITY_REVIEW_MIN);
  if (self.state === 'locked') {
    // Locked = think about flipping out
    const partner = d.fighters.find(f => f.id === self.lockedToId);
    if (!partner) return;
    const myR = Math.hypot(self.pos.x, self.pos.z);
    const partnerR = Math.hypot(partner.pos.x, partner.pos.z);
    // If I'm closer to the edge than my partner, I want to break the
    // lock — flip to match polarity. Otherwise hold the lock (carry
    // the partner farther toward the edge).
    if (myR > partnerR + 0.5) {
      self.polarity = partner.polarity;
    }
    return;
  }
  // Normal play: pick polarity based on current target & threats.
  // Heuristic — if any visible threat is dashing toward me, match their
  // polarity so we shove apart. Otherwise pick opposite for attract.
  const others = d.fighters.filter(f => f.id !== self.id && alive(f));
  let threatPolarity: Polarity | null = null;
  for (const o of others) {
    if (o.state !== 'dashing' && o.state !== 'charging') continue;
    const dx = self.pos.x - o.pos.x;
    const dz = self.pos.z - o.pos.z;
    if (Math.hypot(dx, dz) < 8) {
      threatPolarity = o.polarity;
      break;
    }
  }
  if (threatPolarity) {
    self.polarity = threatPolarity;
    return;
  }
  // No threat — try to set OPPOSITE to current target for offense
  const target = self.aiTargetId !== null
    ? d.fighters.find(f => f.id === self.aiTargetId && alive(f))
    : null;
  if (target) {
    const desired: Polarity = target.polarity === 'red' ? 'blue' : 'red';
    // Don't always flip — adds some unpredictability for the player
    if (Math.random() < 0.65) self.polarity = desired;
  }
}

function aiThink(d: GameRef, self: Fighter) {
  if (self.state === 'dashing' || self.state === 'slide' || self.state === 'locked') return;
  if (d.time < self.aiNextDecisionT) return;

  const target = chooseAiTarget(d, self);
  self.aiTargetId = target?.id ?? null;
  const baseInterval = AI_REACT_INTERVAL_MIN + Math.random() * (AI_REACT_INTERVAL_MAX - AI_REACT_INTERVAL_MIN);
  self.aiNextDecisionT = d.time + baseInterval;

  if (!target) {
    self.chargeT = 0;
    self.vel.x *= 0.5; self.vel.z *= 0.5;
    return;
  }

  const dx = target.pos.x - self.pos.x;
  const dz = target.pos.z - self.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) return;
  const ux = dx / dist;
  const uz = dz / dist;
  self.rot = Math.atan2(ux, uz);

  const targetEdgeR = Math.hypot(target.pos.x, target.pos.z);
  const edgeFactor = Math.min(1, targetEdgeR / ARENA_RADIUS);

  if (self.aiKind === 'sniper') {
    if (edgeFactor > 0.75 && dist < 8) {
      self.chargeT = CHARGE_TIME_TO_FULL * (0.85 + Math.random() * 0.15);
      releaseDash(self, ux, uz);
    } else {
      self.vel.x = ux * BASE_SPEED * 0.40;
      self.vel.z = uz * BASE_SPEED * 0.40;
    }
  } else if (self.aiKind === 'bruiser') {
    if (dist < 9) {
      self.chargeT = CHARGE_TIME_TO_FULL * (0.40 + Math.random() * 0.30);
      releaseDash(self, ux, uz);
    } else {
      self.vel.x = ux * BASE_SPEED * 0.90;
      self.vel.z = uz * BASE_SPEED * 0.90;
    }
  } else {
    if (dist < 5 && Math.random() < 0.55) {
      self.chargeT = CHARGE_TIME_TO_FULL * (0.30 + Math.random() * 0.30);
      releaseDash(self, ux, uz);
    } else {
      self.vel.x = ux * BASE_SPEED * 0.65;
      self.vel.z = uz * BASE_SPEED * 0.65;
    }
  }
}

export interface GameLoopParams {
  state: React.MutableRefObject<GameRef>;
  playing: boolean;
  stick: Stick;
  onScore: (s: number) => void;
  onTimeLeft: (s: number) => void;
  onKos: (n: number) => void;
  onGameOver: (won: boolean, final: number) => void;
  playSfx: (k: SfxKey) => void;
  haptic?: (k: 'light' | 'heavy') => void;
}

export function useGameLoop(p: GameLoopParams) {
  useFrame((_, delta) => {
    const d = p.state.current;
    if (!p.playing || d.gameOver) return;
    const c = Math.min(delta, 0.05);
    d.time += c;
    d.roundT += c;
    // Decay shake every frame (returns to 0 in ~250ms)
    d.shake = Math.max(0, d.shake - c * 4.5);
    p.onTimeLeft(Math.max(0, ROUND_TIME - d.roundT));

    const player = d.fighters.find(f => f.isPlayer);

    // ---- INPUT (player) — only when idle/charging (locked blocks charge) ----
    if (player && alive(player) && (player.state === 'idle' || player.state === 'charging')) {
      const mag = Math.hypot(p.stick.x, p.stick.y);
      const active = p.stick.active && mag > 0.08;
      if (active) {
        if (player.state === 'idle') {
          player.state = 'charging';
          player.chargeT = 0;
          p.playSfx('charge_start');
        }
        player.chargeT = Math.min(CHARGE_TIME_TO_FULL, player.chargeT + c);
        const ux = p.stick.x / Math.max(mag, 0.001);
        const uz = p.stick.y / Math.max(mag, 0.001);
        player.rot = Math.atan2(ux, uz);
        const creep = BASE_SPEED * 0.30;
        player.vel.x = ux * creep;
        player.vel.z = uz * creep;
      } else if (player.state === 'charging') {
        const ang = player.rot;
        const ux = Math.sin(ang);
        const uz = Math.cos(ang);
        releaseDash(player, ux, uz);
        p.playSfx('dash');
        p.haptic?.('light');
      }
    }

    // ---- AI ----
    for (const f of d.fighters) {
      if (f.isPlayer || !alive(f)) continue;
      aiPolarityThink(d, f);
      aiThink(d, f);
    }

    // ---- DASH / SLIDE PHASE PROGRESSION ----
    // Dash peak duration scales with charge — short tap = quick poke,
    // full charge = long committed dash. Distance traveled multiplies
    // by ~12× between min and max charge.
    for (const f of d.fighters) {
      if (f.state !== 'dashing' && f.state !== 'slide') continue;
      f.dashT += c;
      const myPeakDur = DASH_PEAK_DURATION * (0.5 + f.dashCharge * 1.5); // 0.15s..0.60s
      if (f.state === 'dashing' && f.dashT >= myPeakDur) {
        f.state = 'slide';
      }
      if (f.state === 'slide' && f.dashT >= myPeakDur + DASH_SLIDE_DURATION) {
        f.state = 'idle';
        f.dashT = 0;
      }
      if (f.state === 'slide') {
        const k = Math.exp(-FRICTION_PER_SEC * c);
        f.vel.x *= k;
        f.vel.z *= k;
      }
    }

    // ---- DEBRIS PHYSICS ----
    // Each piece falls with gravity, spins, settles on the floor, fades
    // out after a few seconds. Cheap O(N), N capped at 80.
    for (let i = d.debris.length - 1; i >= 0; i--) {
      const p = d.debris[i];
      if (!p.grounded) {
        p.vel.y -= 22 * c; // gravity
        p.pos.x += p.vel.x * c;
        p.pos.y += p.vel.y * c;
        p.pos.z += p.vel.z * c;
        p.rot.x += p.angVel.x * c;
        p.rot.y += p.angVel.y * c;
        p.rot.z += p.angVel.z * c;
        if (p.pos.y < p.size * 0.5) {
          p.pos.y = p.size * 0.5;
          p.vel.x *= 0.55;
          p.vel.z *= 0.55;
          p.vel.y = Math.abs(p.vel.y) > 1.5 ? -p.vel.y * 0.4 : 0;
          if (Math.abs(p.vel.y) < 0.1) {
            p.grounded = true;
            p.angVel.set(0, 0, 0);
          }
        }
      }
      // Despawn after 2.5s
      if (d.time - p.bornAt > 2.5) {
        d.debris.splice(i, 1);
      }
    }

    // ---- INTEGRATE POSITIONS ----
    for (const f of d.fighters) {
      if (f.state === 'down') continue;
      if (f.state === 'falling') {
        f.fallT += c;
        f.pos.y -= 12 * c;
        if (f.fallT > 1.2) f.state = 'down';
        continue;
      }
      f.pos.x += f.vel.x * c;
      f.pos.z += f.vel.z * c;
      if (f.state === 'idle') {
        const k = Math.exp(-FRICTION_PER_SEC * c);
        f.vel.x *= k;
        f.vel.z *= k;
      }
    }

    // ---- FIGHTER-FIGHTER COLLISION ----
    // Two branches now:
    //   SAME polarity → strong repel (the original sumo shove behavior)
    //   OPPOSITE polarity → magnetic lock — they stick, share velocity,
    //   and the attacker can drag the defender off the edge.
    const live = liveFighters(d);
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        // Skip pairs that are already locked together — handled in the
        // locked-pair update below.
        if (a.lockedToId === b.id || b.lockedToId === a.id) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const dist = Math.hypot(dx, dz);
        const minDist = FIGHTER_RADIUS * 2;
        if (dist < 0.001 || dist >= minDist) continue;
        const overlap = minDist - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        a.pos.x -= nx * overlap * 0.5;
        a.pos.z -= nz * overlap * 0.5;
        b.pos.x += nx * overlap * 0.5;
        b.pos.z += nz * overlap * 0.5;
        const va_n = a.vel.x * nx + a.vel.z * nz;
        const vb_n = b.vel.x * nx + b.vel.z * nz;
        const rel = va_n - vb_n;
        if (rel <= 0) continue; // approaching — proceed
        const oppositePoles = a.polarity !== b.polarity;
        const cx = (a.pos.x + b.pos.x) * 0.5;
        const cz = (a.pos.z + b.pos.z) * 0.5;
        emitFx(d, 'collide', cx, cz);
        // Camera shake
        const impact = Math.min(1, rel / 18);
        d.shake = Math.min(0.8, d.shake + impact * (oppositePoles ? 0.30 : 0.55));
        // Spawn debris on REPEL hits — pieces of mecha fly off. Count
        // scales with impact. Color from one of the involved fighters.
        if (!oppositePoles) {
          const debrisN = 3 + Math.floor(impact * 6);
          const palA = FIGHTER_COLORS[a.paletteIdx % FIGHTER_COLORS.length];
          const palB = FIGHTER_COLORS[b.paletteIdx % FIGHTER_COLORS.length];
          spawnDebris(d, cx, cz, palA.body, Math.ceil(debrisN / 2), impact);
          spawnDebris(d, cx, cz, palB.body, Math.floor(debrisN / 2), impact);
        }
        if (oppositePoles) {
          // STICK — combine velocities, both enter 'locked' state.
          const sharedVx = (a.vel.x + b.vel.x) * 0.5;
          const sharedVz = (a.vel.z + b.vel.z) * 0.5;
          a.vel.x = sharedVx;
          a.vel.z = sharedVz;
          b.vel.x = sharedVx;
          b.vel.z = sharedVz;
          a.state = 'locked';
          b.state = 'locked';
          a.lockedToId = b.id;
          b.lockedToId = a.id;
          a.lockT = POLARITY_LOCK_DURATION;
          b.lockT = POLARITY_LOCK_DURATION;
          a.chargeT = 0;
          b.chargeT = 0;
          p.playSfx('magnet_lock');
          p.haptic?.('heavy');
        } else {
          // REPEL — shove physics + DAMAGE
          a.vel.x += (-rel * (1 - COLLIDE_BOUNCE)) * nx;
          a.vel.z += (-rel * (1 - COLLIDE_BOUNCE)) * nz;
          b.vel.x += (rel * COLLIDE_TRANSFER) * nx;
          b.vel.z += (rel * COLLIDE_TRANSFER) * nz;
          const wasHeavy = a.state === 'dashing' || b.state === 'dashing';
          p.playSfx('collide');
          if (wasHeavy) p.haptic?.('heavy'); else p.haptic?.('light');
          if (a.state === 'dashing') { a.state = 'slide'; a.dashT = DASH_PEAK_DURATION; }
          if (b.state === 'dashing') { b.state = 'slide'; b.dashT = DASH_PEAK_DURATION; }
          // Damage scales with closing velocity. The DEFENDER (the one
          // that wasn't dashing into the other) takes the most damage,
          // because they're absorbing the dasher's momentum.
          const dmg = rel * DAMAGE_PER_IMPACT_UNIT;
          if (a.state === 'slide' && b.state !== 'slide') {
            // a was the attacker (it dashed and just dropped into slide)
            b.hp = Math.max(0, b.hp - dmg);
            b.lastHitById = a.id;
            b.damagedFx.push({ x: -nx * FIGHTER_RADIUS, z: -nz * FIGHTER_RADIUS, born: d.time });
            if (b.damagedFx.length > 6) b.damagedFx.shift();
          } else if (b.state === 'slide' && a.state !== 'slide') {
            a.hp = Math.max(0, a.hp - dmg);
            a.lastHitById = b.id;
            a.damagedFx.push({ x: nx * FIGHTER_RADIUS, z: nz * FIGHTER_RADIUS, born: d.time });
            if (a.damagedFx.length > 6) a.damagedFx.shift();
          } else {
            // Mutual bump — split damage
            const half = dmg * 0.5;
            a.hp = Math.max(0, a.hp - half);
            b.hp = Math.max(0, b.hp - half);
            a.lastHitById = b.id;
            b.lastHitById = a.id;
          }
        }
      }
    }

    // ---- LOCKED PAIR UPDATE ----
    // Keep partners stuck at exactly 2*FIGHTER_RADIUS, share velocity, tick
    // down the lock timer. Either side flipping to match polarity will
    // break the lock instantly (handled in flipPlayerPolarity for the
    // player; the AI may flip during the polarity review pass).
    const handledLocks = new Set<number>();
    for (const a of d.fighters) {
      if (a.state !== 'locked' || a.lockedToId === null) continue;
      if (handledLocks.has(a.id)) continue;
      const b = d.fighters.find(f => f.id === a.lockedToId);
      if (!b || b.state !== 'locked') {
        // Partner gone — release a
        a.state = 'idle';
        a.lockedToId = null;
        a.lockT = 0;
        continue;
      }
      handledLocks.add(a.id);
      handledLocks.add(b.id);
      // Tick lock timer
      a.lockT -= c;
      b.lockT -= c;
      if (a.polarity === b.polarity) {
        releaseLock(a, b, true);
        p.playSfx('magnet_release');
        continue;
      }
      if (a.lockT <= 0) {
        releaseLock(a, b, true);
        p.playSfx('magnet_release');
        continue;
      }
      // Snap relative position to exactly 2R apart, midpoint preserved
      const midX = (a.pos.x + b.pos.x) * 0.5;
      const midZ = (a.pos.z + b.pos.z) * 0.5;
      const dx = b.pos.x - a.pos.x;
      const dz = b.pos.z - a.pos.z;
      const dist = Math.max(0.001, Math.hypot(dx, dz));
      const nx = dx / dist;
      const nz = dz / dist;
      a.pos.x = midX - nx * FIGHTER_RADIUS;
      a.pos.z = midZ - nz * FIGHTER_RADIUS;
      b.pos.x = midX + nx * FIGHTER_RADIUS;
      b.pos.z = midZ + nz * FIGHTER_RADIUS;
      // Share the velocity (gentle decay)
      const sharedVx = (a.vel.x + b.vel.x) * 0.5;
      const sharedVz = (a.vel.z + b.vel.z) * 0.5;
      const k = Math.exp(-LOCK_FRICTION_PER_SEC * c);
      a.vel.x = sharedVx * k;
      a.vel.z = sharedVz * k;
      b.vel.x = sharedVx * k;
      b.vel.z = sharedVz * k;
    }

    // ---- HP-ZERO EXPLOSION ----
    // When a fighter's HP hits 0, they get launched outward with high
    // velocity so they dramatically fly off the platform. Damage KO is
    // credited to whoever last hit them.
    for (const f of d.fighters) {
      if (!alive(f) || f.hp > 0) continue;
      const r = Math.hypot(f.pos.x, f.pos.z);
      if (r < 0.001) {
        // At origin — pick a random direction
        const a = Math.random() * Math.PI * 2;
        f.vel.x = Math.cos(a) * KO_EXPLOSION_VELOCITY;
        f.vel.z = Math.sin(a) * KO_EXPLOSION_VELOCITY;
      } else {
        f.vel.x = (f.pos.x / r) * KO_EXPLOSION_VELOCITY;
        f.vel.z = (f.pos.z / r) * KO_EXPLOSION_VELOCITY;
      }
      // Force them into slide so they keep moving
      f.state = 'slide';
      f.dashT = DASH_PEAK_DURATION;
    }

    // ---- FALL-OFF DETECTION ----
    for (const f of d.fighters) {
      if (!alive(f)) continue;
      const r = Math.hypot(f.pos.x, f.pos.z);
      if (r > FALL_RADIUS) {
        if (d.roundT < GRACE_PERIOD) {
          const k = (FALL_RADIUS - 0.5) / r;
          f.pos.x *= k;
          f.pos.z *= k;
          f.vel.x *= -0.3;
          f.vel.z *= -0.3;
          continue;
        }
        f.state = 'falling';
        f.fallT = 0;
        emitFx(d, 'fall', f.pos.x, f.pos.z);
        p.playSfx('fall');
        if (!f.isPlayer) {
          d.score += SCORE_KO;
          d.kos++;
          p.onKos(d.kos);
          emitFx(d, 'ko', f.pos.x, f.pos.z);
          p.playSfx('ko');
        }
      }
    }

    // ---- SCORE / WIN-LOSE ----
    d.score += SCORE_PER_SECOND_SURVIVED * c;
    p.onScore(Math.floor(d.score));

    const playerLive = d.fighters.find(f => f.isPlayer && alive(f));
    const liveAi = d.fighters.filter(f => !f.isPlayer && alive(f));

    if (!playerLive) {
      const playerF = d.fighters.find(f => f.isPlayer);
      if (playerF && playerF.state === 'down') {
        d.gameOver = true;
        p.playSfx('game_over');
        setTimeout(() => p.onGameOver(false, Math.floor(d.score)), 500);
        return;
      }
    }
    if (playerLive && liveAi.length === 0) {
      d.victory = true;
      d.gameOver = true;
      const survivalBonus = Math.floor(Math.max(0, ROUND_TIME - d.roundT) * 5);
      d.score += survivalBonus;
      p.onScore(Math.floor(d.score));
      p.playSfx('victory');
      setTimeout(() => p.onGameOver(true, Math.floor(d.score)), 600);
      return;
    }
    if (d.roundT >= ROUND_TIME) {
      d.victory = !!playerLive;
      d.gameOver = true;
      if (d.victory) p.playSfx('victory'); else p.playSfx('game_over');
      setTimeout(() => p.onGameOver(!!playerLive, Math.floor(d.score)), 400);
      return;
    }
  });
}
