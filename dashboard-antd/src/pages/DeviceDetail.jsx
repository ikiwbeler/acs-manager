import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Descriptions, Tag, Badge, Button, Space, Tabs, Table, Input, Modal,
  message, Popconfirm, Spin, Form, Typography, Select, Empty, Switch, Checkbox, InputNumber,
} from 'antd';
import {
  ThunderboltOutlined, ReloadOutlined, PoweroffOutlined, WarningOutlined,
  DeleteOutlined, WifiOutlined, EditOutlined, ArrowLeftOutlined, PlusOutlined,
  CloudDownloadOutlined, ApartmentOutlined, GlobalOutlined,
} from '@ant-design/icons';
import {
  getDevice, flatten, summon, reboot, factoryReset, refreshAll, refreshHosts, setParams,
  addTag, removeTag, deleteDevice, clearDeviceFaults,
  getDeviceTasks, deleteTask, getFiles, downloadToDevice, addObject, deleteObject, refreshWlan, refreshWan,
  getWifiPass, saveWifiPass, createWanGuided, can,
} from '../api.js';

const statColor = { Normal: 'green', Warning: 'gold', Kritis: 'red', Overload: 'orange' };

export default function DeviceDetail() {
  const { id } = useParams();
  const did = id;
  const nav = useNavigate();
  const [dev, setDev] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [fwOpen, setFwOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setDev(await getDevice(did)); } catch (e) { message.error('Gagal memuat device'); } finally { setLoading(false); }
  }, [did]);
  useEffect(() => { load(); }, [load]);

  if (loading && !dev) return <Spin size="large" style={{ display: 'block', marginTop: 80 }} />;
  if (!dev) return <Card>Device tidak ditemukan. <Button onClick={() => nav('/devices')}>Kembali</Button></Card>;

  const params = flatten(dev);
  const pv = (p) => params.find((x) => x.path === p)?.value;
  const vp = (k) => dev?.VirtualParameters?.[k]?._value ?? '-';
  const lastInform = dev._lastInform;
  const online = lastInform && (Date.now() - new Date(lastInform).getTime() < 300000);
  const tags = dev._tags || [];

  const wlans = [];
  try {
    const w = dev.InternetGatewayDevice.LANDevice['1'].WLANConfiguration;
    for (const k in w) { if (!k.startsWith('_') && w[k].SSID) wlans.push({ idx: k, base: `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${k}` }); }
  } catch (e) {}

  async function act(label, fn) {
    setBusy(label);
    try { await fn(); message.success(label + ' terkirim'); await load(); }
    catch (e) { message.error(label + ' gagal'); }
    finally { setBusy(''); }
  }

  return (
    <>
      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/devices')}>Kembali</Button>
        <Button type="primary" icon={<ThunderboltOutlined />} loading={busy === 'Summon'} onClick={() => act('Summon', () => summon(did))}>Summon</Button>
        <Button icon={<ReloadOutlined />} loading={busy === 'Refresh'} onClick={() => act('Refresh', () => refreshAll(did), 6000)}>Refresh Semua</Button>
        {can('reboot') && (
          <Popconfirm title="Reboot ONU ini?" onConfirm={() => act('Reboot', () => reboot(did))}>
            <Button danger icon={<PoweroffOutlined />} loading={busy === 'Reboot'}>Reboot</Button>
          </Popconfirm>
        )}
        {can('factoryReset') && (
          <Popconfirm title="FACTORY RESET? Semua konfigurasi ONU akan hilang!" okText="Ya, reset" okButtonProps={{ danger: true }} onConfirm={() => act('Factory Reset', () => factoryReset(did))}>
            <Button danger icon={<WarningOutlined />} loading={busy === 'Factory Reset'}>Factory Reset</Button>
          </Popconfirm>
        )}
        {can('firmware') && <Button icon={<CloudDownloadOutlined />} onClick={() => setFwOpen(true)}>Upgrade Firmware</Button>}
        {can('device.delete') && (
          <Popconfirm title="Hapus device dari GenieACS?" onConfirm={async () => { await deleteDevice(did); message.success('Device dihapus'); nav('/devices'); }}>
            <Button danger icon={<DeleteOutlined />}>Hapus</Button>
          </Popconfirm>
        )}
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Informasi" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Serial">{did.split('-').pop()}</Descriptions.Item>
              <Descriptions.Item label="Tipe">{vp('Model')}</Descriptions.Item>
              <Descriptions.Item label="Mode">{vp('PONMode')}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Badge status={online ? 'success' : 'error'} text={online ? 'Online' : 'Disconnected'} />
                {'  '}<Typography.Text type="secondary">{lastInform ? new Date(lastInform).toLocaleString() : '-'}</Typography.Text>
              </Descriptions.Item>
              <Descriptions.Item label="HW / SW">{(pv('InternetGatewayDevice.DeviceInfo.HardwareVersion') || '-') + ' / ' + (pv('InternetGatewayDevice.DeviceInfo.SoftwareVersion') || '-')}</Descriptions.Item>
              <Descriptions.Item label="Tags"><TagEditor did={did} tags={tags} onChange={load} /></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Koneksi & Optik" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="IP (WAN)">{vp('WANIP')}</Descriptions.Item>
              <Descriptions.Item label="IP Mgmt">{vp('IPMgmt')}</Descriptions.Item>
              <Descriptions.Item label="PPPoE">{vp('PPPoEUsername')}</Descriptions.Item>
              <Descriptions.Item label="MAC">{vp('WANMAC')}</Descriptions.Item>
              <Descriptions.Item label="Uptime">{vp('Uptime')}</Descriptions.Item>
              <Descriptions.Item label="Client WiFi">{vp('ClientCount')}</Descriptions.Item>
              <Descriptions.Item label="RX Power">{vp('RXPower') + ' dBm '}<Tag color={statColor[vp('RedamanStatus')] || 'default'}>{vp('RedamanStatus')}</Tag></Descriptions.Item>
              <Descriptions.Item label="Suhu">{vp('Temperature') + ' °C '}<Tag color={statColor[vp('SuhuStatus')] || 'default'}>{vp('SuhuStatus')}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} size="small">
        <Tabs items={[
          { key: 'wifi', label: <span><WifiOutlined /> WiFi</span>, children: <WifiTab did={did} dev={dev} onSaved={load} /> },
          ...(can('wan.edit') ? [{ key: 'wan', label: <span><GlobalOutlined /> WAN</span>, children: <WanTab did={did} dev={dev} onSaved={load} /> }] : []),
          { key: 'hosts', label: 'Perangkat Terhubung', children: <HostsTab dev={dev} did={did} onReload={load} /> },
          { key: 'params', label: 'Semua Parameter', children: <ParamsTab did={did} params={params} onChange={load} /> },
          ...(can('param.edit') ? [{ key: 'tasks', label: 'Tugas Antri', children: <TasksTab did={did} /> }] : []),
          ...(can('wan.edit') ? [{ key: 'adv', label: 'Lanjutan', children: <AdvancedTab did={did} onChange={load} /> }] : []),
        ]} />
      </Card>
      <FirmwareModal open={fwOpen} onClose={() => setFwOpen(false)} did={did}
        oui={did.split('-')[0]} productClass={vp('Model')} />
    </>
  );
}

