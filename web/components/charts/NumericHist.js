import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function NumericHist({ edges = [], counts = [] }) {
  if (!edges?.length || !counts?.length) return null;
  const data = counts.map((c, i) => ({
    x0: edges[i],
    x1: edges[i + 1],
    label: `${edges[i]}–${edges[i + 1]}`,
    y: c,
  }));
  return (
    <div style={{ height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="label" hide />
          <YAxis hide />
          <Tooltip formatter={(v, n, p) => [`${p.payload.label}`, "Range"]} />
          <Bar dataKey="y" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
