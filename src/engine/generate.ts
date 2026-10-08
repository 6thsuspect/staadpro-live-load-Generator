import type {
  Bridge,
  Vehicle,
  Rules,
  Position,
  LoadPoint,
  Project,
} from "./types";
export const MAX_POSITIONS = 10000;
export function sequence(start: number, end: number, step: number): number[] {
  if (![start, end, step].every(Number.isFinite) || step <= 0 || end < start)
    throw new Error(
      "Range end must be at least its start, and increment must be greater than zero.",
    );
  const count = Math.floor((end - start) / step + 1e-10);
  if (count > MAX_POSITIONS)
    throw new Error(
      "This sweep exceeds the 10,000-position limit. Increase the increment.",
    );
  const result = Array.from({ length: count + 1 }, (_, i) => start + i * step);
  if (end - result[result.length - 1] > 1e-9) result.push(end);
  return result;
}
export function validate(
  bridge: Bridge,
  vehicle: Vehicle,
  rules: Rules,
): string[] {
  const errors: string[] = [];
  if (!Object.values(bridge).every(Number.isFinite))
    errors.push("Bridge dimensions must be finite numbers.");
  if (
    bridge.length <= 0 ||
    bridge.deckWidth <= 0 ||
    bridge.carriagewayWidth <= 0 ||
    bridge.leftShoulder < 0 ||
    bridge.rightShoulder < 0
  )
    errors.push(
      "Bridge dimensions must be positive; shoulders cannot be negative.",
    );
  if (bridge.carriagewayWidth > bridge.deckWidth)
    errors.push("Carriageway width exceeds the deck width.");
  if (
    Math.abs(
      bridge.carriagewayWidth +
        bridge.leftShoulder +
        bridge.rightShoulder -
        bridge.deckWidth,
    ) > 0.001
  )
    errors.push("Carriageway and shoulders must add up to the deck width.");
  if (!Number.isInteger(bridge.lanes) || bridge.lanes < 1 || bridge.lanes > 12)
    errors.push("Number of lanes must be an integer from 1 to 12.");
  if (
    !Number.isFinite(vehicle.width) ||
    !Number.isFinite(vehicle.length) ||
    vehicle.width <= 0 ||
    vehicle.length <= 0 ||
    !vehicle.axles.length
  )
    errors.push("Vehicle dimensions and at least one axle are required.");
  if (
    vehicle.axles.some(
      (a) =>
        ![a.position, a.load, a.wheelSpacing].every(Number.isFinite) ||
        a.position < 0 ||
        a.position > vehicle.length ||
        a.load <= 0 ||
        a.wheelSpacing <= 0 ||
        a.wheelSpacing > vehicle.width,
    )
  )
    errors.push(
      "Check axle positions, positive loads and wheel spacing within vehicle width.",
    );
  if (
    vehicle.type === "tracked" &&
    (vehicle.axles.length !== 1 ||
      Math.abs(vehicle.axles[0].position - vehicle.length / 2) > 1e-8 ||
      vehicle.axles[0].wheelSpacing !== vehicle.trackSpacing)
  )
    errors.push(
      "Tracked vehicles require one central resultant pair with spacing equal to track centres.",
    );
  if (
    new Set(vehicle.axles.map((a) => a.position)).size !== vehicle.axles.length
  )
    errors.push("Axle positions must not overlap.");
  if (
    vehicle.type === "tracked" &&
    (!(vehicle.trackWidth! > 0) ||
      !(vehicle.trackSpacing! > 0) ||
      vehicle.trackWidth! > vehicle.trackSpacing! ||
      vehicle.trackSpacing! + vehicle.trackWidth! > vehicle.width + 1e-8)
  )
    errors.push(
      "Track width and spacing must fit within vehicle width without overlap.",
    );
  if (
    ![
      rules.startX,
      rules.endX,
      rules.stepX,
      rules.y,
      rules.startY,
      rules.endY,
      rules.stepY,
      rules.firstCase,
    ].every(Number.isFinite)
  )
    errors.push("Movement settings must be finite numbers.");
  if (!Number.isInteger(rules.firstCase) || rules.firstCase < 1)
    errors.push("First load case must be a positive integer.");
  if (rules.direction !== 1 && rules.direction !== -1)
    errors.push("Direction must be +X or −X.");
  return errors;
}
export function laneCenters(b: Bridge) {
  return Array.from(
    { length: b.lanes },
    (_, i) =>
      -b.deckWidth / 2 +
      b.leftShoulder +
      ((i + 0.5) * b.carriagewayWidth) / b.lanes,
  );
}
export function ranges(b: Bridge, r: Rules) {
  const xs =
    r.mode === "single" || r.mode === "transverse"
      ? [r.startX]
      : sequence(r.startX, r.endX, r.stepX);
  const ys =
    r.mode === "single" || r.mode === "longitudinal"
      ? [r.y]
      : r.transverse === "lanes"
        ? laneCenters(b)
        : r.transverse === "sweep"
          ? sequence(r.startY, r.endY, r.stepY)
          : [r.y];
  return { xs, ys };
}
export function calculateLoads(
  v: Vehicle,
  x: number,
  y: number,
  d: 1 | -1,
  b: Bridge,
): LoadPoint[] {
  return v.axles.flatMap((a, i) =>
    [-1, 1].map((side, j) => {
      const px = x + d * a.position,
        py = y + (side * a.wheelSpacing) / 2;
      return {
        axle: i + 1,
        wheel: i * 2 + j + 1,
        x: px,
        y: py,
        load: a.load / 2,
        onDeck: px >= 0 && px <= b.length && Math.abs(py) <= b.deckWidth / 2,
      };
    }),
  );
}
export function generate(b: Bridge, v: Vehicle, r: Rules): Position[] {
  const errors = validate(b, v, r);
  if (errors.length) throw new Error(errors.join("\n"));
  const { xs, ys } = ranges(b, r);
  if (xs.length * ys.length > MAX_POSITIONS)
    throw new Error(
      "Matrix exceeds 10,000 positions. Increase increments or reduce the sweep range.",
    );
  const low = -b.deckWidth / 2 + b.leftShoulder,
    high = low + b.carriagewayWidth;
  return xs
    .flatMap((x) =>
      ys.map((y) => {
        const a = Math.min(x, x + r.direction * v.length),
          z = Math.max(x, x + r.direction * v.length);
        const status =
          z < 0 ||
          a > b.length ||
          y + v.width / 2 < low ||
          y - v.width / 2 > high
            ? "outside"
            : a >= 0 &&
                z <= b.length &&
                y - v.width / 2 >= low &&
                y + v.width / 2 <= high
              ? "valid"
              : "partial";
        return {
          id: 0,
          vehicleId: v.id,
          x,
          y,
          direction: r.direction,
          status,
          autoExcluded: r.excludeOutside && status === "outside",
          loads: calculateLoads(v, x, y, r.direction, b),
        } as Position;
      }),
    )
    .map((p, i) => ({ ...p, id: r.firstCase + i }));
}
export function parseProject(text: string): Project {
  const p = JSON.parse(text) as Project;
  if (!p || typeof p !== "object")
    throw new Error("Project must be a JSON object.");
  if (
    p.version !== 1 ||
    typeof p.name !== "string" ||
    !Array.isArray(p.vehicles) ||
    !p.vehicles.length ||
    !p.bridge ||
    !p.rules ||
    !p.marks ||
    !p.configurationVersion
  )
    throw new Error("Not a supported .staadllg project (version 1).");
  if (
    [
      "length",
      "deckWidth",
      "carriagewayWidth",
      "leftShoulder",
      "rightShoulder",
      "lanes",
    ].some(
      (key) =>
        typeof (p.bridge as unknown as Record<string, unknown>)[key] !==
        "number",
    )
  )
    throw new Error("Missing or invalid bridge dimensions.");
  if (
    typeof p.selectedVehicle !== "string" ||
    typeof p.number !== "string" ||
    typeof p.designer !== "string" ||
    !["IRC 6", "Custom"].includes(p.standard)
  )
    throw new Error("Missing project metadata.");
  if (
    new Set(p.vehicles.map((v) => v?.id)).size !== p.vehicles.length ||
    p.vehicles.some(
      (v) =>
        !v ||
        typeof v.id !== "string" ||
        !v.id ||
        typeof v.verified !== "boolean",
    )
  )
    throw new Error(
      "Vehicle IDs must be unique and verification state explicit.",
    );
  if (
    Array.isArray(p.marks) ||
    typeof p.marks !== "object" ||
    Object.entries(p.marks).some(
      ([id, m]) =>
        !Number.isInteger(Number(id)) ||
        Number(id) < 1 ||
        !m ||
        typeof m !== "object" ||
        Object.entries(m).some(
          ([key, value]) =>
            !["bookmark", "critical", "governing", "excluded"].includes(key) ||
            typeof value !== "boolean",
        ),
    )
  )
    throw new Error("Invalid position annotations.");
  if (
    !["single", "longitudinal", "transverse", "matrix"].includes(
      p.rules.mode,
    ) ||
    !["single", "lanes", "sweep"].includes(p.rules.transverse)
  )
    throw new Error("Unrecognized generation mode.");
  for (const v of p.vehicles) {
    if (
      !v ||
      !Array.isArray(v.axles) ||
      !["wheeled", "custom", "tracked"].includes(v.type) ||
      typeof v.name !== "string"
    )
      throw new Error("Invalid vehicle definition.");
    const errors = validate(p.bridge, v, p.rules);
    if (errors.length) throw new Error(errors.join("\n"));
  }
  const v = p.vehicles.find((v) => v.id === p.selectedVehicle);
  if (!v) throw new Error("Selected vehicle is missing.");
  generate(p.bridge, v, p.rules);
  return p;
}
