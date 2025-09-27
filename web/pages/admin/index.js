import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Typography, Row, Col, Statistic, Space, message } from "antd";
import AppShell from "../../components/AppShell";
import RequireAdmin from "../../components/RequireAdmin";
import { adminCountUsers } from "../../lib/api/adminUsers";
import { getStatsSummary } from "../../lib/api/dashboard";

const { Title, Text } = Typography;

export default function AdminHome() {
  const [counts, setCounts] = useState({
    users: 0,
    datasets: 0,
    analyses: 0,
    projects: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [{ count }, summary] = await Promise.all([
          adminCountUsers(),
          getStatsSummary(),
        ]);
        setCounts({
          users: count,
          datasets: summary.counts.datasets,
          analyses: summary.counts.analyses,
          projects: summary.counts.projects ?? 0,
        });
      } catch {
        message.error("Failed to load admin summary");
      }
    })();
  }, []);

  return (
    <AppShell>
      <RequireAdmin>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Title level={3} style={{ margin: 0 }}>
            Admin
          </Title>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card className="card">
                <Statistic title="Users" value={counts.users} />
                <div style={{ marginTop: 12 }}>
                  <Link href="/admin/users">Manage users →</Link>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="card">
                <Statistic title="Datasets" value={counts.datasets} />
                <div style={{ marginTop: 12 }}>
                  <Link href="/datasets">View datasets →</Link>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="card">
                <Statistic title="Analyses" value={counts.analyses} />
                <div style={{ marginTop: 12 }}>
                  <Link href="/analysis-runs">View analyses →</Link>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card className="card">
                <Statistic title="Projects" value={counts.projects} />
                <div style={{ marginTop: 12 }}>
                  <Link href="/projects">View projects →</Link>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card className="card" title="Quick links">
                <Space direction="vertical">
                  <Link href="/admin/users">Users</Link>
                </Space>
              </Card>
            </Col>
          </Row>
        </Space>
      </RequireAdmin>
    </AppShell>
  );
}
