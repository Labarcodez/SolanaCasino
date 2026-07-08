const CHIP_R = 10;
const CHIP_TICK_INNER = 8.2;
const CHIP_TICK_OUTER = 10;
const TICK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

function chipTicks(stroke: string) {
  return TICK_ANGLES.map((angle) => (
    <g key={angle} transform={`rotate(${angle})`}>
      <line
        x1="0"
        y1={-CHIP_TICK_INNER}
        x2="0"
        y2={-CHIP_TICK_OUTER}
        stroke={stroke}
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.9"
      />
    </g>
  ));
}

interface OrbitHubProps {
  chipGradId: string;
  cx?: number;
  cy?: number;
  className?: string;
}

export function OrbitHub({ chipGradId, cx = 32, cy = 32, className = "logo-orbit-hub" }: OrbitHubProps) {
  return (
    <g className={className} transform={`translate(${cx} ${cy})`}>
      <circle r={CHIP_R} fill={`url(#${chipGradId})`} stroke="#03E1FF" strokeWidth="0.9" />
      <circle r="6.8" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="0.75" />
      <g>{chipTicks("#14F195")}</g>
      <text
        y="0.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--text-primary)"
        fontSize="9"
        fontWeight="800"
        fontFamily="var(--font-sans)"
      >
        O
      </text>
    </g>
  );
}
