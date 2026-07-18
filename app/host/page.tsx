"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { clearIdentity, loadIdentity, saveIdentity } from "@/lib/game/identity";
import { errorMessage } from "@/lib/game/errors";
import {
  useGameEnd,
  useRoster,
  useRoundState,
  useScores,
  useSession,
  useTransport,
} from "@/lib/game/lobby-hooks";
import type { AnswerReference, ScoringMode, Verdict } from "@/lib/game/types";
import { createMusicProvider } from "@/lib/music";
import type { MusicProvider } from "@/lib/music";
import { fetchPlaylists, type PlaylistSummary } from "@/lib/transport/queries";
import type { GameEventHandler } from "@/lib/transport";

const DIFFICULTIES = [
  { label: "Fácil — 15 s", ms: 15000 },
  { label: "Normal — 10 s", ms: 10000 },
  { label: "Difícil — 5 s", ms: 5000 },
  { label: "Experto — 3 s", ms: 3000 },
  { label: "Imposible — 1 s", ms: 1000 },
];

export default function HostPage() {
  const transport = useTransport();
  const [sessionGen, setSessionGen] = useState(0);
  const roster = useRoster(transport, sessionGen);
  const round = useRoundState(transport, sessionGen);
  const scores = useScores(transport, sessionGen);
  const session = useSession(transport, sessionGen);
  const podium = useGameEnd(transport, sessionGen);

  const [phase, setPhase] = useState<"loading" | "create" | "lobby">("loading");
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [roundError, setRoundError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [answer, setAnswer] = useState<AnswerReference | null>(null);

  const [hostName, setHostName] = useState("");
  const [playlistId, setPlaylistId] = useState("");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("simple");
  const [audioWindowMs, setAudioWindowMs] = useState(10000);
  const [roundsTotal, setRoundsTotal] = useState(10);

  const providerRef = useRef<MusicProvider | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const id = loadIdentity();
      if (id?.isHost) {
        try {
          await transport.resume({
            sessionId: id.sessionId,
            playerId: id.playerId,
            reconnectToken: id.reconnectToken,
          });
          if (!active) return;
          setCode(id.code);
          setPhase("lobby");
          return;
        } catch {
          clearIdentity();
        }
      }
      try {
        const pls = await fetchPlaylists();
        if (!active) return;
        setPlaylists(pls);
        if (pls[0]) setPlaylistId(pls[0].id);
      } catch {
        /* playlists optional to load */
      }
      if (active) setPhase("create");
    })();
    return () => {
      active = false;
    };
  }, [transport]);

  // Host-only: receive the track + answer and play the audio window.
  useEffect(() => {
    const onHost: GameEventHandler<"round_host_payload"> = (payload) => {
      setAnswer(payload.answer);
      if (!providerRef.current) providerRef.current = createMusicProvider();
      void providerRef.current.play(
        { provider: payload.track.provider, providerRef: payload.track.providerRef },
        payload.track.startMs,
        payload.audioWindowMs,
      );
    };
    transport.on("round_host_payload", onHost);
    return () => transport.off("round_host_payload", onHost);
  }, [transport]);

  // Stop the music as soon as the first buzz lands.
  useEffect(() => {
    if (round.buzzQueue.length > 0) void providerRef.current?.stop();
  }, [round.buzzQueue.length]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await transport.createSession({
        hostName: hostName.trim(),
        playlistId,
        roundsTotal,
        config: {
          scoringMode,
          audioWindowMs,
          allowSteal: true,
          wrongBuzzPenalty: 0,
          extraPoints: { artist: false, album: false, year: false },
        },
      });
      saveIdentity({
        sessionId: result.sessionId,
        playerId: result.hostPlayerId,
        reconnectToken: result.reconnectToken,
        isHost: true,
        displayName: hostName.trim(),
        code: result.sessionCode,
      });
      setCode(result.sessionCode);
      setPhase("lobby");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartRound() {
    setRoundError(null);
    setAnswer(null);
    try {
      await transport.startRound();
    } catch (err) {
      setRoundError(errorMessage(err));
    }
  }

  async function handleJudge(verdict: Verdict) {
    if (!round.roundId || !round.currentAnswererId) return;
    setRoundError(null);
    try {
      await transport.judge({ roundId: round.roundId, playerId: round.currentAnswererId, verdict });
    } catch (err) {
      setRoundError(errorMessage(err));
    }
  }

  async function handlePlayAgain() {
    setRoundError(null);
    setAnswer(null);
    try {
      await transport.restart();
      const id = loadIdentity();
      if (id) {
        await transport.resume({
          sessionId: id.sessionId,
          playerId: id.playerId,
          reconnectToken: id.reconnectToken,
        });
      }
      setSessionGen((g) => g + 1);
    } catch (err) {
      setRoundError(errorMessage(err));
    }
  }

  async function handleEnd() {
    await transport.leave();
    clearIdentity();
    setCode("");
    setAnswer(null);
    setRoundError(null);
    setSessionGen((g) => g + 1);
    setPhase("create");
  }

  const nameOf = (id: string | null) => (id ? roster.find((p) => p.id === id)?.displayName ?? "—" : "—");

  if (phase === "loading") {
    return (
      <main>
        <p>Cargando…</p>
      </main>
    );
  }

  if (phase === "lobby") {
    const joinUrl =
      typeof window !== "undefined" ? `${window.location.origin}/play?code=${code}` : "";
    const players = roster.filter((p) => !p.isHost);
    const gameOver = podium !== null;
    const gameStarted = round.roundId !== null && !gameOver;

    return (
      <main>
        <h1>
          {gameOver
            ? "🏁 Fin de la partida"
            : gameStarted
              ? `Ronda ${round.roundNumber} de ${session.roundsTotal ?? "?"}`
              : "Sala de espera"}
        </h1>

        {!gameStarted && !gameOver && (
          <>
            <p>Comparte este código para que se unan:</p>
            <div className="code">{code}</div>
            {joinUrl && (
              <div className="qr">
                <QRCodeSVG value={joinUrl} size={160} includeMargin />
                <p className="muted">o entra manualmente en /play</p>
              </div>
            )}
          </>
        )}

        {gameStarted && (
          <div className="panel">
            {round.resolution ? (
              <div className="result">
                {round.resolution === "correct" ? (
                  <p>
                    🎉 Acertó <strong>{nameOf(round.winnerPlayerId)}</strong>
                  </p>
                ) : (
                  <p>Nadie acertó.</p>
                )}
                {round.revealedAnswer && (
                  <p className="muted">
                    Era: {round.revealedAnswer.title} — {round.revealedAnswer.artist}
                  </p>
                )}
              </div>
            ) : round.currentAnswererId ? (
              <>
                <p>
                  🎤 Responde: <strong>{nameOf(round.currentAnswererId)}</strong>
                </p>
                <div className="controls">
                  <button type="button" onClick={() => handleJudge("correct")}>
                    Correcto
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleJudge("incorrect")}
                  >
                    Incorrecto
                  </button>
                </div>
              </>
            ) : (
              <p className="muted">🎵 Sonando… esperando el primer buzz.</p>
            )}

            {round.buzzQueue.length > 0 && !round.resolution && (
              <ol className="queue">
                {round.buzzQueue.map((b) => (
                  <li
                    key={b.playerId}
                    className={b.playerId === round.currentAnswererId ? "first" : ""}
                  >
                    {nameOf(b.playerId)}
                  </li>
                ))}
              </ol>
            )}

            {answer && !round.resolution && (
              <p className="answer muted">
                (respuesta: {answer.title} — {answer.artist})
              </p>
            )}
          </div>
        )}

        {gameOver && (
          <div className="panel podium">
            <ol className="queue">
              {podium.map((p) => (
                <li key={p.playerId} className={p.position === 1 ? "first" : ""}>
                  {p.position === 1 ? "🏆 " : `${p.position}. `}
                  {p.displayName} — <strong>{p.total}</strong>
                </li>
              ))}
            </ol>
          </div>
        )}

        {roundError && <p className="error">{roundError}</p>}

        <div className="controls">
          {gameOver ? (
            <button type="button" onClick={handlePlayAgain}>
              Jugar de nuevo
            </button>
          ) : (
            <button type="button" onClick={handleStartRound}>
              {gameStarted ? "Siguiente ronda" : "Iniciar ronda"}
            </button>
          )}
        </div>

        <h2>{gameStarted ? "Marcador" : `Jugadores (${players.length})`}</h2>
        {players.length === 0 ? (
          <p className="muted">Aún no se ha unido nadie.</p>
        ) : (
          <ul className="roster">
            {(gameStarted
              ? [...players].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
              : players
            ).map((p) => (
              <li key={p.id}>
                <span className={p.online ? "dot online" : "dot"} /> {p.displayName}
                {gameStarted && (
                  <>
                    {" — "}
                    <strong>{scores.get(p.id) ?? 0}</strong>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="muted">Tú eres el presentador (no concursas).</p>
        <button type="button" onClick={handleEnd} className="secondary">
          Terminar sesión
        </button>
      </main>
    );
  }

  return (
    <main>
      <h1>Crear sesión</h1>
      <form onSubmit={handleCreate} className="form">
        <label>
          Tu nombre (presentador)
          <input value={hostName} onChange={(e) => setHostName(e.target.value)} required maxLength={30} />
        </label>

        <label>
          Playlist
          <select value={playlistId} onChange={(e) => setPlaylistId(e.target.value)} required>
            {playlists.length === 0 && <option value="">(sin playlists)</option>}
            {playlists.map((pl) => (
              <option key={pl.id} value={pl.id}>
                {pl.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Modo de puntuación
          <select
            value={scoringMode}
            onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
          >
            <option value="simple">1 punto por canción (juego de mesa)</option>
            <option value="speed">Velocidad y dificultad (arcade)</option>
          </select>
        </label>

        <label>
          Dificultad (duración del audio)
          <select value={audioWindowMs} onChange={(e) => setAudioWindowMs(Number(e.target.value))}>
            {DIFFICULTIES.map((d) => (
              <option key={d.ms} value={d.ms}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Número de rondas
          <input
            type="number"
            min={1}
            max={50}
            value={roundsTotal}
            onChange={(e) => setRoundsTotal(Number(e.target.value))}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={submitting || !playlistId}>
          {submitting ? "Creando…" : "Crear sesión"}
        </button>
      </form>
    </main>
  );
}
