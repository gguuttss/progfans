# Trope tagging task

You classify progression-fantasy / litRPG book synopses into a fixed trope
taxonomy. **Precision over recall**: only assign a trope the synopsis clearly
supports. When unsure, leave it out. Typical book gets 2–6 tropes.

## Rules

- Use ONLY the exact slugs listed below. Never invent slugs.
- Favor structural/premise tropes a blurb actually reveals: power system, setting,
  premise, protagonist type.
- Do NOT infer tone (comedy/dark/cozy) unless the wording clearly signals it.
- Do NOT assign content warnings unless the synopsis is explicit about them.
- Better to under-tag than over-tag. A wrong tag is worse than a missing one.

## Taxonomy (slug — when to use)

Power system: litrpg (explicit game stats/levels/blue boxes), gamelit (game
elements, light on stats), system-apocalypse (a System descends on the world),
cultivation-xianxia (qi/dao/sects/immortality), wuxia (martial arts, mortal
scale), hard-magic (rigid knowable rules), soft-magic (mysterious/unquantified),
class-job-system (classes/jobs granted), superpowers (cape-style powers),
crafting-based-power (crafting is the progression engine).

Setting: portal-fantasy-isekai (transported to another world), reincarnation
(reborn into a new life), transmigration (into an existing body/character),
regression-second-chance (back to the past with foreknowledge), time-loop,
urban-earth-fantasy (set in our world), secondary-world (invented world),
sci-fi-space, vrmmo (virtual-reality game world), post-apocalyptic-survival,
academy-school, tower-climbing, dungeon-crawling, war-military.

Progression focus: dungeon-core (the MC _is_ the dungeon), kingdom-base-building,
crafting-smithing, alchemy-potions, beast-monster-taming, summoner-necromancy,
merchant-trade, skill-collection, stats-on-page (heavy numeric tracking).

Protagonist: overpowered-mc, weak-to-strong, competent-mc, genius-strategist,
anti-hero, villain-evil-mc, non-human-mc (monster/undead/AI/etc.), loner-mc,
mature-older-mc.

Tone: comedy, satire-parody, dark-grimdark, cozy-lighthearted, wholesome,
tragedy, mystery, horror.

Relationships: harem, slow-burn-romance, lgbtq.

Content warning: graphic-violence-gore, sexual-content-explicit, heavy-profanity,
drug-substance-themes.

## Output

Write a JSON array — one object per book in your chunk — to the result path you
were given. Shape (no prose, no markdown fence):
[{"id": 123, "slugs": ["litrpg","dungeon-crawling"]}, {"id": 124, "slugs": ["cultivation-xianxia"]}]
Include every book's id, even if its slugs array is empty.
