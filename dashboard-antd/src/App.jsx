import { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Badge } from 'antd';
import {
  DashboardOutlined, ClusterOutlined, ReloadOutlined, WarningOutlined,
  SettingOutlined, CodeOutlined, FunctionOutlined, ProfileOutlined, FileZipOutlined,
  ControlOutlined, SafetyCertificateOutlined, TeamOutlined, HistoryOutlined, ApiOutlined,
} from '@ant-design/icons';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Overview from './pages/Overview.jsx';
import Devices from './pages/Devices.jsx';
import DeviceDetail from './pages/DeviceDetail.jsx';
import Faults from './pages/Faults.jsx';
import ScriptAdmin from './pages/ScriptAdmin.jsx';
import Presets from './pages/Presets.jsx';
import Files from './pages/Files.jsx';
import Config from './pages/Config.jsx';
import Permissions from './pages/Permissions.jsx';
import Users from './pages/Users.jsx';
import ApiAccess from './pages/ApiAccess.jsx';
import Audit from './pages/Audit.jsx';
import Login from './pages/Login.jsx';
import { getDevices, getFaults, isAuthed, currentUser, currentRoles, logout, isAdmin } from './api.js';
import { Dropdown } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';

const { Header, Sider, Content } = Layout;

export default function App() {
  if (!isAuthed()) return <Login />;
  const [devices, setDevices] = useState([]);
  const [faultCount, setFaultCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDevices(await getDevices());
      try { setFaultCount((await getFaults()).length); } catch (e) {}
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const p = loc.pathname;
  let selected = 'overview';
  if (p.startsWith('/devices') || p.startsWith('/device/')) selected = 'devices';
  else if (p.startsWith('/faults')) selected = 'faults';
  else if (p.startsWith('/audit')) selected = 'audit';
  else if (p.startsWith('/admin/')) selected = p.slice(1);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" width={220}>
        <div style={{ color: '#fff', fontWeight: 700, padding: 16, fontSize: 16 }}>ACS Manager</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selected]} defaultOpenKeys={['admin']}
          onClick={(e) => nav(e.key === 'overview' ? '/' : '/' + e.key)}
          items={[
            { key: 'overview', icon: <DashboardOutlined />, label: 'Overview' },
            { key: 'devices', icon: <ClusterOutlined />, label: 'Perangkat ONU' },
            { key: 'faults', icon: <WarningOutlined />, label: <span>Faults {faultCount > 0 && <Badge count={faultCount} size="small" />}</span> },
            { key: 'audit', icon: <HistoryOutlined />, label: 'Log Aktivitas' },
            ...(isAdmin() ? [
              { type: 'divider' },
              { key: 'admin', icon: <SettingOutlined />, label: 'Admin', children: [
                { key: 'admin/presets', icon: <ProfileOutlined />, label: 'Presets' },
                { key: 'admin/provisions', icon: <CodeOutlined />, label: 'Provisions' },
                { key: 'admin/virtual-parameters', icon: <FunctionOutlined />, label: 'Virtual Parameters' },
                { key: 'admin/files', icon: <FileZipOutlined />, label: 'Files' },
                { key: 'admin/config', icon: <ControlOutlined />, label: 'Config' },
                { key: 'admin/permissions', icon: <SafetyCertificateOutlined />, label: 'Permissions' },
                { key: 'admin/users', icon: <TeamOutlined />, label: 'Users' },
                { key: 'admin/api-access', icon: <ApiOutlined />, label: 'API & Webhook' },
              ] },
            ] : []),
          ]} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 24 }}>
          <h2 style={{ margin: 0 }}>GenieACS Dashboard</h2>
          <span style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a onClick={load} style={{ cursor: 'pointer' }}><ReloadOutlined spin={loading} /> Refresh</a>
            <Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: logout }] }}>
              <a style={{ cursor: 'pointer' }}><UserOutlined /> {currentUser()} <span style={{ color: '#888', fontSize: 12 }}>({currentRoles() || 'no-role'})</span></a>
            </Dropdown>
          </span>
        </Header>
        <Content style={{ margin: 24 }}>
          <Routes>
            <Route path="/" element={<Overview devices={devices} loading={loading} />} />
            <Route path="/devices" element={<Devices devices={devices} loading={loading} reload={load} />} />
            <Route path="/device/:id" element={<DeviceDetail />} />
            <Route path="/faults" element={<Faults />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="/admin/presets" element={<Presets />} />
            <Route path="/admin/provisions" element={<ScriptAdmin key="provisions" resource="provisions" title="Provisions" />} />
            <Route path="/admin/virtual-parameters" element={<ScriptAdmin key="virtual_parameters" resource="virtual_parameters" title="Virtual Parameters" />} />
            <Route path="/admin/files" element={<Files />} />
            <Route path="/admin/config" element={<Config />} />
            <Route path="/admin/permissions" element={<Permissions />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/api-access" element={<ApiAccess />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
