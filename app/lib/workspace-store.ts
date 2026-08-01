import type { Datum, SignalRecord } from "./signal-filters";

export const CURRENT_WORKSPACE_SCHEMA = 1;
export const SIGID_DATABASE_ID = "sigid";

const INDEXED_DB_NAME = "artemis-workspace";
const INDEXED_DB_VERSION = 1;
const INDEXED_DB_STORE = "workspace";
const INDEXED_DB_KEY = "current";
const LOCAL_STORAGE_KEY = "artemis-workspace";

const MAX_DATABASES = 50;
const MAX_SIGNALS_PER_DATABASE = 5_000;
const MAX_DOCUMENTS_PER_DATABASE = 5_000;
const MAX_TAGS_PER_DATABASE = 1_000;
const MAX_VALUES_PER_PARAMETER = 2_000;
export const WORKSPACE_PERSISTENCE_BYTE_LIMIT = 64 * 1024 * 1024;
export const DATABASE_BUNDLE_BYTE_LIMIT = WORKSPACE_PERSISTENCE_BYTE_LIMIT + 1024 * 1024;
const MAX_DATA_URL_LENGTH = 12 * 1024 * 1024;
const MAX_SHORT_TEXT = 512;
const MAX_DESCRIPTION = 100_000;

export type DocumentType = "Image" | "Audio" | "Document" | "Other";
export type ThemePreference = "system" | "light" | "dark";

export type SignalDocument = {
  id: string;
  signalId: string;
  fileName: string;
  name: string;
  description: string;
  type: DocumentType;
  preview: boolean;
  mime: string;
  dataUrl?: string;
};

export type UserPreferences = {
  theme: ThemePreference;
  accent: string;
  scale: number;
  autoloadLatest: boolean;
  audioVolume: number;
  audioLoop: boolean;
  audioOutputDeviceId: string;
};

export type LocalDatabase = {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  signals: SignalRecord[];
  tags: string[];
  documents: SignalDocument[];
};

export type WorkspaceState = {
  schemaVersion: number;
  activeDatabaseId: string;
  sigidOverrides: Record<string, SignalRecord>;
  sigidAdditions: SignalRecord[];
  deletedSigidIds: string[];
  sigidTags: string[];
  sigidDocuments: SignalDocument[];
  databases: LocalDatabase[];
  preferences: UserPreferences;
  bookmarks: string[];
};

export type DatabaseStats = {
  signals: number;
  documents: number;
  images: number;
  audio: number;
  tags: number;
};

export const DEFAULT_PREFERENCES: Readonly<UserPreferences> = Object.freeze({
  theme: "system",
  accent: "Green",
  scale: 1,
  autoloadLatest: false,
  audioVolume: 0.5,
  audioLoop: false,
  audioOutputDeviceId: "",
});

export function bookmarkKey(databaseId: string, signalId: string) {
  return `${databaseId}::${signalId}`;
}

export function createDefaultWorkspace(): WorkspaceState {
  return {
    schemaVersion: CURRENT_WORKSPACE_SCHEMA,
    activeDatabaseId: SIGID_DATABASE_ID,
    sigidOverrides: {},
    sigidAdditions: [],
    deletedSigidIds: [],
    sigidTags: [],
    sigidDocuments: [],
    databases: [],
    preferences: { ...DEFAULT_PREFERENCES },
    bookmarks: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function cleanText(value: unknown, maxLength = MAX_SHORT_TEXT) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function cleanId(value: unknown, fallback = "") {
  const id = cleanText(value, 128).trim();
  if (!id || id === "__proto__" || id === "prototype" || id === "constructor") return fallback;
  return id;
}

function uniqueStrings(value: unknown, limit: number, maxLength = MAX_SHORT_TEXT) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = cleanText(item, maxLength).trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      result.push(text);
      if (result.length >= limit) break;
    }
  }
  return result;
}

function normalizeBookmarks(value: unknown) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const separator = item.indexOf("::");
    const databaseId = separator >= 0 ? cleanId(item.slice(0, separator)) : SIGID_DATABASE_ID;
    const signalId = cleanId(separator >= 0 ? item.slice(separator + 2) : item);
    if (!databaseId || !signalId) continue;
    const key = bookmarkKey(databaseId, signalId);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

