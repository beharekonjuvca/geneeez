import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  Space,
  Select,
  InputNumber,
  Button,
  Typography,
  Divider,
} from "antd";
import {
  DeleteOutlined,
  ReloadOutlined,
  CopyOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
} from "recharts";
import { runChart } from "../lib/api/charts";

const { Text } = Typography;

function useDebounced(fn, delay, deps) {
  const t = useRef();
  useEffect(() => {
    clearTimeout(t.current);
    t.current = setTimeout(() => fn(), delay);
    return () => clearTimeout(t.current);
  }, deps);
}

function Options({ schema }) {
  const cols = useMemo(
    () =>
      (schema?.columns || []).map((c) => ({ label: c.name, value: c.name })),
    [schema]
  );
  const numCols = useMemo(
    () =>
      schema?.columns
        ?.filter((c) => ["number", "integer"].includes(c.dtype))
        .map((c) => ({ label: c.name, value: c.name })) || [],
    [schema]
  );
  return { cols, numCols };
}

function ChartInner({ data }) {
  if (!data)
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
        <Text type="secondary">No data</Text>
      </div>
    );
  if (data.kind === "hist")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={(data.counts || []).map((c, i) => ({
            label: `${data.edges[i]}–${data.edges[i + 1]}`,
            y: c,
          }))}
        >
          <XAxis dataKey="label" hide />
          <YAxis hide />
          <Tooltip />
          <Bar dataKey="y" />
        </BarChart>
      </ResponsiveContainer>
    );
  if (data.kind === "bar")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.data || []}>
          <XAxis dataKey="x" hide />
          <YAxis hide />
          <Tooltip />
          <Bar dataKey="y" />
        </BarChart>
      </ResponsiveContainer>
    );
  if (data.kind === "line")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.data || []}>
          <XAxis dataKey="x" hide />
          <YAxis hide />
          <Tooltip />
          <Line type="monotone" dataKey="y" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  if (data.kind === "scatter")
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <XAxis dataKey="x" type="number" hide />
          <YAxis dataKey="y" type="number" hide />
          <Tooltip />
          <Scatter data={data.data || []} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  return null;
}

function ChartPanel({
  datasetId,
  schema,
  panel,
  onChange,
  onDelete,
  onDuplicate,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { cols, numCols } = Options({ schema });
  function hasRequiredFields(p) {
    if (p.kind === "hist") return !!p.x;
    if (p.kind === "bar") return !!p.x; // y optional
    if (p.kind === "line") return !!p.x && !!p.y;
    if (p.kind === "scatter") return !!p.x && !!p.y;
    return false;
  }

  useDebounced(
    async () => {
      // skip until user selects necessary fields
      if (!hasRequiredFields(panel)) {
        setData(null);
        return;
      }
      setLoading(true);
      try {
        const res = await runChart(datasetId, panel);
        setData(res);
      } catch (e) {
        // keep panel visible without crashing
        console.error("runChart failed", e);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    250,
    [datasetId, JSON.stringify(panel)]
  );

  const setField = (k, v) => onChange({ ...panel, [k]: v });

  return (
    <Card size="small" className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <Text strong>{panel.kind.toUpperCase()}</Text>
        <Space>
          <Button
            icon={<CopyOutlined />}
            size="small"
            onClick={() => onDuplicate?.(panel)}
          />
          <Button
            icon={<ReloadOutlined />}
            size="small"
            loading={loading}
            onClick={() => onChange({ ...panel })}
          />
          <Button
            icon={<DeleteOutlined />}
            size="small"
            danger
            onClick={onDelete}
          />
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 8 }}>
        <Select
          size="small"
          style={{ width: 140 }}
          value={panel.kind}
          onChange={(v) => setField("kind", v)}
          options={[
            { value: "hist", label: "Histogram" },
            { value: "bar", label: "Bar" },
            { value: "line", label: "Line" },
            { value: "scatter", label: "Scatter" },
          ]}
        />

        {panel.kind === "hist" && (
          <>
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="X (numeric)"
              value={panel.x}
              options={numCols}
              onChange={(v) => setField("x", v)}
            />
            <InputNumber
              size="small"
              min={5}
              max={50}
              value={panel.bins || 20}
              onChange={(v) => setField("bins", v)}
              placeholder="bins"
            />
          </>
        )}
        {panel.kind === "bar" && (
          <>
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="X"
              value={panel.x}
              options={cols}
              onChange={(v) => setField("x", v)}
            />
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="Y (optional numeric)"
              value={panel.y}
              options={numCols}
              allowClear
              onChange={(v) => setField("y", v)}
            />
          </>
        )}
        {panel.kind === "line" && (
          <>
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="X (time/num)"
              value={panel.x}
              options={cols}
              onChange={(v) => setField("x", v)}
            />
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="Y (numeric)"
              value={panel.y}
              options={numCols}
              onChange={(v) => setField("y", v)}
            />
          </>
        )}
        {panel.kind === "scatter" && (
          <>
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="X (numeric)"
              value={panel.x}
              options={numCols}
              onChange={(v) => setField("x", v)}
            />
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="Y (numeric)"
              value={panel.y}
              options={numCols}
              onChange={(v) => setField("y", v)}
            />
          </>
        )}
      </Space>

      <Divider style={{ margin: "8px 0" }} />
      <div style={{ height: 220 }}>
        <ChartInner data={data} />
      </div>
    </Card>
  );
}

export default React.memo(ChartPanel);
