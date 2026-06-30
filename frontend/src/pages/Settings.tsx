import { useEffect, useState } from 'react';
import { Form, InputNumber, Switch, Input, Button, Card, message, Space } from 'antd';
import { getSettings, updateSettings } from '../services/api';

export default function Settings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await getSettings();
      form.setFieldsValue({
        send_start_hour: Number(res.data.send_start_hour || 0),
        send_end_hour: Number(res.data.send_end_hour || 24),
        random_delay_enabled: res.data.random_delay_enabled === '1',
        random_delay_min: Number(res.data.random_delay_min || 25),
        random_delay_max: Number(res.data.random_delay_max || 35),
        notify_on_fail: res.data.notify_on_fail === '1',
        notify_on_ban: res.data.notify_on_ban === '1',
        notify_admin_user: res.data.notify_admin_user || '',
      });
    } catch (error) {
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (values: any) => {
    try {
      await updateSettings({
        send_start_hour: String(values.send_start_hour),
        send_end_hour: String(values.send_end_hour),
        random_delay_enabled: values.random_delay_enabled ? '1' : '0',
        random_delay_min: String(values.random_delay_min),
        random_delay_max: String(values.random_delay_max),
        notify_on_fail: values.notify_on_fail ? '1' : '0',
        notify_on_ban: values.notify_on_ban ? '1' : '0',
        notify_admin_user: values.notify_admin_user || '',
      });
      message.success('设置已保存');
    } catch (error) {
      message.error('保存失败');
    }
  };

  return (
    <Form form={form} onFinish={handleSave} layout="vertical" style={{ maxWidth: 600 }}>
      <Card title="发送时间限制" style={{ marginBottom: 16 }}>
        <Space>
          <Form.Item name="send_start_hour" label="开始时间（时）">
            <InputNumber min={0} max={23} />
          </Form.Item>
          <Form.Item name="send_end_hour" label="结束时间（时）">
            <InputNumber min={1} max={24} />
          </Form.Item>
        </Space>
        <div style={{ color: '#999', fontSize: 12 }}>
          设置为 0-24 表示全天发送，设置为 9-18 表示只在 9:00-18:00 发送
        </div>
      </Card>

      <Card title="随机延迟" style={{ marginBottom: 16 }}>
        <Form.Item name="random_delay_enabled" label="启用随机延迟" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Space>
          <Form.Item name="random_delay_min" label="最小间隔（分钟）">
            <InputNumber min={5} max={1440} />
          </Form.Item>
          <Form.Item name="random_delay_max" label="最大间隔（分钟）">
            <InputNumber min={5} max={1440} />
          </Form.Item>
        </Space>
        <div style={{ color: '#999', fontSize: 12 }}>
          启用后，每次发送的间隔会在最小和最大之间随机取值，以降低被检测风险
        </div>
      </Card>

      <Card title="通知设置" style={{ marginBottom: 16 }}>
        <Form.Item name="notify_on_fail" label="发送失败通知" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="notify_on_ban" label="账号被封通知" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="notify_admin_user" label="通知管理员">
          <Input placeholder="Telegram 用户名 (不带@)" />
        </Form.Item>
      </Card>

      <Form.Item>
        <Button type="primary" htmlType="submit" size="large" block loading={loading}>
          保存设置
        </Button>
      </Form.Item>
    </Form>
  );
}
