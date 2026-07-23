import { useState } from 'react';
import {
  Table, Tag, Badge, Input, Button, message, Space, Modal, Progress,
  Segmented, Card, Checkbox, List, Typography, Empty,
} from 'antd';
import {
  ThunderboltOutlined, PoweroffOutlined, TagsOutlined, DeleteOutlined,
  AppstoreOutlined, UnorderedListOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { summon, reboot, addTag, removeTag, deleteDevice, can } from '../api.js';

const redColor = { Normal: 'green', Warning: 'gold', Kritis: 'red', Overload: 'orange' };
const suhuColor = { Normal: 'green', Warning: 'gold', Kritis: 'red' };
const hexColor = { Normal: '#52c41a', Warning: '#faad14', Kritis: '#ff4d4f', Overload: '#fa8c16' };

// Rx power (dBm) -> jumlah bar 1..5. Makin mendekati 0 (kurang negatif) makin kuat.
function rxBars(rx) {
  const v = parseFloat(rx);
  if (isNaN(v)) return 0;
  const q = (v + 28) / 20; // -28 dBm..-8 dBm -> 0..1
  return Math.max(1, Math.min(5, Math.round(q * 5)));
}

function SignalBars({ rx, status }) {
  const n = rxBars(rx);
  const color = hexColor[status] || '#8c8c8c';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 16 }} title={`${rx} dBm`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ width: 4, height: 4 + i * 2.4, borderRadius: 1, background: i <= n ? color : '#e8e8e8' }} />
      ))}
    </span>
  );
}

