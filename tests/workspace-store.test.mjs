import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_WORKSPACE_SCHEMA,
  bookmarkKey,
  createDefaultWorkspace,
  exportDatabaseBundle,
  getDatabaseStats,
  importDatabaseBundle,
  loadWorkspace,
  normalizeWorkspace,
  resolveActiveSignals,
  saveWorkspace,
} from "../app/lib/workspace-store.ts";

function signal(pageid, title) {
  return {
    pageid,
    title,
    added_since: 74,
    spectrum: null,
    audio: null,
    category: [],
    frequency: [],
    bandwidth: [],
    acf: [],
    modulation: [],
    mode: [],
    location: [],
    "short description": "",
    description: "",
  };
}

test("creates an isolated default workspace and is SSR safe", async () => {
  const first = createDefaultWorkspace();
  const second = createDefaultWorkspace();
  first.preferences.theme = "dark";
  assert.equal(second.preferences.theme, "system");
  assert.equal(second.schemaVersion, CURRENT_WORKSPACE_SCHEMA);
  assert.deepEqual(await loadWorkspace(), second);
  await assert.doesNotReject(saveWorkspace(second));
});

test("migrates legacy custom signals as SigID additions and clamps preferences", () => {
  const workspace = normalizeWorkspace({
    schemaVersion: 0,
    customSignals: [signal("local-1", "Local signal")],
    bookmarks: ["one", "one", "two"],
    preferences: { theme: "unsafe", scale: 99, audioVolume: -5 },
  });
  assert.equal(workspace.databases.length, 0);
  assert.equal(workspace.sigidAdditions[0].pageid, "local-1");
  assert.deepEqual(workspace.bookmarks, [bookmarkKey("sigid", "one"), bookmarkKey("sigid", "two")]);
  assert.equal(workspace.preferences.theme, "system");
  assert.equal(workspace.preferences.scale, 1.5);
  assert.equal(workspace.preferences.audioVolume, 0);
});

test("resolves SigID overrides, additions, and deletions", () => {
  const workspace = createDefaultWorkspace();
  workspace.sigidOverrides.one = signal("one", "Overridden");
  workspace.sigidAdditions = [signal("three", "Added")];
  workspace.deletedSigidIds = ["two"];
  workspace.sigidTags = ["Custom tag"];
  assert.deepEqual(
    resolveActiveSignals(workspace, [signal("one", "Original"), signal("two", "Deleted")]).map((item) => item.title),
    ["Overridden", "Added"],
  );
  assert.deepEqual(normalizeWorkspace(workspace).sigidTags, ["Custom tag"]);
});

test("round trips a validated database bundle and reports stats", () => {
  const database = {
    id: "field-notes",
    name: "Field notes",
    version: 2,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T01:00:00.000Z",
    signals: [signal("one", "One")],
    tags: ["HF"],
    documents: [{
      id: "doc-1",
      signalId: "one",
      fileName: "sample.wav",
      name: "Sample",
      description: "",
      type: "Audio",
      preview: true,
      mime: "audio/wav",
    }],
  };
  const imported = importDatabaseBundle(exportDatabaseBundle(database));
  assert.deepEqual(imported, database);
  assert.deepEqual(getDatabaseStats(imported), { signals: 1, documents: 1, images: 0, audio: 1, tags: 1 });
});

test("rejects malformed and future database bundles", () => {
  assert.throws(() => importDatabaseBundle("not json"), /valid JSON/);
  assert.throws(
    () => importDatabaseBundle(JSON.stringify({ format: "artemis-database", schemaVersion: 999, database: {} })),
    /newer Artemis workspace version/,
  );
  assert.throws(
    () => importDatabaseBundle(JSON.stringify({
      format: "artemis-database",
      schemaVersion: 1,
      database: {
        id: "x",
        name: "X",
        version: 1,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: "2026-08-01T00:00:00.000Z",
        signals: [signal("duplicate", "A"), signal("duplicate", "B")],
        tags: [],
        documents: [],
      },
    })),
    /duplicate signal ID/,
  );
});

test("rejects workspace records that would otherwise be silently truncated", async () => {
  const tooManyDatabases = createDefaultWorkspace();
  for (let index = 0; index < 51; index += 1) {
    tooManyDatabases.databases.push({
      id: `db-${index}`,
      name: `Database ${index}`,
      version: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      signals: [],
      tags: [],
      documents: [],
    });
  }
  tooManyDatabases.activeDatabaseId = "db-50";
  await assert.rejects(saveWorkspace(tooManyDatabases), /50 database limit/);

  const invalidPayload = createDefaultWorkspace();
  invalidPayload.sigidDocuments.push({
    id: "doc-invalid",
    signalId: "one",
    fileName: "sample.bin",
    name: "Sample",
    description: "",
    type: "Other",
    preview: false,
    mime: "application/octet-stream",
    dataUrl: "data:text/plain,not-base64",
  });
  await assert.rejects(saveWorkspace(invalidPayload), /invalid or oversized file payload/);
});

