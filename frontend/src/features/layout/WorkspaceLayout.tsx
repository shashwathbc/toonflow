import React, { useState } from 'react';
import ToolPalette from '../palettes/Tools/ToolPalette';
import { PanelLeftClose, PanelRightClose, Bot, Palette, Undo2, Redo2, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/store/editorStore';

interface WorkspaceLayoutProps {
    children: React.ReactNode;
    rightSidebar?: React.ReactNode;
    aiSidebar?: React.ReactNode;
}

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
    children,
    rightSidebar,
    aiSidebar
}) => {
    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(true);
    const [activeSubSidebar, setActiveSubSidebar] = useState<'none' | 'ai' | 'assets'>('none');

    // Connect to store for Edit Mode
    const { isEditMode, setIsEditMode } = useEditorStore();

    const toggleSubSidebar = (mode: 'ai' | 'assets') => {
        setActiveSubSidebar(prev => prev === mode ? 'none' : mode);
    };

    return (
        <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
            {/* 1. Main Tools Sidebar */}
            <div className={`${isLeftOpen ? 'w-14' : 'w-0'} flex-shrink-0 border-r border-zinc-900 transition-all duration-300 flex flex-col items-center bg-[#1e1e1e] z-30`}>
                <div className="py-4 w-full flex justify-center border-b border-zinc-800">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md shadow-lg"></div>
                </div>
                <ToolPalette />

                {/* Sub-Sidebars Toggles */}
                <div className="mt-auto flex flex-col gap-2 p-2 w-full border-t border-zinc-800">
                    <Button title="AI Tools" variant="ghost" size="icon" onClick={() => toggleSubSidebar('ai')} className={activeSubSidebar === 'ai' ? 'bg-indigo-500/20 text-indigo-400' : 'text-zinc-500'}>
                        <Bot size={20} />
                    </Button>
                    <Button title="Assets" variant="ghost" size="icon" onClick={() => toggleSubSidebar('assets')} className={activeSubSidebar === 'assets' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-500'}>
                        <Palette size={20} />
                    </Button>
                </div>
            </div>

            {/* 2. Sub Sidebar Overlay */}
            <div className={`${activeSubSidebar !== 'none' ? 'w-80' : 'w-0'} flex-shrink-0 bg-[#252525] border-r border-zinc-900 transition-all duration-300 overflow-hidden relative z-20`}>
                <div className="h-full w-80 flex flex-col">
                    <div className="h-10 border-b border-zinc-800 flex items-center justify-between px-3 bg-[#2a2a2a]">
                        <span className="font-semibold text-xs text-zinc-400 uppercase tracking-widest">
                            {activeSubSidebar === 'ai' ? 'AI Studio' : 'Assets'}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500" onClick={() => setActiveSubSidebar('none')}>
                            <PanelLeftClose size={14} />
                        </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {activeSubSidebar === 'ai' && aiSidebar}
                        {activeSubSidebar === 'assets' && <div className="p-10 text-center text-zinc-600 text-xs">Library Empty</div>}
                    </div>
                </div>
            </div>

            {/* 3. Main Workspace */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#121212] relative z-10">

                {/* Top Bar / Toolbar */}
                <header className="h-12 border-b border-zinc-900 bg-[#1e1e1e] flex items-center justify-between px-4 select-none">
                    <div className="flex items-center gap-4">
                        {!isLeftOpen && (
                            <Button variant="ghost" size="icon" onClick={() => setIsLeftOpen(true)} className="text-zinc-500">
                                <PanelLeftClose className="rotate-180" size={18} />
                            </Button>
                        )}

                        {/* Undo / Redo */}
                        <div className="flex items-center bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
                            <Button variant="ghost" size="icon" className="h-7 w-8 text-zinc-400 hover:text-white" title="Undo (Ctrl+Z)" onClick={() => useEditorStore.getState().triggerUndo()}>
                                <Undo2 size={16} />
                            </Button>
                            <div className="w-px h-4 bg-zinc-700 mx-0.5"></div>
                            <Button variant="ghost" size="icon" className="h-7 w-8 text-zinc-400 hover:text-white" title="Redo (Ctrl+Shift+Z)" onClick={() => useEditorStore.getState().triggerRedo()}>
                                <Redo2 size={16} />
                            </Button>
                        </div>

                        <div className="h-4 w-px bg-zinc-800"></div>
                        <span className="text-xs font-medium text-zinc-500">My Webtoon Project</span>
                    </div>

                    {/* Edit / Save Action Area */}
                    <div className="flex items-center gap-3">
                        {isEditMode ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-zinc-400 hover:text-white h-8"
                                    onClick={() => setIsEditMode(false)}
                                >
                                    <X size={16} className="mr-2" /> Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white h-8"
                                    onClick={() => {
                                        // Logic to save all would go here
                                        setIsEditMode(false);
                                    }}
                                >
                                    <Save size={16} className="mr-2" /> Save Changes
                                </Button>
                            </div>
                        ) : (
                            <Button
                                size="sm"
                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 h-8 font-normal"
                                onClick={() => setIsEditMode(true)}
                            >
                                <Pencil size={14} className="mr-2" /> Edit Canvas
                            </Button>
                        )}

                        <Button variant="ghost" size="icon" className="text-zinc-500" onClick={() => setIsRightOpen(!isRightOpen)}>
                            <PanelRightClose size={18} />
                        </Button>
                    </div>
                </header>

                {/* Canvas Scroll Area */}
                <div className="flex-1 overflow-hidden relative bg-[#121212]">
                    {children}
                </div>
            </div>

            {/* 4. Right Sidebar */}
            <div className={`${isRightOpen ? 'w-72' : 'w-0'} flex-shrink-0 border-l border-zinc-900 bg-[#1e1e1e] transition-all duration-300 overflow-hidden z-30`}>
                <div className="w-72 h-full flex flex-col">
                    {rightSidebar}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceLayout;
