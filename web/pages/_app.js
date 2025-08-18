import { ConfigProvider, App as AntApp } from "antd";
import { geneeezTheme } from "../theme";
import "../style.css";
import AuthProvider from "../context/AuthContext";

export default function App({ Component, pageProps }) {
  return (
    <ConfigProvider theme={geneeezTheme}>
      <AntApp>
        <AuthProvider>
          <Component {...pageProps} />
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  );
}