function bundleForDocuments(documents) {
  return JSON.stringify({
    format: "artemis-database",
    schemaVersion: 1,
    database: {
      id: "document-test",
      name: "Document test",
      version: 1,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      signals: [signal("one", "One")],
      tags: [],
      documents,
    },
  });
}

function localDocument(id, overrides = {}) {
  return {
    id,
    signalId: "one",
    fileName: `${id}.png`,
    name: id,
    description: "",
    type: "Image",
    preview: false,
    mime: "image/png",
    dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    ...overrides,
  };
}

test("database imports preserve every document and enforce relationships and one main preview", () => {
  const validDocuments = [localDocument("image"), localDocument("audio", {
    fileName: "audio.wav",
    type: "Audio",
    mime: "audio/wav",
    dataUrl: "data:audio/wav;base64,UklGRg==",
    preview: true,
  })];
  const imported = importDatabaseBundle(bundleForDocuments(validDocuments));
  assert.deepEqual(imported.documents, validDocuments);

  assert.throws(
    () => importDatabaseBundle(bundleForDocuments([localDocument("duplicate"), localDocument("duplicate")])),
    /duplicate document ID/,
  );
  assert.throws(
    () => importDatabaseBundle(bundleForDocuments([localDocument("orphan", { signalId: "missing" })])),
    /not in the database/,
  );
  assert.throws(
    () => importDatabaseBundle(bundleForDocuments([
      localDocument("main-one", { preview: true }),
      localDocument("main-two", { preview: true }),
    ])),
    /more than one main image/,
  );
  assert.throws(
    () => importDatabaseBundle(bundleForDocuments([localDocument("payload", { dataUrl: "data:image/png,not-base64" })])),
    /invalid or oversized file payload/,
  );
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function createFakeIndexedDB(initialValue) {
  let stored = initialValue;
  let failWrites = false;
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {},
    transaction: (_store, mode) => {
      const transaction = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => ({
          get: () => {
            const request = { result: undefined, error: null, onsuccess: null, onerror: null };
            queueMicrotask(() => {
              request.result = stored;
              request.onsuccess?.();
            });
            return request;
          },
          put: (value) => {
            queueMicrotask(() => {
              if (failWrites) {
                transaction.error = new Error("simulated IndexedDB write failure");
                transaction.onerror?.();
              } else {
                stored = value;
                transaction.oncomplete?.();
              }
            });
          },
        }),
      };
      assert.ok(mode === "readonly" || mode === "readwrite");
      return transaction;
    },
  };
  return {
    open: () => {
      const request = { result: database, error: null, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
    setFailWrites: (value) => { failWrites = value; },
    setStored: (value) => { stored = value; },
    stored: () => stored,
  };
}

test("a newer local fallback supersedes stale IndexedDB and is promoted back", async () => {
  const originalWindow = globalThis.window;
  const oldWorkspace = createDefaultWorkspace();
  oldWorkspace.bookmarks = [bookmarkKey("sigid", "old")];
  const indexedEnvelope = {
    format: "artemis-workspace-storage",
    storageVersion: 1,
    revision: 1,
    savedAt: "2026-08-01T00:00:00.000Z",
    workspace: oldWorkspace,
  };
  const indexedDB = createFakeIndexedDB(indexedEnvelope);
  const localStorage = createMemoryStorage();
  globalThis.window = { indexedDB, localStorage };
  try {
    const newerWorkspace = createDefaultWorkspace();
    newerWorkspace.bookmarks = [bookmarkKey("sigid", "new")];
    indexedDB.setFailWrites(true);
    await saveWorkspace(newerWorkspace);
    assert.ok(localStorage.getItem("artemis-workspace"));

    indexedDB.setFailWrites(false);
    const loaded = await loadWorkspace();
    assert.deepEqual(loaded.bookmarks, [bookmarkKey("sigid", "new")]);
    assert.equal(localStorage.getItem("artemis-workspace"), null);
    assert.equal(indexedDB.stored().revision, 2);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("saving rejects when another tab advanced the durable workspace", async () => {
  const originalWindow = globalThis.window;
  const loadedWorkspace = createDefaultWorkspace();
  const indexedDB = createFakeIndexedDB({
    format: "artemis-workspace-storage",
    storageVersion: 1,
    revision: 4,
    savedAt: "2026-08-01T00:00:00.000Z",
    workspace: loadedWorkspace,
  });
  globalThis.window = { indexedDB, localStorage: createMemoryStorage() };
  try {
    await loadWorkspace();
    const externalWorkspace = createDefaultWorkspace();
    externalWorkspace.bookmarks = [bookmarkKey("sigid", "external")];
    indexedDB.setStored({
      format: "artemis-workspace-storage",
      storageVersion: 1,
      revision: 5,
      savedAt: "2026-08-01T00:00:01.000Z",
      workspace: externalWorkspace,
    });

    loadedWorkspace.bookmarks = [bookmarkKey("sigid", "local")];
    await assert.rejects(saveWorkspace(loadedWorkspace), /changed in another tab.*Reload/i);
    assert.equal(indexedDB.stored().revision, 5);
    assert.deepEqual(indexedDB.stored().workspace.bookmarks, [bookmarkKey("sigid", "external")]);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
