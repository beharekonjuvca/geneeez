import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Card, Typography, Input, Button, Space, message, Spin } from "antd";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";

const { Title, Text } = Typography;

// Password rules (frontend UX; backend also validates)
const pwChecks = (pw) => ({
  len: pw.length >= 8 && pw.length <= 64,
  up: /[A-Z]/.test(pw),
  low: /[a-z]/.test(pw),
  num: /[0-9]/.test(pw),
  sp: /[^\w\s]/.test(pw), // special
  spc: !/\s/.test(pw), // no spaces
});

export default function Home() {
  const { user, initializing, login, signup } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // After the initial auth check, redirect if already logged in
  useEffect(() => {
    if (!initializing && user) router.replace("/datasets");
  }, [initializing, user, router]);

  const checks = pwChecks(password);
  const passwordsMatch = mode === "login" ? true : password === confirm;

  const canSubmit =
    mode === "login"
      ? Boolean(email && password)
      : Boolean(
          email &&
            password &&
            passwordsMatch &&
            Object.values(checks).every(Boolean)
        );

  async function submit() {
    setLoading(true);
    try {
      if (mode === "signup" && !passwordsMatch) {
        message.error("Passwords do not match");
        return;
      }
      if (mode === "login") await login(email, password);
      else await signup(email, password);
      message.success("Welcome to geneeez!");
      router.push("/datasets");
    } catch (e) {
      message.error(e?.response?.data?.detail || "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  if (initializing) {
    return (
      <AppShell>
        <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
          <Spin />
        </div>
      </AppShell>
    );
  }

  if (user) return null;

  return (
    <AppShell>
      <div style={{ display: "grid", placeItems: "center", minHeight: "70vh" }}>
        <Card className="card" style={{ width: 440 }}>
          <Title level={2} style={{ marginBottom: 6 }}>
            <span className="logo">
              <span className="dot">.</span>gen
              <span className="eStripe">eee</span>z
            </span>
          </Title>
          <Text type="secondary">No-code analytics for researchers</Text>

          <div style={{ height: 16 }} />

          <Space direction="vertical" style={{ width: "100%" }} size="large">
            <Input
              size="large"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input.Password
              size="large"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {mode === "signup" && (
              <>
                <Input.Password
                  size="large"
                  placeholder="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  status={
                    confirm.length > 0 ? (passwordsMatch ? "" : "error") : ""
                  }
                />
                {!passwordsMatch && confirm.length > 0 && (
                  <Text type="danger" style={{ fontSize: 12 }}>
                    Passwords do not match.
                  </Text>
                )}
                <div style={{ fontSize: 12, lineHeight: 1.7, marginTop: -4 }}>
                  <div style={{ opacity: checks.len ? 1 : 0.5 }}>
                    {checks.len ? "✓" : "•"} 8–64 characters
                  </div>
                  <div style={{ opacity: checks.up ? 1 : 0.5 }}>
                    {checks.up ? "✓" : "•"} 1 uppercase
                  </div>
                  <div style={{ opacity: checks.low ? 1 : 0.5 }}>
                    {checks.low ? "✓" : "•"} 1 lowercase
                  </div>
                  <div style={{ opacity: checks.num ? 1 : 0.5 }}>
                    {checks.num ? "✓" : "•"} 1 digit
                  </div>
                  <div style={{ opacity: checks.sp ? 1 : 0.5 }}>
                    {checks.sp ? "✓" : "•"} 1 special
                  </div>
                  <div style={{ opacity: checks.spc ? 1 : 0.5 }}>
                    {checks.spc ? "✓" : "•"} no spaces
                  </div>
                </div>
              </>
            )}

            <Button
              type="primary"
              size="large"
              block
              loading={loading}
              onClick={submit}
              disabled={!canSubmit}
            >
              {mode === "login" ? "Log in" : "Sign up"}
            </Button>

            <Button
              type="link"
              onClick={() => {
                const next = mode === "login" ? "signup" : "login";
                setMode(next);
                setPassword("");
                setConfirm("");
              }}
            >
              {mode === "login"
                ? "Create an account"
                : "Have an account? Log in"}
            </Button>
          </Space>
        </Card>
      </div>
    </AppShell>
  );
}
