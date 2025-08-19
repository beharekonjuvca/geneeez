import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Table,
  Button,
  Typography,
  message,
  Spin,
  Space,
  Input,
  Popconfirm,
  Empty,
  Skeleton,
  Tag,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import DatasetUpload from "../components/DatasetUpload";
import { listDatasets, deleteDataset } from "../lib/api/datasets";

const { Title, Text } = Typography;

function fmtBytes(n) {
  if (!n && n !== 0) return "—";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0,
    x = n;
  while (x >= 1024 && i < u.length - 1) {
    x /= 1024;
    i++;
  }
  return `${x.toFixed(1)} ${u[i]}`;
}

export default function Datasets() {
  const { user, initializing } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    if (!initializing && !user) router.replace("/");
  }, [initializing, user, router]);

  useEffect(() => {
    if (initializing || !user) return;
    (async () => {
      try {
        setRows(await listDatasets());
      } catch {
        message.error("Failed to load datasets");
        setRows([]);
      }
    })();
  }, [initializing, user]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.description || "").toLowerCase().includes(needle) ||
        (r.original_filename || "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  async function remove(id) {
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== id));
    try {
      await deleteDataset(id);
      message.success("Dataset deleted");
    } catch {
      message.error("Delete failed");
      setRows(prev);
    }
  }

  if (initializing || !user) {
    return (
      <AppShell>
        <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
          <Spin />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            Datasets
          </Title>
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search title, note, or filename"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 320 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setUploadOpen(true)}
            >
              New dataset
            </Button>
          </Space>
        </div>

        {rows === null ? (
          <CardLikeLoader />
        ) : rows.length === 0 ? (
          <Empty
            description={
              <div>
                <div style={{ marginBottom: 8 }}>No datasets yet</div>
                <Text type="secondary">Upload a CSV/Excel to get started.</Text>
              </div>
            }
          >
            <Button type="primary" onClick={() => setUploadOpen(true)}>
              Upload dataset
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={filtered}
            rowKey="id"
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            columns={[
              {
                title: "Title",
                dataIndex: "title",
                render: (v, rec) => (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <Text strong>{v}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {rec.original_filename}
                    </Text>
                  </div>
                ),
              },
              {
                title: "Info",
                render: (_, r) => (
                  <Space size="small">
                    <Tag>{fmtBytes(r.file_size_bytes)}</Tag>
                    {r.n_rows != null && r.n_cols != null ? (
                      <Tag color="processing">
                        {r.n_rows}×{r.n_cols}
                      </Tag>
                    ) : (
                      <Tag>—</Tag>
                    )}
                  </Space>
                ),
                width: 160,
              },
              {
                title: "Created",
                dataIndex: "created_at",
                render: (v) => new Date(v).toLocaleString(),
                width: 190,
              },
              {
                title: "",
                align: "right",
                width: 120,
                render: (_, r) => (
                  <Popconfirm
                    title="Delete dataset?"
                    okType="danger"
                    onConfirm={() => remove(r.id)}
                  >
                    <Button icon={<DeleteOutlined />} danger ghost />
                  </Popconfirm>
                ),
              },
            ]}
          />
        )}
      </div>

      <DatasetUpload
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onCreated={(item) => setRows((r) => [item, ...(r || [])])}
      />
    </AppShell>
  );
}

function CardLikeLoader() {
  return (
    <div className="card" style={{ padding: 16 }}>
      <Skeleton active paragraph={{ rows: 2 }} />
      <Skeleton active paragraph={{ rows: 3 }} />
    </div>
  );
}
