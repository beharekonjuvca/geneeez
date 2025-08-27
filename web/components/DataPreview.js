import { Table } from "antd";
import { useEffect, useState } from "react";

export default function DataPreview({ dataset }) {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (dataset?.preview_data) {
      const rows = dataset.preview_data.rows || [];
      const cols = dataset.preview_data.columns || [];

      setColumns(
        cols.map((col) => ({
          title: col,
          dataIndex: col,
          key: col,
          ellipsis: true,
        }))
      );

      setData(
        rows.map((row, i) => ({
          key: i,
          ...Object.fromEntries(cols.map((col, j) => [col, row[j]])),
        }))
      );
    }
    setLoading(false);
  }, [dataset]);

  return (
    <Table
      columns={columns}
      dataSource={data}
      loading={loading}
      scroll={{ x: true }}
      pagination={{
        pageSize: 10,
        showSizeChanger: true,
        showTotal: (total) => `${total} rows`,
      }}
    />
  );
}