function normalizeDatum(value: unknown): Datum | null {
  if (!isRecord(value)) return null;
  const rawValue = value.value;
  if (typeof rawValue !== "string" && typeof rawValue !== "number") return null;
  if (typeof rawValue === "number" && !Number.isFinite(rawValue)) return null;
  return {
    value: typeof rawValue === "string" ? cleanText(rawValue, MAX_SHORT_TEXT) : rawValue,
    description: cleanText(value.description, MAX_DESCRIPTION),
  };
}

function normalizeData(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeDatum).filter((item): item is Datum => item !== null);
}

function normalizeSignal(value: unknown, fallbackId = ""): SignalRecord | null {
  if (!isRecord(value)) return null;
  const pageid = cleanId(value.pageid, fallbackId);
  const title = cleanText(value.title, MAX_SHORT_TEXT).trim();
  if (!pageid || !title) return null;

  const spectrum = isRecord(value.spectrum)
    ? { filename: cleanText(value.spectrum.filename), url: cleanText(value.spectrum.url, 4_096) }
    : null;
  const audio = isRecord(value.audio)
    ? { filename: cleanText(value.audio.filename), url: cleanText(value.audio.url, 4_096) }
    : null;

  return {
    pageid,
    title,
    added_since: Math.round(finiteNumber(value.added_since, 1, 0, 1_000_000)),
    spectrum,
    audio,
    category: uniqueStrings(value.category, Number.MAX_SAFE_INTEGER),
    frequency: normalizeData(value.frequency),
    bandwidth: normalizeData(value.bandwidth),
    acf: normalizeData(value.acf),
    modulation: normalizeData(value.modulation),
    mode: normalizeData(value.mode),
    location: normalizeData(value.location),
    "short description": cleanText(value["short description"], MAX_DESCRIPTION),
    description: cleanText(value.description, MAX_DESCRIPTION),
    ...(value.custom === true ? { custom: true } : {}),
  };
}

function normalizeSignals(value: unknown, limit = Number.MAX_SAFE_INTEGER) {
  if (!Array.isArray(value)) return [];
  const result: SignalRecord[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const signal = normalizeSignal(item);
    if (signal && !seen.has(signal.pageid)) {
      seen.add(signal.pageid);
      result.push(signal);
      if (result.length >= limit) break;
    }
  }
  return result;
}

function documentType(value: unknown): DocumentType {
  return value === "Image" || value === "Audio" || value === "Document" || value === "Other"
    ? value
    : "Other";
}

function safeDataUrl(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_DATA_URL_LENGTH) return undefined;
  // Keep only encoded payloads. Plain-text data URLs can contain executable markup.
  return /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+(?:;[a-z0-9=.+-]+)*;base64,[a-z0-9+/=\s]+$/i.test(value)
    ? value
    : undefined;
}

function normalizeDocument(value: unknown): SignalDocument | null {
  if (!isRecord(value)) return null;
  const id = cleanId(value.id);
  const signalId = cleanId(value.signalId);
  const fileName = cleanText(value.fileName).trim();
  if (!id || !signalId || !fileName) return null;
  const dataUrl = safeDataUrl(value.dataUrl);
  return {
    id,
    signalId,
    fileName,
    name: cleanText(value.name).trim() || fileName,
    description: cleanText(value.description, MAX_DESCRIPTION),
    type: documentType(value.type),
    preview: Boolean(value.preview),
    mime: cleanText(value.mime, 255).toLowerCase(),
    ...(dataUrl ? { dataUrl } : {}),
  };
}

function normalizeDocuments(value: unknown) {
  if (!Array.isArray(value)) return [];
  const result: SignalDocument[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const document = normalizeDocument(item);
    if (document && !seen.has(document.id)) {
      seen.add(document.id);
      result.push(document);
    }
  }
  return result;
}

