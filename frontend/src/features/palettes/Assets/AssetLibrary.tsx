import React from 'react';
import { MessageCircle, Cloud, Star, Square, Heart, Frown } from 'lucide-react';
import { BubbleType } from '../../canvas/utils/bubbleFactory';

interface AssetItemProps {
    type: BubbleType;
    label: string;
    icon: React.ReactNode;
}

const ASSETS: AssetItemProps[] = [
    { type: 'normal', label: 'Normal', icon: <MessageCircle size={24} /> },
    { type: 'thinking', label: 'Thinking', icon: <Cloud size={24} /> },
    { type: 'shouting', label: 'Shouting', icon: <Star size={24} /> },
    { type: 'narration', label: 'Narration', icon: <Square size={24} /> },
    { type: 'happy', label: 'Happy', icon: <Heart size={24} /> },
    { type: 'scared', label: 'Scared', icon: <Frown size={24} /> },
];

const AssetLibrary: React.FC = () => {

    const handleDragStart = (e: React.DragEvent, type: BubbleType) => {
        e.dataTransfer.setData('assetType', 'bubble');
        e.dataTransfer.setData('bubbleType', type);
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-zinc-300 font-sans text-xs select-none">
            <div className="px-3 py-2 bg-[#252525] border-b border-zinc-900 font-semibold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                <span>Speech Bubbles</span>
            </div>

            <div className="p-3 grid grid-cols-2 gap-3 overflow-y-auto">
                {ASSETS.map((asset) => (
                    <div
                        key={asset.type}
                        draggable
                        onDragStart={(e) => handleDragStart(e, asset.type)}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-zinc-800 rounded border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-500 cursor-grab active:cursor-grabbing transition-colors group"
                        title={`Drag to add ${asset.label}`}
                    >
                        <div className="text-zinc-400 group-hover:text-white transition-colors">
                            {asset.icon}
                        </div>
                        <span className="font-medium text-center">{asset.label}</span>
                    </div>
                ))}
            </div>

            <div className="p-3 text-zinc-500 text-[10px] text-center border-t border-zinc-800 mt-auto">
                Drag bubbles onto the canvas
            </div>
        </div>
    );
};

export default AssetLibrary;
