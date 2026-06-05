"use client";

import { cx } from "@/lib/format";

interface Props {
  label: string;
  /** Short description of what this guardrail enforces. */
  hint: string;
  /** The on-chain field name this maps to, shown in mono. */
  field: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Render the current value, e.g. `(v) => "2.5%"` or `(v) => "$1,000"`. */
  format: (value: number) => string;
  onChange: (value: number) => void;
}

/**
 * A large, premium guardrail slider. The fill is the institutional green so the
 * onboarding funnel reads "you are setting the cage", not "tweaking a setting".
 */
export function GuardrailSlider({
  label,
  hint,
  field,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: Props) {
  const frac = (value - min) / (max - min);

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="text-sm font-medium text-white/90">{label}</span>
          <span className="num ml-2 text-[10px] text-faint">{field}</span>
        </div>
        <span className="num text-xl font-semibold text-bound">{format(value)}</span>
      </div>

      <p className="mt-1.5 text-xs leading-relaxed text-mute">{hint}</p>

      <div className="relative mt-5">
        {/* track + fill behind the native range input */}
        <div className="pointer-events-none absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-bound"
            style={{ width: `${frac * 100}%`, boxShadow: "0 0 14px -2px #14E08A" }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className={cx(
            "relative z-10 h-1.5 w-full cursor-pointer appearance-none bg-transparent",
            // thumb
            "[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(20,224,138,0.25)] [&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
          )}
        />
      </div>

      <div className="mt-2 flex justify-between">
        <span className="num text-[10px] text-faint">{format(min)}</span>
        <span className="num text-[10px] text-faint">{format(max)}</span>
      </div>
    </div>
  );
}