function isoDate(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeDatabase(value: unknown, fallbackId = ""): LocalDatabase | null {
  if (!isRecord(value)) return null;
  const id = cleanId(value.id, fallbackId);
  const name = cleanText(value.name).trim();
  if (!id || id === SIGID_DATABASE_ID || !name) return null;
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString());
  return {
    id,
    name,
    version: Math.round(finiteNumber(value.version, 1, 1, 1_000_000)),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    signals: normalizeSignals(value.signals),
    tags: uniqueStrings(value.tags, Number.MAX_SAFE_INTEGER),
    documents: normalizeDocuments(value.documents),
  };
}

function normalizePreferences(value: unknown): UserPreferences {
  const input = isRecord(value) ? value : {};
  const theme: ThemePreference = input.theme === "light" || input.theme === "dark" ? input.theme : "system";
  return {
    theme,
    accent: cleanText(input.accent, 64).trim() || DEFAULT_PREFERENCES.accent,
    scale: finiteNumber(input.scale, DEFAULT_PREFERENCES.scale, 0.5, 1.5),
    autoloadLatest: typeof input.autoloadLatest === "boolean"
      ? input.autoloadLatest
      : DEFAULT_PREFERENCES.autoloadLatest,
    audioVolume: finiteNumber(input.audioVolume, DEFAULT_PREFERENCES.audioVolume, 0, 1),
    audioLoop: Boolean(input.audioLoop),
    audioOutputDeviceId: cleanText(input.audioOutputDeviceId, 512),
  };
}

export function normalizeWorkspace(value: unknown): WorkspaceState {
  const defaults = createDefaultWorkspace();
  if (!isRecord(value)) return defaults;

  const databases: LocalDatabase[] = [];
  const databaseIds = new Set<string>();
  if (Array.isArray(value.databases)) {
    for (const item of value.databases) {
      const database = normalizeDatabase(item);
      if (database && !databaseIds.has(database.id)) {
        databaseIds.add(database.id);
        databases.push(database);
      }
    }
  }

  // Schema 0 appended customSignals to the bundled SigID catalog.
  const legacySignals = normalizeSignals(value.customSignals);

  const sigidOverrides: Record<string, SignalRecord> = {};
  if (isRecord(value.sigidOverrides)) {
    for (const [key, item] of Object.entries(value.sigidOverrides)) {
      const id = cleanId(key);
      const signal = normalizeSignal(item, id);
      if (id && signal) sigidOverrides[id] = { ...signal, pageid: id };
    }
  }

  const requestedActiveId = cleanId(value.activeDatabaseId, SIGID_DATABASE_ID);
  const activeDatabaseId = requestedActiveId === SIGID_DATABASE_ID || databaseIds.has(requestedActiveId)
    ? requestedActiveId
    : SIGID_DATABASE_ID;

  return {
    schemaVersion: CURRENT_WORKSPACE_SCHEMA,
    activeDatabaseId,
    sigidOverrides,
    sigidAdditions: normalizeSignals(
      Array.isArray(value.sigidAdditions) ? [...value.sigidAdditions, ...legacySignals] : legacySignals,
    ),
    deletedSigidIds: uniqueStrings(value.deletedSigidIds, Number.MAX_SAFE_INTEGER, 128),
    sigidTags: uniqueStrings(value.sigidTags, Number.MAX_SAFE_INTEGER),
    sigidDocuments: normalizeDocuments(value.sigidDocuments),
    databases,
    preferences: normalizePreferences(value.preferences),
    bookmarks: normalizeBookmarks(value.bookmarks),
  };
}

export function resolveActiveSignals(workspace: WorkspaceState, sigidSignals: SignalRecord[]) {
  const state = normalizeWorkspace(workspace);
  if (state.activeDatabaseId !== SIGID_DATABASE_ID) {
    return state.databases.find((database) => database.id === state.activeDatabaseId)?.signals ?? [];
  }

  const deletedIds = new Set(state.deletedSigidIds);
  const seen = new Set<string>();
  const signals: SignalRecord[] = [];
  for (const baseSignal of sigidSignals) {
    if (deletedIds.has(baseSignal.pageid) || seen.has(baseSignal.pageid)) continue;
    const replacement = state.sigidOverrides[baseSignal.pageid];
    signals.push(replacement ?? baseSignal);
    seen.add(baseSignal.pageid);
  }
  for (const addition of state.sigidAdditions) {
    if (!deletedIds.has(addition.pageid) && !seen.has(addition.pageid)) {
      signals.push(addition);
      seen.add(addition.pageid);
    }
  }
  return signals;
}

