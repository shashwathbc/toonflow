import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import WorkspaceLayout from '@/features/layout/WorkspaceLayout';
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
  const { id } = useParams();
  const { toast } = useToast();

  // Store sync
  const {
    pages, color, opacity, brushSize
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

  return (
    <WorkspaceLayout
      aiSidebar={
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
        />
      }
      rightSidebar={<RightSidebarContainer />}
    >
      <WebtoonCanvas />
    </WorkspaceLayout>
  );
};

export default Editor;