function FirmwareModal({ open, onClose, did, oui, productClass }) {
  const [files, setFiles] = useState([]);
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) getFiles().then(setFiles).catch(() => {}); }, [open]);
  const fw = files.filter((f) => (f.metadata?.fileType || '').toLowerCase().includes('firmware'));
  const recommended = fw.filter((f) => !f.metadata?.productClass || f.metadata?.productClass === productClass);
  const send = async () => {
    if (!sel) { message.warning('Pilih firmware'); return; }
    const f = files.find((x) => x._id === sel);
    setBusy(true);
    try { await downloadToDevice(did, f.metadata?.fileType || '1 Firmware Upgrade Image', sel); message.success('Perintah upgrade dikirim ke ONU'); onClose(); }
    catch (e) { message.error('Gagal: ' + e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Upgrade Firmware ONU" open={open} onOk={send} confirmLoading={busy} onCancel={onClose} okText="Kirim ke ONU">
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>OUI {oui} · Tipe {productClass || '-'}. Pilih firmware (upload dulu di menu Admin → Files).</Typography.Paragraph>
      {fw.length === 0
        ? <Empty description="Belum ada file firmware. Upload di Admin → Files." />
        : <Select style={{ width: '100%' }} placeholder="Pilih firmware" value={sel} onChange={setSel}
            options={fw.map((f) => ({ value: f._id, label: `${f._id} ${f.metadata?.version ? '(' + f.metadata.version + ')' : ''}${recommended.includes(f) ? ' ✓ cocok' : ''}` }))} />}
    </Modal>
  );
}

function TasksTab({ did }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const load = async () => { setLoading(true); try { setTasks(await getDeviceTasks(did)); } catch (e) {} finally { setLoading(false); } };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const del = async (tid) => { try { await deleteTask(tid); message.success('Task dihapus'); load(); } catch (e) { message.error('Gagal'); } };
  const cols = [
    { title: 'Task', dataIndex: 'name' },
    { title: 'Detail', render: (_, r) => <code style={{ fontSize: 12 }}>{(r.parameterNames || r.parameterValues || r.objectName || r.fileName || '').toString().slice(0, 80)}</code> },
    { title: 'Waktu', dataIndex: 'timestamp', render: (v) => v ? new Date(v).toLocaleString() : '-' },
    { title: '', width: 50, render: (_, r) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => del(r._id)} /> },
  ];
  return (
    <>
      <Button icon={<ReloadOutlined />} onClick={load} style={{ marginBottom: 12 }}>Refresh</Button>
      <Table size="small" rowKey="_id" columns={cols} dataSource={tasks} loading={loading} pagination={false}
        locale={{ emptyText: 'Tidak ada task antri (semua sudah dieksekusi).' }} />
    </>
  );
}

function AdvancedTab({ did, onChange }) {
  const [obj, setObj] = useState('');
  const [busy, setBusy] = useState('');
  const run = async (label, fn) => { if (!obj) { message.warning('Isi path object'); return; } setBusy(label); try { await fn(); message.success(label + ' dikirim'); setTimeout(onChange, 6000); } catch (e) { message.error('Gagal: ' + e.message); } finally { setBusy(''); } };
  return (
    <Card size="small" title={<span><ApartmentOutlined /> Tambah / Hapus Object (instance parameter)</span>}>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        Untuk menambah/menghapus instance, mis. <code>InternetGatewayDevice.LANDevice.1.WLANConfiguration</code> atau <code>...WANConnectionDevice</code>. addObject menambah instance baru di bawah path object tsb.
      </Typography.Paragraph>
      <Space.Compact style={{ width: '100%' }}>
        <Input placeholder="path object (tanpa nomor instance di akhir untuk addObject)" value={obj} onChange={(e) => setObj(e.target.value)} />
        <Button type="primary" loading={busy === 'Add object'} onClick={() => run('Add object', () => addObject(did, obj))}>Add</Button>
        <Popconfirm title="Hapus object instance ini?" onConfirm={() => run('Delete object', () => deleteObject(did, obj))}>
          <Button danger loading={busy === 'Delete object'}>Delete</Button>
        </Popconfirm>
      </Space.Compact>
    </Card>
  );
}

function TagEditor({ did, tags, onChange }) {
  const [adding, setAdding] = useState(false);
  const [val, setVal] = useState('');
  const editable = can('tags');
  if (!editable) return <Space wrap size={4}>{tags.length ? tags.map((t) => <Tag key={t}>{t}</Tag>) : <Typography.Text type="secondary">—</Typography.Text>}</Space>;
  return (
    <Space wrap size={4}>
      {tags.map((t) => (
        <Tag key={t} closable onClose={async (e) => { e.preventDefault(); await removeTag(did, t); message.success('Tag dihapus'); onChange(); }}>{t}</Tag>
      ))}
      {adding ? (
        <Input size="small" autoFocus style={{ width: 120 }} value={val} onChange={(e) => setVal(e.target.value)}
          onPressEnter={async () => { if (val) { await addTag(did, val); message.success('Tag ditambah'); } setVal(''); setAdding(false); onChange(); }}
          onBlur={() => { setAdding(false); setVal(''); }} />
      ) : <Tag onClick={() => setAdding(true)} style={{ cursor: 'pointer', borderStyle: 'dashed' }}><PlusOutlined /> Tag</Tag>}
    </Space>
  );
}