export function getDatabaseStats(database: LocalDatabase): DatabaseStats {
  const normalized = normalizeDatabase(database);
  if (!normalized) return { signals: 0, documents: 0, images: 0, audio: 0, tags: 0 };
  return {
    signals: normalized.signals.length,
    documents: normalized.documents.length,
    images: normalized.documents.filter((document) => document.type === "Image").length,
    audio: normalized.documents.filter((document) => document.type === "Audio").length,
    tags: normalized.tags.length,
  };
}

function utf8Bytes(value: string) {
  return typeof TextEncoder === "undefined" ? value.length : new TextEncoder().encode(value).byteLength;
}

function assertText(value: unknown, label: string, maxLength = MAX_SHORT_TEXT, allowEmpty = true) {
  if (typeof value !== "string" || value.length > maxLength || (!allowEmpty && !value.trim())) {
    throw new Error(`${label} is invalid or too long.`);
  }
}

function assertStringList(value: unknown, label: string, limit: number, allowDuplicates = false) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > limit) throw new Error(`${label} exceeds the ${limit.toLocaleString()} item limit.`);
  const seen = new Set<string>();
  for (const item of value) {
    assertText(item, label);
    if (!allowDuplicates && seen.has(item)) throw new Error(`${label} contains duplicate values.`);
    seen.add(item);
  }
}

function assertSignalList(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > MAX_SIGNALS_PER_DATABASE) {
    throw new Error(`${label} exceeds the ${MAX_SIGNALS_PER_DATABASE.toLocaleString()} signal limit.`);
  }
  const ids = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) throw new Error(`${label} contains an invalid signal.`);
    const id = cleanId(item.pageid);
    if (!id) throw new Error(`${label} contains a signal without a valid ID.`);
    if (ids.has(id)) throw new Error(`${label} contains duplicate signal ID ${id}.`);
    ids.add(id);
    assertText(item.title, `${label} signal title`, MAX_SHORT_TEXT, false);
    assertText(item["short description"], `${label} short description`, MAX_DESCRIPTION);
    assertText(item.description, `${label} description`, MAX_DESCRIPTION);
    if (!Number.isFinite(Number(item.added_since))) throw new Error(`${label} signal ${id} has an invalid database version.`);
    // The upstream SigID data contains a few duplicate category joins; they are semantically a set.
    assertStringList(item.category, `${label} signal ${id} categories`, MAX_TAGS_PER_DATABASE, true);
    for (const field of ["frequency", "bandwidth", "acf", "modulation", "mode", "location"] as const) {
      const data = item[field];
      if (!Array.isArray(data)) throw new Error(`${label} signal ${id} ${field} must be an array.`);
      if (data.length > MAX_VALUES_PER_PARAMETER) {
        throw new Error(`${label} signal ${id} ${field} exceeds the ${MAX_VALUES_PER_PARAMETER.toLocaleString()} value limit.`);
      }
      if (normalizeData(data).length !== data.length) throw new Error(`${label} signal ${id} contains an invalid ${field} value.`);
      for (const datum of data) {
        if (isRecord(datum) && typeof datum.value === "string") {
          assertText(datum.value, `${label} signal ${id} ${field} value`, MAX_SHORT_TEXT);
        }
        if (isRecord(datum) && datum.description !== undefined) {
          assertText(datum.description, `${label} signal ${id} ${field} description`, MAX_DESCRIPTION);
        }
      }
    }
    for (const assetField of ["spectrum", "audio"] as const) {
      const asset = item[assetField];
      if (asset !== undefined && asset !== null) {
        if (!isRecord(asset)) throw new Error(`${label} signal ${id} has invalid ${assetField} metadata.`);
        if (asset.filename !== undefined && asset.filename !== null) {
          assertText(asset.filename, `${label} signal ${id} ${assetField} file name`);
        }
        if (asset.url !== undefined && asset.url !== null) {
          assertText(asset.url, `${label} signal ${id} ${assetField} URL`, 4_096);
        }
      }
    }
  }
  return ids;
}

