import { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, message, Popconfirm } from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { getAccounts, createAccount, deleteAccount, startBot, stopBot, syncGroups, loginAccount } from '../services/api';

interface Account {
  id: number;
  phone: string;
  status: string;
  created_at: string;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [loginModalVisible, setLoginModalVisible] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [form] = Form.useForm();
  const [loginForm] = Form.useForm();

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await getAccounts();
      setAccounts(res.data);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleCreate = async (values: any) => {
    try {
      await createAccount(values);
      message.success('账号创建成功，请登录');
      setModalVisible(false);
      form.resetFields();
      loadAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '创建失败');
    }
  };

  const handleLogin = async (values: any) => {
    if (!currentAccount) return;
    try {
      const res = await loginAccount(currentAccount.id, values);
      if (res.data.status === 'code_sent') {
        message.success('验证码已发送');
      } else if (res.data.status === 'success') {
        message.success('登录成功');
        setLoginModalVisible(false);
        loginForm.resetFields();
        loadAccounts();
      }
    } catch (error: any) {
      message.error(error.response?.data?.detail || '登录失败');
    }
  };

  const handleStart = async (id: number) => {
    try {
      await startBot(id);
      message.success('Bot 已启动');
      loadAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '启动失败');
    }
  };

  const handleStop = async (id: number) => {
    try {
      await stopBot(id);
      message.success('Bot 已停止');
      loadAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '停止失败');
    }
  };

  const handleSync = async (id: number) => {
    try {
      const res = await syncGroups(id);
      message.success(res.data.message);
      loadAccounts();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '同步失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteAccount(id);
      message.success('已删除');
      loadAccounts();
    } catch (error: any) {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'running') color = 'success';
        else if (status.includes('错误') || status.includes('Flood')) color = 'error';
        else if (status === '需要登录') color = 'warning';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => text.slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Account) => (
        <Space>
          {record.status === 'running' ? (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={() => handleStop(record.id)}>
              停止
            </Button>
          ) : (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleStart(record.id)}>
              启动
            </Button>
          )}
          <Button
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleSync(record.id)}
          >
            同步群组
          </Button>
          <Button
            size="small"
            onClick={() => {
              setCurrentAccount(record);
              setLoginModalVisible(true);
            }}
          >
            登录
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          添加账号
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={accounts}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="添加账号"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="phone" label="手机号" rules={[{ required: true }]}>
            <Input placeholder="+8613800138000" />
          </Form.Item>
          <Form.Item name="api_id" label="API ID" rules={[{ required: true }]}>
            <Input placeholder="从 my.telegram.org 获取" />
          </Form.Item>
          <Form.Item name="api_hash" label="API Hash" rules={[{ required: true }]}>
            <Input placeholder="从 my.telegram.org 获取" />
          </Form.Item>
          <Form.Item name="session_name" label="Session 名称" rules={[{ required: true }]}>
            <Input placeholder="例如: account_1" />
          </Form.Item>
          <Form.Item name="reply_message" label="自动回复内容">
            <Input.TextArea rows={3} placeholder="收到私信时自动回复的内容" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="登录账号"
        open={loginModalVisible}
        onCancel={() => setLoginModalVisible(false)}
        footer={null}
      >
        <Form form={loginForm} onFinish={handleLogin} layout="vertical">
          <Form.Item name="phone" label="手机号" rules={[{ required: true }]}>
            <Input placeholder={currentAccount?.phone} />
          </Form.Item>
          <Form.Item name="code" label="验证码">
            <Input placeholder="首次登录需要验证码" />
          </Form.Item>
          <Form.Item name="password" label="两步验证密码（如有）">
            <Input.Password placeholder="如果设置了两步验证" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                登录/发送验证码
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
