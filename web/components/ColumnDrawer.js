import { Drawer, Descriptions, Typography, Space, Button, Tag } from "antd";
const { Text } = Typography;

export default function ColumnDrawer({ open, onClose, column }) {
  if (!column) return null;

  return (
    <Drawer
      title={
        <span>
          Column: <strong>{column.name}</strong>
        </span>
      }
      open={open}
      onClose={onClose}
      width={420}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Descriptions size="small" column={1} bordered>
          <Descriptions.Item label="Type">
            <Tag>{column.dtype}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Role">
            <Tag color="blue">{column.role}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Missing">
            {column.missing} ({column.missing_pct}%)
          </Descriptions.Item>
          <Descriptions.Item label="Unique values">
            {column.unique_count}
          </Descriptions.Item>
        </Descriptions>

        <div>
          <Text type="secondary">Quick actions (coming next):</Text>
          <div style={{ marginTop: 8 }}>
            <Space wrap>
              <Button disabled>Filter</Button>
              <Button disabled>Describe</Button>
              <Button disabled>Plot distribution</Button>
              <Button danger disabled>
                Drop column
              </Button>
            </Space>
          </div>
        </div>
      </Space>
    </Drawer>
  );
}
