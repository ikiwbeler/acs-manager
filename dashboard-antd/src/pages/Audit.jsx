import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Input, Select, Button, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getAuditLog } from '../api.js';

const actionColor = (a, status) => {
  if (status === 'denied') return 'red';
  if (!a) return 'default';
  if (a.indexOf('login') === 0) return 'blue';
  if (a === 'factoryReset' || a.indexOf('del') >= 0 || a.indexOf('disable') >= 0) return 'volcano';
  if (a.indexOf('add') >= 0 || a.indexOf('save') >= 0 || a.indexOf('enable') >= 0) return 'green';
  if (a === 'reboot' || a.indexOf('set') >= 0 || a.indexOf('rename') >= 0) return 'orange';
  return 'geekblue';
};
const fmt = (ts) => { try { return new Date(ts).toLocaleString('id-ID', { hour12: false }); } catch (e) { return String(ts); } };

export default function Audit() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [statusF, setStatusF] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await getAuditLog({ limit: 1000 })); } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (statusF && (r.status || 'ok') !== statusF) return false;
    if (!q) return true;
    const s = ((r.user || '') + ' ' + (r.action || '') + ' ' + (r.summary || '') + ' ' + (r.target || '')).toLowerCase();
    return s.indexOf(q.toLowerCase()) >= 0;
  });

  const columns = [
    { title: 'Waktu', dataIndex: 'ts', width: 175, render: fmt, sorter: (a, b) => a.ts - b.ts, defaultSortOrder: 'descend' },
    { title: 'User', dataIndex: 'user', width: 130, render: (u, r) => (<span>{u} <Typography.Text type="secondary" style={{ fontSize: 11 }}>{r.roles}</Typography.Text></span>) },
    { title: 'Aksi', dataIndex: 'action', width: 150, render: (a, r) => (<Tag color={actionColor(a, r.status)}>{r.status === 'denied' ? 'DITOLAK' : a}</Tag>) },
    { title: 'Keterangan', dataIndex: 'summary' },
    { title: 'Target', dataIndex: 'target', width: 210, ellipsis: true, render: (t) => t || '-' },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>Log Aktivitas</Typography.Title>
        <Input.Search placeholder="cari user / aksi / target..." allowClear style={{ width: 300 }} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={statusF} style={{ width: 170 }} onChange={setStatusF}
          options={[{ value: '', label: 'Semua status' }, { value: 'ok', label: 'Sukses' }, { value: 'denied', label: 'Ditolak / Gagal' }]} />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        <Typography.Text type="secondary">{filtered.length} entri</Typography.Text>
      </Space>
      <Table size="small" rowKey={(r) => r.ts + '|' + (r.action || '') + '|' + (r.summary || '')} columns={columns}
        dataSource={filtered} loading={loading} pagination={{ pageSize: 50, showSizeChanger: true }} scroll={{ x: 900 }} />
    </div>
  );
}
