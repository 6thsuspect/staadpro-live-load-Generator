import type { Project, Position } from "./types";
export function download(name: string, content: BlobPart, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csvCell(v: unknown) {
  let s = String(v ?? "");
  if (/^[=+@\t\r]/.test(s) || /^-[^\d.]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function coordinateRows(project: Project, positions: Position[]) {
  return positions.flatMap((p) =>
    p.loads.map((l) => ({
      LoadCase: p.id,
      Vehicle: project.vehicles.find((v) => v.id === p.vehicleId)!.name,
      XStart: p.x,
      YStart: p.y,
      Direction: p.direction,
      Status: p.status,
      Excluded: p.autoExcluded || !!project.marks[p.id]?.excluded,
      Axle: l.axle,
      Wheel: l.wheel,
      X: l.x,
      Y: l.y,
      Z: 0,
      Load_kN: l.load,
      OnDeck: l.onDeck,
      Representation:
        project.vehicles.find((v) => v.id === p.vehicleId)!.type === "tracked"
          ? "Track resultant (not pressure)"
          : "Wheel point",
    })),
  );
}
export function exportCSV(project: Project, positions: Position[]) {
  const rows = coordinateRows(project, positions);
  download(
    `${fileName(project)}_Coordinates.csv`,
    [
      Object.keys(rows[0]).map(csvCell).join(","),
      ...rows.map((r) => Object.values(r).map(csvCell).join(",")),
    ].join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
export const fileName = (p: Project) =>
  p.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "Bridge";
export interface Node {
  id: number;
  x: number;
  y: number;
  z: number;
}
export function parseNodes(text: string): Node[] {
  const nodes = text
    .trim()
    .split(/\r?\n/)
    .map((line, i) => {
      const vals = line.split(",").map(Number);
      if (
        vals.length !== 4 ||
        !vals.every(Number.isFinite) ||
        !Number.isInteger(vals[0]) ||
        vals[0] < 1
      )
        throw new Error(`Node row ${i + 1}: enter node ID, X, Y, Z in metres.`);
      return { id: vals[0], x: vals[1], y: vals[2], z: vals[3] };
    });
  if (new Set(nodes.map((n) => n.id)).size !== nodes.length)
    throw new Error("Node IDs must be unique.");
  return nodes;
}
export function staadText(
  project: Project,
  positions: Position[],
  nodes: Node[],
  tolerance: number,
) {
  if (!Number.isFinite(tolerance) || tolerance < 0)
    throw new Error("Mapping tolerance must be non-negative.");
  const v = project.vehicles.find((v) => v.id === project.selectedVehicle)!;
  if (v.type === "tracked")
    throw new Error(
      "Track resultants are not wheel point loads. Export coordinates for an engineer-defined pressure mapping instead.",
    );
  if (!v.verified)
    throw new Error(
      "Review and verify the vehicle definition in the Vehicle Library before STAAD export.",
    );
  const lines = [
    "* STAAD LIVE LOAD GENERATOR v1.0.0",
    "* Load fragment: append to an existing model before analysis.",
    "* Coordinates: X longitudinal, Y transverse, Z vertical.",
    "* Requires SET Z UP in the host STAAD model. Forces are global FZ.",
    "* Only on-deck wheel loads are exported. No distribution or impact factor.",
    "UNIT METER KN",
  ];
  let count = 0;
  for (const p of positions) {
    if (p.autoExcluded || project.marks[p.id]?.excluded) continue;
    const loads = p.loads.filter((l) => l.onDeck);
    if (!loads.length) continue;
    const mapped = new Map<number, number>();
    for (const l of loads) {
      const matches = nodes.filter(
        (n) => Math.hypot(n.x - l.x, n.y - l.y, n.z) <= tolerance,
      );
      if (matches.length !== 1)
        throw new Error(
          `LC${p.id}, W${l.wheel}: ${matches.length ? "ambiguous nodes" : "no node"} within ${tolerance} m. Supply an exact mapping; no nearest-node approximation is made.`,
        );
      mapped.set(matches[0].id, (mapped.get(matches[0].id) || 0) + l.load);
    }
    lines.push(
      `LOAD ${p.id} LOADTYPE Live TITLE LL_X${p.x.toFixed(3)}_Y${p.y.toFixed(3)}`,
      "JOINT LOAD",
      ...Array.from(mapped, ([node, load]) => `${node} FZ -${load.toFixed(6)}`),
    );
    count++;
  }
  if (!count)
    throw new Error("There are no included on-deck wheel loads to export.");
  return lines.join("\n");
}
export async function exportExcel(project: Project, positions: Position[]) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Span · STAAD Live Load Generator";
  const add = (name: string, rows: Record<string, unknown>[]) => {
    const sheet = wb.addWorksheet(name);
    if (!rows.length) return;
    sheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key,
      key,
      width: 22,
    }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF22664D" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  };
  add("01_Project", [
    {
      Name: project.name,
      Number: project.number,
      Designer: project.designer,
      Version: "1.0.0",
      Units: "kN-m",
      Configuration: project.configurationVersion,
    },
  ]);
  add("02_Bridge", [{ ...project.bridge }]);
  add(
    "03_Vehicles",
    project.vehicles.map((v) => ({
      Vehicle: v.name,
      Type: v.type,
      Width: v.width,
      Length: v.length,
      Verified: v.verified,
    })),
  );
  add(
    "04_Vehicle_Geometry",
    project.vehicles.flatMap((v) =>
      v.axles.map((a, i) => ({ Vehicle: v.name, Axle: i + 1, ...a })),
    ),
  );
  const summary = positions.map((p) => ({
    LoadCase: p.id,
    Vehicle: p.vehicleId,
    X: p.x,
    Y: p.y,
    Direction: p.direction,
    Status: p.status,
    Excluded: p.autoExcluded || !!project.marks[p.id]?.excluded,
    Bookmark: !!project.marks[p.id]?.bookmark,
    Critical: !!project.marks[p.id]?.critical,
    Governing: !!project.marks[p.id]?.governing,
  }));
  add("05_Position_Summary", summary);
  add(
    "06_Axle_Loads",
    positions.flatMap((p) =>
      p.loads
        .filter((l) => l.wheel % 2 === 1)
        .map((l) => ({
          LoadCase: p.id,
          Axle: l.axle,
          X: l.x,
          Y: p.y,
          Load_kN: l.load * 2,
        })),
    ),
  );
  add("07_Wheel_Loads", coordinateRows(project, positions));
  add("08_Load_Cases", summary);
  add("09_STAAD_Output", [
    {
      Notice:
        "Nodal STD export requires verified vehicle and explicit structural node mapping. No STAAD commands generated in this workbook.",
    },
  ]);
  add("10_Generation_Log", [
    {
      Generated: new Date().toISOString(),
      ...project.rules,
      Positions: positions.length,
      Excluded: summary.filter((p) => p.Excluded).length,
      Configuration: project.configurationVersion,
    },
  ]);
  download(
    `${fileName(project)}_Positions.xlsx`,
    await wb.xlsx.writeBuffer(),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
