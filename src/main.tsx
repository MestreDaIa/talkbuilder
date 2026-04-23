import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { EmbedProvider } from "./context/EmbedContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <EmbedProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </EmbedProvider>
    </BrowserRouter>
  </StrictMode>
);
