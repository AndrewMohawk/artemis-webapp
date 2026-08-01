import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSignalIndex,
  countActiveFilterGroups,
  createDefaultFilters,
  filterSignals,
} from "../app/lib/signal-filters.ts";

const signals = JSON.parse(await readFile(new URL("../app/data/signals.json", import.meta.url), "utf8"));
const index = buildSignalIndex(signals);
const bookmarks = new Set();

function apply(filters, query = "") {
  return filterSignals({
    signals,
    index,
    query,
    filters,
    savedOnly: false,
    bookmarks,
  });
}

test("ACF matches an exact Artemis millisecond value", () => {
  const filters = createDefaultFilters();
  filters.acf = { active: true, value: "106.66", unit: "ms", tolerance: 0 };
  const result = apply(filters);
  assert.ok(result.some((signal) => signal.title === "STANAG 4285"));
  assert.equal(countActiveFilterGroups(filters), 1);
});

test("facet selections are OR within a group and AND across groups", () => {
  const filters = createDefaultFilters();
  filters.categories = ["Military", "Radar"];
  filters.modulations = ["PSK"];
  const result = apply(filters);
  assert.ok(result.length > 0);
  assert.ok(result.every((signal) => signal.category.some((value) => filters.categories.includes(value))));
  assert.ok(result.every((signal) => signal.modulation.some((item) => item.value === "PSK")));
  assert.equal(countActiveFilterGroups(filters), 2);
});

test("frequency tolerance checks recorded values rather than the outer min/max span", () => {
  const filters = createDefaultFilters();
  filters.frequency = { active: true, value: "1.89", unit: "MHz", tolerance: 0 };
  const result = apply(filters);
  assert.ok(result.some((signal) => signal.title === "STANAG 4285"));
  assert.ok(result.every((signal) => signal.frequency.some((item) => item.value === 1_890_000)));
});

test("database versions use only real dataset values", () => {
  const versions = [...new Set(signals.map((signal) => signal.added_since))].sort((a, b) => a - b);
  assert.deepEqual(versions, [65, 70, 71, 72, 73, 74]);
});
