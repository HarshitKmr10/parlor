// Language and flag constants
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  nl: 'Dutch',
  it: 'Italian',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  // Additional languages
  el: 'Greek',
  uk: 'Ukrainian',
  cs: 'Czech',
  vi: 'Vietnamese',
  th: 'Thai',
  he: 'Hebrew',
  id: 'Indonesian',
  ms: 'Malay',
  bn: 'Bengali',
  ur: 'Urdu',
  fa: 'Persian',
  ro: 'Romanian',
  hu: 'Hungarian',
  bg: 'Bulgarian',
  sk: 'Slovak',
  sl: 'Slovenian',
  hr: 'Croatian',
  sr: 'Serbian',
  ca: 'Catalan',
  et: 'Estonian',
  lv: 'Latvian',
  lt: 'Lithuanian',
  is: 'Icelandic',
  nb: 'Norwegian Bokmål',
  nn: 'Norwegian Nynorsk',
};

// Flag codes mapping (some languages use different country flags)
export const LANGUAGE_FLAGS: Record<string, string> = {
  en: 'us',    // English → United States
  es: 'es',    // Spanish → Spain
  fr: 'fr',    // French → France
  de: 'de',    // German → Germany
  pt: 'pt',    // Portuguese → Portugal
  nl: 'nl',    // Dutch → Netherlands
  it: 'it',    // Italian → Italy
  ru: 'ru',    // Russian → Russia
  ja: 'jp',    // Japanese → Japan
  ko: 'kr',    // Korean → South Korea
  zh: 'cn',    // Chinese → China
  ar: 'sa',    // Arabic → Saudi Arabia
  hi: 'in',    // Hindi → India
  tr: 'tr',    // Turkish → Turkey
  pl: 'pl',    // Polish → Poland
  sv: 'se',    // Swedish → Sweden
  da: 'dk',    // Danish → Denmark
  no: 'no',    // Norwegian → Norway
  fi: 'fi',    // Finnish → Finland
  // Additional language mappings
  el: 'gr',    // Greek → Greece
  uk: 'ua',    // Ukrainian → Ukraine
  cs: 'cz',    // Czech → Czechia
  vi: 'vn',    // Vietnamese → Vietnam
  th: 'th',    // Thai → Thailand
  he: 'il',    // Hebrew → Israel
  id: 'id',    // Indonesian → Indonesia
  ms: 'my',    // Malay → Malaysia
  bn: 'bd',    // Bengali → Bangladesh
  ur: 'pk',    // Urdu → Pakistan
  fa: 'ir',    // Persian → Iran
  ro: 'ro',    // Romanian → Romania
  hu: 'hu',    // Hungarian → Hungary
  bg: 'bg',    // Bulgarian → Bulgaria
  sk: 'sk',    // Slovak → Slovakia
  sl: 'si',    // Slovenian → Slovenia
  hr: 'hr',    // Croatian → Croatia
  sr: 'rs',    // Serbian → Serbia
  ca: 'es',    // Catalan → Spain (commonly used)
  et: 'ee',    // Estonian → Estonia
  lv: 'lv',    // Latvian → Latvia
  lt: 'lt',    // Lithuanian → Lithuania
  is: 'is',    // Icelandic → Iceland
  nb: 'no',    // Norwegian Bokmål → Norway
  nn: 'no',    // Norwegian Nynorsk → Norway
};

// Available translations for the app
export const AVAILABLE_TRANSLATIONS = [
  { code: 'fr', name: 'French', flag: 'fr' },
  { code: 'es', name: 'Spanish', flag: 'es' },
  { code: 'de', name: 'German', flag: 'de' },
  { code: 'pt', name: 'Portuguese', flag: 'pt' },
  { code: 'nl', name: 'Dutch', flag: 'nl' },
  { code: 'it', name: 'Italian', flag: 'it' },
];
