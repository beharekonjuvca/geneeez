import { useEffect, useMemo, useState } from "react";
import { Card, Space, Select, Typography, Slider } from "antd";
import { corrMatrix } from "../lib/api/stats";

const { Text } = Typography;

function Heatmap({ cols, matrix }) {
  if (!cols?.length)
    return (
      <div style={{ height: 240, display: "grid", placeItems: "center" }}>
        <Text type="secondary">No data</Text>
      </div>
    );
  const n = cols.length,
    size = 18,
    pad = 60,
    W = pad + n * size,
    H = pad + n * size;
  const vals = matrix.flat();
  const vmin = Math.min(...vals),
    vmax = Math.max(...vals);
  const color = (v) => {
    const t = (v - -1) / 2; // map [-1,1] to [0,1]
    const g = Math.round(t * 255),
      r = Math.round((1 - t) * 255);
    return `rgb(${r},${g},200)`;
  };
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
      {matrix.map((row, i) =>
        row.map((v, j) => (
          <rect
            key={`${i}-${j}`}
            x={pad + j * size}
            y={pad + i * size}
            width={size}
            height={size}
            fill={color(v)}
          />
        ))
      )}
      {cols.map((c, i) => (
        <text
          key={`y${i}`}
          x={pad - 4}
          y={pad + i * size + 12}
          fontSize="10"
          textAnchor="end"
        >
          {c}
        </text>
      ))}
      {cols.map((c, i) => (
        <text
          key={`x${i}`}
          x={pad + i * size + 9}
          y={pad - 6}
          fontSize="10"
          textAnchor="middle"
          transform={`rotate(-45 ${pad + i * size + 9},${pad - 6})`}
        >
          {c}
        </text>
      ))}
    </svg>
  );
}

export default function CorrelationPanel({ datasetId, schema }) {
  const numCols = useMemo(
    () =>
      (schema?.columns || [])
        .filter((c) => ["number", "integer"].includes(c.dtype))
        .map((c) => ({ label: c.name, value: c.name })),
    [schema]
  );
  const [picked, setPicked] = useState(numCols.slice(0, 8).map((c) => c.value));
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      if (!picked.length) return;
      const res = await corrMatrix(datasetId, { columns: picked });
      setData(res);
    })();
  }, [datasetId, JSON.stringify(picked)]);

  return (
    <Card className="card" size="small">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text strong>Correlation (Pearson)</Text>
        <div style={{ minWidth: 280 }}>
          <Select
            mode="multiple"
            allowClear
            style={{ width: "100%" }}
            placeholder="Pick numeric columns"
            value={picked}
            onChange={setPicked}
            options={numCols}
            maxTagCount="responsive"
          />
        </div>
      </div>
      <div style={{ height: 280, overflow: "auto" }}>
        <Heatmap cols={data?.cols} matrix={data?.matrix} />
      </div>
    </Card>
  );
}
