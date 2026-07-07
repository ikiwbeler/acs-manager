import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, message, Modal, Popconfirm, Select, Input, Form, Space } from 'antd';
import { ReloadOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getPermissions, savePermission, deletePermission } from '../api.js';

const accessLabel = { 1: 'Read', 2: 'Read+Write', 3: 'Full' };
const RESOURCES = ['devices', 'faults', 'files', 'presets', 'provisions', 'virtualParameters', 'config', 'permissions', 'users'];

export default function Permissions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getPermissions()); } catch (e) { message.error('Gagal memuat permissions'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const del = async (id) => { try { await deletePermission(id); message.success('Dihapus'); load(); } catch (e) { message.error('Gagal: ' + e.message); } };
  const create = async (v) => {
    try { await savePermission({ role: v.role, resource: v.resource, access: v.access, validate: v.validate || 'true' }); message.success('Permission ditambah'); setOpen(false); form.resetFields(); load(); }
    catch (e) { message.error('Gagal: ' + e.message); }
  };

  const cols = [
    { title: 'Role', dataIndex: 'role', render: (v) => <Tag color="geekblue">{v}</Tag> },
    { title: 'Resource', dataIndex: 'resource' },
    { title: 'Akses', dataIndex: 'access', render: (v) => <Tag color={v === 3 ? 'green' : v === 2 ? 'gold' : 'default'}>{accessLabel[v] || v}</Tag> },
    { title: 'Filter', dataIndex: 'filter', render: (v) => v ? <code style={{ fontSize: 12 }}>{v}</code> : '—' },
    { title: 'Validate', dataIndex: 'validate', render: (v) => <code style={{ fontSize: 12 }}>{v}</code> },
    { title: '', width: 50, render: (_, r) => <Popconfirm title="Hapus?" onConfirm={() => del(r._id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm> },
  ];
  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<PlusOutlined />} type="primary" onClick={() => setOpen(true)}>Tambah Permission</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </Space>
      <Table rowKey="_id" size="middle" columns={cols} dataSource={items} loading={loading} pagination={false} />
      <Modal title="Tambah Permission" open={open} onOk={() => form.submit()} onCancel={() => setOpen(false)} okText="Tambah">
        <Form form={form} layout="vertical" onFinish={create}>
          <Form.Item label="Role" name="role" rules={[{ required: true }]} initialValue="admin"><Input /></Form.Item>
          <Form.Item label="Resource" name="resource" rules={[{ required: true }]}>
            <Select options={RESOURCES.map((r) => ({ value: r, label: r }))} showSearch />
          </Form.Item>
          <Form.Item label="Akses" name="access" rules={[{ required: true }]} initialValue={3}>
            <Select options={[{ value: 1, label: 'Read' }, { value: 2, label: 'Read+Write' }, { value: 3, label: 'Full' }]} />
          </Form.Item>
          <Form.Item label="Validate (ekspresi)" name="validate" initialValue="true"><Input /></Form.Item>
        </Form>
      </Modal>
    </>
  );
}
