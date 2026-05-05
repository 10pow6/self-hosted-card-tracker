import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Point, Slot } from '@/api/types';

type Props = {
  imageUrl: string;
  imageSize: [number, number];
  bbox: [number, number, number, number];
  rows: number;
  cols: number;
  slots: Slot[];
  onChange: (slots: Slot[]) => void;
};

type Drag =
  | { kind: 'corner'; slotIdx: number; cornerIdx: 0 | 1 | 2 | 3 }
  | { kind: 'body'; slotIdx: number; startSvg: Point; startPoly: Slot['polygon'] }
  | { kind: 'pan'; startClient: Point; startVB: [number, number, number, number] }
  | null;

type Pinch = {
  startDist: number;
  startCenter: Point;
  startVB: [number, number, number, number];
} | null;

const HANDLE_R = 16;
const STROKE_W = 3;
const REMOVE_R = 16;
const ADD_R = 28;
const ZOOM_STEP = 1.5;
const CARD_ASPECT = 88 / 63;

function clientToSvg(svg: SVGSVGElement, cx: number, cy: number): Point {
  const pt = svg.createSVGPoint();
  pt.x = cx;
  pt.y = cy;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: cx, y: cy };
  const t = pt.matrixTransform(ctm.inverse());
  return { x: t.x, y: t.y };
}

function defaultPolygon(rect: { x: number; y: number; w: number; h: number }): Slot['polygon'] {
  const m = 0.8;
  const maxH = rect.h * m;
  const maxW = rect.w * m;
  let pw: number, ph: number;
  if (maxH / CARD_ASPECT <= maxW) {
    ph = maxH;
    pw = ph / CARD_ASPECT;
  } else {
    pw = maxW;
    ph = pw * CARD_ASPECT;
  }
  const px = rect.x + (rect.w - pw) / 2;
  const py = rect.y + (rect.h - ph) / 2;
  return [
    { x: px, y: py },
    { x: px + pw, y: py },
    { x: px + pw, y: py + ph },
    { x: px, y: py + ph },
  ];
}

