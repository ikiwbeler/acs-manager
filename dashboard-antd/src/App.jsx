import { useState, useEffect, useCallback } from 'react';
import { Layout, Menu, Badge, Drawer, Button, Grid, Dropdown } from 'antd';
import {
  DashboardOutlined, ClusterOutlined, ReloadOutlined, WarningOutlined,
  SettingOutlined, CodeOutlined, FunctionOutlined, ProfileOutlined, FileZipOutlined,
  ControlOutlined, SafetyCertificateOutlined, TeamOutlined, HistoryOutlined, ApiOutlined,
  MenuOutlined, UserOutlined, LogoutOutlined,
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

const { Header, Sider, Content } = Layout;

export default function App() {
  if (!isAuthed()) return <Login />;
  const [devices, setDevices] = useState([]);
  const [faultCount, setFaultCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg; // < 992px

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

  const menuItems = [
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
  ];

  const onMenuClick = (e) => { nav(e.key === 'overview' ? '/' : '/' + e.key); setDrawerOpen(false); };
  const brand = <div style={{ color: '#fff', fontWeight: 700, padding: 16, fontSize: 16 }}>ACS Manager</div>;
  const menu = (
    <Menu theme="dark" mode="inline" selectedKeys={[selected]} defaultOpenKeys={['admin']}
      onClick={onMenuClick} items={menuItems} style={{ borderInlineEnd: 0 }} />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider width={220}>
          {brand}
          {menu}
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={240}
          closable={false}
          styles={{ body: { padding: 0, background: '#001529' }, header: { display: 'none' } }}
        >
          {brand}
          {menu}
        </Drawer>
      )}
      <Layout>
        <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: isMobile ? 12 : 24, gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {isMobile && <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} style={{ marginInlineStart: -8 }} />}
            <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 20, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isMobile ? 'ACS Manager' : 'GenieACS Dashboard'}
            </h2>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 20, flexShrink: 0 }}>
            <a onClick={load} style={{ cursor: 'pointer' }}><ReloadOutlined spin={loading} />{!isMobile && ' Refresh'}</a>
            <Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: 'Logout', onClick: logout }] }}>
              <a style={{ cursor: 'pointer' }}><UserOutlined />{!isMobile && <> {currentUser()} <span style={{ color: '#888', fontSize: 12 }}>({currentRoles() || 'no-role'})</span></>}</a>
            </Dropdown>
          </span>
        </Header>
        <Content style={{ margin: isMobile ? 12 : 24 }}>
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
