import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { CharacterBuilder, ToonaryCharacter } from "@/components/editor/CharacterBuilder";
import { ChevronDown, ChevronRight, Sparkles, User, Image as ImageIcon } from 'lucide-react';
import { useEditorStore } from '@/store/editorStore';

interface AISidebarProps {
    // Character Props
    characters: ToonaryCharacter[];
    selectedCharacterId: string | null;
    onSelectCharacter: (id: string) => void;
    onGenerateCharacter: (name: string, prompt: string, style: string) => Promise<string>;
    onSaveCharacter: (name: string, prompt: string, imageUrl: string) => Promise<any>;
    handleDeleteCharacter: (id: string) => void;

    // AI Assistant Props
    sceneName: string;
    setSceneName: (name: string) => void;
    cmdPrompt: string;
    setCmdPrompt: (prompt: string) => void;

    targetPage: number;
    setTargetPage: (page: number) => void;
    totalPages?: number;

    style: "Manga B/W" | "Webtoon Color" | "Sketch";
    setStyle: (style: "Manga B/W" | "Webtoon Color" | "Sketch") => void;

    aspect: "1:1" | "3:4" | "16:9";
    setAspect: (aspect: "1:1" | "3:4" | "16:9") => void;

    isGeneratingPage: boolean;
    handleGeneratePage: () => void;
}

const AISidebar: React.FC<AISidebarProps> = ({
    characters,
    selectedCharacterId,
    onSelectCharacter,
    onGenerateCharacter,
    onSaveCharacter,
    handleDeleteCharacter,
    sceneName,
    setSceneName,
    cmdPrompt,
    setCmdPrompt,
    targetPage,
    setTargetPage,
    totalPages = 10,
    style,
    setStyle,
    aspect,
    setAspect,
    isGeneratingPage,
    handleGeneratePage
}) => {
    const [activeSection, setActiveSection] = useState<'chars' | 'assistant'>('chars');

    return (
        <div className="flex flex-col h-full bg-zinc-900 text-zinc-200">
            {/* Tab Switcher */}
            <div className="flex border-b border-zinc-800">
                <button
                    onClick={() => setActiveSection('chars')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeSection === 'chars' ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <User size={14} /> Characters
                </button>
                <button
                    onClick={() => setActiveSection('assistant')}
                    className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${activeSection === 'assistant' ? 'text-purple-400 border-b-2 border-purple-400 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Sparkles size={14} /> AI Assist
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

                {/* Character Builder Section */}
                {activeSection === 'chars' && (
                    <CharacterBuilder
                        characters={characters}
                        selectedCharacterId={selectedCharacterId}
                        onSelectCharacter={onSelectCharacter}
                        onGenerate={onGenerateCharacter}
                        onSave={onSaveCharacter}
                        onDelete={handleDeleteCharacter}
                    />
                )}

                {/* AI Assistant Section */}
                {activeSection === 'assistant' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Target Page</label>
                            <select
                                value={targetPage}
                                onChange={(e) => setTargetPage(Number(e.target.value))}
                                className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 focus:ring-1 focus:ring-purple-500 outline-none"
                            >
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                    <option key={pageNum} value={pageNum}>Page {pageNum}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Scene Name</label>
                            <input
                                type="text"
                                value={sceneName}
                                onChange={(e) => setSceneName(e.target.value)}
                                className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 focus:ring-1 focus:ring-purple-500 outline-none"
                                placeholder="e.g. Stormy Temple"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Prompt</label>
                            <textarea
                                value={cmdPrompt}
                                onChange={(e) => setCmdPrompt(e.target.value)}
                                className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 min-h-[100px] resize-none focus:ring-1 focus:ring-purple-500 outline-none"
                                placeholder="Describe the scene..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Style</label>
                                <select
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value as any)}
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 focus:ring-1 focus:ring-purple-500 outline-none"
                                >
                                    <option value="Manga B/W">Manga B/W</option>
                                    <option value="Webtoon Color">Webtoon Color</option>
                                    <option value="Sketch">Sketch</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Aspect</label>
                                <select
                                    value={aspect}
                                    onChange={(e) => setAspect(e.target.value as any)}
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 focus:ring-1 focus:ring-purple-500 outline-none"
                                >
                                    <option value="1:1">1:1 Square</option>
                                    <option value="3:4">3:4 Portrait</option>
                                    <option value="16:9">16:9 Landscape</option>
                                </select>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={handleGeneratePage}
                            disabled={isGeneratingPage}
                        >
                            {isGeneratingPage ? <Sparkles className="animate-spin mr-2" size={16} /> : <ImageIcon className="mr-2" size={16} />}
                            {isGeneratingPage ? "Generating..." : "Generate Panel"}
                        </Button>
                        {/* Preview Area */}
                        <PreviewSection targetPage={targetPage} />
                    </div>
                )}
            </div>
        </div>
    );
};

const PreviewSection = ({ targetPage }: { targetPage: number }) => {
    const { pageImages } = useEditorStore();
    const handleDragStart = (e: React.DragEvent<HTMLImageElement>, url: string) => {
        e.dataTransfer.setData("text/plain", url);
        e.dataTransfer.effectAllowed = "copy";
    };

    if (!pageImages[targetPage]) return null;

    return (
        <div className="mt-4 border-t border-zinc-800 pt-4">
            <p className="text-xs text-zinc-500 mb-2 font-semibold uppercase">Preview (Drag to Canvas)</p>
            <img
                src={pageImages[targetPage]}
                alt={`Preview of page ${targetPage}`}
                className="w-full aspect-video object-cover rounded-lg border border-zinc-700 cursor-grab active:cursor-grabbing hover:border-purple-500 transition-colors"
                draggable={true}
                onDragStart={(e) => handleDragStart(e, pageImages[targetPage])}
            />
        </div>
    );
};

export default AISidebar;
