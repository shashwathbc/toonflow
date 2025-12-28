import React, { useState } from 'react';
import { Settings2, Smartphone } from 'lucide-react';
import ToolPropertiesPanel from '@/features/palettes/Properties/ToolPropertiesPanel';
import MobilePreview from '@/features/mobile-preview/MobilePreview';

const RightSidebarContainer: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'properties' | 'preview'>('properties');

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] border-l border-zinc-800">
            {/* Header / Tabs */}
            <div className="flex border-b border-zinc-800 bg-[#252525]">
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
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'properties' ? <ToolPropertiesPanel /> : <MobilePreview />}
            </div>
        </div>
    );
};

export default RightSidebarContainer;
