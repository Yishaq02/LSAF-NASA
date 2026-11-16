/**
 * Celestial naming and astrophysical metadata normalizer (English-only standard).
 * Guarantees that any legacy Spanish text from backend or targets.json is automatically
 * translated into clean, standardized astronomical English.
 */

export const NAME_MAP = {
  'estrella de barnard': "Barnard's Star",
  'barnard': "Barnard's Star",
  'wise 0855': 'WISE 0855-0714',
  'wise0855': 'WISE 0855-0714',
  'wise_0855': 'WISE 0855-0714',
  'epsilon indi b': 'Epsilon Indi B',
  'rw aurigae': 'RW Aurigae',
  'rwaur': 'RW Aurigae',
  'r draconis': 'R Draconis',
  'rdra': 'R Draconis',
  'plutino': 'Plutino / Trans-Neptunian Object',
  'plutino / tno': 'Plutino / Trans-Neptunian Object',
};

export const TYPE_MAP = {
  'enana roja (m4.0v)': 'Red Dwarf (M4.0V)',
  'enana roja': 'Red Dwarf (M-Class)',
  'enana marron binaria': 'Binary Brown Dwarf',
  'enana marrón binaria': 'Binary Brown Dwarf',
  'sub-enana marron (y)': 'Y-Class Brown Dwarf (Sub-stellar)',
  'sub-enana marrón (y)': 'Y-Class Brown Dwarf (Sub-stellar)',
  'enana marron': 'Brown Dwarf',
  'enana marrón': 'Brown Dwarf',
  'estrella variable (t tauri)': 'T Tauri Variable Star',
  'estrella variable tipo mira': 'Mira-type Variable Star',
  'objeto del cinturon de kuiper': 'Kuiper Belt Object (TNO)',
  'objeto del cinturón de kuiper': 'Kuiper Belt Object (TNO)',
};

export const SIMBAD_OTYPE_MAP = {
  '*': 'Star',
  '**': 'Double / Multiple Star',
  'PM*': 'High Proper-Motion Star',
  'BY*': 'BY Dra Variable Star',
  'EB*': 'Eclipsing Binary Star',
  'V*': 'Variable Star',
  'Em*': 'Emission-Line Star',
  'Pl': 'Extrasolar Planet',
  'WD*': 'White Dwarf',
  'BD*': 'Brown Dwarf',
  'TT*': 'T Tauri Variable Star',
  'Mira': 'Mira Variable Giant',
  'LP*': 'Long-Period Variable Star',
  'RS*': 'RS CVn Variable Star',
  'RR*': 'RR Lyrae Variable Star',
  'G': 'Galaxy',
  'IR': 'Infrared Source',
  'Rad': 'Radio Source',
  'X': 'X-Ray Source',
  'YSO': 'Young Stellar Object',
  'Candidate': 'Astronomical Candidate',
  'MoC': 'Molecular Cloud',
  'ISM': 'Interstellar Medium',
  'Planet?': 'Exoplanet Candidate',
};

export const DESCRIPTION_MAP = {
  'barnard': 'Star with the highest known proper motion. Ideal for testing transverse motion detection algorithms in SPHEREx.',
  'epsilon_indi_b': 'Binary brown dwarf system. Its infrared brightness is ideal for analyzing all 102 SPHEREx spectral channels.',
  'wise0855': 'One of the coldest known compact objects outside the Solar System with strong atmospheric methane and water absorption.',
  'wise_0855': 'One of the coldest known compact objects outside the Solar System with strong atmospheric methane and water absorption.',
  'rwaur': 'Young pre-main-sequence star with dramatic brightness dips caused by protoplanetary disk interactions.',
  'rw_aurigae': 'Young pre-main-sequence star with dramatic brightness dips caused by protoplanetary disk interactions.',
  'rdra': 'Pulsating red giant star. Its radius and infrared luminosity vary radically across periodic cycles.',
  'r_draconis': 'Pulsating red giant star. Its radius and infrared luminosity vary radically across periodic cycles.',
  'plutino': 'Trans-Neptunian object in 2:3 orbital resonance with Neptune, moving rapidly across consecutive observational epochs.',
};

