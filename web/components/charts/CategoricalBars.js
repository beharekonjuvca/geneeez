import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function CategoricalBars({ levels = [] }) {
  if (!levels?.length) return null;
  const data = levels.map((l) => ({ name: String(l.value), count: l.count }));
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="name" hide />
          <YAxis hide />
          <Tooltip />
          <Bar dataKey="count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
