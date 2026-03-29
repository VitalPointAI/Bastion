// Entity resolution aliases - these map document-level entity references to canonical names.
// Scenario-specific aliases should be loaded from the active problem set's entity registry.

/**
 * Canonical alias registry for common geopolitical and military name variants.
 * Maps variant → canonical form. Applied before actor node creation.
 *
 * Keys are lowercase and whitespace-normalized for case-insensitive lookup.
 * "Republic of China" is intentionally NOT mapped to "China" — it is Taiwan (ROC),
 * a distinct geopolitical entity from the PRC.
 *
 * These are entity resolution reference data for resolving entity references in
 * ingested intelligence documents — they are not scenario assumptions. The list
 * covers widely-used abbreviations that appear across many scenarios and documents.
 */
export const CANONICAL_ALIASES: Record<string, string> = {
  // United States variants
  'us': 'United States',
  'usa': 'United States',
  'u.s.': 'United States',
  'u.s.a.': 'United States',
  'america': 'United States',
  'united states of america': 'United States',

  // China variants (PRC only — NOT Republic of China / Taiwan)
  'prc': 'China',
  'peoples republic of china': 'China',
  "people's republic of china": 'China',
  'ccp': 'Chinese Communist Party', // distinct entity from China state

  // Korea variants
  'dprk': 'North Korea',
  'democratic peoples republic of korea': 'North Korea',
  "democratic people's republic of korea": 'North Korea',
  'rok': 'South Korea',
  'republic of korea': 'South Korea',

  // Russia variants
  'rf': 'Russia',
  'russian federation': 'Russia',

  // Military / multilateral shorthand
  'nato': 'NATO',
  'north atlantic treaty organization': 'NATO',
  'pla': "People's Liberation Army",
  'peoples liberation army': "People's Liberation Army",
  "people's liberation army": "People's Liberation Army",
  'indopacom': 'INDOPACOM',
  'indo-pacific command': 'INDOPACOM',
  'pacom': 'INDOPACOM', // former name — superseded by INDOPACOM

  // Other common military / intergovernmental actors
  'dod': 'Department of Defense',
  'department of defense': 'Department of Defense',
  'un': 'United Nations',
  'united nations': 'United Nations',
};

/**
 * Normalize an actor name to its canonical form.
 *
 * Trims whitespace, normalizes internal whitespace to single spaces,
 * then performs a case-insensitive lookup against CANONICAL_ALIASES.
 * Returns the canonical name if found; otherwise returns the trimmed original.
 *
 * IMPORTANT: This function is for display-name canonicalization, not for
 * comparison scoring. It is distinct from normalizeName() in string-matcher.ts
 * which lowercases names for similarity comparison purposes.
 */
export function normalizeActorName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
  return CANONICAL_ALIASES[key] ?? trimmed;
}