function val(o) { return o && typeof o === 'object' && '_value' in o ? o._value : undefined; }
// Kumpulkan SEMUA WLAN dari semua LANDevice.* (bukan cuma .1), termasuk yang SSID-nya kosong.
function collectWlans(dev) {
  const out = [];
  try {
    const lans = dev.InternetGatewayDevice.LANDevice;
    for (const li in lans) {
      if (li.startsWith('_')) continue;
      const wc = lans[li].WLANConfiguration;
      if (!wc) continue;
      for (const wi in wc) {
        if (wi.startsWith('_')) continue;
        const w = wc[wi];
        const base = `InternetGatewayDevice.LANDevice.${li}.WLANConfiguration.${wi}`;
        out.push({
          key: base, li, wi, base,
          ssid: val(w.SSID), pass: val(w.KeyPassphrase),
          enable: val(w.Enable), standard: val(w.Standard),
          broadcast: val(w.SSIDAdvertisementEnabled), maxUser: val(w.MaxUserNum),
        });
      }
    }
  } catch (e) {}
  return out;
}

function WifiTab({ did, dev, onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [stored, setStored] = useState(null); // {base: password} dari penyimpanan dashboard
  const wlans = collectWlans(dev);
  useEffect(() => {
    getWifiPass(did).then((arr) => { const m = {}; (arr || []).forEach((x) => { m[x.base] = x.password; }); setStored(m); }).catch(() => setStored({}));
  }, [did]);

  // Reload langsung setelah task selesai (await sdh menunggu sesi CWMP) — tanpa delay tetap.
  const doRefresh = async () => {
    setBusy('refresh');
    try { await refreshWlan(did); await onSaved(); } catch (e) { message.error('Gagal'); } finally { setBusy(''); }
  };
  const toggleEnable = async (w, checked) => {
    setBusy(w.base);
    try { await setParams(did, [[w.base + '.Enable', checked, 'xsd:boolean']]); await onSaved(); message.success(`WLAN ${w.li}/${w.wi} ${checked ? 'diaktifkan' : 'dinonaktifkan'}`); }
    catch (e) { message.error('Gagal'); } finally { setBusy(''); }
  };
  const toggleBroadcast = async (w, checked) => {
    setBusy(w.base + ':bc');
    try { await setParams(did, [[w.base + '.SSIDAdvertisementEnabled', checked, 'xsd:boolean']]); await onSaved(); message.success(`SSID ${w.li}/${w.wi} ${checked ? 'di-broadcast' : 'disembunyikan'}`); }
    catch (e) { message.error('Gagal ubah broadcast'); } finally { setBusy(''); }
  };
  const addWlan = async () => {
    const li = wlans[0]?.li || '1';
    setBusy('add');
    try {
      await addObject(did, `InternetGatewayDevice.LANDevice.${li}.WLANConfiguration`);
      await refreshWlan(did);
      await onSaved();
      message.success('WLAN baru ditambahkan');
    } catch (e) { message.error('Gagal tambah WLAN: ' + e.message); } finally { setBusy(''); }
  };
  const delWlan = async (w) => {
    setBusy(w.base);
    try { await deleteObject(did, w.base); await onSaved(); message.success(`WLAN ${w.li}/${w.wi} dihapus`); }
    catch (e) { message.error('Gagal hapus WLAN'); } finally { setBusy(''); }
  };
  const effPass = (w) => w.pass || (stored && stored[w.base]) || '';
  const onSave = async (vals) => {
    setSaving(true);
    try {
      const pvs = []; const toStore = [];
      wlans.forEach((w) => {
        const s = vals['ssid_' + w.key];
        if (s != null && s !== '' && s !== w.ssid) pvs.push([w.base + '.SSID', s, 'xsd:string']);
        const p = vals['pass_' + w.key];
        if (p && p !== effPass(w)) { pvs.push([w.base + '.KeyPassphrase', p, 'xsd:string']); toStore.push([w.base, p]); }
        const mc = vals['maxuser_' + w.key];
        if (mc != null && mc !== '' && String(mc) !== String(w.maxUser ?? '')) pvs.push([w.base + '.MaxUserNum', String(mc), 'xsd:unsignedInt']);
      });
      if (!pvs.length) { message.info('Tidak ada perubahan'); setSaving(false); return; }
      await setParams(did, pvs);
      for (const [base, p] of toStore) { try { await saveWifiPass(did, base, p); } catch (e) {} }
      if (toStore.length) setStored((m) => ({ ...(m || {}), ...Object.fromEntries(toStore) }));
      await onSaved();
      message.success('WiFi disimpan & dikirim ke ONU');
    } catch (e) { message.error('Gagal simpan WiFi'); } finally { setSaving(false); }
  };

  const isOn = (v) => v === true || v === 'true' || v === 1 || v === '1';
  if (stored === null) return <div style={{ padding: 20 }}><Spin /> Memuat WLAN…</div>;
  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button icon={<ReloadOutlined />} loading={busy === 'refresh'} onClick={doRefresh}>Refresh Semua WLAN</Button>
        {can('wifi.full') && <Button type="primary" icon={<PlusOutlined />} loading={busy === 'add'} onClick={addWlan}>Tambah WLAN</Button>}
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{wlans.length} WLAN terdeteksi</Typography.Text>
      </Space>
      {!wlans.length ? <div><Typography.Text type="secondary">Belum ada data WLAN — klik "Refresh Semua WLAN".</Typography.Text></div> : (
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Row gutter={[16, 16]}>
            {wlans.map((w) => {
              const eff = effPass(w);
              const src = w.pass ? 'dari ONT' : ((stored && stored[w.base]) ? 'tersimpan' : null);
              return (
              <Col xs={24} md={12} lg={8} key={w.key}>
                <Card size="small"
                  title={`WLAN ${w.li}/${w.wi}${w.standard ? ' · ' + w.standard : ''}`}
                  extra={can('wifi.full')
                    ? <Space size={8}>
                        <Switch checkedChildren="ON" unCheckedChildren="OFF" checked={isOn(w.enable)} loading={busy === w.base} onChange={(c) => toggleEnable(w, c)} />
                        <Popconfirm title={`Hapus WLAN ${w.li}/${w.wi}?`} onConfirm={() => delWlan(w)}>
                          <Button size="small" danger type="text" icon={<DeleteOutlined />} loading={busy === w.base} />
                        </Popconfirm>
                      </Space>
                    : <Tag color={isOn(w.enable) ? 'green' : 'default'}>{isOn(w.enable) ? 'ON' : 'OFF'}</Tag>}>
                  <Form.Item label="SSID" name={'ssid_' + w.key} initialValue={w.ssid || ''} style={{ marginBottom: 8 }}><Input /></Form.Item>
                  <Form.Item
                    label={eff ? <span>Password <Tag color={src === 'dari ONT' ? 'blue' : 'green'} style={{ marginInlineStart: 4 }}>{src}</Tag></span> : 'Password (belum tersimpan — isi untuk set)'}
                    name={'pass_' + w.key} initialValue={eff} style={{ marginBottom: 0 }}>
                    <Input.Password placeholder={eff ? '' : 'set password baru…'} />
                  </Form.Item>
                  {can('wifi.full') && (
                    <>
                      <Checkbox
                        style={{ marginTop: 12 }}
                        checked={isOn(w.broadcast)}
                        disabled={busy === w.base + ':bc'}
                        onChange={(e) => toggleBroadcast(w, e.target.checked)}
                      >Broadcast SSID {isOn(w.broadcast) ? <Tag color="green" style={{ marginInlineStart: 4 }}>tampil</Tag> : <Tag style={{ marginInlineStart: 4 }}>tersembunyi</Tag>}</Checkbox>
                      <Form.Item label="Maksimum Client" name={'maxuser_' + w.key} initialValue={w.maxUser ?? undefined} style={{ marginTop: 12, marginBottom: 0 }}>
                        <InputNumber min={0} max={128} style={{ width: '100%' }} placeholder={w.maxUser != null ? '' : 'kosong = tak diubah'} />
                      </Form.Item>
                    </>
                  )}
                </Card>
              </Col>
            ); })}
          </Row>
          <Button type="primary" htmlType="submit" loading={saving} style={{ marginTop: 16 }}>Simpan SSID, Password & Maks. Client</Button>
        </Form>
      )}
    </>
  );
}

