# Music Providers — prerequisitos externos y restricciones

Guía para la Épica D del roadmap. Resume qué hace falta configurar en cada plataforma y las
restricciones reales que condicionan el diseño. **Léelo antes de empezar los changes de
providers** — hay limitaciones que afectan el alcance.

## Estado actual (MVP)

- **YouTube vía IFrame Player API**, de forma **anónima** (sin API key ni login). Reproduce
  por `videoId`. Las canciones son las de nuestras **playlists curadas** en la BD (cada
  `track` tiene su `provider_ref` = id de video + `answer_title`/`answer_artist`).
- Esto **no cambia**: seguirá siendo la opción por defecto (gratis, sin cuentas).

## La distinción clave: **reproducir** ≠ **leer catálogo**

Hoy solo reproducimos (tenemos los IDs en la BD). Para "usar mis playlists" hay que **leer
el catálogo** del usuario (sus listas y las pistas), lo cual sí requiere API/keys y a veces
login. Además, el **texto de la respuesta** (título/artista) hay que **normalizarlo** al
importar (los títulos de YouTube son sucios: "Artista - Canción (Official Video) [4K]").

## Dos niveles de "usar mis playlists"

| Nivel | Qué permite | Fricción | Login del usuario |
|---|---|---|---|
| **Tier 1 — Playlist pública por URL** | Pegar una URL de playlist pública y leerla | Baja | **No** |
| **Tier 2 — Conectar cuenta (OAuth)** | Acceder a listas **privadas** del usuario | Alta (revisión de plataforma) | Sí |

Recomendación: **empezar por Tier 1 con YouTube** (D2) — da mucho valor con mínima fricción.

---

## YouTube / YouTube Music

**Reproducción:** gratis vía IFrame API (ya lo hacemos). Sin cambios.

**Leer playlists — YouTube Data API v3:**
- **Tier 1 (pública):** con solo una **API key** se puede leer una playlist pública
  (`playlistItems.list`). Sin login. Ideal para D2.
- **Tier 2 (privada):** requiere **OAuth 2.0** con scope `youtube.readonly` (scope
  *sensible* → Google exige **verificación de la app** para producción; sin verificar,
  limitado a ~100 usuarios de prueba + pantalla de advertencia).

**Qué debes configurar (Google Cloud Console):**
1. Crear un proyecto.
2. Habilitar **"YouTube Data API v3"**.
3. Para Tier 1: crear una **API key**.
4. Para Tier 2: crear **OAuth Client ID** (tipo Web) + configurar pantalla de consentimiento
   y redirect URIs (`https://<tu-dominio>/api/auth/youtube/callback` y el de localhost).
5. **Cuota:** 10,000 unidades/día por defecto (leer playlists consume cuota; suele alcanzar).

**Env vars:** `YOUTUBE_API_KEY` (Tier 1), `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Tier 2).

**Nota:** no hay "YouTube Music API" oficial; las listas de YT Music son listas de YouTube y
se leen con la misma Data API (imperfecto, pero funciona).

---

## Spotify

**Metadatos:** excelentes y limpios (título, artista, álbum, año) → ideales para la respuesta
y para los distractores de opción múltiple.

**Reproducción — el gran caveat:**
- La **reproducción completa** en el navegador exige el **Web Playback SDK** y que el host
  tenga **Spotify Premium**.
- Los `preview_url` de 30s **ya no son fiables** para apps nuevas (Spotify los retiró junto a
  varios endpoints a fines de 2024).
- ⇒ Con Spotify, el host necesita **Premium** para que suene la música completa.

**Leer playlists — Spotify Web API:**
- **Tier 1 (pública):** con **Client Credentials** (client id/secret, sin login) se leen
  playlists públicas.
- **Tier 2 (privada):** **OAuth Authorization Code** con scopes `playlist-read-private`,
  `playlist-read-collaborative`, y `streaming` + `user-read-email` para la reproducción.

**Qué debes configurar (Spotify Developer Dashboard):**
1. Crear una **app** → obtener **Client ID** + **Client Secret**.
2. Configurar **Redirect URIs** (dominio de Vercel + localhost).
3. **Modo desarrollo:** las apps nuevas están limitadas a **25 usuarios** que agregas a mano,
   hasta solicitar **extensión de cuota** (revisión de Spotify) para uso público.

**Env vars:** `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`.

---

## Implicaciones para el diseño

- La interfaz `MusicProvider` gana un lado de **catálogo**: `listPlaylists()`,
  `getPlaylistTracks(id)`; y un **pipeline de importación** que normaliza a `track`
  (`answer_title`/`answer_artist` limpios, `provider_ref`, `default_start_ms`).
- **Reproducción por proveedor:** YouTube (IFrame, gratis) y Spotify (Web Playback SDK,
  Premium). La abstracción ya separa esto; cada impl. trae su reproductor.
- **Ambas plataformas tienen un "portón" de revisión** para uso público (verificación de
  Google / extensión de cuota de Spotify). Durante desarrollo funcionan con usuarios de
  prueba; para lanzamiento abierto hay que pasar esas revisiones. **Planear tiempo para eso.**
- Por eso el orden sugerido: **D2 (YouTube público, sin login) primero** → luego las cuentas
  OAuth (D3/D4) cuando queramos listas privadas y estemos listos para las revisiones.
