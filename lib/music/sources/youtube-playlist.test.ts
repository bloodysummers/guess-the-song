import { describe, expect, it } from "vitest";

import { parsePlaylistId } from "./youtube-playlist";

describe("parsePlaylistId", () => {
  it("reads the list id from youtube.com and music.youtube.com playlist URLs", () => {
    expect(parsePlaylistId("https://www.youtube.com/playlist?list=PLabc123_-x")).toBe(
      "PLabc123_-x",
    );
    expect(parsePlaylistId("https://music.youtube.com/playlist?list=OLAK5uy_abc")).toBe(
      "OLAK5uy_abc",
    );
  });

  it("reads the list id from a watch URL or a youtu.be link", () => {
    expect(parsePlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz")).toBe("PLxyz");
    expect(parsePlaylistId("https://youtu.be/dQw4w9WgXcQ?list=PLxyz")).toBe("PLxyz");
  });

  it("tolerates a missing scheme and surrounding whitespace", () => {
    expect(parsePlaylistId("  youtube.com/playlist?list=PLxyz  ")).toBe("PLxyz");
  });

  it("rejects non-YouTube hosts", () => {
    expect(parsePlaylistId("https://open.spotify.com/playlist/37i9dQZF1DX")).toBeNull();
    expect(parsePlaylistId("https://youtube.com.evil.test/playlist?list=PLxyz")).toBeNull();
  });

  it("rejects a YouTube URL with no playlist, a bare id, and junk", () => {
    expect(parsePlaylistId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parsePlaylistId("PLabc123")).toBeNull();
    expect(parsePlaylistId("")).toBeNull();
    expect(parsePlaylistId("not a url")).toBeNull();
  });
});
