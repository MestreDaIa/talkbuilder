import { ArrowLeft, ArrowRight, CircleArrowLeft, CircleArrowRight } from "lucide-react";
import { useWorkspace } from "../../context/WorkspaceContext";
import { useParams, useRouter } from "next/navigation";
import { WorkspaceItemType } from "@/types/workspace/workspaceTypes";

export default function Breadcrumb() {
 const { items } = useWorkspace();
 const router = useRouter();

 const params = useParams();

 const folderId = params?.id as string | undefined;

 function buildPath() {


  if (!folderId) return [];

  const path: WorkspaceItemType[] = [];

  let current: WorkspaceItemType | undefined = items.find(item => item.id === folderId);

  while (current) {
    path.unshift(current);
    const parentId = current.parentId;
    if (!parentId) break;
    current = items.find(item => item.id === parentId);
  }

  return path;
 }

 const path = buildPath();
function handleBack() {
  if (!folderId) return;
  const current =  items.find(i => i.id === folderId);

  const parentId = current?.parentId;
  if (!parentId) {
    router.push(`/workspace`);
    return;
  }
  return router.push(`/workspace/folder/${parentId}`);
 }

 return (
  <div className="p-3 h-12 flex items-center border-b relative mt-16">
   {folderId && (
    <button onClick={handleBack}><ArrowLeft className="w-7 h-7 rounded-lg border p-1 text-white bg-gray-500/50 shadow-black shadow-[2px_3px_6px_-1px]"  /></button>
   )}
    {path.map(folder => (
     <div className="flex items-start justify-center relative  text-gray-500 font-semibold" key={folder.id} onClick={() => router.push(`/workspace/folder/${folder.id}`)}>
      <p className={`flex items-center mr-2 ml-2 justify-center ${folder.id === folderId ? 'font-bold text-green-400' : ''}`}> {folder.title} </p>
      <p className={`${folder.id === folderId ? 'hidden' : 'flex justify-center items-center'}`}> / </p>
     </div>
    ))}
  </div>
 )
}