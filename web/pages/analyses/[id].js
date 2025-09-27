import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import {
  Card,
  Descriptions,
  Spin,
  Tag,
  Typography,
  message,
  Button,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import AppShell from "../../components/AppShell";
import { getAnalysisRun } from "../../lib/api/analysis_runs";

const { Title, Text } = Typography;

export default function AnalysisRunDetail() {
  const router = useRouter();
  const { id } = router.query;

  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await getAnalysisRun(id);
        setRun(data);
      } catch (err) {
        console.error(err);
        message.error("Failed to load analysis run");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  function statusTag(status) {
    const colors = {
      queued: "default",
      running: "processing",
      succeeded: "success",
      failed: "error",
      canceled: "warning",
    };
    return <Tag color={colors[status] || "default"}>{status}</Tag>;
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
          <Spin size="large" />
        </div>
      </AppShell>
    );
  }

  if (!run) {
    return (
      <AppShell>
        <div style={{ padding: 24 }}>
          <Text type="secondary">Analysis run not found</Text>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/analyses")}
          style={{ marginRight: 12 }}
        />
        <Title level={3} style={{ margin: 0 }}>
          Analysis Run #{run.id}
        </Title>
      </div>

      <Card>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Recipe">{run.recipe_key}</Descriptions.Item>
          <Descriptions.Item label="Dataset ID">
            {run.dataset_id}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            {statusTag(run.status)}
          </Descriptions.Item>
          <Descriptions.Item label="Cache Key">
            {run.cache_key || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Cache Hit">
            {run.cache_hit ? "Yes" : "No"}
          </Descriptions.Item>
          <Descriptions.Item label="Started At">
            {run.started_at ? new Date(run.started_at).toLocaleString() : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Finished At">
            {run.finished_at ? new Date(run.finished_at).toLocaleString() : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {run.created_at ? new Date(run.created_at).toLocaleString() : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Error">
            {run.error_message || "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Parameters">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(run.params_json, null, 2)}
            </pre>
          </Descriptions.Item>
          <Descriptions.Item label="Artifacts">
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(run.artifacts_json, null, 2)}
            </pre>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </AppShell>
  );
}
