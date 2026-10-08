export interface Bridge {
  length: number;
  deckWidth: number;
  carriagewayWidth: number;
  leftShoulder: number;
  rightShoulder: number;
  lanes: number;
}
export interface Axle {
  position: number;
  load: number;
  wheelSpacing: number;
}
export interface Vehicle {
  id: string;
  name: string;
  code: string;
  type: "wheeled" | "tracked" | "custom";
  width: number;
  length: number;
  axles: Axle[];
  trackWidth?: number;
  trackSpacing?: number;
  verified: boolean;
}
export interface Rules {
  mode: "single" | "longitudinal" | "transverse" | "matrix";
  startX: number;
  endX: number;
  stepX: number;
  transverse: "single" | "lanes" | "sweep";
  y: number;
  startY: number;
  endY: number;
  stepY: number;
  direction: 1 | -1;
  firstCase: number;
  excludeOutside: boolean;
}
export interface LoadPoint {
  axle: number;
  wheel: number;
  x: number;
  y: number;
  load: number;
  onDeck: boolean;
}
export interface Position {
  id: number;
  vehicleId: string;
  x: number;
  y: number;
  direction: 1 | -1;
  status: "valid" | "partial" | "outside";
  autoExcluded: boolean;
  loads: LoadPoint[];
}
export interface Mark {
  bookmark?: boolean;
  critical?: boolean;
  governing?: boolean;
  excluded?: boolean;
}
export interface Project {
  version: 1;
  name: string;
  number: string;
  designer: string;
  standard: string;
  bridge: Bridge;
  vehicles: Vehicle[];
  selectedVehicle: string;
  rules: Rules;
  marks: Record<number, Mark>;
  configurationVersion: string;
}
