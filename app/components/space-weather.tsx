"use client";

import {
  CloudSun,
  ExternalLink,
  Gauge,
  ImageOff,
  Info,
  Orbit,
  Radio,
  RefreshCw,
  Sun,
  Waves,
} from "lucide-react";
import React, { useRef, useState } from "react";
import "../space-weather.css";

type ForecastValue = number | string;

type KpForecast = {
  value?: number;
  textual?: string;
  color?: string;
};

type ForecastReport = [number, string];

export type SpaceWeatherData = {
  JSON_INFO?: {
    utc_date?: string;
    utc_time?: string;
    crawler_version?: string;
  };
  AK?: {
    k_index?: number;
    k_index_round?: number;
    a_index?: number;
    exp_noise?: string;
    k_MAX_24h?: number;
  };
  XRAY?: {
    short?: number;
    long?: number;
    peak_flux_class?: string;
    peak_flux_class_3h?: string;
    peak_flux_class_24h?: string;
    peak_flux_24h?: number;
  };
  SGAS?: {
    ssn?: number;
    sfi?: number;
  };
  GSR_SCALES?: {
    G_now?: number;
    S_now?: number;
    R_now?: number;
    G_max24h?: number;
    S_max24h?: number;
    R_max24h?: number;
    G_now_text?: string;
    S_now_text?: string;
    R_now_text?: string;
  };
  PROPAGATION?: {
    MUX?: string;
    EME?: string;
    MS?: string;
    ES_EU_50?: string;
    ES_EU_70?: string;
    ES_EU_144?: string;
    ES_AURORA?: string;
    [key: string]: string | undefined;
  };
  FORCST?: {
    PRE_DATES?: string[];
    CLASS_M?: ForecastValue[];
    CLASS_X?: ForecastValue[];
    CLASS_PROTON?: ForecastValue[];
    GEO_MID_ACTIVE?: ForecastValue[];
    GEO_HIG_ACTIVE?: ForecastValue[];
    GEO_MID_MINOR?: ForecastValue[];
    GEO_HIG_MINOR?: ForecastValue[];
    GEO_MID_MAJOR?: ForecastValue[];
    GEO_HIG_MAJOR?: ForecastValue[];
    SUMMARY?: {
      PRE_DATES?: string[];
      kp?: Record<string, KpForecast[]>;
      S_PROB?: { probS1?: ForecastValue[] };
      R_PROB?: {
        probR1?: ForecastValue[];
        probR3?: ForecastValue[];
      };
      G_REPORT?: ForecastReport;
      S_REPORT?: ForecastReport;
      R_REPORT?: ForecastReport;
    };
  };
  DRAP?: {
    "Recovery Time"?: string;
    "XRay Msg"?: string;
    "XRay Warning"?: string;
    "Proton Msg"?: string;
    "Proton Warning"?: string;
  };
  URL?: {
    SYNOPTIC_MAP?: string;
    AIA_094?: string;
    AIA_131?: string;
    AIA_171?: string;
    AIA_193?: string;
    AIA_304?: string;
    AIA_335?: string;
    AIA_1600?: string;
    AIA_1700?: string;
    AIA_MAGN?: string;
    AIA_INTE?: string;
    AIA_DOPP?: string;
    LASCO_C2?: string;
    LASCO_C3?: string;
    SUVI_THEMATIC?: string;
  };
};

export type SpaceWeatherProps = {
  data: SpaceWeatherData | null;
  loading: boolean;
  onRefresh: () => void;
};

type TabId = "current" | "forecasts" | "drap" | "aurora" | "ssa" | "sun-imagers";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "current", label: "Current" },
  { id: "forecasts", label: "Forecasts" },
  { id: "drap", label: "DRAP" },
  { id: "aurora", label: "Aurora" },
  { id: "ssa", label: "SSA" },
  { id: "sun-imagers", label: "Sun Imagers" },
];

const KP_PERIODS = [
  "00-03UT",
  "03-06UT",
  "06-09UT",
  "09-12UT",
  "12-15UT",
  "15-18UT",
  "18-21UT",
  "21-00UT",
] as const;

const KP_LABELS = [
  "Inactive",
  "Very quiet",
  "Quiet",
  "Unsettled",
  "Active",
  "Minor storm",
  "Moderate storm",
  "Strong storm",
  "Severe storm",
  "Extreme storm",
] as const;

