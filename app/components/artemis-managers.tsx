"use client";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Database,
  Download,
  ExternalLink,
  File,
  FileAudio,
  FileImage,
  FileText,
  HelpCircle,
  Info,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../artemis-managers.css";

export type ManagerAction = void | Promise<void>;

export type ManagedDatabase = {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  editable: boolean;
  isSigid?: boolean;
  signalCount: number;
  documentCount: number;
  imageCount: number;
  audioCount: number;
};

export type DatabaseUpdateState = "idle" | "checking" | "available" | "current" | "error";

export type DatabaseManagerModalProps = {
  databases: ManagedDatabase[];
  currentDatabaseId: string | null;
  onClose: () => void;
  onCreate: (name: string) => ManagerAction;
  onLoad: (databaseId: string) => ManagerAction;
  onRename: (databaseId: string, name: string) => ManagerAction;
  onDelete: (databaseId: string) => ManagerAction;
  onImport: (file: File) => ManagerAction;
  onExport: (databaseId: string) => ManagerAction;
  onCheckUpdates: () => ManagerAction;
  updateState?: DatabaseUpdateState;
  updateMessage?: string;
};

export type EngineeringUnit = "Hz" | "kHz" | "MHz" | "GHz" | "ms";
export type ParameterKind = "Frequency" | "Bandwidth" | "Modulation" | "Mode" | "ACF" | "Location";

export type ManagedParameter = {
  id: string;
  value: string;
  description: string;
  unit?: EngineeringUnit;
};

export type ManagedTag = {
  id: string;
  name: string;
  signalCount?: number;
};

export type ManagedSignal = {
  id: string;
  name: string;
  description: string;
  sinceVersion?: number | null;
  categoryIds: string[];
  parameters: Record<ParameterKind, ManagedParameter[]>;
};

export type SignalEditorModalProps = {
  signal?: ManagedSignal | null;
  categories: ManagedTag[];
  onClose: () => void;
  onSave: (signal: ManagedSignal) => ManagerAction;
  onDelete?: (signalId: string) => ManagerAction;
};

export type TagManagerModalProps = {
  tags: ManagedTag[];
  onClose: () => void;
  onAdd: (name: string) => ManagerAction;
  onRename: (tagId: string, name: string) => ManagerAction;
  onDelete: (tagId: string) => ManagerAction;
};

export type ManagedDocumentType = "Image" | "Audio" | "Document" | "Other";

export type ManagedDocument = {
  id: string;
  name: string;
  description: string;
  type: ManagedDocumentType;
  fileName: string;
  extension: string;
  dataUrl?: string;
  url?: string;
  preview: boolean;
};

export type NewManagedDocument = Omit<ManagedDocument, "id">;

export type DocumentsManagerModalProps = {
  signalName: string;
  documents: ManagedDocument[];
  onClose: () => void;
  onAdd: (document: NewManagedDocument) => ManagerAction;
  onUpdate: (document: ManagedDocument) => ManagerAction;
  onDelete: (documentId: string) => ManagerAction;
  onSetMain: (documentId: string, type: "Image" | "Audio") => ManagerAction;
  onOpen?: (document: ManagedDocument) => ManagerAction;
};

export const MATERIAL_ACCENTS = [
  "Red", "Pink", "Purple", "DeepPurple", "Indigo", "Blue", "LightBlue", "Cyan", "Teal",
  "Green", "LightGreen", "Lime", "Yellow", "Amber", "Orange", "DeepOrange", "Brown", "Grey",
  "BlueGrey",
] as const;

export type MaterialAccent = (typeof MATERIAL_ACCENTS)[number];
export type ManagedPreferences = {
  theme: "system" | "light" | "dark";
  accent: MaterialAccent;
  scale: number;
  autoloadLatest: boolean;
};

export type PreferencesModalProps = {
  preferences: ManagedPreferences;
  onClose: () => void;
  onSave: (preferences: ManagedPreferences) => ManagerAction;
};

export type AboutModalProps = {
  onClose: () => void;
  applicationVersion: string;
  databaseVersion?: number | null;
};

export type HelpMenuProps = {
  updateAvailable?: boolean;
  onCheckUpdates: () => ManagerAction;
  onOpenAbout: () => void;
  projectUrl?: string;
  documentationUrl?: string;
  releaseNotesUrl?: string;
  issueUrl?: string;
};

let generatedId = 0;
function newId(prefix: string) {
  generatedId += 1;
  return `${prefix}-${Date.now()}-${generatedId}`;
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The operation could not be completed.";
}

