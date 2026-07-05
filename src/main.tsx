import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { EmbedProvider } from "./context/EmbedContext";

if (typeof window !== "undefined" && window.location.hash.startsWith("#/")) {
  window.history.replaceState(null, "", window.location.hash.slice(1));
}

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
