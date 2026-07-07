import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, message, Space, Popconfirm } from 'antd';
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import { getFaults, deleteFault, can } from '../api.js';

export default function Faults() {
  const [faults, setFaults] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFaults(await getFaults()); } catch (e) { message.error('Gagal memuat faults'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const del = async (fid) => { await deleteFault(fid); message.success('Fault dihapus'); load(); };
  const clearAll = async () => { for (const f of faults) await deleteFault(f._id); message.success('Semua fault dihapus'); load(); };

  const cols = [
    { title: 'Device', dataIndex: 'device', render: (v) => v?.split('-').pop() || v },
    { title: 'Channel', dataIndex: 'channel' },
    { title: 'Code', dataIndex: 'code', render: (v) => <Tag color="red">{v}</Tag> },
    { title: 'Pesan', dataIndex: 'message' },
    { title: 'Waktu', dataIndex: 'timestamp', render: (v) => v ? new Date(v).toLocaleString() : '-' },
    ...(can('faults.clear') ? [{ title: '', width: 60, render: (_, r) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => del(r._id)} /> }] : []),
  ];
  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
        {can('faults.clear') && faults.length > 0 && <Popconfirm title="Hapus semua fault?" onConfirm={clearAll}><Button danger>Hapus Semua ({faults.length})</Button></Popconfirm>}
      </Space>
      <Table rowKey="_id" size="middle" columns={cols} dataSource={faults} loading={loading}
        locale={{ emptyText: 'Tidak ada fault 🎉' }} pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }} />
    </>
  );
}
