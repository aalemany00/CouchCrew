// Theater theme, snack bar, and easter-egg constants. Job 1 (Adrian) owns
// this. Keep original flavor text here, not copyrighted dialogue.

export const THEMES = [
  { id: "classic", label: "Classic", icon: "🎬", tagline: "Velvet curtains, marquee bulbs and a classic picture palace." },
  { id: "horror", label: "Horror", icon: "🎃", tagline: "A ruined haunted cinema with cobwebs, skulls and candlelight." },
  { id: "romance", label: "Romance", icon: "💗", tagline: "A candlelit rose garden theater with romantic velvet seating." },
  { id: "thriller", label: "Thriller", icon: "🔪", tagline: "Rainy detective cinema, evidence board and shadowy windows." },
  { id: "comedy", label: "Comedy", icon: "🎭", tagline: "A bright vaudeville stage with balloons and comedy masks." },
  { id: "scifi", label: "Sci-Fi", icon: "🛸", tagline: "A starship screening bay with consoles and planetary windows." },
  { id: "fantasy", label: "Fantasy", icon: "🐉", tagline: "A castle cinema with stone arches, banners and enchanted relics." },
  { id: "action", label: "Action", icon: "🚁", tagline: "An industrial action bunker with hazard stripes and equipment crates." },
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
