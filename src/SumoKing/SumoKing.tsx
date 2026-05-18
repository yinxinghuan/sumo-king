import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Leaderboard, useGameScore } from '@shared/leaderboard';
import { Scene } from './components/Scene';
import { SplashScene } from './components/SplashScene';
import { createGameState, flipPlayerPolarity } from './hooks/useGameLoop';
import type { SfxKey } from './hooks/useGameLoop';
import type { Polarity } from './constants';
import { useJoystick } from './hooks/useJoystick';
import { playSfx, startBgm, stopBgm, unlockAudio } from './utils/audio';
import { t } from './i18n';
import { ROUND_TIME } from './constants';
import alteruSvg from './img/alteru.svg';
import './SumoKing.less';
import './SplashScene.less';

type Phase = 'splash' | 'playing' | 'gameover';

const HIGH_KEY = 'sumo_king_high';

export function SumoKing() {
  const [phase, setPhase] = useState<Phase>('splash');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [kos, setKos] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => Number(localStorage.getItem(HIGH_KEY) || 0));
  const [finalScore, setFinalScore] = useState(0);
  const [didWin, setDidWin] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  // KO banner that fires every time the player downs an opponent.
  const [koBanner, setKoBanner] = useState<{ key: number } | null>(null);
  const lastKos = useRef(0);
  // Player polarity (mirrors state.fighters[0].polarity; updated when
  // the player taps the flip button).
  const [polarity, setPolarity] = useState<Polarity>('blue');
  // First-bout tutorial overlay. Auto-hides after ~7s or on first dash.
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialTimer = useRef<number | null>(null);

  const stateRef = useRef(createGameState());
  const { stickRef, view } = useJoystick(phase === 'playing');

  const {
    isInAigram, submitScore, fetchGlobalLeaderboard, fetchFriendsLeaderboard,
  } = useGameScore('sumo-king');

  const haptic = useCallback((kind: 'light' | 'heavy') => {
    if (!('vibrate' in navigator)) return;
    navigator.vibrate(kind === 'heavy' ? 35 : 12);
  }, []);

  const onScore = useCallback((s: number) => setScore(s), []);
  const onTimeLeft = useCallback((s: number) => setTimeLeft(s), []);
  const onKos = useCallback((n: number) => {
    setKos(n);
    if (n > lastKos.current) {
      lastKos.current = n;
      const key = Date.now();
      setKoBanner({ key });
      setTimeout(() => setKoBanner(cur => (cur && cur.key === key ? null : cur)), 1200);
    }
  }, []);

  const onGameOver = useCallback((won: boolean, final: number) => {
    setDidWin(won);
    setFinalScore(final);
    setPhase('gameover');
    stopBgm();
    if (final > highScore) {
      localStorage.setItem(HIGH_KEY, String(final));
      setHighScore(final);
    }
    submitScore(final).catch(() => { /* silent */ });
  }, [highScore, submitScore]);

  const start = useCallback(() => {
    stateRef.current = createGameState();
    setScore(0);
    setTimeLeft(ROUND_TIME);
    setKos(0);
    lastKos.current = 0;
    setKoBanner(null);
    setPolarity(stateRef.current.fighters[0].polarity);
    setPhase('playing');
    setShowTutorial(true);
    if (tutorialTimer.current !== null) window.clearTimeout(tutorialTimer.current);
    tutorialTimer.current = window.setTimeout(() => setShowTutorial(false), 7000) as unknown as number;
    unlockAudio().then(() => startBgm(0.08)).catch(() => { /* silent */ });
  }, []);

  // Poll for player's first dash — auto-dismiss the tutorial when they
  // actually pull off the gesture, not just when time runs out.
  useEffect(() => {
    if (phase !== 'playing' || !showTutorial) return;
    const id = window.setInterval(() => {
      const player = stateRef.current.fighters.find(f => f.isPlayer);
      // Only dismiss when the player INITIATED a dash (state 'dashing'
      // only happens via releaseDash). Being pushed into 'slide' by an
      // AI collision doesn't count — that wasn't their gesture.
      if (player && player.state === 'dashing' && player.dashCharge > 0.05) {
        setShowTutorial(false);
        if (tutorialTimer.current !== null) {
          window.clearTimeout(tutorialTimer.current);
          tutorialTimer.current = null;
        }
      }
    }, 150);
    return () => window.clearInterval(id);
  }, [phase, showTutorial]);

  // Flip player polarity. Wired to the on-screen button.
  const onFlip = useCallback((e?: React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (phase !== 'playing') return;
    const newP = flipPlayerPolarity(stateRef.current);
    if (newP) {
      setPolarity(newP);
      playSfx('polarity_flip');
      haptic('light');
    }
  }, [phase, haptic]);

  useEffect(() => () => { stopBgm(); }, []);

  const showCanvas = phase !== 'splash';
  const canvasFrameloop = phase === 'playing' ? 'always' : 'demand';

  return (
    <div className="sk">
      {showCanvas && (
        <div className="sk__canvas">
          <Canvas shadows dpr={[1, 2]} gl={{ antialias: true }} frameloop={canvasFrameloop}>
            <Scene
              state={stateRef}
              playing={phase === 'playing'}
              stickRef={stickRef}
              onScore={onScore}
              onTimeLeft={onTimeLeft}
              onKos={onKos}
              onGameOver={onGameOver}
              playSfx={(k: SfxKey) => playSfx(k as never)}
              haptic={haptic}
            />
          </Canvas>
        </div>
      )}

      {showCanvas && (
        <div className="sk__hud">
          <div className="sk__topbar">
            <div className="sk__topbar-cell">
              <span className="sk__topbar-num">{score}</span>
              <span className="sk__topbar-caption">SCORE</span>
            </div>
            <div className="sk__topbar-mid">
              <span className={`sk__topbar-num sk__topbar-num--small${timeLeft < 10 ? ' sk__topbar-num--urgent' : ''}`}>
                {Math.ceil(timeLeft)}s
              </span>
              <span className="sk__topbar-caption">TIME</span>
            </div>
            <div className="sk__topbar-cell sk__topbar-cell--right">
              <span className="sk__topbar-num sk__topbar-num--small">{kos}</span>
              <span className="sk__topbar-caption">KOs</span>
            </div>
          </div>
        </div>
      )}
      {showCanvas && <img className="sk__watermark" src={alteruSvg} alt="AlterU" />}

      {/* Persistent control hint */}
      {phase === 'playing' && (
        <div className="sk__help">
          <span className="sk__help-icon" />
          <span><b>DRAG</b>&nbsp;CHARGE&nbsp;·&nbsp;<b>RELEASE</b>&nbsp;DASH&nbsp;·&nbsp;<b>FLIP</b>&nbsp;TO STICK/REPEL</span>
        </div>
      )}

      {/* Polarity flip button — bottom-right, BIG. Tap to flip player's
          magnetic polarity. Same color as opponent = REPEL on collision;
          opposite = STICK and drag them off the edge. */}
      {phase === 'playing' && (
        <button
          className={`sk__flip-btn sk__flip-btn--${polarity}`}
          onPointerDown={onFlip}
          data-no-stick
        >
          <span className="sk__flip-btn-label">FLIP</span>
          <span className="sk__flip-btn-current">
            {polarity === 'red' ? 'R' : 'B'}
          </span>
        </button>
      )}

      {/* In-game gesture tutorial — shown for ~7s at round start or
          until the player pulls off their first dash. */}
      {phase === 'playing' && showTutorial && (
        <div className="sk__tutorial">
          <div className="sk__tutorial-step sk__tutorial-step--charge">
            <div className="sk__tutorial-finger" />
            <div className="sk__tutorial-trail" />
            <div className="sk__tutorial-label"><b>HOLD + DRAG</b><span>CHARGE</span></div>
          </div>
          <div className="sk__tutorial-step sk__tutorial-step--release">
            <div className="sk__tutorial-burst" />
            <div className="sk__tutorial-label"><b>RELEASE</b><span>DASH</span></div>
          </div>
          <div className="sk__tutorial-step sk__tutorial-step--flip">
            <div className="sk__tutorial-flip-arrow" />
            <div className="sk__tutorial-label"><b>TAP FLIP</b><span>STICK / REPEL</span></div>
          </div>
        </div>
      )}

      {/* KO banner — flashes when the player downs an opponent */}
      {koBanner && (
        <div className="sk__ko-banner" key={koBanner.key}>
          <span className="sk__ko-banner-text">K.O.</span>
          <span className="sk__ko-banner-sub">+50</span>
        </div>
      )}

      {view.active && (
        <div className="sk__joystick" style={{ left: view.ox, top: view.oy }}>
          <div className="sk__joystick__ring">
            <div className="sk__joystick__stick" style={{ transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))` }} />
          </div>
        </div>
      )}

      {phase === 'splash' && <SplashScene onStart={start} highScore={highScore} />}

      {phase === 'gameover' && (
        <div className={`sk__gameover ${didWin ? 'sk__gameover--win' : ''}`}>
          <div className={`sk__gameover-eyebrow ${didWin ? 'sk__gameover-eyebrow--win' : ''}`}>
            {finalScore > 0 && finalScore === highScore && didWin ? 'NEW RECORD' : (didWin ? t('win_eyebrow') : t('lose_eyebrow'))}
          </div>
          <div className="sk__final-score">{finalScore}</div>
          <div className="sk__final">
            {kos} {kos === 1 ? 'KO' : 'KOs'} · {Math.ceil(ROUND_TIME - timeLeft)}s
          </div>
          <button className="sk__cta" onPointerDown={start}>
            {t('again')}
          </button>
          <button className="sk__leaderboard-btn" onPointerDown={() => setShowLeaderboard(true)}>
            {t('leaderboard')}
          </button>
        </div>
      )}

      {showLeaderboard && (
        <Leaderboard
          gameName={t('title')}
          isInAigram={isInAigram}
          onClose={() => setShowLeaderboard(false)}
          fetchGlobal={fetchGlobalLeaderboard}
          fetchFriends={fetchFriendsLeaderboard}
        />
      )}
    </div>
  );
}
