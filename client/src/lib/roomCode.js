// No 0/O/1/l/I — avoids ambiguous characters when people read a code aloud
// or type it from a screenshot.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateRoomCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
