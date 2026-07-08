export const HUB_R = 15;
export const O_RING_R = 5.5;
export const O_RING_STROKE = 2.6;
export const O_INNER_R = O_RING_R - O_RING_STROKE / 2;

interface OrbitHubProps {
  hubGradId: string;
  hubBlendGradId: string;
  hubBlendOpacity?: number;
  cx?: number;
  cy?: number;
  className?: string;
}

function HubFill({
  hubGradId,
  hubBlendGradId,
  hubBlendOpacity,
  r,
}: {
  hubGradId: string;
  hubBlendGradId: string;
  hubBlendOpacity: number;
  r: number;
}) {
  return (
    <>
      <circle r={r} fill={`url(#${hubGradId})`} />
      <circle r={r} fill={`url(#${hubBlendGradId})`} opacity={hubBlendOpacity} />
    </>
  );
}

export function OrbitHub({
  hubGradId,
  hubBlendGradId,
  hubBlendOpacity = 0.52,
  cx = 32,
  cy = 32,
  className = "logo-orbit-hub",
}: OrbitHubProps) {
  return (
    <g className={className} transform={`translate(${cx} ${cy})`}>
      <HubFill
        hubGradId={hubGradId}
        hubBlendGradId={hubBlendGradId}
        hubBlendOpacity={hubBlendOpacity}
        r={HUB_R}
      />
      <HubFill
        hubGradId={hubGradId}
        hubBlendGradId={hubBlendGradId}
        hubBlendOpacity={hubBlendOpacity}
        r={O_INNER_R}
      />
      <circle r={O_RING_R} fill="none" stroke="#ffffff" strokeWidth={O_RING_STROKE} />
    </g>
  );
}
