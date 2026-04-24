
import './App.css'

import { useEffect } from 'react';
import { Routes, Route, useLocation } from "react-router-dom";

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

function UnknownRouteHandler() {
  const location = useLocation();

  useEffect(() => {
    const rawPath = decodeURIComponent(location.pathname);
    if (!rawPath.startsWith('/http://') && !rawPath.startsWith('/https://')) return;

    try {
      const parsedUrl = new URL(rawPath.slice(1));
      const sanitizedPath = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;

      if (sanitizedPath && sanitizedPath !== `${location.pathname}${location.search}${location.hash}`) {
        window.location.replace(sanitizedPath);
      }
    } catch (error) {
      console.error('[App] Não foi possível sanitizar a URL colada no preview:', error);
    }
  }, [location.hash, location.pathname, location.search]);

  const looksLikeAbsoluteUrl = location.pathname.startsWith('/http://') || location.pathname.startsWith('/https://');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">
          {looksLikeAbsoluteUrl ? 'Redirecionando...' : 'Página não encontrada'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {looksLikeAbsoluteUrl
            ? 'Corrigindo a URL aberta no preview.'
            : 'A rota que você abriu não existe neste app.'}
        </p>
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

      <Route path="*" element={<UnknownRouteHandler />} />
    </Routes>
  );
}

export default App;
