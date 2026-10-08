import { describe, it, expect } from "vitest";
import {
  generate,
  sequence,
  calculateLoads,
  parseProject,
  laneCenters,
} from "./generate";
import { initialProject } from "../store";
import { csvCell, parseNodes, staadText } from "./export";
import type { Vehicle } from "./types";
const b = initialProject.bridge,
  r = initialProject.rules;
const v: Vehicle = {
  id: "test",
  name: "Test vehicle",
  code: "Custom",
  type: "custom",
  width: 2,
  length: 4,
  verified: true,
  axles: [
    { position: 0, load: 80, wheelSpacing: 1.6 },
    { position: 4, load: 120, wheelSpacing: 1.6 },
  ],
};
describe("position engine", () => {
  it("includes non-aligned end exactly once", () => {
    const a = sequence(-16.25, 60, 0.5);
    expect(a).toHaveLength(154);
    expect(a.slice(-2)).toEqual([59.75, 60]);
  });
  it("does not duplicate an aligned endpoint", () =>
    expect(sequence(0, 1, 0.1)).toHaveLength(11));
  it("handles a single position", () =>
    expect(sequence(3, 3, 0.5)).toEqual([3]));
  it.each([0, -1, NaN, Infinity])("rejects invalid increment %s", (s) =>
    expect(() => sequence(0, 1, s)).toThrow(),
  );
  it("rejects reversed bounds and oversized sequences", () => {
    expect(() => sequence(4, 1, 1)).toThrow();
    expect(() => sequence(0, 20000, 1)).toThrow();
  });
  it("computes equal-width lane centres including asymmetric shoulders", () => {
    expect(laneCenters(b)).toEqual([-1.875, 1.875]);
    expect(laneCenters({ ...b, leftShoulder: 0.5, rightShoulder: 1 })).toEqual([
      -2.125, 1.625,
    ]);
  });
  it("forms a deterministic matrix with unique case ids", () => {
    const cases = generate(b, v, r);
    expect(cases).toHaveLength(308);
    expect(new Set(cases.map((p) => p.id)).size).toBe(308);
    expect(cases[0].id).toBe(101);
    expect(cases.at(-1)?.x).toBe(60);
    expect(cases[2].x).toBe(-15.75);
  });
  it("preserves total wheel load and reverses coordinates", () => {
    const loads = calculateLoads(v, 10, -1, -1, b);
    expect(loads.map((l) => l.x)).toEqual([10, 10, 6, 6]);
    loads.forEach((l, i) =>
      expect(l.y).toBeCloseTo([-1.8, -0.2, -1.8, -0.2][i], 12),
    );
    expect(loads.reduce((s, l) => s + l.load, 0)).toBe(200);
  });
  it("distinguishes outside from partial using the entire footprint", () => {
    const pos = (x: number, y = 0) =>
      generate(b, v, { ...r, mode: "single", startX: x, y })[0];
    expect(pos(-5).status).toBe("outside");
    expect(pos(-2).status).toBe("partial");
    expect(pos(0).status).toBe("valid");
    expect(pos(58).status).toBe("partial");
    expect(pos(61).autoExcluded).toBe(true);
    expect(pos(20, 5).status).toBe("outside");
    expect(pos(20, 3).status).toBe("partial");
  });
  it("keeps excluded cases for audit", () => {
    const cases = generate(b, v, {
      ...r,
      mode: "longitudinal",
      startX: -10,
      endX: -6,
      stepX: 1,
    });
    expect(cases).toHaveLength(5);
    expect(cases.every((p) => p.autoExcluded)).toBe(true);
  });
  it("prevents invalid geometry", () =>
    expect(() => generate({ ...b, carriagewayWidth: 10 }, v, r)).toThrow(
      "Carriageway",
    ));
  it("rejects overlapping axles", () =>
    expect(() =>
      generate(b, { ...v, axles: [v.axles[0], v.axles[0]] }, r),
    ).toThrow("overlap"));
  it("preserves deterministic project roundtrip", () => {
    const restored = parseProject(JSON.stringify(initialProject));
    expect(
      generate(restored.bridge, restored.vehicles[0], restored.rules),
    ).toEqual(generate(b, initialProject.vehicles[0], r));
  });
  it("rejects unsupported project versions", () =>
    expect(() => parseProject('{"version":2}')).toThrow());
  it("rejects malformed import schemas and annotations", () => {
    expect(() => parseProject("null")).toThrow();
    expect(() =>
      parseProject(
        JSON.stringify({ ...initialProject, bridge: { length: 60 } }),
      ),
    ).toThrow("dimensions");
    expect(() =>
      parseProject(
        JSON.stringify({
          ...initialProject,
          marks: { 101: { excluded: "false" } },
        }),
      ),
    ).toThrow("annotations");
  });
  it("prevents contradictory track geometry", () => {
    const track = initialProject.vehicles[2];
    expect(() => generate(b, { ...track, trackSpacing: 1.5 }, r)).toThrow(
      "spacing equal",
    );
  });
  it("supports 10,000 positions", () => {
    const cases = generate(b, initialProject.vehicles[0], {
      ...r,
      mode: "longitudinal",
      startX: 0,
      endX: 9999,
      stepX: 1,
    });
    expect(cases).toHaveLength(10000);
    expect(cases.flatMap((p) => p.loads)).toHaveLength(140000);
  });
});
describe("export safeguards", () => {
  const project = { ...initialProject, vehicles: [v], selectedVehicle: v.id };
  const positions = generate(b, v, { ...r, mode: "single", startX: 0, y: 0 });
  const nodes = positions[0].loads.map((l, i) => ({
    id: i + 1,
    x: l.x,
    y: l.y,
    z: 0,
  }));
  it("exports explicit global negative Z nodal loads", () => {
    const text = staadText(project, positions, nodes, 0.001);
    expect(text).toContain("LOAD 101 LOADTYPE Live");
    expect(text).toContain("1 FZ -40.000000");
    expect(text).toContain("4 FZ -60.000000");
    expect(text).toContain("SET Z UP");
  });
  it("blocks unverified vehicle data", () =>
    expect(() =>
      staadText(
        { ...project, vehicles: [{ ...v, verified: false }] },
        positions,
        nodes,
        0.001,
      ),
    ).toThrow("verify"));
  it("blocks missing or ambiguous node matches", () => {
    expect(() => staadText(project, positions, [], 0.001)).toThrow("no node");
    expect(() =>
      staadText(project, positions, [...nodes, { ...nodes[0], id: 99 }], 0.001),
    ).toThrow("ambiguous");
  });
  it("omits excluded cases", () =>
    expect(() =>
      staadText(
        { ...project, marks: { 101: { excluded: true } } },
        positions,
        nodes,
        0.001,
      ),
    ).toThrow("no included"));
  it("blocks tracked point-load approximation", () =>
    expect(() =>
      staadText(
        { ...project, vehicles: [{ ...v, type: "tracked" }] },
        positions,
        nodes,
        0.001,
      ),
    ).toThrow("Track resultants"));
  it("validates node coordinates and duplicate IDs", () => {
    expect(parseNodes("1,2,3,0")).toEqual([{ id: 1, x: 2, y: 3, z: 0 }]);
    expect(() => parseNodes("1,2,3")).toThrow();
    expect(() => parseNodes("1,2,3,0\n1,4,5,0")).toThrow("unique");
  });
  it("quotes and sanitizes CSV cells", () => {
    expect(csvCell('x,"y"')).toBe('"x,""y"""');
    expect(csvCell("=SUM(A1)")).toBe('"\'=SUM(A1)"');
    expect(csvCell(-1.25)).toBe('"-1.25"');
  });
});
