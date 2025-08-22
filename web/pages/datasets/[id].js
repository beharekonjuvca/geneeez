import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Tabs, Table, Typography, message, Spin, Tag, Card, Space } from "antd";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import { getDatasetPreview, getDatasetSchema } from "../../lib/api/datasets";
import ColumnDrawer from "../../components/ColumnDrawer";
import ColumnPanel from "../../components/ColumnPanel";

const { Title, Text } = Typography;

function typeColor(dtype) {
  if (dtype === "number" || dtype === "integer") return "processing";
  if (dtype === "boolean") return "green";
  if (dtype === "datetime") return "purple";
  if (dtype === "string") return "blue";
  return "default";
}

export default function DatasetDetail() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [schema, setSchema] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCol, setActiveCol] = useState(null);

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
    arr.forEach((val, i) => {
      obj[String(i)] = val;
    });
    return obj;
  });

  return (
    <AppShell>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 280px",
          gap: 16,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Title level={3} style={{ margin: 0 }}>
              Dataset #{id}
            </Title>
            <Space size="small">
              <Tag color="geekblue">{schema.rows?.toLocaleString()} rows</Tag>
              <Tag color="geekblue">{schema.columns?.length} columns</Tag>
            </Space>
          </div>

          <Tabs
            defaultActiveKey="preview"
            items={[
              {
                key: "preview",
                label: "Preview",
                children: (
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
                          previewCols.reduce(
                            (s, c) => s + (c.width || 160),
                            0
                          ) + 200,
                        y: 560,
                      }}
                      pagination={{ pageSize: 25, showSizeChanger: false }}
                    />
                  </Card>
                ),
              },
              {
                key: "schema",
                label: "Schema",
                children: (
                  <Card className="card">
                    <Text type="secondary">
                      Click a column name in the sidebar or table header for
                      details.
                    </Text>
                    <div style={{ height: 12 }} />
                    <Table
                      size="small"
                      rowKey="name"
                      dataSource={schema.columns}
                      pagination={{ pageSize: 12, showSizeChanger: false }}
                      columns={[
                        {
                          title: "Name",
                          dataIndex: "name",
                          render: (v, rec) => (
                            <a
                              onClick={() => {
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
                ),
              },
            ]}
          />
        </div>

        <Card className="card" style={{ position: "sticky", top: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            Schema
          </div>
          <ColumnPanel
            schema={schema}
            onPick={(c) => {
              setActiveCol(c);
              setDrawerOpen(true);
            }}
          />
        </Card>
      </div>

      <ColumnDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        column={activeCol}
      />
    </AppShell>
  );
}
