import { useEffect, useState } from "react";

export default function Home() {
  const [api, setApi] = useState(null);

  useEffect(() => {
    fetch("http://localhost:8080/health")
      .then((r) => r.json())
      .then(setApi)
      .catch(() => setApi({ ok: false }));
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1>geneeez</h1>
      <p>No-code analytics for researchers.</p>
      <pre>API status: {api ? JSON.stringify(api) : "checking..."}</pre>
    </main>
  );
}
