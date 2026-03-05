import React, { useMemo } from 'react';

// ─── 8 Directions ───────────────────────────────────────────────────────────
export type RiskDirection =
    | 'right' | 'downRight' | 'down' | 'downLeft'
    | 'left' | 'upLeft' | 'up' | 'upRight';

export interface Risk {
    direction: RiskDirection;
    sizeCm: number;
    slopeData?: { side: 'D' | 'E', h1: number, h2: number };
    slope_data?: { side: 'D' | 'E', h1: number, h2: number };
    angle?: number | null;
    executionIdx?: string | number;
}

// Angle change relative to current heading (degrees)
const DIRECTION_ANGLES: Record<RiskDirection, number> = {
    right: 0,
    downRight: 45,
    down: 90,
    downLeft: 135,
    left: 180,
    upLeft: 225,   // -135
    up: 270,   // -90
    upRight: 315,   // -45
};

export const DIRECTION_LABELS: Record<RiskDirection, string> = {
    right: '→ Direita',
    downRight: '↘ Baixo-Dir',
    down: '↓ Baixo',
    downLeft: '↙ Baixo-Esq',
    left: '← Esquerda',
    upLeft: '↖ Cima-Esq',
    up: '↑ Cima',
    upRight: '↗ Cima-Dir',
};

export const DIRECTION_ICONS: Record<RiskDirection, string> = {
    right: '→',
    downRight: '↘',
    down: '↓',
    downLeft: '↙',
    left: '←',
    upLeft: '↖',
    up: '↑',
    upRight: '↗',
};

// Opposite direction map (for anti-reversal check)
export const OPPOSITE_DIRECTION: Record<RiskDirection, RiskDirection> = {
    right: 'left',
    left: 'right',
    up: 'down',
    down: 'up',
    upRight: 'downLeft',
    downLeft: 'upRight',
    upLeft: 'downRight',
    downRight: 'upLeft',
};

interface Point { x: number; y: number; }

// Compute path in "gutter units" (1 unit = 1 cm)
function computePath(risks: Risk[]): Point[] {
    const points: Point[] = [{ x: 0, y: 0 }];
    let currentAngle = 0; // 0 = rightward

    for (const risk of risks) {
        const prev = points[points.length - 1];
        // Use absolute angle from direction
        const targetAngle = DIRECTION_ANGLES[risk.direction];
        currentAngle = targetAngle;
        const radians = (currentAngle * Math.PI) / 180;
        points.push({
            x: prev.x + Math.cos(radians) * risk.sizeCm,
            y: prev.y + Math.sin(radians) * risk.sizeCm,
        });
    }
    return points;
}

interface BendCanvasProps {
    risks: Risk[];
    maxWidthCm?: number;
    svgRef?: React.RefObject<SVGSVGElement>;
    /** When true, hides edit markers (circles, start label, grid, info bar) for clean export */
    exportMode?: boolean;
}

