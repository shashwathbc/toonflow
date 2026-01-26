import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts';
import ResizableLayout from '@/components/editor/layout/ResizableLayout';
import ToolSidebar from '@/components/editor/tools/ToolSidebar';
import WebtoonCanvas from '@/features/canvas/WebtoonCanvas';
import AISidebar from '@/features/ai-sidebar/AISidebar';
import RightSidebarContainer from '@/components/editor/RightSidebarContainer';
import { useEditorStore } from '@/store/editorStore';

/** ===== Types & API Helpers ===== */
type ToonaryCharacter = {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
};

const API_BASE = "http://localhost:5050/api/characters";

// Fetch Helper (Keep existing)
async function fetchCharacters(): Promise<ToonaryCharacter[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error("Failed to fetch characters");
  const data = await res.json();
  return data.characters;
}

const Editor: React.FC = () => {
  useEditorShortcuts(); // Enable global shortcuts
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const chapterNumber = searchParams.get('chapter');

  // Store sync
  const {
    pages, color, opacity, brushSize, setPages, setPageImage
    // Removed: hardness, stabilize, setHardness, setStabilize (deprecated in favor of sub-tool settings)
  } = useEditorStore();

  const totalPages = pages.length;

  // Local state for API / AI features
  const [characters, setCharacters] = useState<ToonaryCharacter[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // AI Assistant State
  const [sceneName, setSceneName] = useState("");
  const [cmdPrompt, setCmdPrompt] = useState("");
  const [style, setStyle] = useState<"Manga B/W" | "Webtoon Color" | "Sketch">("Manga B/W");
  const [aspect, setAspect] = useState<"1:1" | "3:4" | "16:9">("3:4");
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  const [targetPage, setTargetPage] = useState<number>(1);

  // Load intro images if this is the intro chapter (chapter 1)
  useEffect(() => {
    // Intro chapter is chapter 1 (the first chapter before Chapter 1: The Exile Begins)
    const isIntroChapter = chapterNumber === '1';

    if (isIntroChapter) {
      // Create 12 numbered pages for intro
      const introPages = Array.from({ length: 12 }, (_, i) => i + 1);
      setPages(introPages);

      // Load each intro image
      introPages.forEach((pageNum) => {
        const imageNum = String(pageNum).padStart(2, '0');
        const imageUrl = `/intro/${imageNum}.jpg`;
        setPageImage(pageNum, imageUrl);
      });
    }
  }, [chapterNumber, setPages, setPageImage]);

  // Load characters
  useEffect(() => {
    fetchCharacters()
      .then(list => {
        setCharacters(list);
        if (list.length > 0 && !selectedCharacterId) setSelectedCharacterId(list[0].id);
      })
      .catch(err => console.error("Failed to load characters:", err));
  }, []);

  // Handlers (kept from original)
  const handleGenerateCharacter = async (name: string, prompt: string, style: string) => {
    return "http://localhost:5050/temp.png";
  };

  const handleSaveCharacter = async (name: string, prompt: string, imageUrl: string) => {
    // Mock save
    const newChar = { id: Date.now().toString(), name, imageUrl, createdAt: Date.now() };
    setCharacters(prev => [newChar, ...prev]);
    return newChar;
  };

  const handleDeleteCharacter = (id: string) => {
    setCharacters(prev => prev.filter(c => c.id !== id));
  };

  const handleGeneratePage = async () => {
    if (!cmdPrompt.trim()) {
      toast({ title: "Error", description: "Please enter a prompt", variant: "destructive" });
      return;
    }

    setIsGeneratingPage(true);

    try {
      const response = await fetch('http://localhost:5050/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterPrompt: cmdPrompt,
          characterName: sceneName || undefined,
          style: style,
          width: aspect === '16:9' ? 1280 : aspect === '1:1' ? 1024 : 768,
          height: aspect === '16:9' ? 720 : aspect === '1:1' ? 1024 : 1024,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Generation failed');
      }

      const data = await response.json();

      if (data.imageUrl) {
        // Store the generated image in the editor store for the target page
        const { setPageImage } = useEditorStore.getState();
        setPageImage(targetPage, data.imageUrl);

        toast({ title: "Success!", description: `Panel generated for page ${targetPage}` });
      } else {
        throw new Error('No image returned from API');
      }
    } catch (error: any) {
      console.error('Generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || 'Something went wrong',
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPage(false);
    }
  };

  const handleAutofillPrompt = (prompt: string) => {
    setCmdPrompt(prompt);
    // Switch left sidebar to assistant tab if callback is available
    if (switchToAssistantRef.current) {
      switchToAssistantRef.current();
    }
  };

  const switchToAssistantRef = React.useRef<(() => void) | null>(null);

  const handleUploadWebtoon = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        console.log('Files to upload:', files);
        // TODO: Implement upload logic to add images as new pages
      }
    };
    input.click();
  };

  const handleDownloadPages = () => {
    const link = document.createElement('a');
    pages.forEach((pageId, index) => {
      const canvasElement = document.querySelector(`canvas[data-page-id="${pageId}"]`) as HTMLCanvasElement;
      if (canvasElement) {
        setTimeout(() => {
          link.href = canvasElement.toDataURL('image/png');
          link.download = `page-${pageId}.png`;
          link.click();
        }, index * 100);
      }
    });
  };

  return (
    <ResizableLayout
      toolSidebar={<ToolSidebar />}
      onUploadWebtoon={handleUploadWebtoon}
      onDownloadPages={handleDownloadPages}
      leftPanel={
        <AISidebar
          // Character Props
          characters={characters}
          selectedCharacterId={selectedCharacterId}
          onSelectCharacter={setSelectedCharacterId}
          onGenerateCharacter={handleGenerateCharacter}
          onSaveCharacter={handleSaveCharacter}
          handleDeleteCharacter={handleDeleteCharacter}

          // AI Assistant Props
          sceneName={sceneName}
          setSceneName={setSceneName}
          cmdPrompt={cmdPrompt}
          setCmdPrompt={setCmdPrompt}
          targetPage={targetPage}
          setTargetPage={setTargetPage}
          totalPages={totalPages}
          style={style}
          setStyle={setStyle}
          aspect={aspect}
          setAspect={setAspect}
          isGeneratingPage={isGeneratingPage}
          handleGeneratePage={handleGeneratePage}
          onSwitchToAssistant={(callback) => { switchToAssistantRef.current = callback; }}
        />
      }
      rightPanel={<RightSidebarContainer onAutofillPrompt={handleAutofillPrompt} />}
    >
      <WebtoonCanvas />
    </ResizableLayout>
  );
};

export default Editor;