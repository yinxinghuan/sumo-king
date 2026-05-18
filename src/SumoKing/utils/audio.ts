// Sumo King audio — taiko-flavored stadium BGM + punchy procedural SFX.
// All synthesized via WebAudio; no asset files.
//
// SFX keys match the game loop's emissions: charge_start / dash / collide
// / ko / fall / game_over / victory.

export type SfxKey =
  | 'charge_start' | 'dash' | 'collide' | 'ko' | 'fall'
  | 'game_over'    | 'victory';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  return ctx;
}

export async function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') await c.resume();
}

function tone(
  freq: number, type: OscillatorType, dur: number, peak: number,
  t0: number, glideTo?: number, dst?: AudioNode,
) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(dst ?? master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseBurst(dur: number, peak: number, t0: number, lp = 2000, hp = 0) {
  if (!ctx || !master) return;
  const buf = ctx.createBuffer(1, Math.max(1, Math.ceil(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let chain: AudioNode = src;
  if (hp > 0) {
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = hp;
    src.connect(hpf);
    chain = hpf;
  }
  chain.connect(filt).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

export function playSfx(key: SfxKey) {
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') c.resume();
  const t = c.currentTime;
  switch (key) {
    case 'charge_start':
      // Low rising hum — "engine spooling"
      tone(120, 'sawtooth', 0.18, 0.10, t, 240);
      break;
    case 'dash':
      // Electric thrust — plasma whine + servo punch
      tone(1100, 'sawtooth', 0.18, 0.18, t, 280);    // descending plasma whine
      tone(180,  'sawtooth', 0.18, 0.20, t, 90);     // low servo
      noiseBurst(0.16, 0.16, t,        3500, 1200);  // air crackle
      break;
    case 'collide':
      // Metallic clang — low thud + ringing harmonic + sharp transient
      tone(85,   'sine',     0.20, 0.45, t, 40);
      tone(380,  'triangle', 0.30, 0.18, t,        220);  // ring
      tone(1400, 'square',   0.06, 0.20, t,        700);  // strike
      noiseBurst(0.22, 0.28, t,       1800, 400);
      break;
    case 'ko':
      // Celebratory chime — minor->major leap
      tone(660, 'triangle', 0.18, 0.28, t,        880);
      tone(880, 'triangle', 0.22, 0.22, t + 0.08, 1320);
      tone(1320,'triangle', 0.30, 0.20, t + 0.16, 1760);
      break;
    case 'fall':
      // Downward whoosh + splash low
      tone(440, 'sawtooth', 0.40, 0.18, t, 110);
      noiseBurst(0.45, 0.18, t + 0.10, 900, 200);
      break;
    case 'game_over':
      // Dirge — three descending tones
      tone(440, 'triangle', 0.32, 0.26, t,        330);
      tone(330, 'triangle', 0.32, 0.24, t + 0.28, 247);
      tone(247, 'sawtooth', 0.55, 0.22, t + 0.56, 165);
      break;
    case 'victory':
      // Bright arpeggio up the major
      tone(523, 'triangle', 0.16, 0.24, t,         660);
      tone(660, 'triangle', 0.16, 0.24, t + 0.10,  784);
      tone(784, 'triangle', 0.20, 0.24, t + 0.20,  988);
      tone(988, 'triangle', 0.30, 0.22, t + 0.30, 1175);
      break;
  }
}

// ---------- BGM ----------
//
// Stadium taiko bed — slow boom-pa-boom-pa kick pattern + ambient crowd
// hush. Quiet enough not to fight the SFX but gives the round a pulse.

const BGM_BPM = 72;
const STEP_T = 60 / BGM_BPM / 2; // 8th-note duration
let bgmGain: GainNode | null = null;
let bgmRunning = false;
let bgmTimer: number | null = null;
let bgmNextStepT = 0;
let bgmStep = 0;

function taikoHit(t: number, peak: number, lowFreq = 80) {
  if (!ctx || !bgmGain) return;
  // Body: low sine with steep pitch drop
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(lowFreq * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(lowFreq * 0.5, t + 0.15);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0006, t + 0.30);
  o.connect(g).connect(bgmGain);
  o.start(t);
  o.stop(t + 0.35);
  // Stick click
  if (!ctx) return;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.04), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 1200;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0, t);
  cg.gain.linearRampToValueAtTime(peak * 0.35, t + 0.002);
  cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(filt).connect(cg).connect(bgmGain);
  src.start(t);
  src.stop(t + 0.1);
}

function scheduleBgmAhead() {
  if (!ctx || !bgmRunning || !bgmGain) return;
  const horizon = ctx.currentTime + 0.4;
  while (bgmNextStepT < horizon) {
    const t = bgmNextStepT;
    const stepInBar = bgmStep % 8;
    // Boom on beats 1, 5 ; soft pa on 3, 7
    if (stepInBar === 0) taikoHit(t, 0.20, 70);
    else if (stepInBar === 4) taikoHit(t, 0.16, 90);
    else if (stepInBar === 2 || stepInBar === 6) taikoHit(t, 0.08, 130);
    bgmNextStepT += STEP_T;
    bgmStep++;
  }
}

export function startBgm(volume = 0.08) {
  const c = ensureCtx();
  if (!c || !master) return;
  if (c.state === 'suspended') c.resume();
  stopBgm();

  bgmGain = c.createGain();
  bgmGain.gain.value = 0;
  bgmGain.gain.linearRampToValueAtTime(volume, c.currentTime + 1.0);
  bgmGain.connect(master);

  bgmRunning = true;
  bgmStep = 0;
  bgmNextStepT = c.currentTime + 0.10;

  bgmTimer = window.setInterval(() => scheduleBgmAhead(), 180) as unknown as number;
  scheduleBgmAhead();
}

export function stopBgm() {
  bgmRunning = false;
  if (bgmTimer !== null) { window.clearInterval(bgmTimer); bgmTimer = null; }
  if (bgmGain && ctx) {
    const t = ctx.currentTime;
    bgmGain.gain.cancelScheduledValues(t);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, t);
    bgmGain.gain.linearRampToValueAtTime(0, t + 0.4);
    const g = bgmGain;
    setTimeout(() => g.disconnect(), 600);
    bgmGain = null;
  }
}
