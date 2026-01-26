import React, { useState } from 'react';
import { Settings2, Smartphone, Layers as LayersIcon, MessageSquare } from 'lucide-react';
import ToolPropertiesPanel from '@/features/palettes/Properties/ToolPropertiesPanel';
import MobilePreview from '@/features/mobile-preview/MobilePreview';
import LayerPanel from '@/components/editor/panels/LayerPanel';
import { AIChat } from '@/components/editor/AIChat';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

interface RightSidebarContainerProps {
    onAutofillPrompt?: (prompt: string) => void;
}

const RightSidebarContainer: React.FC<RightSidebarContainerProps> = ({ onAutofillPrompt }) => {
    const [activeTab, setActiveTab] = useState<'properties' | 'preview' | 'aichat'>('properties');

    return (
        <div className="h-full w-full bg-[#1e1e1e] flex flex-col">
            <ResizablePanelGroup direction="vertical">

                {/* TOP HALF: PROPERTIES / PREVIEW */}
                <ResizablePanel defaultSize={50} minSize={30}>
                    <div className="flex flex-col h-full bg-[#1e1e1e]">
                        {/* Header / Tabs */}
                        <div className="flex border-b border-zinc-800 bg-[#252525] shrink-0">
                            <button
                                onClick={() => setActiveTab('properties')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-colors
                                    ${activeTab === 'properties'
                                        ? 'bg-[#1e1e1e] text-zinc-200 border-t-2 border-t-blue-500'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#2a2a2a]'
                                    }`}
                            >
                                <Settings2 size={14} />
                                <span>Properties</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('preview')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-colors
                                    ${activeTab === 'preview'
                                        ? 'bg-[#1e1e1e] text-zinc-200 border-t-2 border-t-purple-500'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#2a2a2a]'
                                    }`}
                            >
                                <Smartphone size={14} />
                                <span>Preview</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('aichat')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold uppercase tracking-wider transition-colors
                                    ${activeTab === 'aichat'
                                        ? 'bg-[#1e1e1e] text-zinc-200 border-t-2 border-t-emerald-500'
                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-[#2a2a2a]'
                                    }`}
                            >
                                <MessageSquare size={14} />
                                <span>AI Chat</span>
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-hidden relative">
                            {activeTab === 'properties' && <ToolPropertiesPanel />}
                            {activeTab === 'preview' && <MobilePreview />}
                            {activeTab === 'aichat' && <AIChat onAutofill={onAutofillPrompt || (() => { })} />}
                        </div>
                    </div>
                </ResizablePanel>

                <ResizableHandle className="bg-zinc-800 h-[1px] hover:bg-zinc-600 transition-colors" />

                {/* BOTTOM HALF: LAYERS */}
                <ResizablePanel defaultSize={50} minSize={20}>
                    <div className="h-full w-full overflow-hidden flex flex-col">
                        <LayerPanel />
                    </div>
                </ResizablePanel>

            </ResizablePanelGroup>
        </div>
    );
};

export default RightSidebarContainer;
