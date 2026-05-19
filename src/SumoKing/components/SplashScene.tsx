// Pure SVG/CSS splash — no 3D Canvas → safe to mount during preload.
// Sumo arena viewed from above: 4 colored penguin chips on an ice ring
// with a sun glow at the bottom. Drifting snow + ring pulse give it life.
import { useState } from 'react';
import { t } from '../i18n';

interface Snowflake {
  id: number;
  x: number;
  delay: number;
  duration: number;
  size: number;
}

const SPLASH_FIGHTERS = [
  { color: '#4afcff', x: 50, y: 80 },  // player (bottom) — cyan
  { color: '#ff5b3a', x: 18, y: 60 },  // rookie (left)   — red
  { color: '#54ff8e', x: 82, y: 60 },  // bruiser (right) — green
  { color: '#ff62d2', x: 50, y: 38 },  // sniper (top)    — magenta
];

// Poster mode lineup — fighters drawn as bigger, detailed mechs in a row
// along the bottom. ?poster=1 in the URL turns this on.
const POSTER_LINEUP = [
  { body: '#a8c0d8', chest: '#5a6e88', led: '#4afcff', label: 'YOU' },
  { body: '#d05030', chest: '#7a2a18', led: '#ff5b3a', label: 'ROOKIE' },
  { body: '#40c060', chest: '#1a5e2a', led: '#54ff8e', label: 'BRUISER' },
  { body: '#c060c0', chest: '#5a1a5a', led: '#ff62d2', label: 'SNIPER' },
];

function isPosterMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('poster') === '1';
}

