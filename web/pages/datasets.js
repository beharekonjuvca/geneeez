import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Table, Button, Typography, message, Spin } from "antd";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const { Title } = Typography;

export default function Datasets() {
  const { user, initializing } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!initializing && !user) router.replace("/");
  }, [initializing, user, router]);

  useEffect(() => {
    if (initializing || !user) return;
    api
      .get("/health")
      .then(() => {
        setRows([{ key: 1, title: "Example dataset" }]);
      })
      .catch(() => message.error("API down?"));
  }, [initializing, user]);

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
      <Title level={3}>Datasets</Title>
      <p>Upload & analyze will appear here next.</p>
      <Table
        dataSource={rows}
        columns={[{ title: "Title", dataIndex: "title" }]}
        rowKey="key"
      />
      <Button type="primary" disabled>
        Upload (coming next)
      </Button>
    </AppShell>
  );
}
