/**
 * Maps Royal Road tag slugs onto our controlled taxonomy + facets.
 * RR tags not listed here are intentionally dropped (too generic or no slot):
 * supernatural, psychological, secret_identity, attractive_lead, local_protagonist,
 * modern_knowledge, mythos, dystopia, historical, magical_girl, artificial_intelligence,
 * genetically_engineered, technologically_engineered, steampunk, magitech, otome,
 * competing_love, sports, time_travel.
 */

type FacetMapping =
  | { kind: "facet"; facet: "romance"; value: "subplot" | "central" }
  | { kind: "facet"; facet: "pov"; value: "multiple" }
  | { kind: "facet"; facet: "mcGender"; value: "male" | "female" };

type Mapping = { kind: "trope"; trope: string } | FacetMapping;

const trope = (t: string): Mapping => ({ kind: "trope", trope: t });

export const RR_TAG_MAP: Record<string, Mapping> = {
  // Power system
  litrpg: trope("litrpg"),
  gamelit: trope("gamelit"),
  cultivation: trope("cultivation-xianxia"),
  wuxia: trope("wuxia"),
  martial_arts: trope("wuxia"),
  super_heroes: trope("superpowers"),
  virtual_reality: trope("vrmmo"),
  // Setting / premise
  summoned_hero: trope("portal-fantasy-isekai"),
  reincarnation: trope("reincarnation"),
  loop: trope("time-loop"),
  urban_fantasy: trope("urban-earth-fantasy"),
  contemporary: trope("urban-earth-fantasy"),
  school_life: trope("academy-school"),
  war_and_military: trope("war-military"),
  dungeon_crawler: trope("dungeon-crawling"),
  post_apocalyptic: trope("post-apocalyptic-survival"),
  apocalypse: trope("post-apocalyptic-survival"),
  survival: trope("post-apocalyptic-survival"),
  high_fantasy: trope("secondary-world"),
  low_fantasy: trope("secondary-world"),
  sci_fi: trope("sci-fi-space"),
  "soft_sci-fi": trope("sci-fi-space"),
  "hard_sci-fi": trope("sci-fi-space"),
  space_opera: trope("sci-fi-space"),
  first_contact: trope("sci-fi-space"),
  cyberpunk: trope("sci-fi-space"),
  mecha: trope("sci-fi-space"),
  // Progression focus
  dungeon_core: trope("dungeon-core"),
  crafting: trope("crafting-smithing"),
  kingdom_building: trope("kingdom-base-building"),
  ruling_class: trope("kingdom-base-building"),
  // Protagonist
  "non-human_lead": trope("non-human-mc"),
  monster_evolution: trope("non-human-mc"),
  "anti-hero_lead": trope("anti-hero"),
  antivillain_lead: trope("anti-hero"),
  villainous_lead: trope("villain-evil-mc"),
  strategy: trope("genius-strategist"),
  strong_lead: trope("overpowered-mc"),
  // Tone
  comedy: trope("comedy"),
  satire: trope("satire-parody"),
  grimdark: trope("dark-grimdark"),
  tragedy: trope("tragedy"),
  mystery: trope("mystery"),
  horror: trope("horror"),
  slice_of_life: trope("cozy-lighthearted"),
  cozy: trope("cozy-lighthearted"),
  // Relationships
  harem: trope("harem"),
  lesbian_romance: trope("lgbtq"),
  gender_bender: trope("lgbtq"),
  // Content warnings
  profanity: trope("heavy-profanity"),
  sexual_content: trope("sexual-content-explicit"),
  gore: trope("graphic-violence-gore"),
  // Facets
  romance: { kind: "facet", facet: "romance", value: "subplot" },
  romance_main: { kind: "facet", facet: "romance", value: "central" },
  multiple_lead: { kind: "facet", facet: "pov", value: "multiple" },
  male_lead: { kind: "facet", facet: "mcGender", value: "male" },
  female_lead: { kind: "facet", facet: "mcGender", value: "female" },
};

export type MappedTags = {
  tropeSlugs: string[];
  facets: {
    romance?: "subplot" | "central";
    pov?: "multiple";
    mcGender?: "male" | "female";
  };
};

const ROMANCE_RANK = { subplot: 1, central: 2 } as const;

/** Pure mapping: RR tags -> canonical trope slugs + facet values. */
export function mapRoyalRoadTags(tags: { slug: string }[]): MappedTags {
  const tropeSlugs = new Set<string>();
  const facets: MappedTags["facets"] = {};

  for (const { slug } of tags) {
    const m = RR_TAG_MAP[slug];
    if (!m) continue;
    if (m.kind === "trope") {
      tropeSlugs.add(m.trope);
    } else if (m.facet === "romance") {
      // Keep the strongest romance signal (central beats subplot).
      if (!facets.romance || ROMANCE_RANK[m.value] > ROMANCE_RANK[facets.romance]) {
        facets.romance = m.value;
      }
    } else if (m.facet === "pov") {
      facets.pov = m.value;
    } else {
      facets.mcGender = m.value;
    }
  }

  return { tropeSlugs: [...tropeSlugs], facets };
}
