// Sumo King — top-down 1v3 penguin sumo. Numbers tuned for a quick,
// punchy round (60s) where positioning + charge timing matter more than
// twitch movement.

// Arena — circular ring, dist-to-origin > FALL_RADIUS = out.
export const ARENA_RADIUS = 15;            // visible ring
export const DANGER_RADIUS = 14;           // visible warning band (14..15)
export const FALL_RADIUS  = 16.0;          // dist past this = you're falling

// Fighter footprint + base move
// Bumped up — at the previous 0.95 footprint on a 30u arena the mechas
// read tiny on a phone screen. 1.30 makes them clearly visible while
// still leaving room to maneuver.
export const FIGHTER_RADIUS = 1.30;        // collision radius
// Visual scale multiplier on top of the geometry — used in JSX
export const FIGHTER_VISUAL_SCALE = 2.50;
export const BASE_SPEED = 6.0;             // free movement speed when not charging/dashing
export const CHARGE_TIME_TO_FULL = 0.55;   // seconds of holding stick to max charge
export const DASH_PEAK_SPEED = 22;         // velocity at full charge
export const DASH_PEAK_DURATION = 0.30;    // seconds of full-speed phase
export const DASH_SLIDE_DURATION = 0.70;   // seconds of decay phase
export const FRICTION_PER_SEC = 3.2;       // exponential decay rate when no input

// Collisions — relative-velocity transfer between fighters
export const COLLIDE_TRANSFER = 0.85;      // what % of (Va-Vb) gets handed to the loser
export const COLLIDE_BOUNCE = 0.20;        // small reflection on the hitter

// Match
export const ROUND_TIME = 60;              // seconds
export const PLAYER_COUNT_AI = 3;          // 1 human + 3 AI
export const SCORE_KO = 50;
export const SCORE_PER_SECOND_SURVIVED = 1;

// Health — base HP per fighter. Damage scales with collision impact
// velocity. Below thresholds visual states unlock (sparks → smoke → fire).
export const FIGHTER_MAX_HP = 100;
export const DAMAGE_PER_IMPACT_UNIT = 4.5;  // multiplied by relative velocity
export const HP_THRESHOLD_SPARK = 75;       // below this → sparks
export const HP_THRESHOLD_SMOKE = 45;       // below this → smoke trail
export const HP_THRESHOLD_FIRE = 22;        // below this → flames
// When HP hits 0, the fighter explodes off the platform — adds an
// outward velocity kick so they fly off dramatically.
export const KO_EXPLOSION_VELOCITY = 18;

// AI behavior
export const AI_REACT_INTERVAL_MIN = 0.4;  // re-evaluate target every 0.4..1.0s
export const AI_REACT_INTERVAL_MAX = 1.0;

// Camera — closer to the action so the (now larger) fighters read big
// on a phone screen. Less overhead tilt means the mecha body is
// recognizable from the side.
export const CAMERA_POS: [number, number, number] = [0, 26, 9];
export const CAMERA_FOV = 65;
export const CAMERA_FOLLOW = 1.0;
export const CAMERA_LERP = 0.14;

// Grace — players can't be KO'd in this opening window so they have time
// to read the field and start charging.
export const GRACE_PERIOD = 1.5;

// Mecha palette — body colors are BRIGHT now so the mechas stand out
// against the dark navy floor. Previous dark-grey bodies blended into
// the platform. Each fighter has a distinct chassis hue (silver / red /
// green / magenta) for at-a-glance identification.
export const FIGHTER_COLORS = [
  { body: '#a8c0d8', chest: '#5a6e88', belt: '#4afcff' }, // player — bright steel-silver
  { body: '#d05030', chest: '#7a2a18', belt: '#ff5b3a' }, // Rookie  — bright red
  { body: '#40c060', chest: '#1a5e2a', belt: '#54ff8e' }, // Bruiser — bright green
  { body: '#c060c0', chest: '#5a1a5a', belt: '#ff62d2' }, // Sniper  — bright magenta
];

export type AiKind = 'rookie' | 'bruiser' | 'sniper';
export const AI_LINEUP: AiKind[] = ['rookie', 'bruiser', 'sniper'];

// ===== POLARITY =====
// The point of differentiation from the older penguin-sumo: every mecha
// has a magnetic polarity that the player can flip. Same poles repel
// (current shove behavior); opposite poles ATTRACT — they stick together
// and combine momentum, letting an attacker drag a defender off the edge.
// Player must read the situation and flip accordingly.

export type Polarity = 'red' | 'blue';
export const POLARITY_RED  = '#ff3050';
export const POLARITY_BLUE = '#36b8ff';

// How long opposite-polarity collision keeps two fighters magnetically
// locked together (seconds). They share velocity during this window;
// either side can break free early by flipping to match polarity.
export const POLARITY_LOCK_DURATION = 0.9;
// Repulsion impulse applied when a lock breaks (either by timeout OR by
// a same-polarity match after flip)
export const POLARITY_RELEASE_KICK = 6.0;
// AI polarity-flip cadence — checked every interval, chance to flip is
// situational (e.g. flip to escape a lock).
export const AI_POLARITY_REVIEW_MIN = 0.8;
export const AI_POLARITY_REVIEW_MAX = 2.2;
// During a lock, the combined-velocity friction is lower so dashes
// actually carry both fighters somewhere.
export const LOCK_FRICTION_PER_SEC = 0.9;
