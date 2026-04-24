
import './App.css'

import { Routes, Route } from "react-router-dom";

import BotPage from "./pages/workspace/bot/[id]/page";
import FolderPage from "./pages/workspace/folder/[id]/page";
import ConfigPage from "./pages/workspace/configs/page";
import PerfilPage from "./pages/workspace/perfil/page";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import LandingPage from "./pages/landing/LandingPage";
import PreviewPage from "./pages/preview/[id]/page";
import PublicFlowPage from "./pages/public/flow/page";


import Layout from "./components/layout";
import WorkspaceMain from './components/Main';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';

function HomeRoute() {
  const { user, loading, isConfigured } = useAuth();
  if (loading) return null;
  // Sem Supabase configurado OU sem login → mostra landing pública
  if (!isConfigured || !user) return <LandingPage />;
  // Logado → workspace dentro do layout
  return (
    <Layout>
      <WorkspaceMain />
    </Layout>
  );
}

function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">404 — Página não encontrada</h1>
        <p className="text-sm text-muted-foreground">
          A rota que você abriu não existe neste app.
        </p>
        <a href="/" className="inline-block text-sm text-primary underline underline-offset-4">
          Voltar ao início
        </a>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Rotas públicas (sem layout do workspace) */}
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Rota pública do bot publicado */}
      <Route path="/:slug/flow/:publicId" element={<PublicFlowPage />} />

      {/* Rotas protegidas (com layout do workspace) */}
      <Route
        path="/workspace/bot/:id"
        element={
          <ProtectedRoute>
            <Layout><BotPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/folder/:id"
        element={
          <ProtectedRoute>
            <Layout><FolderPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/configs"
        element={
          <ProtectedRoute>
            <Layout><ConfigPage /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace/perfil"
        element={
          <ProtectedRoute>
            <Layout><PerfilPage /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Pré-visualização do rascunho (sem layout, fullscreen) */}
      <Route
        path="/preview/:id"
        element={
          <ProtectedRoute>
            <PreviewPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
