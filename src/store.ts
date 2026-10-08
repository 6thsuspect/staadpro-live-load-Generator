import { create } from "zustand";
import { vehicles } from "./data/codes/irc6/vehicles";
import type { Project } from "./engine/types";
export const initialProject: Project = {
  version: 1,
  name: "River crossing bridge",
  number: "BR-2026-001",
  designer: "",
  standard: "IRC 6",
  configurationVersion: "irc6-reference-1",
  bridge: {
    length: 60,
    deckWidth: 9,
    carriagewayWidth: 7.5,
    leftShoulder: 0.75,
    rightShoulder: 0.75,
    lanes: 2,
  },
  vehicles,
  selectedVehicle: "70r-wheeled",
  rules: {
    mode: "matrix",
    startX: -16.25,
    endX: 60,
    stepX: 0.5,
    transverse: "lanes",
    y: -1.875,
    startY: -2.25,
    endY: 2.25,
    stepY: 0.5,
    direction: 1,
    firstCase: 101,
    excludeOutside: true,
  },
  marks: {},
};
interface State {
  project: Project;
  history: Project[];
  future: Project[];
  setProject: (p: Project) => void;
  update: (change: Partial<Project>) => void;
  undo: () => void;
  redo: () => void;
}
export const useStore = create<State>((set) => ({
  project: structuredClone(initialProject),
  history: [],
  future: [],
  setProject: (p) => set({ project: p, history: [], future: [] }),
  update: (change) =>
    set((s) => ({
      project: { ...s.project, ...change },
      history: [...s.history.slice(-49), s.project],
      future: [],
    })),
  undo: () =>
    set((s) =>
      s.history.length
        ? {
            project: s.history.at(-1)!,
            history: s.history.slice(0, -1),
            future: [s.project, ...s.future],
          }
        : s,
    ),
  redo: () =>
    set((s) =>
      s.future.length
        ? {
            project: s.future[0],
            history: [...s.history, s.project],
            future: s.future.slice(1),
          }
        : s,
    ),
}));
