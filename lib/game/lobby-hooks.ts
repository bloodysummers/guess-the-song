"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { createGameTransport, type GameTransport } from "@/lib/transport";
import type {
  BuzzQueueEntry,
  PlayerPublic,
  PodiumEntry,
  RevealedAnswer,
  RoundResolution,
  ScoreEntry,
  SessionStatus,
} from "@/lib/game/types";

export interface RosterEntry extends PlayerPublic {
  online: boolean;
}

/** Creates one stable transport instance for the lifetime of the component. */
export function useTransport(): GameTransport {
  const ref = useRef<GameTransport | null>(null);
  if (!ref.current) {
    ref.current = createGameTransport();
  }
  return ref.current;
}

/**
 * Tracks the session roster from transport events. Players come from
 * `player_joined` / `player_left`; online status from `presence_updated`.
 */
export function useRoster(transport: GameTransport, resetKey: number = 0): RosterEntry[] {
  const [players, setPlayers] = useState<Map<string, PlayerPublic>>(new Map());
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    setPlayers(new Map());
    setOnline(new Set());
  }, [resetKey]);

  useEffect(() => {
    const onJoined = ({ player }: { player: PlayerPublic }) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        next.set(player.id, player);
        return next;
      });
    };
    const onLeft = ({ playerId }: { playerId: string }) => {
      setPlayers((prev) => {
        const next = new Map(prev);
        next.delete(playerId);
        return next;
      });
    };
    const onPresence = ({ onlinePlayerIds }: { onlinePlayerIds: string[] }) => {
      setOnline(new Set(onlinePlayerIds));
    };

    transport.on("player_joined", onJoined);
    transport.on("player_left", onLeft);
    transport.on("presence_updated", onPresence);
    return () => {
      transport.off("player_joined", onJoined);
      transport.off("player_left", onLeft);
      transport.off("presence_updated", onPresence);
    };
  }, [transport]);

  return useMemo(
    () =>
      [...players.values()].map((p) => ({
        ...p,
        online: online.has(p.id),
      })),
    [players, online],
  );
}

export interface RoundState {
  roundId: string | null;
  roundNumber: number | null;
  audioWindowMs: number | null;
  buzzQueue: BuzzQueueEntry[];
  currentAnswererId: string | null;
  resolution: RoundResolution | null;
  winnerPlayerId: string | null;
  revealedAnswer: RevealedAnswer | null;
}

const EMPTY_ROUND: RoundState = {
  roundId: null,
  roundNumber: null,
  audioWindowMs: null,
  buzzQueue: [],
  currentAnswererId: null,
  resolution: null,
  winnerPlayerId: null,
  revealedAnswer: null,
};

/** Tracks the active round, its buzz queue, and its resolution from transport events. */
export function useRoundState(transport: GameTransport, resetKey: number = 0): RoundState {
  const [state, setState] = useState<RoundState>(EMPTY_ROUND);

  useEffect(() => {
    setState(EMPTY_ROUND);
  }, [resetKey]);

  useEffect(() => {
    const onRound = ({
      roundId,
      roundNumber,
      audioWindowMs,
    }: {
      roundId: string;
      roundNumber: number;
      audioWindowMs: number;
    }) => {
      setState({
        ...EMPTY_ROUND,
        roundId,
        roundNumber,
        audioWindowMs,
      });
    };
    const onQueue = ({
      roundId,
      queue,
      currentAnswererId,
    }: {
      roundId: string;
      queue: BuzzQueueEntry[];
      currentAnswererId: string | null;
    }) => {
      setState((s) => (s.roundId === roundId ? { ...s, buzzQueue: queue, currentAnswererId } : s));
    };
    const onEnded = ({
      roundId,
      resolution,
      winnerPlayerId,
      revealedAnswer,
    }: {
      roundId: string;
      resolution: RoundResolution;
      winnerPlayerId: string | null;
      revealedAnswer: RevealedAnswer;
    }) => {
      setState((s) =>
        s.roundId === roundId ? { ...s, resolution, winnerPlayerId, revealedAnswer } : s,
      );
    };

    transport.on("round_started", onRound);
    transport.on("buzz_queue_updated", onQueue);
    transport.on("round_ended", onEnded);
    return () => {
      transport.off("round_started", onRound);
      transport.off("buzz_queue_updated", onQueue);
      transport.off("round_ended", onEnded);
    };
  }, [transport]);

  return state;
}

export interface SessionState {
  status: SessionStatus | null;
  roundsTotal: number | null;
}

/** Tracks session status and configured round count from session_updated events. */
export function useSession(transport: GameTransport, resetKey: number = 0): SessionState {
  const [state, setState] = useState<SessionState>({ status: null, roundsTotal: null });

  useEffect(() => {
    setState({ status: null, roundsTotal: null });
  }, [resetKey]);

  useEffect(() => {
    const onSession = ({ status, roundsTotal }: { status: SessionStatus; roundsTotal: number }) => {
      setState({ status, roundsTotal });
    };
    transport.on("session_updated", onSession);
    return () => transport.off("session_updated", onSession);
  }, [transport]);

  return state;
}

/** Captures the final podium from the game_ended event (null until the game ends). */
export function useGameEnd(transport: GameTransport, resetKey: number = 0): PodiumEntry[] | null {
  const [podium, setPodium] = useState<PodiumEntry[] | null>(null);

  useEffect(() => {
    setPodium(null);
  }, [resetKey]);

  useEffect(() => {
    const onEnd = ({ podium }: { podium: PodiumEntry[] }) => setPodium(podium);
    transport.on("game_ended", onEnd);
    return () => transport.off("game_ended", onEnd);
  }, [transport]);

  return podium;
}

/** Tracks the scoreboard (playerId → total) from score_updated events. */
export function useScores(transport: GameTransport, resetKey: number = 0): Map<string, number> {
  const [scores, setScores] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    setScores(new Map());
  }, [resetKey]);

  useEffect(() => {
    const onScore = ({ scores }: { scores: ScoreEntry[] }) => {
      setScores(new Map(scores.map((s) => [s.playerId, s.total])));
    };
    transport.on("score_updated", onScore);
    return () => transport.off("score_updated", onScore);
  }, [transport]);

  return scores;
}
