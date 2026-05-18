// Sumo King — top-down 1v3 penguin sumo. Numbers tuned for a quick,
// punchy round (60s) where positioning + charge timing matter more than
// twitch movement.

// Arena — circular ring, dist-to-origin > FALL_RADIUS = out.
export const ARENA_RADIUS = 15;            // visible ring
export const DANGER_RADIUS = 14;           // visible warning band (14..15)
export const FALL_RADIUS  = 16.0;          // dist past this = you're falling

// Fighter footprint + base move
export const FIGHTER_RADIUS = 0.95;        // collision radius
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

// AI behavior
export const AI_REACT_INTERVAL_MIN = 0.4;  // re-evaluate target every 0.4..1.0s
export const AI_REACT_INTERVAL_MAX = 1.0;

// Camera — full follow with a near-overhead angle. The player stays
// centered so they never run off-screen; the cyan rim of the arena is
// clearly visible at the screen edge as they near the boundary.
export const CAMERA_POS: [number, number, number] = [0, 30, 6];
export const CAMERA_FOV = 65;
export const CAMERA_FOLLOW = 1.0;
export const CAMERA_LERP = 0.14;

// Grace — players can't be KO'd in this opening window so they have time
// to read the field and start charging.
export const GRACE_PERIOD = 1.5;

// Mecha palette — each fighter has a chassis tone + chest plate + LED
// stripe color. Player slot 0 gets the cyan LED so they stand out against
// the warm lava periphery.
export const FIGHTER_COLORS = [
  { body: '#2a3445', chest: '#1a2030', belt: '#4afcff' }, // player — cyan LED
  { body: '#3a2826', chest: '#241410', belt: '#ff5b3a' }, // Rookie  — red LED
  { body: '#2a3a26', chest: '#10241a', belt: '#54ff8e' }, // Bruiser — green LED
  { body: '#382a3a', chest: '#1a1024', belt: '#ff62d2' }, // Sniper  — magenta LED
];

export type AiKind = 'rookie' | 'bruiser' | 'sniper';
export const AI_LINEUP: AiKind[] = ['rookie', 'bruiser', 'sniper'];
