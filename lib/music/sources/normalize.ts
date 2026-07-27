/**
 * Heuristic normalization of a YouTube video title into an answer (title + artist).
 *
 * Imported playlists carry human-typed titles full of promo noise
 * ("(Official Video)", "[HD]", "| Lyrics"). This trims that down to something a
 * host can judge against, and later something multiple-choice can build
 * distractors from. It is deliberately best-effort: a wrong split affects the
 * printed answer, never the buzzer.
 */

/** Noise words that mark a bracketed segment as promo rather than part of the title. */
const NOISE_WORDS = [
  "official",
  "oficial",
  "video",
  "videoclip",
  "vídeo",
  "music video",
  "audio",
  "lyric",
  "lyrics",
  "letra",
  "letras",
  "subtitulado",
  "hd",
  "hq",
  "4k",
  "8k",
  "1080p",
  "720p",
  "mv",
  "m/v",
  "remaster",
  "remastered",
  "remasterizado",
  "full album",
  "visualizer",
  "clip officiel",
  "con letra",
];

const NOISE_RE = new RegExp(`\\b(${NOISE_WORDS.map(escapeRegExp).join("|")})\\b`, "i");

/**
 * Noise that routinely trails a title with no brackets at all
 * ("Para No Olvidar HD", "A un minuto de ti letra"). Kept narrower than
 * NOISE_WORDS: a bare "video" or "audio" can be part of a real title, so only
 * phrases that are unambiguous in trailing position are listed here.
 */
const TRAILING_NOISE = [
  "hd",
  "hq",
  "4k",
  "8k",
  "1080p",
  "720p",
  "letra",
  "letras",
  "con letra",
  "lyrics",
  "lyric",
  "subtitulado",
  "official video",
  "official music video",
  "official audio",
  "video oficial",
  "audio oficial",
  "videoclip",
  "official",
  "oficial",
  "remastered",
  "remasterizado",
];

const TRAILING_NOISE_RE = new RegExp(
  `[\\s|/·•,\\-–—]*\\b(${TRAILING_NOISE.map(escapeRegExp).join("|")})\\s*$`,
  "i",
);

/** Bracketed groups: (...), [...] and {...}. */
const BRACKETED_RE = /[([{][^)\]}]*[)\]}]/g;

/** Separators used between artist and song, in rough order of popularity. */
const SEPARATOR_RE = /\s+[-–—]\s+/;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Strips leftover punctuation a removed segment may have stranded at either end. */
function trimJunk(s: string): string {
  return collapse(s)
    .replace(/^[\s|/·•,\-–—]+/, "")
    .replace(/[\s|/·•,\-–—]+$/, "")
    .trim();
}

/** Removes bracketed promo segments, a trailing `| noise` tail, and bare trailing noise. */
function stripNoise(rawTitle: string): string {
  let out = rawTitle.replace(BRACKETED_RE, (group) => (NOISE_RE.test(group) ? " " : group));

  // Trailing pipe-separated noise: "Song | Official Video" -> "Song".
  out = out
    .split("|")
    .filter((part, i) => i === 0 || !NOISE_RE.test(part))
    .join(" | ");

  out = trimJunk(out);

  // Peel bare trailing noise, repeatedly: "Song HD letra" -> "Song".
  // Never peel the title down to nothing.
  for (;;) {
    const peeled = trimJunk(out.replace(TRAILING_NOISE_RE, ""));
    if (!peeled || peeled === out) break;
    out = peeled;
  }

  return out;
}

/**
 * Channel names carry provider suffixes. YouTube Music's auto-generated artist
 * channels are literally "<Artist> - Topic"; label channels append "VEVO".
 */
function cleanChannel(channelTitle: string): string {
  return trimJunk(
    channelTitle
      .replace(/\s*-\s*Topic\s*$/i, "")
      .replace(/VEVO\s*$/i, "")
      .replace(/\s*-\s*Official\s*$/i, ""),
  );
}

export interface NormalizedAnswer {
  answerTitle: string;
  answerArtist: string;
}

/**
 * Turns a playlist entry into a normalized answer.
 *
 * Strategy: strip promo noise, then split on " - " (artist first, the dominant
 * convention on YouTube). With no separator, fall back to the channel as the
 * artist — which is exactly right for YouTube Music "- Topic" channels.
 */
export function normalizeAnswer(rawTitle: string, channelTitle?: string | null): NormalizedAnswer {
  const cleaned = stripNoise(rawTitle) || trimJunk(rawTitle);
  const channel = channelTitle ? cleanChannel(channelTitle) : "";

  const parts = cleaned.split(SEPARATOR_RE).map(trimJunk).filter(Boolean);

  if (parts.length >= 2) {
    const [artist, ...rest] = parts;
    return { answerTitle: rest.join(" - "), answerArtist: artist };
  }

  return { answerTitle: cleaned || trimJunk(rawTitle), answerArtist: channel };
}
