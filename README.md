# Span · STAAD.Pro Live Load Vehicle Position Generator

A desktop-first engineering workspace built with **React, TypeScript, Vite, Zustand and SVG**, with a sandboxed Electron entry point. The previously empty repository now contains a functional first implementation of the supplied PRD, **not a certified, production-ready implementation of every requirement**.

## Run

Use Node.js 22.12 or later.

```sh
npm ci
npm run dev                 # http://localhost:5173
npm run build               # TypeScript checks + production assets
npm test                    # engineering engine / export tests
npm run desktop             # build and open Electron on a desktop machine
```

The web app runs entirely locally in the browser; there is no server-side storage, analytics, API key or paid service. Save projects explicitly as `.staadllg` files. Normal npm installation downloads Electron; environments using `ELECTRON_SKIP_BINARY_DOWNLOAD=1` must subsequently run `node node_modules/electron/install.js` before launching the desktop app. Electron has not been exercised on Windows in this environment; an installer is not yet packaged.

## Implemented workflow

- Editable single-span bridge length, deck/carriageway widths, asymmetric shoulders and equal-width lanes.
- Synchronized, proportionally scaled SVG plan and cross-section, start-position ghost, lane centres, wheel tooltips, dimensions, grid, zoom and middle-button pan.
- Separate editable IRC reference templates; custom vehicle copies, axle positions, loads and spacings; tracked footprints and explicit resultant representation.
- Single, longitudinal, transverse and full X×Y matrix modes for **one selected vehicle at a time**. Lane-centre placement, explicit Y offset or Y sweep, and +X/−X travel.
- Automatic regeneration for up to 5,000 cases; explicit confirmation and Web Worker generation above that, capped at 10,000 cases. Stale workers are terminated when inputs change.
- Distinct valid/partial/outside footprint statuses. Outside cases remain in the schedule and can be auto-excluded.
- Position slider, playback speeds, keyboard navigation, exact wheel/axle coordinate inspection and on-deck load sums.
- Paginated load-case table, free-text coordinate/case search, status filtering, bookmarks, manual critical/governing marking and export exclusion.
- Undo/redo for model changes; project JSON save/open with runtime validation and version/configuration metadata. Edits affecting the matrix intentionally clear position annotations to avoid attaching old marks to new coordinates.
- CSV coordinate schedule, actual XLSX workbook with the ten requested sheets, guarded static nodal `.STD` load fragments, and browser print/save-PDF of the **current workspace and visible table page**.

### Keyboard shortcuts

| Keys                   | Action                        |
| ---------------------- | ----------------------------- |
| Ctrl/Cmd S / O / N / E | Save / open / new / export    |
| Ctrl/Cmd Z / Y         | Undo / redo                   |
| ← / →, Home / End      | Previous / next, first / last |
| Space                  | Play / pause                  |
| F, +, −                | Fit / zoom                    |
| Middle-button drag     | Pan                           |
| Double click in plan   | Reset view                    |

## Engineering contract

**This application does not perform structural analysis or determine criticality.** A licensed/qualified engineer must verify vehicle definitions, code applicability, impact factors, structural mapping and exported loads.

- Coordinates are **X longitudinal, Y transverse, Z vertical**, in metres; forces are kN. Internal values retain floating-point precision. The current version supports only canonical **kN–m** units.
- IRC definitions in `src/data/codes/irc6/vehicles.ts` are **reference templates, not certified code data**. Their verification flag defaults to false. User verification is an acknowledgement, not software certification.
- An axle's coordinates are `X = startX + direction × axle.position`; wheel coordinates are `Y = startY ± wheelSpacing / 2`. Each axle load is divided equally between the two wheel points. Unequal wheel loads are not yet supported.
- Vehicle footprint X bounds are the sorted start and directed end coordinates. Status also checks the footprint against the carriageway edges. “Outside” means entirely outside either interval; touching an edge is partial. An X footprint from −16.25 to −1.25 m is **outside**, correcting the contradictory PRD example.
- Boundary status uses the vehicle body; on-deck wheel checks use the rectangular **deck**. These intentionally differ for shoulders and partial positions. No automatic IRC placement/clearance assumptions are applied.
- Both sweep endpoints are included. `−16.25…60` at `0.5 m` produces **154** X positions (including the final 60.0 m position), and 308 positions for two lane centres. The PRD's 153-position example excludes that non-aligned endpoint.
- Tracked vehicles render continuous rectangles but exported coordinate loads are **two central track resultants, not contact pressure or clipped patch loads**. Static nodal export is disabled for tracks.

