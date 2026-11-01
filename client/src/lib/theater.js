// Theater theme, snack bar, and easter-egg constants. Job 1 (Adrian) owns
// this. Keep original flavor text here, not copyrighted dialogue.

export const THEMES = [
  { id: "classic", label: "Classic" },
  { id: "horror", label: "Horror" },
  { id: "romance", label: "Romance" },
  { id: "thriller", label: "Thriller" },
  { id: "comedy", label: "Comedy" },
];

export const SNACKS = [
  { id: "popcorn", emoji: "🍿", label: "Popcorn", message: "Extra butter? You got it." },
  { id: "soda", emoji: "🥤", label: "Soda", message: "Careful — don't spill it during the climax." },
  { id: "candy", emoji: "🍬", label: "Candy", message: "Shh, that wrapper is LOUD." },
];

// Typing one of these phrases in chat while that theme is active triggers a
// visual flourish for the whole room (it rides along on the regular chat
// broadcast, so no extra server work is needed).
export const THEME_EASTER_EGGS = {
  horror: { phrase: "redrum", effect: "flicker", message: "Something stirs in the dark..." },
  thriller: { phrase: "gotcha", effect: "shake", message: "Plot twist detected." },
  romance: { phrase: "soulmate", effect: "hearts", message: "A match made in the dark." },
  comedy: { phrase: "rubber chicken", effect: "confetti", message: "Comic timing: perfect." },
};
