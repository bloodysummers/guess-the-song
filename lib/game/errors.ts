import { TransportError } from "@/lib/transport";

const MESSAGES: Record<string, string> = {
  name_taken: "Ese nombre ya está en uso en la sesión. Elige otro.",
  session_not_found: "No existe una sesión con ese código.",
  session_not_joinable: "La partida ya empezó o terminó.",
  session_full: "La sesión está llena.",
  invalid_request: "Revisa los datos e inténtalo de nuevo.",
  invalid_identity: "No pudimos reconectar tu sesión.",
  session_over: "La partida ya terminó.",
  playlist_exhausted: "No quedan más canciones en la playlist.",
  not_host: "Solo el presentador puede hacer esto.",
  not_answering: "La ronda ya se resolvió.",
  not_current_answerer: "Ese jugador ya no tiene el turno.",
  round_not_found: "No se encontró la ronda.",
  no_active_game: "No hay un juego activo.",
  game_not_found: "No se encontró el juego.",
  session_closed: "La sesión está cerrada.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof TransportError) {
    return MESSAGES[err.code] ?? "Ocurrió un error. Inténtalo de nuevo.";
  }
  return "Ocurrió un error. Inténtalo de nuevo.";
}