function ModalFrame({
  id,
  title,
  kicker,
  onClose,
  children,
  footer,
  size = "wide",
}: {
  id: string;
  title: string;
  kicker?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "compact" | "wide" | "full";
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const frame = requestAnimationFrame(() => {
      const preferred = dialog?.querySelector<HTMLElement>("[data-autofocus]");
      (preferred || closeRef.current)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )).filter((element) => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="am-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className={`am-modal am-modal--${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        ref={dialogRef}
      >
        <header className="am-modal__header">
          <div>
            {kicker ? <span className="am-eyebrow">{kicker}</span> : null}
            <h2 id={id}>{title}</h2>
          </div>
          <button ref={closeRef} className="am-icon-button" onClick={onClose} aria-label={`Close ${title}`}>
            <X size={19} />
          </button>
        </header>
        <div className="am-modal__body">{children}</div>
        {footer ? <footer className="am-modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return message ? <p className="am-error" role="alert"><AlertTriangle size={15} />{message}</p> : null;
}

function SpinnerLabel({ label }: { label: string }) {
  return <><LoaderCircle className="am-spin" size={16} />{label}</>;
}

export function DatabaseManagerModal({
  databases,
  currentDatabaseId,
  onClose,
  onCreate,
  onLoad,
  onRename,
  onDelete,
  onImport,
  onExport,
  onCheckUpdates,
  updateState = "idle",
  updateMessage,
}: DatabaseManagerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(currentDatabaseId || databases[0]?.id || "");
  const [mode, setMode] = useState<"none" | "create" | "rename" | "delete">("none");
  const [name, setName] = useState("");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");

  const effectiveSelectedId = databases.some((database) => database.id === selectedId)
    ? selectedId
    : currentDatabaseId || databases[0]?.id || "";
  const selected = databases.find((database) => database.id === effectiveSelectedId) || null;
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? databases.filter((database) => database.name.toLocaleLowerCase().includes(term)) : databases;
  }, [databases, search]);

  async function run(key: string, operation: () => ManagerAction) {
    setError("");
    setWorking(key);
    try {
      await operation();
      setMode("none");
      setName("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  }

  function startRename() {
    if (!selected) return;
    setName(selected.name);
    setMode("rename");
  }

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await run("import", () => onImport(file));
  }

  const updateCopy = updateState === "checking"
    ? "Checking…"
    : updateState === "available"
      ? "Update available"
      : updateState === "current"
        ? "Up to date"
        : "Check for updates";

  return (
    <ModalFrame id="am-database-title" title="Database manager" kicker="ARTEMIS LIBRARIES" onClose={onClose} size="full">
      <div className="am-manager-grid">
        <aside className="am-manager-list">
          <label className="am-search">
            <Search size={15} />
            <input data-autofocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search databases" aria-label="Search databases" />
          </label>
          <div className="am-listbox" role="listbox" aria-label="Databases">
            {visible.map((database) => (
              <button
                key={database.id}
                className={cx("am-list-row", effectiveSelectedId === database.id && "is-selected")}
                onClick={() => { setSelectedId(database.id); setMode("none"); }}
                role="option"
                aria-selected={effectiveSelectedId === database.id}
              >
                <span className="am-list-row__icon"><Database size={17} /></span>
                <span><strong>{database.name}</strong><small>v{database.version} · {database.signalCount.toLocaleString()} signals</small></span>
                {database.id === currentDatabaseId ? <em>LOADED</em> : null}
              </button>
            ))}
            {!visible.length ? <p className="am-empty">No matching databases.</p> : null}
          </div>
          <button className="am-button am-button--primary am-full" onClick={() => { setName(""); setMode("create"); }}>
            <Plus size={16} /> New database
          </button>
        </aside>

        <section className="am-manager-detail">
          {selected ? (
            <>
              <div className="am-detail-heading">
                <div><span className="am-eyebrow">{selected.isSigid ? "SIGID REFERENCE" : "LOCAL DATABASE"}</span><h3>{selected.name}</h3></div>
                {selected.id === currentDatabaseId ? <span className="am-status-pill"><Check size={13} /> Loaded</span> : null}
              </div>
              <dl className="am-stat-grid">
                <div><dt>Version</dt><dd>v{selected.version}</dd></div>
                <div><dt>Created</dt><dd>{selected.createdAt}</dd></div>
                <div><dt>Signals</dt><dd>{selected.signalCount.toLocaleString()}</dd></div>
                <div><dt>Documents</dt><dd>{selected.documentCount.toLocaleString()}</dd></div>
                <div><dt>Images</dt><dd>{selected.imageCount.toLocaleString()}</dd></div>
                <div><dt>Audio</dt><dd>{selected.audioCount.toLocaleString()}</dd></div>
              </dl>
              <div className="am-action-row">
                <button className="am-button am-button--primary" disabled={working !== "" || selected.id === currentDatabaseId} onClick={() => run("load", () => onLoad(selected.id))}>
                  {working === "load" ? <SpinnerLabel label="Loading" /> : <><Database size={16} /> Load</>}
                </button>
                <button className="am-button" disabled={working !== ""} onClick={() => run("export", () => onExport(selected.id))}>
                  {working === "export" ? <SpinnerLabel label="Exporting" /> : <><Download size={16} /> Export</>}
                </button>
                <button className="am-button" disabled={working !== "" || !selected.editable} onClick={startRename}><Pencil size={16} /> Rename</button>
                <button className="am-button am-button--danger" disabled={working !== "" || !selected.editable} onClick={() => setMode("delete")}><Trash2 size={16} /> Delete</button>
              </div>
            </>
          ) : <p className="am-empty am-empty--large">Create or import a database to begin.</p>}

          {mode === "create" || mode === "rename" ? (
            <form className="am-inline-editor" onSubmit={(event) => {
              event.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return;
              void run(mode, () => mode === "create" ? onCreate(trimmed) : onRename(effectiveSelectedId, trimmed));
            }}>
              <label><span>{mode === "create" ? "Database name" : "New name"}</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <button className="am-button am-button--primary" disabled={working !== ""} type="submit"><Save size={15} /> Save</button>
              <button className="am-button" type="button" onClick={() => setMode("none")}>Cancel</button>
            </form>
          ) : null}

          {mode === "delete" && selected ? (
            <div className="am-confirm" role="alertdialog" aria-labelledby="am-delete-db-title">
              <AlertTriangle size={20} />
              <div><strong id="am-delete-db-title">Delete {selected.name}?</strong><p>This removes its signals and attached files from this device. This cannot be undone.</p></div>
              <button className="am-button am-button--danger" disabled={working !== ""} onClick={() => run("delete", () => onDelete(selected.id))}>Delete database</button>
              <button className="am-button" onClick={() => setMode("none")}>Cancel</button>
            </div>
          ) : null}

          <ErrorNotice message={error} />
          <div className="am-database-tools">
            <label className={cx("am-button", working !== "" && "is-disabled")}><Upload size={16} /> Import Artemis JSON<input type="file" accept=".json,application/json" disabled={working !== ""} onChange={importFile} /></label>
            <button className="am-button" disabled={working !== "" || updateState === "checking"} onClick={() => run("updates", onCheckUpdates)}>
              <RefreshCw className={updateState === "checking" ? "am-spin" : ""} size={16} /> {updateCopy}
            </button>
            {updateMessage ? <small className={`am-update am-update--${updateState}`}>{updateMessage}</small> : null}
          </div>
        </section>
      </div>
    </ModalFrame>
  );
}

const PARAMETER_KINDS: ParameterKind[] = ["Frequency", "Bandwidth", "Modulation", "Mode", "ACF", "Location"];
const FREQUENCY_UNITS: EngineeringUnit[] = ["Hz", "kHz", "MHz", "GHz"];

function emptyParameters(): Record<ParameterKind, ManagedParameter[]> {
  return { Frequency: [], Bandwidth: [], Modulation: [], Mode: [], ACF: [], Location: [] };
}

function cloneSignal(signal?: ManagedSignal | null): ManagedSignal {
  if (!signal) {
    return { id: newId("signal"), name: "", description: "", sinceVersion: null, categoryIds: [], parameters: emptyParameters() };
  }
  return {
    ...signal,
    categoryIds: [...signal.categoryIds],
    parameters: Object.fromEntries(PARAMETER_KINDS.map((kind) => [kind, signal.parameters[kind].map((parameter) => ({ ...parameter }))])) as Record<ParameterKind, ManagedParameter[]>,
  };
}

export function SignalEditorModal({ signal, categories, onClose, onSave, onDelete }: SignalEditorModalProps) {
  const [draft, setDraft] = useState<ManagedSignal>(() => cloneSignal(signal));
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !signal;

  function updateParameter(kind: ParameterKind, id: string, patch: Partial<ManagedParameter>) {
    setDraft((current) => ({
      ...current,
      parameters: { ...current.parameters, [kind]: current.parameters[kind].map((item) => item.id === id ? { ...item, ...patch } : item) },
    }));
  }

  function addParameter(kind: ParameterKind) {
    const unit = kind === "Frequency" || kind === "Bandwidth" ? "kHz" : kind === "ACF" ? "ms" : undefined;
    const parameter: ManagedParameter = { id: newId(kind.toLocaleLowerCase()), value: "", description: "", unit };
    setDraft((current) => ({ ...current, parameters: { ...current.parameters, [kind]: [...current.parameters[kind], parameter] } }));
  }

  function removeParameter(kind: ParameterKind, id: string) {
    setDraft((current) => ({ ...current, parameters: { ...current.parameters, [kind]: current.parameters[kind].filter((item) => item.id !== id) } }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) return;
    setError("");
    setWorking("save");
    try {
      await onSave({ ...draft, name: draft.name.trim() });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  }

  async function deleteSignal() {
    if (!signal || !onDelete) return;
    setWorking("delete");
    setError("");
    try {
      await onDelete(signal.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  }

  return (
    <ModalFrame
      id="am-signal-editor-title"
      title={isNew ? "New signal" : `Edit ${signal.name}`}
      kicker="SIGNAL EDITOR"
      onClose={onClose}
      size="full"
      footer={<>
        {!isNew && onDelete ? <button className="am-button am-button--danger am-push-left" onClick={() => setConfirmDelete(true)}><Trash2 size={16} /> Delete signal</button> : null}
        <button className="am-button" onClick={onClose}>Cancel</button>
        <button className="am-button am-button--primary" type="submit" form="am-signal-form" disabled={working !== ""}>{working === "save" ? <SpinnerLabel label="Saving" /> : <><Save size={16} /> Save signal</>}</button>
      </>}
    >
      <form id="am-signal-form" className="am-signal-form" onSubmit={save}>
        <section className="am-form-section">
          <div className="am-form-grid">
            <label className="am-field am-field--wide"><span>Signal name</span><input data-autofocus required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label className="am-field"><span>Introduced in DB version</span><input type="number" min="0" value={draft.sinceVersion ?? ""} onChange={(event) => setDraft({ ...draft, sinceVersion: event.target.value === "" ? null : Number(event.target.value) })} /></label>
            <label className="am-field am-field--full"><span>Description <small>Markdown supported</small></span><textarea rows={7} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          </div>
        </section>

        <section className="am-form-section">
          <div className="am-section-title"><div><span className="am-eyebrow">CLASSIFICATION</span><h3>Categories</h3></div><Tag size={18} /></div>
          <div className="am-check-grid">
            {categories.map((category) => (
              <label key={category.id}><input type="checkbox" checked={draft.categoryIds.includes(category.id)} onChange={() => setDraft((current) => ({ ...current, categoryIds: current.categoryIds.includes(category.id) ? current.categoryIds.filter((id) => id !== category.id) : [...current.categoryIds, category.id] }))} /><span>{category.name}</span></label>
            ))}
            {!categories.length ? <p className="am-empty">Create tags in the Tag manager, then attach them here.</p> : null}
          </div>
        </section>

        <section className="am-form-section">
          <div className="am-section-title"><div><span className="am-eyebrow">SIGNATURE</span><h3>Signal parameters</h3></div><Settings size={18} /></div>
          <div className="am-parameter-groups">
            {PARAMETER_KINDS.map((kind) => (
              <details className="am-parameter-group" key={kind} open={draft.parameters[kind].length > 0}>
                <summary><span>{kind}</span><small>{draft.parameters[kind].length} {draft.parameters[kind].length === 1 ? "value" : "values"}</small><ChevronDown size={16} /></summary>
                <div className="am-parameter-list">
                  {draft.parameters[kind].map((parameter, index) => (
                    <div className="am-parameter-row" key={parameter.id}>
                      <label><span>{kind} {index + 1}</span><input type={kind === "Frequency" || kind === "Bandwidth" || kind === "ACF" ? "number" : "text"} min={kind === "Frequency" || kind === "Bandwidth" || kind === "ACF" ? "0" : undefined} step="any" value={parameter.value} onChange={(event) => updateParameter(kind, parameter.id, { value: event.target.value })} /></label>
                      {kind === "Frequency" || kind === "Bandwidth" ? (
                        <label className="am-unit"><span>Unit</span><select value={parameter.unit || "kHz"} onChange={(event) => updateParameter(kind, parameter.id, { unit: event.target.value as EngineeringUnit })}>{FREQUENCY_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
                      ) : kind === "ACF" ? <span className="am-fixed-unit">ms</span> : null}
                      <label className="am-description"><span>Description</span><input value={parameter.description} onChange={(event) => updateParameter(kind, parameter.id, { description: event.target.value })} placeholder="Optional context" /></label>
                      <button className="am-icon-button am-icon-button--danger" type="button" onClick={() => removeParameter(kind, parameter.id)} aria-label={`Remove ${kind} ${index + 1}`}><Trash2 size={16} /></button>
                    </div>
                  ))}
                  {!draft.parameters[kind].length ? <p className="am-empty">No {kind.toLocaleLowerCase()} values recorded.</p> : null}
                  <button className="am-button am-button--small" type="button" onClick={() => addParameter(kind)}><Plus size={14} /> Add {kind}</button>
                </div>
              </details>
            ))}
          </div>
        </section>
        <ErrorNotice message={error} />
      </form>

      {confirmDelete ? (
        <div className="am-confirm am-confirm--overlay" role="alertdialog" aria-labelledby="am-delete-signal-title">
          <AlertTriangle size={22} />
          <div><strong id="am-delete-signal-title">Delete {signal?.name}?</strong><p>All of its parameters, categories, and documents will also be removed.</p></div>
          <button className="am-button am-button--danger" disabled={working !== ""} onClick={deleteSignal}>{working === "delete" ? <SpinnerLabel label="Deleting" /> : "Delete signal"}</button>
          <button className="am-button" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      ) : null}
    </ModalFrame>
  );
}

export function TagManagerModal({ tags, onClose, onAdd, onRename, onDelete }: TagManagerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(tags[0]?.id || "");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState(tags[0]?.name || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const effectiveSelectedId = tags.some((tag) => tag.id === selectedId) ? selectedId : tags[0]?.id || "";
  const selected = tags.find((tag) => tag.id === effectiveSelectedId) || null;
  const visible = tags.filter((tag) => tag.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  async function run(key: string, operation: () => ManagerAction) {
    setWorking(key);
    setError("");
    try {
      await operation();
      if (key === "add") setNewName("");
      if (key === "delete") setConfirmDelete(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  }

  return (
    <ModalFrame id="am-tag-title" title="Tag manager" kicker="CATEGORIES" onClose={onClose}>
      <div className="am-manager-grid am-manager-grid--compact">
        <aside className="am-manager-list">
          <label className="am-search"><Search size={15} /><input data-autofocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tags" /></label>
          <div className="am-listbox" role="listbox" aria-label="Tags">
            {visible.map((item) => <button className={cx("am-list-row", item.id === effectiveSelectedId && "is-selected")} role="option" aria-selected={item.id === effectiveSelectedId} key={item.id} onClick={() => { setSelectedId(item.id); setRename(item.name); }}><span className="am-list-row__icon"><Tag size={16} /></span><span><strong>{item.name}</strong><small>{item.signalCount ?? 0} signals</small></span></button>)}
          </div>
          <form className="am-stack-form" onSubmit={(event) => { event.preventDefault(); if (newName.trim()) void run("add", () => onAdd(newName.trim())); }}>
            <label><span>New tag</span><input value={newName} onChange={(event) => setNewName(event.target.value)} /></label>
            <button className="am-button am-button--primary" disabled={working !== "" || !newName.trim()}><Plus size={15} /> Add</button>
          </form>
        </aside>
        <section className="am-manager-detail">
          {selected ? <>
            <div className="am-detail-heading"><div><span className="am-eyebrow">SELECTED TAG</span><h3>{selected.name}</h3></div></div>
            <form className="am-stack-form" onSubmit={(event) => { event.preventDefault(); if (rename.trim()) void run("rename", () => onRename(selected.id, rename.trim())); }}>
              <label><span>Tag name</span><input value={rename} onChange={(event) => setRename(event.target.value)} /></label>
              <div className="am-action-row"><button className="am-button am-button--primary" disabled={working !== "" || !rename.trim()}><Save size={15} /> Rename</button><button type="button" className="am-button am-button--danger" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete</button></div>
            </form>
            {confirmDelete ? <div className="am-confirm" role="alertdialog" aria-labelledby="am-delete-tag-title"><AlertTriangle size={20} /><div><strong id="am-delete-tag-title">Delete {selected.name}?</strong><p>This removes the tag from every associated signal.</p></div><button className="am-button am-button--danger" onClick={() => run("delete", () => onDelete(selected.id))}>Delete tag</button><button className="am-button" onClick={() => setConfirmDelete(false)}>Cancel</button></div> : null}
          </> : <p className="am-empty am-empty--large">Select a tag to rename or delete it.</p>}
          <ErrorNotice message={error} />
        </section>
      </div>
    </ModalFrame>
  );
}

const DOCUMENT_TYPES: ManagedDocumentType[] = ["Image", "Audio", "Document", "Other"];
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function documentIcon(type: ManagedDocumentType) {
  if (type === "Image") return <FileImage size={17} />;
  if (type === "Audio") return <FileAudio size={17} />;
  if (type === "Document") return <FileText size={17} />;
  return <File size={17} />;
}

function inferDocumentType(file: File): ManagedDocumentType {
  if (file.type.startsWith("image/")) return "Image";
  if (file.type.startsWith("audio/")) return "Audio";
  if (/pdf|text|document|sheet|presentation|xml|csv|json/.test(file.type)) return "Document";
  return "Other";
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}

export function DocumentsManagerModal({ signalName, documents, onClose, onAdd, onUpdate, onDelete, onSetMain, onOpen }: DocumentsManagerModalProps) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(documents[0]?.id || "");
  const [mode, setMode] = useState<"view" | "add" | "edit" | "delete">("view");
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [fileDraft, setFileDraft] = useState<NewManagedDocument | null>(null);
  const [editDraft, setEditDraft] = useState<ManagedDocument | null>(null);
  const effectiveSelectedId = documents.some((document) => document.id === selectedId) ? selectedId : documents[0]?.id || "";
  const selected = documents.find((document) => document.id === effectiveSelectedId) || null;
  const term = search.trim().toLocaleLowerCase();
  const visible = documents.filter((document) => !term || `${document.name} ${document.description} ${document.fileName}`.toLocaleLowerCase().includes(term));
  const source = selected?.dataUrl || selected?.url || "";

  async function run(key: string, operation: () => ManagerAction) {
    setWorking(key);
    setError("");
    try {
      await operation();
      setMode("view");
      setFileDraft(null);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("Attachments are limited to 8 MiB so their complete contents can be stored and exported safely.");
      return;
    }
    setWorking("read");
    setError("");
    try {
      const dataUrl = await fileToDataUrl(file);
      const extension = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
      setFileDraft({ name: file.name.replace(/\.[^.]+$/, ""), description: "", type: inferDocumentType(file), fileName: file.name, extension, dataUrl, preview: false });
      setMode("add");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking("");
    }
  }

  function startEdit() {
    if (!selected) return;
    setEditDraft({ ...selected });
    setMode("edit");
  }

  async function openDocument() {
    if (!selected) return;
    if (source) window.open(source, "_blank", "noopener,noreferrer");
    else if (onOpen) await run("open", () => onOpen(selected));
  }

  return (
    <ModalFrame id="am-documents-title" title="Documents manager" kicker={signalName} onClose={onClose} size="full">
      <div className="am-manager-grid">
        <aside className="am-manager-list">
          <label className="am-search"><Search size={15} /><input data-autofocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" /></label>
          <div className="am-listbox am-listbox--grouped" role="listbox" aria-label="Documents">
            {DOCUMENT_TYPES.map((type) => {
              const group = visible.filter((document) => document.type === type);
              if (!group.length) return null;
              return <div className="am-list-group" key={type}><h4>{type}</h4>{group.map((document) => <button className={cx("am-list-row", document.id === effectiveSelectedId && "is-selected")} role="option" aria-selected={document.id === effectiveSelectedId} key={document.id} onClick={() => { setSelectedId(document.id); setMode("view"); }}><span className="am-list-row__icon">{documentIcon(document.type)}</span><span><strong>{document.name}</strong><small>{document.fileName}</small></span>{document.preview ? <em>MAIN</em> : null}</button>)}</div>;
            })}
            {!visible.length ? <p className="am-empty">No matching documents.</p> : null}
          </div>
          <label className={cx("am-button am-button--primary am-full", working !== "" && "is-disabled")}><Upload size={16} /> {working === "read" ? "Reading file…" : "Add file"}<input type="file" disabled={working !== ""} onChange={chooseFile} /></label>
        </aside>

        <section className="am-manager-detail">
          {mode === "add" && fileDraft ? (
            <form className="am-stack-form" onSubmit={(event) => { event.preventDefault(); void run("add", () => onAdd(fileDraft)); }}>
              <div className="am-detail-heading"><div><span className="am-eyebrow">NEW DOCUMENT</span><h3>{fileDraft.fileName}</h3></div></div>
              <label><span>Name</span><input value={fileDraft.name} required onChange={(event) => setFileDraft({ ...fileDraft, name: event.target.value })} /></label>
              <label><span>Type</span><select value={fileDraft.type} onChange={(event) => setFileDraft({ ...fileDraft, type: event.target.value as ManagedDocumentType })}>{DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label><span>Description</span><textarea rows={7} value={fileDraft.description} onChange={(event) => setFileDraft({ ...fileDraft, description: event.target.value })} /></label>
              <div className="am-action-row"><button className="am-button am-button--primary" disabled={working !== ""}><Save size={15} /> Add document</button><button type="button" className="am-button" onClick={() => { setMode("view"); setFileDraft(null); }}>Cancel</button></div>
            </form>
          ) : mode === "edit" && editDraft ? (
            <form className="am-stack-form" onSubmit={(event) => { event.preventDefault(); void run("edit", () => onUpdate(editDraft)); }}>
              <div className="am-detail-heading"><div><span className="am-eyebrow">EDIT DOCUMENT</span><h3>{editDraft.fileName}</h3></div></div>
              <label><span>Name</span><input value={editDraft.name} required onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} /></label>
              <label><span>Type</span><select value={editDraft.type} onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value as ManagedDocumentType, preview: ["Image", "Audio"].includes(event.target.value) ? editDraft.preview : false })}>{DOCUMENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label><span>Description</span><textarea rows={7} value={editDraft.description} onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })} /></label>
              <div className="am-action-row"><button className="am-button am-button--primary" disabled={working !== ""}><Save size={15} /> Save changes</button><button type="button" className="am-button" onClick={() => setMode("view")}>Cancel</button></div>
            </form>
          ) : selected ? (
            <>
              <div className="am-detail-heading"><div><span className="am-eyebrow">{selected.type}</span><h3>{selected.name}</h3><small>{selected.fileName}</small></div>{selected.preview ? <span className="am-status-pill"><Check size={13} /> Main preview</span> : null}</div>
              <p className="am-document-description">{selected.description || "No description provided."}</p>
              {/* Local data URLs and imported document URLs must remain directly renderable. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {selected.type === "Image" && source ? <img className="am-document-preview" src={source} alt={`Preview of ${selected.name}`} /> : null}
              {selected.type === "Audio" && source ? <audio className="am-audio-preview" controls preload="metadata" src={source} /> : null}
              {(selected.type === "Image" || selected.type === "Audio") ? <label className="am-main-switch"><input type="radio" name={`main-${selected.type}`} checked={selected.preview} onChange={() => run("preview", () => onSetMain(selected.id, selected.type as "Image" | "Audio"))} /><span>Use as the main {selected.type.toLocaleLowerCase()} preview</span></label> : null}
              <div className="am-action-row">
                <button className="am-button am-button--primary" onClick={openDocument}><ExternalLink size={15} /> Open</button>
                {source ? <a className="am-button" href={source} download={selected.fileName}><Download size={15} /> Download</a> : null}
                <button className="am-button" onClick={startEdit}><Pencil size={15} /> Edit</button>
                <button className="am-button am-button--danger" onClick={() => setMode("delete")}><Trash2 size={15} /> Delete</button>
              </div>
            </>
          ) : <p className="am-empty am-empty--large">Add a file to this signal to begin.</p>}

          {mode === "delete" && selected ? <div className="am-confirm am-confirm--overlay" role="alertdialog" aria-labelledby="am-delete-document-title"><AlertTriangle size={20} /><div><strong id="am-delete-document-title">Delete {selected.name}?</strong><p>The stored file and its metadata will be removed.</p></div><button className="am-button am-button--danger" onClick={() => run("delete", () => onDelete(selected.id))}>Delete document</button><button className="am-button" onClick={() => setMode("view")}>Cancel</button></div> : null}
          <ErrorNotice message={error} />
        </section>
      </div>
    </ModalFrame>
  );
}

export function PreferencesModal({ preferences, onClose, onSave }: PreferencesModalProps) {
  const [draft, setDraft] = useState({ ...preferences });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const scales = Array.from({ length: 21 }, (_, index) => (0.5 + index * 0.05).toFixed(2));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      await onSave(draft);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setWorking(false);
    }
  }

  return (
    <ModalFrame id="am-preferences-title" title="Preferences" kicker="APPEARANCE & STARTUP" onClose={onClose} size="compact" footer={<><button className="am-button" onClick={onClose}>Cancel</button><button className="am-button am-button--primary" type="submit" form="am-preferences-form" disabled={working}>{working ? <SpinnerLabel label="Saving" /> : <><Save size={16} /> Save preferences</>}</button></>}>
      <form id="am-preferences-form" className="am-preferences" onSubmit={save}>
        <label><span>Material theme</span><select data-autofocus value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as ManagedPreferences["theme"] })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
        <label><span>Material accent</span><select value={draft.accent} onChange={(event) => setDraft({ ...draft, accent: event.target.value as MaterialAccent })}>{MATERIAL_ACCENTS.map((accent) => <option key={accent}>{accent}</option>)}</select></label>
        <label><span>Interface scaling</span><select value={draft.scale.toFixed(2)} onChange={(event) => setDraft({ ...draft, scale: Number(event.target.value) })}>{scales.map((scale) => <option key={scale} value={scale}>{scale}×</option>)}</select></label>
        <label className="am-toggle-row"><span><strong>Auto-load SigID database</strong><small>Open the latest installed version on startup.</small></span><input type="checkbox" checked={draft.autoloadLatest} onChange={(event) => setDraft({ ...draft, autoloadLatest: event.target.checked })} /></label>
        <ErrorNotice message={error} />
      </form>
    </ModalFrame>
  );
}

export function AboutModal({ onClose, applicationVersion, databaseVersion }: AboutModalProps) {
  return (
    <ModalFrame id="am-about-title" title="About Artemis" kicker="RF SIGNAL RECOGNITION MANUAL" onClose={onClose} size="compact">
      <div className="am-about">
        <span className="am-about__mark"><span /></span>
        <div><h3>Artemis <small>v{applicationVersion}</small></h3><p>Identify, document, and preserve radio-frequency signals with the community-maintained SigID reference library.</p></div>
        <dl><div><dt>Application</dt><dd>Web edition v{applicationVersion}</dd></div><div><dt>Loaded database</dt><dd>{databaseVersion == null ? "None" : `SigID v${databaseVersion}`}</dd></div><div><dt>License</dt><dd>GPL-3.0</dd></div></dl>
        <p className="am-about__copyright">Copyright © 2014–{new Date().getFullYear()} AresValley contributors.</p>
        <div className="am-action-row"><a className="am-button am-button--primary" href="https://github.com/AresValley/Artemis" target="_blank" rel="noreferrer"><ExternalLink size={15} /> Project source</a><a className="am-button" href="https://aresvalley.com" target="_blank" rel="noreferrer">AresValley</a></div>
      </div>
    </ModalFrame>
  );
}

export function HelpMenu({
  updateAvailable = false,
  onCheckUpdates,
  onOpenAbout,
  projectUrl = "https://aresvalley.com/",
  documentationUrl = "https://aresvalley.github.io/Artemis/",
  releaseNotesUrl = "https://github.com/AresValley/Artemis/blob/master/CHANGELOG.md",
  issueUrl = "https://github.com/AresValley/Artemis/issues",
}: HelpMenuProps) {
  return (
    <details className={cx("am-help-menu", updateAvailable && "has-update")}> 
      <summary aria-label="Open help menu"><HelpCircle size={19} /><span>Help</span>{updateAvailable ? <i /> : null}<ChevronDown size={14} /></summary>
      <div className="am-help-menu__popover">
        <button onClick={() => void onCheckUpdates()}><RefreshCw size={15} /><span>Check for updates</span>{updateAvailable ? <em>NEW</em> : null}</button>
        <hr />
        <a href={projectUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Project homepage</a>
        <a href={documentationUrl} target="_blank" rel="noreferrer"><FileText size={15} /> Documentation</a>
        <a href={releaseNotesUrl} target="_blank" rel="noreferrer"><Info size={15} /> Release notes</a>
        <a href={issueUrl} target="_blank" rel="noreferrer"><AlertTriangle size={15} /> Report an issue</a>
        <hr />
        <button onClick={onOpenAbout}><Info size={15} /> About Artemis</button>
      </div>
    </details>
  );
}
