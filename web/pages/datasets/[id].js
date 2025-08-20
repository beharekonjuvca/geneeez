import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Tabs,
  Table,
  Typography,
  message,
  Spin,
  Tag,
  Space,
  Input,
  Empty,
  Card,
} from "antd";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import { getDatasetPreview, getDatasetSchema } from "../../lib/api/datasets";
import ColumnDrawer from "../../components/ColumnDrawer";
import { SearchOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

function typeTag(dtype) {
  const color =
    dtype === "number" || dtype === "integer"
      ? "processing"
      : dtype === "boolean"
      ? "green"
      : dtype === "datetime"
      ? "purple"
      : dtype === "string"
      ? "blue"
      : "default";
  return <Tag color={color}>{dtype}</Tag>;
}

export default function DatasetDetail() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState(null);
  const [schema, setSchema] = useState(null);
  const [search, setSearch] = useState("");
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
      } catch (e) {
        message.error("Failed to load dataset");
      } finally {
        setLoading(false);
      }
    })();
  }, [initializing, user, id]);

  const filteredSchema = useMemo(() => {
    if (!schema) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return schema.columns;
    return schema.columns.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.dtype.toLowerCase().includes(needle) ||
        (c.role || "").toLowerCase().includes(needle)
    );
  }, [schema, search]);

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
        <Empty description="No data available for this dataset" />
      </AppShell>
    );
  }
  const previewCols = preview.columns.map((c, idx) => ({
    title: (
      <span
        style={{ cursor: "pointer" }}
        onClick={() => {
          const colMeta = schema.columns.find((x) => x.name === c);
          if (colMeta) {
            setActiveCol(colMeta);
            setDrawerOpen(true);
          }
        }}
      >
        {c}
      </span>
    ),
    dataIndex: String(idx),
    key: c,
    ellipsis: true,
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
          <Text type="secondary">
            {schema.rows?.toLocaleString() ?? "—"} rows •{" "}
            {schema.columns?.length ?? "—"} columns
          </Text>
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
                    scroll={{ x: true }}
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <Text type="secondary">
                      Column profiling (click a name to inspect)
                    </Text>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder="Search columns"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: 300 }}
                    />
                  </div>
                  <Table
                    size="small"
                    rowKey="name"
                    dataSource={filteredSchema}
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
                        render: (v) => typeTag(v),
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
                        dataIndex: "missing",
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

        <ColumnDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          column={activeCol}
        />
      </div>
    </AppShell>
  );
}
