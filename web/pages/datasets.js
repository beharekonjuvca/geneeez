// pages/datasets.js
import { useEffect, useState } from "react";
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
  Select,
  InputNumber,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ProjectOutlined,
} from "@ant-design/icons";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import DatasetUpload from "../components/DatasetUpload";
import { listDatasets, deleteDataset } from "../lib/api/datasets";
import { listProjects } from "../lib/api/projects"; // <-- new

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
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [orderBy, setOrderBy] = useState("created_at");
  const [direction, setDirection] = useState("desc");
  const [minRows, setMinRows] = useState(null);

  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(null);

  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    if (!initializing && !user) router.replace("/");
  }, [initializing, user, router]);

  useEffect(() => {
    if (initializing || !user) return;
    (async () => {
      try {
        const data = await listProjects({
          order_by: "name",
          direction: "asc",
          include_counts: false,
          limit: 500,
        });
        setProjects(data);
      } catch {
        // non-fatal
      }
    })();
  }, [initializing, user]);

  async function fetchDatasets() {
    if (initializing || !user) return;
    setLoading(true);
    try {
      const data = await listDatasets({
        q,
        order_by: orderBy,
        direction,
        min_rows: minRows,
        project_id: projectId || undefined,
        limit: 50,
      });
      setRows(data);
    } catch {
      message.error("Failed to load datasets");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDatasets();
  }, [q, orderBy, direction, initializing, user, minRows, projectId]);

  function handleTableChange(_pagination, _filters, sorter) {
    if (sorter.field) {
      setOrderBy(sorter.field);
      setDirection(sorter.order === "ascend" ? "asc" : "desc");
    }
  }

  async function remove(id) {
    const prev = rows;
    setRows((r) => (r || []).filter((x) => x.id !== id));
    try {
      await deleteDataset(id);
      message.success("Dataset deleted");
    } catch {
      message.error("Delete failed");
      setRows(prev);
    }
  }

  return (
    <AppShell>
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            Datasets
          </Title>
          <Space wrap>
            <Select
              allowClear
              placeholder="Project"
              value={projectId}
              onChange={setProjectId}
              style={{ width: 180 }}
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
              suffixIcon={<ProjectOutlined />}
            />
            <InputNumber
              placeholder="Min rows"
              value={minRows}
              onChange={setMinRows}
              style={{ width: 120 }}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search datasets"
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
                <div style={{ marginBottom: 8 }}>No datasets found</div>
                <Text type="secondary">
                  Try clearing filters or upload a new dataset.
                </Text>
              </div>
            }
          >
            <Button type="primary" onClick={() => setUploadOpen(true)}>
              Upload dataset
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={rows || []}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 8, hideOnSinglePage: true }}
            onChange={handleTableChange}
            columns={[
              {
                title: "Title",
                dataIndex: "title",
                sorter: true,
                render: (v, rec) => (
                  <div>
                    <a onClick={() => router.push(`/datasets/${rec.id}`)}>
                      <Text strong>{v}</Text>
                    </a>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {rec.original_filename}
                      </Text>
                    </div>
                  </div>
                ),
              },
              {
                title: "Info",
                render: (_, r) => (
                  <Space>
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
                width: 180,
              },
              {
                title: "Created",
                dataIndex: "created_at",
                sorter: true,
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
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      ghost
                      onClick={(e) => e.stopPropagation()}
                    />
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
