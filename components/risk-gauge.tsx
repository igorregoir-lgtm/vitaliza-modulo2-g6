import { TIER_COLOR_VAR, TIER_LABELS } from "@/lib/labels";
import type { RiskTier } from "@/lib/types";

/** Semicircular risk gauge for a single churn probability. */
export function RiskGauge({
  probability,
  tier,
  threshold,
}: {
  probability: number;
  tier: RiskTier;
  threshold: number;
}) {
  const radius = 70;
  const cx = 90;
  const cy = 90;
  const circumference = Math.PI * radius; // half circle
  const filled = circumference * probability;
  const color = TIER_COLOR_VAR[tier];
  const thresholdAngle = Math.PI * threshold;
  const tx = cx - radius * Math.cos(thresholdAngle);
  const ty = cy - radius * Math.sin(thresholdAngle);

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 180 104"
        role="img"
        aria-label={`Risco ${TIER_LABELS[tier]}`}
        className="h-auto w-full max-w-[180px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* track */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="var(--cloud)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* value */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
        {/* threshold tick */}
        <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="var(--ink-soft)" strokeWidth="1.5" strokeDasharray="3 2" />
        <circle cx={tx} cy={ty} r="2.5" fill="var(--ink-soft)" />
      </svg>
      <div className="-mt-6 flex flex-col items-center">
        <span className="mono text-3xl font-semibold" style={{ color }}>
          {(probability * 100).toFixed(1)}%
        </span>
        <span className="eyebrow mt-0.5">prob. de churn</span>
      </div>
      <p className="mt-1 text-xs text-[var(--steel)]">
        Limiar de decisão: {(threshold * 100).toFixed(0)}%
      </p>
    </div>
  );
}
