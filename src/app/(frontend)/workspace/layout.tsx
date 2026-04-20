"use client";

import DnDProvider from "./context/DnDProvider";
import { WorkspaceProvider } from "./context/WorkspaceContext";
import Header from "./(content_path_items)/Header";

export default function WorkspaceLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<WorkspaceProvider>
			<DnDProvider>
        <div className="flex w-full flex-col h-svh relative">
          <div>
            <Header />
          </div>
            {children}
          {/*<div className="flex-1 w-full border-2 h-full border-red-600 ">
            <div className="flex-1 h-full border-2 border-yellow-400 ">
            </div>
          </div> */}
        </div>
			</DnDProvider>
		</WorkspaceProvider>
	);
}
