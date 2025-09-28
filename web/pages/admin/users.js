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
  const [orderBy, setOrderBy] = useState("created_at");
  const [direction, setDirection] = useState("desc");

  async function load() {
    setLoading(true);
    try {
      const data = await adminListUsers({
        q: q || undefined,
        role: role || undefined,
        order_by: orderBy,
        direction,
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
  }, [q, role, orderBy, direction]);

  function handleTableChange(_pagination, _filters, sorter) {
    if (sorter && sorter.field) {
      setOrderBy(sorter.field);
      setDirection(sorter.order === "ascend" ? "asc" : "desc");
    }
  }

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
            onChange={handleTableChange}
            columns={[
              {
                title: "ID",
                dataIndex: "id",
                width: 90,
                sorter: true,
                sortOrder:
                  orderBy === "id"
                    ? direction === "asc"
                      ? "ascend"
                      : "descend"
                    : null,
              },
              {
                title: "Email",
                dataIndex: "email",
                sorter: true,
                sortOrder:
                  orderBy === "email"
                    ? direction === "asc"
                      ? "ascend"
                      : "descend"
                    : null,
              },
              { title: "Role", dataIndex: "role" },
              {
                title: "Created",
                dataIndex: "created_at",
                sorter: true,
                sortOrder:
                  orderBy === "created_at"
                    ? direction === "asc"
                      ? "ascend"
                      : "descend"
                    : null,
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
