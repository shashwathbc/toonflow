
import React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { Undo2, Redo2, Upload, Download } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

interface ResizableLayoutProps {
    toolSidebar?: React.ReactNode; // Zone 1
    leftPanel?: React.ReactNode;   // Zone 2 (AI/Assets)
    children: React.ReactNode;     // Zone 3 (Canvas)
    rightPanel?: React.ReactNode;  // Zone 4 (Properties)
    onUploadWebtoon?: () => void;
    onDownloadPages?: () => void;
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
    rightPanel,
    onUploadWebtoon,
    onDownloadPages
}) => {
    const { triggerUndo, triggerRedo } = useEditorStore();

    return (
        <div className="h-[calc(100vh-64px)] w-full bg-zinc-950 overflow-hidden text-zinc-100 font-sans relative">
            {/* Fixed Top Bar for Canvas - Positioned to align with canvas area */}
            <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
                <div className="flex h-0">
                    {/* Spacer for tool sidebar */}
                    <div style={{ width: '4%' }}></div>
                    {/* Spacer for left panel */}
                    <div style={{ width: '20%' }}></div>

                    {/* Canvas Toolbar - only this part is interactive */}
                    <div style={{ width: '56%' }} className="pointer-events-auto">
                        <div className="bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700 shadow-lg">
                            <div className="flex items-center justify-between px-4 py-2">
                                {/* Left section */}
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Canvas</span>
                                </div>

                                {/* Center section - Undo/Redo */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={triggerUndo}
                                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded transition-colors border border-zinc-700/50"
                                        title="Undo (Ctrl+Z)"
                                    >
                                        <Undo2 size={18} />
                                    </button>
                                    <button
                                        onClick={triggerRedo}
                                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded transition-colors border border-zinc-700/50"
                                        title="Redo (Ctrl+Y)"
                                    >
                                        <Redo2 size={18} />
                                    </button>
                                </div>

                                {/* Right section */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={onDownloadPages}
                                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100 rounded transition-colors border border-zinc-700/50"
                                        title="Download All Pages"
                                    >
                                        <Download size={18} />
                                    </button>
                                    <button
                                        onClick={onUploadWebtoon}
                                        className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                                        title="Upload Webtoon Images"
                                    >
                                        <Upload size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
