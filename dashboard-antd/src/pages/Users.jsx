import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, message, Popconfirm, Space, Modal, Form, Input, Alert, Badge, Select, Typography } from 'antd';
import { ReloadOutlined, DeleteOutlined, PlusOutlined, KeyOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { getUsersFull, deleteUser, saveUser, renameUser, disableUser, enableUser, currentUser } from '../api.js';

// Role yang dikenal RBAC dashboard (sinkron dgn ROLE_CAPS di api.js / vite.config.js).
const ROLE_OPTIONS = [
  { value: 'admin', label: 'admin — akses penuh' },
  { value: 'noc', label: 'noc — Junior NOC (operator harian)' },
  { value: 'cs', label: 'cs — Customer Service (lihat + reboot + WiFi)' },
];

export default function Users() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pwUser, setPwUser] = useState(null);
  const [renUser, setRenUser] = useState(null);
  const [roleUser, setRoleUser] = useState(null);
  const [addForm] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [renForm] = Form.useForm();
  const [roleForm] = Form.useForm();
  const me = currentUser();

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getUsersFull()); } catch (e) { message.error('Gagal memuat users'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => { try { await fn(); message.success(okMsg); load(); } catch (e) { message.error('Gagal: ' + e.message); } };
  const doAdd = async (v) => { try { await saveUser(v.username, v.password, v.roles || 'admin'); message.success('User dibuat'); setAddOpen(false); addForm.resetFields(); load(); } catch (e) { message.error('Gagal: ' + e.message); } };
  const doPw = async (v) => { try { await saveUser(pwUser._id, v.password, pwUser.roles); message.success('Password diganti'); setPwUser(null); pwForm.resetFields(); } catch (e) { message.error('Gagal: ' + e.message); } };
  const doRename = async (v) => { try { await renameUser(renUser._id, v.to); message.success('Username diubah'); setRenUser(null); renForm.resetFields(); load(); } catch (e) { message.error('Gagal: ' + e.message); } };
  // Ubah role saja (password kosong -> backend hanya update field roles).
  const doRole = async (v) => { try { await saveUser(roleUser._id, '', v.roles); message.success('Role diubah'); setRoleUser(null); roleForm.resetFields(); load(); } catch (e) { message.error('Gagal: ' + e.message); } };

  const cols = [
    { title: 'Username', dataIndex: '_id', render: (v) => <>{v} {v === me && <Tag color="blue">anda</Tag>}</> },
    { title: 'Roles', dataIndex: 'roles', render: (v) => String(v || '').split(',').filter(Boolean).map((r) => <Tag color="geekblue" key={r}>{r.trim()}</Tag>) },
    { title: 'Status', dataIndex: 'disabled', width: 120, render: (d) => <Badge status={d ? 'default' : 'success'} text={d ? 'Nonaktif' : 'Aktif'} /> },
    { title: 'Aksi', width: 460, render: (_, r) => (
      <Space size={4} wrap>
        {r.disabled
          ? <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} onClick={() => act(() => enableUser(r._id), 'User diaktifkan')}>Enable</Button>
          : <Popconfirm title="Nonaktifkan user ini? (tidak bisa login sampai di-enable)" disabled={r._id === me} onConfirm={() => act(() => disableUser(r._id), 'User dinonaktifkan')}>
              <Button size="small" icon={<StopOutlined />} disabled={r._id === me} title={r._id === me ? 'Tidak bisa menonaktifkan diri sendiri' : ''}>Disable</Button>
            </Popconfirm>}
        <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => { setRoleUser(r); roleForm.setFieldsValue({ roles: (r.roles || '').split(',')[0].trim() || 'cs' }); }} disabled={r.disabled}>Role</Button>
        <Button size="small" icon={<KeyOutlined />} onClick={() => setPwUser(r)} disabled={r.disabled}>Password</Button>
        <Button size="small" icon={<EditOutlined />} onClick={() => setRenUser(r)} disabled={r.disabled}>Rename</Button>
        <Popconfirm title="Hapus user ini?" disabled={r._id === me} onConfirm={() => act(() => deleteUser(r._id), 'User dihapus')}>
          <Button size="small" danger icon={<DeleteOutlined />} disabled={r._id === me}>Hapus</Button>
        </Popconfirm>
      </Space>
    ) },
  ];
  return (
    <>
      <Alert type="success" showIcon style={{ marginBottom: 16 }}
        message="Manajemen user aktif (hashing PBKDF2-SHA512 sesuai GenieACS)."
        description="Tambah, ganti password, rename, hapus, serta enable/disable. User nonaktif tidak bisa login (dashboard maupun GenieACS UI) — password tetap tersimpan & bisa diaktifkan kembali." />
      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Tambah User</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </Space>
      <Table rowKey="_id" size="middle" columns={cols} dataSource={items} loading={loading} pagination={false} />

      <Modal title="Tambah User" open={addOpen} onOk={() => addForm.submit()} onCancel={() => setAddOpen(false)} okText="Buat">
        <Form form={addForm} layout="vertical" onFinish={doAdd}>
          <Form.Item label="Username" name="username" rules={[{ required: true }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, min: 4 }]}><Input.Password autoComplete="new-password" /></Form.Item>
          <Form.Item label="Role" name="roles" initialValue="cs" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal title={`Ganti Password: ${pwUser?._id || ''}`} open={!!pwUser} onOk={() => pwForm.submit()} onCancel={() => setPwUser(null)} okText="Simpan">
        <Form form={pwForm} layout="vertical" onFinish={doPw}>
          <Form.Item label="Password Baru" name="password" rules={[{ required: true, min: 4 }]}><Input.Password autoComplete="new-password" /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Rename: ${renUser?._id || ''}`} open={!!renUser} onOk={() => renForm.submit()} onCancel={() => setRenUser(null)} okText="Ubah">
        <Form form={renForm} layout="vertical" onFinish={doRename}>
          <Form.Item label="Username Baru" name="to" rules={[{ required: true }]}><Input autoComplete="off" /></Form.Item>
        </Form>
      </Modal>
      <Modal title={`Ubah Role: ${roleUser?._id || ''}`} open={!!roleUser} onOk={() => roleForm.submit()} onCancel={() => setRoleUser(null)} okText="Simpan">
        <Form form={roleForm} layout="vertical" onFinish={doRole}>
          <Form.Item label="Role" name="roles" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Role lama: <code>{roleUser?.roles || '-'}</code>. Perubahan berlaku saat user login berikutnya.</Typography.Text>
        </Form>
      </Modal>
    </>
  );
}
