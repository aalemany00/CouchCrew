// Auto-generated room codes are inspired by well-known film titles instead
// of random letters/numbers - easier to remember and say out loud than
// "xk4m9q". Kept short (single word, or two short ones) on purpose - a
// full title like "mad-max-fury-road" is too long to read off or type
// back. Collisions (two rooms wanting "inception" at once) are handled by
// claimRoomCode's -2/-3 auto-suffix, same as a typed custom code.
const MOVIE_TITLES = [
  "jaws", "heat", "up", "her", "coco", "alien", "aliens", "rocky",
  "psycho", "frozen", "shrek", "cars", "brave", "avatar", "joker",
  "tenet", "dune", "soul", "luca", "elf", "memento", "arrival", "logan",
  "amadeus", "gravity", "inferno", "zootopia", "coraline", "gladiator",
  "parasite", "whiplash", "inception", "casablanca", "moonlight",
  "goodfellas", "insidious", "ratatouille", "hereditary", "interstellar",
];

export function generateRoomCode() {
  return MOVIE_TITLES[Math.floor(Math.random() * MOVIE_TITLES.length)];
}

// No 0/O/1/l/I - avoids ambiguous characters when read aloud. Only used as
// a last-resort suffix if even "<title>-2".."<title>-29" are all taken.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateRandomSuffix(length = 4) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