export function PolygonEditor({ imageUrl, imageSize, bbox, rows, cols, slots, onChange }: Props) {
  const [w, h] = imageSize;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<Drag>(null);
  const pointersRef = useRef<Map<number, Point>>(new Map());
  const pinchRef = useRef<Pinch>(null);
  const [vb, setVb] = useState<[number, number, number, number]>([0, 0, w, h]);

  const cellRect = (slotIdx: number) => {
    const [bx, by, bw, bh] = bbox;
    const col = slotIdx % cols;
    const row = Math.floor(slotIdx / cols);
    return { x: bx + col * (bw / cols), y: by + row * (bh / rows), w: bw / cols, h: bh / rows };
  };

  const cellCenter = (slotIdx: number): Point => {
    const r = cellRect(slotIdx);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  };

  const trackedPoints = (): Point[] => Array.from(pointersRef.current.values());

  const addPointer = (e: ReactPointerEvent<Element>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      // Second finger arrives: cancel single-pointer drag, start pinch.
      dragRef.current = null;
      const [a, b] = trackedPoints();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      pinchRef.current = {
        startDist: dist,
        startCenter: clientToSvg(svgRef.current!, cx, cy),
        startVB: vb,
      };
    }
  };

  const onSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    addPointer(e);
    // Bubbled here only because the click was on the SVG background or image —
    // box/handle/button handlers all stop propagation. Start a pan drag.
    if (pointersRef.current.size === 1 && svgRef.current) {
      dragRef.current = {
        kind: 'pan',
        startClient: { x: e.clientX, y: e.clientY },
        startVB: vb,
      };
      svgRef.current.setPointerCapture(e.pointerId);
    }
  };

  const constrainVB = (next: [number, number, number, number]): [number, number, number, number] => {
    const minSize = Math.min(w, h) * 0.1;
    const maxSize = Math.max(w, h) * 1.5;
    let [nx, ny, nw, nh] = next;
    if (nw < minSize || nw > maxSize || nh < minSize || nh > maxSize) return vb;
    // Soft-clamp pan so the image isn't dragged completely out of view
    nx = Math.max(-nw * 0.5, Math.min(w - nw * 0.5, nx));
    ny = Math.max(-nh * 0.5, Math.min(h - nh * 0.5, ny));
    return [nx, ny, nw, nh];
  };

  const onSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchRef.current && svgRef.current) {
      const [a, b] = trackedPoints();
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const newCenter = clientToSvg(svgRef.current, cx, cy);
      const scale = pinchRef.current.startDist / dist;
      const [vx, vy, vw, vh] = pinchRef.current.startVB;
      const sc = pinchRef.current.startCenter;
      const newW = vw * scale;
      const newH = vh * scale;
      const newX = sc.x - (sc.x - vx) * scale - (newCenter.x - sc.x);
      const newY = sc.y - (sc.y - vy) * scale - (newCenter.y - sc.y);
      setVb(constrainVB([newX, newY, newW, newH]));
      return;
    }

    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    if (drag.kind === 'pan') {
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = drag.startVB[2] / rect.width;
      const scaleY = drag.startVB[3] / rect.height;
      const dx = (e.clientX - drag.startClient.x) * scaleX;
      const dy = (e.clientY - drag.startClient.y) * scaleY;
      setVb(
        constrainVB([
          drag.startVB[0] - dx,
          drag.startVB[1] - dy,
          drag.startVB[2],
          drag.startVB[3],
        ]),
      );
      return;
    }
    const pt = clientToSvg(svgRef.current, e.clientX, e.clientY);
    if (drag.kind === 'corner') {
      onChange(
        slots.map((s, i) =>
          i !== drag.slotIdx
            ? s
            : {
                ...s,
                polygon: s.polygon.map((p, ci) => (ci === drag.cornerIdx ? pt : p)) as Slot['polygon'],
              },
        ),
      );
    } else if (drag.kind === 'body') {
      const dx = pt.x - drag.startSvg.x;
      const dy = pt.y - drag.startSvg.y;
      onChange(
        slots.map((s, i) =>
          i !== drag.slotIdx
            ? s
            : {
                ...s,
                polygon: drag.startPoly.map((p) => ({ x: p.x + dx, y: p.y + dy })) as Slot['polygon'],
              },
        ),
      );
    }
  };

  const onSvgPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) dragRef.current = null;
  };

  const startCornerDrag =
    (slotIdx: number, cornerIdx: 0 | 1 | 2 | 3) =>
    (e: ReactPointerEvent<SVGCircleElement>) => {
      addPointer(e);
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      if (pointersRef.current.size === 1) {
        dragRef.current = { kind: 'corner', slotIdx, cornerIdx };
      }
    };

  const startBodyDrag =
    (slotIdx: number) =>
    (e: ReactPointerEvent<SVGPolygonElement>) => {
      addPointer(e);
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      if (pointersRef.current.size === 1 && svgRef.current) {
        dragRef.current = {
          kind: 'body',
          slotIdx,
          startSvg: clientToSvg(svgRef.current, e.clientX, e.clientY),
          startPoly: slots[slotIdx].polygon.map((p) => ({ ...p })) as Slot['polygon'],
        };
      }
    };

  const removeSlot = (slotIdx: number) => (e: ReactPointerEvent<SVGGElement>) => {
    e.stopPropagation();
    onChange(slots.map((s, i) => (i === slotIdx ? { ...s, disabled: true } : s)));
  };

  const restoreSlot = (slotIdx: number) => (e: ReactPointerEvent<SVGGElement>) => {
    e.stopPropagation();
    onChange(
      slots.map((s, i) =>
        i === slotIdx
          ? { ...s, disabled: false, refined: false, polygon: defaultPolygon(cellRect(slotIdx)) }
          : s,
      ),
    );
  };

  const zoomBy = (factor: number) => {
    const [vx, vy, vw, vh] = vb;
    const cx = vx + vw / 2;
    const cy = vy + vh / 2;
    const newW = vw / factor;
    const newH = vh / factor;
    setVb(constrainVB([cx - newW / 2, cy - newH / 2, newW, newH]));
  };

  const resetZoom = () => setVb([0, 0, w, h]);

  // Scale stroke and handle sizes inversely with zoom so they stay readable on screen
  const zoomFactor = w / vb[2];
  const stroke = STROKE_W / zoomFactor;
  const handleR = HANDLE_R / zoomFactor;
  const removeR = REMOVE_R / zoomFactor;
  const addR = ADD_R / zoomFactor;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <svg
        ref={svgRef}
        viewBox={vb.join(' ')}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerCancel={onSvgPointerUp}
        className="block w-full max-h-[75vh] select-none touch-none"
      >
        <image href={imageUrl} width={w} height={h} />
        {slots.map((s, slotIdx) => {
          if (s.disabled) {
            const c = cellCenter(s.slot_index);
            return (
              <g
                key={s.slot_index}
                onPointerDown={restoreSlot(slotIdx)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={addR}
                  fill="rgba(34, 197, 94, 0.85)"
                  stroke="white"
                  strokeWidth={stroke}
                />
                <text
                  x={c.x}
                  y={c.y + addR * 0.35}
                  textAnchor="middle"
                  fontSize={addR * 1.2}
                  fill="white"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  +
                </text>
              </g>
            );
          }
          const strokeColor = s.refined ? 'var(--card-refined)' : 'var(--card-needs-review)';
          // Place × button slightly INWARD from corner 1 (top-right), toward centroid
          const tr = s.polygon[1];
          const cxAvg = (s.polygon[0].x + s.polygon[1].x + s.polygon[2].x + s.polygon[3].x) / 4;
          const cyAvg = (s.polygon[0].y + s.polygon[1].y + s.polygon[2].y + s.polygon[3].y) / 4;
          const dxIn = cxAvg - tr.x;
          const dyIn = cyAvg - tr.y;
          const len = Math.hypot(dxIn, dyIn) || 1;
          const offset = handleR * 1.6;
          const removeX = tr.x + (dxIn / len) * offset;
          const removeY = tr.y + (dyIn / len) * offset;
          return (
            <g key={s.slot_index}>
              <polygon
                points={s.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(255,255,255,0.04)"
                stroke={strokeColor}
                strokeWidth={stroke}
                onPointerDown={startBodyDrag(slotIdx)}
                style={{ cursor: 'move' }}
              />
              {s.polygon.map((corner, ci) => (
                <circle
                  key={ci}
                  cx={corner.x}
                  cy={corner.y}
                  r={handleR}
                  fill="white"
                  stroke="black"
                  strokeWidth={stroke / 2}
                  onPointerDown={startCornerDrag(slotIdx, ci as 0 | 1 | 2 | 3)}
                  style={{ cursor: 'grab' }}
                />
              ))}
              <g onPointerDown={removeSlot(slotIdx)} style={{ cursor: 'pointer' }}>
                <circle
                  cx={removeX}
                  cy={removeY}
                  r={removeR}
                  fill="#ef4444"
                  stroke="white"
                  strokeWidth={stroke / 2}
                />
                <text
                  x={removeX}
                  y={removeY + removeR * 0.35}
                  textAnchor="middle"
                  fontSize={removeR * 1.4}
                  fill="white"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none' }}
                >
                  ×
                </text>
              </g>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => zoomBy(ZOOM_STEP)}
          className="size-11 rounded-md bg-card/90 backdrop-blur border border-border text-foreground text-lg font-bold hover:bg-muted"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          className="size-11 rounded-md bg-card/90 backdrop-blur border border-border text-foreground text-lg font-bold hover:bg-muted"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          onClick={resetZoom}
          className="size-11 rounded-md bg-card/90 backdrop-blur border border-border text-foreground text-xs hover:bg-muted"
          aria-label="Reset zoom"
        >
          fit
        </button>
      </div>
    </div>
  );
}
