// Type declarations for @shared alias — Vite resolves the actual files,
// tsc uses these inline types for type checking.

declare module '@shared/leaderboard' {
  import type { FC } from 'react';

  export interface LeaderboardEntry {
    telegram_id: string;
    name: string;
    avatar_url: string;
    score: number;
    isMe?: boolean;
  }

  interface LeaderboardProps {
    gameName: string;
    isInAigram: boolean;
    onClose: () => void;
    fetchGlobal: () => Promise<LeaderboardEntry[]>;
    fetchFriends: () => Promise<LeaderboardEntry[]>;
  }

  export const Leaderboard: FC<LeaderboardProps>;

  interface GameScoreResult {
    isInAigram: boolean;
    telegramId: string | null;
    currentUser: { telegram_id: string; name: string; head_url: string } | null;
    submitScore: (score: number) => Promise<void>;
    fetchGlobalLeaderboard: () => Promise<LeaderboardEntry[]>;
    fetchFriendsLeaderboard: () => Promise<LeaderboardEntry[]>;
  }

  export function useGameScore(gameId: string): GameScoreResult;
}
