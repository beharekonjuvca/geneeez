import { useEffect } from "react";
import { useRouter } from "next/router";
import { Spin } from "antd";
import { useAuth } from "../context/AuthContext";

export default function RequireAdmin({ children }) {
  const { user, initializing } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    if (!user) router.replace("/");
    else if (user.role !== "admin") router.replace("/dashboard");
  }, [initializing, user, router]);

  if (initializing || !user || user.role !== "admin") {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "60vh" }}>
        <Spin />
      </div>
    );
  }
  return children;
}
