import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// TEMP: hash router — usado enquanto o SPA fallback do hosting não estiver
// funcionando para deep links. Para reverter à URL limpa, troque `HashRouter`
// por `BrowserRouter` aqui e remova o `/#` em PublishDialog.getPublicUrl().
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { EmbedProvider } from "./context/EmbedContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <EmbedProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </EmbedProvider>
    </HashRouter>
  </StrictMode>
);
