import { useRef, useState } from "react";
import type { Bridge, Vehicle, Position } from "../engine/types";
import { laneCenters } from "../engine/generate";
export const fmt = (n: number, d = 3) => n.toFixed(d);
interface Props {
  bridge: Bridge;
  vehicle: Vehicle;
  position: Position;
  startX: number;
  grid: boolean;
  dimensions: boolean;
  zoom: number;
  setZoom: (n: number) => void;
  onCursor: (x: number, y: number) => void;
}
export function PlanView({
  bridge: b,
  vehicle: v,
  position: p,
  startX,
  grid,
  dimensions,
  zoom,
  setZoom,
  onCursor,
}: Props) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const s = 730 / (b.length + v.length + 6),
    ox = 100 + v.length * s,
    oy = 185;
  const sx = (x: number) => ox + x * s,
    sy = (y: number) => oy - y * s;
  const left = -b.deckWidth / 2 + b.leftShoulder,
    right = left + b.carriagewayWidth;
  const vStart = Math.min(p.x, p.x + p.direction * v.length);
  const vehicleGraphic = (x: number, y: number, ghost = false) => (
    <g opacity={ghost ? 0.28 : 1}>
      <rect
        x={sx(x)}
        y={sy(y + v.width / 2)}
        width={v.length * s}
        height={v.width * s}
        rx={2}
        fill={ghost ? "#9caba9" : "#d2e9e0"}
        stroke={ghost ? "#697d77" : "#168064"}
        strokeWidth={1.4}
        strokeDasharray={ghost ? "5 4" : undefined}
      />
      {!ghost &&
        v.type !== "tracked" &&
        v.axles.map((a, i) => (
          <g key={i}>
            <line
              x1={sx(p.x + p.direction * a.position)}
              y1={sy(p.y + a.wheelSpacing / 2)}
              x2={sx(p.x + p.direction * a.position)}
              y2={sy(p.y - a.wheelSpacing / 2)}
              stroke="#2e6f5b"
              strokeWidth="1.4"
            />
            {[-1, 1].map((side) => (
              <rect
                key={side}
                x={sx(p.x + p.direction * a.position) - 2.5}
                y={sy(p.y + (side * a.wheelSpacing) / 2) - 3.5}
                width="5"
                height="7"
                rx="1"
                fill="#224c40"
              >
                <title>
                  Wheel W{i * 2 + (side === -1 ? 1 : 2)} · Axle {i + 1}
                  {"\n"}X {fmt(p.x + p.direction * a.position)} m · Y{" "}
                  {fmt(p.y + (side * a.wheelSpacing) / 2)} m{"\n"}
                  {fmt(a.load / 2, 2)} kN
                </title>
              </rect>
            ))}
          </g>
        ))}
      {!ghost &&
        v.type === "tracked" &&
        [-1, 1].map((side) => (
          <rect
            key={side}
            x={sx(x)}
            y={sy(y + (side * v.trackSpacing!) / 2 + v.trackWidth! / 2)}
            width={v.length * s}
            height={v.trackWidth! * s}
            fill="url(#track)"
            stroke="#235e4d"
          />
        ))}
    </g>
  );
  return (
    <svg
      className="plan-svg"
      viewBox="0 0 900 350"
      aria-label="Bridge plan with vehicle load coordinates"
      onWheel={(e) =>
        setZoom(Math.max(0.65, Math.min(3, zoom * (e.deltaY < 0 ? 1.1 : 0.9))))
      }
      onPointerDown={(e) => {
        if (e.button === 1) {
          e.preventDefault();
          drag.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (drag.current) {
          const dx = ((e.clientX - drag.current.x) * 900) / rect.width;
          const dy = ((e.clientY - drag.current.y) * 350) / rect.height;
          setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
          drag.current = { x: e.clientX, y: e.clientY };
        }
        const point = e.currentTarget.createSVGPoint();
        point.x = e.clientX;
        point.y = e.clientY;
        const ctm = e.currentTarget.getScreenCTM();
        if (ctm) {
          const q = point.matrixTransform(ctm.inverse());
          onCursor(
            ((q.x - 450 - pan.x) / zoom + 450 - ox) / s,
            (oy - ((q.y - 175 - pan.y) / zoom + 175)) / s,
          );
        }
      }}
      onDoubleClick={() => {
        setPan({ x: 0, y: 0 });
        setZoom(1);
      }}
    >
      <defs>
        <pattern
          id="grid"
          width={s}
          height={s}
          patternUnits="userSpaceOnUse"
          x={ox}
          y={oy}
        >
          <path
            d={`M ${s} 0 L 0 0 0 ${s}`}
            fill="none"
            stroke="#e9eeec"
            strokeWidth=".6"
          />
        </pattern>
        <pattern id="track" width="5" height="5" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill="#6b9b87" />
          <path d="M0 0H5" stroke="#255742" />
        </pattern>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#81918b" />
        </marker>
      </defs>
      {grid && <rect width="900" height="350" fill="url(#grid)" />}
      <g
        transform={`translate(${450 + pan.x} ${175 + pan.y}) scale(${zoom}) translate(-450 -175)`}
      >
        {dimensions && (
          <g className="svg-dimension">
            <line
              x1={sx(0)}
              y1={70}
              x2={sx(b.length)}
              y2={70}
              markerStart="url(#arrow)"
              markerEnd="url(#arrow)"
            />
            <line x1={sx(0)} y1={62} x2={sx(0)} y2={sy(b.deckWidth / 2) - 10} />
            <line
              x1={sx(b.length)}
              y1={62}
              x2={sx(b.length)}
              y2={sy(b.deckWidth / 2) - 10}
            />
            <rect
              x={(sx(0) + sx(b.length)) / 2 - 51}
              y={59}
              width="102"
              height="20"
              fill="#fcfdfc"
            />
            <text x={(sx(0) + sx(b.length)) / 2} y={73} textAnchor="middle">
              {fmt(b.length)} m
            </text>
          </g>
        )}
        <rect
          x={sx(0)}
          y={sy(b.deckWidth / 2)}
          width={b.length * s}
          height={b.deckWidth * s}
          fill="#e4e9e6"
          stroke="#74877e"
          strokeWidth="1.4"
        >
          <title>
            Bridge · {fmt(b.length)} × {fmt(b.deckWidth)} m
          </title>
        </rect>
        <rect
          x={sx(0)}
          y={sy(right)}
          width={b.length * s}
          height={b.carriagewayWidth * s}
          fill="#f4f7f4"
          stroke="#a0afa6"
          strokeWidth=".7"
        />
        {laneCenters(b).map((y, i) => (
          <g key={i}>
            <line
              x1={sx(0)}
              x2={sx(b.length)}
              y1={sy(y)}
              y2={sy(y)}
              stroke="#c6d1cb"
              strokeDasharray="8 7"
            />
            <text
              x={sx(b.length) - 18}
              y={sy(y) - 8}
              textAnchor="end"
              className="lane-label"
            >
              LANE {i + 1}
              <title>
                Centre Y = {fmt(y)} m · Width{" "}
                {fmt(b.carriagewayWidth / b.lanes)} m
              </title>
            </text>
            {i > 0 && (
              <line
                x1={sx(0)}
                x2={sx(b.length)}
                y1={sy(left + (i * b.carriagewayWidth) / b.lanes)}
                y2={sy(left + (i * b.carriagewayWidth) / b.lanes)}
                stroke="#bdc9c2"
                strokeDasharray="12 6"
              />
            )}
          </g>
        ))}
        <line
          x1={sx(-3)}
          y1={sy(0)}
          x2={sx(b.length + 3)}
          y2={sy(0)}
          stroke="#8ca397"
          strokeWidth=".8"
          strokeDasharray="12 4 2 4"
        />
        <text x={sx(b.length) + 12} y={sy(0) + 4} className="svg-small">
          CL
        </text>
        {vehicleGraphic(
          Math.min(startX, startX + p.direction * v.length),
          p.y,
          true,
        )}
        <line
          x1={sx(startX)}
          y1={sy(b.deckWidth / 2) - 15}
          x2={sx(startX)}
          y2={sy(-b.deckWidth / 2) + 16}
          stroke="#99aba2"
          strokeDasharray="4 4"
        />
        <text
          x={sx(startX)}
          y={sy(b.deckWidth / 2) - 29}
          className="svg-small"
          textAnchor="middle"
        >
          START POSITION
        </text>
        <text
          x={sx(startX)}
          y={sy(b.deckWidth / 2) - 16}
          className="svg-small"
          textAnchor="middle"
        >
          {fmt(startX)} m
        </text>
        {vehicleGraphic(vStart, p.y)}
        <g
          transform={`translate(${sx(vStart + v.length / 2)},${sy(p.y + v.width / 2) - 23})`}
        >
          <rect
            x="-69"
            y="-14"
            width="138"
            height="22"
            rx="4"
            fill="#e5f2ec"
            stroke="#b9d9c8"
          />
          <text
            textAnchor="middle"
            y="1"
            fill="#19674e"
            fontSize="10"
            fontWeight="600"
          >
            {v.name.replace("IRC ", "")} · LC{p.id}
          </text>
          <path d="M0 8V20" stroke="#59937a" />
        </g>
        {Array.from({ length: 7 }, (_, i) => (b.length * i) / 6).map((x) => (
          <g key={x}>
            <line
              x1={sx(x)}
              x2={sx(x)}
              y1={sy(-b.deckWidth / 2) + 5}
              y2={sy(-b.deckWidth / 2) + 10}
              stroke="#95a59d"
            />
            <text
              x={sx(x)}
              y={sy(-b.deckWidth / 2) + 24}
              textAnchor="middle"
              className="svg-small"
            >
              {fmt(x, 0)}
            </text>
          </g>
        ))}
        {dimensions && (
          <g className="svg-dimension">
            <line
              x1={sx(b.length) + 38}
              x2={sx(b.length) + 38}
              y1={sy(b.deckWidth / 2)}
              y2={sy(-b.deckWidth / 2)}
              markerStart="url(#arrow)"
              markerEnd="url(#arrow)"
            />
            <text
              x={sx(b.length) + 50}
              y={oy}
              transform={`rotate(-90 ${sx(b.length) + 50} ${oy})`}
              textAnchor="middle"
            >
              {fmt(b.deckWidth)} m
            </text>
          </g>
        )}
        <g transform="translate(52 281)">
          <path
            d="M0 0H32 M0 0V-32"
            fill="none"
            stroke="#768e83"
            markerEnd="url(#arrow)"
          />
          <text x="37" y="4" className="svg-small">
            X
          </text>
          <text x="-4" y="-39" className="svg-small">
            Y
          </text>
          <circle r="3" fill="#557d69" />
        </g>
        <text x="450" y="322" textAnchor="middle" className="svg-small">
          LONGITUDINAL DIRECTION {p.direction === 1 ? "→" : "←"} · METRES
        </text>
      </g>
    </svg>
  );
}
export function CrossSection({
  bridge: b,
  vehicle: v,
  position: p,
}: Pick<Props, "bridge" | "vehicle" | "position">) {
  const scale = Math.min(60, 600 / b.deckWidth),
    cx = 440,
    y = 110,
    left = -b.deckWidth / 2 + b.leftShoulder;
  const sx = (n: number) => cx + n * scale;
  return (
    <svg
      className="section-svg"
      viewBox="0 0 900 190"
      aria-label="Dynamic bridge cross-section"
    >
      <defs>
        <pattern
          id="concrete"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
        >
          <path d="M0 8L8 0" stroke="#c6cdc7" strokeWidth=".6" />
        </pattern>
      </defs>
      <g className="svg-dimension">
        <line
          x1={sx(-b.deckWidth / 2)}
          x2={sx(b.deckWidth / 2)}
          y1="32"
          y2="32"
          markerStart="url(#arrow)"
          markerEnd="url(#arrow)"
        />
        <text x={cx} y="23" textAnchor="middle">
          {fmt(b.deckWidth)} m DECK
        </text>
        <line
          x1={sx(left)}
          x2={sx(left + b.carriagewayWidth)}
          y1="55"
          y2="55"
          markerStart="url(#arrow)"
          markerEnd="url(#arrow)"
        />
        <text x={cx} y="49" textAnchor="middle">
          {fmt(b.carriagewayWidth)} m CARRIAGEWAY
        </text>
      </g>
      <rect
        x={sx(-b.deckWidth / 2)}
        y={y}
        width={b.deckWidth * scale}
        height="22"
        fill="#e6eae5"
        stroke="#87988b"
      />
      <rect
        x={sx(-b.deckWidth / 2)}
        y={y}
        width={b.deckWidth * scale}
        height="22"
        fill="url(#concrete)"
      />
      <rect
        x={sx(-b.deckWidth / 2)}
        y={y - 9}
        width={b.leftShoulder * scale}
        height="9"
        fill="#b6c2b8"
        stroke="#87988b"
      />
      <rect
        x={sx(left + b.carriagewayWidth)}
        y={y - 9}
        width={b.rightShoulder * scale}
        height="9"
        fill="#b6c2b8"
        stroke="#87988b"
      />
      {laneCenters(b).map((c, i) => (
        <g key={i}>
          <text x={sx(c)} y="155" textAnchor="middle" className="svg-small">
            LANE {i + 1} · {fmt(b.carriagewayWidth / b.lanes)} m
          </text>
          {i > 0 && (
            <line
              x1={sx(left + (i * b.carriagewayWidth) / b.lanes)}
              x2={sx(left + (i * b.carriagewayWidth) / b.lanes)}
              y1="75"
              y2="138"
              stroke="#a1aea5"
              strokeDasharray="4 3"
            />
          )}
        </g>
      ))}
      <rect
        x={sx(p.y - v.width / 2)}
        y={y - 33}
        width={v.width * scale}
        height="21"
        rx="3"
        fill="#d8eade"
        stroke="#398265"
      />
      <text
        x={sx(p.y)}
        y={y - 19}
        textAnchor="middle"
        fill="#236345"
        fontSize="9"
      >
        {fmt(v.width, 2)} m
      </text>
      {[-1, 1].map((side) => (
        <rect
          key={side}
          x={
            sx(
              p.y +
                (side *
                  (v.type === "tracked"
                    ? v.trackSpacing!
                    : v.axles[0].wheelSpacing)) /
                  2,
            ) -
            (v.type === "tracked" ? v.trackWidth! * scale : 9) / 2
          }
          y={y - 13}
          width={v.type === "tracked" ? v.trackWidth! * scale : 9}
          height="13"
          rx="2"
          fill="#315b45"
        />
      ))}
      <line
        x1={sx(p.y)}
        x2={sx(p.y)}
        y1={y - 41}
        y2={y + 28}
        stroke="#398265"
        strokeDasharray="3 3"
      />
      <text x="40" y="90" className="svg-small">
        TRANSVERSE OFFSET
      </text>
      <text x="40" y="109" fontSize="14" fontWeight="600" fill="#335e4b">
        Y = {fmt(p.y)} m
      </text>
      <text x="825" y="114" className="svg-small">
        Z = 0.000
      </text>
    </svg>
  );
}
