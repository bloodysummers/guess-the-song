import { describe, expect, it } from "vitest";

import { normalizeAnswer } from "./normalize";

describe("normalizeAnswer", () => {
  it("splits 'Artist - Song' and drops promo brackets", () => {
    expect(normalizeAnswer("Soda Stereo - De Música Ligera (Official Video)")).toEqual({
      answerArtist: "Soda Stereo",
      answerTitle: "De Música Ligera",
    });
    expect(normalizeAnswer("a-ha - Take On Me [Official Video] [Remastered in 4K]")).toEqual({
      answerArtist: "a-ha",
      answerTitle: "Take On Me",
    });
  });

  it("handles en/em dash separators", () => {
    expect(normalizeAnswer("Café Tacvba – Eres").answerArtist).toBe("Café Tacvba");
    expect(normalizeAnswer("Café Tacvba — Eres").answerTitle).toBe("Eres");
  });

  it("strips a trailing pipe-separated noise tail", () => {
    expect(normalizeAnswer("Maná - Rayando el Sol | Video Oficial")).toEqual({
      answerArtist: "Maná",
      answerTitle: "Rayando el Sol",
    });
  });

  it("keeps meaningful parentheses that are not promo noise", () => {
    expect(normalizeAnswer("Shakira - Ciega, Sordomuda (En Vivo)")).toEqual({
      answerArtist: "Shakira",
      answerTitle: "Ciega, Sordomuda (En Vivo)",
    });
  });

  it("falls back to the channel as artist, unwrapping a '- Topic' channel", () => {
    expect(normalizeAnswer("Bohemian Rhapsody", "Queen - Topic")).toEqual({
      answerArtist: "Queen",
      answerTitle: "Bohemian Rhapsody",
    });
    expect(normalizeAnswer("Vivir Mi Vida", "MarcAnthonyVEVO").answerArtist).toBe("MarcAnthony");
  });

  it("keeps the extra segments when a title splits more than once", () => {
    expect(normalizeAnswer("Molotov - Gimme Tha Power - En Vivo")).toEqual({
      answerArtist: "Molotov",
      answerTitle: "Gimme Tha Power - En Vivo",
    });
  });

  it("peels bare trailing noise that carries no brackets", () => {
    // Real titles seen in imported playlists.
    expect(normalizeAnswer("Los Rodríguez - Para No Olvidar HD").answerTitle).toBe(
      "Para No Olvidar",
    );
    expect(normalizeAnswer("A un minuto de ti Duncan Dhu letra").answerTitle).toBe(
      "A un minuto de ti Duncan Dhu",
    );
    expect(normalizeAnswer("Song Name - Official Video").answerTitle).toBe("Song Name");
  });

  it("peels several stacked trailing noise tokens", () => {
    expect(normalizeAnswer("Eres — video oficial HD").answerTitle).toBe("Eres");
  });

  it("does not peel a title that is only a noise word", () => {
    expect(normalizeAnswer("Oficial").answerTitle).toBe("Oficial");
  });

  it("never returns an empty title, even for an all-noise title", () => {
    expect(normalizeAnswer("(Official Video)").answerTitle).toBe("(Official Video)");
  });

  it("leaves a plain title untouched when there is no channel", () => {
    expect(normalizeAnswer("Smells Like Teen Spirit")).toEqual({
      answerArtist: "",
      answerTitle: "Smells Like Teen Spirit",
    });
  });
});
