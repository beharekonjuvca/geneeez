import { useMemo, useState } from "react";
import { Input, List, Tag, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";

const { Text } = Typography;

export default function ColumnPanel({ schema, onPick }) {
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    if (!schema?.columns) return [];
    const needle = q.trim().toLowerCase();
    if (!needle) return schema.columns;
    return schema.columns.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.dtype.toLowerCase().includes(needle) ||
        (c.role || "").toLowerCase().includes(needle)
    );
  }, [schema, q]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <Input
        size="middle"
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search columns"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div style={{ fontSize: 12, color: "#6b7280" }}>
        {schema?.columns?.length ?? 0} total • {items.length} shown
      </div>
      <div style={{ overflow: "auto", height: "calc(100vh - 220px)" }}>
        <List
          dataSource={items}
          renderItem={(c) => (
            <List.Item
              style={{ cursor: "pointer", padding: "8px 4px" }}
              onClick={() => onPick?.(c)}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <Text strong style={{ lineHeight: 1 }}>
                  {c.name}
                </Text>
                <div style={{ display: "flex", gap: 6 }}>
                  <Tag>{c.dtype}</Tag>
                  <Tag color="blue">{c.role}</Tag>
                </div>
              </div>
            </List.Item>
          )}
        />
      </div>
    </div>
  );
}
