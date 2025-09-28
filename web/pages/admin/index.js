import { useEffect, useState, useMemo } from "react";
import {
  Card,
  Typography,
  Row,
  Col,
  Space,
  Table,
  Tag,
  Input,
  Select,
  InputNumber,
  DatePicker,
  message,
  Spin,
  Button,
} from "antd";
import { useRouter } from "next/router";
import AppShell from "../../components/AppShell";
import RequireAdmin from "../../components/RequireAdmin";
import { adminStatsOverview, adminStatsLogs } from "../../lib/api/admin_stats";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function dateOnly(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : undefined;
}

export default function AdminStats() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [days, setDays] = useState(7);

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [q, setQ] = useState("");
  const [action, setAction] = useState();
  const [entity, setEntity] = useState();
  const [userId, setUserId] = useState();
  const [dateRange, setDateRange] = useState();

  const [orderBy, setOrderBy] = useState("created_at");
  const [direction, setDirection] = useState("desc");

  const { date_from, date_to } = useMemo(() => {
    if (!dateRange || !Array.isArray(dateRange) || dateRange.length !== 2) {
      return { date_from: undefined, date_to: undefined };
    }
    const [start, end] = dateRange;
    const s = start?.toDate ? start.toDate() : start;
    const e = end?.toDate ? end.toDate() : end;
    return {
      date_from: s ? dateOnly(s) : undefined,
      date_to: e ? dateOnly(e) : undefined,
    };
  }, [dateRange]);

  async function loadOverview() {
    try {
      const data = await adminStatsOverview({ days });
      setOverview(data);
    } catch (e) {
      message.error(e?.response?.data?.detail || "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const data = await adminStatsLogs({
        limit: 100,
        q: q || undefined,
        action: action || undefined,
        entity: entity || undefined,
        user_id: userId || undefined,
        date_from,
        date_to,
        order_by: orderBy,
        direction,
      });
      setLogs(data);
    } catch (e) {
      message.error(e?.response?.data?.detail || "Failed to load logs");
    } finally {
      setLogsLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadOverview();
  }, [days]);

  useEffect(() => {
    loadLogs();
  }, [q, action, entity, userId, date_from, date_to, orderBy, direction]);

  function onLogsTableChange(_pagination, _filters, sorter) {
    if (sorter && sorter.field) {
      setOrderBy(sorter.field);
      setDirection(sorter.order === "ascend" ? "asc" : "desc");
    }
  }

  function clearLogFilters() {
    setQ("");
    setAction(undefined);
    setEntity(undefined);
    setUserId(undefined);
    setDateRange(undefined);
    setOrderBy("created_at");
    setDirection("desc");
  }

  return (
    <AppShell>
      <RequireAdmin>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <Title level={3} style={{ margin: 0 }}>
            Admin · Stats
          </Title>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card
                className="card"
                onClick={() => router.push("/admin/users")}
                style={{ cursor: "pointer" }}
                hoverable
              >
                <Text type="secondary">Users</Text>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                  {loading ? (
                    <Spin size="small" />
                  ) : (
                    overview?.totals?.users ?? 0
                  )}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Click to manage users
                </Text>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="card">
                <Text type="secondary">Datasets</Text>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                  {loading ? (
                    <Spin size="small" />
                  ) : (
                    overview?.totals?.datasets ?? 0
                  )}
                </div>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="card">
                <Text type="secondary">Analysis Runs</Text>
                <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>
                  {loading ? (
                    <Spin size="small" />
                  ) : (
                    overview?.totals?.analysis_runs ?? 0
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          <Card
            className="card"
            title={
              <Space>
                <span>Trends</span>
                <Select
                  value={days}
                  onChange={setDays}
                  options={[
                    { label: "Last 7 days", value: 7 },
                    { label: "Last 14 days", value: 14 },
                    { label: "Last 30 days", value: 30 },
                  ]}
                  size="small"
                />
              </Space>
            }
          >
            {loading ? (
              <Spin />
            ) : (
              <Row gutter={[16, 16]}>
                {["users", "datasets", "analysis_runs"].map((k) => (
                  <Col xs={24} md={8} key={k}>
                    <Text strong style={{ display: "block", marginBottom: 8 }}>
                      {k === "analysis_runs"
                        ? "Analysis Runs"
                        : k[0].toUpperCase() + k.slice(1)}
                    </Text>
                    <Space wrap>
                      {(overview?.trends?.[k] || []).map((p) => (
                        <Tag key={String(p.bucket)}>{`${new Date(
                          p.bucket
                        ).toLocaleDateString()} • ${p.count}`}</Tag>
                      ))}
                    </Space>
                  </Col>
                ))}
              </Row>
            )}
          </Card>

          <Card
            className="card"
            title={<span>Recent Events</span>}
            extra={
              <Space wrap>
                <Input
                  allowClear
                  placeholder="Search (action, entity, email)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ width: 240 }}
                />
                <Input
                  allowClear
                  placeholder="Action (e.g., login, upload, delete)"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  style={{ width: 200 }}
                />
                <Input
                  allowClear
                  placeholder="Entity (e.g., user, dataset, run)"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  style={{ width: 200 }}
                />
                <InputNumber
                  placeholder="User ID"
                  value={userId}
                  onChange={setUserId}
                  style={{ width: 120 }}
                />
                <RangePicker
                  value={dateRange}
                  onChange={setDateRange}
                  allowClear
                />
                <Button onClick={clearLogFilters}>Clear</Button>
              </Space>
            }
          >
            <Table
              rowKey="id"
              loading={logsLoading}
              dataSource={logs}
              pagination={{ pageSize: 10 }}
              onChange={onLogsTableChange}
              columns={[
                {
                  title: "ID",
                  dataIndex: "id",
                  width: 100,
                  sorter: true,
                  sortOrder:
                    orderBy === "id"
                      ? direction === "asc"
                        ? "ascend"
                        : "descend"
                      : null,
                },
                {
                  title: "User",
                  dataIndex: "user_email",
                  render: (v, r) => v || r.user_id || "—",
                },
                {
                  title: "Action",
                  dataIndex: "action",
                  width: 140,
                  sorter: true,
                  sortOrder:
                    orderBy === "action"
                      ? direction === "asc"
                        ? "ascend"
                        : "descend"
                      : null,
                },
                {
                  title: "Entity",
                  dataIndex: "entity",
                  width: 140,
                  sorter: true,
                  sortOrder:
                    orderBy === "entity"
                      ? direction === "asc"
                        ? "ascend"
                        : "descend"
                      : null,
                },
                { title: "Entity ID", dataIndex: "entity_id", width: 120 },
                {
                  title: "When",
                  dataIndex: "created_at",
                  width: 220,
                  sorter: true,
                  sortOrder:
                    orderBy === "created_at"
                      ? direction === "asc"
                        ? "ascend"
                        : "descend"
                      : null,
                  render: (v) => new Date(v).toLocaleString(),
                },
                { title: "IP", dataIndex: "ip", width: 160 },
                { title: "UA", dataIndex: "user_agent", ellipsis: true },
              ]}
            />
          </Card>
        </Space>
      </RequireAdmin>
    </AppShell>
  );
}
