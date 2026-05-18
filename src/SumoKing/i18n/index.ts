type Locale = 'zh' | 'en';

function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return 'en';
}

const dict: Record<Locale, Record<string, string>> = {
  zh: {
    title: 'Sumo King',
    subtitle: '圆台之上，最后站立者获胜',
    tap_to_start: '入场',
    again: '再战一局',
    leaderboard: '排行榜',
    win_eyebrow: '你是擂台之王',
    lose_eyebrow: '你被推下擂台了',
  },
  en: {
    title: 'Sumo King',
    subtitle: 'LAST ONE ON THE RING WINS',
    tap_to_start: 'ENTER THE RING',
    again: 'ONE MORE BOUT',
    leaderboard: 'Leaderboard',
    win_eyebrow: 'KING OF THE RING',
    lose_eyebrow: 'PUSHED OFF',
  },
};

let cur: Locale = detectLocale();

export function setLocale(l: Locale) {
  cur = l;
  localStorage.setItem('game_locale', l);
}

export function t(key: string, vars?: { n?: number | string }): string {
  const raw = dict[cur][key] ?? dict.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String((vars as any)[k] ?? ''));
}

export function getLocale(): Locale { return cur; }
