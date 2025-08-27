import { Card, Row, Col } from "antd";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DataVisualizer({ dataset }) {
  if (!dataset?.preview_data) return null;
  const columns = dataset.preview_data.columns || [];
  const rows = dataset.preview_data.rows || [];
  const numericalColumns = columns.filter((col) =>
    rows.some((row) => typeof row[columns.indexOf(col)] === "number")
  );

  const data = rows.slice(0, 10).map((row, i) => ({
    name: `Row ${i + 1}`,
    ...Object.fromEntries(
      numericalColumns.map((col) => [col, row[columns.indexOf(col)]])
    ),
  }));

  return (
    <div style={{ padding: "20px 0" }}>
      <Row gutter={[16, 16]}>
        {numericalColumns.map((col) => (
          <Col span={12} key={col}>
            <Card title={col}>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey={col} fill="#1890ff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
