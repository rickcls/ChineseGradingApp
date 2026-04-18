type AbilityAxis = {
  label: string;
  value: number;
  max: number;
  hint?: string;
};

export function AbilityRadar({ axes }: { axes: AbilityAxis[] }) {
  const size = 320;
  const center = size / 2;
  const radius = 108;
  const rings = [0.25, 0.5, 0.75, 1];

  const axisPoints = axes.map((axis, index) => {
    const angle = (-Math.PI / 2) + (index * Math.PI * 2) / axes.length;
    const normalized = clamp(axis.value / axis.max, 0.12, 1);
    return {
      ...axis,
      angle,
      x: center + Math.cos(angle) * radius * normalized,
      y: center + Math.sin(angle) * radius * normalized,
      outerX: center + Math.cos(angle) * (radius + 26),
      outerY: center + Math.sin(angle) * (radius + 26),
      pct: Math.round((axis.value / axis.max) * 100),
    };
  });

  const polygon = axisPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="paper-panel-strong overflow-hidden p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
        <div className="mx-auto w-full max-w-[22rem]">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full">
            <defs>
              <linearGradient id="radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B5BA5" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#6BA368" stopOpacity="0.18" />
              </linearGradient>
            </defs>

            {rings.map((ring) => {
              const points = axisPoints
                .map((point) => {
                  const ringX = center + Math.cos(point.angle) * radius * ring;
                  const ringY = center + Math.sin(point.angle) * radius * ring;
                  return `${ringX},${ringY}`;
                })
                .join(" ");
              return (
                <polygon
                  key={ring}
                  points={points}
                  fill={ring === 1 ? "rgba(255,255,255,0.68)" : "none"}
                  stroke="rgba(59, 91, 165, 0.14)"
                  strokeWidth="1.2"
                />
              );
            })}

            {axisPoints.map((point) => (
              <line
                key={point.label}
                x1={center}
                y1={center}
                x2={center + Math.cos(point.angle) * radius}
                y2={center + Math.sin(point.angle) * radius}
                stroke="rgba(59, 91, 165, 0.14)"
                strokeWidth="1.2"
              />
            ))}

            <polygon
              points={polygon}
              fill="url(#radar-fill)"
              stroke="rgba(59, 91, 165, 0.82)"
              strokeWidth="2.2"
            />

            {axisPoints.map((point) => (
              <g key={`${point.label}-marker`}>
                <circle cx={point.x} cy={point.y} r="5" fill="#3B5BA5" />
                <circle cx={point.x} cy={point.y} r="9" fill="rgba(59, 91, 165, 0.12)" />
              </g>
            ))}

            {axisPoints.map((point) => (
              <g key={`${point.label}-label`}>
                <text
                  x={point.outerX}
                  y={point.outerY}
                  textAnchor={labelAnchor(point.outerX, center)}
                  dominantBaseline="middle"
                  fontSize="13"
                  fill="#24324A"
                  fontFamily="Inter, Noto Sans SC, sans-serif"
                >
                  {point.label}
                </text>
                <text
                  x={point.outerX}
                  y={point.outerY + 17}
                  textAnchor={labelAnchor(point.outerX, center)}
                  dominantBaseline="middle"
                  fontSize="11"
                  fill="#667085"
                  fontFamily="Inter, Noto Sans SC, sans-serif"
                >
                  {point.pct}%
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="space-y-3">
          <div>
            <p className="section-kicker">最近幾篇的能力輪廓</p>
            <h2 className="mt-2 text-2xl">你的寫作地圖正在慢慢成形</h2>
          </div>
          <ul className="space-y-3">
            {axisPoints.map((axis) => (
              <li key={axis.label} className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-ink">{axis.label}</span>
                  <span className="text-sm text-ink/70">
                    {axis.value.toFixed(1)} / {axis.max}
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-accent/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-good"
                    style={{ width: `${Math.max(16, axis.pct)}%` }}
                  />
                </div>
                {axis.hint ? <p className="mt-2 text-xs leading-6 text-muted">{axis.hint}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function labelAnchor(x: number, center: number) {
  if (Math.abs(x - center) < 12) return "middle";
  return x < center ? "end" : "start";
}