// Daftar interface LAN/WLAN yang bisa di-bind ke WAN (X_CT-COM_LanInterface).
// Mengembalikan [{ value: <full path>, label: <ramah> }]
function lanInterfaces(dev) {
  const out = [];
  try {
    const ld = dev.InternetGatewayDevice.LANDevice;
    for (const di in ld) {
      if (di.startsWith('_')) continue;
      const eth = ld[di].LANEthernetInterfaceConfig || {};
      for (const k in eth) {
        if (k.startsWith('_')) continue;
        out.push({ value: `InternetGatewayDevice.LANDevice.${di}.LANEthernetInterfaceConfig.${k}`, label: `LAN ${k}` });
      }
      const wl = ld[di].WLANConfiguration || {};
      for (const k in wl) {
        if (k.startsWith('_')) continue;
        const ssid = wl[k]?.SSID?._value;
        out.push({ value: `InternetGatewayDevice.LANDevice.${di}.WLANConfiguration.${k}`, label: `WiFi ${k}${ssid ? ' · ' + ssid : ''}` });
      }
    }
  } catch (e) {}
  return out;
}
const ifLabel = (path, opts) => (opts.find((o) => o.value === path)?.label) || path.replace('InternetGatewayDevice.LANDevice.', 'LD');

// Deteksi skema VLAN device dari WANConnectionDevice yang ada: 'gpon' | 'epon' | 'zte' | null
function wanVlanScheme(dev) {
  try {
    const wds = dev.InternetGatewayDevice.WANDevice;
    for (const di in wds) {
      if (di.startsWith('_')) continue;
      const wcds = wds[di].WANConnectionDevice; if (!wcds) continue;
      for (const ci in wcds) {
        if (ci.startsWith('_')) continue;
        if (wcds[ci]['X_CT-COM_WANGponLinkConfig']) return 'gpon';
        if (wcds[ci]['X_CT-COM_WANEponLinkConfig']) return 'epon';
        for (const kind of ['WANIPConnection', 'WANPPPConnection']) {
          const conns = wcds[ci][kind]; if (!conns) continue;
          for (const ki in conns) { if (!ki.startsWith('_') && conns[ki]?.['X_ZTE-COM_VLANID'] != null) return 'zte'; }
        }
      }
    }
  } catch (e) {}
  return null;
}

