import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Space, message, Modal, Popconfirm, Typography } from 'antd';
import { ReloadOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getConfig, saveConfigVal, deleteConfigVal } from '../api.js';

export default function Config() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [val, setVal] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [nid, setNid] = useState('');
  const [nval, setNval] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getConfig()); } catch (e) { message.error('Gagal memuat config'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const data = items.filter((x) => !q || x._id.toLowerCase().includes(q.toLowerCase()) || String(x.value).toLowerCase().includes(q.toLowerCase()));
  const save = async () => {
    try { await saveConfigVal(edit._id, val); message.success('Tersimpan'); setEdit(null); load(); }
    catch (e) { message.error('Gagal: ' + e.message); }
  };
  const create = async () => {
    if (!nid) return;
    try { await saveConfigVal(nid, nval); message.success('Dibuat'); setNewOpen(false); setNid(''); setNval(''); load(); }
    catch (e) { message.error('Gagal: ' + e.message); }
  };
  const del = async (id) => { try { await deleteConfigVal(id); message.success('Dihapus'); load(); } catch (e) { message.error('Gagal: ' + e.message); } };

  const cols = [
    { title: 'Key', dataIndex: '_id', width: '45%', render: (t) => <Typography.Text style={{ fontSize: 12 }} copyable={{ text: t }}>{t}</Typography.Text> },
    { title: 'Value', dataIndex: 'value', render: (v) => <code style={{ fontSize: 12 }}>{String(v)}</code> },
    { title: '', width: 90, render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEdit(r); setVal(String(r.value ?? '')); }} />
        <Popconfirm title="Hapus?" onConfirm={() => del(r._id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    ) },
  ];
  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="Cari key / value..." allowClear onChange={(e) => setQ(e.target.value)} style={{ width: 340 }} />
        <Button icon={<PlusOutlined />} onClick={() => setNewOpen(true)}>Tambah</Button>
        <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: -4 }}>
        Perubahan tersimpan langsung ke database. Sebagian config <code>ui.*</code> baru efektif di GenieACS UI bawaan setelah container di-restart.
      </Typography.Paragraph>
      <Table rowKey="_id" size="small" columns={cols} dataSource={data} loading={loading} pagination={{ defaultPageSize: 30, showSizeChanger: true, pageSizeOptions: ['10', '20', '30', '50', '100'], showTotal: (t) => `${t} entri` }} />
      <Modal title="Edit config" open={!!edit} onOk={save} onCancel={() => setEdit(null)} okText="Simpan">
        <Typography.Paragraph style={{ fontSize: 12 }} type="secondary">{edit?._id}</Typography.Paragraph>
        <Input.TextArea value={val} onChange={(e) => setVal(e.target.value)} autoSize={{ minRows: 2, maxRows: 8 }} style={{ fontFamily: 'monospace' }} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Catatan: value berupa ekspresi GenieACS. String pakai kutip tunggal, mis. <code>'IP'</code>.</Typography.Text>
      </Modal>
      <Modal title="Tambah config" open={newOpen} onOk={create} onCancel={() => setNewOpen(false)} okText="Buat">
        <Input placeholder="key (mis. ui.index.15.label)" value={nid} onChange={(e) => setNid(e.target.value)} style={{ marginBottom: 8 }} />
        <Input.TextArea placeholder="value (ekspresi)" value={nval} onChange={(e) => setNval(e.target.value)} autoSize={{ minRows: 2 }} style={{ fontFamily: 'monospace' }} />
      </Modal>
    </>
  );
}
