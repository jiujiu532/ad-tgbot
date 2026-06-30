import { useEffect, useState } from 'react';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  TeamOutlined,
  MessageOutlined,
  SettingOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Groups from './pages/Groups';
import Templates from './pages/Templates';
import Logs from './pages/Logs';
import Settings from './pages/Settings';

const { Header, Content, Sider } = Layout;

type MenuItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
};

const menuItems: MenuItem[] = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: '控制台' },
  { key: 'accounts', icon: <UserOutlined />, label: '账号管理' },
  { key: 'groups', icon: <TeamOutlined />, label: '群组管理' },
  { key: 'templates', icon: <MessageOutlined />, label: '消息模板' },
  { key: 'logs', icon: <FileTextOutlined />, label: '日志' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' },
];

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      console.log('WebSocket:', JSON.parse(event.data));
    };
    return () => ws.close();
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'accounts': return <Accounts />;
      case 'groups': return <Groups />;
      case 'templates': return <Templates />;
      case 'logs': return <Logs />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 64, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: 'white', margin: 0, fontSize: 18 }}>TG 广告 Bot</h2>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[currentPage]}
          items={menuItems}
          onClick={({ key }) => setCurrentPage(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 'bold' }}>
            {menuItems.find((item) => item.key === currentPage)?.label}
          </span>
        </Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div style={{ padding: 24, minHeight: 360, background: colorBgContainer, borderRadius: borderRadiusLG }}>
            {renderPage()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;
