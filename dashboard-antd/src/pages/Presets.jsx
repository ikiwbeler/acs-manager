import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, message, Modal, Typography } from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { getPresets } from '../api.js';

export default function Presets() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getPresets()); } catch (e) { message.error('Gagal memuat presets'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cols = [
    { title: 'Nama', dataIndex: '_id' },
    { title: 'Channel', dataIndex: 'channel' },
    { title: 'Weight', dataIndex: 'weight', width: 90 },
    { title: 'Precondition', dataIndex: 'precondition', render: (v) => v ? <code style={{ fontSize: 12 }}>{v}</code> : <Tag>—</Tag> },
    { title: 'Events', dataIndex: 'events', render: (v) => v && Object.keys(v).length ? Object.keys(v).map((k) => <Tag key={k}>{k}</Tag>) : <Tag>any</Tag> },
    { title: 'Provisions', dataIndex: 'configurations', render: (c) => (c || []).map((x, i) => <Tag color="blue" key={i}>{x.name || x.type}</Tag>) },
    { title: '', width: 50, render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => setView(r)} /> },
  ];
  return (
    <>
      <Button icon={<ReloadOutlined />} onClick={load} style={{ marginBottom: 16 }}>Refresh</Button>
      <Table rowKey="_id" size="middle" columns={cols} dataSource={items} loading={loading} pagination={false} />
      <Modal title={view?._id} open={!!view} onCancel={() => setView(null)} footer={null} width={680}>
        <Typography.Paragraph><pre style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(view, null, 2)}</pre></Typography.Paragraph>
      </Modal>
    </>
  );
}
