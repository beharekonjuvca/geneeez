import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Skeleton,
  message,
} from "antd";
import {
  DatabaseOutlined,
  ProjectOutlined,
  ExperimentOutlined,
  UserOutlined,
  PlusOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { getStatsSummary } from "../lib/api/dashboard";

const { Title, Text } = Typography;

function StatCard({ title, value, icon }) {
  return (
    <Card hoverable style={{ borderRadius: 16 }}>
      <Space align="center" size="large">
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: "grid",
            placeItems: "center",
            background: "var(--ant-color-fill-secondary, #f5f5f5)",
          }}
        >
          {icon}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {title}
          </Text>
          <div>
            <Statistic value={value ?? 0} valueStyle={{ fontWeight: 700 }} />
          </div>
        </div>
      </Space>
    </Card>
  );
}

function StatusTag({ status }) {
  const c =
    status === "succeeded"
      ? "green"
      : status === "failed"
      ? "red"
      : status === "running"
      ? "processing"
      : "default";
  return <Tag color={c}>{status}</Tag>;
}

export default function Dashboard() {
  const { user, initializing } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!initializing && !user) router.replace("/");
  }, [initializing, user, router]);

  useEffect(() => {
    if (initializing || !user) return;
    (async () => {
      try {
        setLoading(true);
        const data = await getStatsSummary();
        setStats(data);
      } catch (e) {
        console.error(e);
        message.error("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    })();
  }, [initializing, user]);

  const counts = stats?.counts || {};

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
            Dashboard
          </Title>
          <Space>
            <Button
              type="default"
              icon={<UserOutlined />}
              onClick={() => router.push("/profile")}
            >
              Profile
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push("/datasets")}
            >
              New dataset
            </Button>
          </Space>
        </div>

        {/* Stats */}
        {loading ? (
          <Row gutter={[16, 16]}>
            {[...Array(3)].map((_, i) => (
              <Col xs={24} md={8} key={i}>
                <Card style={{ borderRadius: 16 }}>
                  <Skeleton active paragraph={{ rows: 1 }} />
                </Card>
              </Col>
            ))}
          </Row>
        ) : (
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <StatCard
                title="Datasets"
                value={counts.datasets}
                icon={<DatabaseOutlined />}
              />
            </Col>
            <Col xs={24} md={8}>
              <StatCard
                title="Analyses"
                value={counts.analyses}
                icon={<ExperimentOutlined />}
              />
            </Col>
            <Col xs={24} md={8}>
              <StatCard
                title="Projects"
                value={counts.projects}
                icon={<ProjectOutlined />}
              />
            </Col>
          </Row>
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title="Recent datasets"
              extra={
                <Button type="link" onClick={() => router.push("/datasets")}>
                  View all <ArrowRightOutlined />
                </Button>
              }
              style={{ borderRadius: 16 }}
              bodyStyle={{ paddingTop: 0 }}
            >
              {loading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : (
                <Table
                  size="middle"
                  rowKey="id"
                  pagination={false}
                  dataSource={stats?.latest_datasets || []}
                  onRow={(rec) => ({
                    onClick: () => router.push(`/datasets/${rec.id}`),
                    style: { cursor: "pointer" },
                  })}
                  columns={[
                    { title: "Title", dataIndex: "title" },
                    {
                      title: "Shape",
                      render: (_, r) =>
                        r.n_rows != null && r.n_cols != null ? (
                          <Tag color="processing">
                            {r.n_rows}×{r.n_cols}
                          </Tag>
                        ) : (
                          "—"
                        ),
                      width: 120,
                    },
                    {
                      title: "Created",
                      dataIndex: "created_at",
                      render: (v) => new Date(v).toLocaleString(),
                      width: 180,
                    },
                  ]}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card
              title="Recent analyses"
              extra={
                <Button type="link" onClick={() => router.push("/analyses")}>
                  View all <ArrowRightOutlined />
                </Button>
              }
              style={{ borderRadius: 16 }}
              bodyStyle={{ paddingTop: 0 }}
            >
              {loading ? (
                <Skeleton active paragraph={{ rows: 5 }} />
              ) : (
                <Table
                  size="middle"
                  rowKey="id"
                  pagination={false}
                  dataSource={stats?.latest_analyses || []}
                  onRow={(rec) => ({
                    onClick: () => router.push(`/analyses`),
                    style: { cursor: "pointer" },
                  })}
                  columns={[
                    { title: "Recipe", dataIndex: "recipe_key", width: 160 },
                    { title: "Dataset", dataIndex: "dataset_id", width: 100 },
                    {
                      title: "Status",
                      dataIndex: "status",
                      render: (s) => <StatusTag status={s} />,
                      width: 120,
                    },
                    {
                      title: "Created",
                      dataIndex: "created_at",
                      render: (v) => new Date(v).toLocaleString(),
                      width: 180,
                    },
                  ]}
                />
              )}
            </Card>
          </Col>
        </Row>

        <Card
          title="Recent projects"
          extra={
            <Button type="link" onClick={() => router.push("/projects")}>
              View all <ArrowRightOutlined />
            </Button>
          }
          style={{ borderRadius: 16 }}
          bodyStyle={{ paddingTop: 0 }}
        >
          {loading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : (
            <Table
              size="middle"
              rowKey="id"
              pagination={false}
              dataSource={stats?.latest_projects || []}
              onRow={(rec) => ({
                onClick: () => router.push(`/projects`),
                style: { cursor: "pointer" },
              })}
              columns={[
                { title: "Name", dataIndex: "name" },
                {
                  title: "Created",
                  dataIndex: "created_at",
                  render: (v) => new Date(v).toLocaleString(),
                  width: 180,
                },
              ]}
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
