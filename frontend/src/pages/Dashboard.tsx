import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tag } from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { getStats, getLogs } from '../services/api';

interface Stats {
  accounts_total: number;
  accounts_running: number;
  groups_enabled: number;
  today_success: number;
  today_failed: number;
  success_rate: number;
}

interface Log {
  id: number;
  account_phone: string;
  group_title: string;
  status: string;
  message: string;
  error: string;
  created_at: string;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes] = await Promise.all([
        getStats(),
        getLogs({ limit: 20 }),
      ]);
      setStats(statsRes.data);
      setLogs(logsRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30秒刷新
    return () => clearInterval(interval);
  }, []);

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => text.slice(0, 19).replace('T', ' '),
    },
    {
      title: '账号',
      dataIndex: 'account_phone',
      key: 'account_phone',
      width: 150,
    },
    {
      title: '群组',
      dataIndex: 'group_title',
      key: 'group_title',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        if (status === 'success') {
          return <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>;
        }
        return <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>;
      },
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      width: 150,
    },
    {
      title: '错误',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="账号总数"
              value={stats?.accounts_total || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="运行中"
              value={stats?.accounts_running || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="启用群组"
              value={stats?.groups_enabled || 0}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="今日成功率"
              value={stats?.success_rate || 0}
              suffix="%"
              valueStyle={{ color: stats && stats.success_rate >= 80 ? '#3f8600' : '#cf1322' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12}>
          <Card title="今日发送统计" loading={loading}>
            <Statistic
              title="成功"
              value={stats?.today_success || 0}
              valueStyle={{ color: '#3f8600' }}
              suffix={`/ ${(stats?.today_success || 0) + (stats?.today_failed || 0)}`}
            />
            <Statistic
              title="失败"
              value={stats?.today_failed || 0}
              valueStyle={{ color: '#cf1322' }}
              style={{ marginTop: 16 }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近日志" style={{ marginTop: 16 }} loading={loading}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Card>
    </div>
  );
}
