import { useEffect, useMemo, useState } from "react";
import { generate, ranges, validate, MAX_POSITIONS } from "../engine/generate";
import type { Bridge, Vehicle, Rules, Position } from "../engine/types";
interface Result {
  positions: Position[];
  error: string;
  pending: number;
  busy: boolean;
}
const empty: Result = { positions: [], error: "", pending: 0, busy: false };
/** Jobs above 5,000 cases require approval and execute off the UI thread.
 * Each input change terminates the previous worker; stale results are never displayed.
 */
export function useGeneration(
  bridge: Bridge,
  vehicle: Vehicle,
  rules: Rules,
  approved: string,
) {
  const key = JSON.stringify([bridge, vehicle, rules]);
  const local = useMemo((): Result => {
    try {
      const errors = validate(bridge, vehicle, rules);
      if (errors.length) throw new Error(errors.join("\n"));
      const { xs, ys } = ranges(bridge, rules);
      const count = xs.length * ys.length;
      if (count > MAX_POSITIONS)
        throw new Error(
          "Matrix exceeds 10,000 positions. Increase increments or reduce the sweep range.",
        );
      if (count > 5000)
        return { ...empty, pending: count, busy: approved === key };
      return { ...empty, positions: generate(bridge, vehicle, rules) };
    } catch (error) {
      return { ...empty, error: (error as Error).message };
    }
  }, [key, approved]);
  const [remote, setRemote] = useState<{ key: string; result: Result } | null>(
    null,
  );
  useEffect(() => {
    if (!local.busy) return;
    const worker = new Worker(
      new URL("../engine/generate.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event) => {
      setRemote({ key, result: { ...empty, ...event.data } });
      worker.terminate();
    };
    worker.onerror = () => {
      setRemote({
        key,
        result: {
          ...empty,
          error:
            "Unable to run the generation worker. Reduce the matrix to 5,000 cases or fewer and retry.",
        },
      });
      worker.terminate();
    };
    worker.postMessage({ bridge, vehicle, rules });
    return () => worker.terminate();
  }, [key, local.busy]);
  return local.busy && remote?.key === key ? remote.result : local;
}
