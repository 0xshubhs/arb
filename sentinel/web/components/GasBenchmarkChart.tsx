"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BenchmarkRow {
  op: string; // operation label
  stylus: number; // gas
  solidity: number; // gas
}

/**
 * Stylus-vs-Solidity gas benchmark as grouped bars per operation. Stylus bars
 * are signal-green, Solidity bars are muted; the % savings is annotated above.
 */
export function GasBenchmarkChart({ data }: { data: BenchmarkRow[] }) {
  // Flatten into long form so each op renders a green (Stylus) + gray (Solidity) pair.
  const rows = data.flatMap((d) => [
    { key: `${d.op} · Stylus`, op: d.op, engine: "Stylus", gas: d.stylus },
    { key: `${d.op} · Solidity`, op: d.op, engine: "Solidity", gas: d.solidity },
  ]);

  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 28, right: 16, left: 8, bottom: 8 }} barCategoryGap={10}>
          <CartesianGrid strokeDasharray="2 4" stroke="#1A212C" vertical={false} />
          <XAxis
            dataKey="key"
            tick={<EngineTick />}
            axisLine={{ stroke: "#1A212C" }}
            tickLine={false}
            interval={0}
            height={48}
          />
          <YAxis
            tick={{ fill: "#5A6678", fontSize: 11, fontFamily: "var(--font-jetbrains-mono)" }}
            axisLine={{ stroke: "#1A212C" }}
            tickLine={false}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            width={44}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            contentStyle={{
              background: "#0A0E14",
              border: "1px solid #1A212C",
              borderRadius: 6,
              fontFamily: "var(--font-jetbrains-mono)",
              fontSize: 12,
            }}
            labelStyle={{ color: "#8A98AD" }}
            formatter={(value: number, _name, entry) => [
              `${value.toLocaleString()} gas`,
              (entry?.payload as { engine?: string })?.engine ?? "",
            ]}
          />
          <Bar dataKey="gas" radius={[3, 3, 0, 0]} maxBarSize={56}>
            {rows.map((r) => (
              <Cell key={r.key} fill={r.engine === "Stylus" ? "#00E58A" : "#2C3543"} />
            ))}
            <LabelList dataKey="gas" content={<SavingsLabel data={data} />} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Two-line tick: operation name + engine, engine colored by type. */
function EngineTick(props: { x?: number; y?: number; payload?: { value?: string } }) {
  const { x = 0, y = 0, payload } = props;
  const value = payload?.value ?? "";
  const [op, engine] = value.split(" · ");
  const isStylus = engine === "Stylus";
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="middle"
        fill={isStylus ? "#00E58A" : "#5A6678"}
        fontFamily="var(--font-jetbrains-mono)"
        fontSize={11}
      >
        {engine}
      </text>
      <text
        x={0}
        y={0}
        dy={30}
        textAnchor="middle"
        fill="#3f4a5a"
        fontFamily="var(--font-jetbrains-mono)"
        fontSize={9}
      >
        {op}
      </text>
    </g>
  );
}

/** Annotate the % savings above each Stylus bar. */
function SavingsLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
  data: BenchmarkRow[];
  index?: number;
}) {
  const { x = 0, y = 0, width = 0, value, data, index = 0 } = props;
  // Only annotate Stylus bars (even indices in the flattened long form).
  if (index % 2 !== 0) return null;
  const row = data[index / 2];
  if (!row) return null;
  const savings = Math.round(((row.solidity - row.stylus) / row.solidity) * 100);
  if (value === undefined) return null;
  return (
    <text
      x={x + width}
      y={y - 10}
      textAnchor="middle"
      fill="#00E58A"
      fontFamily="var(--font-jetbrains-mono)"
      fontSize={12}
      fontWeight={700}
    >
      −{savings}%
    </text>
  );
}
