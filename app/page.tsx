"use client";

import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  CircleHelp,
  CloudSun,
  Database,
  Download,
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  Filter,
  Gauge,
  Headphones,
  Import,
  Info,
  Library,
  Orbit,
  Plus,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Waves,
  X,
} from "lucide-react";
import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import signalData from "./data/signals.json";

type Datum = { value: number | string; description?: string };

type SignalRecord = {
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

type FiltersState = {
  band: string;
  category: string;
  modulation: string;
  location: string;
  minFrequency: string;
  maxFrequency: string;
  minBandwidth: string;
  maxBandwidth: string;
  sinceVersion: string;
};

type SpaceWeatherData = {
  JSON_INFO?: { utc_date?: string; utc_time?: string };
  AK?: {
    k_index?: number;
    a_index?: number;
    exp_noise?: string;
    k_MAX_24h?: number;
  };
  XRAY?: {
    peak_flux_class?: string;
    peak_flux_class_3h?: string;
    peak_flux_class_24h?: string;
  };
  SGAS?: { ssn?: number; sfi?: number };
  GSR_SCALES?: {
    G_now?: number;
    S_now?: number;
    R_now?: number;
    G_max24h?: number;
    S_max24h?: number;
    R_max24h?: number;
  };
  PROPAGATION?: Record<string, string>;
  FORCST?: {
    PRE_DATES?: string[];
    GEO_MID_ACTIVE?: number[];
    CLASS_M?: number[];
    CLASS_X?: number[];
    SUMMARY?: {
      G_REPORT?: [number, string];
      S_REPORT?: [number, string];
      R_REPORT?: [number, string];
    };
  };
};

type ViewName = "library" | "saved" | "weather";

const BASE_SIGNALS = signalData as SignalRecord[];
const DEFAULT_FILTERS: FiltersState = {
  band: "",
  category: "",
  modulation: "",
  location: "",
  minFrequency: "",
  maxFrequency: "",
  minBandwidth: "",
  maxBandwidth: "",
  sinceVersion: "",
};

const RF_BANDS = [
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
];

const MEDIA_BASE =
  "https://raw.githubusercontent.com/AresValley/Artemis-DB/main/static";

function numericValues(items: Datum[]) {
  return items
    .map((item) => Number(item.value))
    .filter((value) => Number.isFinite(value));
}

function textValues(items: Datum[]) {
  return items.map((item) => String(item.value)).filter(Boolean);
}

function formatEngineering(value: number, kind: "frequency" | "time" = "frequency") {
  if (kind === "time") {
    if (value < 1) return `${Math.round(value * 1000)} ms`;
    return `${trimNumber(value)} s`;
  }
  if (value >= 1_000_000_000) return `${trimNumber(value / 1_000_000_000)} GHz`;
  if (value >= 1_000_000) return `${trimNumber(value / 1_000_000)} MHz`;
  if (value >= 1_000) return `${trimNumber(value / 1_000)} kHz`;
  return `${trimNumber(value)} Hz`;
}

function trimNumber(value: number) {
  const digits = Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2;
  return Number(value.toFixed(digits)).toLocaleString();
}

function formatRange(items: Datum[], kind: "frequency" | "time" = "frequency") {
  const values = numericValues(items).sort((a, b) => a - b);
  if (!values.length) return "Unknown";
  if (values.length === 1) return formatEngineering(values[0], kind);
  return `${formatEngineering(values[0], kind)} – ${formatEngineering(values.at(-1)!, kind)}`;
}

function signalSearchText(signal: SignalRecord) {
  return [
    signal.title,
    signal["short description"],
    signal.description,
    ...signal.category,
    ...textValues(signal.modulation),
    ...textValues(signal.mode),
    ...textValues(signal.location),
  ]
    .join(" ")
    .toLocaleLowerCase();
}

function overlaps(values: number[], min: number, max: number) {
  if (!values.length) return false;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low <= max && high >= min;
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function NavButton({
  active,
  icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      className={cx("nav-button", active && "is-active")}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span>{label}</span>
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}

function ParameterRow({
  label,
  values,
  formatter,
}: {
  label: string;
  values: Datum[];
  formatter?: (value: number) => string;
}) {
  return (
    <div className="parameter-row">
      <dt>{label}</dt>
      <dd>
        {values.length ? (
          values.map((item, index) => (
            <span
              className="value-chip"
              title={item.description || undefined}
              key={`${item.value}-${index}`}
            >
              {formatter && typeof item.value === "number"
                ? formatter(item.value)
                : String(item.value)}
            </span>
          ))
        ) : (
          <span className="empty-value">Not specified</span>
        )}
      </dd>
    </div>
  );
}

function BandRail({ signal }: { signal: SignalRecord }) {
  const frequencies = numericValues(signal.frequency);
  const low = frequencies.length ? Math.min(...frequencies) : 0;
  const high = frequencies.length ? Math.max(...frequencies) : 0;

  return (
    <div className="band-rail" aria-label="Radio-frequency band coverage">
      {RF_BANDS.map((band) => {
        const active = Boolean(frequencies.length && low <= band.max && high >= band.min);
        return (
          <div
            className={cx("band-segment", active && "is-active")}
            key={band.label}
            title={`${band.label}: ${formatEngineering(band.min)} to ${formatEngineering(band.max)}`}
          >
            {band.label}
          </div>
        );
      })}
    </div>
  );
}

function SignalList({
  signals,
  selectedId,
  bookmarks,
  onSelect,
}: {
  signals: SignalRecord[];
  selectedId: string;
  bookmarks: Set<string>;
  onSelect: (signal: SignalRecord) => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, [selectedId]);

  return (
    <div className="signal-list" role="listbox" aria-label="Signals">
      {signals.map((signal) => (
        <button
          className={cx("signal-list-item", selectedId === signal.pageid && "is-selected")}
          key={signal.pageid}
          ref={selectedId === signal.pageid ? selectedRef : undefined}
          onClick={() => onSelect(signal)}
          role="option"
          aria-selected={selectedId === signal.pageid}
        >
          <span className="signal-item-topline">
            <strong>{signal.title}</strong>
            {bookmarks.has(signal.pageid) ? (
              <Star className="saved-star" size={13} fill="currentColor" aria-label="Saved" />
            ) : null}
          </span>
          <span className="signal-list-summary">
            {signal["short description"] || "User-created signal reference"}
          </span>
          <span className="signal-list-meta">
            <span>{formatRange(signal.frequency)}</span>
            <span aria-hidden="true">·</span>
            <span>{textValues(signal.modulation).slice(0, 2).join(" / ") || "Unknown"}</span>
          </span>
        </button>
      ))}
      {!signals.length ? (
        <div className="empty-list">
          <Search size={28} />
          <strong>No signals found</strong>
          <span>Try a broader search or clear one of the filters.</span>
        </div>
      ) : null}
    </div>
  );
}

function SignalDetail({
  signal,
  saved,
  onToggleSaved,
  onBack,
  onOpenDocuments,
}: {
  signal: SignalRecord;
  saved: boolean;
  onToggleSaved: () => void;
  onBack: () => void;
  onOpenDocuments: () => void;
}) {
  return (
    <article className="signal-detail" aria-labelledby="signal-title">
      <div className="mobile-detail-toolbar">
        <button className="quiet-button" onClick={onBack}>
          <ArrowLeft size={18} /> Back to signals
        </button>
      </div>

      <div className="detail-kicker-row">
        <span className="detail-kicker">
          {signal.custom ? "LOCAL REFERENCE" : `SIGID REFERENCE · #${signal.pageid}`}
        </span>
        <div className="detail-actions">
          <button
            className={cx("icon-text-button", saved && "is-saved")}
            onClick={onToggleSaved}
            aria-label={saved ? "Remove from saved signals" : "Save signal"}
          >
            {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            <span>{saved ? "Saved" : "Save"}</span>
          </button>
          {!signal.custom ? (
            <a
              className="icon-text-button"
              href={`https://www.sigidwiki.com/wiki/index.php?curid=${signal.pageid}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              <span>SigID Wiki</span>
            </a>
          ) : null}
        </div>
      </div>

      <h1 id="signal-title">{signal.title}</h1>
      <p className="signal-lede">{signal["short description"]}</p>

      <div className="tag-row" aria-label="Categories">
        {signal.category.map((category) => (
          <span className="category-tag" key={category}>
            {category}
          </span>
        ))}
        <span className="version-tag" title="First database version containing this signal">
          v{signal.added_since}
        </span>
      </div>

      <section className="range-section" aria-label="Signal range summary">
        <div className="range-card">
          <span>Frequency range</span>
          <strong>{formatRange(signal.frequency)}</strong>
        </div>
        <div className="range-card">
          <span>Bandwidth range</span>
          <strong>{formatRange(signal.bandwidth)}</strong>
        </div>
      </section>

      <BandRail signal={signal} />

      <section className="parameters-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SIGNATURE</span>
            <h2>Signal parameters</h2>
          </div>
          <SlidersHorizontal size={19} />
        </div>
        <dl className="parameter-table">
          <ParameterRow label="Frequency" values={signal.frequency} formatter={(v) => formatEngineering(v)} />
          <ParameterRow label="Bandwidth" values={signal.bandwidth} formatter={(v) => formatEngineering(v)} />
          <ParameterRow label="Modulation" values={signal.modulation} />
          <ParameterRow label="Mode" values={signal.mode} />
          <ParameterRow label="ACF" values={signal.acf} formatter={(v) => formatEngineering(v, "time")} />
          <ParameterRow label="Location" values={signal.location} />
        </dl>
      </section>

      <section className="description-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">REFERENCE NOTES</span>
            <h2>About this signal</h2>
          </div>
          <FileText size={19} />
        </div>
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
            }}
          >
            {signal.description || signal["short description"]}
          </ReactMarkdown>
        </div>
      </section>

      <button className="mobile-documents-button" onClick={onOpenDocuments}>
        <FileText size={18} /> Open attached media
      </button>
    </article>
  );
}

function MediaPanel({
  signal,
  onOpenDocuments,
}: {
  signal: SignalRecord;
  onOpenDocuments: () => void;
}) {
  const rawImage = signal.spectrum
    ? `${MEDIA_BASE}/${signal.pageid}/media/1.png`
    : "";
  const rawAudio = signal.audio
    ? `${MEDIA_BASE}/${signal.pageid}/media/1.ogg`
    : "";
  const [imageSource, setImageSource] = useState(rawImage);

  useEffect(() => setImageSource(rawImage), [rawImage]);

  return (
    <aside className="media-panel" aria-label="Signal media">
      <section className="media-card waterfall-card">
        <div className="media-card-heading">
          <div>
            <span className="eyebrow">WATERFALL / FFT</span>
            <strong>Spectrum sample</strong>
          </div>
          <Waves size={18} />
        </div>
        <div className="spectrum-frame">
          {imageSource ? (
            <img
              src={imageSource}
              alt={`Spectrum waterfall for ${signal.title}`}
              loading="eager"
              decoding="async"
              onError={() => {
                if (signal.spectrum?.url && imageSource !== signal.spectrum.url) {
                  setImageSource(signal.spectrum.url);
                } else {
                  setImageSource("");
                }
              }}
            />
          ) : (
            <div className="media-placeholder">
              <Waves size={34} />
              <span>No spectrum sample</span>
            </div>
          )}
          <div className="spectrum-scanline" aria-hidden="true" />
        </div>
        {signal.spectrum?.filename ? (
          <span className="media-filename">{signal.spectrum.filename}</span>
        ) : null}
      </section>

      <section className="media-card audio-card">
        <div className="media-card-heading">
          <div>
            <span className="eyebrow">AUDIO SAMPLE</span>
            <strong>Listen for the pattern</strong>
          </div>
          <Headphones size={18} />
        </div>
        {rawAudio ? (
          <audio key={rawAudio} controls preload="none" src={rawAudio}>
            Your browser does not support audio playback.
          </audio>
        ) : (
          <div className="audio-empty">No audio sample available</div>
        )}
      </section>

      <button className="documents-card" onClick={onOpenDocuments}>
        <span className="documents-icon">
          <FileText size={20} />
        </span>
        <span>
          <strong>Attached media</strong>
          <small>View image, audio, and source files</small>
        </span>
        <ExternalLink size={16} />
      </button>

      <div className="source-note">
        <Info size={15} />
        <span>
          Community reference data from Artemis DB v74 and Signal Identification Wiki.
        </span>
      </div>
    </aside>
  );
}

function FilterModal({
  filters,
  onChange,
  onClose,
  categories,
  modulations,
  locations,
  resultCount,
}: {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  onClose: () => void;
  categories: string[];
  modulations: string[];
  locations: string[];
  resultCount: number;
}) {
  const update = (key: keyof FiltersState, value: string) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">NARROW THE LIBRARY</span>
            <h2 id="filter-title">Advanced filters</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close filters">
            <X size={19} />
          </button>
        </div>

        <div className="filter-form">
          <label>
            <span>Radio band</span>
            <select value={filters.band} onChange={(e) => update("band", e.target.value)}>
              <option value="">All bands</option>
              {RF_BANDS.map((band) => (
                <option key={band.label}>{band.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Category</span>
            <select value={filters.category} onChange={(e) => update("category", e.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Modulation</span>
            <select value={filters.modulation} onChange={(e) => update("modulation", e.target.value)}>
              <option value="">All modulations</option>
              {modulations.map((modulation) => (
                <option key={modulation}>{modulation}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Location</span>
            <select value={filters.location} onChange={(e) => update("location", e.target.value)}>
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </label>
          <div className="field-group">
            <span>Frequency range (MHz)</span>
            <div className="range-inputs">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="Min"
                value={filters.minFrequency}
                onChange={(e) => update("minFrequency", e.target.value)}
              />
              <span>to</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="Max"
                value={filters.maxFrequency}
                onChange={(e) => update("maxFrequency", e.target.value)}
              />
            </div>
          </div>
          <div className="field-group">
            <span>Bandwidth range (kHz)</span>
            <div className="range-inputs">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="Min"
                value={filters.minBandwidth}
                onChange={(e) => update("minBandwidth", e.target.value)}
              />
              <span>to</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                placeholder="Max"
                value={filters.maxBandwidth}
                onChange={(e) => update("maxBandwidth", e.target.value)}
              />
            </div>
          </div>
          <label>
            <span>Introduced in DB version</span>
            <select value={filters.sinceVersion} onChange={(e) => update("sinceVersion", e.target.value)}>
              <option value="">Any version</option>
              {Array.from({ length: 10 }, (_, index) => 74 - index).map((version) => (
                <option value={version} key={version}>v{version}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="modal-footer">
          <button className="secondary-button" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset all
          </button>
          <button className="primary-button" onClick={onClose}>
            Show {resultCount} signals
          </button>
        </div>
      </section>
    </div>
  );
}

function DocumentsModal({ signal, onClose }: { signal: SignalRecord; onClose: () => void }) {
  const documents = [
    signal.spectrum
      ? {
          type: "Image",
          name: signal.spectrum.filename || "Spectrum sample",
          href: `${MEDIA_BASE}/${signal.pageid}/media/1.png`,
          icon: <FileImage size={18} />,
        }
      : null,
    signal.audio
      ? {
          type: "Audio",
          name: signal.audio.filename || "Audio sample",
          href: `${MEDIA_BASE}/${signal.pageid}/media/1.ogg`,
          icon: <FileAudio size={18} />,
        }
      : null,
    !signal.custom
      ? {
          type: "Source",
          name: "Signal Identification Wiki entry",
          href: `https://www.sigidwiki.com/wiki/index.php?curid=${signal.pageid}`,
          icon: <ExternalLink size={18} />,
        }
      : null,
  ].filter(Boolean) as Array<{ type: string; name: string; href: string; icon: React.ReactNode }>;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal documents-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="documents-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">{signal.title}</span>
            <h2 id="documents-title">Attached media</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close attached media">
            <X size={19} />
          </button>
        </div>
        <div className="document-list">
          {documents.map((document) => (
            <a href={document.href} target="_blank" rel="noreferrer" key={document.href}>
              <span className="document-type-icon">{document.icon}</span>
              <span>
                <small>{document.type}</small>
                <strong>{document.name}</strong>
              </span>
              <ExternalLink size={16} />
            </a>
          ))}
          {!documents.length ? <div className="audio-empty">No media attached</div> : null}
        </div>
      </section>
    </div>
  );
}

function DatabaseModal({
  customSignals,
  onClose,
  onNewSignal,
  onImport,
  onExport,
}: {
  customSignals: SignalRecord[];
  onClose: () => void;
  onNewSignal: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal database-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="database-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">DATABASE MANAGER</span>
            <h2 id="database-title">Signal libraries</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close database manager">
            <X size={19} />
          </button>
        </div>

        <div className="database-list">
          <div className="database-row is-current">
            <span className="database-mark"><Database size={20} /></span>
            <span>
              <small>COMMUNITY REFERENCE · READ ONLY</small>
              <strong>SigID Database v74</strong>
              <em>583 recognized signals</em>
            </span>
            <span className="current-pill">Current</span>
          </div>
          <div className="database-row">
            <span className="database-mark local"><Library size={20} /></span>
            <span>
              <small>LOCAL · THIS DEVICE</small>
              <strong>Field Notes</strong>
              <em>{customSignals.length} custom {customSignals.length === 1 ? "signal" : "signals"}</em>
            </span>
            <button className="small-button" onClick={onNewSignal}>
              <Plus size={15} /> Add
            </button>
          </div>
        </div>

        <div className="database-actions">
          <label className="secondary-button file-button">
            <Import size={17} /> Import JSON
            <input type="file" accept="application/json,.json" onChange={onImport} />
          </label>
          <button className="secondary-button" onClick={onExport} disabled={!customSignals.length}>
            <Download size={17} /> Export local library
          </button>
        </div>
        <p className="database-footnote">
          Local signals and saved items remain in this browser. Export a JSON backup before clearing browser data.
        </p>
      </section>
    </div>
  );
}

function NewSignalModal({ onClose, onCreate }: { onClose: () => void; onCreate: (signal: SignalRecord) => void }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [frequency, setFrequency] = useState("");
  const [bandwidth, setBandwidth] = useState("");
  const [category, setCategory] = useState("Field observation");
  const [modulation, setModulation] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const frequencyHz = Number(frequency) * 1_000_000;
    const bandwidthHz = Number(bandwidth) * 1_000;
    onCreate({
      pageid: `local-${Date.now()}`,
      title: title.trim(),
      added_since: 74,
      spectrum: null,
      audio: null,
      category: [category.trim() || "Field observation"],
      frequency: Number.isFinite(frequencyHz) && frequencyHz > 0 ? [{ value: frequencyHz }] : [],
      bandwidth: Number.isFinite(bandwidthHz) && bandwidthHz > 0 ? [{ value: bandwidthHz }] : [],
      acf: [],
      modulation: modulation.trim() ? [{ value: modulation.trim().toUpperCase() }] : [],
      mode: [],
      location: [],
      "short description": summary.trim() || "Locally saved field observation.",
      description: summary.trim() || "Locally saved field observation.",
      custom: true,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="modal new-signal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-signal-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">FIELD NOTES</span>
            <h2 id="new-signal-title">Add a signal</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close new signal form">
            <X size={19} />
          </button>
        </div>
        <div className="new-signal-form">
          <label className="wide-field">
            <span>Signal name</span>
            <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Unknown burst at 14.2 MHz" />
          </label>
          <label className="wide-field">
            <span>Observation notes</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Describe the cadence, sound, time, and anything distinctive…" />
          </label>
          <label>
            <span>Frequency (MHz)</span>
            <input type="number" min="0" step="any" inputMode="decimal" value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="14.200" />
          </label>
          <label>
            <span>Bandwidth (kHz)</span>
            <input type="number" min="0" step="any" inputMode="decimal" value={bandwidth} onChange={(e) => setBandwidth(e.target.value)} placeholder="2.8" />
          </label>
          <label>
            <span>Category</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <label>
            <span>Modulation</span>
            <input value={modulation} onChange={(e) => setModulation(e.target.value)} placeholder="FSK, PSK, FM…" />
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button"><Plus size={17} /> Add to Field Notes</button>
        </div>
      </form>
    </div>
  );
}

function SpaceWeather({ data, loading, onRefresh }: { data: SpaceWeatherData | null; loading: boolean; onRefresh: () => void }) {
  const forecastDates = data?.FORCST?.PRE_DATES || [];
  const propagation = data?.PROPAGATION
    ? Object.entries(data.PROPAGATION).slice(0, 8)
    : [];

  return (
    <main className="weather-view">
      <section className="weather-hero">
        <div>
          <span className="eyebrow">LIVE RF CONDITIONS</span>
          <h1>Space weather</h1>
          <p>Current solar and geomagnetic conditions that shape HF propagation and reception.</p>
        </div>
        <div className="weather-hero-actions">
          <span className="weather-timestamp">
            <span className="live-dot" />
            {data?.JSON_INFO?.utc_date
              ? `${data.JSON_INFO.utc_date} · ${data.JSON_INFO.utc_time} UTC`
              : loading
                ? "Retrieving live report…"
                : "Report unavailable"}
          </span>
          <button className="icon-text-button" onClick={onRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? "is-spinning" : ""} /> Refresh
          </button>
        </div>
      </section>

      <section className="weather-metrics">
        <div className="weather-metric primary-weather-metric">
          <span className="metric-icon violet"><Gauge size={20} /></span>
          <span><small>PLANETARY K-INDEX</small><strong>{data?.AK?.k_index ?? "—"}</strong></span>
          <em>{data?.AK?.k_index !== undefined && data.AK.k_index < 4 ? "Quiet" : "Elevated"}</em>
        </div>
        <div className="weather-metric">
          <span className="metric-icon teal"><Sun size={20} /></span>
          <span><small>SOLAR FLUX</small><strong>{data?.SGAS?.sfi ?? "—"}</strong></span>
          <em>SFI</em>
        </div>
        <div className="weather-metric">
          <span className="metric-icon amber"><Sparkles size={20} /></span>
          <span><small>SUNSPOT NUMBER</small><strong>{data?.SGAS?.ssn ?? "—"}</strong></span>
          <em>SSN</em>
        </div>
        <div className="weather-metric">
          <span className="metric-icon coral"><Orbit size={20} /></span>
          <span><small>X-RAY FLUX</small><strong>{data?.XRAY?.peak_flux_class ?? "—"}</strong></span>
          <em>Current</em>
        </div>
      </section>

      <section className="weather-grid">
        <div className="weather-panel scale-panel">
          <div className="section-heading">
            <div><span className="eyebrow">NOAA SCALES</span><h2>Radio environment</h2></div>
            <CloudSun size={20} />
          </div>
          <div className="scale-list">
            {[
              ["G", "Geomagnetic storm", data?.GSR_SCALES?.G_now ?? 0, "violet"],
              ["S", "Solar radiation", data?.GSR_SCALES?.S_now ?? 0, "amber"],
              ["R", "Radio blackout", data?.GSR_SCALES?.R_now ?? 0, "coral"],
            ].map(([letter, label, value, tone]) => (
              <div className="scale-row" key={String(letter)}>
                <span className={`scale-letter ${tone}`}>{letter}{value}</span>
                <span><strong>{label}</strong><small>{Number(value) === 0 ? "No current impact" : "Conditions elevated"}</small></span>
                <div className="scale-track"><i style={{ width: `${Math.max(6, Number(value) * 20)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="noise-callout">
            <Radio size={17} />
            <span><small>EXPECTED HF NOISE</small><strong>{data?.AK?.exp_noise || "Awaiting report"}</strong></span>
          </div>
        </div>

        <div className="weather-panel propagation-panel">
          <div className="section-heading">
            <div><span className="eyebrow">PROPAGATION</span><h2>Band outlook</h2></div>
            <Waves size={20} />
          </div>
          <div className="propagation-grid">
            {propagation.length ? propagation.map(([key, value]) => (
              <div className="propagation-cell" key={key}>
                <small>{key.replaceAll("_", " ")}</small>
                <strong className={/open|good|fair/i.test(value) ? "positive" : ""}>{value}</strong>
              </div>
            )) : Array.from({ length: 6 }).map((_, index) => <div className="propagation-cell skeleton-cell" key={index} />)}
          </div>
        </div>
      </section>

      <section className="weather-panel forecast-panel">
        <div className="section-heading">
          <div><span className="eyebrow">THREE-DAY OUTLOOK</span><h2>Forecast</h2></div>
          <span className="forecast-legend">Chance of activity</span>
        </div>
        <div className="forecast-table">
          {forecastDates.map((date, index) => (
            <div className="forecast-day" key={date}>
              <strong>{date}</strong>
              <span><small>Geomagnetic</small><b>{data?.FORCST?.GEO_MID_ACTIVE?.[index] ?? 0}%</b></span>
              <span><small>M-class flare</small><b>{data?.FORCST?.CLASS_M?.[index] ?? 0}%</b></span>
              <span><small>X-class flare</small><b>{data?.FORCST?.CLASS_X?.[index] ?? 0}%</b></span>
            </div>
          ))}
          {!forecastDates.length ? <div className="audio-empty">Forecast is loading</div> : null}
        </div>
      </section>

      <p className="weather-credit">
        Live report provided by the AresValley Poseidon engine. Conditions are informational, not operational guidance.
      </p>
    </main>
  );
}

export default function Home() {
  const [view, setView] = useState<ViewName>("library");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState("5803");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [customSignals, setCustomSignals] = useState<SignalRecord[]>([]);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [newSignalOpen, setNewSignalOpen] = useState(false);
  const [weather, setWeather] = useState<SpaceWeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const allSignals = useMemo(() => [...customSignals, ...BASE_SIGNALS], [customSignals]);
  const searchable = useMemo(
    () => new Map(allSignals.map((signal) => [signal.pageid, signalSearchText(signal)])),
    [allSignals],
  );

  const categories = useMemo(
    () => Array.from(new Set(allSignals.flatMap((signal) => signal.category))).sort(),
    [allSignals],
  );
  const modulations = useMemo(
    () => Array.from(new Set(allSignals.flatMap((signal) => textValues(signal.modulation)))).sort(),
    [allSignals],
  );
  const locations = useMemo(
    () => Array.from(new Set(allSignals.flatMap((signal) => textValues(signal.location)))).sort(),
    [allSignals],
  );

  const filteredSignals = useMemo(() => {
    const terms = deferredQuery.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const selectedBand = RF_BANDS.find((band) => band.label === filters.band);
    const minFrequency = filters.minFrequency ? Number(filters.minFrequency) * 1_000_000 : null;
    const maxFrequency = filters.maxFrequency ? Number(filters.maxFrequency) * 1_000_000 : null;
    const minBandwidth = filters.minBandwidth ? Number(filters.minBandwidth) * 1_000 : null;
    const maxBandwidth = filters.maxBandwidth ? Number(filters.maxBandwidth) * 1_000 : null;

    const result = allSignals.filter((signal) => {
      const corpus = searchable.get(signal.pageid) || "";
      if (terms.length && !terms.every((term) => corpus.includes(term))) return false;
      if (view === "saved" && !bookmarks.has(signal.pageid)) return false;
      if (filters.category && !signal.category.includes(filters.category)) return false;
      if (filters.modulation && !textValues(signal.modulation).includes(filters.modulation)) return false;
      if (filters.location && !textValues(signal.location).includes(filters.location)) return false;
      if (filters.sinceVersion && signal.added_since !== Number(filters.sinceVersion)) return false;
      if (selectedBand && !overlaps(numericValues(signal.frequency), selectedBand.min, selectedBand.max)) return false;
      if ((minFrequency !== null || maxFrequency !== null) && !overlaps(
        numericValues(signal.frequency),
        minFrequency ?? 0,
        maxFrequency ?? Number.MAX_SAFE_INTEGER,
      )) return false;
      if ((minBandwidth !== null || maxBandwidth !== null) && !overlaps(
        numericValues(signal.bandwidth),
        minBandwidth ?? 0,
        maxBandwidth ?? Number.MAX_SAFE_INTEGER,
      )) return false;
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
  }, [allSignals, bookmarks, deferredQuery, filters, searchable, view]);

  const selected =
    allSignals.find((signal) => signal.pageid === selectedId) || filteredSignals[0] || allSignals[0];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const quickCategories = ["Digital", "Military", "Amateur Radio", "Radar", "Satellite"];

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("artemis-saved") || "[]") as string[];
      const local = JSON.parse(localStorage.getItem("artemis-custom-signals") || "[]") as SignalRecord[];
      setBookmarks(new Set(saved));
      setCustomSignals(Array.isArray(local) ? local : []);
    } catch {
      // A corrupted local preference should never block the reference library.
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("artemis-saved", JSON.stringify(Array.from(bookmarks)));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem("artemis-custom-signals", JSON.stringify(customSignals));
  }, [customSignals]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      const inField = /INPUT|TEXTAREA|SELECT/.test(target.tagName);
      if (event.key === "/" && !inField) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setFilterOpen(false);
        setDocumentsOpen(false);
        setDatabaseOpen(false);
        setNewSignalOpen(false);
      }
      if (!inField && view !== "weather" && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const index = filteredSignals.findIndex((signal) => signal.pageid === selectedId);
        const nextIndex = event.key === "ArrowDown"
          ? Math.min(filteredSignals.length - 1, index + 1)
          : Math.max(0, index - 1);
        if (filteredSignals[nextIndex]) setSelectedId(filteredSignals[nextIndex].pageid);
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [filteredSignals, selectedId, view]);

  async function loadWeather() {
    setWeatherLoading(true);
    try {
      const response = await fetch("/api/space-weather", { cache: "no-store" });
      if (!response.ok) throw new Error("Weather report unavailable");
      setWeather(await response.json());
    } catch {
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  }

  useEffect(() => {
    if (view === "weather" && !weather && !weatherLoading) void loadWeather();
  }, [view, weather, weatherLoading]);

  function changeView(next: ViewName) {
    setView(next);
    setMobileDetailOpen(false);
    if (next === "weather") setQuery("");
  }

  function selectSignal(signal: SignalRecord) {
    setSelectedId(signal.pageid);
    setMobileDetailOpen(true);
  }

  function toggleBookmark() {
    setBookmarks((current) => {
      const next = new Set(current);
      if (next.has(selected.pageid)) next.delete(selected.pageid);
      else next.add(selected.pageid);
      return next;
    });
  }

  function addCustomSignal(signal: SignalRecord) {
    setCustomSignals((current) => [signal, ...current]);
    setSelectedId(signal.pageid);
    setNewSignalOpen(false);
    setDatabaseOpen(false);
    setView("library");
    setMobileDetailOpen(true);
  }

  function exportCustomSignals() {
    const blob = new Blob([JSON.stringify(customSignals, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "artemis-field-notes.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importCustomSignals(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = (Array.isArray(parsed) ? parsed : [parsed]).filter(
        (item): item is SignalRecord => Boolean(item && typeof item.title === "string"),
      );
      const normalized = incoming.map((item, index) => ({
        ...item,
        pageid: item.pageid?.startsWith("local-") ? item.pageid : `local-import-${Date.now()}-${index}`,
        custom: true,
      }));
      setCustomSignals((current) => [...normalized, ...current]);
    } catch {
      window.alert("That file is not a valid Artemis JSON library.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand" onClick={() => changeView("library")} aria-label="Artemis signal library home">
          <span className="brand-mark"><span /></span>
          <span className="brand-copy"><strong>ARTEMIS</strong><small>RF REFERENCE</small></span>
        </button>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <NavButton active={view === "library"} icon={<Library size={17} />} label="Signals" onClick={() => changeView("library")} />
          <NavButton active={view === "saved"} icon={<Bookmark size={17} />} label="Saved" badge={bookmarks.size} onClick={() => changeView("saved")} />
          <NavButton active={view === "weather"} icon={<CloudSun size={18} />} label="Space weather" onClick={() => changeView("weather")} />
        </nav>

        <div className="header-actions">
          <span className="live-status"><span className="live-dot" /> DB ONLINE</span>
          <button className="database-button" onClick={() => setDatabaseOpen(true)}>
            <Database size={16} />
            <span>SigID <b>v74</b></span>
            <ChevronDown size={14} />
          </button>
          <a className="icon-button help-button" href="https://aresvalley.github.io/Artemis/" target="_blank" rel="noreferrer" aria-label="Open Artemis documentation">
            <CircleHelp size={19} />
          </a>
        </div>
      </header>

      {view === "weather" ? (
        <SpaceWeather data={weather} loading={weatherLoading} onRefresh={loadWeather} />
      ) : (
        <main className={cx("library-layout", mobileDetailOpen && "mobile-detail-is-open")}>
          <aside className="library-sidebar">
            <div className="sidebar-tools">
              <div className="search-box">
                <Search size={18} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={view === "saved" ? "Search saved signals" : "Search all signals"}
                  aria-label="Search signal names and descriptions"
                />
                {query ? (
                  <button onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>
                ) : (
                  <kbd>/</kbd>
                )}
              </div>
              <button
                className={cx("filter-button", activeFilterCount > 0 && "has-filters")}
                onClick={() => setFilterOpen(true)}
                aria-label="Open filters"
              >
                <Filter size={18} />
                {activeFilterCount ? <span>{activeFilterCount}</span> : null}
              </button>
            </div>

            <div className="quick-filters" aria-label="Quick category filters">
              <button className={!filters.category ? "is-active" : ""} onClick={() => setFilters({ ...filters, category: "" })}>All</button>
              {quickCategories.map((category) => (
                <button
                  className={filters.category === category ? "is-active" : ""}
                  key={category}
                  onClick={() => setFilters({ ...filters, category: filters.category === category ? "" : category })}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="results-heading">
              <span>
                <strong>{filteredSignals.length}</strong> {view === "saved" ? "saved" : "signals"}
              </span>
              {activeFilterCount ? <button onClick={() => setFilters(DEFAULT_FILTERS)}>Clear filters</button> : <span>NAME / FREQUENCY</span>}
            </div>

            <SignalList signals={filteredSignals} selectedId={selected.pageid} bookmarks={bookmarks} onSelect={selectSignal} />

            <button className="add-signal-button" onClick={() => setNewSignalOpen(true)}>
              <Plus size={17} /> Add field observation
            </button>
          </aside>

          <div className="detail-workspace">
            <SignalDetail
              signal={selected}
              saved={bookmarks.has(selected.pageid)}
              onToggleSaved={toggleBookmark}
              onBack={() => setMobileDetailOpen(false)}
              onOpenDocuments={() => setDocumentsOpen(true)}
            />
            <MediaPanel signal={selected} onOpenDocuments={() => setDocumentsOpen(true)} />
          </div>
        </main>
      )}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton active={view === "library"} icon={<Library size={19} />} label="Signals" onClick={() => changeView("library")} />
        <NavButton active={view === "saved"} icon={<Bookmark size={19} />} label="Saved" badge={bookmarks.size} onClick={() => changeView("saved")} />
        <NavButton active={view === "weather"} icon={<CloudSun size={20} />} label="Weather" onClick={() => changeView("weather")} />
        <NavButton active={databaseOpen} icon={<Database size={19} />} label="Database" onClick={() => setDatabaseOpen(true)} />
      </nav>

      {filterOpen ? (
        <FilterModal
          filters={filters}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
          categories={categories}
          modulations={modulations}
          locations={locations}
          resultCount={filteredSignals.length}
        />
      ) : null}
      {documentsOpen ? <DocumentsModal signal={selected} onClose={() => setDocumentsOpen(false)} /> : null}
      {databaseOpen ? (
        <DatabaseModal
          customSignals={customSignals}
          onClose={() => setDatabaseOpen(false)}
          onNewSignal={() => { setDatabaseOpen(false); setNewSignalOpen(true); }}
          onImport={importCustomSignals}
          onExport={exportCustomSignals}
        />
      ) : null}
      {newSignalOpen ? <NewSignalModal onClose={() => setNewSignalOpen(false)} onCreate={addCustomSignal} /> : null}
    </div>
  );
}
