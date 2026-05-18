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

export function SplashScene({ onStart, highScore }: { onStart: () => void; highScore: number }) {
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
    <div className="sk-splash">
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
      {/* Arena rings — concentric, animated pulse */}
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

      <div className="sk-splash__content">
        <h1 className="sk-splash__title">
          <span className="sk-splash__title-emph">Sumo</span>
          <span className="sk-splash__title-emph sk-splash__title-emph--accent">King</span>
        </h1>
        <p className="sk-splash__subtitle">{t('subtitle')}</p>

        {highScore > 0 && (
          <div className="sk-splash__best">
            <span className="sk-splash__best-label">BEST</span>
            <span className="sk-splash__best-value">{highScore}</span>
          </div>
        )}

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
      </div>
    </div>
  );
}
