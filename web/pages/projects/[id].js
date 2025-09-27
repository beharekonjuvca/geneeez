import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
import AppShell from "../../components/AppShell";
import {
  getProject,
  updateProject,
  deleteProject,
} from "../../lib/api/projects";

const { Title, Text } = Typography;

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await getProject(id, { include_counts: true });
      setProject(data);
    } catch (e) {
      console.error(e);
      message.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) load();
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <Skeleton active paragraph={{ rows: 8 }} />
      </AppShell>
    );
  }
  if (!project) {
    return (
      <AppShell>
        <Text type="secondary">Project not found</Text>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/projects")}
          style={{ marginRight: 12 }}
        />
        <Title level={3} style={{ margin: 0 }}>
          {project.name}
        </Title>
      </div>

      <Card style={{ borderRadius: 16, marginBottom: 16 }}>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Name">{project.name}</Descriptions.Item>
          <Descriptions.Item label="Description">
            {project.description || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Counts">
            <Space>
              <Tag>datasets: {project.dataset_count ?? 0}</Tag>
              <Tag color="processing">
                analyses: {project.analysis_count ?? 0}
              </Tag>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {project.created_at
              ? new Date(project.created_at).toLocaleString()
              : "—"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Space>
        <Button
          icon={<EditOutlined />}
          onClick={() => router.push("/projects")}
        >
          Edit
        </Button>
      </Space>
    </AppShell>
  );
}
