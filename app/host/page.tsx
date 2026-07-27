"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

import { clearIdentity, loadIdentity, saveIdentity } from "@/lib/game/identity";
import { errorMessage } from "@/lib/game/errors";
import {
  useGame,
  useGameEnd,
  useRoster,
  useRoundState,
  useScores,
  useTransport,
} from "@/lib/game/lobby-hooks";
import type { AnswerReference, GameSource, ScoringMode, Verdict } from "@/lib/game/types";
import { createMusicProvider } from "@/lib/music";
import type { MusicProvider, PlayableTrackRef } from "@/lib/music";
import { fetchPlaylists, type PlaylistSummary } from "@/lib/transport/queries";
import type { GameEventHandler } from "@/lib/transport";

/** Give up swapping after this many unplayable tracks in a row. */
const MAX_TRACK_SWAPS = 3;

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
  const game = useGame(transport, sessionGen);
  const podium = useGameEnd(transport, sessionGen);

  const [phase, setPhase] = useState<"loading" | "create" | "session">("loading");
  const [configuring, setConfiguring] = useState(false);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [roundError, setRoundError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [judging, setJudging] = useState(false);
  const [answer, setAnswer] = useState<AnswerReference | null>(null);
  /** Cover art of the playing track. HOST-ONLY: it gives the answer away. */
  const [artwork, setArtwork] = useState<string | null>(null);

  const [hostName, setHostName] = useState("");
  const [sourceType, setSourceType] = useState<GameSource["type"]>("curated");
  const [playlistId, setPlaylistId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("simple");
  const [audioWindowMs, setAudioWindowMs] = useState(10000);
  const [roundsTotal, setRoundsTotal] = useState(10);

  const providerRef = useRef<MusicProvider | null>(null);
  const lastTrackRef = useRef<(PlayableTrackRef & { startMs: number }) | null>(null);
  const lastWindowRef = useRef<number>(10000);
  /** Round the current payload belongs to, so an error can name the round to fix. */
  const roundIdRef = useRef<string | null>(null);
  /** Guards against a broken playlist swapping tracks forever. */
  const swapsRef = useRef(0);

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
          setPhase("session");
        } catch {
          clearIdentity();
          if (active) setPhase("create");
        }
      } else if (active) {
        setPhase("create");
      }
      try {
        const pls = await fetchPlaylists();
        if (!active) return;
        setPlaylists(pls);
        if (pls[0]) setPlaylistId(pls[0].id);
      } catch {
        /* playlists optional to load */
      }
    })();
    return () => {
      active = false;
    };
  }, [transport]);

  // Host-only: receive the track + answer and play the audio window (randomized).
  useEffect(() => {
    const onHost: GameEventHandler<"round_host_payload"> = (payload) => {
      setAnswer(payload.answer);
      roundIdRef.current = payload.roundId;
      lastWindowRef.current = payload.audioWindowMs;
      if (!providerRef.current) providerRef.current = createMusicProvider();
      const trackRef = { provider: payload.track.provider, providerRef: payload.track.providerRef };
      setArtwork(providerRef.current.artworkUrl(trackRef));
      void providerRef.current.play(trackRef, null, payload.audioWindowMs).then((startMs) => {
        lastTrackRef.current = { ...trackRef, startMs };
      });
    };
    transport.on("round_host_payload", onHost);
    return () => transport.off("round_host_payload", onHost);
  }, [transport]);

  /**
   * A track that cannot play at all (region block, embedding disabled, dead video)
   * silently stranded the round before. Now it swaps itself out for another track,
   * without consuming a round — the players never find out.
   */
  useEffect(() => {
    if (!providerRef.current) providerRef.current = createMusicProvider();
    providerRef.current.onPlaybackError(({ reason }) => {
      const roundId = roundIdRef.current;
      if (!roundId) return;
      if (swapsRef.current >= MAX_TRACK_SWAPS) {
        setRoundError(
          "Varias canciones seguidas no se pudieron reproducir. Revisa la playlist o pasa a la siguiente ronda.",
        );
        return;
      }
      swapsRef.current += 1;
      setRoundError(`Esa canción no se pudo reproducir (${reason}). Cambiando por otra…`);
      void transport
        .replaceRoundTrack({ roundId, reason })
        .then(() => setRoundError(null))
        .catch((err) => setRoundError(errorMessage(err)));
    });
  }, [transport]);

  useEffect(() => {
    if (round.buzzQueue.length > 0) void providerRef.current?.stop();
  }, [round.buzzQueue.length]);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await transport.createSession({ hostName: hostName.trim() });
      saveIdentity({
        sessionId: result.sessionId,
        playerId: result.hostPlayerId,
        reconnectToken: result.reconnectToken,
        isHost: true,
        displayName: hostName.trim(),
        code: result.sessionCode,
      });
      setCode(result.sessionCode);
      setPhase("session");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateGame(e: React.FormEvent) {
    e.preventDefault();
    setRoundError(null);
    setSubmitting(true);
    try {
      await transport.createGame({
        source:
          sourceType === "youtube"
            ? { type: "youtube", url: youtubeUrl.trim() }
            : { type: "curated", playlistId },
        roundsTotal,
        config: {
          scoringMode,
          audioWindowMs,
          allowSteal: true,
          wrongBuzzPenalty: 0,
          extraPoints: { artist: false, album: false, year: false },
        },
      });
      setConfiguring(false);
    } catch (err) {
      setRoundError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStartRound() {
    setRoundError(null);
    setAnswer(null);
    setArtwork(null);
    swapsRef.current = 0;
    try {
      await transport.startRound();
    } catch (err) {
      setRoundError(errorMessage(err));
    }
  }

  async function handleReplay() {
    if (!round.roundId || !lastTrackRef.current) return;
    setRoundError(null);
    try {
      void providerRef.current?.play(
        { provider: lastTrackRef.current.provider, providerRef: lastTrackRef.current.providerRef },
        lastTrackRef.current.startMs,
        lastWindowRef.current,
      );
      await transport.replayRound({ roundId: round.roundId });
    } catch (err) {
      setRoundError(errorMessage(err));
    }
  }

  /**
   * Not a game mechanic — the host's escape hatch when the fragment that came up is
   * unguessable (silence, pure ambience). Plays a DIFFERENT random fragment of the
   * same track and charges nothing. Because it overwrites `lastTrackRef`, the
   * penalized replay afterwards repeats this new fragment, not the discarded one.
   */
  async function handleRefragment() {
    if (!round.roundId || !lastTrackRef.current) return;
    setRoundError(null);
    try {
      await transport.refragmentRound({ roundId: round.roundId });
      const trackRef = {
        provider: lastTrackRef.current.provider,
        providerRef: lastTrackRef.current.providerRef,
      };
      const startMs = await providerRef.current!.play(trackRef, null, lastWindowRef.current);
      lastTrackRef.current = { ...trackRef, startMs };
    } catch (err) {
      setRoundError(errorMessage(err));
    }
  }

  async function handleJudge(verdict: Verdict) {
    if (!round.roundId || !round.currentAnswererId || judging) return;
    setRoundError(null);
    setJudging(true);
    try {
      await transport.judge({ roundId: round.roundId, playerId: round.currentAnswererId, verdict });
    } catch (err) {
      setRoundError(errorMessage(err));
    } finally {
      setJudging(false);
    }
  }

  async function handleEndGame() {
    await transport.endGame();
  }

  async function handleCloseSession() {
    await transport.closeSession();
    clearIdentity();
    setCode("");
    setConfiguring(false);
    setSessionGen((g) => g + 1);
    setPhase("create");
  }

  const sourceReady = sourceType === "youtube" ? youtubeUrl.trim().length > 0 : Boolean(playlistId);

  const nameOf = (id: string | null) => (id ? roster.find((p) => p.id === id)?.displayName ?? "—" : "—");
  const players = roster.filter((p) => !p.isHost);

  if (phase === "loading") {
    return (
      <main>
        <p>Cargando…</p>
      </main>
    );
  }

  // --- Create session (just a name) ---------------------------------------
  if (phase === "create") {
    return (
      <main>
        <h1>Crear sesión</h1>
        <form onSubmit={handleCreateSession} className="form">
          <label>
            Tu nombre (presentador)
            <input value={hostName} onChange={(e) => setHostName(e.target.value)} required maxLength={30} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting || !hostName.trim()}>
            {submitting ? "Creando…" : "Crear sesión"}
          </button>
        </form>
      </main>
    );
  }

  // --- Game configuration form --------------------------------------------
  if (configuring) {
    return (
      <main>
        <h1>Nuevo juego</h1>
        <form onSubmit={handleCreateGame} className="form">
          <label>
            Canciones
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as GameSource["type"])}
            >
              <option value="curated">Playlist del juego</option>
              <option value="youtube">Mi playlist de YouTube / YouTube Music</option>
            </select>
          </label>
          {sourceType === "curated" ? (
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
          ) : (
            <label>
              URL de la playlist (debe ser pública)
              <input
                type="url"
                inputMode="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://music.youtube.com/playlist?list=…"
                required
              />
              <span className="hint">Se leen hasta 100 canciones. Las no disponibles se omiten.</span>
            </label>
          )}
          <label>
            Modo de puntuación
            <select value={scoringMode} onChange={(e) => setScoringMode(e.target.value as ScoringMode)}>
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
          {roundError && <p className="error">{roundError}</p>}
          <button type="submit" disabled={submitting || !sourceReady}>
            {submitting
              ? sourceType === "youtube"
                ? "Importando canciones…"
                : "Creando…"
              : "Empezar juego"}
          </button>
          <button type="button" className="secondary" onClick={() => setConfiguring(false)}>
            Cancelar
          </button>
        </form>
      </main>
    );
  }

  // --- Podium (a game ended) ----------------------------------------------
  if (podium) {
    return (
      <main>
        <h1>🏁 Fin del juego</h1>
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
        {players.length > 0 && (
          <>
            <h2>Acumulado de la sesión</h2>
            <ul className="roster">
              {[...players]
                .sort((a, b) => (scores.session.get(b.id) ?? 0) - (scores.session.get(a.id) ?? 0))
                .map((p) => (
                  <li key={p.id}>
                    {p.displayName} — <strong>{scores.session.get(p.id) ?? 0}</strong>
                  </li>
                ))}
            </ul>
          </>
        )}
        <div className="controls">
          <button type="button" onClick={() => setConfiguring(true)}>
            Nuevo juego
          </button>
          <button type="button" className="secondary" onClick={handleCloseSession}>
            Terminar sesión
          </button>
        </div>
      </main>
    );
  }

  // --- In a game ----------------------------------------------------------
  if (game.active) {
    return (
      <main>
        <h1>Ronda {round.roundId ? `${round.roundNumber} de ${game.roundsTotal ?? "?"}` : "—"}</h1>
        <div className="panel">
          {artwork && (
            // eslint-disable-next-line @next/next/no-img-element -- remote host, no loader configured
            <img
              className="cover"
              src={artwork}
              alt=""
              onError={(e) => {
                // A missing thumbnail must never break the round panel.
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          {!round.roundId ? (
            <p className="muted">Pulsa &quot;Iniciar ronda&quot; para empezar.</p>
          ) : round.resolution ? (
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
                <button type="button" onClick={() => handleJudge("correct")} disabled={judging}>
                  Correcto
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleJudge("incorrect")}
                  disabled={judging}
                >
                  Incorrecto
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted">🎵 Sonando… esperando el primer buzz.</p>
              <div className="round-tools">
                <button type="button" className="secondary" onClick={handleReplay}>
                  🔁 Repetir (penalización)
                </button>
                <button type="button" className="secondary" onClick={handleRefragment}>
                  🎲 Otro fragmento (sin penalización)
                </button>
                <span className="hint">
                  Usa &quot;otro fragmento&quot; si el trozo que salió es silencio o no da pistas.
                </span>
              </div>
            </>
          )}

          {round.replayCount > 0 && !round.resolution && (
            <p className="muted">🔁 Repetida ×{round.replayCount} — penalización activa</p>
          )}

          {round.buzzQueue.length > 0 && !round.resolution && (
            <ol className="queue">
              {round.buzzQueue.map((b) => (
                <li key={b.playerId} className={b.playerId === round.currentAnswererId ? "first" : ""}>
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

        {roundError && <p className="error">{roundError}</p>}

        <div className="controls">
          <button type="button" onClick={handleStartRound}>
            {round.roundId
              ? round.roundNumber != null &&
                game.roundsTotal != null &&
                round.roundNumber >= game.roundsTotal
                ? "Finalizar juego"
                : "Siguiente ronda"
              : "Iniciar ronda"}
          </button>
        </div>

        <h2>Marcador</h2>
        <ul className="roster">
          {[...players]
            .sort((a, b) => (scores.game.get(b.id) ?? 0) - (scores.game.get(a.id) ?? 0))
            .map((p) => (
              <li key={p.id}>
                <span className={p.online ? "dot online" : "dot"} /> {p.displayName} —{" "}
                <strong>{scores.game.get(p.id) ?? 0}</strong>
              </li>
            ))}
        </ul>

        <button type="button" onClick={handleEndGame} className="secondary">
          Terminar juego
        </button>
      </main>
    );
  }

  // --- Session hub (no active game) ---------------------------------------
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/play?code=${code}` : "";
  return (
    <main>
      <h1>Sala de espera</h1>
      <p>Comparte este código para que se unan:</p>
      <div className="code">{code}</div>
      {joinUrl && (
        <div className="qr">
          <QRCodeSVG value={joinUrl} size={160} includeMargin />
          <p className="muted">o entra manualmente en /play</p>
        </div>
      )}

      <h2>Jugadores ({players.length})</h2>
      {players.length === 0 ? (
        <p className="muted">Aún no se ha unido nadie.</p>
      ) : (
        <ul className="roster">
          {players.map((p) => (
            <li key={p.id}>
              <span className={p.online ? "dot online" : "dot"} /> {p.displayName}
              {scores.session.get(p.id) ? (
                <>
                  {" — "}
                  <strong>{scores.session.get(p.id)}</strong>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="controls">
        <button type="button" onClick={() => setConfiguring(true)} disabled={players.length === 0}>
          Nuevo juego
        </button>
        <button type="button" className="secondary" onClick={handleCloseSession}>
          Terminar sesión
        </button>
      </div>
      <p className="muted">Tú eres el presentador (no concursas).</p>
    </main>
  );
}
