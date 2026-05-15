import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import BotPage from "../pages/workspace/bot/[id]/page";

// Mocks simples para isolar o componente
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ profile: { slug: "test-slug" } }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock("../context/WorkspaceContext", () => ({
  useWorkspace: () => ({ 
    items: [{ id: "test-bot", title: "Test Bot", parentId: "folder-123", type: "bot" }],
    setItems: vi.fn(),
  }),
  WorkspaceProvider: ({ children }: any) => children,
}));

// Evitar renderizar o CanvasEditor que causa problemas no JSDOM/ReactFlow
vi.mock("../components/chatbot/CanvasEditor", () => ({
  CanvasEditor: () => <div data-testid="canvas-editor" />,
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

vi.mock("../lib/supabaseClient", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: { id: "test-bot" }, error: null }),
        }),
      }),
    }),
  }),
}));

describe("BotPage Navigation", () => {
  it("should navigate to workspace root when Back button is clicked", async () => {
    render(
      <BrowserRouter>
        <BotPage />
      </BrowserRouter>
    );

    const backButton = await screen.findByTitle("Voltar");
    await userEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith("/test-slug/workspace", { replace: true });
  });
});
