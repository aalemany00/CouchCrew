// Theater theme, snack bar, and easter-egg constants. Job 1 (Adrian) owns
// this. Keep original flavor text here, not copyrighted dialogue.

export const THEMES = [
  { id: "classic", label: "Classic", icon: "🎬", tagline: "The house style — warm theater gold." },
  { id: "horror", label: "Horror", icon: "🎃", tagline: "Blood-red lights, flickering marquee." },
  { id: "romance", label: "Romance", icon: "💗", tagline: "Pink-purple glow, soft and warm." },
  { id: "thriller", label: "Thriller", icon: "🔪", tagline: "Cold blues, high-contrast tension." },
  { id: "comedy", label: "Comedy", icon: "🎭", tagline: "Bright yellow, playful energy." },
  { id: "scifi", label: "Sci-Fi", icon: "🛸", tagline: "Electric cyan-violet, alien glow." },
  { id: "fantasy", label: "Fantasy", icon: "🐉", tagline: "Royal gold and deep forest green." },
  { id: "action", label: "Action", icon: "🚁", tagline: "Explosive orange-red, high energy." },
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
  scifi: { phrase: "engage warp", effect: "warp", message: "Warp drive engaged." },
  fantasy: { phrase: "by the ancients", effect: "sparkle", message: "Ancient magic awakens." },
  action: { phrase: "duck and cover", effect: "blast", message: "Incoming! Brace for impact." },
};
