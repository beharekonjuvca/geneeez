import { useState } from "react";
import { Modal, Form, Input, Upload, message } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { uploadDataset } from "../lib/api/datasets";

const { Dragger } = Upload;

export default function DatasetUpload({ open, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const props = {
    name: "file",
    multiple: false,
    maxCount: 1,
    beforeUpload: (f) => {
      const ok =
        f.type === "text/csv" ||
        f.type === "application/vnd.ms-excel" ||
        f.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (!ok) {
        message.error("Please upload a CSV or Excel file");
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
          <Input placeholder="e.g., Gene expression (TCGA BRCA)" />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} placeholder="Short note (optional)" />
        </Form.Item>
        <Form.Item label="File" required>
          <Dragger {...props} accept=".csv,.xls,.xlsx" style={{ padding: 8 }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Drag & drop CSV / Excel here</p>
            <p className="ant-upload-hint">or click to choose a file</p>
          </Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
