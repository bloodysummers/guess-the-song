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

  // Game source (curated playlist / YouTube import)
  invalid_source: "Elige una playlist o pega una URL de YouTube.",
  invalid_youtube_url:
    "Esa URL no es una playlist de YouTube. Copia el enlace de la playlist (debe incluir «list=»).",
  playlist_not_found: "No pudimos leer esa playlist. Asegúrate de que sea pública.",
  playlist_empty: "Esa playlist no tiene canciones que se puedan reproducir.",
  youtube_not_configured: "La importación desde YouTube no está configurada en el servidor.",
  youtube_api_error: "YouTube no respondió. Inténtalo de nuevo en un momento.",
  source_read_failed: "No pudimos leer las canciones. Inténtalo de nuevo.",
  game_tracks_create_failed: "No pudimos preparar las canciones del juego.",
};

export function errorMessage(err: unknown): string {
  if (err instanceof TransportError) {
    return MESSAGES[err.code] ?? "Ocurrió un error. Inténtalo de nuevo.";
  }
  return "Ocurrió un error. Inténtalo de nuevo.";
}
