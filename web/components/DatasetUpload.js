import { useState } from "react";
import { Modal, Form, Input, Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { uploadDataset } from "../lib/api/datasets";

const { Dragger } = Upload;

const EXT_WHITELIST = [
  ".csv",
  ".tsv",
  ".txt",
  ".parquet",
  ".pq",
  ".xls",
  ".xlsx",
  ".csv.gz",
  ".tsv.gz",
  ".txt.gz",
  ".parquet.gz",
  ".pq.gz",
];

const MIME_WHITELIST = [
  "text/plain",
  "text/csv",
  "application/gzip",
  "application/x-gzip",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
];

const ACCEPT = ".csv,.tsv,.txt,.parquet,.pq,.xls,.xlsx,.gz";

export default function DatasetUpload({ open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const props = {
    name: "file",
    multiple: false,
    maxCount: 1,
    accept: ACCEPT,
    beforeUpload: (f) => {
      const name = (f.name || "").toLowerCase();
      const okExt = EXT_WHITELIST.some((ext) => name.endsWith(ext));
      const okMime = MIME_WHITELIST.includes(f.type);

      if (!okExt && !okMime) {
        message.error(
          "Unsupported file type. Use CSV/TSV/TXT/Parquet/XLS(X) — optionally .gz"
        );
        return Upload.LIST_IGNORE;
      }
      setFile(f);
      return false;
    },
    onRemove: () => setFile(null),
  };

  async function submit() {
    try {
      const values = await form.validateFields();
      if (!file) {
        message.error("Please attach a file");
        return;
      }
      setSubmitting(true);
      const created = await uploadDataset({
        title: values.title,
        description: values.description,
        file,
      });
      message.success("Dataset uploaded");
      setFile(null);
      form.resetFields();
      onCreated?.(created);
      onClose();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.detail || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New dataset"
      open={open}
      onOk={submit}
      confirmLoading={submitting}
      okText="Upload"
      onCancel={() => {
        setFile(null);
        form.resetFields();
        onClose();
      }}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Title"
          name="title"
          rules={[{ required: true }, { max: 200 }]}
        >
          <Input placeholder="e.g., GEO GSE… (series matrix)" />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} placeholder="Short note (optional)" />
        </Form.Item>
        <Form.Item label="File" required>
          <Dragger {...props} style={{ padding: 8 }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drag & drop your file</p>
            <p className="ant-upload-hint">
              Allowed: .csv, .tsv, .txt, .parquet, .pq, .xls/.xlsx, and .gz
              versions (e.g. series_matrix.txt.gz)
            </p>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
