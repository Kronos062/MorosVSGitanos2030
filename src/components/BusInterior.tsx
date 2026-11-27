import type { CSSProperties } from 'react';

export type BusPoint = { x: number; depth: number };
const rows = [0.30, 0.52, 0.74];

function project({ x, depth }: BusPoint) {
  return { x: 500 + x * (132 + depth * 348), y: 304 + depth * 242 };
}

export function busPlacement(point: BusPoint): CSSProperties {
  const screen = project(point);
  return {
    left: `${screen.x / 10}%`,
    top: `${screen.y / 5.6}%`,
    zIndex: Math.round(point.depth * 100) + 3,
    '--depth-scale': 0.72 + point.depth * 0.5,
  } as CSSProperties;
}

export function busWalkable({ x, depth }: BusPoint) {
  return Math.abs(x) <= .93 && depth >= .12 && depth <= .96 &&
    (Math.abs(x) <= .38 || rows.every(row => Math.abs(depth - row) > .064));
}

function floorPoint(x: number, depth: number, lift = 0) {
  const point = project({ x, depth });
  return `${point.x},${point.y - lift}`;
}

export function BusInterior() {
  return (
    <>
      <svg className="bus-architecture" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="bus-roof" x2="0" y2="1">
            <stop stopColor="#c6d4cf" /><stop offset="1" stopColor="#879f9c" />
          </linearGradient>
          <linearGradient id="bus-aisle" x2="0" y2="1">
            <stop stopColor="#5c7775" /><stop offset="1" stopColor="#333e56" />
          </linearGradient>
          <linearGradient id="bus-glass" x2="0" y2="1">
            <stop stopColor="#80b4bc" /><stop offset=".62" stopColor="#e0ece0" /><stop offset="1" stopColor="#acc3aa" />
          </linearGradient>
          <pattern id="bus-grip" width="16" height="13" patternUnits="userSpaceOnUse">
            <path d="M2 3h2m7 7h2" stroke="#d9dbbf" opacity=".23" />
          </pattern>
          <clipPath id="bus-windscreen"><rect x="382" y="130" width="236" height="112" rx="17" /></clipPath>
        </defs>
        <path fill="#dad5bb" d="M0 0H1000V560H0Z" />
        <path fill="url(#bus-roof)" d="M0 0H1000L632 104H368Z" />
        <path fill="#ebebdb" d="M0 0H145L403 106H368L0 76ZM1000 0H855L597 106H632L1000 76Z" />
        <path d="M42 42 379 113M958 42 621 113" stroke="#fff2ce" strokeWidth="9" />
        <path d="M247 20H753M313 54H687M353 80H647" stroke="#819997" strokeWidth="3" opacity=".7" />
        <path fill="#acb7a2" d="M0 76 368 104V304L0 546ZM1000 76 632 104V304L1000 546Z" />
        <path fill="#657f79" d="M0 377 368 258V304L0 546ZM1000 377 632 258V304L1000 546Z" />
        <g fill="url(#bus-glass)" stroke="#37575b" strokeWidth="6" strokeLinejoin="round">
          <path d="M12 108 116 123V345L12 399ZM134 126 224 137V301L134 339ZM240 140 310 148V269L240 294ZM324 150 360 155V248L324 263Z" />
          <path d="M988 108 884 123V345L988 399ZM866 126 776 137V301L866 339ZM760 140 690 148V255L760 286Z" />
        </g>
        <g stroke="#eefbf4" opacity=".48" strokeWidth="9">
          <path d="M27 125 102 214M148 139 211 206M253 150 299 198M973 127 897 216M852 140 790 205M746 151 702 197" />
        </g>
        <path fill="url(#bus-aisle)" d="M368 304H632L1000 548V560H0V548Z" />
        <path fill="url(#bus-grip)" d="M368 304H632L1000 548V560H0V548Z" />
        <path d="M449 304 331 560M551 304 669 560M312 341H688M222 401H778M98 482H902" stroke="#a5b2a3" strokeWidth="2" opacity=".38" />
        <rect x="368" y="104" width="264" height="202" rx="12" fill="#526e6f" stroke="#29454a" strokeWidth="5" />
        <g clipPath="url(#bus-windscreen)">
          <path fill="url(#bus-glass)" d="M378 124H622V245H378Z" />
          <path fill="#7b9a88" d="M368 218 420 170 452 196 486 181 520 206 563 168 633 215V250H368Z" />
          <path fill="#496765" d="M374 220 470 205 529 207 628 222V250H374Z" />
          <path fill="#384e59" d="M495 205H505L590 250H410Z" />
          <path className="bus-road-mark" d="M500 210v5m0 7v8m0 9v11" stroke="#f5dda5" strokeWidth="2.5" />
        </g>
        <rect x="382" y="130" width="236" height="112" rx="17" fill="none" stroke="#293f45" strokeWidth="6" />
        <path fill="#263a43" d="M375 248 422 230H570L623 248V275H375Z" />
        <path stroke="#88b8a8" strokeWidth="4" d="M474 247h16m6 0h8m6 0h6" />
        <circle cx="420" cy="245" r="18" fill="none" stroke="#15282e" strokeWidth="6" />
        <path d="M425 247 420 260M406 244l14 5 14-5" stroke="#172931" strokeWidth="4" />
        <path d="M636 152 673 142V271L636 297Z" fill="#28464b" stroke="#21383e" strokeWidth="6" />
        <path d="M643 161 665 155V213L643 225Z" fill="#a9cbd0" />
        <path d="M653 152v133" stroke="#588383" strokeWidth="3" />
        <path d="M641 235h21" stroke="#f1ca77" strokeWidth="4" />
      </svg>
      {rows.map((depth) => (
        <svg key={depth} className="bus-seat-row" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true"
          style={{ zIndex: Math.round(depth * 100) + 3 }}>
          {[-1, 1].map(side => {
            const edge = side * .95;
            const aisle = side * .44;
            const height = 38 + depth * 83;
            return (
              <g key={side} strokeLinejoin="round">
                <polygon points={[floorPoint(edge, depth + .045), floorPoint(aisle, depth + .045), floorPoint(aisle, depth -.052), floorPoint(edge, depth -.052)].join(' ')}
                  fill="#17282d" opacity=".45" />
                <polygon points={[floorPoint(edge, depth - .058, 24), floorPoint(aisle, depth - .058, 24), floorPoint(aisle, depth, 24), floorPoint(edge, depth, 24)].join(' ')}
                  fill="#286881" stroke="#274956" strokeWidth="3" />
                <polygon points={[floorPoint(edge, depth, 8), floorPoint(aisle, depth, 8), floorPoint(aisle, depth, height), floorPoint(edge, depth, height + 10)].join(' ')}
                  fill="#17455d" stroke="#20363f" strokeWidth="6" />
                <polygon points={[floorPoint(side * .91, depth, 16), floorPoint(side * .48, depth, 16), floorPoint(side * .48, depth, height - 8), floorPoint(side * .91, depth, height)].join(' ')}
                  fill="#2c7186" stroke="#4a92a0" strokeWidth="2" />
                <path d={`M${floorPoint(side * .71, depth, 18)}L${floorPoint(side * .71, depth, height - 4)}`} stroke="#22576b" strokeWidth="3" />
                <path d={`M${floorPoint(aisle, depth, height - 8)}L${floorPoint(aisle, depth, 1)}`} stroke="#d7a754" strokeWidth="5" />
                {depth !== .52 && (
                  <g strokeLinecap="round">
                    <path d={`M${floorPoint(aisle, depth, 0)}L${floorPoint(aisle, depth, 195 + depth * 267)}`}
                      stroke="#695339" strokeWidth="11" />
                    <path d={`M${floorPoint(aisle, depth, 3)}L${floorPoint(aisle, depth, 192 + depth * 267)}`}
                      stroke="#efc477" strokeWidth="6" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      ))}
    </>
  );
}
