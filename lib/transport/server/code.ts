/** Join-code generation. Alphabet excludes ambiguous characters (0/O, 1/I/L). */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}
