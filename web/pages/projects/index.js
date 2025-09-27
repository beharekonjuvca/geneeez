import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Skeleton,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../../lib/api/projects";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function ProjectsPage() {
  const router = useRouter();
  const { user, initializing } = useAuth();

  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [range, setRange] = useState(null);
  const [orderBy, setOrderBy] = useState("created_at");
  const [direction, setDirection] = useState("desc");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!initializing && !user) router.replace("/");
  }, [initializing, user, router]);

  async function fetchData() {
    if (initializing || !user) return;
    setLoading(true);
    try {
      const params = {
        q,
        order_by: orderBy,
        direction,
        include_counts: true,
        limit: 200,
      };
      if (range) {
        params.created_from = range[0].toISOString();
        params.created_to = range[1].toISOString();
      }
      const data = await listProjects(params);
      setRows(data);
    } catch (e) {
      console.error(e);
      message.error("Failed to load projects");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [q, range, orderBy, direction, initializing, user]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }
  function openEdit(record) {
    setEditing(record);
    form.setFieldsValue({ name: record.name, description: record.description });
    setModalOpen(true);
  }

  async function submitForm() {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateProject(editing.id, values);
        message.success("Project updated");
      } else {
        await createProject(values);
        message.success("Project created");
      }
      setModalOpen(false);
      fetchData();
    } catch (e) {
      if (e?.errorFields) return;
      message.error("Save failed");
    }
  }

  async function removeProject(id) {
    try {
      await deleteProject(id);
      message.success("Project deleted");
      setRows((r) => (r || []).filter((x) => x.id !== id));
    } catch {
      message.error("Delete failed");
    }
  }

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (v, rec) => (
        <a onClick={() => router.push(`/projects/${rec.id}`)}>
          <Text strong>{v}</Text>
        </a>
      ),
    },
    {
      title: "Counts",
      render: (_, r) => (
        <Space size="small">
          <Tag icon={null}>datasets: {r.dataset_count ?? 0}</Tag>
          <Tag color="processing">analyses: {r.analysis_count ?? 0}</Tag>
        </Space>
      ),
      width: 210,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      render: (v) => new Date(v).toLocaleString(),
      width: 190,
    },
    {
      title: "",
      align: "right",
      width: 150,
      render: (_, r) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm
            title="Delete project?"
            okType="danger"
            onConfirm={() => removeProject(r.id)}
          >
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppShell>
      <div style={{ display: "grid", gap: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Title level={3} style={{ margin: 0 }}>
            Projects
          </Title>
          <Space wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search name/description"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: 260 }}
            />
            <RangePicker onChange={setRange} allowClear />
            <Select
              value={orderBy}
              onChange={setOrderBy}
              options={[
                { label: "Sort by created", value: "created_at" },
                { label: "Sort by name", value: "name" },
                { label: "Sort by datasets", value: "dataset_count" },
                { label: "Sort by analyses", value: "analysis_count" },
              ]}
              style={{ width: 170 }}
            />
            <Select
              value={direction}
              onChange={setDirection}
              options={[
                { label: "Desc", value: "desc" },
                { label: "Asc", value: "asc" },
              ]}
              style={{ width: 100 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              New project
            </Button>
          </Space>
        </div>

        <Card style={{ borderRadius: 16 }}>
          {rows === null ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : (
            <Table
              dataSource={rows}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              columns={columns}
            />
          )}
        </Card>
      </div>

      <Modal
        title={editing ? "Edit project" : "New project"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submitForm}
        okText={editing ? "Save" : "Create"}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: "Please input a name" }]}
          >
            <Input placeholder="Project name" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea
              placeholder="Optional description"
              autoSize={{ minRows: 3 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </AppShell>
  );
}