function assertDocumentList(value: unknown, label: string, signalIds: Set<string> | null) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  if (value.length > MAX_DOCUMENTS_PER_DATABASE) {
    throw new Error(`${label} exceeds the ${MAX_DOCUMENTS_PER_DATABASE.toLocaleString()} document limit.`);
  }
  const ids = new Set<string>();
  const mainPreviews = new Set<string>();
  for (const item of value) {
    if (!isRecord(item)) throw new Error(`${label} contains an invalid document.`);
    const document = normalizeDocument(item);
    if (!document) throw new Error(`${label} contains a document without a valid ID, signal, or file name.`);
    if (ids.has(document.id)) throw new Error(`${label} contains duplicate document ID ${document.id}.`);
    ids.add(document.id);
    if (signalIds && !signalIds.has(document.signalId)) {
      throw new Error(`${label} document ${document.id} refers to a signal that is not in the database.`);
    }
    if (item.type !== "Image" && item.type !== "Audio" && item.type !== "Document" && item.type !== "Other") {
      throw new Error(`${label} document ${document.id} has an invalid type.`);
    }
    if (typeof item.preview !== "boolean") throw new Error(`${label} document ${document.id} has an invalid preview flag.`);
    assertText(item.fileName, `${label} document file name`, MAX_SHORT_TEXT, false);
    assertText(item.name, `${label} document name`, MAX_SHORT_TEXT, false);
    assertText(item.description, `${label} document description`, MAX_DESCRIPTION);
    assertText(item.mime, `${label} document MIME type`, 255);
    if (item.dataUrl !== undefined && safeDataUrl(item.dataUrl) === undefined) {
      throw new Error(`${label} document ${document.id} has an invalid or oversized file payload.`);
    }
    if (item.id !== document.id || item.signalId !== document.signalId || item.fileName !== document.fileName
      || item.name !== document.name || item.description !== document.description || item.type !== document.type
      || item.preview !== document.preview || item.mime !== document.mime
      || (item.dataUrl !== undefined && item.dataUrl !== document.dataUrl)) {
      throw new Error(`${label} document ${document.id} cannot be normalized without changing its metadata or payload.`);
    }
    if (document.preview) {
      if (document.type !== "Image" && document.type !== "Audio") {
        throw new Error(`${label} document ${document.id} cannot be a main preview.`);
      }
      const mainKey = `${document.signalId}::${document.type}`;
      if (mainPreviews.has(mainKey)) throw new Error(`${label} has more than one main ${document.type.toLocaleLowerCase()} for a signal.`);
      mainPreviews.add(mainKey);
    }
  }
}

function assertDatabaseShape(value: unknown): asserts value is Record<string, unknown> & { signals: unknown[]; documents: unknown[]; tags: unknown[] } {
  if (!isRecord(value)) throw new Error("Database bundle does not contain a database object.");
  if (!cleanId(value.id) || !cleanText(value.name).trim()) throw new Error("Database bundle is missing an ID or name.");
  if (value.id === SIGID_DATABASE_ID) throw new Error("A local database cannot use the reserved SigID database ID.");
  assertText(value.name, "Database name", MAX_SHORT_TEXT, false);
  if (!Number.isFinite(Number(value.version))) throw new Error("Database version is invalid.");
  if (typeof value.createdAt !== "string" || Number.isNaN(new Date(value.createdAt).getTime())) throw new Error("Database creation date is invalid.");
  if (typeof value.updatedAt !== "string" || Number.isNaN(new Date(value.updatedAt).getTime())) throw new Error("Database update date is invalid.");
  assertStringList(value.tags, "Database tags", MAX_TAGS_PER_DATABASE);
  const signalIds = assertSignalList(value.signals, "Database signals");
  assertDocumentList(value.documents, "Database documents", signalIds);
}

