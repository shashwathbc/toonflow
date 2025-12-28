import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, Trash2 } from "lucide-react";

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
        <div className="flex flex-col h-full bg-background border-l w-80">
            <div className="p-4 border-b">
                <h2 className="font-semibold text-lg">Character Builder</h2>
                <p className="text-xs text-muted-foreground">Create consistent characters</p>
            </div>

            {/* Top Section: Inputs & Preview (Scrollable if content exceeds space, but generally static) */}
            <div className="p-4 space-y-4 border-b shrink-0">
                {/* Generator Inputs */}
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                            placeholder="Character Name (e.g. Hero)"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label>Appearance Prompt</Label>
                        <Input
                            placeholder="e.g. red cape, glowing eyes"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                        />
                    </div>

                    <div className="space-y-1">
                        <Label>Style</Label>
                        <Select value={style} onValueChange={setStyle}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="manga_bw">Manga B/W</SelectItem>
                                <SelectItem value="anime_color">Anime Color</SelectItem>
                                <SelectItem value="sketch">Sketch</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt}
                    >
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Generate Preview
                    </Button>
                </div>

                {/* Preview Area */}
                {previewUrl && (
                    <div className="border rounded-lg p-2 bg-muted/50">
                        <Label className="mb-2 block">Preview</Label>
                        <div className="relative aspect-square w-full bg-white mb-2 rounded border overflow-hidden">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                        </div>
                        <Button onClick={handleSaveClick} disabled={isSaving || !name} size="sm" className="w-full">
                            {isSaving ? "Saving..." : "Save Character"}
                        </Button>
                    </div>
                )}
            </div>

            {/* Bottom Section: Saved Characters (Independent Scroll) */}
            <div className="min-h-0 bg-zinc-900/30">
                <div className="space-y-4">
                    <h3 className="font-medium sticky top-0 bg-background/95 backdrop-blur py-2 z-10 border-b">
                        Saved Characters
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                        {characters.map(char => (
                            <Card
                                key={char.id}
                                className={`cursor-pointer transition-colors hover:bg-muted ${selectedCharacterId === char.id ? "ring-2 ring-primary" : ""}`}
                                onClick={() => onSelectCharacter(char.id)}
                                draggable
                                onDragStart={(e) => handleDragStart(e, char)}
                            >
                                <CardContent className="p-2 flex flex-col items-center gap-2">
                                    <div className="w-full aspect-square bg-white rounded overflow-hidden border">
                                        <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="w-full flex justify-between items-center">
                                        <span className="text-xs font-medium truncate max-w-[80px]" title={char.name}>{char.name}</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/20 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(char.id); }}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    {characters.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-50">
                            <p className="text-xs text-center">No characters saved yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
