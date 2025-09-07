import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Layout,
  Menu,
  Typography,
  Space,
  Tag,
  Card,
  Table,
  Button,
  message,
  Spin,
} from "antd";
import {
  BarChartOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  LockOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import {
  getDatasetPreview,
  getDatasetSchema,
  downloadDataset,
} from "../../lib/api/datasets";
import ColumnDrawer from "../../components/ColumnDrawer";
import ChartPanel from "../../components/ChartPanel";
import { saveRecipe, listRecipes, updateRecipe } from "../../lib/api/recipes";
import CorrelationPanel from "../../components/CorrelationPanel";
import PcaPanel from "../../components/PcaPanel";
import AnalyticsPanel from "../../components/AnalyticsPanel";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

function typeColor(dtype) {
  if (dtype === "number" || dtype === "integer") return "processing";
  if (dtype === "boolean") return "green";
  if (dtype === "datetime") return "purple";
  if (dtype === "string") return "blue";
  return "default";
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DatasetDetail() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("overview");
  const [preview, setPreview] = useState(null);
  const [schema, setSchema] = useState(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCol, setActiveCol] = useState(null);

  const [panels, setPanels] = useState([]);
  const [recipeId, setRecipeId] = useState(null);

  useEffect(() => {
    if (!initializing && !user) router.replace("/");
  }, [initializing, user, router]);

  useEffect(() => {
    if (initializing || !user || !id) return;
    (async () => {
      try {
        setLoading(true);
        const [p, s] = await Promise.all([
          getDatasetPreview(id, 75),
          getDatasetSchema(id),
        ]);
        setPreview(p);
        setSchema(s);
      } catch {
        message.error("Failed to load dataset");
      } finally {
        setLoading(false);
      }
    })();
  }, [initializing, user, id]);
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      try {
        const recs = await listRecipes(Number(id));
        if (recs.length) {
          setPanels(recs[0].panels || []);
          setRecipeId(recs[0].id);
        } else {
          setPanels([]);
          setRecipeId(null);
        }
      } catch {}
    })();
  }, [id, user]);

  function addPanel(kind = "hist") {
    const def = { id: String(Date.now()), kind, bins: 20, filters: [] };
    setPanels((p) => [def, ...p]);
  }

  async function savePanels() {
    try {
      if (recipeId) {
        await updateRecipe(recipeId, { panels });
      } else {
        const res = await saveRecipe(Number(id), "Visual layout", panels);
        setRecipeId(res.id);
      }
      message.success("Saved");
    } catch {
      message.error("Save failed");
    }
  }

  function updateOne(updated) {
    setPanels((p) => p.map((x) => (x.id === updated.id ? updated : x)));
  }
  function deleteOne(idToDel) {
    setPanels((p) => p.filter((x) => x.id !== idToDel));
  }
  function duplicateOne(panel) {
    const copy = { ...panel, id: String(Date.now()) };
    setPanels((p) => [copy, ...p]);
  }

  if (initializing || !user || loading) {
    return (
      <AppShell>
        <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
          <Spin />
        </div>
      </AppShell>
    );
  }

  if (!preview || !schema) {
    return (
      <AppShell>
        <Card className="card" style={{ padding: 24 }}>
          <Text type="secondary">No data available for this dataset.</Text>
        </Card>
      </AppShell>
    );
  }

  const previewCols = preview.columns.map((name, idx) => ({
    title: (
      <span
        style={{ cursor: "pointer" }}
        onClick={() => {
          const meta = schema.columns.find((x) => x.name === name);
          if (meta) {
            setActiveCol(meta);
            setDrawerOpen(true);
          }
        }}
      >
        {name}
      </span>
    ),
    dataIndex: String(idx),
    key: name,
    ellipsis: true,
    width: Math.min(Math.max(name.length * 10, 120), 260),
  }));

  const previewData = preview.rows.map((arr, rIdx) => {
    const obj = { key: rIdx };
    arr.forEach((val, i) => (obj[String(i)] = val));
    return obj;
  });

  async function exportFmt(fmt) {
    try {
      const blob = await downloadDataset(id, { format: fmt });
      triggerDownload(blob, `dataset_${id}.${fmt === "xlsx" ? "xlsx" : fmt}`);
    } catch {
      message.error("Export failed");
    }
  }

  return (
    <AppShell>
      <Layout
        style={{
          background: "transparent",
          minHeight: "calc(100vh - 80px)",
        }}
      >
        {/* LEFT NAV */}
        <Sider
          width={220}
          style={{
            background: "#fff",
            borderRight: "1px solid #E9EDF2",
            borderRadius: 16,
            padding: 12,
            height: "fit-content",
            position: "sticky",
            top: 24,
            alignSelf: "start",
          }}
        >
          <div style={{ fontWeight: 600, margin: "6px 12px 12px" }}>
            Dataset Explorer
          </div>
          <Menu
            mode="inline"
            selectedKeys={[active]}
            onClick={(e) => setActive(e.key)}
            items={[
              {
                key: "overview",
                icon: <InfoCircleOutlined />,
                label: "Overview",
              },
              {
                key: "preview",
                icon: <DatabaseOutlined />,
                label: "Data Preview",
              },
              {
                key: "visualize",
                icon: <BarChartOutlined />,
                label: "Visualize",
              },
              {
                key: "analytics",
                icon: <ExperimentOutlined />,
                label: "Analytics",
              },
            ]}
          />
        </Sider>

        {/* MAIN CONTENT */}
        <Content style={{ marginLeft: 16 }}>
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Title level={3} style={{ margin: 0 }}>
                  Dataset #{id}
                </Title>
                <Tag icon={<LockOutlined />} color="default">
                  Private
                </Tag>
              </div>
              <Space size="small">
                <Tag color="geekblue">{schema.rows?.toLocaleString()} rows</Tag>
                <Tag color="geekblue">{schema.columns?.length} columns</Tag>
              </Space>
            </div>

            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportFmt("csv")}
              >
                Download
              </Button>
              {/* 
              <Button onClick={() => exportFmt("xlsx")}>Export XLSX</Button> */}
            </Space>
          </div>

          {/* Sections */}
          {active === "overview" && (
            <div style={{ display: "grid", gap: 16 }}>
              <Card className="card">
                <Title level={5} style={{ marginTop: 0 }}>
                  Overview
                </Title>
                <Text type="secondary">
                  Quick summary of your dataset. Click “Data Preview” to inspect
                  records, or click any column header there to see details in
                  the side drawer.
                </Text>
                <div style={{ height: 12 }} />
                <Table
                  size="small"
                  rowKey="name"
                  dataSource={schema.columns}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  columns={[
                    {
                      title: "Name",
                      dataIndex: "name",
                      render: (v, rec) => (
                        <a
                          onClick={() => {
                            setActive("preview");
                            setActiveCol(rec);
                            setDrawerOpen(true);
                          }}
                        >
                          {v}
                        </a>
                      ),
                    },
                    {
                      title: "Type",
                      dataIndex: "dtype",
                      render: (v) => <Tag color={typeColor(v)}>{v}</Tag>,
                      width: 120,
                    },
                    {
                      title: "Role",
                      dataIndex: "role",
                      render: (v) => <Tag color="blue">{v}</Tag>,
                      width: 120,
                    },
                    {
                      title: "Missing",
                      render: (_, r) => (
                        <Space size="small">
                          <Tag>{r.missing}</Tag>
                          <Tag color="warning">{r.missing_pct}%</Tag>
                        </Space>
                      ),
                      width: 160,
                    },
                    {
                      title: "Unique",
                      dataIndex: "unique_count",
                      width: 120,
                    },
                  ]}
                />
              </Card>
            </div>
          )}

          {active === "preview" && (
            <Card className="card">
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 8 }}
              >
                Showing first {preview.rows.length.toLocaleString()} rows
              </Text>
              <Table
                size="small"
                dataSource={previewData}
                columns={previewCols}
                sticky
                tableLayout="fixed"
                scroll={{
                  x:
                    previewCols.reduce((s, c) => s + (c.width || 160), 0) + 200,
                  y: 560,
                }}
                pagination={{ pageSize: 25, showSizeChanger: false }}
              />
            </Card>
          )}

          {active === "visualize" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Space>
                  <Button onClick={() => addPanel("hist")}>+ Histogram</Button>
                  <Button onClick={() => addPanel("bar")}>+ Bar</Button>
                  <Button onClick={() => addPanel("line")}>+ Line</Button>
                  <Button onClick={() => addPanel("scatter")}>+ Scatter</Button>
                </Space>
                <Space>
                  <Button type="primary" onClick={savePanels}>
                    Save layout
                  </Button>
                </Space>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
                  gap: 16,
                }}
              >
                {panels.map((p) => (
                  <ChartPanel
                    key={p.id}
                    datasetId={id}
                    schema={schema}
                    panel={p}
                    onChange={updateOne}
                    onDelete={() => deleteOne(p.id)}
                    onDuplicate={() => duplicateOne(p)}
                  />
                ))}
              </div>
            </div>
          )}
          {active === "analytics" && <AnalyticsPanel datasetId={Number(id)} />}
        </Content>
      </Layout>

      <ColumnDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        column={activeCol}
      />
    </AppShell>
  );
}