function assertWorkspacePersistable(value: unknown) {
  if (!isRecord(value)) throw new Error("Workspace state is invalid.");
  if (!Array.isArray(value.databases)) throw new Error("Workspace databases must be an array.");
  if (value.databases.length > MAX_DATABASES) throw new Error(`Workspace exceeds the ${MAX_DATABASES} database limit.`);
  const databaseIds = new Set<string>();
  for (const database of value.databases) {
    assertDatabaseShape(database);
    const id = cleanId(database.id);
    if (databaseIds.has(id)) throw new Error(`Workspace contains duplicate database ID ${id}.`);
    databaseIds.add(id);
  }
  const activeDatabaseId = cleanId(value.activeDatabaseId);
  if (activeDatabaseId !== SIGID_DATABASE_ID && !databaseIds.has(activeDatabaseId)) {
    throw new Error("The active workspace database does not exist.");
  }
  const additions = assertSignalList(value.sigidAdditions, "SigID additions");
  if (!isRecord(value.sigidOverrides)) throw new Error("SigID overrides are invalid.");
  const overrideEntries = Object.entries(value.sigidOverrides);
  if (overrideEntries.length > MAX_SIGNALS_PER_DATABASE) throw new Error("SigID overrides exceed the signal limit.");
  assertSignalList(overrideEntries.map(([, signal]) => signal), "SigID overrides");
  for (const [id, signal] of overrideEntries) {
    if (!isRecord(signal) || cleanId(id) !== cleanId(signal.pageid)) throw new Error("A SigID override key does not match its signal ID.");
  }
  assertStringList(value.deletedSigidIds, "Deleted SigID IDs", MAX_SIGNALS_PER_DATABASE);
  assertStringList(value.sigidTags, "SigID tags", MAX_TAGS_PER_DATABASE);
  assertDocumentList(value.sigidDocuments, "SigID documents", null);
  if (!Array.isArray(value.bookmarks) || value.bookmarks.length > MAX_SIGNALS_PER_DATABASE) {
    throw new Error("Workspace bookmarks exceed the signal limit.");
  }
  for (const bookmark of value.bookmarks) assertText(bookmark, "Workspace bookmark", 258, false);
  // Touch the set so additions are validated for duplicates even when there are no documents.
  void additions;
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("Workspace state cannot be serialized.");
  }
  if (utf8Bytes(serialized) > WORKSPACE_PERSISTENCE_BYTE_LIMIT) {
    throw new Error("Workspace exceeds the 64 MiB persistence limit. Export or remove stored files before continuing.");
  }
}

export function validateWorkspace(value: unknown): WorkspaceState {
  assertWorkspacePersistable(value);
  const normalized = normalizeWorkspace(value);
  assertWorkspacePersistable(normalized);
  return normalized;
}

export function exportDatabaseBundle(database: LocalDatabase) {
  assertDatabaseShape(database);
  const normalized = normalizeDatabase(database);
  if (!normalized || normalized.signals.length !== database.signals.length
    || normalized.documents.length !== database.documents.length) {
    throw new Error("Cannot export a database with invalid or duplicate records.");
  }
  const databaseJson = JSON.stringify(normalized);
  if (utf8Bytes(databaseJson) > WORKSPACE_PERSISTENCE_BYTE_LIMIT) {
    throw new Error("Database exceeds the 64 MiB persistence and export limit.");
  }
  const bundle = JSON.stringify({
    format: "artemis-database",
    schemaVersion: CURRENT_WORKSPACE_SCHEMA,
    exportedAt: new Date().toISOString(),
    database: normalized,
  });
  if (utf8Bytes(bundle) > DATABASE_BUNDLE_BYTE_LIMIT) throw new Error("Database bundle exceeds the 65 MiB export limit.");
  return bundle;
}

