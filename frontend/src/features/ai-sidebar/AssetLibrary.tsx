
import React from 'react';
import { Upload, Image as ImageIcon, MessageSquare } from 'lucide-react';

export const AssetLibrary: React.FC = () => {
    // Mock Assets
    const bubbles = [
        { id: 'b1', type: 'bubble', bubbleType: 'normal', label: 'Standard', bg: 'bg-white rounded-full' },
        { id: 'b2', type: 'bubble', bubbleType: 'thinking', label: 'Thinking', bg: 'bg-white rounded-[40%] border-dashed border-2' },
        { id: 'b3', type: 'bubble', bubbleType: 'shouting', label: 'Shouting', bg: 'bg-white clip-starburst' }, // clip-path mockup
    ];

    const backgrounds = [
        { id: 'bg1', url: '/assets/bg/school.jpg', label: 'School Corridor' },
        { id: 'bg2', url: '/assets/bg/city.jpg', label: 'City Street' },
    ];

    const handleDragStart = (e: React.DragEvent, asset: any) => {
        if (asset.type === 'bubble') {
            e.dataTransfer.setData('assetType', 'bubble');
            e.dataTransfer.setData('bubbleType', asset.bubbleType);
            // Robust fallback:
            e.dataTransfer.setData('application/json', JSON.stringify({ type: 'bubble', bubbleType: asset.bubbleType }));
        } else {
            e.dataTransfer.setData('assetType', 'image');
            e.dataTransfer.setData('imageUrl', asset.url);
        }
        e.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-200">
            {/* Upload Section */}
            <div className="border-2 border-dashed border-zinc-700 rounded-lg p-6 flex flex-col items-center justify-center text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 cursor-pointer transition-colors bg-zinc-800/30">
                <Upload size={24} className="mb-2" />
                <span className="text-xs font-semibold">Upload Assets</span>
                <span className="text-[10px]">Drag & Drop or Click</span>
            </div>

            {/* Speech Bubbles */}
            <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-2">
                    <MessageSquare size={12} /> Speech Bubbles
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    {bubbles.map(b => (
                        <div
                            key={b.id}
                            className="aspect-square bg-zinc-800 rounded hover:bg-zinc-700 border border-zinc-700 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing p-2"
                            draggable
                            onDragStart={(e) => handleDragStart(e, b)}
                            title={b.label}
                        >
                            <div className={`w-8 h-8 border border-zinc-900 ${b.bg}`} />
                            <span className="text-[10px] mt-1 text-zinc-400">{b.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Backgrounds */}
            <div className="space-y-3">
                <h3 className="text-xs uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-2">
                    <ImageIcon size={12} /> Stock Backgrounds
                </h3>
                <div className="grid grid-cols-2 gap-2">
                    {/* Placeholder for no assets */}
                    <div className="col-span-2 text-center py-4 bg-zinc-800/50 rounded border border-zinc-800 text-zinc-500 text-xs italic">
                        No default assets loaded.
                    </div>
                </div>
            </div>
        </div>
    );
};