function collectWans(dev) {
  const out = [];
  try {
    const wds = dev.InternetGatewayDevice.WANDevice;
    for (const di in wds) {
      if (di.startsWith('_')) continue;
      const wcds = wds[di].WANConnectionDevice;
      if (!wcds) continue;
      for (const ci in wcds) {
        if (ci.startsWith('_')) continue;
        const wcdBase = `InternetGatewayDevice.WANDevice.${di}.WANConnectionDevice.${ci}`;
        // VLAN punya 3 skema vendor:
        //  (a) CT-COM GPON: X_CT-COM_WANGponLinkConfig (per-WCD) — VLANIDMark/Mode/Enable
        //  (b) CT-COM EPON: X_CT-COM_WANEponLinkConfig (per-WCD) — VLANIDMark/Mode/Enable
        //  (c) ZTE: X_ZTE-COM_VLANID + X_ZTE-COM_VLANEnable (per-koneksi)
        const linkName = wcds[ci]['X_CT-COM_WANGponLinkConfig'] ? 'X_CT-COM_WANGponLinkConfig'
          : (wcds[ci]['X_CT-COM_WANEponLinkConfig'] ? 'X_CT-COM_WANEponLinkConfig' : null);
        const lc = linkName ? (wcds[ci][linkName] || {}) : {};
        ['WANIPConnection', 'WANPPPConnection'].forEach((kind) => {
          const conns = wcds[ci][kind];
          if (!conns) return;
          for (const ki in conns) {
            if (ki.startsWith('_')) continue;
            const c = conns[ki];
            if (!c || typeof c !== 'object') continue;
            const base = `${wcdBase}.${kind}.${ki}`;
            // tentukan skema VLAN utk koneksi ini
            let vlanInfo;
            if (linkName) {
              const lcBase = `${wcdBase}.${linkName}`;
              vlanInfo = {
                hasVlan: lc.VLANIDMark != null, vlan: val(lc.VLANIDMark),
                vlanMode: val(lc.Mode), vlanEnable: val(lc.Enable),
                vlanIdPath: lcBase + '.VLANIDMark', vlanModePath: lcBase + '.Mode',
                vlanEnablePath: lcBase + '.Enable', vlanEnableType: 'xsd:boolean',
                glcBase: lcBase,
              };
            } else if (c['X_ZTE-COM_VLANID'] != null) {
              vlanInfo = {
                hasVlan: true, vlan: val(c['X_ZTE-COM_VLANID']),
                vlanMode: null, vlanEnable: val(c['X_ZTE-COM_VLANEnable']),
                vlanIdPath: base + '.X_ZTE-COM_VLANID', vlanModePath: null,
                vlanEnablePath: base + '.X_ZTE-COM_VLANEnable', vlanEnableType: 'xsd:boolean',
                glcBase: null,
              };
            } else {
              vlanInfo = { hasVlan: false, vlan: null, vlanMode: null, vlanEnable: null, vlanIdPath: null, vlanModePath: null, vlanEnablePath: null, vlanEnableType: 'xsd:boolean', glcBase: null };
            }
            // ServiceList & LanInterface: dukung prefix X_CT-COM_ atau X_ZTE-COM_
            const svcKey = c['X_ZTE-COM_ServiceList'] != null ? 'X_ZTE-COM_ServiceList' : 'X_CT-COM_ServiceList';
            const lifKey = c['X_ZTE-COM_LanInterface'] != null ? 'X_ZTE-COM_LanInterface' : 'X_CT-COM_LanInterface';
            const rec = {
              key: base, base, wcdBase,
              di, ci, ppp: kind === 'WANPPPConnection',
              name: val(c.Name), enable: val(c.Enable), type: val(c.ConnectionType),
              username: val(c.Username), addr: val(c.AddressingType),
              ip: val(c.ExternalIPAddress), status: val(c.ConnectionStatus),
              service: val(c[svcKey]), servicePath: base + '.' + svcKey,
              ...vlanInfo,
              // alias lama agar UI/handler existing tetap jalan
              hasGlc: vlanInfo.hasVlan, glcEnable: vlanInfo.vlanEnable,
              lanIf: val(c[lifKey]), lanIfPath: base + '.' + lifKey,
              hasLanIf: c[lifKey] != null,
              dhcpServer: val(c['X_CT-COM_LanInterface-DHCPEnable']),
              hasDhcp: c['X_CT-COM_LanInterface-DHCPEnable'] != null,
            };
            if (rec.name != null || rec.type != null || rec.status != null) out.push(rec);
          }
        });
      }
    }
  } catch (e) {}
  return out;
}

