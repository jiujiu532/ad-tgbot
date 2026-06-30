import { useEffect, useState } from 'react';
import { Table, Tag, Select, Space, Button } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getLogs, getAccounts } from '../services/api';

interface Log {
  id: number;
  account_phone: string;
  group_id: string;
  group_title: string;
  status: string;
  message: string;
  error: string;
  created_at: string;
}

export default function Logs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [accountFilter, setAccountFilter] = useState<number | undefined>();
  const [accounts, setAccounts] = useState<{ id: number; phone: string }[]>([]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const [logsRes, accountsRes] = await Promise.all([
        getLogs({ limit: 200, status: statusFilter, account_id: accountFilter }),
        getAccounts(),
      ]);
      setLogs(logsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('加载日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [statusFilter, accountFilter]);

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
      width: 200,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const map: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
          success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
          failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
        };
        const item = map[status] || { color: 'default', icon: null, text: status };
        return <Tag color={item.color} icon={item.icon}>{item.text}</Tag>;
      },
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '错误信息',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select
          style={{ width: 120 }}
          placeholder="全部状态"
          allowClear
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { label: '成功', value: 'success' },
            { label: '失败', value: 'failed' },
          ]}
        />
        <Select
          style={{ width: 200 }}
          placeholder="全部账号"
          allowClear
          value={accountFilter}
          onChange={(v) => setAccountFilter(v)}
          options={accounts.map((a) => ({ label: a.phone, value: a.id }))}
        />
        <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
          刷新
        </Button>
      </Space>
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
      />
    </div>
  );
}
