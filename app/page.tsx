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
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import signalData from "./data/signals.json";
import {
  buildSignalIndex,
  countActiveFilterGroups,
  createDefaultFilters,
  filterSignals,
  numericValues,
  RF_BANDS,
  textValues,
  type Datum,
  type EngineeringUnit,
  type FiltersState,
  type NumericFilterState,
  type SignalRecord,
} from "./lib/signal-filters";

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

const MEDIA_BASE =
  "https://raw.githubusercontent.com/AresValley/Artemis-DB/main/static";

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
  const rowHeight = 97;
  const overscan = 5;
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(620);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(signals.length, startIndex + visibleCount);
  const visibleSignals = signals.slice(startIndex, endIndex);

  useEffect(() => {
    const element = listRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [signals]);

  useEffect(() => {
    const element = listRef.current;
    const selectedIndex = signals.findIndex((signal) => signal.pageid === selectedId);
    if (!element || selectedIndex < 0) return;
    const rowTop = selectedIndex * rowHeight;
    const rowBottom = rowTop + rowHeight;
    if (rowTop < element.scrollTop || rowBottom > element.scrollTop + element.clientHeight) {
      element.scrollTo({ top: Math.max(0, rowTop - element.clientHeight / 2 + rowHeight / 2) });
    }
  }, [selectedId, signals]);

  return (
    <div
      className="signal-list"
      ref={listRef}
      role="listbox"
      aria-label="Signals"
      tabIndex={0}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      {signals.length ? (
        <div className="signal-list-window" style={{ height: signals.length * rowHeight }}>
          {visibleSignals.map((signal, visibleIndex) => {
            const index = startIndex + visibleIndex;
            return (
              <button
                className={cx("signal-list-item", selectedId === signal.pageid && "is-selected")}
                key={signal.pageid}
                style={{ transform: `translateY(${index * rowHeight}px)` }}
                onClick={() => onSelect(signal)}
                role="option"
                aria-selected={selectedId === signal.pageid}
                aria-posinset={index + 1}
                aria-setsize={signals.length}
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
            );
          })}
        </div>
      ) : null}
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

const SignalDetail = React.memo(function SignalDetail({
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
          <ParameterRow label="ACF" values={signal.acf} formatter={(v) => `${trimNumber(v)} ms`} />
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
});

const MediaPanel = React.memo(function MediaPanel({
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
  const [failedImageSources, setFailedImageSources] = useState<Set<string>>(() => new Set());
  const fallbackImage = signal.spectrum?.url || "";
  const imageSource = rawImage && !failedImageSources.has(rawImage)
    ? rawImage
    : fallbackImage && !failedImageSources.has(fallbackImage)
      ? fallbackImage
      : "";

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
              onError={() => setFailedImageSources((current) => new Set(current).add(imageSource))}
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
});

function FacetFilter({
  label,
  options,
  selected,
  counts,
  onChange,
  formatOption = (value) => value,
}: {
  label: string;
  options: string[];
  selected: string[];
  counts: Map<string, number>;
  onChange: (next: string[]) => void;
  formatOption?: (value: string) => string;
}) {
  const [search, setSearch] = useState("");
  const visibleOptions = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term
      ? options.filter((option) => option.toLocaleLowerCase().includes(term))
      : options;
  }, [options, search]);

  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((value) => value !== option)
        : [...selected, option],
    );
  }

  return (
    <details className={cx("facet-filter", selected.length > 0 && "is-active")}>
      <summary>
        <span>{label}</span>
        <small>{selected.length ? `${selected.length} selected` : "Any"}</small>
        <ChevronDown size={14} />
      </summary>
      <div className="facet-menu">
        <div className="facet-menu-heading">
          <strong>{label}</strong>
          {selected.length ? <button onClick={() => onChange([])}>Clear</button> : null}
        </div>
        {options.length > 12 ? (
          <label className="facet-search">
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Find ${label.toLocaleLowerCase()}`}
              aria-label={`Search ${label.toLocaleLowerCase()} options`}
            />
          </label>
        ) : null}
        <div className="facet-options">
          {visibleOptions.map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
              />
              <span>{formatOption(option)}</span>
              <small>{counts.get(option) || 0}</small>
            </label>
          ))}
          {!visibleOptions.length ? <p>No matching options</p> : null}
        </div>
      </div>
    </details>
  );
}

function NumericFilter({
  label,
  filter,
  onChange,
  units,
  availableCount,
}: {
  label: string;
  filter: NumericFilterState;
  onChange: (next: NumericFilterState) => void;
  units: EngineeringUnit[];
  availableCount?: number;
}) {
  const isUsable = filter.active && filter.value.trim() !== "";
  return (
    <div className={cx("numeric-filter", isUsable && "is-active")}>
      <div className="numeric-filter-heading">
        <label>
          <input
            type="checkbox"
            checked={filter.active}
            onChange={(event) => onChange({ ...filter, active: event.target.checked })}
          />
          <span>{label}</span>
        </label>
        <small>{availableCount ? `${availableCount} recorded` : `±${filter.tolerance}%`}</small>
      </div>
      <div className="numeric-filter-controls">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={filter.value}
          placeholder="Target"
          aria-label={`${label} target value`}
          onChange={(event) => onChange({
            ...filter,
            value: event.target.value,
            active: event.target.value !== "" ? true : filter.active,
          })}
        />
        {units.length > 1 ? (
          <select
            value={filter.unit}
            aria-label={`${label} unit`}
            onChange={(event) => onChange({ ...filter, unit: event.target.value as EngineeringUnit })}
          >
            {units.map((unit) => <option key={unit}>{unit}</option>)}
          </select>
        ) : <span className="fixed-unit">{units[0]}</span>}
        <label className="tolerance-control">
          <span>±{filter.tolerance}%</span>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={filter.tolerance}
            aria-label={`${label} tolerance percentage`}
            onChange={(event) => onChange({ ...filter, tolerance: Number(event.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}

function FilterWorkbench({
  filters,
  onChange,
  categories,
  modulations,
  locations,
  versions,
  counts,
  acfCount,
  resultCount,
}: {
  filters: FiltersState;
  onChange: (next: FiltersState) => void;
  categories: string[];
  modulations: string[];
  locations: string[];
  versions: string[];
  counts: {
    categories: Map<string, number>;
    modulations: Map<string, number>;
    locations: Map<string, number>;
    versions: Map<string, number>;
  };
  acfCount: number;
  resultCount: number;
}) {
  const activeCount = countActiveFilterGroups(filters);
  const quickCategories = ["Digital", "Military", "Amateur Radio", "Radar", "Satellite"]
    .filter((category) => categories.includes(category));
  const setNumeric = (key: "frequency" | "bandwidth" | "acf", next: NumericFilterState) =>
    onChange({ ...filters, [key]: next });
  const toggleCategory = (category: string) => onChange({
    ...filters,
    categories: filters.categories.includes(category)
      ? filters.categories.filter((value) => value !== category)
      : [...filters.categories, category],
  });

  return (
    <section className="filter-workbench" aria-label="Signal filters">
      <div className="filter-workbench-heading">
        <span><SlidersHorizontal size={14} /> Filters</span>
        <output aria-live="polite">{resultCount} matches</output>
        <button disabled={!activeCount} onClick={() => onChange(createDefaultFilters())}>Reset</button>
      </div>
      <div className="filter-workbench-body">
        <div className="category-shortcuts" aria-label="Category shortcuts">
          {quickCategories.map((category) => (
            <button
              className={filters.categories.includes(category) ? "is-active" : ""}
              key={category}
              aria-pressed={filters.categories.includes(category)}
              onClick={() => toggleCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="numeric-filters">
          <NumericFilter
            label="Frequency"
            filter={filters.frequency}
            onChange={(next) => setNumeric("frequency", next)}
            units={["Hz", "kHz", "MHz", "GHz"]}
          />
          <NumericFilter
            label="Bandwidth"
            filter={filters.bandwidth}
            onChange={(next) => setNumeric("bandwidth", next)}
            units={["Hz", "kHz", "MHz", "GHz"]}
          />
          <NumericFilter
            label="ACF"
            filter={filters.acf}
            onChange={(next) => setNumeric("acf", next)}
            units={["ms"]}
            availableCount={acfCount}
          />
        </div>

        <div className="facet-grid">
          <FacetFilter
            label="Category / tag"
            options={categories}
            selected={filters.categories}
            counts={counts.categories}
            onChange={(categories) => onChange({ ...filters, categories })}
          />
          <FacetFilter
            label="Modulation"
            options={modulations}
            selected={filters.modulations}
            counts={counts.modulations}
            onChange={(modulations) => onChange({ ...filters, modulations })}
          />
          <FacetFilter
            label="Location"
            options={locations}
            selected={filters.locations}
            counts={counts.locations}
            onChange={(locations) => onChange({ ...filters, locations })}
          />
          <FacetFilter
            label="DB version"
            options={versions}
            selected={filters.versions}
            counts={counts.versions}
            onChange={(versions) => onChange({ ...filters, versions })}
            formatOption={(version) => `v${version}`}
          />
        </div>

        <label className="band-shortcut">
          <span>RF band shortcut <small>Web convenience</small></span>
          <select value={filters.band} onChange={(event) => onChange({ ...filters, band: event.target.value })}>
            <option value="">Any band</option>
            {RF_BANDS.map((band) => <option key={band.label}>{band.label}</option>)}
          </select>
        </label>
        <p className="filter-logic">Matches any checked option within a filter and every active filter together.</p>
      </div>
    </section>
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
  const [filters, setFilters] = useState<FiltersState>(() => createDefaultFilters());
  const [selectedId, setSelectedId] = useState("5803");
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [customSignals, setCustomSignals] = useState<SignalRecord[]>([]);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [newSignalOpen, setNewSignalOpen] = useState(false);
  const [weather, setWeather] = useState<SpaceWeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const allSignals = useMemo(() => [...customSignals, ...BASE_SIGNALS], [customSignals]);
  const signalIndex = useMemo(() => buildSignalIndex(allSignals), [allSignals]);
  const filterMetadata = useMemo(() => {
    const categories = new Map<string, number>();
    const modulations = new Map<string, number>();
    const locations = new Map<string, number>();
    const versions = new Map<string, number>();
    let acfCount = 0;
    const increment = (map: Map<string, number>, value: string) =>
      map.set(value, (map.get(value) || 0) + 1);

    allSignals.forEach((signal) => {
      new Set(signal.category).forEach((value) => increment(categories, value));
      new Set(textValues(signal.modulation)).forEach((value) => increment(modulations, value));
      new Set(textValues(signal.location)).forEach((value) => increment(locations, value));
      increment(versions, String(signal.added_since));
      if (signal.acf.length) acfCount += 1;
    });

    return {
      options: {
        categories: Array.from(categories.keys()).sort(),
        modulations: Array.from(modulations.keys()).sort(),
        locations: Array.from(locations.keys()).sort(),
        versions: Array.from(versions.keys()).sort((a, b) => Number(b) - Number(a)),
      },
      counts: { categories, modulations, locations, versions },
      acfCount,
    };
  }, [allSignals]);

  const filteredSignals = useMemo(() => {
    return filterSignals({
      signals: allSignals,
      index: signalIndex,
      query: deferredQuery,
      filters,
      savedOnly: view === "saved",
      bookmarks,
    });
  }, [allSignals, bookmarks, deferredQuery, filters, signalIndex, view]);

  const selected =
    filteredSignals.find((signal) => signal.pageid === selectedId) || filteredSignals[0] || null;

  const activeFilterCount = countActiveFilterGroups(filters);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("artemis-saved") || "[]") as string[];
        const local = JSON.parse(localStorage.getItem("artemis-custom-signals") || "[]") as SignalRecord[];
        setBookmarks(new Set(saved));
        setCustomSignals(Array.isArray(local) ? local : []);
      } catch {
        // A corrupted local preference should never block the reference library.
      }
    });
    return () => cancelAnimationFrame(frame);
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
      const inInteractiveControl = Boolean(target.closest("input, textarea, select, button, a, summary, [contenteditable='true']"));
      if (event.key === "/" && !inInteractiveControl) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setDocumentsOpen(false);
        setDatabaseOpen(false);
        setNewSignalOpen(false);
      }
      if (!inInteractiveControl && view !== "weather" && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
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

  function changeView(next: ViewName) {
    setView(next);
    setMobileDetailOpen(false);
    if (next === "weather") setQuery("");
    if (next === "weather" && !weather && !weatherLoading) void loadWeather();
  }

  const selectSignal = useCallback((signal: SignalRecord) => {
    setSelectedId(signal.pageid);
    setMobileDetailOpen(true);
  }, []);

  const toggleBookmark = useCallback(() => {
    if (!selected) return;
    setBookmarks((current) => {
      const next = new Set(current);
      if (next.has(selected.pageid)) next.delete(selected.pageid);
      else next.add(selected.pageid);
      return next;
    });
  }, [selected]);

  const closeMobileDetail = useCallback(() => setMobileDetailOpen(false), []);
  const openDocuments = useCallback(() => setDocumentsOpen(true), []);

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
          <FilterWorkbench
            filters={filters}
            onChange={setFilters}
            categories={filterMetadata.options.categories}
            modulations={filterMetadata.options.modulations}
            locations={filterMetadata.options.locations}
            versions={filterMetadata.options.versions}
            counts={filterMetadata.counts}
            acfCount={filterMetadata.acfCount}
            resultCount={filteredSignals.length}
          />

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
            </div>

            <div className="results-heading">
              <span>
                <strong>{filteredSignals.length}</strong> {view === "saved" ? "saved" : "signals"}
              </span>
              {activeFilterCount ? <span>{activeFilterCount} FILTERS ACTIVE</span> : <span>NAME / FREQUENCY</span>}
            </div>

            <SignalList signals={filteredSignals} selectedId={selected?.pageid || ""} bookmarks={bookmarks} onSelect={selectSignal} />

            <button className="add-signal-button" onClick={() => setNewSignalOpen(true)}>
              <Plus size={17} /> Add field observation
            </button>
          </aside>

          <div className="detail-workspace">
            {selected ? (
              <>
                <SignalDetail
                  signal={selected}
                  saved={bookmarks.has(selected.pageid)}
                  onToggleSaved={toggleBookmark}
                  onBack={closeMobileDetail}
                  onOpenDocuments={openDocuments}
                />
                <MediaPanel signal={selected} onOpenDocuments={openDocuments} />
              </>
            ) : (
              <div className="empty-detail">
                <Search size={30} />
                <strong>No matching signal</strong>
                <span>Adjust the persistent filters to bring signals back into view.</span>
              </div>
            )}
          </div>
        </main>
      )}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton active={view === "library"} icon={<Library size={19} />} label="Signals" onClick={() => changeView("library")} />
        <NavButton active={view === "saved"} icon={<Bookmark size={19} />} label="Saved" badge={bookmarks.size} onClick={() => changeView("saved")} />
        <NavButton active={view === "weather"} icon={<CloudSun size={20} />} label="Weather" onClick={() => changeView("weather")} />
        <NavButton active={databaseOpen} icon={<Database size={19} />} label="Database" onClick={() => setDatabaseOpen(true)} />
      </nav>

      {documentsOpen && selected ? <DocumentsModal signal={selected} onClose={() => setDocumentsOpen(false)} /> : null}
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
