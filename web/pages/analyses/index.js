import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Table,
  Card,
  Space,
  Typography,
  Input,
  Select,
  DatePicker,
  Button,
  Tag,
  message,
} from "antd";
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import { listAnalysisRuns } from "../../lib/api/analysis_runs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function StatusTag({ s }) {
  const color =
    s === "succeeded"
      ? "green"
      : s === "failed"
      ? "red"
      : s === "running"
      ? "processing"
      : s === "queued"
      ? "default"
      : "default";
  return <Tag color={color}>{s}</Tag>;
}

export default function AnalysesIndex() {
  const router = useRouter();
  const { user, initializing } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState(undefined);
  const [recipe, setRecipe] = useState(undefined);
  const [datasetId, setDatasetId] = useState("");
  const [dateRange, setDateRange] = useState(null);
  const [orderBy, setOrderBy] = useState("created_at");
  const [direction, setDirection] = useState("desc");

  useEffect(() => {
    if (!initializing && !user) router.replace("/");
  }, [initializing, user, router]);

  async function fetchData() {
    try {
      setLoading(true);
      const params = {
        q: q || undefined,
        status: status || undefined,
        recipe_key: recipe || undefined,
        dataset_id: datasetId || undefined,
        created_from: dateRange?.[0]?.format("YYYY-MM-DD"),
        created_to: dateRange?.[1]?.format("YYYY-MM-DD"),
        order_by: orderBy,
        direction,
        limit: 100,
      };
      const data = await listAnalysisRuns(params);
      setRows(data);
    } catch (e) {
      console.error(e);
      message.error("Failed to load analyses");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!initializing && user) fetchData();
  }, [initializing, user]);

  const columns = useMemo(
    () => [
      {
        title: "Recipe",
        dataIndex: "recipe_key",
        width: 160,
      },
      {
        title: "Dataset",
        dataIndex: "dataset_id",
        width: 100,
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (s) => <StatusTag s={s} />,
        width: 130,
      },
      {
        title: "Cache",
        render: (_, r) =>
          r.cache_hit ? <Tag color="green">hit</Tag> : <Tag>miss</Tag>,
        width: 90,
      },
      {
        title: "Started",
        dataIndex: "started_at",
        render: (v) => (v ? new Date(v).toLocaleString() : "—"),
        width: 190,
      },
      {
        title: "Created",
        dataIndex: "created_at",
        render: (v) => new Date(v).toLocaleString(),
        width: 190,
        sorter: true,
      },
    ],
    []
  );

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
            Analyses
          </Title>
          <Space wrap>
            <Input
              allowClear
              style={{ width: 260 }}
              prefix={<SearchOutlined />}
              placeholder="Search recipe/cache key"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onPressEnter={fetchData}
            />
            <Select
              allowClear
              placeholder="Status"
              value={status}
              onChange={setStatus}
              style={{ width: 140 }}
              options={[
                { value: "queued", label: "queued" },
                { value: "running", label: "running" },
                { value: "succeeded", label: "succeeded" },
                { value: "failed", label: "failed" },
                { value: "canceled", label: "canceled" },
              ]}
            />
            <Input
              allowClear
              placeholder="Recipe (e.g. pca)"
              style={{ width: 160 }}
              value={recipe}
              onChange={(e) => setRecipe(e.target.value)}
              onPressEnter={fetchData}
            />
            <Input
              allowClear
              placeholder="Dataset ID"
              style={{ width: 140 }}
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              onPressEnter={fetchData}
            />
            <RangePicker value={dateRange} onChange={setDateRange} />
            <Select
              value={orderBy}
              onChange={setOrderBy}
              style={{ width: 150 }}
              options={[
                { value: "created_at", label: "Created" },
                { value: "started_at", label: "Started" },
              ]}
            />
            <Select
              value={direction}
              onChange={setDirection}
              style={{ width: 110 }}
              options={[
                { value: "desc", label: "desc" },
                { value: "asc", label: "asc" },
              ]}
            />
            <Button onClick={fetchData} icon={<ReloadOutlined />}>
              Apply
            </Button>
          </Space>
        </div>

        <Card style={{ borderRadius: 16 }} bodyStyle={{ paddingTop: 0 }}>
          <Table
            size="middle"
            rowKey="id"
            loading={loading}
            dataSource={rows}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            onRow={(rec) => ({
              onClick: () => router.push(`/analyses/${rec.id}`),
              style: { cursor: "pointer" },
            })}
            columns={columns}
          />
        </Card>
      </div>
    </AppShell>
  );
}
