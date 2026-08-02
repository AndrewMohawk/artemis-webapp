import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Artemis signal workspace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Artemis — RF Signal Reference<\/title>/i);
  assert.match(html, /CATALOG LOADING/);
  assert.match(html, /Category \/ tag/);
  assert.match(html, /Bandwidth/);
  assert.match(html, /ACF/);
  assert.match(html, /DB version/);
  assert.match(html, /Matches any checked option within a filter/);
  assert.ok((html.match(/signal-list-item/g) || []).length <= 30, "the server should render a virtualized result window");
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("contains finished metadata and no disposable preview surface", async () => {
  const [page, managers, weather, layout, packageJson, signalRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/artemis-managers.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/space-weather.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/signals/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /FullDatabaseManager/);
  assert.match(page, /FullSignalEditor/);
  assert.match(page, /FullDocumentsManager/);
  assert.match(page, /FullPreferences/);
  assert.match(page, /AudioPlayer/);
  assert.match(managers, /export function DatabaseManagerModal/);
  assert.match(managers, /export function DocumentsManagerModal/);
  assert.match(managers, /export function TagManagerModal/);
  assert.match(weather, /label: "Current"[\s\S]*label: "Forecasts"[\s\S]*label: "DRAP"[\s\S]*label: "Aurora"[\s\S]*label: "SSA"[\s\S]*label: "Sun Imagers"/);
  assert.match(signalRoute, /signals\.json/);
  assert.match(layout, /og\.png/);
  assert.match(layout, /Artemis — RF Signal Reference/);
  assert.match(packageJson, /"name": "artemis-rf-reference"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app\/_sites-preview", projectRoot)));
});

test("ships the responsive custom audio-player styles", async () => {
  const [component, styles] = await Promise.all([
    readFile(new URL("../app/components/audio-player.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/audio-player.css", import.meta.url), "utf8"),
  ]);

  assert.match(component, /import "\.\.\/audio-player\.css";/);
  assert.match(component, /className="audio-source-name"/);
  assert.match(styles, /grid-template-areas:[\s\S]*"play stop loop \. settings"/);
  assert.match(styles, /text-overflow:\s*ellipsis/);
});
