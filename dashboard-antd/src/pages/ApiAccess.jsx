import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, message, Popconfirm, Space, Modal, Form, Input, Select, Alert, Badge, Typography, Card } from 'antd';
import { ReloadOutlined, DeleteOutlined, PlusOutlined, StopOutlined, ApiOutlined, SendOutlined, KeyOutlined } from '@ant-design/icons';
import { getApiKeys, createApiKey, revokeApiKey, getWebhooks, createWebhook, deleteWebhook, testWebhook } from '../api.js';

const SCOPE_OPTIONS = [
  { value: 'read', label: 'read — baca data ONU (/devices)' },
  { value: 'write', label: 'write — kontrol ONU (wifi/reboot/set)' },
  { value: 'stats', label: 'stats — statistik agregat (/stats)' },
  { value: 'webhook', label: 'webhook — (cadangan utk integrasi)' },
];
const EVENT_OPTIONS = [
  { value: 'online', label: 'online — ONU kembali online' },
  { value: 'offline', label: 'offline — ONU putus' },
  { value: 'fault', label: 'fault — fault baru muncul' },
];
const fmtDate = (v) => (v ? new Date(v).toLocaleString('id-ID') : '-');

export default function ApiAccess() {
  const [keys, setKeys] = useState([]);
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addKey, setAddKey] = useState(false);
  const [addHook, setAddHook] = useState(false);
  const [secret, setSecret] = useState(null); // {title, value, note} -> ditampilkan sekali
  const [keyForm] = Form.useForm();
  const [hookForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try { setKeys(await getApiKeys()); setHooks(await getWebhooks()); }
    catch (e) { message.error('Gagal memuat: ' + e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => { try { await fn(); message.success(okMsg); load(); } catch (e) { message.error('Gagal: ' + e.message); } };

  const doAddKey = async (v) => {
    try {
      const r = await createApiKey(v.name, v.scopes);
      setAddKey(false); keyForm.resetFields(); load();
      setSecret({ title: 'API Key baru dibuat', value: r.key, note: 'Salin sekarang — key ini hanya ditampilkan SEKALI. Di server hanya tersimpan hash-nya.' });
    } catch (e) { message.error('Gagal: ' + e.message); }
  };
  const doAddHook = async (v) => {
    try {
      const r = await createWebhook(v.url, v.events, v.secret || undefined);
      setAddHook(false); hookForm.resetFields(); load();
      setSecret({ title: 'Webhook didaftarkan', value: r.secret, note: 'Ini secret untuk verifikasi signature (header X-ACS-Signature = HMAC-SHA256(body, secret)). Simpan baik-baik.' });
    } catch (e) { message.error('Gagal: ' + e.message); }
  };

  const keyCols = [
    { title: 'Nama', dataIndex: 'name', render: (v) => <><KeyOutlined /> {v}</> },
    { title: 'Scopes', dataIndex: 'scopes', render: (v) => (v || []).map((s) => <Tag color="geekblue" key={s}>{s}</Tag>) },
    { title: 'Status', dataIndex: 'disabled', width: 110, render: (d) => <Badge status={d ? 'default' : 'success'} text={d ? 'Dicabut' : 'Aktif'} /> },
    { title: 'Dibuat', dataIndex: 'createdAt', render: fmtDate },
    { title: 'Dipakai terakhir', dataIndex: 'lastUsedAt', render: fmtDate },
    { title: 'Aksi', width: 120, render: (_, r) => (
      <Popconfirm title="Cabut API key ini? Sistem yang memakainya langsung kehilangan akses." disabled={r.disabled} onConfirm={() => act(() => revokeApiKey(r.id), 'API key dicabut')}>
        <Button size="small" danger icon={<StopOutlined />} disabled={r.disabled}>Cabut</Button>
      </Popconfirm>
    ) },
  ];
  const hookCols = [
    { title: 'URL', dataIndex: 'url', ellipsis: true, render: (v) => <code>{v}</code> },
    { title: 'Events', dataIndex: 'events', width: 220, render: (v) => (v || []).map((s) => <Tag color="purple" key={s}>{s}</Tag>) },
    { title: 'Secret', dataIndex: 'secret', width: 120, render: (v) => <Typography.Text copyable={{ text: v }} type="secondary">••••••</Typography.Text> },
    { title: 'Dibuat', dataIndex: 'createdAt', render: fmtDate },
    { title: 'Aksi', width: 200, render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<SendOutlined />} onClick={() => act(() => testWebhook(r.id, 'online'), 'Event uji dikirim')}>Test</Button>
        <Popconfirm title="Hapus webhook ini?" onConfirm={() => act(() => deleteWebhook(r.id), 'Webhook dihapus')}>
          <Button size="small" danger icon={<DeleteOutlined />}>Hapus</Button>
        </Popconfirm>
      </Space>
    ) },
  ];

  return (
    <>
      <Alert type="info" showIcon style={{ marginBottom: 16 }} icon={<ApiOutlined />}
        message="API untuk sistem lain (/api/v1)"
        description={<>Kelola API key (untuk billing/monitoring/aplikasi luar) & webhook keluar. Klien memakai header <code>Authorization: Bearer &lt;key&gt;</code> atau <code>X-API-Key</code>. Base URL: <code>{location.origin}/api/v1</code>. Aksi tulis tercatat di Log Aktivitas.</>} />

      <Card size="small" title="API Keys" style={{ marginBottom: 24 }}
        extra={<Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setAddKey(true)}>Buat Key</Button><Button icon={<ReloadOutlined />} onClick={load} /></Space>}>
        <Table rowKey="id" size="small" columns={keyCols} dataSource={keys} loading={loading} pagination={false}
          locale={{ emptyText: 'Belum ada API key' }} />
      </Card>

      <Card size="small" title="Webhooks keluar"
        extra={<Space><Button type="primary" icon={<PlusOutlined />} onClick={() => setAddHook(true)}>Daftar Webhook</Button><Button icon={<ReloadOutlined />} onClick={load} /></Space>}>
        <Table rowKey="id" size="small" columns={hookCols} dataSource={hooks} loading={loading} pagination={false}
          locale={{ emptyText: 'Belum ada webhook' }} />
      </Card>

      <Modal title="Buat API Key" open={addKey} onOk={() => keyForm.submit()} onCancel={() => setAddKey(false)} okText="Buat">
        <Form form={keyForm} layout="vertical" onFinish={doAddKey}>
          <Form.Item label="Nama (identitas pemakai, mis. billing)" name="name" rules={[{ required: true }]}><Input autoComplete="off" placeholder="billing-server" /></Form.Item>
          <Form.Item label="Scopes (izin)" name="scopes" rules={[{ required: true, message: 'pilih minimal 1 scope' }]}>
            <Select mode="multiple" options={SCOPE_OPTIONS} placeholder="pilih izin" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Daftar Webhook" open={addHook} onOk={() => hookForm.submit()} onCancel={() => setAddHook(false)} okText="Daftar">
        <Form form={hookForm} layout="vertical" onFinish={doAddHook}>
          <Form.Item label="URL tujuan" name="url" rules={[{ required: true, pattern: /^https?:\/\//, message: 'harus http(s)://' }]}><Input placeholder="https://billing.example/hook" /></Form.Item>
          <Form.Item label="Events" name="events" rules={[{ required: true, message: 'pilih minimal 1 event' }]}>
            <Select mode="multiple" options={EVENT_OPTIONS} placeholder="online / offline / fault" />
          </Form.Item>
          <Form.Item label="Secret (opsional — dikosongkan = digenerate otomatis)" name="secret"><Input autoComplete="off" placeholder="biarkan kosong" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={secret?.title} open={!!secret} onCancel={() => setSecret(null)} footer={<Button type="primary" onClick={() => setSecret(null)}>Sudah saya salin</Button>}>
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={secret?.note} />
        <Typography.Paragraph copyable={{ text: secret?.value }} style={{ fontFamily: 'monospace', fontSize: 15, background: '#f5f5f5', padding: '8px 12px', borderRadius: 6, wordBreak: 'break-all' }}>
          {secret?.value}
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