export function importDatabaseBundle(bundle: string): LocalDatabase {
  if (typeof bundle !== "string" || utf8Bytes(bundle) > DATABASE_BUNDLE_BYTE_LIMIT) {
    throw new Error("Database bundle exceeds the 65 MiB import limit.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bundle);
  } catch {
    throw new Error("Database bundle is not valid JSON.");
  }
  if (!isRecord(parsed) || parsed.format !== "artemis-database") {
    throw new Error("File is not an Artemis database bundle.");
  }
  if (finiteNumber(parsed.schemaVersion, 0, 0, Number.MAX_SAFE_INTEGER) > CURRENT_WORKSPACE_SCHEMA) {
    throw new Error("Database bundle was created by a newer Artemis workspace version.");
  }
  assertDatabaseShape(parsed.database);
  const database = normalizeDatabase(parsed.database);
  if (!database || database.signals.length !== parsed.database.signals.length
    || database.documents.length !== parsed.database.documents.length
    || database.tags.length !== parsed.database.tags.length) {
    throw new Error("Database bundle cannot be imported without losing records.");
  }
  if (utf8Bytes(JSON.stringify(database)) > WORKSPACE_PERSISTENCE_BYTE_LIMIT) {
    throw new Error("Database exceeds the 64 MiB persistence and import limit.");
  }
  return database;
}

function browserLocalStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function indexedDatabase() {
  return typeof window !== "undefined" && "indexedDB" in window ? window.indexedDB : null;
}

type StoredWorkspaceEnvelope = {
  format: "artemis-workspace-storage";
  storageVersion: 1;
  revision: number;
  savedAt: string;
  workspace: WorkspaceState;
};

type StoredCandidate = {
  envelope: StoredWorkspaceEnvelope;
  source: "indexedDB" | "localStorage";
};

// Every browser tab has its own module instance. Remembering the revision this
// instance loaded or saved lets us refuse to overwrite a newer durable copy
// written by another tab.
let observedWorkspaceRevision: number | null = null;

function decodeStoredWorkspace(value: unknown, source: StoredCandidate["source"]): StoredCandidate | null {
  if (value === undefined || value === null) return null;
  if (isRecord(value) && value.format === "artemis-workspace-storage" && isRecord(value.workspace)) {
    const revision = Number(value.revision);
    const savedAt = typeof value.savedAt === "string" && !Number.isNaN(new Date(value.savedAt).getTime())
      ? new Date(value.savedAt).toISOString()
      : new Date(0).toISOString();
    return {
      source,
      envelope: {
        format: "artemis-workspace-storage",
        storageVersion: 1,
        revision: Number.isSafeInteger(revision) && revision >= 0 ? revision : 0,
        savedAt,
        workspace: normalizeWorkspace(value.workspace),
      },
    };
  }
  return {
    source,
    envelope: {
      format: "artemis-workspace-storage",
      storageVersion: 1,
      revision: 0,
      savedAt: new Date(0).toISOString(),
      workspace: normalizeWorkspace(value),
    },
  };
}

function newerCandidate(first: StoredCandidate | null, second: StoredCandidate | null) {
  if (!first) return second;
  if (!second) return first;
  if (first.envelope.revision !== second.envelope.revision) {
    return first.envelope.revision > second.envelope.revision ? first : second;
  }
  const firstTime = new Date(first.envelope.savedAt).getTime();
  const secondTime = new Date(second.envelope.savedAt).getTime();
  if (firstTime !== secondTime) return firstTime > secondTime ? first : second;
  // A local fallback exists specifically because its IndexedDB write failed; prefer it on a legacy tie.
  return second.source === "localStorage" ? second : first;
}

function openWorkspaceDatabase(): Promise<IDBDatabase> {
  const indexedDB = indexedDatabase();
  if (!indexedDB) return Promise.reject(new Error("IndexedDB is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB_NAME, INDEXED_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(INDEXED_DB_STORE)) database.createObjectStore(INDEXED_DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the Artemis workspace."));
    request.onblocked = () => reject(new Error("The Artemis workspace database is blocked by another tab."));
  });
}

async function loadFromIndexedDB() {
  const database = await openWorkspaceDatabase();
  try {
    return await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(INDEXED_DB_STORE, "readonly");
      const request = transaction.objectStore(INDEXED_DB_STORE).get(INDEXED_DB_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not read the Artemis workspace."));
    });
  } finally {
    database.close();
  }
}