function Metric({ label, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '3px 0', gap: 8 }}>
      <span style={{ color: '#8c8c8c', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}

// Export CSV daftar ONU terpilih (tanpa dependency, BOM UTF-8 supaya rapi di Excel).
const CSV_COLS = [
  ['Device ID', 'id'], ['PPPoE', 'pppoe'], ['SN', 'serial'], ['MAC', 'mac'],
  ['Tipe', 'model'], ['Mode', 'mode'], ['IP', 'ip'], ['IP Mgmt', 'ipMgmt'],
  ['SSID', 'ssid'], ['Rx (dBm)', 'rx'], ['Redaman', 'redaman'], ['Temp (C)', 'temp'],
  ['Suhu', 'suhu'], ['Uptime', 'uptime'], ['Client', 'clients'],
  ['Status', (r) => (r.online ? 'Online' : 'Disconnected')],
  ['Last Inform', 'lastInform'], ['Tags', (r) => (r.tags || []).join(' ')],
];
function csvCell(v) {
  const s = v == null ? '' : String(v);
  return '"' + s.replace(/"/g, '""') + '"';
}
function exportCSV(rows) {
  const header = CSV_COLS.map((c) => csvCell(c[0])).join(',');
  const body = rows.map((r) =>
    CSV_COLS.map((c) => csvCell(typeof c[1] === 'function' ? c[1](r) : r[c[1]])).join(',')
  ).join('\r\n');
  const csv = '﻿' + header + '\r\n' + body + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = `onu-export-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Devices({ devices, loading, reload }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [prog, setProg] = useState(null); // {done,total,label}
  const [view, setView] = useState(() => localStorage.getItem('dev_view') || (typeof window !== 'undefined' && window.innerWidth < 768 ? 'card' : 'table'));
  const nav = useNavigate();
  const setViewP = (v) => { setView(v); localStorage.setItem('dev_view', v); };
  const data = devices.filter((d) => !q || JSON.stringify(d).toLowerCase().includes(q.toLowerCase()));
  const open = (id) => nav('/device/' + encodeURIComponent(id));
  const toggleSel = (id, checked) => setSel((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  const doSummon = async (id) => { try { await summon(id); message.success('Summon terkirim'); setTimeout(reload, 4000); } catch (e) { message.error('Gagal summon'); } };
  const doExport = () => {
    const rows = devices.filter((d) => sel.includes(d.id));
    if (!rows.length) { message.warning('Pilih ONU dulu'); return; }
    exportCSV(rows);
    message.success(`Export ${rows.length} ONU ke CSV`);
  };

  // Bulk runner: jalankan fn utk tiap id terpilih, berurutan + progress
  const runBulk = async (label, fn, reloadAfter = true) => {
    const ids = [...sel];
    setProg({ done: 0, total: ids.length, label });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      try { await fn(ids[i]); ok++; } catch (e) {}
      setProg({ done: i + 1, total: ids.length, label });
      await new Promise((r) => setTimeout(r, 400));
    }
    setProg(null);
    message.success(`${label}: ${ok}/${ids.length} berhasil`);
    if (reloadAfter) setTimeout(reload, 3000);
  };
  const bulkTag = (remove) => {
    let tag = '';
    Modal.confirm({
      title: (remove ? 'Hapus' : 'Tambah') + ` tag untuk ${sel.length} ONU`,
      content: <Input placeholder="nama tag" onChange={(e) => (tag = e.target.value)} />,
      onOk: () => tag && runBulk((remove ? 'Hapus' : 'Tambah') + ' tag', (id) => (remove ? removeTag(id, tag) : addTag(id, tag))),
    });
  };
  const bulkDelete = () => Modal.confirm({
    title: `Hapus ${sel.length} ONU dari GenieACS?`, okButtonProps: { danger: true },
    onOk: () => runBulk('Hapus device', (id) => deleteDevice(id)).then(() => setSel([])),
  });

  const columns = [
    { title: 'Aksi', fixed: 'left', width: 180, render: (_, r) => (
      <Space size={4}>
        <Button size="small" onClick={() => open(r.id)}>Detail</Button>
        <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} onClick={() => doSummon(r.id)}>Summon</Button>
      </Space>
    ) },
    { title: 'PPPoE', dataIndex: 'pppoe', width: 190, render: (v, r) => v ? <a onClick={() => open(r.id)}>{v}</a> : null },
    { title: 'SN', dataIndex: 'serial', width: 150 },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: 'Tipe', dataIndex: 'model', width: 140 },
    { title: 'Mode', dataIndex: 'mode', width: 84, render: (v) => v ? <Tag color={v === 'GPON' ? 'blue' : v === 'EPON' ? 'purple' : 'cyan'}>{v}</Tag> : null },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    { title: 'IP Mgmt', dataIndex: 'ipMgmt', width: 120 },
    { title: 'SSID', dataIndex: 'ssid', width: 130 },
    { title: 'Rx (dBm)', dataIndex: 'rx', width: 130, sorter: (a, b) => parseFloat(a.rx || 0) - parseFloat(b.rx || 0),
      render: (v, r) => v ? <Space size={6}><SignalBars rx={v} status={r.redaman} /><span>{v}</span></Space> : '—' },
    { title: 'Redaman', dataIndex: 'redaman', width: 104, render: (v) => v ? <Tag color={redColor[v] || 'default'}>{v}</Tag> : null },
    { title: 'Temp', dataIndex: 'temp', width: 72 },
    { title: 'Suhu', dataIndex: 'suhu', width: 96, render: (v) => v ? <Tag color={suhuColor[v] || 'default'}>{v}</Tag> : null },
    { title: 'Uptime', dataIndex: 'uptime', width: 110 },
    { title: 'Client', dataIndex: 'clients', width: 80 },
    { title: 'Status', dataIndex: 'online', width: 128, render: (v) => <Badge status={v ? 'success' : 'error'} text={<span style={{ whiteSpace: 'nowrap' }}>{v ? 'Online' : 'Disconnected'}</span>} /> },
  ];

  const renderCard = (r) => {
    const checked = sel.includes(r.id);
    return (
      <Card
        size="small" hoverable onClick={() => open(r.id)}
        style={{ borderColor: checked ? '#1677ff' : undefined, boxShadow: checked ? '0 0 0 2px rgba(22,119,255,.15)' : undefined }}
        styles={{ body: { padding: 14 } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
            <Checkbox checked={checked} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleSel(r.id, e.target.checked)} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.serial}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.model || '—'}</Typography.Text>
            </div>
          </div>
          <Badge status={r.online ? 'success' : 'error'} text={<span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{r.online ? 'Online' : 'Disconnected'}</span>} style={{ flexShrink: 0 }} />
        </div>

        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
          <Metric label="Mode">{r.mode ? <Tag color={r.mode === 'GPON' ? 'blue' : r.mode === 'EPON' ? 'purple' : 'cyan'}>{r.mode}</Tag> : '—'}</Metric>
          <Metric label="Rx Power">
            {r.rx ? <Space size={6}><SignalBars rx={r.rx} status={r.redaman} /><span>{r.rx} dBm</span>{r.redaman && <Tag color={redColor[r.redaman] || 'default'} style={{ marginInlineEnd: 0 }}>{r.redaman}</Tag>}</Space> : '—'}
          </Metric>
          <Metric label="Suhu">
            {r.temp ? <Space size={6}><span>{r.temp} °C</span>{r.suhu && <Tag color={suhuColor[r.suhu] || 'default'} style={{ marginInlineEnd: 0 }}>{r.suhu}</Tag>}</Space> : '—'}
          </Metric>
          <Metric label="PPPoE">{r.pppoe || '—'}</Metric>
          <Metric label="IP / Client">{(r.ip || '—') + ' · ' + (r.clients ?? '—') + ' client'}</Metric>
          <Metric label="Uptime">{r.uptime || '—'}</Metric>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button size="small" block onClick={(e) => { e.stopPropagation(); open(r.id); }}>Detail</Button>
          <Button size="small" block type="primary" ghost icon={<ThunderboltOutlined />} onClick={(e) => { e.stopPropagation(); doSummon(r.id); }}>Summon</Button>
        </div>
      </Card>
    );
  };

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="Cari SN / IP / PPPoE / SSID..." allowClear onChange={(e) => setQ(e.target.value)} style={{ width: 340, maxWidth: '100%' }} />
        <Button onClick={reload}>Refresh</Button>
        <Segmented
          value={view} onChange={setViewP}
          options={[
            { label: 'Tabel', value: 'table', icon: <UnorderedListOutlined /> },
            { label: 'Kartu', value: 'card', icon: <AppstoreOutlined /> },
          ]}
        />
      </Space>
      {sel.length > 0 && (
        <Space style={{ marginBottom: 12, padding: '8px 12px', background: '#e6f4ff', borderRadius: 8 }} wrap>
          <b>{sel.length} ONU dipilih:</b>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => runBulk('Summon', (id) => summon(id))}>Summon</Button>
          {can('reboot') && <Button size="small" icon={<PoweroffOutlined />} danger onClick={() => Modal.confirm({ title: `Reboot ${sel.length} ONU?`, onOk: () => runBulk('Reboot', (id) => reboot(id), false) })}>Reboot</Button>}
          {can('tags') && <Button size="small" icon={<TagsOutlined />} onClick={() => bulkTag(false)}>Tambah Tag</Button>}
          {can('tags') && <Button size="small" icon={<TagsOutlined />} onClick={() => bulkTag(true)}>Hapus Tag</Button>}
          {can('device.delete') && <Button size="small" icon={<DeleteOutlined />} danger onClick={bulkDelete}>Hapus</Button>}
          <Button size="small" icon={<DownloadOutlined />} onClick={doExport}>Export CSV</Button>
          <Button size="small" type="link" onClick={() => setSel([])}>Batal pilih</Button>
        </Space>
      )}
      {prog && <Progress percent={Math.round((prog.done / prog.total) * 100)} format={() => `${prog.label} ${prog.done}/${prog.total}`} style={{ marginBottom: 12 }} />}
      {view === 'table' ? (
        <Table columns={columns} dataSource={data} loading={loading} scroll={{ x: 2100 }} size="middle"
          rowKey="id" rowSelection={{ selectedRowKeys: sel, onChange: setSel, preserveSelectedRowKeys: true }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (t) => `${t} ONU` }} />
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
          dataSource={data} loading={loading}
          locale={{ emptyText: <Empty description="Tidak ada ONU" /> }}
          pagination={{ defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '40'], showTotal: (t) => `${t} ONU` }}
          renderItem={(r) => <List.Item style={{ marginBottom: 0 }}>{renderCard(r)}</List.Item>}
        />
      )}
    </>
  );
}