export function SplashScene({ onStart, highScore }: { onStart: () => void; highScore: number }) {
  const posterMode = isPosterMode();
  const [snow] = useState<Snowflake[]>(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: -Math.random() * 10,
      duration: 8 + Math.random() * 8,
      size: 2 + Math.random() * 5,
    }))
  );

  return (
    <div className={`sk-splash ${posterMode ? 'sk-splash--poster' : ''}`}>
      <div className="sk-splash__sky" />
      <div className="sk-splash__snow">
        {snow.map(f => (
          <div
            key={f.id}
            className="sk-splash__flake"
            style={{
              left: `${f.x}%`,
              width: `${f.size}px`,
              height: `${f.size}px`,
              animationDelay: `${f.delay}s`,
              animationDuration: `${f.duration}s`,
            }}
          />
        ))}
      </div>
      {/* In LIVE mode: top-down arena ring. In POSTER mode: a side-on
          mecha lineup standing on a stage. */}
      {!posterMode && (
        <div className="sk-splash__arena">
          <div className="sk-splash__arena-glow" />
          <div className="sk-splash__arena-ring sk-splash__arena-ring--outer" />
          <div className="sk-splash__arena-ring sk-splash__arena-ring--mid" />
          <div className="sk-splash__arena-ring sk-splash__arena-ring--inner" />
          {SPLASH_FIGHTERS.map((f, i) => (
            <div
              key={i}
              className="sk-splash__fighter"
              style={{ left: `${f.x}%`, top: `${f.y}%`, animationDelay: `${i * 0.18}s` }}
            >
              <div className="sk-splash__fighter-shadow" />
              <div className="sk-splash__fighter-body" />
              <div className="sk-splash__fighter-belt" style={{ background: f.color, boxShadow: `0 0 12px ${f.color}` }} />
            </div>
          ))}
        </div>
      )}
      {posterMode && (
        <div className="sk-poster-lineup">
          {/* Distant grid horizon — gives perspective and tech feel */}
          <svg className="sk-poster-grid" viewBox="0 0 100 60" preserveAspectRatio="none">
            {Array.from({ length: 9 }, (_, i) => {
              const y = 60 - i * 6 - (i * i * 0.6);
              return <line key={`h${i}`} x1="0" y1={y} x2="100" y2={y} stroke="#4afcff" strokeWidth=".15" opacity={0.05 + i * 0.04} />;
            })}
            {Array.from({ length: 11 }, (_, i) => {
              const x0 = i * 10;
              const x1 = 50 + (x0 - 50) * 3.5;
              return <line key={`v${i}`} x1={x0} y1="60" x2={x1} y2="14" stroke="#4afcff" strokeWidth=".15" opacity=".30" />;
            })}
          </svg>
          {/* Stage edge cyan glow */}
          <div className="sk-poster-stage-glow" />
          {/* Stage platform bar */}
          <div className="sk-poster-stage" />
          <div className="sk-poster-lineup-row">
            {POSTER_LINEUP.map((m, i) => (
              <div key={i} className="sk-poster-mecha" data-role={m.label.toLowerCase()}>
                <svg viewBox="0 0 120 200" width="100%" height="100%" preserveAspectRatio="xMidYEnd meet">
                  <defs>
                    <linearGradient id={`bg-${i}`} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={m.body} stopOpacity="1" />
                      <stop offset="100%" stopColor={m.chest} stopOpacity="1" />
                    </linearGradient>
                    <radialGradient id={`led-${i}`} cx=".5" cy=".5" r=".5">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                      <stop offset="40%" stopColor={m.led} stopOpacity="1" />
                      <stop offset="100%" stopColor={m.led} stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {/* Long contact shadow */}
                  <ellipse cx="60" cy="192" rx="44" ry="5" fill="#000" opacity="0.55" />
                  {/* Antenna pair */}
                  <line x1="50" y1="20" x2="46" y2="2" stroke="#181c24" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="46" cy="2" r="3" fill={m.led} />
                  <line x1="70" y1="20" x2="74" y2="6" stroke="#181c24" strokeWidth="2" strokeLinecap="round" />
                  {/* Head */}
                  <path d="M40 30 L80 30 L84 46 L78 56 L42 56 L36 46 Z" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  {/* Visor — bright LED slot */}
                  <rect x="42" y="38" width="36" height="9" rx="2" fill="#0a0f1c" />
                  <rect x="44" y="40" width="32" height="5" rx="1" fill={m.led}>
                    <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
                  </rect>
                  {/* Cheek vents */}
                  <rect x="38" y="48" width="4" height="6" rx="1" fill="#0a0f1c" />
                  <rect x="78" y="48" width="4" height="6" rx="1" fill="#0a0f1c" />
                  {/* Neck — narrow */}
                  <rect x="52" y="55" width="16" height="6" fill="#0a0f1c" />
                  {/* Shoulder bumpers — big rounded armor */}
                  <path d="M14 62 Q14 56 22 56 L36 56 L40 76 L24 80 Q14 78 14 70 Z" fill={m.chest} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M106 62 Q106 56 98 56 L84 56 L80 76 L96 80 Q106 78 106 70 Z" fill={m.chest} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  {/* Shoulder LED nodes */}
                  <circle cx="24" cy="68" r="3" fill={m.led} opacity=".95" />
                  <circle cx="96" cy="68" r="3" fill={m.led} opacity=".95" />
                  {/* Chest hull — angular */}
                  <path d="M34 60 L86 60 L92 110 L72 120 L48 120 L28 110 Z" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  {/* Chest plate panels */}
                  <path d="M44 68 L76 68 L80 100 L60 108 L40 100 Z" fill={m.chest} opacity=".85" />
                  {/* Reactor core */}
                  <circle cx="60" cy="90" r="9" fill={`url(#led-${i})`}>
                    <animate attributeName="r" values="9;10;9" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                  <circle cx="60" cy="90" r="3.5" fill="#ffffff" opacity=".9" />
                  {/* Panel bolts */}
                  <circle cx="47" cy="72" r="1.5" fill="#0a0f1c" />
                  <circle cx="73" cy="72" r="1.5" fill="#0a0f1c" />
                  {/* Arms — upper */}
                  <rect x="8" y="78" width="14" height="34" rx="3" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.2" />
                  <rect x="98" y="78" width="14" height="34" rx="3" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.2" />
                  {/* Forearms / fists */}
                  <path d="M4 110 L26 110 L24 134 L6 134 Z" fill={m.chest} stroke="#0a0f1c" strokeWidth="1.2" strokeLinejoin="round" />
                  <path d="M94 110 L116 110 L114 134 L96 134 Z" fill={m.chest} stroke="#0a0f1c" strokeWidth="1.2" strokeLinejoin="round" />
                  {/* Knuckle accents */}
                  <rect x="8" y="124" width="14" height="3" fill={m.led} opacity=".9" />
                  <rect x="98" y="124" width="14" height="3" fill={m.led} opacity=".9" />
                  {/* Waist belt */}
                  <rect x="36" y="118" width="48" height="6" rx="1" fill="#0a0f1c" />
                  <rect x="56" y="119" width="8" height="4" fill={m.led} />
                  {/* Hip armor */}
                  <path d="M32 122 L60 122 L60 156 L36 158 Z" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M88 122 L60 122 L60 156 L84 158 Z" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  {/* Thighs */}
                  <rect x="36" y="148" width="20" height="22" rx="3" fill={m.chest} stroke="#0a0f1c" strokeWidth="1.2" />
                  <rect x="64" y="148" width="20" height="22" rx="3" fill={m.chest} stroke="#0a0f1c" strokeWidth="1.2" />
                  {/* Knee LEDs */}
                  <circle cx="46" cy="170" r="2.5" fill={m.led} />
                  <circle cx="74" cy="170" r="2.5" fill={m.led} />
                  {/* Shins / feet */}
                  <path d="M34 168 L58 168 L60 186 L36 188 Z" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  <path d="M86 168 L62 168 L60 186 L84 188 Z" fill={`url(#bg-${i})`} stroke="#0a0f1c" strokeWidth="1.5" strokeLinejoin="round" />
                  <rect x="30" y="184" width="30" height="6" rx="1" fill="#0a0f1c" />
                  <rect x="60" y="184" width="30" height="6" rx="1" fill="#0a0f1c" />
                </svg>
                <div className="sk-poster-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sk-splash__content">
        <h1 className={`sk-splash__title ${posterMode ? 'sk-splash__title--poster' : ''}`}>
          <span className="sk-splash__title-emph">Sumo</span>
          <span className="sk-splash__title-emph sk-splash__title-emph--accent">King</span>
        </h1>
        <p className="sk-splash__subtitle">
          {posterMode ? 'ALTERU MECH BRAWL · 1v3' : t('subtitle')}
        </p>

        {!posterMode && highScore > 0 && (
          <div className="sk-splash__best">
            <span className="sk-splash__best-label">BEST</span>
            <span className="sk-splash__best-value">{highScore}</span>
          </div>
        )}

        {!posterMode && (
          <>
            {/* How-to-play card — 3 lines, terse */}
            <div className="sk-splash__rules">
              <div className="sk-splash__rule-row">
                <span className="sk-splash__rule-dot sk-splash__rule-dot--charge" />
                <span className="sk-splash__rule-text"><b>HOLD</b> &nbsp;the joystick to charge a dash</span>
              </div>
              <div className="sk-splash__rule-row">
                <span className="sk-splash__rule-dot sk-splash__rule-dot--release" />
                <span className="sk-splash__rule-text"><b>RELEASE</b> &nbsp;to ram opponents off</span>
              </div>
              <div className="sk-splash__rule-row">
                <span className="sk-splash__rule-dot sk-splash__rule-dot--survive" />
                <span className="sk-splash__rule-text"><b>SURVIVE</b> &nbsp;60 seconds. KO = +50</span>
              </div>
            </div>

            <button className="sk-splash__cta" onPointerDown={onStart}>
              <span className="sk-splash__cta-text">{t('tap_to_start')}</span>
              <span className="sk-splash__cta-pulse" aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
