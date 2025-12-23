import React from 'react';
import { CharacterBuilder } from "@/components/editor/CharacterBuilder";
import Section from "@/components/editor/Section";
import { Button } from "@/components/ui/button";

interface ToonaryCharacter {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
}

interface RightSidebarProps {
  isCharOpen: boolean;
  setCharOpen: (open: boolean) => void;
  isAssistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  characters: ToonaryCharacter[];
  selectedCharacterId: string | null;
  onSelectCharacter: (id: string) => void;
  onGenerateCharacter: (name: string, prompt: string, style: string) => Promise<string>;
  onSaveCharacter: (name: string, prompt: string, imageUrl: string) => Promise<any>;
  handleDeleteCharacter: (id: string) => void;

  // Assistant Props
  sceneName: string;
  setSceneName: (name: string) => void;
  cmdPrompt: string;
  setCmdPrompt: (prompt: string) => void;
  targetPage: number;
  setTargetPage: (page: number) => void;
  totalPages: number;
  pageImages: Record<number, string>;
  style: "Manga B/W" | "Webtoon Color" | "Sketch";
  setStyle: (style: "Manga B/W" | "Webtoon Color" | "Sketch") => void;
  aspect: "1:1" | "3:4" | "16:9";
  setAspect: (aspect: "1:1" | "3:4" | "16:9") => void;
  isGeneratingPage: boolean;
  handleGeneratePage: () => void;
}

const RightSidebar: React.FC<RightSidebarProps> = ({
  isCharOpen,
  setCharOpen,
  isAssistantOpen,
  setAssistantOpen,
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
  totalPages,
  pageImages,
  style,
  setStyle,
  aspect,
  setAspect,
  isGeneratingPage,
  handleGeneratePage
}) => {

  const handleDragStart = (e: React.DragEvent<HTMLImageElement>, url: string) => {
    e.dataTransfer.setData("text/plain", url);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="w-full bg-card p-4 space-y-4 overflow-y-auto flex flex-col">
      {/* Section 1: Character Builder */}
      <Section
        title="Character Builder"
        isOpen={isCharOpen}
        onToggle={() => setCharOpen(!isCharOpen)}
      >
        <CharacterBuilder
          characters={characters}
          selectedCharacterId={selectedCharacterId}
          onSelectCharacter={onSelectCharacter}
          onGenerate={onGenerateCharacter}
          onSave={onSaveCharacter}
          onDelete={handleDeleteCharacter}
        />
      </Section>

      {/* Section 2: Toonary AI Assistant */}
      <Section
        title="Toonary AI Assistant"
        isOpen={isAssistantOpen}
        onToggle={() => setAssistantOpen(!isAssistantOpen)}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <label htmlFor="targetPage" className="text-xs text-muted-foreground">Select Page</label>
            <select
              id="targetPage"
              value={targetPage}
              onChange={(e) => setTargetPage(Number(e.target.value))}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              title="Select target page"
              aria-label="Select target page"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <option key={pageNum} value={pageNum}>
                  Page {pageNum} {pageImages[pageNum] ? '(Has content)' : '(Empty)'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="sceneName" className="text-xs text-muted-foreground">Name</label>
            <input
              id="sceneName"
              type="text"
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              className="w-full rounded-md border bg-background px-2 py-1 text-sm"
              placeholder="e.g. Stormy Temple"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cmdPrompt" className="text-xs text-muted-foreground">
              Description
            </label>
            <textarea
              id="cmdPrompt"
              className="w-full rounded-md border bg-background px-2 py-1 text-sm min-h-[84px]"
              value={cmdPrompt}
              onChange={(e) => setCmdPrompt(e.target.value)}
              placeholder="Describe the scene…"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="style" className="text-xs text-muted-foreground">Style</label>
              <select
                id="style"
                value={style}
                onChange={(e) => setStyle(e.target.value as "Manga B/W" | "Webtoon Color" | "Sketch")}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                title="Select image style"
                aria-label="Select image style"
              >
                <option value="Manga B/W">Manga B/W</option>
                <option value="Webtoon Color">Webtoon Color</option>
                <option value="Sketch">Sketch</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="aspect" className="text-xs text-muted-foreground">Aspect Ratio</label>
              <select
                id="aspect"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as "1:1" | "3:4" | "16:9")}
                className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                title="Select aspect ratio"
                aria-label="Select aspect ratio"
              >
                <option value="1:1">1:1 Square</option>
                <option value="3:4">3:4 Portrait</option>
                <option value="16:9">16:9 Landscape</option>
              </select>
            </div>
          </div>

          <Button
            className="w-full mb-2"
            onClick={handleGeneratePage}
            disabled={isGeneratingPage}
          >
            Generate Panel Image
          </Button>

          {/* Preview of current page - Draggable */}
          {pageImages && pageImages[targetPage] && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Preview (Drag to canvas):</p>
              <img
                src={pageImages[targetPage]}
                alt={`Preview of page ${targetPage}`}
                className="w-full aspect-video object-cover rounded-lg border cursor-grab active:cursor-grabbing hover:border-primary"
                draggable={true}
                onDragStart={(e) => handleDragStart(e, pageImages[targetPage])}
              />
            </div>
          )}
        </div>
      </Section>
    </div>
  );
};
export default RightSidebar;