function AddWanModal({ open, onClose, did, hasGlc, vlanScheme, ifOpts, onDone }) {
  const [form] = Form.useForm();
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState('');
  const [ppp, setPpp] = useState(true);
  const submit = async (v) => {
    setRunning(true); setStep('Memulai...');
    try {
      await createWanGuided(did, {
        ppp, name: v.name, type: v.type, service: v.service, vlan: v.vlan,
        user: v.user, pass: v.pass, addr: v.addr, hasGlc, vlanScheme,
        lanif: v.lanif, dhcp: v.dhcp,
      }, (s) => setStep(s));
      message.success('WAN baru dibuat & dikonfigurasi');
      form.resetFields(); onClose(); await onDone();
    } catch (e) { message.error('Gagal: ' + (e.message || e)); }
    finally { setRunning(false); setStep(''); }
  };
  return (
    <Modal title="Tambah WAN (terpandu)" open={open} onCancel={running ? undefined : onClose}
      okText="Buat WAN" onOk={() => form.submit()} confirmLoading={running}
      cancelButtonProps={{ disabled: running }} maskClosable={!running} closable={!running} destroyOnClose>
      {running && (
        <div style={{ marginBottom: 12, padding: 10, background: '#e6f4ff', borderRadius: 6 }}>
          <Spin size="small" /> <Typography.Text style={{ marginLeft: 8 }}>{step}</Typography.Text>
          <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>Proses tambah WAN butuh beberapa siklus sesi ONU (±20–60 detik). Mohon tunggu.</Typography.Text></div>
        </div>
      )}
      <Form form={form} layout="vertical" onFinish={submit} disabled={running}>
        <Form.Item label="Jenis koneksi" name="ppp" initialValue="ppp">
          <Select onChange={(val) => setPpp(val === 'ppp')}
            options={[{ value: 'ppp', label: 'PPPoE (dial username/password)' }, { value: 'ip', label: 'IPoE (DHCP/Static)' }]} />
        </Form.Item>
        <Form.Item label="Nama koneksi" name="name" tooltip="Label koneksi di ONU, mis. INTERNET"><Input placeholder="mis. INTERNET" /></Form.Item>
        <Row gutter={8}>
          {hasGlc && (
            <Col span={12}>
              <Form.Item label="VLAN ID" name="vlan" tooltip="0 / kosong = untagged. Diisi → Mode tagged otomatis.">
                <Input type="number" placeholder="mis. 100" />
              </Form.Item>
            </Col>
          )}
          <Col span={hasGlc ? 12 : 24}>
            <Form.Item label="ServiceList" name="service" initialValue="INTERNET">
              <Select options={['TR069', 'INTERNET', 'VOIP', 'IPTV', 'OTHER', 'TR069_INTERNET'].map((t) => ({ value: t, label: t }))} allowClear showSearch />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="ConnectionType" name="type" initialValue={ppp ? 'PPPoE_Routed' : 'IP_Routed'}>
          <Select options={['IP_Routed', 'IP_Bridged', 'PPPoE_Routed', 'PPPoE_Bridged'].map((t) => ({ value: t, label: t }))} allowClear showSearch />
        </Form.Item>
        {ppp ? (
          <Row gutter={8}>
            <Col span={12}><Form.Item label="PPPoE Username" name="user" rules={[{ required: true, message: 'wajib' }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item label="PPPoE Password" name="pass"><Input.Password /></Form.Item></Col>
          </Row>
        ) : (
          <Form.Item label="AddressingType" name="addr" initialValue="DHCP">
            <Select options={['DHCP', 'Static'].map((t) => ({ value: t, label: t }))} />
          </Form.Item>
        )}
        {ifOpts && ifOpts.length > 0 && (
          <Form.Item label="Bind ke LAN / WiFi" name="lanif"
            tooltip="Port LAN / SSID WiFi yang akan dilayani WAN ini. Kosongkan untuk WAN manajemen/bridge tanpa LAN.">
            <Select mode="multiple" allowClear placeholder="pilih LAN / WiFi" options={ifOpts} optionFilterProp="label" maxTagCount="responsive" />
          </Form.Item>
        )}
        <Form.Item label="DHCP server di LAN" name="dhcp" valuePropName="checked" initialValue={true}>
          <Switch checkedChildren="Aktif" unCheckedChildren="Mati" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function WanTab({ did, dev, onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const wans = collectWans(dev);
  const ifOpts = lanInterfaces(dev);
  const hasGlc = wans.some((w) => w.hasVlan);
  // Skema VLAN device (dari WAN existing) untuk form Tambah: 'gpon' | 'epon' | 'zte' | null
  const vlanScheme = wanVlanScheme(dev);
  const isOn = (v) => v === true || v === 'true' || v === 1 || v === '1';

  const doRefresh = async () => { setBusy('refresh'); try { await refreshWan(did); await onSaved(); } catch (e) { message.error('Gagal'); } finally { setBusy(''); } };
  const toggleEnable = async (w, checked) => { setBusy(w.base); try { await setParams(did, [[w.base + '.Enable', checked, 'xsd:boolean']]); await onSaved(); message.success(`WAN ${w.di}/${w.ci} ${checked ? 'aktif' : 'nonaktif'}`); } catch (e) { message.error('Gagal'); } finally { setBusy(''); } };
  const toggleVlanLink = async (w, checked) => { if (!w.vlanEnablePath) return; setBusy(w.base + ':glc'); try { await setParams(did, [[w.vlanEnablePath, checked, w.vlanEnableType]]); await onSaved(); message.success(`Link VLAN WAN ${w.di}/${w.ci} ${checked ? 'aktif' : 'nonaktif'}`); } catch (e) { message.error('Gagal'); } finally { setBusy(''); } };
  const delWan = async (w) => { setBusy(w.base); try { await deleteObject(did, w.wcdBase); await onSaved(); message.success(`WAN ${w.di}/${w.ci} dihapus`); } catch (e) { message.error('Gagal hapus WAN'); } finally { setBusy(''); } };
  const onSave = async (vals) => {
    setSaving(true);
    try {
      const pvs = [];
      wans.forEach((w) => {
        const f = (n) => vals[n + '_' + w.key];
        if (f('name') != null && f('name') !== w.name) pvs.push([w.base + '.Name', f('name'), 'xsd:string']);
        if (f('type') != null && f('type') !== w.type) pvs.push([w.base + '.ConnectionType', f('type'), 'xsd:string']);
        if (w.ppp) {
          if (f('user') != null && f('user') !== w.username) pvs.push([w.base + '.Username', f('user'), 'xsd:string']);
          if (f('pass')) pvs.push([w.base + '.Password', f('pass'), 'xsd:string']);
        } else if (f('addr') != null && f('addr') !== w.addr) pvs.push([w.base + '.AddressingType', f('addr'), 'xsd:string']);
        if (f('service') != null && f('service') !== w.service) pvs.push([w.servicePath, f('service'), 'xsd:string']);
        if (w.hasLanIf) {
          const cur = Array.isArray(f('lanif')) ? f('lanif').join(',') : (f('lanif') ?? '');
          if (cur !== (w.lanIf || '')) pvs.push([w.lanIfPath, cur, 'xsd:string']);
        }
        if (w.hasDhcp && f('dhcp') != null && f('dhcp') !== isOn(w.dhcpServer)) pvs.push([w.base + '.X_CT-COM_LanInterface-DHCPEnable', f('dhcp'), 'xsd:boolean']);
        // VLAN: set VLAN ID (+ aktifkan tag). Path tergantung skema vendor (Gpon/Epon LinkConfig atau ZTE per-koneksi).
        if (w.hasVlan && f('vlan') != null && String(f('vlan')) !== String(w.vlan)) {
          const vid = parseInt(f('vlan'), 10);
          if (!isNaN(vid)) {
            pvs.push([w.vlanIdPath, vid, 'xsd:int']);
            // Gpon/Epon: Mode 2=tagged; ZTE: VLANEnable. Aktifkan tag saat VLAN > 0.
            if (vid > 0) {
              if (w.vlanModePath && String(w.vlanMode) !== '2') pvs.push([w.vlanModePath, 2, 'xsd:int']);
              else if (!w.vlanModePath && w.vlanEnablePath && !isOn(w.vlanEnable)) pvs.push([w.vlanEnablePath, true, w.vlanEnableType]);
            }
          }
        }
      });
      if (!pvs.length) { message.info('Tidak ada perubahan'); setSaving(false); return; }
      await setParams(did, pvs); await onSaved(); message.success('WAN disimpan & dikirim ke ONU');
    } catch (e) { message.error('Gagal simpan WAN'); } finally { setSaving(false); }
  };

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button icon={<ReloadOutlined />} loading={busy === 'refresh'} onClick={doRefresh}>Refresh WAN</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>Tambah WAN</Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{wans.length} koneksi WAN</Typography.Text>
      </Space>
      <AddWanModal open={addOpen} onClose={() => setAddOpen(false)} did={did} hasGlc={hasGlc} vlanScheme={vlanScheme} ifOpts={ifOpts} onDone={async () => { await refreshWan(did); await onSaved(); }} />
      {!wans.length ? <div><Typography.Text type="secondary">Belum ada data WAN — klik "Refresh WAN".</Typography.Text></div> : (
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Row gutter={[16, 16]}>
            {wans.map((w) => (
              <Col xs={24} lg={12} key={w.key}>
                <Card size="small"
                  title={<span>WAN {w.di}/{w.ci} <Tag color={w.ppp ? 'purple' : 'blue'}>{w.ppp ? 'PPPoE' : 'IPoE'}</Tag> <Badge status={w.status === 'Connected' ? 'success' : 'default'} text={w.status || '-'} /></span>}
                  extra={<Space size={8}>
                    <Switch checkedChildren="ON" unCheckedChildren="OFF" checked={isOn(w.enable)} loading={busy === w.base} onChange={(c) => toggleEnable(w, c)} />
                    <Popconfirm title={`Hapus WAN ${w.di}/${w.ci}? (memutus koneksi ini)`} onConfirm={() => delWan(w)}>
                      <Button size="small" danger type="text" icon={<DeleteOutlined />} loading={busy === w.base} />
                    </Popconfirm>
                  </Space>}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>IP: {w.ip || '-'}{w.hasGlc && w.vlan != null ? ` · VLAN ${w.vlan}` : ''}{w.service ? ` · ${w.service}` : ''}</Typography.Text>
                  {w.hasLanIf && (
                    <div style={{ marginTop: 4 }}>
                      {(w.lanIf || '').split(',').map((s) => s.trim()).filter(Boolean).map((p) => <Tag key={p} color="geekblue" style={{ fontSize: 11 }}>{ifLabel(p, ifOpts)}</Tag>)}
                      {!(w.lanIf || '').trim() && <Typography.Text type="secondary" style={{ fontSize: 11 }}>tidak terbind ke LAN</Typography.Text>}
                    </div>
                  )}
                  <Form.Item label="Nama koneksi" name={'name_' + w.key} initialValue={w.name || ''} style={{ marginTop: 8, marginBottom: 8 }}><Input /></Form.Item>
                  <Row gutter={8}>
                    {w.hasGlc && (
                      <Col span={12}>
                        <Form.Item label={<span>VLAN ID <Switch size="small" style={{ marginLeft: 6 }} checkedChildren="ON" unCheckedChildren="OFF" checked={isOn(w.glcEnable)} loading={busy === w.base + ':glc'} onChange={(c) => toggleVlanLink(w, c)} /></span>}
                          name={'vlan_' + w.key} initialValue={w.vlan ?? ''} style={{ marginBottom: 8 }}
                          tooltip="VLANIDMark di GponLinkConfig. Isi VLAN → otomatis set Mode=tagged. 0 = untagged. Switch = enable/disable link VLAN (seperti di ONT).">
                          <Input type="number" placeholder="mis. 100" />
                        </Form.Item>
                      </Col>
                    )}
                    <Col span={w.hasGlc ? 12 : 24}>
                      <Form.Item label="ServiceList" name={'service_' + w.key} initialValue={w.service || ''} style={{ marginBottom: 8 }}>
                        <Select options={['TR069', 'INTERNET', 'VOIP', 'IPTV', 'OTHER', 'TR069_INTERNET'].map((t) => ({ value: t, label: t }))} allowClear showSearch />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item label="ConnectionType" name={'type_' + w.key} initialValue={w.type || ''} style={{ marginBottom: 8 }}>
                    <Select options={['IP_Routed', 'IP_Bridged', 'PPPoE_Routed', 'PPPoE_Bridged'].map((t) => ({ value: t, label: t }))} allowClear showSearch />
                  </Form.Item>
                  {w.hasLanIf && (
                    <Form.Item label="Bind ke LAN / WiFi (interface yang dilayani WAN ini)" name={'lanif_' + w.key}
                      initialValue={(w.lanIf || '').split(',').map((s) => s.trim()).filter(Boolean)} style={{ marginBottom: 8 }}
                      tooltip="Pilih port LAN dan/atau SSID WiFi yang akan memakai koneksi WAN ini. Kosong = tidak terhubung ke LAN manapun.">
                      <Select mode="multiple" allowClear placeholder="pilih LAN / WiFi" options={ifOpts}
                        optionFilterProp="label" maxTagCount="responsive" />
                    </Form.Item>
                  )}
                  {w.hasDhcp && (
                    <Form.Item label="DHCP server di LAN ini" name={'dhcp_' + w.key} valuePropName="checked" initialValue={isOn(w.dhcpServer)} style={{ marginBottom: 8 }}>
                      <Switch checkedChildren="Aktif" unCheckedChildren="Mati" />
                    </Form.Item>
                  )}
                  {w.ppp ? (
                    <>
                      <Form.Item label="PPPoE Username" name={'user_' + w.key} initialValue={w.username || ''} style={{ marginBottom: 8 }}><Input /></Form.Item>
                      <Form.Item label="PPPoE Password (kosong = tetap)" name={'pass_' + w.key} style={{ marginBottom: 0 }}><Input.Password placeholder="••••••" /></Form.Item>
                    </>
                  ) : (
                    <Form.Item label="AddressingType" name={'addr_' + w.key} initialValue={w.addr || ''} style={{ marginBottom: 0 }}>
                      <Select options={['DHCP', 'Static'].map((t) => ({ value: t, label: t }))} allowClear />
                    </Form.Item>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
          <Button type="primary" htmlType="submit" loading={saving} style={{ marginTop: 16 }}>Simpan Perubahan WAN</Button>
        </Form>
      )}
    </>
  );
}

// Klasifikasi tiap host: WiFi vs LAN/kabel. Sinyal utama InterfaceType ('802.11' vs
// 'Ethernet') tersedia di SEMUA vendor (ZTE/EPON/CT-COM). Layer2Interface (path ->
// WLANConfiguration.N) + AssociatedDevice MAC dipakai sbg bonus utk tahu nama SSID (ZTE).
function collectHosts(dev) {
  const out = [];
  const macToSsid = {};   // mac(lowercase) -> nama SSID (dari WLAN AssociatedDevice)
  const wlanSsid = {};    // 'li/wi' -> nama SSID (dari instance WLANConfiguration)
  try {
    const lans = dev.InternetGatewayDevice.LANDevice;
    for (const li in lans) {
      if (li.startsWith('_')) continue;
      const wc = lans[li].WLANConfiguration || {};
      for (const wi in wc) {
        if (wi.startsWith('_')) continue;
        const ssid = val(wc[wi].SSID) || '';
        wlanSsid[`${li}/${wi}`] = ssid;
        const ad = wc[wi].AssociatedDevice || {};
        for (const ak in ad) {
          if (ak.startsWith('_')) continue;
          const m = val(ad[ak].AssociatedDeviceMACAddress);
          if (m) macToSsid[String(m).toLowerCase()] = ssid;
        }
      }
    }
    for (const li in lans) {
      if (li.startsWith('_')) continue;
      const hh = (lans[li].Hosts || {}).Host || {};
      for (const k in hh) {
        if (k.startsWith('_')) continue;
        const x = hh[k];
        const itype = (val(x.InterfaceType) || '').toString();
        const l2 = (val(x.Layer2Interface) || val(x.Layer1Interface) || '').toString();
        const mac = val(x.MACAddress);
        const macLc = mac ? String(mac).toLowerCase() : '';
        const wlanMatch = l2.match(/WLANConfiguration\.(\d+)/i);
        let conn = 'unknown', ssid = '';
        if (/^802\.11/i.test(itype) || /wlan|wifi/i.test(itype) || wlanMatch || macToSsid[macLc] !== undefined) {
          conn = 'wifi';
          if (wlanMatch) ssid = wlanSsid[`${li}/${wlanMatch[1]}`] || '';
          if (!ssid && macToSsid[macLc] !== undefined) ssid = macToSsid[macLc];
        } else if (/ethernet|802\.3/i.test(itype) || /ethernet/i.test(l2)) {
          conn = 'lan';
        }
        out.push({
          key: `${li}-${k}`, name: val(x.HostName), ip: val(x.IPAddress), mac,
          active: val(x.Active), source: val(x.AddressSource), itype, conn, ssid,
        });
      }
    }
  } catch (e) {}
  return out;
}

function HostsTab({ dev, did, onReload }) {
  const [busy, setBusy] = useState(false);
  const hosts = collectHosts(dev);
  const nWifi = hosts.filter((h) => h.conn === 'wifi').length;
  const nLan = hosts.filter((h) => h.conn === 'lan').length;
  const nOther = hosts.length - nWifi - nLan;
  const loadHosts = async () => {
    setBusy(true);
    try {
      await refreshHosts(did);
      message.info('Memuat daftar perangkat dari ONU (10–15 detik)...');
      // Sebagian firmware (mis. SIGMA) melaporkan tabel host tidak konsisten -> refresh bisa
      // 'too_many_commits' (data tetap terambil sebagian). Bersihkan fault tsb otomatis agar
      // tidak menumpuk di halaman Faults. Clear 2x (8s & 15s) untuk menangkap fault yang telat muncul.
      const cleanup = async (final) => {
        try { const n = await clearDeviceFaults(did); if (n && final) message.warning('Tabel host ONU dinamis — ditampilkan data yang sempat terbaca.'); } catch (e) {}
        onReload();
        if (final) setBusy(false);
      };
      setTimeout(() => cleanup(false), 8000);
      setTimeout(() => cleanup(true), 15000);
    } catch (e) { message.error('Gagal memuat'); setBusy(false); }
  };
  const connTag = (h) => {
    if (h.conn === 'wifi') return <Tag color="green" icon={<WifiOutlined />}>WiFi{h.ssid ? ' · ' + h.ssid : ''}</Tag>;
    if (h.conn === 'lan') return <Tag color="blue" icon={<ApartmentOutlined />}>LAN / Kabel</Tag>;
    return <Tag>{h.itype || 'Lainnya'}</Tag>;
  };
  const cols = [
    { title: 'Hostname', dataIndex: 'name', render: (v) => v || '-' }, { title: 'IP', dataIndex: 'ip', render: (v) => v || '-' },
    { title: 'MAC', dataIndex: 'mac', render: (v) => v || '-' },
    { title: 'Koneksi', dataIndex: 'conn',
      filters: [{ text: 'WiFi', value: 'wifi' }, { text: 'LAN / Kabel', value: 'lan' }, { text: 'Lainnya', value: 'unknown' }],
      onFilter: (v, r) => r.conn === v,
      render: (_, h) => connTag(h) },
    { title: 'Aktif', dataIndex: 'active', render: (v) => (v === true || v === 'true') ? <Tag color="green">Ya</Tag> : <Tag>Tidak</Tag> },
  ];
  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button onClick={loadHosts} loading={busy} icon={<ReloadOutlined />}>
          Muat / Refresh Perangkat Terhubung
        </Button>
        {hosts.length > 0 && (
          <Space size={4} wrap>
            <Tag color="green" icon={<WifiOutlined />}>{nWifi} WiFi</Tag>
            <Tag color="blue" icon={<ApartmentOutlined />}>{nLan} Kabel</Tag>
            {nOther > 0 && <Tag>{nOther} lainnya</Tag>}
          </Space>
        )}
      </Space>
      {hosts.length
        ? <Table size="small" columns={cols} dataSource={hosts} pagination={false} rowKey="key" />
        : <div><Typography.Text type="secondary">Belum ada data. Klik tombol di atas untuk memuat daftar perangkat dari ONU (di-fetch saat dibutuhkan, tidak otomatis demi menjaga beban ONU).</Typography.Text></div>}
    </>
  );
}

function ParamsTab({ did, params, onChange }) {
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState(null);
  const [val, setVal] = useState('');
  const data = params.filter((p) => !q || p.path.toLowerCase().includes(q.toLowerCase()) || String(p.value).toLowerCase().includes(q.toLowerCase()));
  const save = async () => {
    try { await setParams(did, [[edit.path, val, edit.type || 'xsd:string']]); message.success('Dikirim ke ONU'); setEdit(null); setTimeout(onChange, 6000); }
    catch (e) { message.error('Gagal'); }
  };
  const cols = [
    { title: 'Parameter', dataIndex: 'path', width: '55%', render: (t) => <Typography.Text style={{ fontSize: 12 }} copyable={{ text: t }}>{t}</Typography.Text> },
    { title: 'Nilai', dataIndex: 'value', render: (v) => <span style={{ fontSize: 12 }}>{String(v)}</span> },
    { title: '', width: 60, render: (_, r) => (r.writable && can('param.edit')) ? <Button size="small" icon={<EditOutlined />} onClick={() => { setEdit(r); setVal(String(r.value ?? '')); }} /> : null },
  ];
  return (
    <>
      <Input.Search placeholder="Cari parameter / nilai..." allowClear onChange={(e) => setQ(e.target.value)} style={{ width: 340, marginBottom: 12 }} />
      <Table size="small" columns={cols} dataSource={data} rowKey="path" pagination={{ defaultPageSize: 25, showSizeChanger: true, pageSizeOptions: ['10', '25', '50', '100'], showTotal: (t) => `${t} parameter` }} />
      <Modal title="Edit parameter" open={!!edit} onOk={save} onCancel={() => setEdit(null)} okText="Kirim ke ONU">
        <Typography.Paragraph style={{ fontSize: 12 }} type="secondary">{edit?.path}</Typography.Paragraph>
        <Input value={val} onChange={(e) => setVal(e.target.value)} />
      </Modal>
    </>
  );
}
