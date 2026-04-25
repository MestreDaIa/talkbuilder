
import './App.css'

import { Routes, Route, Navigate, useParams } from "react-router-dom";

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
import { workspaceRoot } from './lib/workspaceRoutes';

/**
 * Raiz "/":
 * - Sem login (ou Supabase não configurado) → mostra landing pública.
 * - Logado → redireciona para /{slug}/workspace.
 */
function HomeRoute() {
  const { user, loading, isConfigured, profile } = useAuth();

  if (loading) return null;
  if (!isConfigured || !user) return <LandingPage />;
  // Logado: redireciona pro workspace pessoal
  return <Navigate to={workspaceRoot(profile?.slug)} replace />;
}

/**
 * Login/Signup: se já estiver logado, manda direto pro workspace.
 */
function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={workspaceRoot(profile?.slug)} replace />;
  return <>{children}</>;
}

/**
 * Garante que o slug da URL bate com o slug do usuário logado.
 * Se não bater, redireciona pro workspace certo.
 */
function SlugGuard({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth();
  const { slug } = useParams();
  if (loading) return null;
  // Se ainda não temos profile, deixa renderizar (evita flash de redirect)
  if (!profile?.slug) return <>{children}</>;
  if (slug && slug !== profile.slug) {
    return <Navigate to={workspaceRoot(profile.slug)} replace />;
  }
  return <>{children}</>;
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
      {/* Landing pública */}
      <Route path="/" element={<HomeRoute />} />

      {/* Auth */}
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />

      {/* Bot público publicado: /:slug/flow/:publicId */}
      <Route path="/:slug/flow/:publicId" element={<PublicFlowPage />} />

      {/* Workspace raiz do usuário: /:slug/workspace */}
      <Route
        path="/:slug/workspace"
        element={
          <ProtectedRoute>
            <SlugGuard>
              <Layout><WorkspaceMain /></Layout>
            </SlugGuard>
          </ProtectedRoute>
        }
      />

      {/* Pasta: /:slug/workspace/folder/:id */}
      <Route
        path="/:slug/workspace/folder/:id"
        element={
          <ProtectedRoute>
            <SlugGuard>
              <Layout><FolderPage /></Layout>
            </SlugGuard>
          </ProtectedRoute>
        }
      />

      {/* Editor do bot: /:slug/workspace/bot/:id */}
      <Route
        path="/:slug/workspace/bot/:id"
        element={
          <ProtectedRoute>
            <SlugGuard>
              <Layout><BotPage /></Layout>
            </SlugGuard>
          </ProtectedRoute>
        }
      />

      {/* Configs: /:slug/workspace/configs */}
      <Route
        path="/:slug/workspace/configs"
        element={
          <ProtectedRoute>
            <SlugGuard>
              <Layout><ConfigPage /></Layout>
            </SlugGuard>
          </ProtectedRoute>
        }
      />

      {/* Perfil: /:slug/workspace/perfil */}
      <Route
        path="/:slug/workspace/perfil"
        element={
          <ProtectedRoute>
            <SlugGuard>
              <Layout><PerfilPage /></Layout>
            </SlugGuard>
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

      {/* Compatibilidade: rotas antigas /workspace/... → redireciona pro novo formato */}
      <Route path="/workspace/*" element={<LegacyWorkspaceRedirect />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

/** Redireciona links antigos /workspace/... para /:slug/workspace/... */
function LegacyWorkspaceRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return null;
  const slug = profile?.slug ?? "u";
  // Pega o resto do path depois de /workspace
  const rest = window.location.pathname.replace(/^\/workspace/, "");
  return <Navigate to={`/${slug}/workspace${rest}`} replace />;
}

export default App;
