
import './App.css'

import { Routes, Route } from "react-router-dom";

import BotPage from "./pages/workspace/bot/[id]/page";
import FolderPage from "./pages/workspace/folder/[id]/page";
import ConfigPage from "./pages/workspace/configs/page";
import PerfilPage from "./pages/workspace/perfil/page";
import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import LandingPage from "./pages/landing/LandingPage";

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

function App() {
  return (
    <Routes>
      {/* Rotas públicas (sem layout do workspace) */}
      <Route path="/" element={<HomeRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

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
    </Routes>
  );
}

export default App;