/**
 * Clean SIMBAD or catalog identifier
 * Strips "NAME ", leading asterisks, etc.
 */
export function cleanStarName(raw) {
  if (!raw) return 'Unknown Star';
  let cleaned = String(raw).trim();
  if (cleaned.startsWith('NAME ')) {
    cleaned = cleaned.replace(/^NAME\s+/, '');
  }
  if (cleaned.startsWith('* ')) {
    cleaned = cleaned.replace(/^\*\s+/, '');
  }
  // Replace multiple spaces with single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  return formatTargetName(cleaned);
}

/**
 * Format SIMBAD object type and description into standard English
 */
export function formatSimbadOtype(otype, otypeTxt) {
  if (otypeTxt && otypeTxt.trim() && !SIMBAD_OTYPE_MAP[otypeTxt]) {
    const rawTxt = otypeTxt.trim();
    if (rawTxt !== otype) return rawTxt;
  }
  if (otype && SIMBAD_OTYPE_MAP[otype.trim()]) {
    return SIMBAD_OTYPE_MAP[otype.trim()];
  }
  if (otypeTxt && SIMBAD_OTYPE_MAP[otypeTxt.trim()]) {
    return SIMBAD_OTYPE_MAP[otypeTxt.trim()];
  }
  return otypeTxt || otype || 'Astronomical Object';
}

/**
 * Converts decimal RA and DEC to J2000 sexagesimal string
 */
export function raDecToSexagesimal(ra, dec) {
  if (typeof ra !== 'number' || typeof dec !== 'number' || isNaN(ra) || isNaN(dec)) {
    return { raStr: '--', decStr: '--', fullStr: '--' };
  }
  // RA: degrees to hours
  const raHours = ((ra % 360) + 360) % 360 / 15;
  const rh = Math.floor(raHours);
  const rm = Math.floor((raHours - rh) * 60);
  const rs = ((raHours - rh - rm / 60) * 3600).toFixed(2);
  const raStr = `${String(rh).padStart(2, '0')}h ${String(rm).padStart(2, '0')}m ${String(rs).padStart(5, '0')}s`;

  // DEC: degrees to deg, min, sec
  const sign = dec >= 0 ? '+' : '-';
  const absDec = Math.abs(dec);
  const dd = Math.floor(absDec);
  const dm = Math.floor((absDec - dd) * 60);
  const ds = ((absDec - dd - dm / 60) * 3600).toFixed(1);
  const decStr = `${sign}${String(dd).padStart(2, '0')}° ${String(dm).padStart(2, '0')}' ${String(ds).padStart(4, '0')}"`;

  return {
    raStr,
    decStr,
    fullStr: `J2000 ${raStr} ${decStr}`,
  };
}

/**
 * Clean and translate star name to English
 */
export function formatTargetName(name, id) {
  if (!name && !id) return 'Unknown Celestial Object';
  const raw = String(name || id).trim();
  const lower = raw.toLowerCase();
  if (NAME_MAP[lower]) return NAME_MAP[lower];
  if (id && NAME_MAP[String(id).toLowerCase()]) return NAME_MAP[String(id).toLowerCase()];
  return raw;
}

/**
 * Clean and translate stellar classification to English
 */
export function formatTargetType(type, id) {
  if (!type) {
    if (id && NAME_MAP[String(id).toLowerCase()]) return 'Featured Target';
    return 'Stellar Target';
  }
  const raw = String(type).trim();
  const lower = raw.toLowerCase();
  if (TYPE_MAP[lower]) return TYPE_MAP[lower];
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (lower.includes(key)) return val;
  }
  return raw;
}

/**
 * Clean and translate description to English
 */
export function formatTargetDescription(desc, id) {
  if (id && DESCRIPTION_MAP[String(id).toLowerCase()]) {
    return DESCRIPTION_MAP[String(id).toLowerCase()];
  }
  if (!desc) return '';
  const raw = String(desc).trim();
  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(DESCRIPTION_MAP)) {
    if (lower.includes(key)) return val;
  }
  return raw;
}
