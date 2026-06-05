"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  /** Starting portfolio value in dollars. */
  principal: number;
  /** Drift band in bps — widens the projection envelope. */
  driftBps: number;
  /** Daily budget in dollars — more budget => tighter tracking, faster compounding. */
  dailyBudgetUsd: number;
  /** Max slippage in bps — drags expected return slightly. */
  slippageBps: number;
}

interface Point {
  month: number;
  label: string;
  expected: number;
  low: number;
  high: number;
  /** Recharts stacked-area helper: band thickness above `low`. */
  bandLow: number;
  band: number;
}

const HORIZON_MONTHS = 24;

/**
 * Live projected-value + drift-band chart — the onboarding centerpiece.
 * Re-renders instantly as the sliders drag. Math is illustrative (not advice):
 * a managed basket compounds at a base rate; tighter drift + bigger budget let
 * the agent track the target more closely, narrowing the cone of outcomes,
 * while slippage shaves a little off expected return.
 */
export function ProjectionChart({ principal, driftBps, dailyBudgetUsd, slippageBps }: Props) {
  const data = useMemo<Point[]>(() => {
    // Base annualized drift ~ 11%; tighter tracking (more budget) nudges it up,
    // slippage drags it down a touch.
    const budgetFactor = Math.min(0.03, (dailyBudgetUsd / principal) * 0.4);
    const slippageDrag = (slippageBps / 10000) * 0.6;
    const annual = 0.11 + budgetFactor - slippageDrag;
    const monthly = annual / 12;

    // Outcome cone widens with looser drift bands and narrows with more budget.
    const bandWidth = (driftBps / 10000) * 1.6 + 0.04;

    const points: Point[] = [];
    for (let m = 0; m <= HORIZON_MONTHS; m++) {
      const expected = principal * Math.pow(1 + monthly, m);
      const spread = expected * bandWidth * Math.sqrt(m / 6);
      const low = Math.max(principal * 0.6, expected - spread);
      const high = expected + spread;
      points.push({
        month: m,
        label: m === 0 ? "now" : `${m}m`,
        expected: Math.round(expected),
        low: Math.round(low),
        high: Math.round(high),
        bandLow: Math.round(low),
        band: Math.round(high - low),
      });
    }
    return points;
  }, [principal, driftBps, dailyBudgetUsd, slippageBps]);

  const last = data[data.length - 1];

  return (
    <div className="card relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div>
          <span className="label">Projected value · 24 months</span>
          <p className="mt-1 text-xs text-mute">
            Illustrative. The band reflects your drift tolerance, not a guarantee.
          </p>
        </div>
        <div className="text-right">
          <div className="num text-2xl font-semibold text-bound">
            {last.expected.toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="num text-[11px] text-mute">
            range {last.low.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
            {" – "}
            {last.high.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div className="mt-4 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14E08A" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#14E08A" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#7E8694", fontSize: 11, fontFamily: "var(--font-plex-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
              interval={3}
            />
            <YAxis
              width={56}
              tick={{ fill: "#7E8694", fontSize: 11, fontFamily: "var(--font-plex-mono)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
              domain={["dataMin - 200", "dataMax + 200"]}
            />
            <Tooltip
              contentStyle={{
                background: "#11161F",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                fontFamily: "var(--font-plex-mono)",
                fontSize: 12,
              }}
              labelStyle={{ color: "#7E8694" }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  expected: "Expected",
                  band: "Upside",
                  bandLow: "Downside",
                };
                return [
                  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
                  labels[name] ?? name,
                ];
              }}
            />
            {/* invisible base + visible band = a shaded outcome cone */}
            <Area dataKey="bandLow" stackId="band" stroke="none" fill="transparent" isAnimationActive />
            <Area
              dataKey="band"
              stackId="band"
              stroke="none"
              fill="url(#bandFill)"
              isAnimationActive
              animationDuration={400}
            />
            <Line
              dataKey="expected"
              stroke="#14E08A"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
