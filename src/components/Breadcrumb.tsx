import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useWorkspace } from "../context/WorkspaceContext";
import type { WorkspaceItemType } from "../types/workspace/workspaceTypes";

export default function Breadcrumb() {
  const { items } = useWorkspace();
  const router = useNavigate();
  const { pathname } = useLocation();

  // Deriva o folderId direto do pathname (Breadcrumb fica fora das <Route>s específicas)
  function getFolderIdFromPath(): string | undefined {
    const match = pathname.match(/\/workspace\/folder\/([^/]+)/);
    return match?.[1];
  }

  const folderId = getFolderIdFromPath();

  function buildPath() {
    if (!folderId) return [];

    const path: WorkspaceItemType[] = [];
    let current: WorkspaceItemType | undefined = items.find(
      (item) => item.id === folderId
    );

    while (current) {
      path.unshift(current);
      const parentId = current.parentId;
      if (!parentId) break;
      current = items.find((item) => item.id === parentId);
    }

    return path;
  }

  const path = buildPath();

  function handleBack() {
    if (!folderId) return;
    const current = items.find((i) => i.id === folderId);
    const parentId = current?.parentId;
    if (!parentId) {
      router(`/`);
      return;
    }
    return router(`/workspace/folder/${parentId}`);
  }

  return (
    <div className="p-3 h-12 flex items-center border-b relative gap-2">
      {folderId && (
        <button onClick={handleBack}>
          <ArrowLeft className="w-7 h-7 rounded-lg border p-1 text-white bg-gray-500/50 shadow-black shadow-[2px_3px_6px_-1px]" />
        </button>
      )}
      {path.map((folder) => (
        <div
          className="flex items-start justify-center relative text-gray-500 font-semibold cursor-pointer"
          key={folder.id}
          onClick={() => router(`/workspace/folder/${folder.id}`)}
        >
          <p
            className={`flex items-center mr-2 ml-2 justify-center ${
              folder.id === folderId ? "font-bold text-green-400" : ""
            }`}
          >
            {folder.emoji} {folder.title}
          </p>
          <p
            className={`${
              folder.id === folderId
                ? "hidden"
                : "flex justify-center items-center"
            }`}
          >
            /
          </p>
        </div>
      ))}
    </div>
  );
}
