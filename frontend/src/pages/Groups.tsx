import { useEffect, useState } from 'react';
import { Table, Switch, Select, Tag, message, InputNumber, Space } from 'antd';
import { getGroups, getTemplates, getAccounts, updateGroup } from '../services/api';

interface Group {
  id: number;
  group_id: string;
  title: string;
  username: string;
  account_phone: string;
  account_id: number;
  enabled: number;
  interval_minutes: number;
  message_template_id: number | null;
  template_name: string | null;
  last_sent_at: string | null;
}

interface Template {
  id: number;
  name: string;
}

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [accountFilter, setAccountFilter] = useState<number | undefined>();
  const [accounts, setAccounts] = useState<{ id: number; phone: string }[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsRes, templatesRes, accountsRes] = await Promise.all([
        getGroups(accountFilter),
        getTemplates(),
        getAccounts(),
      ]);
      setGroups(groupsRes.data);
      setTemplates(templatesRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accountFilter]);

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await updateGroup(id, { enabled });
      message.success(enabled ? '已启用' : '已禁用');
      loadData();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleIntervalChange = async (id: number, minutes: number) => {
    try {
      await updateGroup(id, { interval_minutes: minutes });
      message.success('间隔已更新');
    } catch (error) {
      message.error('更新失败');
    }
  };

  const handleTemplateChange = async (id: number, templateId: number | null) => {
    try {
      await updateGroup(id, { message_template_id: templateId });
      message.success('模板已更新');
      loadData();
    } catch (error) {
      message.error('更新失败');
    }
  };

  const columns = [
    {
      title: '群名称',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Group) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text || '未知群组'}</div>
          {record.username && (
            <div style={{ fontSize: 12, color: '#999' }}>@{record.username}</div>
          )}
        </div>
      ),
    },
    {
      title: '账号',
      dataIndex: 'account_phone',
      key: 'account_phone',
      width: 150,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: number, record: Group) => (
        <Switch checked={!!enabled} onChange={(v) => handleToggle(record.id, v)} />
      ),
    },
    {
      title: '间隔(分钟)',
      dataIndex: 'interval_minutes',
      key: 'interval_minutes',
      width: 130,
      render: (value: number, record: Group) => (
        <InputNumber
          min={5}
          max={1440}
          value={value}
          size="small"
          onChange={(v) => v && handleIntervalChange(record.id, v)}
        />
      ),
    },
    {
      title: '消息模板',
      dataIndex: 'message_template_id',
      key: 'message_template_id',
      width: 200,
      render: (_: any, record: Group) => (
        <Select
          size="small"
          style={{ width: '100%' }}
          value={record.message_template_id}
          onChange={(v) => handleTemplateChange(record.id, v)}
          placeholder="选择模板"
          allowClear
          options={templates.map((t) => ({ label: t.name, value: t.id }))}
        />
      ),
    },
    {
      title: '最后发送',
      dataIndex: 'last_sent_at',
      key: 'last_sent_at',
      width: 180,
      render: (text: string | null) =>
        text ? text.slice(0, 19).replace('T', ' ') : <Tag>未发送</Tag>,
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <span>筛选账号:</span>
        <Select
          style={{ width: 200 }}
          placeholder="全部账号"
          allowClear
          value={accountFilter}
          onChange={(v) => setAccountFilter(v)}
          options={accounts.map((a) => ({ label: a.phone, value: a.id }))}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={groups}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="small"
      />
    </div>
  );
}