export default function BendCanvas({ risks, maxWidthCm = 120, svgRef, exportMode = false }: BendCanvasProps) {
    const points = useMemo(() => computePath(risks), [risks]);
    const totalWidthCm = risks.reduce((sum, r) => sum + r.sizeCm, 0);
    const isOverLimit = totalWidthCm > maxWidthCm;

    // ── Dynamic scaling ──────────────────────────────────────────────────────
    const CANVAS_W = 640;
    const CANVAS_H = 320;
    const PADDING = 50;

    // Find min/max in gutter units
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const rawMinX = Math.min(...xs);
    const rawMaxX = Math.max(...xs);
    const rawMinY = Math.min(...ys);
    const rawMaxY = Math.max(...ys);

    const rawW = Math.max(rawMaxX - rawMinX, 1);
    const rawH = Math.max(rawMaxY - rawMinY, 1);

    // Scale to fill the canvas
    const scaleX = (CANVAS_W - PADDING * 2) / rawW;
    const scaleY = (CANVAS_H - PADDING * 2) / rawH;
    const scale = Math.min(scaleX, scaleY, 18); // Increased cap for bigger lines

    const toSvg = (p: Point) => ({
        x: PADDING + (p.x - rawMinX) * scale,
        y: PADDING + (p.y - rawMinY) * scale,
    });

    const scaled = points.map(toSvg);

    const pathStr = scaled.length > 1
        ? scaled.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        : '';

    // In export mode, always use blue (not red) for a clean look
    const strokeColor = exportMode ? '#63b3ed' : (isOverLimit ? '#ef4444' : '#63b3ed');
    const glowFilter = exportMode ? 'none' : (isOverLimit ? 'drop-shadow(0 0 6px #ef4444)' : 'drop-shadow(0 0 8px #63b3ed88)');

    return (
        <div className="relative w-full">
            <div className={`rounded-3xl border-2 overflow-hidden transition-all duration-300 bg-gradient-to-br from-slate-900 to-slate-800 ${exportMode ? 'border-slate-700' : (isOverLimit ? 'border-red-500' : 'border-slate-700')}`}>
                <svg
                    ref={svgRef}
                    width="100%"
                    viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                    className="w-full"
                    style={{ minHeight: 220, maxHeight: 380 }}
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* Subtle grid */}
                    {!exportMode && Array.from({ length: 32 }).map((_, i) => (
                        <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={CANVAS_H}
                            stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    ))}
                    {!exportMode && Array.from({ length: 16 }).map((_, i) => (
                        <line key={`h${i}`} x1={0} y1={i * 20} x2={CANVAS_W} y2={i * 20}
                            stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                    ))}

                    {/* Sheet shadow */}
                    {pathStr && (
                        <path d={pathStr} fill="none"
                            stroke={exportMode ? 'rgba(99,179,237,0.12)' : (isOverLimit ? 'rgba(239,68,68,0.15)' : 'rgba(99,179,237,0.15)')}
                            strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
                    )}

                    {/* Main path */}
                    {pathStr && (
                        <path d={pathStr} fill="none"
                            stroke={strokeColor} strokeWidth={4}
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ filter: glowFilter }} />
                    )}

                    {/* Points + dimension labels */}
                    {scaled.map((pt, i) => (
                        <g key={i}>
                            {i > 0 && risks[i - 1] && (() => {
                                const prev = scaled[i - 1];
                                const dx = pt.x - prev.x;
                                const dy = pt.y - prev.y;
                                const len = Math.sqrt(dx * dx + dy * dy) || 1;

                                // Normalized vectors
                                const ux = dx / len;
                                const uy = dy / len;
                                const px = -uy; // Perpendicular X
                                const py = ux;  // Perpendicular Y

                                const mx = (prev.x + pt.x) / 2;
                                const my = (prev.y + pt.y) / 2;

                                const offsetDist = 14; // Distance from risk line

                                const formatCm = (num: number) => {
                                    if (!num) return '0';
                                    const rounded = Math.round(num * 2) / 2;
                                    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
                                };

                                return (
                                    <g key={i}>
                                        {/* Per-Risk Lateral Slope visual indicators */}
                                        {risks[i - 1].slopeData && (
                                            <>
                                                {/* Diagonal cut line - 3x Larger for better visibility */}
                                                <line x1={mx - (ux - px) * 22.5} y1={my - (uy - py) * 22.5}
                                                    x2={mx + (ux - px) * 22.5} y2={my + (uy - py) * 22.5}
                                                    stroke="#ef4444" strokeWidth="4" strokeLinecap="round" />

                                                {/* D or E side indicator */}
                                                <text x={mx + px * 18} y={my + py * 18} textAnchor="middle" dominantBaseline="middle"
                                                    fill="#fbbf24" fontSize="13" fontWeight="900"
                                                    style={{ paintOrder: 'stroke', stroke: '#1e293b', strokeWidth: 2.5 }}>
                                                    {risks[i - 1].slopeData!.side}
                                                </text>

                                                {/* H1 and H2 - positioned at CORNERS (15% and 85%) */}
                                                <text x={prev.x + ux * (len * 0.15) + px * (offsetDist + 4)}
                                                    y={prev.y + uy * (len * 0.15) + py * (offsetDist + 4)}
                                                    textAnchor="middle" dominantBaseline="middle"
                                                    fill="#fbbf24" fontSize="11" fontStyle="italic" fontWeight="black"
                                                    style={{ paintOrder: 'stroke', stroke: '#1e293b', strokeWidth: 2.5 }}>
                                                    {formatCm(risks[i - 1].slopeData!.h1)}
                                                </text>
                                                <text x={prev.x + ux * (len * 0.85) + px * (offsetDist + 4)}
                                                    y={prev.y + uy * (len * 0.85) + py * (offsetDist + 4)}
                                                    textAnchor="middle" dominantBaseline="middle"
                                                    fill="#fbbf24" fontSize="11" fontStyle="italic" fontWeight="black"
                                                    style={{ paintOrder: 'stroke', stroke: '#1e293b', strokeWidth: 2.5 }}>
                                                    {formatCm(risks[i - 1].slopeData!.h2)}
                                                </text>
                                            </>
                                        )}

                                        {!risks[i - 1].slopeData && (() => {
                                            // Improved overlap prevention: alternate label side and increase distance
                                            const sideMultiplier = (i % 2 === 0) ? 1.5 : -1.5;
                                            const finalOffset = 11 * sideMultiplier;
                                            return (
                                                <text x={mx + px * finalOffset} y={my + py * finalOffset}
                                                    textAnchor="middle" dominantBaseline="middle"
                                                    fill="rgba(255,255,255,1)" fontSize={exportMode ? "15" : "14"} fontWeight="900"
                                                    style={{ paintOrder: 'stroke', stroke: '#111', strokeWidth: 4.5 }}>
                                                    {risks[i - 1].executionIdx !== undefined && `(${risks[i - 1].executionIdx}) `}
                                                    {formatCm(risks[i - 1].sizeCm)}
                                                </text>
                                            );
                                        })()}

                                        {/* Angle Indicator */}
                                        {risks[i - 1].angle != null && (() => {
                                            const angleDeg = risks[i - 1].angle!;
                                            const aRad = (angleDeg * Math.PI) / 180;

                                            // Adjusted position based on slope existence
                                            const hasSlope = !!risks[i - 1].slopeData;
                                            const posRatio = hasSlope ? 0.66 : 0.85;

                                            const originX = prev.x + dx * posRatio;
                                            const originY = prev.y + dy * posRatio;

                                            const endX = originX + Math.cos(aRad) * 35;
                                            const endY = originY + Math.sin(aRad) * 35;

                                            const segRad = Math.atan2(dy, dx);
                                            const backRad = segRad + Math.PI;
                                            const rArc = 14;
                                            const arcX1 = originX + Math.cos(backRad) * rArc;
                                            const arcY1 = originY + Math.sin(backRad) * rArc;
                                            const arcX2 = originX + Math.cos(aRad) * rArc;
                                            const arcY2 = originY + Math.sin(aRad) * rArc;

                                            let diff = aRad - backRad;
                                            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
                                            const sweep = diff > 0 ? 1 : 0;
                                            const arcCurve = `M ${arcX1} ${arcY1} A ${rArc} ${rArc} 0 0 ${sweep} ${arcX2} ${arcY2}`;

                                            return (
                                                <g>
                                                    <line x1={originX} y1={originY} x2={endX} y2={endY}
                                                        stroke="#fef08a" strokeWidth="2.5" strokeDasharray="5,4" strokeLinecap="round" />
                                                    <circle cx={originX} cy={originY} r="3" fill="#22c55e" />
                                                    <path d={arcCurve} fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
                                                    <text x={endX + (Math.cos(aRad) * 12)} y={endY + (Math.sin(aRad) * 12)}
                                                        textAnchor="middle" dominantBaseline="middle"
                                                        fill="#fef08a" fontSize="13" fontWeight="bold"
                                                        style={{ paintOrder: 'stroke', stroke: '#1e293b', strokeWidth: 3 }}>
                                                        {angleDeg}°
                                                    </text>
                                                </g>
                                            );
                                        })()}
                                    </g>
                                );
                            })()}
                        </g>
                    ))}

                    {/* Start label — HIDDEN in export mode */}
                    {!exportMode && scaled.length > 0 && (
                        <text x={scaled[0].x} y={scaled[0].y - 14} textAnchor="middle"
                            fill="#48bb78" fontSize="9" fontWeight="bold">INÍCIO</text>
                    )}

                    {/* Real Sum Circle — Facilitate execution (Moved fuera del dibujo) */}
                    {totalWidthCm > 0 && (
                        <g transform={`translate(${CANVAS_W - 40}, ${CANVAS_H - 40})`}>
                            <circle r="22" fill="#1e293b" stroke={strokeColor} strokeWidth="3" opacity="0.9" />
                            <text textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="14" fontWeight="black">
                                {totalWidthCm}
                            </text>
                        </g>
                    )}

                    {/* Empty state */}
                    {risks.length === 0 && (
                        <text x={CANVAS_W / 2} y={CANVAS_H / 2} textAnchor="middle"
                            fill="rgba(255,255,255,0.2)" fontSize="13">
                            Adicione riscos para visualizar a dobra
                        </text>
                    )}
                </svg>

                {/* Bottom info bar — HIDDEN in export mode */}
                {!exportMode && (
                    <div className="absolute bottom-2 left-3 right-3 flex justify-between items-center pointer-events-none">
                        <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${isOverLimit ? 'bg-red-500 text-white' : 'bg-white/10 text-white/70'}`}>
                            {totalWidthCm.toFixed(1)} / {maxWidthCm} cm
                        </div>
                        {isOverLimit && (
                            <div className="text-red-400 text-xs font-bold animate-pulse">⚠ Excede chapa!</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
