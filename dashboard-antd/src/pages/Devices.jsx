import { useState } from 'react';
import { Table, Tag, Badge, Input, Button, message, Space, Modal, Progress } from 'antd';
import { ThunderboltOutlined, PoweroffOutlined, TagsOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { summon, reboot, addTag, removeTag, deleteDevice, can } from '../api.js';

const redColor = { Normal: 'green', Warning: 'gold', Kritis: 'red', Overload: 'orange' };
const suhuColor = { Normal: 'green', Warning: 'gold', Kritis: 'red' };

export default function Devices({ devices, loading, reload }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState([]);
  const [prog, setProg] = useState(null); // {done,total,label}
  const nav = useNavigate();
  const data = devices.filter((d) => !q || JSON.stringify(d).toLowerCase().includes(q.toLowerCase()));
  const open = (id) => nav('/device/' + encodeURIComponent(id));
  const doSummon = async (id) => { try { await summon(id); message.success('Summon terkirim'); setTimeout(reload, 4000); } catch (e) { message.error('Gagal summon'); } };

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
    { title: 'SN', dataIndex: 'serial', fixed: 'left', width: 150, render: (v, r) => <a onClick={() => open(r.id)}>{v}</a> },
    { title: 'MAC', dataIndex: 'mac', width: 150 },
    { title: 'Tipe', dataIndex: 'model', width: 140 },
    { title: 'Mode', dataIndex: 'mode', width: 84, render: (v) => v ? <Tag color={v === 'GPON' ? 'blue' : v === 'EPON' ? 'purple' : 'cyan'}>{v}</Tag> : null },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    { title: 'IP Mgmt', dataIndex: 'ipMgmt', width: 120 },
    { title: 'SSID', dataIndex: 'ssid', width: 130 },
    { title: 'PPPoE', dataIndex: 'pppoe', width: 190 },
    { title: 'Rx (dBm)', dataIndex: 'rx', width: 96, sorter: (a, b) => parseFloat(a.rx || 0) - parseFloat(b.rx || 0) },
    { title: 'Redaman', dataIndex: 'redaman', width: 104, render: (v) => v ? <Tag color={redColor[v] || 'default'}>{v}</Tag> : null },
    { title: 'Temp', dataIndex: 'temp', width: 72 },
    { title: 'Suhu', dataIndex: 'suhu', width: 96, render: (v) => v ? <Tag color={suhuColor[v] || 'default'}>{v}</Tag> : null },
    { title: 'Uptime', dataIndex: 'uptime', width: 110 },
    { title: 'Client', dataIndex: 'clients', width: 80 },
    { title: 'Status', dataIndex: 'online', width: 96, render: (v) => <Badge status={v ? 'success' : 'error'} text={v ? 'Online' : 'Offline'} /> },
    { title: 'Aksi', fixed: 'right', width: 180, render: (_, r) => (
      <Space size={4}>
        <Button size="small" onClick={() => open(r.id)}>Detail</Button>
        <Button size="small" type="primary" ghost icon={<ThunderboltOutlined />} onClick={() => doSummon(r.id)}>Summon</Button>
      </Space>
    ) },
  ];
  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="Cari SN / IP / PPPoE / SSID..." allowClear onChange={(e) => setQ(e.target.value)} style={{ width: 340 }} />
        <Button onClick={reload}>Refresh</Button>
      </Space>
      {sel.length > 0 && (
        <Space style={{ marginBottom: 12, padding: '8px 12px', background: '#e6f4ff', borderRadius: 8 }} wrap>
          <b>{sel.length} ONU dipilih:</b>
          <Button size="small" icon={<ThunderboltOutlined />} onClick={() => runBulk('Summon', (id) => summon(id))}>Summon</Button>
          {can('reboot') && <Button size="small" icon={<PoweroffOutlined />} danger onClick={() => Modal.confirm({ title: `Reboot ${sel.length} ONU?`, onOk: () => runBulk('Reboot', (id) => reboot(id), false) })}>Reboot</Button>}
          {can('tags') && <Button size="small" icon={<TagsOutlined />} onClick={() => bulkTag(false)}>Tambah Tag</Button>}
          {can('tags') && <Button size="small" icon={<TagsOutlined />} onClick={() => bulkTag(true)}>Hapus Tag</Button>}
          {can('device.delete') && <Button size="small" icon={<DeleteOutlined />} danger onClick={bulkDelete}>Hapus</Button>}
          <Button size="small" type="link" onClick={() => setSel([])}>Batal pilih</Button>
        </Space>
      )}
      {prog && <Progress percent={Math.round((prog.done / prog.total) * 100)} format={() => `${prog.label} ${prog.done}/${prog.total}`} style={{ marginBottom: 12 }} />}
      <Table columns={columns} dataSource={data} loading={loading} scroll={{ x: 2100 }} size="middle"
        rowKey="id" rowSelection={{ selectedRowKeys: sel, onChange: setSel, preserveSelectedRowKeys: true }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], showTotal: (t) => `${t} ONU` }} />
    </>
  );
}
