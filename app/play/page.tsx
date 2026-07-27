"use client";

import { useEffect, useState } from "react";

import { clearIdentity, loadIdentity, saveIdentity } from "@/lib/game/identity";
import { errorMessage } from "@/lib/game/errors";
import {
  useGame,
  useGameEnd,
  useRoster,
  useRoundState,
  useScores,
  useSession,
  useTransport,
} from "@/lib/game/lobby-hooks";
import { TransportError } from "@/lib/transport";

export default function PlayPage() {
  const transport = useTransport();
  const [sessionGen, setSessionGen] = useState(0);
  const roster = useRoster(transport, sessionGen);
  const round = useRoundState(transport, sessionGen);
  const scores = useScores(transport, sessionGen);
  const session = useSession(transport, sessionGen);
  const game = useGame(transport, sessionGen);
  const podium = useGameEnd(transport, sessionGen);

  const [phase, setPhase] = useState<"loading" | "join" | "lobby">("loading");
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [myName, setMyName] = useState("");
  const [myPlayerId, setMyPlayerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasBuzzed, setHasBuzzed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const id = loadIdentity();
      if (id && !id.isHost) {
        try {
          const res = await transport.resume({
            sessionId: id.sessionId,
            playerId: id.playerId,
            reconnectToken: id.reconnectToken,
          });
          if (!active) return;
          setMyName(id.displayName);
          setMyPlayerId(res.playerId);
          setPhase("lobby");
          return;
        } catch {
          clearIdentity();
        }
      }
      if (typeof window !== "undefined") {
        const param = new URLSearchParams(window.location.search).get("code");
        if (param) setCode(param.toUpperCase());
      }
      if (active) setPhase("join");
    })();
    return () => {
      active = false;
    };
  }, [transport]);

  useEffect(() => {
    setHasBuzzed(false);
  }, [round.roundId]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const name = displayName.trim();
      const result = await transport.joinSession({ code: code.trim(), displayName: name });
      saveIdentity({
        sessionId: result.sessionId,
        playerId: result.playerId,
        reconnectToken: result.reconnectToken,
        isHost: false,
        displayName: name,
        code: code.trim().toUpperCase(),
      });
      setMyName(name);
      setMyPlayerId(result.playerId);
      setPhase("lobby");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBuzz() {
    if (!round.roundId) return;
    setHasBuzzed(true);
    try {
      await transport.buzz({ roundId: round.roundId });
    } catch (err) {
      if (!(err instanceof TransportError) || err.code !== "already_buzzed") {
        setHasBuzzed(false);
        setError(errorMessage(err));
      }
    }
  }

  async function handleLeave() {
    await transport.leave();
    clearIdentity();
    setDisplayName("");
    setError(null);
    setHasBuzzed(false);
    setSessionGen((g) => g + 1);
    setPhase("join");
  }

  const nameOf = (id: string | null) => (id ? roster.find((p) => p.id === id)?.displayName ?? "—" : "—");
  const players = roster.filter((p) => !p.isHost);

  if (phase === "loading") {
    return (
      <main>
        <p>Cargando…</p>
      </main>
    );
  }

  if (phase === "lobby") {
    const leaveBtn = (
      <button type="button" onClick={handleLeave} className="secondary">
        Salir
      </button>
    );

    if (session.status === "closed") {
      return (
        <main>
          <h1>Sesión terminada</h1>
          <p className="muted">El anfitrión cerró la sesión.</p>
          {leaveBtn}
        </main>
      );
    }

    // A game just ended — show the podium.
    if (podium) {
      const iWon = podium[0]?.playerId === myPlayerId;
      return (
        <main>
          <h1>🏁 Fin del juego</h1>
          <div className="panel podium">
            {iWon && (
              <p>
                <strong>🏆 ¡Ganaste!</strong>
              </p>
            )}
            <ol className="queue">
              {podium.map((p) => (
                <li key={p.playerId} className={p.playerId === myPlayerId ? "first" : ""}>
                  {p.position}. {p.displayName} — <strong>{p.total}</strong>
                </li>
              ))}
            </ol>
          </div>
          <p className="muted">
            Tu acumulado en la sesión: <strong>{scores.session.get(myPlayerId) ?? 0}</strong>
          </p>
          <p className="muted">Espera a que el anfitrión inicie otro juego…</p>
          {leaveBtn}
        </main>
      );
    }

    // A game is in progress.
    if (game.active && round.roundId) {
      const myRank = round.buzzQueue.find((b) => b.playerId === myPlayerId)?.rank ?? null;
      return (
        <main>
          <h1>Hola, {myName}</h1>
          <p className="muted">
            Ronda {round.roundNumber} de {game.roundsTotal ?? "?"}
          </p>

          {round.resolution ? (
            <div className="panel result">
              {round.resolution === "correct" ? (
                <p>
                  🎉 Acertó <strong>{nameOf(round.winnerPlayerId)}</strong>
                  {round.winnerPlayerId === myPlayerId ? " (¡tú!)" : ""}
                </p>
              ) : (
                <p>Nadie acertó.</p>
              )}
              {/* Only ever rendered once the round is resolved — see RevealedAnswer. */}
              {round.revealedAnswer?.artworkUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- remote host, no loader configured
                <img
                  className="cover"
                  src={round.revealedAnswer.artworkUrl}
                  alt=""
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              {round.revealedAnswer && (
                <p className="muted">
                  Era: {round.revealedAnswer.title} — {round.revealedAnswer.artist}
                </p>
              )}
            </div>
          ) : (
            <div className="panel">
              {round.currentAnswererId === myPlayerId ? (
                <p>
                  🎤 <strong>¡Tu turno de responder!</strong> Dilo en voz alta.
                </p>
              ) : round.currentAnswererId ? (
                <p>
                  🎤 Responde: <strong>{nameOf(round.currentAnswererId)}</strong>
                </p>
              ) : (
                <p className="muted">🎵 ¡Escucha! Pulsa BUZZ cuando la sepas.</p>
              )}

              {round.replayCount > 0 && <p className="muted">🔁 Canción repetida — penalización</p>}

              {!hasBuzzed ? (
                <button type="button" className="buzz" onClick={handleBuzz}>
                  BUZZ
                </button>
              ) : (
                <p>Buzzeaste{myRank ? ` — posición #${myRank}` : ""}. ✋</p>
              )}
            </div>
          )}

          <p className="muted">
            Tu puntaje: <strong>{scores.game.get(myPlayerId) ?? 0}</strong>
          </p>
          {error && <p className="error">{error}</p>}
          {leaveBtn}
        </main>
      );
    }

    // Session hub — waiting for the host to start a game.
    return (
      <main>
        <h1>Hola, {myName}</h1>
        <p className="muted">Espera a que el anfitrión inicie un juego…</p>

        <h2>Jugadores ({players.length})</h2>
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
        {leaveBtn}
      </main>
    );
  }

  return (
    <main>
      <h1>Unirse a la partida</h1>
      <form onSubmit={handleJoin} className="form">
        <label>
          Código de sesión
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            maxLength={5}
            autoCapitalize="characters"
            placeholder="ABCDE"
          />
        </label>
        <label>
          Tu nombre
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            maxLength={30}
            placeholder="¿Cómo te llamas?"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={submitting || !code || !displayName}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