const A_LEVELS = [
  { label: "Quiet", min: 0, max: 7 },
  { label: "Unsettled", min: 8, max: 15 },
  { label: "Active–storm", min: 16, max: 29 },
  { label: "Moderate storm", min: 30, max: 49 },
  { label: "Strong storm", min: 50, max: 99 },
  { label: "Severe storm", min: 100, max: Number.POSITIVE_INFINITY },
] as const;

const PROPAGATION_ITEMS = [
  ["MUX", "Maximum usable frequency"],
  ["EME", "Earth–Moon–Earth"],
  ["MS", "Meteor scatter"],
  ["ES_EU_50", "Sporadic-E · EU 50 MHz"],
  ["ES_EU_70", "Sporadic-E · EU 70 MHz"],
  ["ES_EU_144", "Sporadic-E · EU 144 MHz"],
  ["ES_AURORA", "Aurora spots"],
] as const;

type SunProductKey = Exclude<keyof NonNullable<SpaceWeatherData["URL"]>, "SYNOPTIC_MAP">;

const SUN_PRODUCTS: ReadonlyArray<{
  key: SunProductKey;
  label: string;
  shortLabel: string;
}> = [
  { key: "AIA_094", label: "94 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 94 Å" },
  { key: "AIA_131", label: "131 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 131 Å" },
  { key: "AIA_171", label: "171 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 171 Å" },
  { key: "AIA_193", label: "193 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 193 Å" },
  { key: "AIA_304", label: "304 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 304 Å" },
  { key: "AIA_335", label: "335 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 335 Å" },
  { key: "AIA_1600", label: "1600 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 1600 Å" },
  { key: "AIA_1700", label: "1700 Å · Atmospheric Imaging Assembly", shortLabel: "AIA 1700 Å" },
  { key: "AIA_MAGN", label: "Magnetogram · Helioseismic and Magnetic Imager", shortLabel: "Magnetogram" },
  { key: "AIA_INTE", label: "Intensitygram · Helioseismic and Magnetic Imager", shortLabel: "Intensitygram" },
  { key: "AIA_DOPP", label: "Dopplergram · Helioseismic and Magnetic Imager", shortLabel: "Dopplergram" },
  { key: "LASCO_C2", label: "LASCO C2 · Solar corona", shortLabel: "LASCO C2" },
  { key: "LASCO_C3", label: "LASCO C3 · Solar corona", shortLabel: "LASCO C3" },
  { key: "SUVI_THEMATIC", label: "SUVI thematic map", shortLabel: "Thematic map" },
];

function valueOrDash(value: unknown) {
  return value === undefined || value === null || value === "" ? "—" : String(value);
}

function percent(value: unknown) {
  return value === undefined || value === null || value === "" ? "—" : `${value}%`;
}