async function saveToIndexedDB(value: unknown) {
  const database = await openWorkspaceDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(INDEXED_DB_STORE, "readwrite");
      transaction.objectStore(INDEXED_DB_STORE).put(value, INDEXED_DB_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save the Artemis workspace."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Saving the Artemis workspace was aborted."));
    });
  } finally {
    database.close();
  }
}

function loadLocalFallback() {
  const storage = browserLocalStorage();
  if (!storage) return null;
  try {
    const current = storage.getItem(LOCAL_STORAGE_KEY);
    if (current) return JSON.parse(current) as unknown;

    const bookmarks = JSON.parse(storage.getItem("artemis-saved") || "[]") as unknown;
    const customSignals = JSON.parse(storage.getItem("artemis-custom-signals") || "[]") as unknown;
    if ((Array.isArray(bookmarks) && bookmarks.length) || (Array.isArray(customSignals) && customSignals.length)) {
      return { schemaVersion: 0, bookmarks, customSignals };
    }
  } catch {
    // Corrupt or unavailable localStorage should not prevent the app from loading.
  }
  return null;
}

function clearLocalFallbackThrough(revision: number) {
  const storage = browserLocalStorage();
  if (!storage) return;
  try {
    const current = storage.getItem(LOCAL_STORAGE_KEY);
    if (!current) return;
    const candidate = decodeStoredWorkspace(JSON.parse(current), "localStorage");
    if (!candidate || candidate.envelope.revision <= revision) storage.removeItem(LOCAL_STORAGE_KEY);
  } catch {
    storage.removeItem(LOCAL_STORAGE_KEY);
  }
}

export async function loadWorkspace(): Promise<WorkspaceState> {
  if (typeof window === "undefined") return createDefaultWorkspace();
  let indexedValue: unknown;
  try {
    indexedValue = await loadFromIndexedDB();
  } catch {
    indexedValue = undefined;
  }
  const fallbackValue = loadLocalFallback();
  const indexedCandidate = decodeStoredWorkspace(indexedValue, "indexedDB");
  const localCandidate = decodeStoredWorkspace(fallbackValue, "localStorage");
  const chosen = newerCandidate(indexedCandidate, localCandidate);
  if (!chosen) {
    observedWorkspaceRevision = 0;
    return createDefaultWorkspace();
  }

  observedWorkspaceRevision = chosen.envelope.revision;

  if (chosen.source === "localStorage") {
    try {
      await saveToIndexedDB(chosen.envelope);
      clearLocalFallbackThrough(chosen.envelope.revision);
    } catch {
      // localStorage remains the durable copy.
    }
  }
  return chosen.envelope.workspace;
}

export async function saveWorkspace(workspace: WorkspaceState): Promise<void> {
  const normalized = validateWorkspace(workspace);
  if (typeof window === "undefined") return;

  let indexedValue: unknown;
  try {
    indexedValue = await loadFromIndexedDB();
  } catch {
    indexedValue = undefined;
  }
  const existing = newerCandidate(
    decodeStoredWorkspace(indexedValue, "indexedDB"),
    decodeStoredWorkspace(loadLocalFallback(), "localStorage"),
  );
  const durableRevision = existing?.envelope.revision ?? 0;
  if (observedWorkspaceRevision === null) {
    // Preserve the existing API for callers that save before their first load.
    observedWorkspaceRevision = durableRevision;
  } else if (durableRevision !== observedWorkspaceRevision) {
    throw new Error("The Artemis workspace changed in another tab. Reload before saving.");
  }
  const envelope: StoredWorkspaceEnvelope = {
    format: "artemis-workspace-storage",
    storageVersion: 1,
    revision: durableRevision + 1,
    savedAt: new Date().toISOString(),
    workspace: normalized,
  };
  try {
    await saveToIndexedDB(envelope);
    clearLocalFallbackThrough(envelope.revision);
    observedWorkspaceRevision = envelope.revision;
    return;
  } catch {
    const storage = browserLocalStorage();
    if (!storage) throw new Error("This browser does not provide workspace storage.");
    try {
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(envelope));
      observedWorkspaceRevision = envelope.revision;
    } catch {
      throw new Error("The Artemis workspace could not be saved. Browser storage may be full.");
    }
  }
}
