import React, { useState } from 'react';
import { Sparkles, X, Wand2, AlertTriangle, Loader2 } from 'lucide-react';

interface AIInpaintModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (prompt: string, style: 'manga_bw' | 'webtoon_color' | 'anime_color') => Promise<void>;
    isGenerating: boolean;
}

export const AIInpaintModal: React.FC<AIInpaintModalProps> = ({ isOpen, onClose, onGenerate, isGenerating }) => {
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState<'manga_bw' | 'webtoon_color' | 'anime_color'>('manga_bw');

    if (!isOpen) return null;

    const handleGenerate = () => {
        if (!prompt.trim()) return;
        onGenerate(prompt, style);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-[500px] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex items-center gap-2 text-cyan-400">
                        <Sparkles size={20} />
                        <h2 className="text-lg font-semibold tracking-wide">AI Inpainting</h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="text-zinc-500 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Prompt Input */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Describe what you want to generate</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="A dramatic explosion, dust clouds, intricate details..."
                            className="w-full h-32 bg-black/40 border border-zinc-700 rounded-lg p-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500resize-none"
                            disabled={isGenerating}
                        />
                        <div className="text-xs text-zinc-500 text-right">{prompt.length}/500</div>
                    </div>

                    {/* Style Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Art Style</label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'manga_bw', label: 'Manga B/W' },
                                { id: 'webtoon_color', label: 'Webtoon Color' },
                                { id: 'anime_color', label: 'Anime Color' }
                            ].map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => setStyle(s.id as any)}
                                    disabled={isGenerating}
                                    className={`
                                        py-2 px-3 rounded-lg text-sm font-medium border transition-all duration-200
                                        ${style === s.id
                                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'}
                                    `}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-3">
                        <div className="mt-0.5 text-blue-400"><Wand2 size={16} /></div>
                        <div className="text-xs text-blue-200/80 leading-relaxed">
                            The selected area will be replaced with new content. A new layer will be created for the result.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-zinc-950/50 border-t border-zinc-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || isGenerating}
                        className={`
                            px-6 py-2 rounded-lg text-sm font-semibold flex items-center gap-2
                            transition-all duration-200
                            ${!prompt.trim() || isGenerating
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/20 hover:shadow-cyan-900/40 active:scale-95'}
                        `}
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles size={16} />
                                Generate
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
