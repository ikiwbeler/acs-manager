import { useState, useEffect, useCallback } from 'react';
import { List, Card, Button, Input, Space, message, Popconfirm, Modal, Typography } from 'antd';
import { ReloadOutlined, SaveOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getProvisions, getVirtualParameters, putScript, deleteRes } from '../api.js';

// resource: 'provisions' | 'virtual_parameters'
export default function ScriptAdmin({ resource, title }) {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(null);
  const [script, setScript] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const fetcher = resource === 'provisions' ? getProvisions : getVirtualParameters;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetcher();
      setItems(data);
      if (data.length && !sel) { setSel(data[0]._id); setScript(data[0].script || ''); }
    } catch (e) { message.error('Gagal memuat'); } finally { setLoading(false); }
  }, [fetcher]); // eslint-disable-line

  useEffect(() => { load(); }, [resource]); // eslint-disable-line

  const pick = (it) => { setSel(it._id); setScript(it.script || ''); };
  const save = async () => {
    setSaving(true);
    try { await putScript(resource, sel, script); message.success('Tersimpan'); await load(); }
    catch (e) { message.error('Gagal simpan'); } finally { setSaving(false); }
  };
  const del = async (name) => {
    try { await deleteRes(resource, name); message.success('Dihapus'); if (sel === name) { setSel(null); setScript(''); } load(); }
    catch (e) { message.error('Gagal hapus'); }
  };
  const create = async () => {
    if (!newName) return;
    try { await putScript(resource, newName, '// ' + newName + '\n'); message.success('Dibuat'); setNewOpen(false); setNewName(''); setSel(newName); setScript('// ' + newName + '\n'); load(); }
    catch (e) { message.error('Gagal buat'); }
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <Card title={title} size="small" style={{ width: 280, flexShrink: 0 }}
        extra={<Space><Button size="small" icon={<PlusOutlined />} onClick={() => setNewOpen(true)} /><Button size="small" icon={<ReloadOutlined />} onClick={load} /></Space>}>
        <List size="small" loading={loading} dataSource={items} rowKey="_id"
          renderItem={(it) => (
            <List.Item style={{ cursor: 'pointer', background: sel === it._id ? '#e6f4ff' : '' }}
              onClick={() => pick(it)}
              actions={[<Popconfirm key="d" title="Hapus?" onConfirm={(e) => { e?.stopPropagation?.(); del(it._id); }}><DeleteOutlined onClick={(e) => e.stopPropagation()} style={{ color: '#cf1322' }} /></Popconfirm>]}>
              <Typography.Text style={{ fontSize: 13 }}>{it._id}</Typography.Text>
            </List.Item>
          )} />
      </Card>
      <Card size="small" style={{ flex: 1 }} title={sel ? `Edit: ${sel}` : 'Pilih item'}
        extra={sel && <Button type="primary" size="small" icon={<SaveOutlined />} loading={saving} onClick={save}>Simpan</Button>}>
        {sel ? (
          <Input.TextArea value={script} onChange={(e) => setScript(e.target.value)} autoSize={{ minRows: 18, maxRows: 40 }}
            style={{ fontFamily: 'monospace', fontSize: 13 }} spellCheck={false} />
        ) : <Typography.Text type="secondary">Pilih item di kiri untuk melihat / mengedit script.</Typography.Text>}
      </Card>
      <Modal title={`Buat ${title} baru`} open={newOpen} onOk={create} onCancel={() => setNewOpen(false)} okText="Buat">
        <Input placeholder="nama (tanpa spasi)" value={newName} onChange={(e) => setNewName(e.target.value)} onPressEnter={create} />
      </Modal>
    </div>
  );
}
