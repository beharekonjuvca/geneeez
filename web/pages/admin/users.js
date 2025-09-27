import { useEffect, useState } from "react";
import { Table, Input, Select, Space, Typography, message } from "antd";
import AppShell from "../../components/AppShell";
import RequireAdmin from "../../components/RequireAdmin";
import {
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  adminCreateUser,
} from "../../lib/api/adminUsers";

const { Title } = Typography;

export default function AdminUsers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState();

  async function load() {
    setLoading(true);
    try {
      const data = await adminListUsers({
        q: q || undefined,
        role: role || undefined,
        order_by: "created_at",
        direction: "desc",
        limit: 100,
      });
      setRows(data);
    } catch {
      message.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [q, role]);

  return (
    <AppShell>
      <RequireAdmin>
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <Title level={3} style={{ margin: 0 }}>
            Admin · Users
          </Title>

          <Space wrap>
            <Input
              placeholder="Search email or id"
              allowClear
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select
              allowClear
              placeholder="Role"
              value={role}
              onChange={setRole}
              options={[
                { label: "admin", value: "admin" },
                { label: "user", value: "user" },
              ]}
              style={{ width: 140 }}
            />
          </Space>

          <Table
            rowKey="id"
            loading={loading}
            dataSource={rows}
            pagination={{ pageSize: 10 }}
            columns={[
              { title: "ID", dataIndex: "id", width: 90 },
              { title: "Email", dataIndex: "email" },
              { title: "Role", dataIndex: "role" },
              {
                title: "Created",
                dataIndex: "created_at",
                render: (v) => new Date(v).toLocaleString(),
                width: 200,
              },
            ]}
          />
        </Space>
      </RequireAdmin>
    </AppShell>
  );
}
