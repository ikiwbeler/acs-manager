import { Row, Col, Card, Statistic, Spin } from 'antd';
import { Pie } from '@ant-design/plots';

function countBy(devices, fn) {
  const m = {};
  devices.forEach((d) => { const k = fn(d) ?? 'N/A'; m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).map(([type, value]) => ({ type, value }));
}
function PieCard({ title, data }) {
  return (
    <Card title={title} styles={{ body:{ paddingTop: 8 } }}>
      <Pie data={data} angleField="value" colorField="type" radius={0.9} height={240}
        legend={{ color:{ position:'bottom' } }} label={{ text:'value', position:'outside' }}/>
    </Card>
  );
}
export default function Overview({ devices, loading }) {
  if (loading && !devices.length) return <Spin size="large" style={{display:'block',marginTop:80}}/>;
  const online = devices.filter(d=>d.online).length;
  const kritis = devices.filter(d=>d.redaman==='Kritis'||d.suhu==='Kritis').length;
  const warn = devices.filter(d=>d.redaman==='Warning'||d.suhu==='Warning').length;
  return (
    <>
      <Row gutter={[16,16]}>
        <Col xs={12} lg={5}><Card><Statistic title="Total ONU" value={devices.length}/></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Online" value={online} valueStyle={{color:'#3f8600'}}/></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Offline" value={devices.length-online} valueStyle={{color:'#cf1322'}}/></Card></Col>
        <Col xs={12} lg={4}><Card><Statistic title="Warning" value={warn} valueStyle={{color:'#d48806'}}/></Card></Col>
        <Col xs={12} lg={5}><Card><Statistic title="Kritis (RX/Suhu)" value={kritis} valueStyle={{color:'#cf1322'}}/></Card></Col>
      </Row>
      <Row gutter={[16,16]} style={{marginTop:16}}>
        <Col xs={24} md={12} lg={8}><PieCard title="Status Online" data={countBy(devices,d=>d.online?'Online':'Offline')}/></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="Tipe ONT" data={countBy(devices,d=>d.model)}/></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="PON Mode" data={countBy(devices,d=>d.mode)}/></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="Status Redaman (Optical RX)" data={countBy(devices,d=>d.redaman)}/></Col>
        <Col xs={24} md={12} lg={8}><PieCard title="Status Suhu" data={countBy(devices,d=>d.suhu)}/></Col>
      </Row>
    </>
  );
}
