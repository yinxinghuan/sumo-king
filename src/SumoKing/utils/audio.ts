// Sumo King audio — taiko-flavored stadium BGM + punchy procedural SFX.
// All synthesized via WebAudio; no asset files.
//
// SFX keys match the game loop's emissions: charge_start / dash / collide
// / ko / fall / game_over / victory.

export type SfxKey =
  | 'charge_start' | 'dash' | 'collide' | 'ko' | 'fall'
  | 'game_over'    | 'victory'
  | 'polarity_flip' | 'magnet_lock' | 'magnet_release';

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
    case 'polarity_flip':
      // Quick electric "swap" — two sharp opposite glides
      tone(880, 'square', 0.06, 0.18, t,        1400);
      tone(440, 'square', 0.08, 0.14, t + 0.04, 220);
      break;
    case 'magnet_lock':
      // Drone "lock-on" — sustained dual tone with quick fade
      tone(180, 'sine',     0.40, 0.22, t,        260);
      tone(540, 'triangle', 0.40, 0.16, t + 0.02, 720);
      tone(360, 'sine',     0.30, 0.12, t + 0.08, 480);
      break;
    case 'magnet_release':
      // Sharp pop — two-tone snap
      tone(660, 'square', 0.06, 0.20, t,         260);
      tone(220, 'sine',   0.10, 0.20, t + 0.02,  110);
      noiseBurst(0.10, 0.10, t, 3000, 500);
      break;
  }
}

// ---------- BGM ----------
//
// Electronic mecha-arena BGM. 128 BPM, four-on-the-floor kick, snare on
// 2+4, hi-hat 16ths, square-wave synth bass on the root, square arp
// playing a minor-key riff. Drives the round with energy.

const BGM_BPM = 128;
const STEP_T = 60 / BGM_BPM / 4; // 16th-note
const BAR = 16;                   // 16 16ths per bar
const PHRASE_BARS = 4;
let bgmGain: GainNode | null = null;
let bgmRunning = false;
let bgmTimer: number | null = null;
let bgmNextStepT = 0;
let bgmStep = 0;

// Bass root — A minor (A2). Notes are semitone offsets from this root.
const BGM_ROOT_HZ = 110; // A2
function midiOffsetHz(semis: number) {
  return BGM_ROOT_HZ * Math.pow(2, semis / 12);
}

// Phrase: A minor → F major → G major → A minor over 4 bars
const BASS_PATTERN = [0, 0, 0, 0, -4, -4, -4, -4, -2, -2, -2, -2, 0, 0, 0, 0];

// Arp riff (semitones above root, plays in upper octave)
// A minor pentatonic-ish — 16-step phrase repeats each bar
const ARP_PATTERN = [
  12, -1, 15, -1, 19, -1, 24, 19,
  12, -1, 15, -1, 19, -1, 22, 19,
];

function kick(t: number, peak: number) {
  if (!ctx || !bgmGain) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.10);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0006, t + 0.22);
  o.connect(g).connect(bgmGain);
  o.start(t); o.stop(t + 0.25);
}

function snare(t: number, peak: number) {
  if (!ctx || !bgmGain) return;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'bandpass';
  filt.frequency.value = 1600;
  filt.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0006, t + 0.12);
  src.connect(filt).connect(g).connect(bgmGain);
  src.start(t); src.stop(t + 0.15);
  // Body thud
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(110, t + 0.06);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0, t);
  og.gain.linearRampToValueAtTime(peak * 0.6, t + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0006, t + 0.10);
  o.connect(og).connect(bgmGain);
  o.start(t); o.stop(t + 0.12);
}

function hat(t: number, peak: number, closed: boolean) {
  if (!ctx || !bgmGain) return;
  const dur = closed ? 0.035 : 0.10;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt).connect(g).connect(bgmGain);
  src.start(t); src.stop(t + dur + 0.05);
}

function bassNote(freq: number, t: number, peak: number, dur: number) {
  if (!ctx || !bgmGain) return;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, t);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(1800, t);
  filt.frequency.exponentialRampToValueAtTime(400, t + dur * 0.7);
  filt.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
  o.connect(filt).connect(g).connect(bgmGain);
  o.start(t); o.stop(t + dur + 0.05);
}

function arpNote(freq: number, t: number, peak: number) {
  if (!ctx || !bgmGain) return;
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(freq, t);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 3200;
  filt.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0006, t + 0.18);
  o.connect(filt).connect(g).connect(bgmGain);
  o.start(t); o.stop(t + 0.22);
}

function scheduleBgmAhead() {
  if (!ctx || !bgmRunning || !bgmGain) return;
  const horizon = ctx.currentTime + 0.4;
  while (bgmNextStepT < horizon) {
    const t = bgmNextStepT;
    const stepInBar = bgmStep % BAR;
    const stepInPhrase = bgmStep % (BAR * PHRASE_BARS);
    // KICK — four-on-the-floor: every quarter note (steps 0, 4, 8, 12)
    if (stepInBar % 4 === 0) kick(t, 0.22);
    // SNARE — on 2 and 4 (steps 4 and 12)
    if (stepInBar === 4 || stepInBar === 12) snare(t, 0.13);
    // HI-HAT — every 8th note (steps 0, 2, 4, ..., 14), accent open hat
    // on the off-beats (steps 2, 6, 10, 14)
    if (stepInBar % 2 === 0) hat(t, 0.05, true);
    if (stepInBar % 4 === 2) hat(t, 0.07, false);
    // BASS — sustained note on each beat, follows BASS_PATTERN
    if (stepInBar % 4 === 0) {
      const semis = BASS_PATTERN[stepInPhrase];
      bassNote(midiOffsetHz(semis), t, 0.10, STEP_T * 3.5);
    }
    // ARP — 16ths from ARP_PATTERN
    const arpSemis = ARP_PATTERN[stepInBar];
    if (arpSemis >= 0) {
      const phraseSemis = BASS_PATTERN[stepInPhrase] + arpSemis;
      arpNote(midiOffsetHz(phraseSemis), t, 0.045);
    }
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
