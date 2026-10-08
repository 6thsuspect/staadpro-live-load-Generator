import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  ClipboardList,
  Columns3,
  Copy,
  Download,
  FilePlus2,
  FolderOpen,
  Grid2X2,
  Layers,
  LayoutDashboard,
  ListFilter,
  Maximize2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Route,
  Ruler,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Truck,
  Undo2,
  X,
  AlertTriangle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { initialProject, useStore } from "./store";
import { useGeneration } from "./hooks/useGeneration";
import { generate, parseProject } from "./engine/generate";
import type { Bridge, Rules, Vehicle, Mark } from "./engine/types";
import { CrossSection, fmt, PlanView } from "./components/Views";
import {
  download,
  exportCSV,
  exportExcel,
  fileName,
  parseNodes,
  staadText,
} from "./engine/export";

type Modal = "project" | "vehicle" | "export" | "settings" | "help" | null;
function IconButton({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${active ? "active" : ""}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={16} />
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  unit = "m",
  step = 0.25,
  min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  unit?: string;
  step?: number;
  min?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-unit">
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? NaN : Number(e.target.value))
          }
          step={step}
          min={min}
        />
        <span>{unit}</span>
      </div>
    </label>
  );
}
function PanelTitle({
  icon: Icon,
  title,
  tag,
}: {
  icon: LucideIcon;
  title: string;
  tag?: string;
}) {
  return (
    <div className="panel-title">
      <div>
        <Icon size={15} />
        <h3>{title}</h3>
      </div>
      {tag ? (
        <span className="micro-tag">{tag}</span>
      ) : (
        <ChevronDown size={14} />
      )}
    </div>
  );
}
export default function App() {
  const { project, update, setProject, undo, redo, history, future } =
    useStore();
  const b = project.bridge,
    r = project.rules,
    v = project.vehicles.find((v) => v.id === project.selectedVehicle)!;
  const [selected, setSelected] = useState(118),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(1),
    [zoom, setZoom] = useState(1),
    [grid, setGrid] = useState(true),
    [dimensions, setDimensions] = useState(true),
    [cursor, setCursor] = useState({ x: 0, y: 0 }),
    [modal, setModal] = useState<Modal>(null),
    [nav, setNav] = useState("Load position generator"),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [page, setPage] = useState(0),
    [coordTab, setCoordTab] = useState("Wheels"),
    [tableTab, setTableTab] = useState("All positions"),
    [draftVehicle, setDraftVehicle] = useState<Vehicle>(structuredClone(v)),
    [nodeText, setNodeText] = useState(""),
    [tolerance, setTolerance] = useState(0.001),
    [exportType, setExportType] = useState("csv"),
    [exportError, setExportError] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [generationTime, setGenerationTime] = useState(new Date().toISOString()),
    [approved, setApproved] = useState("");
  const fileRef = useRef<HTMLInputElement>(null),
    tableRef = useRef<HTMLDivElement>(null),
    bridgeRef = useRef<HTMLDivElement>(null),
    planRef = useRef<HTMLDivElement>(null);
  const modelKey = JSON.stringify([b, v, r]);
  const result = useGeneration(b, v, r, approved);
  const positions = result.positions,
    index = Math.min(selected, Math.max(0, positions.length - 1)),
    p = positions[index];
  const valid = positions.filter((p) => p.status === "valid").length,
    partial = positions.filter((p) => p.status === "partial").length,
    excluded = positions.filter(
      (p) => p.autoExcluded || project.marks[p.id]?.excluded,
    ).length;
  const filtered = useMemo(
    () =>
      positions.filter((p) => {
        const m = project.marks[p.id];
        return (
          `${p.id} ${v.name} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (filter === "all" || p.status === filter) &&
          (tableTab !== "Bookmarked" || m?.bookmark) &&
          (tableTab !== "Critical positions" || m?.critical || m?.governing)
        );
      }),
    [positions, search, filter, tableTab, project.marks, v.name],
  );
  const visible = filtered.slice(page * 8, page * 8 + 8);
  const notify = (s: string) => setToast(s);
  const patchBridge = (change: Partial<Bridge>) => {
    update({ bridge: { ...b, ...change }, marks: {} });
    setPlaying(false);
  };
  const patchRules = (change: Partial<Rules>) => {
    update({ rules: { ...r, ...change }, marks: {} });
    setPlaying(false);
  };
  const mark = (id: number, key: keyof Mark) =>
    update({
      marks: {
        ...project.marks,
        [id]: { ...project.marks[id], [key]: !project.marks[id]?.[key] },
      },
    });
  const save = () => {
    try {
      parseProject(JSON.stringify(project));
    } catch (error) {
      notify(`Unable to save: ${(error as Error).message}`);
      return;
    }
    download(
      `${fileName(project)}.staadllg`,
      JSON.stringify(project, null, 2),
      "application/json",
    );
    notify("Project saved with geometry, vehicles and generation settings.");
  };
  const newProject = () => {
    if (
      confirm(
        "Start a new project? Save your current project first if you want to keep it.",
      )
    ) {
      setProject(structuredClone(initialProject));
      setSelected(0);
      notify("New project created.");
    }
  };
  const openVehicle = () => {
    setDraftVehicle(structuredClone(v));
    setModal("vehicle");
  };
  const regenerate = () => {
    if (result.error) {
      notify(result.error);
      return;
    }
    if (result.pending) {
      if (result.pending > 10000) {
        notify(
          "Matrix exceeds 10,000 positions. Reduce the range or increase increments.",
        );
        return;
      }
      if (
        !confirm(
          `Generate ${result.pending.toLocaleString()} positions? This will produce a large export.`,
        )
      )
        return;
      setApproved(modelKey);
    }
    setSelected(0);
    setPlaying(false);
    setGenerationTime(new Date().toISOString());
    notify(
      result.pending
        ? "Generation started in the background."
        : "Position matrix regenerated from the current engineering model.",
    );
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setPage(0);
  }, [search, filter, tableTab, modelKey]);
  useEffect(() => {
    if (!playing || !positions.length) return;
    const t = setInterval(
      () => setSelected((i) => (i >= positions.length - 1 ? 0 : i + 1)),
      600 / speed,
    );
    return () => clearInterval(t);
  }, [playing, speed, positions.length]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const input = ["INPUT", "SELECT", "TEXTAREA"].includes(
        (e.target as HTMLElement).tagName,
      );
      if (e.ctrlKey || e.metaKey) {
        if (["s", "o", "e", "z", "y", "n"].includes(e.key.toLowerCase())) {
          if (input && ["z", "y"].includes(e.key.toLowerCase())) return;
          e.preventDefault();
          if (e.key === "s") save();
          if (e.key === "o") fileRef.current?.click();
          if (e.key === "e") setModal("export");
          if (e.key === "z") undo();
          if (e.key === "y") redo();
          if (e.key === "n") newProject();
        }
        return;
      }
      if (e.key === "Escape") {
        setModal(null);
        return;
      }
      if (input || modal) return;
      if (
        [" ", "ArrowLeft", "ArrowRight", "Home", "End", "f", "+", "-"].includes(
          e.key,
        )
      )
        e.preventDefault();
      if (e.key === " ") setPlaying((v) => !v);
      if (e.key === "ArrowLeft") setSelected(Math.max(0, index - 1));
      if (e.key === "ArrowRight")
        setSelected(Math.min(positions.length - 1, index + 1));
      if (e.key === "Home") setSelected(0);
      if (e.key === "End") setSelected(positions.length - 1);
      if (e.key === "f") setZoom(1);
      if (e.key === "+") setZoom((z) => Math.min(3, z + 0.1));
      if (e.key === "-") setZoom((z) => Math.max(0.65, z - 0.1));
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });
  const handleNav = (name: string) => {
    setNav(name);
    if (name === "Project overview") setModal("project");
    if (name === "Bridge geometry")
      bridgeRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    if (name === "Vehicle library") openVehicle();
    if (name === "Load cases")
      tableRef.current?.scrollIntoView({ behavior: "smooth" });
    if (name === "Visualization")
      planRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (name === "STAAD export") setModal("export");
    if (name === "Settings") setModal("settings");
  };
  const doExport = async () => {
    setExportError("");
    if (!positions.length) {
      setExportError("Generate a valid position matrix before exporting.");
      return;
    }
    setBusy(true);
    try {
      if (exportType === "csv") exportCSV(project, positions);
      if (exportType === "excel") await exportExcel(project, positions);
      if (exportType === "std") {
        if (!confirmed)
          throw new Error(
            "Confirm the coordinate convention and host model requirements.",
          );
        download(
          `${fileName(project)}_LiveLoad.std`,
          staadText(project, positions, parseNodes(nodeText), tolerance),
        );
      }
      if (exportType === "report") {
        window.print();
      }
      if (exportType !== "report")
        notify("Export ready. Check your browser downloads.");
      setModal(null);
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span />
            <span />
            <span />
          </div>
          <span>
            span<span className="brand-dot">.</span>
          </span>
          <span className="brand-edition">ENGINEERING</span>
        </div>
        <div className="product-name">
          STAAD.Pro <span>Live Load Generator</span>
          <span className="version">v1.0</span>
        </div>
        <div className="top-actions">
          <span className="local-indicator">
            <i /> Local workspace
          </span>
          <IconButton
            icon={CircleHelp}
            label="Help and engineering notes"
            onClick={() => setModal("help")}
          />
          <div className="avatar">EN</div>
        </div>
      </header>
      <aside className="sidebar">
        <div className="workspace-label">
          WORKSPACE <span>01</span>
        </div>
        <button className="project-switch" onClick={() => setModal("project")}>
          <div className="project-icon">
            <Layers size={18} />
          </div>
          <span>
            {project.number}
            <small>Bridge engineering</small>
          </span>
          <ChevronDown size={13} />
        </button>
        <div className="nav-label">PROJECT</div>
        <nav>
          {(
            [
              { name: "Project overview", icon: LayoutDashboard },
              { name: "Bridge geometry", icon: Columns3 },
              { name: "Vehicle library", icon: Truck },
              { name: "Load position generator", icon: Route },
              { name: "Load cases", icon: ClipboardList },
              { name: "Visualization", icon: Box },
              { name: "STAAD export", icon: ArrowUpRight },
            ] as { name: string; icon: LucideIcon }[]
          ).map(({ name, icon: Icon }) => (
            <button
              className={nav === name ? "selected" : ""}
              key={name}
              onClick={() => handleNav(name)}
            >
              <Icon size={17} />
              <span>{name}</span>
              {name === "Load cases" && <small>{positions.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="project-note">
            <div>
              <ShieldCheck size={16} /> ENGINEERING WORKSPACE
            </div>
            <p>
              Every position.
              <br />
              Precisely defined.
            </p>
            <span>Single source of geometry.</span>
          </div>
          <button onClick={() => handleNav("Settings")}>
            <Settings2 size={17} /> Settings
          </button>
          <button onClick={() => setModal("help")}>
            <CircleHelp size={17} /> Help & documentation{" "}
            <ArrowUpRight size={12} />
          </button>
          <div className="sidebar-foot">
            SPAN ENGINEERING <span>© 2026</span>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="breadcrumbs">
          <span>Projects</span>
          <ChevronRight size={12} />
          <span>{project.name}</span>
          <ChevronRight size={12} />
          <strong>Load position generator</strong>
        </div>
        <div className="page-heading">
          <div>
            <div className="heading-line">
              <h1>Load position generator</h1>
              <span className="pill neutral">{project.standard}</span>
            </div>
            <p>
              Define your bridge. Position your vehicles. Generate with
              confidence.
            </p>
          </div>
          <div className="page-actions">
            <IconButton
              icon={Undo2}
              label="Undo"
              onClick={undo}
              disabled={!history.length}
            />
            <IconButton
              icon={Redo2}
              label="Redo"
              onClick={redo}
              disabled={!future.length}
            />
            <button className="button" onClick={save}>
              <Save size={15} />
              Save project
            </button>
            <button
              className="button primary"
              onClick={() => {
                setExportError("");
                setModal("export");
              }}
            >
              <ArrowUpRight size={16} />
              Export
              <ChevronDown size={13} />
            </button>
          </div>
        </div>
        <div className="project-strip">
          <div>
            <span className="green-dot" />
            <strong>{project.name}</strong>
            <span className="divider" />
            {project.number}
          </div>
          <div>
            <span>Single span</span>
            <span className="divider" />
            <span>
              {b.length} m × {b.deckWidth} m
            </span>
            <span className="divider" />
            <strong>kN · m</strong>
          </div>
        </div>
        <div className="workbench">
          <section className="inputs-panel">
            <div className="input-panel-header">
              <SlidersHorizontal size={16} />
              <h2>Model inputs</h2>
              <IconButton
                icon={RotateCcw}
                label="Reset model inputs"
                onClick={() => {
                  if (confirm("Reset bridge and movement settings?"))
                    update({
                      bridge: structuredClone(initialProject.bridge),
                      rules: structuredClone(initialProject.rules),
                      marks: {},
                    });
                }}
              />
            </div>
            <div className="input-scroll">
              <div className="input-section" ref={bridgeRef}>
                <PanelTitle icon={Columns3} title="Bridge geometry" />
                <div className="field-grid">
                  <Field
                    label="Span length"
                    value={b.length}
                    onChange={(length) => patchBridge({ length })}
                  />
                  <Field
                    label="Deck width"
                    value={b.deckWidth}
                    onChange={(deckWidth) => patchBridge({ deckWidth })}
                  />
                  <Field
                    label="Carriageway"
                    value={b.carriagewayWidth}
                    onChange={(carriagewayWidth) =>
                      patchBridge({ carriagewayWidth })
                    }
                  />
                  <Field
                    label="Number of lanes"
                    value={b.lanes}
                    onChange={(lanes) => patchBridge({ lanes })}
                    unit=""
                    step={1}
                  />
                  <Field
                    label="Left shoulder"
                    value={b.leftShoulder}
                    onChange={(leftShoulder) => patchBridge({ leftShoulder })}
                  />
                  <Field
                    label="Right shoulder"
                    value={b.rightShoulder}
                    onChange={(rightShoulder) => patchBridge({ rightShoulder })}
                  />
                </div>
                <div className="input-hint">
                  <Ruler size={12} /> Lane width{" "}
                  <strong>{fmt(b.carriagewayWidth / b.lanes)} m</strong>
                </div>
              </div>
              <div className="input-section">
                <PanelTitle icon={Truck} title="Vehicle configuration" />
                <label className="field">
                  <span>Design vehicle</span>
                  <select
                    value={v.id}
                    onChange={(e) => {
                      update({ selectedVehicle: e.target.value, marks: {} });
                      setSelected(0);
                    }}
                  >
                    {project.vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="vehicle-mini">
                  <svg viewBox="0 0 130 39" width="120" height="36">
                    <path
                      d="M7 26V15H91L102 8H116L124 18V28H7Z"
                      fill="#e4ede5"
                      stroke="#5c7c68"
                    />
                    {[18, 35, 66, 78, 93, 105, 116].map((x) => (
                      <g key={x}>
                        <circle
                          cx={x}
                          cy="29"
                          r="4"
                          fill="#fff"
                          stroke="#405e4b"
                        />
                        <circle cx={x} cy="29" r="1.4" fill="#405e4b" />
                      </g>
                    ))}
                    <path d="M104 12H114L119 18H104Z" fill="#a7c3b0" />
                  </svg>
                  <div>
                    <strong>
                      {v.axles.reduce((n, a) => n + a.load, 0).toLocaleString()}{" "}
                      <span>kN</span>
                    </strong>
                    <small>
                      {v.type === "tracked"
                        ? "2 tracks"
                        : `${v.axles.length} axles`}{" "}
                      · {v.length} m
                    </small>
                  </div>
                </div>
                <button className="text-button" onClick={openVehicle}>
                  View & edit vehicle
                  <ArrowUpRight size={12} />
                </button>
              </div>
              <div className="input-section">
                <PanelTitle icon={Route} title="Movement rules" />
                <label className="field">
                  <span>Generation mode</span>
                  <select
                    value={r.mode}
                    onChange={(e) =>
                      patchRules({ mode: e.target.value as Rules["mode"] })
                    }
                  >
                    <option value="matrix">Full matrix · X × Y</option>
                    <option value="longitudinal">Longitudinal sweep</option>
                    <option value="transverse">Transverse sweep</option>
                    <option value="single">Single position</option>
                  </select>
                </label>
                <div className="field-grid three">
                  <Field
                    label="Start X"
                    value={r.startX}
                    onChange={(startX) => patchRules({ startX })}
                  />
                  <Field
                    label="End X"
                    value={r.endX}
                    onChange={(endX) => patchRules({ endX })}
                  />
                  <Field
                    label="Step"
                    value={r.stepX}
                    onChange={(stepX) => patchRules({ stepX })}
                  />
                </div>
                <label className="field">
                  <span>Transverse placement</span>
                  <select
                    value={r.transverse}
                    onChange={(e) =>
                      patchRules({
                        transverse: e.target.value as Rules["transverse"],
                      })
                    }
                    disabled={r.mode === "single" || r.mode === "longitudinal"}
                  >
                    <option value="lanes">Each lane centre</option>
                    <option value="single">Single transverse position</option>
                    <option value="sweep">User-defined sweep</option>
                  </select>
                </label>
                {(r.transverse === "single" ||
                  r.mode === "single" ||
                  r.mode === "longitudinal") && (
                  <Field
                    label="Y offset"
                    value={r.y}
                    onChange={(y) => patchRules({ y })}
                  />
                )}
                {r.transverse === "sweep" &&
                  r.mode !== "single" &&
                  r.mode !== "longitudinal" && (
                    <div className="field-grid three">
                      <Field
                        label="Start Y"
                        value={r.startY}
                        onChange={(startY) => patchRules({ startY })}
                      />
                      <Field
                        label="End Y"
                        value={r.endY}
                        onChange={(endY) => patchRules({ endY })}
                      />
                      <Field
                        label="Step Y"
                        value={r.stepY}
                        onChange={(stepY) => patchRules({ stepY })}
                      />
                    </div>
                  )}
                <div className="direction-row">
                  <span>Travel direction</span>
                  <div className="segmented">
                    <button
                      className={r.direction === 1 ? "active" : ""}
                      onClick={() => patchRules({ direction: 1 })}
                    >
                      +X <ArrowRight size={12} />
                    </button>
                    <button
                      className={r.direction === -1 ? "active" : ""}
                      onClick={() => patchRules({ direction: -1 })}
                    >
                      <ArrowLeft size={12} /> −X
                    </button>
                  </div>
                </div>
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={r.excludeOutside}
                    onChange={(e) =>
                      patchRules({ excludeOutside: e.target.checked })
                    }
                  />
                  Exclude fully outside positions
                </label>
                <Field
                  label="First load-case number"
                  value={r.firstCase}
                  onChange={(firstCase) => patchRules({ firstCase })}
                  unit="LC"
                  step={1}
                />
              </div>
            </div>
            <div className="generate-footer">
              <div>
                <span>Expected positions</span>
                <strong>
                  {(result.pending || positions.length).toLocaleString()}
                </strong>
              </div>
              <button
                className="button primary generate"
                onClick={regenerate}
                disabled={result.busy}
              >
                <Grid2X2 size={15} />
                Generate positions
                <ArrowRight size={15} />
              </button>
            </div>
          </section>
          <section className="visual-workspace" ref={planRef}>
            <div className="view-header">
              <div className="view-tabs">
                <button className="active" onClick={() => setZoom(1)}>
                  <Layers size={14} />
                  Bridge plan<span>XY</span>
                </button>
              </div>
              <div className="view-tools">
                <IconButton
                  icon={MousePointer2}
                  label="Inspect wheels using hover"
                  active
                  onClick={() =>
                    notify(
                      "Hover a wheel to inspect its exact coordinates and load.",
                    )
                  }
                />
                <IconButton
                  icon={Grid2X2}
                  label="Toggle grid"
                  active={grid}
                  onClick={() => setGrid(!grid)}
                />
                <IconButton
                  icon={Ruler}
                  label="Toggle dimensions"
                  active={dimensions}
                  onClick={() => setDimensions(!dimensions)}
                />
                <span className="divider" />
                <IconButton
                  icon={Maximize2}
                  label="Fit view (F)"
                  onClick={() => setZoom(1)}
                />
              </div>
            </div>
            <div className="plan-container">
              <div className="drawing-label">
                <span className="green-dot" />
                LIVE PREVIEW <span>PLAN VIEW</span>
              </div>
              {p ? (
                <PlanView
                  key={zoom === 1 ? "fit" : "zoomed"}
                  bridge={b}
                  vehicle={v}
                  position={p}
                  startX={r.startX}
                  grid={grid}
                  dimensions={dimensions}
                  zoom={zoom}
                  setZoom={setZoom}
                  onCursor={(x, y) => setCursor({ x, y })}
                />
              ) : (
                <div className="empty-view">
                  <AlertTriangle size={28} />
                  <h3>
                    {result.busy
                      ? "Generating positions…"
                      : result.pending
                        ? "Large matrix confirmation"
                        : "Check your model inputs"}
                  </h3>
                  <p>
                    {result.error ||
                      (result.busy
                        ? `Calculating ${result.pending.toLocaleString()} positions in a background worker.`
                        : `${result.pending.toLocaleString()} positions requested. Click Generate positions to continue.`)}
                  </p>
                </div>
              )}
              <div className="plan-bottom">
                <div className="legend">
                  <span>
                    <i className="legend-vehicle" />
                    Current vehicle
                  </span>
                  <span>
                    <i className="legend-start" />
                    Start position
                  </span>
                  <span>
                    <i className="legend-cl" />
                    Bridge centreline
                  </span>
                </div>
                <div className="zoom-tools">
                  <IconButton
                    icon={Minus}
                    label="Zoom out"
                    onClick={() => setZoom(Math.max(0.65, zoom - 0.1))}
                  />
                  <span>{Math.round(zoom * 100)}%</span>
                  <IconButton
                    icon={Plus}
                    label="Zoom in"
                    onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  />
                </div>
              </div>
            </div>
            <div className="section-header">
              <h3>
                <Columns3 size={14} />
                Cross-section<span>YZ</span>
              </h3>
              <span>Looking along +X</span>
            </div>
            {p ? (
              <CrossSection bridge={b} vehicle={v} position={p} />
            ) : (
              <div className="section-placeholder">
                Cross-section requires valid model inputs.
              </div>
            )}
            <div className="timeline">
              <div className="timeline-heading">
                <span>POSITION EXPLORER</span>
                <strong>
                  {positions.length ? index + 1 : 0}
                  <span> / {positions.length}</span>
                </strong>
                <div>
                  X <strong>{p ? fmt(p.x) : "—"}</strong> m{" "}
                  <span className="divider" /> Y{" "}
                  <strong>{p ? fmt(p.y) : "—"}</strong> m
                </div>
              </div>
              <input
                aria-label="Current vehicle position"
                className="position-slider"
                type="range"
                min="0"
                max={Math.max(0, positions.length - 1)}
                value={index}
                onChange={(e) => {
                  setSelected(+e.target.value);
                  setPlaying(false);
                }}
                disabled={!p}
              />
              <div className="playback">
                <span>{fmt(r.startX)} m</span>
                <div>
                  <IconButton
                    icon={ChevronsLeft}
                    label="First position"
                    onClick={() => setSelected(0)}
                    disabled={!p}
                  />
                  <IconButton
                    icon={ChevronLeft}
                    label="Previous position"
                    onClick={() => setSelected(Math.max(0, index - 1))}
                    disabled={!p}
                  />
                  <button
                    className="play-button"
                    aria-label={playing ? "Pause" : "Play"}
                    disabled={!p}
                    onClick={() => setPlaying(!playing)}
                  >
                    {playing ? (
                      <Pause size={14} />
                    ) : (
                      <Play size={14} fill="currentColor" />
                    )}
                  </button>
                  <IconButton
                    icon={ChevronRight}
                    label="Next position"
                    onClick={() =>
                      setSelected(Math.min(positions.length - 1, index + 1))
                    }
                    disabled={!p}
                  />
                  <IconButton
                    icon={ChevronsRight}
                    label="Last position"
                    onClick={() => setSelected(positions.length - 1)}
                    disabled={!p}
                  />
                  <select
                    aria-label="Animation speed"
                    value={speed}
                    onChange={(e) => setSpeed(+e.target.value)}
                  >
                    {[0.25, 0.5, 1, 2, 5, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}×
                      </option>
                    ))}
                  </select>
                </div>
                <span>{fmt(r.endX)} m</span>
              </div>
            </div>
          </section>
          <aside className="properties-panel">
            <div className="properties-header">
              <h2>Position properties</h2>
              <IconButton
                icon={MoreHorizontal}
                label="Position actions"
                onClick={() =>
                  notify(
                    "Use the bookmark, critical, governing and exclude controls below.",
                  )
                }
              />
            </div>
            {p && (
              <>
                <div className="current-case">
                  <div>
                    <span>CURRENT LOAD CASE</span>
                    <IconButton
                      icon={Bookmark}
                      label="Bookmark current position"
                      active={!!project.marks[p.id]?.bookmark}
                      onClick={() => mark(p.id, "bookmark")}
                    />
                  </div>
                  <strong>LC{p.id}</strong>
                  <span className={`pill ${p.status}`}>
                    {p.status === "valid" ? (
                      <CheckCircle2 size={11} />
                    ) : (
                      <AlertTriangle size={11} />
                    )}{" "}
                    {p.status.toUpperCase()}
                  </span>
                  <p>{v.name}</p>
                </div>
                <div className="property-group">
                  <h4>POSITION COORDINATES</h4>
                  {[
                    ["Start X", fmt(p.x), "m"],
                    ["End X", fmt(p.x + p.direction * v.length), "m"],
                    ["Y offset", fmt(p.y), "m"],
                    ["Direction", p.direction === 1 ? "+X →" : "−X ←", ""],
                  ].map(([label, val, unit]) => (
                    <div className="property-row" key={label}>
                      <span>{label}</span>
                      <strong>
                        {val}
                        <small>{unit}</small>
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="property-group">
                  <h4>VEHICLE LOADING</h4>
                  <div className="property-row">
                    <span>Total load</span>
                    <strong>
                      {fmt(
                        v.axles.reduce((s, a) => s + a.load, 0),
                        2,
                      )}
                      <small>kN</small>
                    </strong>
                  </div>
                  <div className="property-row">
                    <span>
                      On-deck {v.type === "tracked" ? "resultants" : "wheels"}
                    </span>
                    <strong>
                      {p.loads.filter((l) => l.onDeck).length} /{" "}
                      {p.loads.length}
                    </strong>
                  </div>
                  <div className="property-row">
                    <span>
                      {v.type === "tracked"
                        ? "Resultant sum¹"
                        : "Applied on deck"}
                    </span>
                    <strong>
                      {fmt(
                        p.loads
                          .filter((l) => l.onDeck)
                          .reduce((s, l) => s + l.load, 0),
                        2,
                      )}
                      <small>kN</small>
                    </strong>
                  </div>
                </div>
                <div className="coordinate-block">
                  <div className="small-tabs">
                    {["Wheels", "Axles"].map((t) => (
                      <button
                        className={coordTab === t ? "active" : ""}
                        key={t}
                        onClick={() => setCoordTab(t)}
                      >
                        {v.type === "tracked" && t === "Wheels"
                          ? "Resultants"
                          : t}
                      </button>
                    ))}
                    <span>kN · m</span>
                  </div>
                  <div className="coordinate-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{coordTab === "Wheels" ? "ID" : "Axle"}</th>
                          <th>X</th>
                          <th>Y</th>
                          <th>Load</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.loads
                          .filter(
                            (l) => coordTab === "Wheels" || l.wheel % 2 === 1,
                          )
                          .map((l) => (
                            <tr key={l.wheel}>
                              <td>
                                {coordTab === "Wheels"
                                  ? `W${String(l.wheel).padStart(2, "0")}`
                                  : `A${l.axle}`}
                              </td>
                              <td>{fmt(l.x)}</td>
                              <td>{fmt(coordTab === "Wheels" ? l.y : p.y)}</td>
                              <td>
                                {fmt(
                                  l.load * (coordTab === "Wheels" ? 1 : 2),
                                  1,
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="position-marks">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={!!project.marks[p.id]?.critical}
                      onChange={() => mark(p.id, "critical")}
                    />
                    Mark as critical
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={!!project.marks[p.id]?.governing}
                      onChange={() => mark(p.id, "governing")}
                    />
                    Mark as governing
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={
                        p.autoExcluded || !!project.marks[p.id]?.excluded
                      }
                      disabled={p.autoExcluded}
                      onChange={() => mark(p.id, "excluded")}
                    />
                    Exclude from STAAD export
                  </label>
                </div>
              </>
            )}
            <div className="reference-warning">
              <ShieldCheck size={15} />
              <span>
                {v.verified
                  ? "Vehicle data verified by user. Structural mapping still requires review."
                  : "Reference vehicle data. Verify the applicable code before structural use."}
                {v.type === "tracked" &&
                  " ¹Track resultants do not represent clipped contact pressure."}
              </span>
            </div>
          </aside>
        </div>
        <section className="load-cases" ref={tableRef}>
          <div className="table-heading">
            <div>
              <Table2 size={17} />
              <h2>Generated load cases</h2>
              <span className="count-tag">{positions.length}</span>
            </div>
            <div className="generation-badges">
              <span>
                <i className="green-dot" />
                {valid} Valid
              </span>
              <span>
                <i className="amber-dot" />
                {partial} Partial
              </span>
              <span>
                <i className="gray-dot" />
                {excluded} Excluded
              </span>
              <span className="divider" />
              <button
                className="text-button"
                onClick={() =>
                  positions.length
                    ? exportCSV(project, positions)
                    : notify("Generate valid positions first.")
                }
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>
          <div className="table-controls">
            <div className="table-tabs">
              {["All positions", "Bookmarked", "Critical positions"].map(
                (t) => (
                  <button
                    key={t}
                    className={tableTab === t ? "active" : ""}
                    onClick={() => setTableTab(t)}
                  >
                    {t === "Bookmarked" && <Bookmark size={12} />} {t}
                  </button>
                ),
              )}
            </div>
            <div className="table-search">
              <div className="search-input">
                <Search size={14} />
                <input
                  placeholder="Search load case or coordinate…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="filter-select">
                <ListFilter size={14} />
                <select
                  aria-label="Filter positions by status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="valid">Valid</option>
                  <option value="partial">Partial</option>
                  <option value="outside">Outside</option>
                </select>
              </div>
            </div>
          </div>
          <div className="main-table-scroll">
            <table className="main-table">
              <thead>
                <tr>
                  <th className="bookmark-col">
                    <Bookmark size={12} />
                  </th>
                  <th>Load case</th>
                  <th>Vehicle</th>
                  <th>
                    X start <span>(m)</span>
                  </th>
                  <th>
                    Y offset <span>(m)</span>
                  </th>
                  <th>Direction</th>
                  <th>
                    On-deck load <span>(kN)</span>
                  </th>
                  <th>Status</th>
                  <th>Included</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === p?.id ? "selected-row" : ""}
                    onClick={() => {
                      setSelected(positions.indexOf(row));
                      setPlaying(false);
                    }}
                  >
                    <td>
                      <button
                        className={`table-bookmark ${project.marks[row.id]?.bookmark ? "bookmarked" : ""}`}
                        aria-label={`Bookmark LC${row.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          mark(row.id, "bookmark");
                        }}
                      >
                        <Bookmark
                          size={13}
                          fill={
                            project.marks[row.id]?.bookmark
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                    </td>
                    <td>
                      <strong>LC{row.id}</strong>
                      {project.marks[row.id]?.critical && (
                        <span className="critical-dot" title="Critical" />
                      )}
                      {project.marks[row.id]?.governing && (
                        <span className="critical-dot" title="Governing" />
                      )}
                    </td>
                    <td>{v.name}</td>
                    <td className="mono">{fmt(row.x)}</td>
                    <td className="mono">{fmt(row.y)}</td>
                    <td>{row.direction === 1 ? "+X →" : "−X ←"}</td>
                    <td className="mono">
                      {fmt(
                        row.loads
                          .filter((l) => l.onDeck)
                          .reduce((s, l) => s + l.load, 0),
                        2,
                      )}
                    </td>
                    <td>
                      <span className={`pill ${row.status}`}>
                        <i />
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <input
                        aria-label={`Include LC${row.id}`}
                        type="checkbox"
                        checked={
                          !row.autoExcluded && !project.marks[row.id]?.excluded
                        }
                        disabled={row.autoExcluded}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => mark(row.id, "excluded")}
                      />
                    </td>
                    <td>
                      <ChevronRight size={13} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <div className="empty-table">
                {result.error || "No positions match this view."}
              </div>
            )}
          </div>
          <div className="table-footer">
            <span>
              Showing {filtered.length ? page * 8 + 1 : 0}–
              {Math.min((page + 1) * 8, filtered.length)} of {filtered.length}{" "}
              positions <span className="divider" /> Coordinates in metres ·
              loads in kN
            </span>
            <div>
              <IconButton
                icon={ChevronLeft}
                label="Previous page"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              />
              <span>
                Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / 8))}
              </span>
              <IconButton
                icon={ChevronRight}
                label="Next page"
                disabled={(page + 1) * 8 >= filtered.length}
                onClick={() => setPage(page + 1)}
              />
            </div>
          </div>
        </section>
        <footer className="statusbar">
          <div>
            <span className="green-dot" />
            {result.error
              ? "Input review required"
              : result.pending
                ? "Awaiting confirmation"
                : "Model synchronized"}
            <span className="divider" />
            <span>X: {fmt(cursor.x)} m</span>
            <span>Y: {fmt(cursor.y)} m</span>
          </div>
          <div>
            <span>SVG workspace</span>
            <span className="divider" />
            <span>Zoom {Math.round(zoom * 100)}%</span>
            <span className="divider" />
            <span>kN–m</span>
          </div>
        </footer>
      </main>
      <input
        ref={fileRef}
        type="file"
        accept=".staadllg,.json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const data = parseProject(await file.text());
            setProject(data);
            setSelected(0);
            setPlaying(false);
            notify("Project opened successfully.");
          } catch (err) {
            notify((err as Error).message);
          }
          e.target.value = "";
        }}
      />
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <IconButton
            icon={X}
            label="Dismiss notification"
            onClick={() => setToast("")}
          />
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={`modal ${modal === "vehicle" ? "wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${modal} dialog`}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">SPAN WORKSPACE</span>
                <h2>
                  {
                    {
                      project: "Project details",
                      vehicle: "Vehicle library",
                      export: "Export engineering data",
                      settings: "Workspace settings",
                      help: "A precise, connected workflow",
                    }[modal]
                  }
                </h2>
              </div>
              <IconButton
                icon={X}
                label="Close dialog"
                onClick={() => setModal(null)}
              />
            </div>
            <div className="modal-body">
              {modal === "project" && (
                <>
                  <p className="modal-description">
                    Your bridge geometry, vehicle definitions and movement rules
                    stay together in one portable project.
                  </p>
                  <label className="field">
                    <span>Project name</span>
                    <input
                      value={project.name}
                      onChange={(e) => update({ name: e.target.value })}
                    />
                  </label>
                  <div className="field-grid">
                    <label className="field">
                      <span>Project number</span>
                      <input
                        value={project.number}
                        onChange={(e) => update({ number: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>Designer</span>
                      <input
                        value={project.designer}
                        placeholder="Engineer name"
                        onChange={(e) => update({ designer: e.target.value })}
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Loading standard</span>
                    <select
                      value={project.standard}
                      onChange={(e) => update({ standard: e.target.value })}
                    >
                      <option>IRC 6</option>
                      <option>Custom</option>
                    </select>
                  </label>
                  <div className="modal-button-row">
                    <button className="button" onClick={newProject}>
                      <FilePlus2 size={15} />
                      New project
                    </button>
                    <button
                      className="button"
                      onClick={() => fileRef.current?.click()}
                    >
                      <FolderOpen size={15} />
                      Open project
                    </button>
                    <button className="button primary" onClick={save}>
                      <Save size={15} />
                      Save project
                    </button>
                  </div>
                </>
              )}
              {modal === "vehicle" && (
                <>
                  <div className="notice">
                    <AlertTriangle size={17} />
                    <p>
                      IRC presets are editable reference templates, not
                      certified code definitions. Verify axle loads and geometry
                      against your applicable IRC 6 edition. Tracked loads are
                      exported as resultants only.
                    </p>
                  </div>
                  <div className="vehicle-editor-heading">
                    <label className="field">
                      <span>Vehicle name</span>
                      <input
                        value={draftVehicle.name}
                        onChange={(e) =>
                          setDraftVehicle({
                            ...draftVehicle,
                            name: e.target.value,
                            verified: false,
                          })
                        }
                      />
                    </label>
                    <button
                      className="button"
                      onClick={() =>
                        setDraftVehicle({
                          ...structuredClone(v),
                          id: `custom-${Date.now()}`,
                          name: "Custom design vehicle",
                          code: "Custom",
                          type: "custom",
                          verified: false,
                        })
                      }
                    >
                      <Copy size={14} />
                      Create custom copy
                    </button>
                  </div>
                  <div className="field-grid three">
                    <Field
                      label="Vehicle length"
                      value={draftVehicle.length}
                      onChange={(length) =>
                        setDraftVehicle({
                          ...draftVehicle,
                          length,
                          verified: false,
                          ...(draftVehicle.type === "tracked"
                            ? {
                                axles: [
                                  {
                                    ...draftVehicle.axles[0],
                                    position: length / 2,
                                  },
                                ],
                              }
                            : {}),
                        })
                      }
                    />
                    <Field
                      label="Vehicle width"
                      value={draftVehicle.width}
                      onChange={(width) =>
                        setDraftVehicle({
                          ...draftVehicle,
                          width,
                          verified: false,
                        })
                      }
                    />
                    <label className="field">
                      <span>Vehicle type</span>
                      <select
                        value={draftVehicle.type}
                        onChange={(e) =>
                          setDraftVehicle({
                            ...draftVehicle,
                            type: e.target.value as Vehicle["type"],
                            trackWidth: 0.84,
                            trackSpacing: 2.06,
                            verified: false,
                            ...(e.target.value === "tracked"
                              ? {
                                  width: Math.max(draftVehicle.width, 2.9),
                                  axles: [
                                    {
                                      position: draftVehicle.length / 2,
                                      load: draftVehicle.axles.reduce(
                                        (s, a) => s + a.load,
                                        0,
                                      ),
                                      wheelSpacing: 2.06,
                                    },
                                  ],
                                }
                              : {}),
                          })
                        }
                      >
                        <option value="wheeled">Wheeled</option>
                        <option value="tracked">Tracked</option>
                        <option value="custom">Custom wheeled</option>
                      </select>
                    </label>
                  </div>
                  {draftVehicle.type === "tracked" && (
                    <div className="field-grid">
                      <Field
                        label="Track width"
                        value={draftVehicle.trackWidth || 0.84}
                        onChange={(trackWidth) =>
                          setDraftVehicle({
                            ...draftVehicle,
                            trackWidth,
                            verified: false,
                          })
                        }
                      />
                      <Field
                        label="Track centre spacing"
                        value={draftVehicle.trackSpacing || 2.06}
                        onChange={(trackSpacing) =>
                          setDraftVehicle({
                            ...draftVehicle,
                            trackSpacing,
                            verified: false,
                            axles: [
                              {
                                position: draftVehicle.length / 2,
                                load: draftVehicle.axles.reduce(
                                  (s, a) => s + a.load,
                                  0,
                                ),
                                wheelSpacing: trackSpacing,
                              },
                            ],
                          })
                        }
                      />
                    </div>
                  )}
                  <div className="editor-table">
                    <table>
                      <thead>
                        <tr>
                          <th>
                            {draftVehicle.type === "tracked"
                              ? "Resultant"
                              : "Axle"}
                          </th>
                          <th>Position (m)</th>
                          <th>Total load (kN)</th>
                          <th>Spacing (m)</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {draftVehicle.axles.map((a, i) => (
                          <tr key={i}>
                            <td>A{i + 1}</td>
                            {(
                              ["position", "load", "wheelSpacing"] as const
                            ).map((key) => (
                              <td key={key}>
                                <input
                                  type="number"
                                  aria-label={`Axle ${i + 1} ${key}`}
                                  step=".01"
                                  value={Number.isFinite(a[key]) ? a[key] : ""}
                                  onChange={(e) =>
                                    setDraftVehicle({
                                      ...draftVehicle,
                                      verified: false,
                                      axles: draftVehicle.axles.map((a, j) =>
                                        j === i
                                          ? {
                                              ...a,
                                              [key]:
                                                e.target.value === ""
                                                  ? NaN
                                                  : +e.target.value,
                                            }
                                          : a,
                                      ),
                                    })
                                  }
                                />
                              </td>
                            ))}
                            <td>
                              <IconButton
                                icon={X}
                                label={`Remove axle ${i + 1}`}
                                onClick={() =>
                                  setDraftVehicle({
                                    ...draftVehicle,
                                    verified: false,
                                    axles: draftVehicle.axles.filter(
                                      (_, j) => i !== j,
                                    ),
                                  })
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      setDraftVehicle({
                        ...draftVehicle,
                        verified: false,
                        axles: [
                          ...draftVehicle.axles,
                          {
                            position: Math.min(
                              draftVehicle.length,
                              (draftVehicle.axles.at(-1)?.position || 0) + 1,
                            ),
                            load: 100,
                            wheelSpacing: 1.8,
                          },
                        ],
                      })
                    }
                  >
                    <Plus size={14} />
                    Add axle
                  </button>
                  <label className="check-row verify">
                    <input
                      type="checkbox"
                      checked={draftVehicle.verified}
                      onChange={(e) =>
                        setDraftVehicle({
                          ...draftVehicle,
                          verified: e.target.checked,
                        })
                      }
                    />
                    I have verified this vehicle's geometry and loads for my
                    project.
                  </label>
                  <div className="modal-button-row">
                    <span className="muted">
                      Total load:{" "}
                      {fmt(
                        draftVehicle.axles.reduce((s, a) => s + a.load, 0),
                        2,
                      )}{" "}
                      kN
                    </span>
                    <button
                      className="button primary"
                      onClick={() => {
                        try {
                          generate(b, draftVehicle, { ...r, mode: "single" });
                          update({
                            vehicles: project.vehicles.some(
                              (v) => v.id === draftVehicle.id,
                            )
                              ? project.vehicles.map((v) =>
                                  v.id === draftVehicle.id ? draftVehicle : v,
                                )
                              : [...project.vehicles, draftVehicle],
                            selectedVehicle: draftVehicle.id,
                            marks: {},
                          });
                          setModal(null);
                          notify(
                            "Vehicle updated. All coordinates have been recalculated.",
                          );
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      <Check size={15} />
                      Apply vehicle
                    </button>
                  </div>
                </>
              )}
              {modal === "export" && (
                <>
                  <p className="modal-description">
                    Export the current matrix from the same coordinates shown in
                    your workspace.
                  </p>
                  <div className="export-summary">
                    <div>
                      <strong>{positions.length}</strong>
                      <span>Positions</span>
                    </div>
                    <div>
                      <strong>{positions.length - excluded}</strong>
                      <span>Included</span>
                    </div>
                    <div>
                      <strong>{excluded}</strong>
                      <span>Excluded</span>
                    </div>
                  </div>
                  <div className="export-options">
                    {[
                      {
                        id: "csv",
                        name: "Coordinate schedule",
                        ext: ".CSV",
                        desc: "All wheel coordinates, loads and exclusion flags",
                      },
                      {
                        id: "excel",
                        name: "Engineering workbook",
                        ext: ".XLSX",
                        desc: "10 sheets · project, geometry, positions and loads",
                      },
                      {
                        id: "std",
                        name: "STAAD static nodal loads",
                        ext: ".STD",
                        desc: "Verified vehicle + explicit structural node mapping",
                      },
                      {
                        id: "report",
                        name: "Workspace report",
                        ext: "PDF",
                        desc: "Print the current drawing and visible schedule",
                      },
                    ].map((o) => (
                      <button
                        key={o.id}
                        className={exportType === o.id ? "selected" : ""}
                        onClick={() => {
                          setExportType(o.id);
                          setExportError("");
                        }}
                      >
                        <div className="radio-dot" />
                        <div>
                          <strong>{o.name}</strong>
                          <span>{o.desc}</span>
                        </div>
                        <b>{o.ext}</b>
                      </button>
                    ))}
                  </div>
                  {exportType === "std" && (
                    <>
                      <div className="notice">
                        <AlertTriangle size={16} />
                        <p>
                          Exports a load fragment, not a standalone analysis
                          model. Host model must use <strong>SET Z UP</strong>.
                          Loads act in global −Z. Off-deck wheels and excluded
                          cases are omitted. Track pressure mapping and
                          moving-load commands are not supported.
                        </p>
                      </div>
                      <label className="field">
                        <span>
                          Structural nodes · ID, X, Y, Z (metres, one per line)
                        </span>
                        <textarea
                          rows={5}
                          placeholder={
                            "101, 0.000, -2.840, 0.000\n102, 0.000, -0.910, 0.000"
                          }
                          value={nodeText}
                          onChange={(e) => setNodeText(e.target.value)}
                        />
                      </label>
                      <Field
                        label="Exact-match coordinate tolerance"
                        value={tolerance}
                        onChange={setTolerance}
                        step={0.001}
                      />
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(e) => setConfirmed(e.target.checked)}
                        />
                        I confirm the Z-up convention, load IDs and node
                        mapping.
                      </label>
                    </>
                  )}
                  {exportError && (
                    <div className="error-message" role="alert">
                      {exportError}
                    </div>
                  )}
                  <div className="modal-button-row">
                    <span className="muted">Units: kN–m · v1.0.0</span>
                    <button
                      className="button primary"
                      disabled={busy || !positions.length}
                      onClick={doExport}
                    >
                      <Download size={15} />
                      {busy
                        ? "Preparing workbook…"
                        : exportType === "report"
                          ? "Print / Save PDF"
                          : "Export file"}
                    </button>
                  </div>
                </>
              )}
              {modal === "settings" && (
                <>
                  <p className="modal-description">
                    Model coordinates are stored at full precision in metres and
                    kN. Display rounding does not change engineering values.
                  </p>
                  <div className="field-grid">
                    <label className="field">
                      <span>Canonical units</span>
                      <select disabled>
                        <option>kN–m</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Animation speed</span>
                      <select
                        value={speed}
                        onChange={(e) => setSpeed(+e.target.value)}
                      >
                        {[0.25, 0.5, 1, 2, 5, 10].map((s) => (
                          <option key={s} value={s}>
                            {s}×
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={grid}
                      onChange={(e) => setGrid(e.target.checked)}
                    />
                    Show plan grid
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={dimensions}
                      onChange={(e) => setDimensions(e.target.checked)}
                    />
                    Show engineering dimensions
                  </label>
                  <div className="notice">
                    <ShieldCheck size={17} />
                    <p>
                      Single-span geometry. No analysis, automatic criticality
                      or code placement checks are performed. Critical and
                      governing positions are manually marked.
                    </p>
                  </div>
                  <p className="muted">
                    Last generation: {new Date(generationTime).toLocaleString()}
                    <br />
                    Configuration: {project.configurationVersion}
                  </p>
                </>
              )}
              {modal === "help" && (
                <>
                  <p className="modal-description">
                    Bridge geometry → vehicle definition → position → load
                    coordinates → structural mapping. Every view uses the same
                    engineering model.
                  </p>
                  <h3>Getting started</h3>
                  <ol className="help-list">
                    <li>Set deck, carriageway and shoulder dimensions.</li>
                    <li>
                      Review the reference vehicle or create a custom
                      definition.
                    </li>
                    <li>
                      Set X movement and transverse positions. Edits regenerate
                      the matrix automatically (up to 5,000 cases).
                    </li>
                    <li>
                      Inspect the plan, scrub positions and mark important
                      cases.
                    </li>
                    <li>
                      Save a project or export coordinates. For STAAD, provide a
                      verified vehicle and exact structural node mapping.
                    </li>
                  </ol>
                  <h3>Keyboard & view controls</h3>
                  <div className="shortcut-grid">
                    <span>Save / Open</span>
                    <kbd>Ctrl S / O</kbd>
                    <span>Previous / Next</span>
                    <kbd>← / →</kbd>
                    <span>Play / Pause</span>
                    <kbd>Space</kbd>
                    <span>First / Last</span>
                    <kbd>Home / End</kbd>
                    <span>Undo / Redo</span>
                    <kbd>Ctrl Z / Y</kbd>
                    <span>Fit / Zoom</span>
                    <kbd>F / + / −</kbd>
                    <span>Pan / Reset view</span>
                    <kbd>Middle drag / Double click</kbd>
                  </div>
                  <div className="notice">
                    <AlertTriangle size={17} />
                    <p>
                      Partial positions are retained. Outside means the entire
                      vehicle footprint is beyond longitudinal or carriageway
                      limits. A footprint from −16.25 to −1.25 m is outside, not
                      partial. This workspace does not determine structural
                      criticality.
                    </p>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
