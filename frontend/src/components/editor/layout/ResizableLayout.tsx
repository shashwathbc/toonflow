
import React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

interface ResizableLayoutProps {
    toolSidebar?: React.ReactNode; // Zone 1
    leftPanel?: React.ReactNode;   // Zone 2 (AI/Assets)
    children: React.ReactNode;     // Zone 3 (Canvas)
    rightPanel?: React.ReactNode;  // Zone 4 (Properties)
}

/**
 * 4-Zone Resizable Layout for the Editor.
 * Layout:
 * [ Tools ] | [ AI/Assets ] | [   Canvas   ] | [ Properties ]
 */
const ResizableLayout: React.FC<ResizableLayoutProps> = ({
    toolSidebar,
    leftPanel,
    children,
    rightPanel
}) => {
    return (
        <div className="h-[calc(100vh-64px)] w-full bg-zinc-950 overflow-hidden text-zinc-100 font-sans">
            <ResizablePanelGroup direction="horizontal">

                {/* ZONE 1: TOOLS (Narrow, often fixed width, but resizeable for future expansion) */}
                <ResizablePanel
                    defaultSize={4}
                    minSize={3}
                    maxSize={8}
                    className="bg-[#18181b] border-r border-zinc-800 flex flex-col items-center z-10"
                >
                    {toolSidebar}
                </ResizablePanel>

                <ResizableHandle className="bg-zinc-800 w-[1px] hover:bg-zinc-600 transition-colors" />

                {/* ZONE 2: AI / ASSETS */}
                <ResizablePanel
                    defaultSize={20}
                    minSize={15}
                    maxSize={30}
                    className="bg-[#1e1e1e] border-r border-zinc-800"
                >
                    {leftPanel}
                </ResizablePanel>

                <ResizableHandle className="bg-zinc-800 w-[1px] hover:bg-zinc-600 transition-colors" />

                {/* ZONE 3: CENTRE CANVAS */}
                <ResizablePanel defaultSize={56} minSize={30}>
                    <div className="h-full w-full bg-[#121212] relative">
                        {children}
                    </div>
                </ResizablePanel>

                <ResizableHandle className="bg-zinc-800 w-[1px] hover:bg-zinc-600 transition-colors" />

                {/* ZONE 4: PROPERTIES / PREVIEW */}
                <ResizablePanel
                    defaultSize={20}
                    minSize={15}
                    maxSize={30}
                    className="bg-[#1e1e1e] border-l border-zinc-800"
                >
                    {rightPanel}
                </ResizablePanel>

            </ResizablePanelGroup>
        </div>
    );
};

export default ResizableLayout;
