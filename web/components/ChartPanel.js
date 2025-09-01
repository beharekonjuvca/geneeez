import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
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
  const callback = useRef(fn);
  const timeout = useRef();

  useEffect(() => {
    callback.current = fn;
  }, [fn]);

  useEffect(() => {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => callback.current(), delay);
    return () => clearTimeout(timeout.current);
    // `deps` is the dependency array passed by caller
  }, deps);
}

const MemoizedBarChart = React.memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      <XAxis dataKey="x" hide />
      <YAxis hide />
      <Tooltip />
      <Bar dataKey="y" />
    </BarChart>
  </ResponsiveContainer>
));

const MemoizedLineChart = React.memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={data}>
      <XAxis dataKey="x" hide />
      <YAxis hide />
      <Tooltip />
      <Line type="monotone" dataKey="y" dot={false} />
    </LineChart>
  </ResponsiveContainer>
));

const MemoizedScatterChart = React.memo(({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <ScatterChart>
      <XAxis dataKey="x" type="number" hide />
      <YAxis dataKey="y" type="number" hide />
      <Tooltip />
      <Scatter data={data} />
    </ScatterChart>
  </ResponsiveContainer>
));

/** Inner renderer */
const ChartInner = React.memo(({ data }) => {
  if (!data) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
        <Text type="secondary">No data</Text>
      </div>
    );
  }

  switch (data.kind) {
    case "hist":
      return (
        <MemoizedBarChart
          data={(data.counts || []).map((c, i) => ({
            x: `${data.edges[i]}–${data.edges[i + 1]}`, // fixed: X key exists
            y: c,
          }))}
        />
      );
    case "bar":
      return <MemoizedBarChart data={data.data || []} />;
    case "line":
      return <MemoizedLineChart data={data.data || []} />;
    case "scatter":
      return <MemoizedScatterChart data={data.data || []} />;
    default:
      return null;
  }
});

/** Main panel */
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

  const hasRequiredFields = useCallback((p) => {
    if (p.kind === "hist") return !!p.x;
    if (p.kind === "bar") return !!p.x;
    if (p.kind === "line") return !!p.x && !!p.y;
    if (p.kind === "scatter") return !!p.x && !!p.y;
    return false;
  }, []);

  const fetchData = useCallback(async () => {
    if (!panel?.kind) return;
    if (!hasRequiredFields(panel)) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await runChart(datasetId, panel);
      setData(res);
    } catch (e) {
      console.error("runChart failed", e);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [datasetId, panel, hasRequiredFields]);

  useDebounced(fetchData, 250, [fetchData]);

  const setField = useCallback(
    (k, v) => onChange?.({ ...panel, [k]: v }),
    [panel, onChange]
  );

  const chartOptions = useMemo(
    () => [
      { value: "hist", label: "Histogram" },
      { value: "bar", label: "Bar" },
      { value: "line", label: "Line" },
      { value: "scatter", label: "Scatter" },
    ],
    []
  );

  const currentKind = panel?.kind || "bar";

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
        <Text strong>{currentKind.toUpperCase()}</Text>
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
            onClick={fetchData}
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
          value={currentKind}
          onChange={(v) => setField("kind", v)}
          options={chartOptions}
        />

        {currentKind === "hist" && (
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
              onChange={(v) => setField("bins", v ?? 20)}
              placeholder="bins"
            />
          </>
        )}

        {currentKind === "bar" && (
          <>
            <Select
              size="small"
              style={{ width: 190 }}
              placeholder="X"
              value={panel.x}
              options={cols}
              onChange={(v) => setField("x", v)}
              allowClear
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

        {currentKind === "line" && (
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

        {currentKind === "scatter" && (
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
