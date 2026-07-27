import { useState } from 'react';
import { Row, Col, Card, Statistic, Spin, Modal, Table, Tag, Badge, Empty, Typography } from 'antd';
import { Pie } from '@ant-design/plots';
import { useNavigate } from 'react-router-dom';

const redColor = { Normal: 'green', Warning: 'gold', Kritis: 'red', Overload: 'orange' };
const suhuColor = { Normal: 'green', Warning: 'gold', Kritis: 'red' };

// Keterangan tiap kategori (muncul di tooltip saat hover slice)
const DESC = {
  online: { Online: 'Aktif — inform < 5 menit', Disconnected: 'Tidak inform > 5 menit' },
  redaman: {
    Normal: 'Redaman optik normal (sinyal bagus)',
    Warning: 'Redaman mulai tinggi (waspada)',
    Kritis: 'Redaman buruk — sinyal lemah',
    Overload: 'Sinyal terlalu kuat (overload)',
    'N/A': 'Data redaman belum tersedia',
  },
  suhu: {
    Normal: 'Suhu perangkat normal',
    Warning: 'Suhu agak tinggi (waspada)',
    Kritis: 'Suhu kritis — perangkat panas',
    'N/A': 'Data suhu belum tersedia',
  },
  registrasi: {
    '24 jam terakhir': 'Terdaftar dalam 24 jam terakhir',
    '7 hari terakhir': 'Terdaftar 1–7 hari lalu',
    '30 hari terakhir': 'Terdaftar 8–30 hari lalu',
    '> 30 hari': 'Terdaftar lebih dari 30 hari lalu',
    'N/A': 'Tanggal registrasi tak tersedia',
  },
};

// Kelompokkan ONU berdasarkan kapan pertama terdaftar (field _registered)
function regBucket(d) {
  if (!d.registered) return 'N/A';
  const days = (Date.now() - new Date(d.registered).getTime()) / 86400000;
  if (days < 1) return '24 jam terakhir';
  if (days < 7) return '7 hari terakhir';
  if (days < 30) return '30 hari terakhir';
  return '> 30 hari';
}
// Selalu tampilkan 4 bucket (walau 0) supaya kategori kosong tetap muncul di legenda
const REG_ORDER = ['24 jam terakhir', '7 hari terakhir', '30 hari terakhir', '> 30 hari'];
function regData(devices) {
  const m = Object.fromEntries(REG_ORDER.map((k) => [k, 0]));
  let na = 0;
  devices.forEach((d) => { const k = regBucket(d); if (k in m) m[k]++; else na++; });
  const out = REG_ORDER.map((type) => ({ type, value: m[type] }));
  if (na) out.push({ type: 'N/A', value: na });
  return out;
}

function countBy(devices, fn) {
  const m = {};
  devices.forEach((d) => { const k = fn(d) ?? 'N/A'; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).map(([type, value]) => ({ type, value }));
}

function PieCard({ title, data, onSlice, descMap }) {
  return (
    <Card
      title={title}
      extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>klik untuk detail</Typography.Text>}
      styles={{ body: { paddingTop: 8 } }}
    >
      <Pie
        data={data} angleField="value" colorField="type" radius={0.9} height={240}
        legend={{ color: { position: 'bottom' } }} label={{ text: 'value', position: 'outside' }}
        tooltip={{
          title: (d) => (descMap && descMap[d.type]) || d.type,
          items: [{ field: 'value', name: 'Jumlah', valueFormatter: (v) => `${v} ONU` }],
        }}
        onReady={(ready) => {
          const chart = ready && ready.chart ? ready.chart : ready;
          if (!chart || typeof chart.on !== 'function' || chart.__sliceBound) return;
          chart.__sliceBound = true;
          const handler = (ev) => {
            const d = (ev && ev.data && ev.data.data) || (ev && ev.data) || {};
            const type = d.type ?? d.category ?? d.x;
            if (type != null && onSlice) onSlice(String(type));
          };
          chart.on('element:click', handler);
          chart.on('interval:click', handler);
        }}
      />
    </Card>
  );
}

