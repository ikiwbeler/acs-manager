import { useState } from 'react';
import { Card, Form, Input, Button, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../api.js';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const onFinish = async (v) => {
    setLoading(true);
    try { await login(v.username, v.password); message.success('Login berhasil'); location.reload(); }
    catch (e) { message.error(e.message || 'Login gagal'); setLoading(false); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1677ff22,#f0f2f5)' }}>
      <Card style={{ width: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <Typography.Title level={3} style={{ marginBottom: 0 }}>ACS Manager</Typography.Title>
          <Typography.Text type="secondary">GenieACS Dashboard</Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" rules={[{ required: true, message: 'Masukkan username' }]}>
            <Input size="large" prefix={<UserOutlined />} placeholder="Username" autoFocus />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Masukkan password' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Button type="primary" size="large" htmlType="submit" block loading={loading}>Masuk</Button>
        </Form>
        <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0, textAlign: 'center' }}>
          Gunakan akun GenieACS (mis. admin)
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
