import { generate } from "./generate";
import type { Bridge, Vehicle, Rules } from "./types";
self.onmessage = (
  event: MessageEvent<{ bridge: Bridge; vehicle: Vehicle; rules: Rules }>,
) => {
  try {
    const { bridge, vehicle, rules } = event.data;
    self.postMessage({
      positions: generate(bridge, vehicle, rules),
      error: "",
    });
  } catch (error) {
    self.postMessage({ positions: [], error: (error as Error).message });
  }
};
