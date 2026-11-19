import { CountryEvidence } from './types.js';

/**
 * ISO 3166-1 alpha-2 codes for all African sovereign states and territories.
 * In accordance with project requirements, African countries are strictly excluded
 * from the selectable country list.
 */
export const AFRICAN_COUNTRY_CODES = new Set<string>([
  'DZ', // Algeria
  'AO', // Angola
  'BJ', // Benin
  'BW', // Botswana
  'BF', // Burkina Faso
  'BI', // Burundi
  'CV', // Cabo Verde
  'CM', // Cameroon
  'CF', // Central African Republic
  'TD', // Chad
  'KM', // Comoros
  'CG', // Congo
  'CD', // Democratic Republic of the Congo
  'CI', // Côte d'Ivoire
  'DJ', // Djibouti
  'EG', // Egypt
  'GQ', // Equatorial Guinea
  'ER', // Eritrea
  'SZ', // Eswatini
  'ET', // Ethiopia
  'GA', // Gabon
  'GM', // Gambia
  'GH', // Ghana
  'GN', // Guinea
  'GW', // Guinea-Bissau
  'KE', // Kenya
  'LS', // Lesotho
  'LR', // Liberia
  'LY', // Libya
  'MG', // Madagascar
  'MW', // Malawi
  'ML', // Mali
  'MR', // Mauritania
  'MU', // Mauritius
  'MA', // Morocco
  'MZ', // Mozambique
  'NA', // Namibia
  'NE', // Niger
  'NG', // Nigeria
  'RW', // Rwanda
  'ST', // Sao Tome and Principe
  'SN', // Senegal
  'SC', // Seychelles
  'SL', // Sierra Leone
  'SO', // Somalia
  'ZA', // South Africa
  'SS', // South Sudan
  'SD', // Sudan
  'TZ', // Tanzania
  'TG', // Togo
  'TN', // Tunisia
  'UG', // Uganda
  'ZM', // Zambia
  'ZW', // Zimbabwe
  'EH', // Western Sahara
  'RE', // Réunion
  'YT', // Mayotte
  'SH', // Saint Helena
  'IO', // British Indian Ocean Territory
  'TF', // French Southern Territories
]);

/**
 * Standardized ISO 3166-1 alpha-2 country definitions.
 */
export interface CountryDefinition {
  code: string;
  name: string;
}

/**
 * Standardized non-African ISO 3166-1 alpha-2 countries.
 */
const isoCodes = new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

export const NON_AFRICAN_COUNTRIES: CountryDefinition[] = [...isoCodes]
  .filter((code) => !AFRICAN_COUNTRY_CODES.has(code))
  .map((code) => ({ code, name: countryNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));

export function isAfricanCountry(code: string): boolean {
  return AFRICAN_COUNTRY_CODES.has(code.trim().toUpperCase());
}

export function getSelectableCountries(): CountryDefinition[] {
  return [{ code: 'all', name: 'All Countries (Unrestricted)' }, ...NON_AFRICAN_COUNTRIES];
}

export function getCountryName(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return isoCodes.has(normalized) ? countryNames.of(normalized) ?? null : null;
}

const localizedDeclarations: Record<string, RegExp> = {
  FR: /(?:notre communauté|notre serveur|nous sommes) (?:est )?basé(?:e|s|es)? (?:en France|à Paris)\b/iu,
  DE: /(?:unsere (?:Trading[- ]Community|Community|Gruppe)|unser Server) (?:hat (?:ihren|seinen) Sitz in|ist in) Deutschland\b/iu,
  ES: /nuestr[ao] (?:comunidad|servidor) (?:está )?basad[ao] en España\b/iu,
  BR: /noss[ao] (?:comunidade|servidor) (?:é )?(?:sediad[ao]|basead[ao]) no Brasil\b/iu,
  PT: /noss[ao] (?:comunidade|servidor) (?:é )?(?:sediad[ao]|basead[ao]) em Portugal\b/iu,
};

/**
 * Classifies claims from Discord's guild description. Only an independently
 * authenticated source explicitly tying a guild to a country can supply
 * verified evidence. Provider snippets, domains and server names are excluded.
 */
export function detectCountryEvidence(
  guildDescription: string,
  discordInviteUrl: string,
): CountryEvidence {
  const englishClaims = guildDescription.match(
    /\b(?:we are|our (?:trading )?(?:community|server|group) is|this (?:community|server|group) is) based in (?:the )?([^.!?;\n]+)/giu,
  );
  const declarations = [...isoCodes].flatMap((code) => {
    const name = getCountryName(code)!;
    const englishClaim = englishClaims?.find((claim) => claim.trim().toLowerCase().endsWith(` in ${name.toLowerCase()}`) ||
      claim.trim().toLowerCase().endsWith(` in the ${name.toLowerCase()}`));
    const text = englishClaim ?? localizedDeclarations[code]?.exec(guildDescription)?.[0];
    return text ? [{ code, name, text }] : [];
  });

  if (declarations.length === 1) {
    const declaration = declarations[0];
    return {
      countryCode: declaration.code,
      countryName: declaration.name,
      status: 'self_declared',
      sourceUrl: discordInviteUrl,
      supportingEvidence: declaration.text,
      lastVerifiedAt: new Date().toISOString(),
    };
  }

  return {
    countryCode: null,
    countryName: null,
    status: 'unknown',
    sourceUrl: null,
    supportingEvidence: null,
    lastVerifiedAt: null,
  };
}

/**
 * Evaluates whether a candidate's country evidence satisfies the requested country filter.
 *
 * Strict Rules:
 * - If requestedCountry is 'all' or omitted: all communities (including unknown) pass.
 * - If a specific country is requested:
 *   - Communities with status 'unknown' are strictly excluded.
 *   - Communities associated with any other country are strictly excluded.
 *   - Only communities with evidence matching the requested country code pass.
 */
export function matchesCountryFilter(
  evidence: CountryEvidence | null | undefined,
  requestedCountry?: string
): boolean {
  if (!requestedCountry?.trim() || requestedCountry.trim().toLowerCase() === 'all') {
    return true;
  }

  const target = requestedCountry.trim().toUpperCase();

  // Exclude communities whose country cannot be established
  if (!evidence?.countryCode || !evidence.sourceUrl || !evidence.supportingEvidence ||
      (evidence.status !== 'verified' && evidence.status !== 'self_declared')) {
    return false;
  }

  // Must match requested country code exactly
  return evidence.countryCode.toUpperCase() === target;
}
