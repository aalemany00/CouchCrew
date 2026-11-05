// Auto-generated room codes are inspired by well-known film titles instead
// of random letters/numbers - easier to remember and say out loud than
// "xk4m9q". Collisions (two rooms wanting "inception" at once) are handled
// by claimRoomCode's -2/-3 auto-suffix, same as a typed custom code.
const MOVIE_TITLES = [
  "the-godfather", "pulp-fiction", "inception", "the-matrix", "jaws",
  "goodfellas", "casablanca", "the-shining", "fight-club", "se7en",
  "gladiator", "the-departed", "whiplash", "parasite", "interstellar",
  "the-dark-knight", "forrest-gump", "the-usual-suspects", "memento",
  "city-of-god", "spirited-away", "the-prestige", "alien", "heat",
  "die-hard", "back-to-the-future", "jurassic-park", "the-truman-show",
  "no-country-for-old-men", "the-social-network", "moonlight",
  "mad-max-fury-road", "the-grand-budapest-hotel", "her", "arrival",
  "knives-out", "the-big-lebowski", "donnie-darko", "the-princess-bride",
  "edge-of-tomorrow", "children-of-men", "the-game", "coco", "up",
  "WALL-E".toLowerCase(), "ratatouille", "the-incredibles", "toy-story",
  "jurassic-world", "the-avengers", "logan",
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