### STAAD export safety

The `.STD` output is a **load fragment for insertion into an existing reviewed model**, not a standalone STAAD model and not a `DEFINE MOVING LOAD` command.

1. Review the vehicle and explicitly mark its data verified.
2. Supply structural nodes as `ID,X,Y,Z`, in metres, one per line.
3. Each on-deck wheel must match **exactly one** supplied node within the explicit 3D tolerance. Missing and ambiguous matches fail the entire export. No nearest-node approximation is silently performed.
4. Confirm that the host model uses **`SET Z UP`**, metres/kN and compatible, non-colliding load-case IDs. The application writes global **negative `FZ`** loads. It cannot validate the host model without a structural-model importer.
5. Manually and automatically excluded positions are skipped, as are off-deck wheels and cases with no on-deck loads. Loads mapped to the same node in a case are summed.
6. The workbook's `09_STAAD_Output` sheet explicitly reports the mapping requirement; it does not invent unmapped STAAD commands.

No material model, supports, members, analysis command, load combination, impact factor or distribution factor is created.

## Architecture

```text
src/engine/types.ts             Canonical project/vehicle/load types
src/engine/generate.ts          Pure geometry, sweep, validation and load engine
src/engine/generate.worker.ts   Background worker entry
src/engine/export.ts            CSV, lazy-loaded ExcelJS and safe nodal exporter
src/engine/generate.test.ts     Numerical and export regression tests
src/hooks/useGeneration.ts     Confirmation, worker lifecycle and stale-job handling
src/data/codes/irc6/vehicles.ts  Versioned reference configuration
src/store.ts                   Zustand project state and undo/redo history
src/components/Views.tsx        Shared-data plan and cross-section
src/App.tsx                    Workspace, input panels, inspection and dialogs
src/styles.css                 Responsive CAD-style design system
scripts/browser-check.mjs      Real-browser workflow and download regression checks
electron/main.cjs              Sandboxed desktop entry (no Node access in renderer)
```

ExcelJS is loaded only when an Excel export is requested, so its large bundle does not block startup. Its UUID transitive dependency is overridden to a patched release. Production builds report its expected large-chunk warning.

## Browser QA

With the dev server running, `npm run test:browser` uses Playwright and Chromium supplied via npm. Checks include geometry validation, position navigation, bookmarks/search, project round-trip, custom vehicles, CSV and XLSX downloads (including workbook contents), tracked footprints, a 6,068-case background worker job and a 390px mobile viewport. No generated files are committed.

Minimal Linux CI images may need the bundled shared libraries:

```sh
node --input-type=module -e "import {inflate} from './node_modules/@sparticuz/chromium/build/lambdafs.js'; await inflate('./node_modules/@sparticuz/chromium/bin/al2023.tar.br');"
LD_LIBRARY_PATH=/tmp/al2023/lib npm run test:browser
```

`TEST_URL` overrides the server URL. Optional `SCREENSHOT_PATH` saves a final mobile screenshot. The browser-test Chromium package targets Linux; Windows/macOS testing should use a native Playwright browser instead.

## Remaining PRD scope / production gates

The following are deliberately **not claimed complete**:

- Certified IRC datasets and code-specific placement rules; engineering peer review of all loading conventions.
- Multi-vehicle matrices/simultaneous vehicle combinations, variable-width lanes, kerbs, medians, skew and configurable origin.
- N–mm and kN–mm unit conversion; configurable display/grid precision.
- Automatic structural-node import, nearest-node mapping, interpolation, member/plate/floor load export and moving-load STAAD commands.
- Position comparison overlays, graphical object selection, measurement tools and snapping.
- Full persistent engineering audit history and a paginated report for all selected positions (current report prints the visible workspace only).
- Windows installer/signing and desktop end-to-end QA, accessibility audit, automated STAAD round-trip validation and independently verified benchmark datasets.
- Tailwind integration: this implementation uses a purpose-built CSS design system rather than Tailwind utilities.

These gaps should be resolved before calling the product production-ready for real bridge design work. No analysis solver, influence lines or automatic governing-position search is included.
