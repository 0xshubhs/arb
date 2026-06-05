"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";
import { SCORE_THRESHOLD } from "@/lib/contracts";

/**
 * 0–100 risk gauge — a 270° arc that fills green → caution → red as the
 * composite score climbs, with the numeric score in tabular monospace.
 * Crosses the block threshold (80) into the red zone.
 */
export function RiskGauge({
  score,
  size = 132,
  label = "RISK",
  frozen = false,
}: {
  score: number;
  size?: number;
  label?: string;
  frozen?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const mv = useMotionValue(clamped);

  useEffect(() => {
    const controls = animate(mv, clamped, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [clamped, mv]);

  // Geometry: 270° sweep starting at 135deg (bottom-left), open at the bottom.
  const stroke = 9;
  const r = (size - stroke * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.75; // 270°
  const arcLen = circumference * arcFraction;

  const dashOffset = useTransform(mv, [0, 100], [arcLen, 0]);
  const displayScore = useTransform(mv, (v) => Math.round(v));

  const color =
    clamped >= SCORE_THRESHOLD
      ? "#FF3B3B"
      : clamped >= 55
        ? "#FFB020"
        : "#00E58A";

  const glow =
    clamped >= SCORE_THRESHOLD
      ? "drop-shadow(0 0 8px rgba(255,59,59,0.65))"
      : clamped >= 55
        ? "drop-shadow(0 0 6px rgba(255,176,32,0.45))"
        : "drop-shadow(0 0 6px rgba(0,229,138,0.5))";

  // threshold tick position along the arc (80/100)
  const thresholdAngle = 135 + (SCORE_THRESHOLD / 100) * 270;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(135deg)", filter: frozen ? "none" : glow }}
      >
        {/* track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#171D28"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
        />
        {/* fill */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={frozen ? "#3a3f49" : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${circumference}`}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>

      {/* threshold marker */}
      <div
        className="absolute"
        style={{
          width: size,
          height: size,
          transform: `rotate(${thresholdAngle}deg)`,
        }}
      >
        <span
          className="absolute left-1/2 top-1 block h-2 w-[2px] -translate-x-1/2 bg-alert/70"
          title={`Block threshold ${SCORE_THRESHOLD}`}
        />
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="stat text-3xl font-semibold leading-none"
          style={{ color: frozen ? "#6b7280" : color }}
        >
          {displayScore}
        </motion.span>
        <span className="label mt-1">{label}</span>
      </div>
    </div>
  );
}
