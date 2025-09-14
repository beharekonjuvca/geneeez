// web/components/AnalyticsPanel.js
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Space,
  Select,
  InputNumber,
  Input,
  Button,
  Typography,
  Divider,
  Alert,
  Image,
  message,
} from "antd";
import { listRecipeTemplates, runAnalysis, getRun } from "../lib/api/analytics";

const { Title, Text } = Typography;

export default function AnalyticsPanel({ datasetId }) {
  const [templates, setTemplates] = useState([]);
  const [sel, setSel] = useState(null);
  const [params, setParams] = useState({});
  const [run, setRun] = useState(null);
  const [running, setRunning] = useState(false);

  //   useEffect(() => {
  //     (async () => {
  //       try {
  //         const t = await listRecipeTemplates(Number(datasetId));
  //         setTemplates(t);
  //       } catch (e) {
  //         message.error("Failed to load analyses");
  //       }
  //     })();
  //   }, [datasetId]);
  useEffect(() => {
    (async () => {
      console.log("[AnalyticsPanel] datasetId =", datasetId);
      try {
        const t = await listRecipeTemplates(Number(datasetId));
        console.log("[AnalyticsPanel] templates =", t);
        setTemplates(t);
      } catch (e) {
        console.error("[AnalyticsPanel] load error:", e);
        message.error("Failed to load analyses");
      }
    })();
  }, [datasetId]);

  const chosen = useMemo(
    () => templates.find((t) => t.key === sel) || null,
    [templates, sel]
  );

  const ParamFields = () => {
    if (!chosen) return null;
    if (chosen.key === "correlation") {
      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text strong>Method</Text>
            <br />
            <Select
              value={params.method ?? "spearman"}
              onChange={(v) => setParams((p) => ({ ...p, method: v }))}
              style={{ width: 200 }}
              options={[
                { value: "spearman", label: "spearman" },
                { value: "pearson", label: "pearson" },
              ]}
            />
          </div>
          <div>
            <Text strong>Max features for heatmap</Text>
            <br />
            <InputNumber
              min={50}
              max={1000}
              value={params.max_features ?? 300}
              onChange={(v) =>
                setParams((p) => ({ ...p, max_features: Number(v) }))
              }
            />
          </div>
        </Space>
      );
    }
    if (chosen.key === "pca") {
      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text strong>n_components</Text>
            <br />
            <InputNumber
              min={2}
              max={50}
              value={params.n_components ?? 10}
              onChange={(v) =>
                setParams((p) => ({ ...p, n_components: Number(v) }))
              }
            />
          </div>
          <div>
            <Text strong>Top variable genes</Text>
            <br />
            <InputNumber
              min={200}
              max={10000}
              value={params.top_genes ?? 1000}
              onChange={(v) =>
                setParams((p) => ({ ...p, top_genes: Number(v) }))
              }
            />
          </div>
          <div>
            <Text strong>Log1p</Text>
            <br />
            <Select
              value={params.log1p ?? false}
              onChange={(v) => setParams((p) => ({ ...p, log1p: v }))}
              style={{ width: 120 }}
              options={[
                { value: false, label: "No" },
                { value: true, label: "Yes" },
              ]}
            />
          </div>
        </Space>
      );
    }
    if (chosen.key === "de") {
      return (
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text strong>group_col</Text>
            <br />
            <Input
              value={params.group_col ?? "group"}
              onChange={(e) =>
                setParams((p) => ({ ...p, group_col: e.target.value }))
              }
            />
          </div>
          <div>
            <Text strong>alpha</Text>
            <br />
            <InputNumber
              step={0.01}
              min={0.0001}
              max={0.25}
              value={params.alpha ?? 0.05}
              onChange={(v) => setParams((p) => ({ ...p, alpha: Number(v) }))}
            />
          </div>
        </Space>
      );
    }
    return null;
  };

  async function go() {
    if (!chosen) return;
    setRunning(true);
    setRun(null);
    try {
      let r = await runAnalysis(Number(datasetId), {
        recipe_key: chosen.key,
        params,
      });
      while (r.status === "queued" || r.status === "running") {
        await new Promise((res) => setTimeout(res, 1000));
        r = await getRun(r.id);
      }
      setRun(r);
      if (r.status !== "succeeded")
        message.error(r.error_message || "Analysis failed");
    } catch (e) {
      message.error("Run failed");
    } finally {
      setRunning(false);
    }
  }

  const Results = () => {
    if (!run) return null;
    if (run.status !== "succeeded") {
      return <Alert type="error" message={run.error_message || "Failed"} />;
    }
    const a = run.artifacts_json || {};
    return (
      <Space direction="vertical" style={{ width: "100%" }}>
        {Array.isArray(a.pngs) && a.pngs.length > 0 && (
          <Card size="small" title="Plots">
            <Space wrap>
              {a.pngs.map((u, i) => (
                <Image key={i} src={u} width={380} alt={`plot-${i}`} />
              ))}
            </Space>
          </Card>
        )}
        <Space wrap>
          {a.csv_url && <a href={a.csv_url}>Download CSV</a>}
          {a.scores_csv && <a href={a.scores_csv}>Download PCA scores</a>}
          {a.html_url && <a href={a.html_url}>View HTML Report</a>}
          {a.ipynb_url && <a href={a.ipynb_url}>Download Notebook</a>}
        </Space>
        {/* <pre style={{ background: "#fafafa", padding: 12, borderRadius: 8 }}>
          {JSON.stringify(a, null, 2)}
        </pre> */}
      </Space>
    );
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card className="card">
        <Title level={5} style={{ marginTop: 0 }}>
          Pick analysis
        </Title>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            placeholder="Choose…"
            style={{ width: 360 }}
            value={sel}
            onChange={(v) => {
              setSel(v);
              setParams({});
              setRun(null);
            }}
            options={templates.map((t) => ({
              value: t.key,
              label: t.display_name,
            }))}
          />
          {chosen?.description && (
            <Text type="secondary">{chosen.description}</Text>
          )}
          <Divider style={{ margin: "8px 0" }} />
          <ParamFields />
          <div>
            <Button
              type="primary"
              onClick={go}
              loading={running}
              disabled={!chosen}
            >
              {running ? "Running…" : "Run analysis"}
            </Button>
          </div>
        </Space>
      </Card>

      <Results />
    </div>
  );
}
