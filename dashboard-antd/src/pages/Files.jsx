import { useState, useEffect, useCallback } from 'react';
import { Table, Button, message, Empty, Modal, Form, Input, Select, Upload, Space, Popconfirm } from 'antd';
import { ReloadOutlined, UploadOutlined, DeleteOutlined, InboxOutlined } from '@ant-design/icons';
import { getFiles, uploadFile, deleteRes } from '../api.js';

const FILE_TYPES = [
  '1 Firmware Upgrade Image',
  '2 Web Content',
  '3 Vendor Configuration File',
  '4 Tone File',
  '5 Ringer File',
];

export default function Files() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getFiles()); } catch (e) { message.error('Gagal memuat files'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async (v) => {
    if (!file) { message.warning('Pilih file dulu'); return; }
    setSaving(true);
    try {
      await uploadFile(v.filename || file.name, file, { fileType: v.fileType, oui: v.oui, productClass: v.productClass, version: v.version });
      message.success('File diupload'); setOpen(false); setFile(null); form.resetFields(); load();
    } catch (e) { message.error('Gagal upload: ' + e.message); } finally { setSaving(false); }
  };
  const del = async (id) => { try { await deleteRes('files', id); message.success('File dihapus'); load(); } catch (e) { message.error('Gagal'); } };

  const cols = [
    { title: 'Nama File', dataIndex: '_id' },
    { title: 'Tipe', render: (_, r) => r.metadata?.fileType || '-' },
    { title: 'OUI', render: (_, r) => r.metadata?.oui || '-' },
    { title: 'Product Class', render: (_, r) => r.metadata?.productClass || '-' },
    { title: 'Versi', render: (_, r) => r.metadata?.version || '-' },
    { title: 'Ukuran', dataIndex: 'length', render: (v) => v ? (v / 1024).toFixed(1) + ' KB' : '-' },
    { title: '', width: 50, render: (_, r) => <Popconfirm title="Hapus file?" onConfirm={() => del(r._id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> },
  ];
  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setOpen(true)}>Upload Firmware</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </Space>
      <Table rowKey="_id" size="middle" columns={cols} dataSource={items} loading={loading}
        locale={{ emptyText: <Empty description="Belum ada file. Upload firmware untuk push/upgrade ke ONU." /> }} pagination={false} />
      <Modal title="Upload Firmware / File" open={open} onOk={() => form.submit()} confirmLoading={saving} onCancel={() => { setOpen(false); setFile(null); }} okText="Upload">
        <Form form={form} layout="vertical" onFinish={submit}>
          <Upload.Dragger beforeUpload={(f) => { setFile(f); form.setFieldValue('filename', f.name); return false; }} maxCount={1}
            onRemove={() => setFile(null)} fileList={file ? [file] : []}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p>Klik atau seret file firmware ke sini</p>
          </Upload.Dragger>
          <Form.Item label="Nama file (di GenieACS)" name="filename" rules={[{ required: true }]} style={{ marginTop: 12 }}><Input /></Form.Item>
          <Form.Item label="Tipe File" name="fileType" rules={[{ required: true }]} initialValue={FILE_TYPES[0]}>
            <Select options={FILE_TYPES.map((t) => ({ value: t, label: t }))} />
          </Form.Item>
          <Space>
            <Form.Item label="OUI" name="oui"><Input placeholder="mis. F86CE1" /></Form.Item>
            <Form.Item label="Product Class" name="productClass"><Input placeholder="mis. GM630 XPON" /></Form.Item>
            <Form.Item label="Versi" name="version"><Input placeholder="mis. V1.2" /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  );
}
