/** Music barrel. Game logic imports the MusicProvider interface + factory from here. */

export type * from "@/lib/music/music-provider";

import type { MusicProvider } from "@/lib/music/music-provider";
import { YouTubeMusicProvider } from "@/lib/music/youtube-provider";

/** Returns the active music provider, typed as the interface. */
export function createMusicProvider(): MusicProvider {
  return new YouTubeMusicProvider();
}