function cleanReportText(value?: string) {
  if (!value) return "Details are unavailable for this report.";
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function aLevelIndex(value?: number) {
  if (value === undefined) return -1;
  return A_LEVELS.findIndex((level) => value >= level.min && value <= level.max);
}

function kpSeverity(value?: number) {
  if (value === undefined) return "unknown";
  if (value >= 7) return "severe";
  if (value >= 5) return "storm";
  if (value >= 3) return "active";
  return "quiet";
}

function scaleSeverity(value?: number) {
  if (!value) return "quiet";
  if (value >= 4) return "severe";
  if (value >= 2) return "storm";
  return "active";
}

function imageWithReportToken(url: string | undefined, data: SpaceWeatherData) {
  if (!url) return undefined;
  const token = [data.JSON_INFO?.utc_date, data.JSON_INFO?.utc_time].filter(Boolean).join("-");
  if (!token) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}report=${encodeURIComponent(token)}`;
}

function RemoteImage({ src, alt, label }: { src?: string; alt: string; label: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(src ? "loading" : "error");

  return (
    <figure className="sw-remote-figure">
      <div className="sw-remote-image-wrap" data-state={status}>
        {src ? (
          // These live scientific products are hosted outside this application and cannot use a fixed image allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            onLoad={() => setStatus("ready")}
            onError={() => setStatus("error")}
          />
        ) : null}
        {status === "loading" ? <span className="sw-image-loading">Loading current image…</span> : null}
        {status === "error" ? (
          <div className="sw-image-fallback" role="status">
            <ImageOff aria-hidden="true" size={34} />
            <strong>Image unavailable</strong>
            <span>The provider did not return this product. The report data is still available.</span>
          </div>
        ) : null}
      </div>
      <figcaption>
        <span>{label}</span>
        {src ? (
          <a href={src} target="_blank" rel="noreferrer">
            Open original <ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}

function LoadingPanel() {
  return (
    <div className="sw-initial-loading" role="status">
      <span className="sw-loading-orbit"><Orbit aria-hidden="true" size={28} /></span>
      <strong>Retrieving the current Poseidon report</strong>
      <span>Loading solar, geomagnetic, propagation, forecast, and imagery data…</span>
    </div>
  );
}

function UnavailablePanel({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="sw-unavailable" role="status">
      <CloudSun aria-hidden="true" size={36} />
      <strong>Space weather report unavailable</strong>
      <span>Poseidon could not be reached. Try the live report again.</span>
      <button type="button" onClick={onRefresh}>
        <RefreshCw aria-hidden="true" size={16} /> Try again
      </button>
    </div>
  );
}

function CurrentPanel({ data }: { data: SpaceWeatherData }) {
  const kRounded = data.AK?.k_index_round ?? (data.AK?.k_index === undefined ? undefined : Math.round(data.AK.k_index));
  const currentALevel = aLevelIndex(data.AK?.a_index);
  const scales = [
    {
      letter: "G",
      label: "Geomagnetic storm",
      now: data.GSR_SCALES?.G_now,
      maximum: data.GSR_SCALES?.G_max24h,
      details: data.GSR_SCALES?.G_now_text,
    },
    {
      letter: "S",
      label: "Solar radiation storm",
      now: data.GSR_SCALES?.S_now,
      maximum: data.GSR_SCALES?.S_max24h,
      details: data.GSR_SCALES?.S_now_text,
    },
    {
      letter: "R",
      label: "Radio blackout",
      now: data.GSR_SCALES?.R_now,
      maximum: data.GSR_SCALES?.R_max24h,
      details: data.GSR_SCALES?.R_now_text,
    },
  ];

  return (
    <div className="sw-panel-stack">
      <section className="sw-metric-grid" aria-label="Current space weather metrics">
        <article className="sw-metric sw-metric-featured">
          <span className="sw-metric-icon"><Gauge aria-hidden="true" size={20} /></span>
          <span><small>PLANETARY K-INDEX</small><strong>{valueOrDash(data.AK?.k_index)}</strong></span>
          <em>{kRounded === undefined ? "Awaiting report" : KP_LABELS[Math.max(0, Math.min(9, kRounded))]}</em>
        </article>
        <article className="sw-metric">
          <span className="sw-metric-icon sw-teal"><Sun aria-hidden="true" size={20} /></span>
          <span><small>SOLAR FLUX</small><strong>{valueOrDash(data.SGAS?.sfi)}</strong></span>
          <em>SFI</em>
        </article>
        <article className="sw-metric">
          <span className="sw-metric-icon sw-amber"><Orbit aria-hidden="true" size={20} /></span>
          <span><small>SUNSPOT NUMBER</small><strong>{valueOrDash(data.SGAS?.ssn)}</strong></span>
          <em>SSN</em>
        </article>
        <article className="sw-metric">
          <span className="sw-metric-icon sw-coral"><Radio aria-hidden="true" size={20} /></span>
          <span><small>X-RAY FLUX</small><strong>{valueOrDash(data.XRAY?.peak_flux_class)}</strong></span>
          <em>Current</em>
        </article>
      </section>

      <div className="sw-two-column">
        <section className="sw-card">
          <div className="sw-section-heading">
            <div><small>NOAA SCALES</small><h2>Radio environment</h2></div>
            <CloudSun aria-hidden="true" size={20} />
          </div>
          <div className="sw-scale-grid">
            {scales.map((scale) => (
              <details className="sw-scale-card" data-severity={scaleSeverity(scale.now)} key={scale.letter}>
                <summary>
                  <span className="sw-scale-letter">{scale.letter}{valueOrDash(scale.now)}</span>
                  <span><strong>{scale.label}</strong><small>24h max · {scale.letter}{valueOrDash(scale.maximum)}</small></span>
                  <Info aria-hidden="true" size={16} />
                </summary>
                <p>{cleanReportText(scale.details)}</p>
              </details>
            ))}
          </div>
          <div className="sw-noise-callout">
            <Radio aria-hidden="true" size={17} />
            <span><small>EXPECTED HF NOISE</small><strong>{valueOrDash(data.AK?.exp_noise)}</strong></span>
          </div>
        </section>

        <section className="sw-card">
          <div className="sw-section-heading">
            <div><small>INDICES</small><h2>Geomagnetic activity</h2></div>
            <Gauge aria-hidden="true" size={20} />
          </div>
          <div className="sw-index-block">
            <div className="sw-index-title"><span>Kp index</span><strong>{valueOrDash(data.AK?.k_index)}</strong><small>24h max · {valueOrDash(data.AK?.k_MAX_24h)}</small></div>
            <div className="sw-kp-ladder" aria-label={`Kp status: ${kRounded === undefined ? "unknown" : KP_LABELS[Math.max(0, Math.min(9, kRounded))]}`}>
              {KP_LABELS.map((label, index) => (
                <span className={index === kRounded ? "is-active" : ""} data-severity={kpSeverity(index)} key={label} title={`${index} · ${label}`}>{index}</span>
              ))}
            </div>
          </div>
          <div className="sw-index-block">
            <div className="sw-index-title"><span>A index</span><strong>{valueOrDash(data.AK?.a_index)}</strong><small>{currentALevel >= 0 ? A_LEVELS[currentALevel].label : "Awaiting report"}</small></div>
            <div className="sw-a-ladder" aria-label={`A index status: ${currentALevel >= 0 ? A_LEVELS[currentALevel].label : "unknown"}`}>
              {A_LEVELS.map((level, index) => (
                <span className={index === currentALevel ? "is-active" : ""} data-severity={kpSeverity(index * 1.5)} key={level.label}>{level.label}</span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="sw-two-column sw-two-column-bottom">
        <section className="sw-card">
          <div className="sw-section-heading">
            <div><small>SOLAR ACTIVITY</small><h2>X-ray flux classes</h2></div>
            <Sun aria-hidden="true" size={20} />
          </div>
          <dl className="sw-definition-grid">
            <div><dt>Current flux class</dt><dd>{valueOrDash(data.XRAY?.peak_flux_class)}</dd></div>
            <div><dt>Peak 3h flux class</dt><dd>{valueOrDash(data.XRAY?.peak_flux_class_3h)}</dd></div>
            <div><dt>Peak 24h flux class</dt><dd>{valueOrDash(data.XRAY?.peak_flux_class_24h)}</dd></div>
          </dl>
        </section>

        <section className="sw-card">
          <div className="sw-section-heading">
            <div><small>PROPAGATION</small><h2>Band outlook</h2></div>
            <Waves aria-hidden="true" size={20} />
          </div>
          <dl className="sw-propagation-grid">
            {PROPAGATION_ITEMS.map(([key, label]) => (
              <div key={key}><dt>{label}</dt><dd>{valueOrDash(data.PROPAGATION?.[key])}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

function ForecastPanel({ data }: { data: SpaceWeatherData }) {
  const forecast = data.FORCST;
  const summary = forecast?.SUMMARY;
  const dates = summary?.PRE_DATES?.length ? summary.PRE_DATES : forecast?.PRE_DATES ?? [];
  const reports = [
    ["Geomagnetic activity", summary?.G_REPORT],
    ["Solar radiation storms", summary?.S_REPORT],
    ["Radio blackouts", summary?.R_REPORT],
  ] as const;
  const probabilityRows: ReadonlyArray<{
    group?: string;
    label: string;
    values: (ForecastValue | undefined)[];
    paired?: (ForecastValue | undefined)[];
  }> = [
    { group: "Solar radiation storm", label: "S1 or greater", values: summary?.S_PROB?.probS1 ?? [] },
    { group: "Solar flares", label: "Class M flare", values: forecast?.CLASS_M ?? [] },
    { label: "Class X flare", values: forecast?.CLASS_X ?? [] },
    { label: "Proton flare", values: forecast?.CLASS_PROTON ?? [] },
    { group: "Radio blackout", label: "R1–R2", values: summary?.R_PROB?.probR1 ?? [] },
    { label: "R3 or greater", values: summary?.R_PROB?.probR3 ?? [] },
    { group: "Geomagnetic activity · mid / high latitude", label: "Active", values: forecast?.GEO_MID_ACTIVE ?? [], paired: forecast?.GEO_HIG_ACTIVE ?? [] },
    { label: "Minor", values: forecast?.GEO_MID_MINOR ?? [], paired: forecast?.GEO_HIG_MINOR ?? [] },
    { label: "Major", values: forecast?.GEO_MID_MAJOR ?? [], paired: forecast?.GEO_HIG_MAJOR ?? [] },
  ];

  return (
    <div className="sw-panel-stack">
      <section className="sw-card">
        <div className="sw-section-heading">
          <div><small>FORECAST SUMMARY</small><h2>Three-day outlook</h2></div>
          <CloudSun aria-hidden="true" size={20} />
        </div>
        <div className="sw-report-grid">
          {reports.map(([label, report]) => (
            <article className="sw-report" data-warning={report?.[0] === 1} key={label}>
              <span className="sw-report-icon"><Info aria-hidden="true" size={18} /></span>
              <span><strong>{label}</strong><p>{report?.[1] || "No forecast summary is available."}</p></span>
            </article>
          ))}
        </div>
      </section>

      <section className="sw-card">
        <div className="sw-section-heading">
          <div><small>GEOMAGNETIC FORECAST</small><h2>Three-day Kp index</h2></div>
          <span className="sw-heading-note">UTC</span>
        </div>
        <div className="sw-table-scroll" tabIndex={0} aria-label="Scrollable three-day Kp forecast">
          <table className="sw-data-table sw-kp-table">
            <thead><tr><th scope="col">Time</th>{[0, 1, 2].map((index) => <th scope="col" key={index}>{dates[index] || `Day ${index + 1}`}</th>)}</tr></thead>
            <tbody>
              {KP_PERIODS.map((period) => (
                <tr key={period}>
                  <th scope="row">{period.replace("UT", "")}</th>
                  {[0, 1, 2].map((day) => {
                    const entry = summary?.kp?.[period]?.[day];
                    return <td data-severity={kpSeverity(entry?.value)} key={day}><strong>{valueOrDash(entry?.textual)}</strong><small>{entry?.value === undefined ? "" : `Kp ${entry.value}`}</small></td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sw-card">
        <div className="sw-section-heading">
          <div><small>EVENT PROBABILITY</small><h2>Three-day risk matrix</h2></div>
          <span className="sw-heading-note">Mid / high where paired</span>
        </div>
        <div className="sw-table-scroll" tabIndex={0} aria-label="Scrollable three-day event probability forecast">
          <table className="sw-data-table sw-probability-table">
            <thead><tr><th scope="col">Event</th>{[0, 1, 2].map((index) => <th scope="col" key={index}>{dates[index] || `Day ${index + 1}`}</th>)}</tr></thead>
            <tbody>
              {probabilityRows.map((row) => (
                <React.Fragment key={row.label}>
                  {row.group ? <tr className="sw-table-group"><th colSpan={4}>{row.group}</th></tr> : null}
                  <tr>
                    <th scope="row">{row.label}</th>
                    {[0, 1, 2].map((day) => <td key={day}>{row.paired ? `${percent(row.values[day])} / ${percent(row.paired[day])}` : percent(row.values[day])}</td>)}
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DrapPanel({ data }: { data: SpaceWeatherData }) {
  const src = imageWithReportToken("https://www.aresvalley.com/poseidon_engine/drap.png", data);
  return (
    <div className="sw-panel-stack">
      <section className="sw-card sw-image-card">
        <div className="sw-section-heading">
          <div><small>D-REGION ABSORPTION</small><h2>Global DRAP model</h2></div>
          <Radio aria-hidden="true" size={20} />
        </div>
        <RemoteImage key={src} src={src} alt="Current global D-region absorption prediction map" label="D-Region Absorption Prediction · Poseidon" />
      </section>
      <section className="sw-status-grid" aria-label="DRAP status">
        <article><small>RECOVERY TIME</small><strong>{valueOrDash(data.DRAP?.["Recovery Time"])}</strong></article>
        <article><small>X-RAY STATUS</small><strong>{valueOrDash(data.DRAP?.["XRay Msg"])}</strong><span>{data.DRAP?.["XRay Warning"]}</span></article>
        <article><small>PROTON STATUS</small><strong>{valueOrDash(data.DRAP?.["Proton Msg"])}</strong><span>{data.DRAP?.["Proton Warning"]}</span></article>
      </section>
    </div>
  );
}

function AuroraPanel({ data }: { data: SpaceWeatherData }) {
  const src = imageWithReportToken("https://www.aresvalley.com/poseidon_engine/aurora.png", data);
  return (
    <section className="sw-card sw-image-card">
      <div className="sw-section-heading">
        <div><small>OVATION MODEL</small><h2>Aurora forecast</h2></div>
        <Orbit aria-hidden="true" size={20} />
      </div>
      <RemoteImage key={src} src={src} alt="Current OVATION auroral forecast map" label="Aurora OVATION model · Poseidon" />
    </section>
  );
}

function SsaPanel({ data }: { data: SpaceWeatherData }) {
  const src = imageWithReportToken(data.URL?.SYNOPTIC_MAP, data);
  return (
    <section className="sw-card sw-image-card">
      <div className="sw-section-heading">
        <div><small>SOLAR SYNOPTIC ANALYSIS</small><h2>Current synoptic map</h2></div>
        <Sun aria-hidden="true" size={20} />
      </div>
      <RemoteImage key={src} src={src} alt="Current solar synoptic analysis map" label="Solar Synoptic Analysis · NOAA SWPC" />
    </section>
  );
}

function SunImagersPanel({ data }: { data: SpaceWeatherData }) {
  const [selected, setSelected] = useState<SunProductKey>("AIA_094");
  const product = SUN_PRODUCTS.find((item) => item.key === selected) ?? SUN_PRODUCTS[0];
  const src = imageWithReportToken(data.URL?.[selected], data);

  return (
    <section className="sw-card sw-image-card">
      <div className="sw-section-heading sw-sun-heading">
        <div><small>SUN IMAGERS</small><h2>{product.shortLabel}</h2></div>
        <label className="sw-product-select">
          <span>Image product</span>
          <select value={selected} onChange={(event) => setSelected(event.target.value as SunProductKey)}>
            {SUN_PRODUCTS.map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <RemoteImage key={src} src={src} alt={`Current ${product.label} solar image`} label={product.label} />
    </section>
  );
}

export function SpaceWeather({ data, loading, onRefresh }: SpaceWeatherProps) {
  const [activeTab, setActiveTab] = useState<TabId>("current");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const issuedAt = [data?.JSON_INFO?.utc_date, data?.JSON_INFO?.utc_time].filter(Boolean).join(" · ");

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    tabRefs.current[tab]?.focus();
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((tab) => tab.id === activeTab);
    let next = current;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    selectTab(TABS[next].id);
  }

  return (
    <main className="sw-shell" aria-busy={loading}>
      <header className="sw-hero">
        <div>
          <span className="sw-eyebrow"><span className="sw-live-dot" /> LIVE RF CONDITIONS</span>
          <h1>Space weather</h1>
          <p>Solar, geomagnetic, propagation, and forecast products from the AresValley Poseidon engine.</p>
        </div>
        <div className="sw-hero-actions">
          <span className="sw-issued-at">
            <small>REPORT ISSUED</small>
            <strong>{issuedAt ? `${issuedAt} UTC` : loading ? "Retrieving live report…" : "Unavailable"}</strong>
          </span>
          <button type="button" className="sw-refresh" onClick={onRefresh} disabled={loading}>
            <RefreshCw aria-hidden="true" size={16} className={loading ? "is-spinning" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="sw-tab-scroller">
        <div className="sw-tabs" role="tablist" aria-label="Space weather products" onKeyDown={handleTabKeyDown}>
          {TABS.map((tab) => (
            <button
              type="button"
              role="tab"
              id={`sw-tab-${tab.id}`}
              aria-controls={`sw-panel-${tab.id}`}
              aria-selected={activeTab === tab.id}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              ref={(node) => { tabRefs.current[tab.id] = node; }}
              key={tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section
        className="sw-tab-panel"
        role="tabpanel"
        id={`sw-panel-${activeTab}`}
        aria-labelledby={`sw-tab-${activeTab}`}
        tabIndex={0}
      >
        {loading && !data ? <LoadingPanel /> : null}
        {!loading && !data ? <UnavailablePanel onRefresh={onRefresh} /> : null}
        {data && activeTab === "current" ? <CurrentPanel data={data} /> : null}
        {data && activeTab === "forecasts" ? <ForecastPanel data={data} /> : null}
        {data && activeTab === "drap" ? <DrapPanel data={data} /> : null}
        {data && activeTab === "aurora" ? <AuroraPanel data={data} /> : null}
        {data && activeTab === "ssa" ? <SsaPanel data={data} /> : null}
        {data && activeTab === "sun-imagers" ? <SunImagersPanel data={data} /> : null}
      </section>

      <footer className="sw-credit">
        <span>Live report provided by the AresValley Poseidon engine.</span>
        <span>Conditions are informational, not operational guidance.</span>
      </footer>
    </main>
  );
}
