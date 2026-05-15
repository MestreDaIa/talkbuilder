import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import BotPage from "../pages/workspace/bot/[id]/page";
import { AuthProvider } from "../context/AuthContext";
import { WorkspaceProvider } from "../context/WorkspaceContext";

// Mocks necessários
vi.mock("../context/AuthContext", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({ user: { id: "test-user" }, profile: { slug: "test-slug" } }),
}));

vi.mock("../context/WorkspaceContext", () => ({
  WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWorkspace: () => ({ 
    bots: [{ id: "test-bot", title: "Test Bot", parentId: "folder-123" }],
    folders: [],
    loading: false 
  }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: "test-bot" }),
  };
});

// Mock do Supabase
vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: { id: "test-bot", name: "Test Bot" }, error: null }),
        }),
      }),
    }),
  }),
}));

describe("BotPage Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should navigate to workspace root when Back button is clicked, even if it has a parent folder", async () => {
    render(
      <BrowserRouter>
        <BotPage />
      </BrowserRouter>
    );

    const backButton = await screen.findByTitle("Voltar");
    await userEvent.click(backButton);

    // Deve navegar para o root, não para a pasta folder-123
    expect(mockNavigate).toHaveBeenCalledWith("/test-slug/workspace", { replace: true });
  });
});