export default function Overview({ devices, loading }) {
  const nav = useNavigate();
  const [drill, setDrill] = useState(null); // { title, filter }
  if (loading && !devices.length) return <Spin size="large" style={{ display: 'block', marginTop: 80 }} />;

  const online = devices.filter((d) => d.online).length;
  const kritis = devices.filter((d) => d.redaman === 'Kritis' || d.suhu === 'Kritis').length;
  const warn = devices.filter((d) => d.redaman === 'Warning' || d.suhu === 'Warning').length;

  const openSlice = (chartTitle, fn, type) =>
    setDrill({ title: `${chartTitle}: ${type}`, filter: (d) => (fn(d) ?? 'N/A') === type });
  const openStat = (title, filter) => setDrill({ title, filter });

  const rows = drill ? devices.filter(drill.filter) : [];
  const goDevice = (id) => { nav('/device/' + encodeURIComponent(id)); setDrill(null); };

  const statCard = (title, value, color, filter) => (
    <Card hoverable onClick={() => openStat(title, filter)} style={{ cursor: 'pointer' }}>
      <Statistic title={title} value={value} valueStyle={color ? { color } : undefined} />
    </Card>
  );

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={12} lg={5}>{statCard('Total ONU', devices.length, undefined, () => true)}</Col>
        <Col xs={12} lg={5}>{statCard('Online', online, '#3f8600', (d) => d.online)}</Col>
        <Col xs={12} lg={5}>{statCard('Disconnected', devices.length - online, '#cf1322', (d) => !d.online)}</Col>
        <Col xs={12} lg={4}>{statCard('Warning', warn, '#d48806', (d) => d.redaman === 'Warning' || d.suhu === 'Warning')}</Col>
        <Col xs={12} lg={5}>{statCard('Kritis (RX/Suhu)', kritis, '#cf1322', (d) => d.redaman === 'Kritis' || d.suhu === 'Kritis')}</Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12} lg={8}><PieCard title="Status Online" descMap={DESC.online} data={countBy(devices, (d) => (d.online ? 'Online' : 'Disconnected'))} onSlice={(t) => openSlice('Status Online', (d) => (d.online ? 'Online' : 'Disconnected'), t)} /></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="Tipe ONT" data={countBy(devices, (d) => d.model)} onSlice={(t) => openSlice('Tipe ONT', (d) => d.model, t)} /></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="PON Mode" data={countBy(devices, (d) => d.mode)} onSlice={(t) => openSlice('PON Mode', (d) => d.mode, t)} /></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="Status Redaman (Optical RX)" descMap={DESC.redaman} data={countBy(devices, (d) => d.redaman)} onSlice={(t) => openSlice('Status Redaman', (d) => d.redaman, t)} /></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="Status Suhu" descMap={DESC.suhu} data={countBy(devices, (d) => d.suhu)} onSlice={(t) => openSlice('Status Suhu', (d) => d.suhu, t)} /></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="Registrasi ONU" descMap={DESC.registrasi} data={regData(devices)} onSlice={(t) => openSlice('Registrasi', regBucket, t)} /></Col>
      </Row>

      <Modal
        open={!!drill} onCancel={() => setDrill(null)} footer={null} width={760}
        title={drill ? `${drill.title} — ${rows.length} ONU` : ''}
      >
        <Table
          size="small" dataSource={rows} rowKey="id"
          locale={{ emptyText: <Empty description="Tidak ada ONU" /> }}
          pagination={{ pageSize: 8, showTotal: (t) => `${t} ONU` }}
          scroll={{ x: 640 }}
          onRow={(r) => ({ onClick: () => goDevice(r.id), style: { cursor: 'pointer' } })}
          columns={[
            { title: 'SN', dataIndex: 'serial', width: 140 },
            { title: 'PPPoE', dataIndex: 'pppoe', width: 160 },
            { title: 'IP', dataIndex: 'ip', width: 120 },
            { title: 'Rx', dataIndex: 'rx', width: 80 },
            { title: 'Redaman', dataIndex: 'redaman', width: 100, render: (v) => v ? <Tag color={redColor[v] || 'default'}>{v}</Tag> : null },
            { title: 'Suhu', dataIndex: 'suhu', width: 90, render: (v) => v ? <Tag color={suhuColor[v] || 'default'}>{v}</Tag> : null },
            { title: 'Status', dataIndex: 'online', width: 120, render: (v) => <Badge status={v ? 'success' : 'error'} text={<span style={{ whiteSpace: 'nowrap' }}>{v ? 'Online' : 'Disconnected'}</span>} /> },
          ]}
        />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Klik baris untuk buka detail ONU.</Typography.Text>
      </Modal>
    </>
  );
}
