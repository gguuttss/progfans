/**
 * The canonical trope taxonomy — 56 tropes across 7 categories.
 * Facets (POV, MC gender, progression pace, romance, status) are NOT here;
 * they are single-select enums on the `series` table.
 *
 * Edit this file to evolve the taxonomy, then run `pnpm --filter @progfans/db seed`.
 * Names are kept short (UI-facing); slugs are the stable keys.
 */
export type TropeSeed = {
  slug: string;
  name: string;
  category:
    | "power_system"
    | "setting"
    | "progression"
    | "protagonist"
    | "tone"
    | "relationships"
    | "content_warning";
  description?: string;
};

export const TROPE_SEED: TropeSeed[] = [
  // A. Power system
  {
    slug: "litrpg",
    name: "LitRPG",
    category: "power_system",
    description: "Explicit game system: levels, stats, blue boxes.",
  },
  {
    slug: "gamelit",
    name: "GameLit",
    category: "power_system",
    description: "Game elements, light on stat blocks.",
  },
  {
    slug: "system-apocalypse",
    name: "System Apocalypse",
    category: "power_system",
    description: "A System descends on the world.",
  },
  {
    slug: "cultivation-xianxia",
    name: "Cultivation",
    category: "power_system",
    description: "Qi, dao, sects, immortality.",
  },
  {
    slug: "wuxia",
    name: "Wuxia",
    category: "power_system",
    description: "Martial arts at mortal scale.",
  },
  {
    slug: "hard-magic",
    name: "Hard Magic",
    category: "power_system",
    description: "Rigid, knowable rules.",
  },
  {
    slug: "soft-magic",
    name: "Soft Magic",
    category: "power_system",
    description: "Mysterious, unquantified.",
  },
  { slug: "class-job-system", name: "Class System", category: "power_system" },
  {
    slug: "superpowers",
    name: "Superpowers",
    category: "power_system",
    description: "Cape-style powers.",
  },
  {
    slug: "crafting-based-power",
    name: "Crafting Power",
    category: "power_system",
    description: "Crafting is the progression engine.",
  },

  // B. Setting / premise
  {
    slug: "portal-fantasy-isekai",
    name: "Isekai",
    category: "setting",
    description: "Transported to another world.",
  },
  {
    slug: "reincarnation",
    name: "Reincarnation",
    category: "setting",
    description: "Reborn into a new life.",
  },
  {
    slug: "transmigration",
    name: "Transmigration",
    category: "setting",
    description: "Into an existing body or character.",
  },
  {
    slug: "regression-second-chance",
    name: "Regression",
    category: "setting",
    description: "Back to the past with foreknowledge.",
  },
  { slug: "time-loop", name: "Time Loop", category: "setting" },
  {
    slug: "urban-earth-fantasy",
    name: "Urban Fantasy",
    category: "setting",
    description: "Set in our world.",
  },
  { slug: "secondary-world", name: "Secondary World", category: "setting" },
  { slug: "sci-fi-space", name: "Sci-fi", category: "setting" },
  { slug: "vrmmo", name: "VRMMO", category: "setting", description: "Virtual reality game world." },
  { slug: "post-apocalyptic-survival", name: "Post-apocalyptic", category: "setting" },
  { slug: "academy-school", name: "School", category: "setting" },
  { slug: "tower-climbing", name: "Tower Climbing", category: "setting" },
  { slug: "dungeon-crawling", name: "Dungeon Crawling", category: "setting" },
  { slug: "war-military", name: "Military", category: "setting" },

  // C. Progression focus
  {
    slug: "dungeon-core",
    name: "Dungeon Core",
    category: "progression",
    description: "The MC is the dungeon.",
  },
  { slug: "kingdom-base-building", name: "Base Building", category: "progression" },
  { slug: "crafting-smithing", name: "Crafting", category: "progression" },
  { slug: "alchemy-potions", name: "Alchemy", category: "progression" },
  { slug: "beast-monster-taming", name: "Monster Taming", category: "progression" },
  { slug: "summoner-necromancy", name: "Summoning", category: "progression" },
  { slug: "merchant-trade", name: "Merchant", category: "progression" },
  {
    slug: "skill-collection",
    name: "Skill Collection",
    category: "progression",
    description: "Gotta-catch-'em-all abilities.",
  },
  {
    slug: "stats-on-page",
    name: "Stats",
    category: "progression",
    description: "Heavy numeric tracking on the page.",
  },

  // D. Protagonist
  { slug: "overpowered-mc", name: "Overpowered MC", category: "protagonist" },
  { slug: "weak-to-strong", name: "Weak to Strong", category: "protagonist" },
  {
    slug: "competent-mc",
    name: "Competent MC",
    category: "protagonist",
    description: "No idiot-ball.",
  },
  { slug: "genius-strategist", name: "Genius MC", category: "protagonist" },
  { slug: "anti-hero", name: "Anti-hero", category: "protagonist" },
  { slug: "villain-evil-mc", name: "Villain MC", category: "protagonist" },
  {
    slug: "non-human-mc",
    name: "Non-human MC",
    category: "protagonist",
    description: "Monster, undead, AI, etc.",
  },
  { slug: "loner-mc", name: "Loner MC", category: "protagonist" },
  { slug: "mature-older-mc", name: "Older MC", category: "protagonist" },

  // E. Tone
  { slug: "comedy", name: "Comedy", category: "tone" },
  { slug: "satire-parody", name: "Satire", category: "tone" },
  { slug: "dark-grimdark", name: "Grimdark", category: "tone" },
  { slug: "cozy-lighthearted", name: "Cozy", category: "tone" },
  { slug: "wholesome", name: "Wholesome", category: "tone" },
  { slug: "tragedy", name: "Tragedy", category: "tone" },
  { slug: "mystery", name: "Mystery", category: "tone" },
  { slug: "horror", name: "Horror", category: "tone" },

  // F. Relationships
  { slug: "harem", name: "Harem", category: "relationships" },
  { slug: "slow-burn-romance", name: "Slow Burn", category: "relationships" },
  { slug: "lgbtq", name: "LGBTQ+", category: "relationships" },

  // G. Content warnings
  { slug: "graphic-violence-gore", name: "Gore", category: "content_warning" },
  {
    slug: "sexual-content-explicit",
    name: "Sexual Content",
    category: "content_warning",
  },
  { slug: "heavy-profanity", name: "Profanity", category: "content_warning" },
  { slug: "drug-substance-themes", name: "Drugs", category: "content_warning" },
];
