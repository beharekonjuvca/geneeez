import { useEffect, useMemo, useState } from "react";
import { Card, Space, Select, Typography } from "antd";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { pcaScores } from "../lib/api/stats";

const { Text } = Typography;

export default function PcaPanel({ datasetId, schema }) {
  const numCols = useMemo(
    () =>
      (schema?.columns || [])
        .filter((c) => ["number", "integer"].includes(c.dtype))
        .map((c) => ({ label: c.name, value: c.name })),
    [schema]
  );
  const [picked, setPicked] = useState(numCols.slice(0, 6).map((c) => c.value));
  const [res, setRes] = useState(null);

  useEffect(() => {
    (async () => {
      if (!picked.length) return;
      const r = await pcaScores(datasetId, {
        columns: picked,
        n_components: 2,
      });
      setRes(r);
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
        <Text strong>PCA (PC1 vs PC2)</Text>
        <div style={{ minWidth: 280 }}>
          <Select
            mode="multiple"
            allowClear
            style={{ width: "100%" }}
            placeholder="Columns"
            value={picked}
            onChange={setPicked}
            options={numCols}
            maxTagCount="responsive"
          />
        </div>
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
            <XAxis dataKey="pc1" />
            <YAxis dataKey="pc2" />
            <Tooltip />
            <Scatter data={res?.scores || []} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      {res?.explained && (
        <div style={{ marginTop: 6 }}>
          <Text type="secondary">
            Explained variance: PC1 {(res.explained[0] * 100).toFixed(1)}% • PC2{" "}
            {(res.explained[1] * 100).toFixed(1)}%
          </Text>
        </div>
      )}
    </Card>
  );
}
