import {
  getElectricPianoNames,
  getMalletNames,
  getMellotronNames,
  getSmolkenNames,
  getDrumMachineNames,
  getSoundfontNames,
} from 'smplr';

// Local type aliases — no dependency on dottl's types/layers
export type SmplrLibrary =
  | 'Soundfont'
  | 'SplendidGrandPiano'
  | 'ElectricPiano'
  | 'Mallet'
  | 'Mellotron'
  | 'Smolken'
  | 'DrumMachine';

export type InstrumentCategory =
  | 'keys'
  | 'guitar'
  | 'strings'
  | 'drums'
  | 'horns'
  | 'reeds'
  | 'mallets'
  | 'synth'
  | 'world'
  | 'fx'
  | 'voice'
  | 'Keys'
  | 'Guitars'
  | 'Strings'
  | 'Drums'
  | 'Horns'
  | 'Other';

export interface PatchEntry {
  name: string;
  /** Human-readable display name */
  displayName: string;
  library: SmplrLibrary;
  category: InstrumentCategory;
}

/** Prettify a soundfont name like "acoustic_grand_piano" → "Acoustic Grand Piano" */
function prettify(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Soundfont patches grouped by category ─────────────────────────────────

const KEYS_SOUNDFONTS = new Set([
  'acoustic_grand_piano', 'bright_acoustic_piano', 'electric_grand_piano',
  'honkytonk_piano', 'electric_piano_1', 'electric_piano_2',
  'harpsichord', 'clavinet', 'celesta', 'music_box',
  'church_organ', 'reed_organ', 'drawbar_organ', 'percussive_organ', 'rock_organ',
  'accordion', 'tango_accordion', 'harmonica',
]);

const GUITAR_SOUNDFONTS = new Set([
  'acoustic_guitar_nylon', 'acoustic_guitar_steel',
  'electric_guitar_clean', 'electric_guitar_jazz', 'electric_guitar_muted',
  'overdriven_guitar', 'distortion_guitar', 'guitar_harmonics', 'guitar_fret_noise',
  'banjo', 'sitar', 'koto', 'shamisen', 'dulcimer', 'orchestral_harp', 'kalimba',
  'acoustic_bass', 'electric_bass_finger', 'electric_bass_pick', 'fretless_bass',
  'slap_bass_1', 'slap_bass_2', 'synth_bass_1', 'synth_bass_2',
]);

const STRING_SOUNDFONTS = new Set([
  'violin', 'viola', 'cello', 'contrabass', 'fiddle',
  'tremolo_strings', 'pizzicato_strings',
  'string_ensemble_1', 'string_ensemble_2',
  'synth_strings_1', 'synth_strings_2',
  'choir_aahs', 'voice_oohs', 'synth_choir',
]);

const DRUM_SOUNDFONTS = new Set([
  'steel_drums', 'woodblock', 'taiko_drum', 'timpani', 'agogo',
  'melodic_tom', 'synth_drum', 'reverse_cymbal', 'tinkle_bell',
]);

const HORN_SOUNDFONTS = new Set([
  'trumpet', 'muted_trumpet', 'trombone', 'tuba', 'french_horn', 'english_horn',
  'brass_section', 'synth_brass_1', 'synth_brass_2',
  'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax',
  'flute', 'piccolo', 'recorder', 'pan_flute', 'blown_bottle', 'shakuhachi',
  'whistle', 'ocarina', 'clarinet', 'oboe', 'bassoon', 'bagpipe', 'shanai',
]);

// Mellotron patches grouped by category
const MELLOTRON_STRINGS = new Set([
  '300 STRINGS CELLO', '300 STRINGS VIOLA', 'BASSA+STRNGS', 'CHMB 3 VLNS',
  'CHMBLN CELLO', 'MIXED STRGS', 'MKII VIOLINS', 'MOVE BS+STGS',
  'STRGS+BRASS', 'TRON 16VLNS', 'TRON CELLO', 'TRON VIOLA',
  '8VOICE CHOIR', 'BOYS CHOIR', 'CHMB FEMALE', 'CHMB MALE VC',
]);

const MELLOTRON_HORNS = new Set([
  'CHA CHA FLT', 'CHM CLARINET', 'CHMB ALTOSAX', 'CHMB TNR SAX',
  'CHMB TRMBONE', 'CHMB TRUMPET', 'CHMBLN FLUTE', 'CHMBLN OBOE',
  'DIXIE+TRMBN', 'FOXTROT+SAX', 'HALFSP.BRASS', 'MKII BRASS',
  'MKII SAX', 'TROMB+TRMPT', 'TRON FLUTE',
]);

const MELLOTRON_OTHER = new Set([
  'MKII GUITAR', 'MKII ORGAN', 'MKII VIBES',
]);

function categorizeSoundfont(name: string): InstrumentCategory {
  if (KEYS_SOUNDFONTS.has(name)) return 'Keys';
  if (GUITAR_SOUNDFONTS.has(name)) return 'Guitars';
  if (STRING_SOUNDFONTS.has(name)) return 'Strings';
  if (DRUM_SOUNDFONTS.has(name)) return 'Drums';
  if (HORN_SOUNDFONTS.has(name)) return 'Horns';
  return 'Other';
}

function categorizeMellotron(name: string): InstrumentCategory {
  if (MELLOTRON_STRINGS.has(name)) return 'Strings';
  if (MELLOTRON_HORNS.has(name)) return 'Horns';
  if (MELLOTRON_OTHER.has(name)) return 'Other';
  return 'Strings'; // fallback
}

/** Build the full patch registry. Called once and cached. */
function buildRegistry(): PatchEntry[] {
  const patches: PatchEntry[] = [];

  // SplendidGrandPiano
  patches.push({
    name: 'Splendid Grand Piano',
    displayName: 'Splendid Grand Piano',
    library: 'SplendidGrandPiano',
    category: 'Keys',
  });

  // ElectricPiano
  for (const name of getElectricPianoNames()) {
    patches.push({ name, displayName: name, library: 'ElectricPiano', category: 'Keys' });
  }

  // Mallet → Other/mallets
  for (const name of getMalletNames()) {
    patches.push({ name, displayName: name, library: 'Mallet', category: 'Other' });
  }

  // Mellotron → split across categories
  for (const name of getMellotronNames()) {
    patches.push({ name, displayName: name, library: 'Mellotron', category: categorizeMellotron(name) });
  }

  // Smolken → Guitars (bass)
  for (const name of getSmolkenNames()) {
    patches.push({ name, displayName: name, library: 'Smolken', category: 'Guitars' });
  }

  // DrumMachine → Drums
  for (const name of getDrumMachineNames()) {
    patches.push({ name, displayName: name, library: 'DrumMachine', category: 'Drums' });
  }

  // Soundfont → categorize each
  for (const name of getSoundfontNames()) {
    patches.push({ name, displayName: prettify(name), library: 'Soundfont', category: categorizeSoundfont(name) });
  }

  return patches;
}

let _registry: PatchEntry[] | null = null;

export function getPatchRegistry(): PatchEntry[] {
  if (!_registry) _registry = buildRegistry();
  return _registry;
}

/** Get all patches for a given category, sorted by display name. */
export function getPatchesForCategory(category: InstrumentCategory): PatchEntry[] {
  return getPatchRegistry()
    .filter((p) => p.category === category)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Check if a patch name exists in the registry. */
export function isPatchKnown(patchName: string): boolean {
  return getPatchRegistry().some((p) => p.name === patchName);
}

/** Look up the smplr library for a given patch name. */
export function getLibraryForPatch(patchName: string): SmplrLibrary {
  const entry = getPatchRegistry().find((p) => p.name === patchName);
  return entry?.library ?? 'Soundfont';
}

/** Look up the category for a given patch name. */
export function getCategoryForPatch(patchName: string): InstrumentCategory {
  const entry = getPatchRegistry().find((p) => p.name === patchName);
  return entry?.category ?? 'Other';
}
