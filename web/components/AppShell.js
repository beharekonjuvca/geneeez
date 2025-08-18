import { Layout, Button, Space } from "antd";
import { useAuth } from "../context/AuthContext";
const { Header, Content } = Layout;

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  return (
    <Layout style={{ minHeight: "100vh", background: "#F5F7FA" }}>
      <Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
        }}
      >
        <div className="logo" style={{ color: "#fff", fontSize: 20 }}>
          <span className="dot">.</span>gen<span className="eStripe">eee</span>z
        </div>
        <Space>
          {user && (
            <span style={{ color: "#fff", opacity: 0.9 }}>{user.email}</span>
          )}
          {user && <Button onClick={logout}>Logout</Button>}
        </Space>
      </Header>
      <Content className="container">{children}</Content>
    </Layout>
  );
}
