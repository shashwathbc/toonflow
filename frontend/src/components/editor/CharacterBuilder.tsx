import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, Trash2, Sparkles } from "lucide-react";

export interface ToonaryCharacter {
    id: string;
    name: string;
    imageUrl: string;
    createdAt: number;
}

interface CharacterBuilderProps {
    characters: ToonaryCharacter[];
    selectedCharacterId: string | null;
    onSelectCharacter: (id: string) => void;
    onGenerate: (name: string, prompt: string, style: string) => Promise<string>;
    onSave: (name: string, prompt: string, imageUrl: string) => Promise<void>;
    onDelete: (id: string) => void;
}

export function CharacterBuilder({
    characters,
    selectedCharacterId,
    onSelectCharacter,
    onGenerate,
    onSave,
    onDelete
}: CharacterBuilderProps) {
    const [name, setName] = useState("");
    const [prompt, setPrompt] = useState("");
    const [style, setStyle] = useState("manga_bw");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleGenerate = async () => {
        if (!prompt) return;
        setIsGenerating(true);
        try {
            const url = await onGenerate(name, prompt, style);
            setPreviewUrl(url);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveClick = async () => {
        if (!name || !previewUrl) return;
        setIsSaving(true);
        try {
            await onSave(name, prompt, previewUrl);
            setPreviewUrl(null);
            setName("");
            setPrompt("");
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, char: ToonaryCharacter) => {
        e.dataTransfer.setData("application/toonary-character", JSON.stringify(char));
        e.dataTransfer.setData("text/plain", char.imageUrl); // Fallback for standard drop
        e.dataTransfer.effectAllowed = "copy";
    };

    return (
        <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
            {/* Generator Inputs */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 focus:ring-1 focus:ring-blue-500 outline-none text-zinc-200 placeholder:text-zinc-600"
                        placeholder="e.g. Hero"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Appearance Prompt</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 min-h-[80px] resize-none focus:ring-1 focus:ring-blue-500 outline-none text-zinc-200 placeholder:text-zinc-600"
                        placeholder="e.g. red cape, glowing eyes"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Style</label>
                    <select
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-2 focus:ring-1 focus:ring-blue-500 outline-none text-zinc-200"
                    >
                        <option value="manga_bw">Manga B/W</option>
                        <option value="anime_color">Anime Color</option>
                        <option value="sketch">Sketch</option>
                    </select>
                </div>

                <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt}
                >
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate Preview
                </Button>
            </div>

            {/* Preview & Save */}
            {previewUrl && (
                <div className="mt-4 border-t border-zinc-800 pt-4 space-y-3">
                    <p className="text-xs text-zinc-500 font-semibold uppercase">Preview</p>
                    <div className="relative aspect-square w-full bg-black/40 rounded-lg border border-zinc-700 overflow-hidden">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    </div>
                    <Button
                        onClick={handleSaveClick}
                        disabled={isSaving || !name}
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Character
                    </Button>
                </div>
            )}

            {/* Saved Characters List */}
            <div className="mt-6 border-t border-zinc-800 pt-4">
                <p className="text-xs text-zinc-500 mb-3 font-semibold uppercase">Saved Characters</p>
                <ScrollArea className="h-[200px] w-full pr-2">
                    <div className="grid grid-cols-2 gap-2">
                        {characters.map(char => (
                            <div
                                key={char.id}
                                className={`
                                    relative group cursor-pointer rounded-lg border border-zinc-800 overflow-hidden bg-zinc-900/50 hover:border-blue-500/50 transition-all
                                    ${selectedCharacterId === char.id ? "ring-1 ring-blue-500 border-blue-500" : ""}
                                `}
                                onClick={() => onSelectCharacter(char.id)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, char)}
                            >
                                <div className="aspect-square w-full">
                                    <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />
                                </div>
                                <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-[2px] p-2 flex justify-between items-center">
                                    <span className="text-[10px] text-zinc-200 font-medium truncate max-w-[60px]">{char.name}</span>
                                    <button
                                        className="text-zinc-400 hover:text-red-400"
                                        onClick={(e) => { e.stopPropagation(); onDelete(char.id); }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                {characters.length === 0 && (
                    <div className="text-center py-8 text-zinc-600 text-xs italic">
                        No characters saved
                    </div>
                )}
            </div>
        </div>
    );
}
