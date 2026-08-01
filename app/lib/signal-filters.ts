export type Datum = { value: number | string; description?: string };

export type SignalRecord = {
  pageid: string;
  title: string;
  added_since: number;
  spectrum?: { filename?: string; url?: string } | null;
  audio?: { filename?: string; url?: string } | null;
  category: string[];
  frequency: Datum[];
  bandwidth: Datum[];
  acf: Datum[];
  modulation: Datum[];
  mode: Datum[];
  location: Datum[];
  "short description": string;
  description: string;
  custom?: boolean;
};

export type EngineeringUnit = "Hz" | "kHz" | "MHz" | "GHz" | "ms";

export type NumericFilterState = {
  active: boolean;
  value: string;
  unit: EngineeringUnit;
  tolerance: number;
};

export type FiltersState = {
  band: string;
  frequency: NumericFilterState;
  bandwidth: NumericFilterState;
  acf: NumericFilterState;
  categories: string[];
  modulations: string[];
  locations: string[];
  versions: string[];
};

export const RF_BANDS = [
  { label: "ELF", min: 3, max: 30 },
  { label: "SLF", min: 30, max: 300 },
  { label: "ULF", min: 300, max: 3_000 },
  { label: "VLF", min: 3_000, max: 30_000 },
  { label: "LF", min: 30_000, max: 300_000 },
  { label: "MF", min: 300_000, max: 3_000_000 },
  { label: "HF", min: 3_000_000, max: 30_000_000 },
  { label: "VHF", min: 30_000_000, max: 300_000_000 },
  { label: "UHF", min: 300_000_000, max: 3_000_000_000 },
  { label: "SHF", min: 3_000_000_000, max: 30_000_000_000 },
  { label: "EHF", min: 30_000_000_000, max: 300_000_000_000 },
] as const;

const UNIT_SCALE: Record<EngineeringUnit, number> = {
  Hz: 1,
  kHz: 1_000,
  MHz: 1_000_000,
  GHz: 1_000_000_000,
  ms: 1,
};

type SignalIndexEntry = {
  searchText: string;
  frequency: number[];
  bandwidth: number[];
  acf: number[];
  categories: Set<string>;
  modulations: Set<string>;
  locations: Set<string>;
  version: string;
};

export type SignalIndex = Map<string, SignalIndexEntry>;

export function createDefaultFilters(): FiltersState {
  return {
    band: "",
    frequency: { active: false, value: "", unit: "kHz", tolerance: 0 },
    bandwidth: { active: false, value: "", unit: "kHz", tolerance: 0 },
    acf: { active: false, value: "", unit: "ms", tolerance: 0 },
    categories: [],
    modulations: [],
    locations: [],
    versions: [],
  };
}

export function numericValues(items: Datum[]) {
  return items
    .map((item) => Number(item.value))
    .filter((value) => Number.isFinite(value));
}

export function textValues(items: Datum[]) {
  return items.map((item) => String(item.value)).filter(Boolean);
}

export function buildSignalIndex(signals: SignalRecord[]): SignalIndex {
  return new Map(signals.map((signal) => [
    signal.pageid,
    {
      searchText: [
        signal.title,
        signal["short description"],
        signal.description,
        ...signal.category,
        ...textValues(signal.modulation),
        ...textValues(signal.mode),
        ...textValues(signal.location),
      ].join(" ").toLocaleLowerCase(),
      frequency: numericValues(signal.frequency),
      bandwidth: numericValues(signal.bandwidth),
      acf: numericValues(signal.acf),
      categories: new Set(signal.category),
      modulations: new Set(textValues(signal.modulation)),
      locations: new Set(textValues(signal.location)),
      version: String(signal.added_since),
    },
  ]));
}

function usableNumericFilter(filter: NumericFilterState) {
  const value = Number(filter.value);
  return filter.active && filter.value.trim() !== "" && Number.isFinite(value) && value >= 0;
}

function matchesNumericTarget(values: number[], filter: NumericFilterState) {
  if (!usableNumericFilter(filter)) return true;
  const target = Number(filter.value) * UNIT_SCALE[filter.unit];
  const tolerance = Math.min(50, Math.max(0, filter.tolerance)) / 100;
  const low = target * (1 - tolerance);
  const high = target * (1 + tolerance);
  return values.some((value) => value >= low && value <= high);
}

function matchesAny(values: Set<string>, selected: string[]) {
  return !selected.length || selected.some((value) => values.has(value));
}

function overlapsBand(values: number[], label: string) {
  if (!label) return true;
  const band = RF_BANDS.find((candidate) => candidate.label === label);
  return Boolean(band && values.some((value) => value >= band.min && value <= band.max));
}

export function countActiveFilterGroups(filters: FiltersState) {
  return [
    Boolean(filters.band),
    usableNumericFilter(filters.frequency),
    usableNumericFilter(filters.bandwidth),
    usableNumericFilter(filters.acf),
    Boolean(filters.categories.length),
    Boolean(filters.modulations.length),
    Boolean(filters.locations.length),
    Boolean(filters.versions.length),
  ].filter(Boolean).length;
}

export function filterSignals({
  signals,
  index,
  query,
  filters,
  savedOnly,
  bookmarks,
}: {
  signals: SignalRecord[];
  index: SignalIndex;
  query: string;
  filters: FiltersState;
  savedOnly: boolean;
  bookmarks: Set<string>;
}) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const result = signals.filter((signal) => {
    const entry = index.get(signal.pageid);
    if (!entry) return false;
    if (terms.length && !terms.every((term) => entry.searchText.includes(term))) return false;
    if (savedOnly && !bookmarks.has(signal.pageid)) return false;
    if (!matchesAny(entry.categories, filters.categories)) return false;
    if (!matchesAny(entry.modulations, filters.modulations)) return false;
    if (!matchesAny(entry.locations, filters.locations)) return false;
    if (filters.versions.length && !filters.versions.includes(entry.version)) return false;
    if (!overlapsBand(entry.frequency, filters.band)) return false;
    if (!matchesNumericTarget(entry.frequency, filters.frequency)) return false;
    if (!matchesNumericTarget(entry.bandwidth, filters.bandwidth)) return false;
    if (!matchesNumericTarget(entry.acf, filters.acf)) return false;
    return true;
  });

  if (terms.length) {
    result.sort((a, b) => {
      const aStarts = a.title.toLocaleLowerCase().startsWith(terms[0]) ? 0 : 1;
      const bStarts = b.title.toLocaleLowerCase().startsWith(terms[0]) ? 0 : 1;
      return aStarts - bStarts || a.title.localeCompare(b.title);
    });
  }
  return result;
}
