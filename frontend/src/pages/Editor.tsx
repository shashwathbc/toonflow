import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useCanvasHistory } from '@/hooks/useCanvasHistory';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Canvas, FabricImage } from 'fabric';
import * as fabric from 'fabric'; // Keep just in case, but prefer specific imports

import TopToolbar from '@/components/editor/TopToolbar';
import LeftSidebar from '@/components/editor/LeftSidebar';
import CanvasArea from '@/components/editor/CanvasArea';
import RightSidebar from '@/components/editor/RightSidebar';
import ResizableLayout from '@/components/editor/ResizableLayout';

/** ===== Types ===== */
type ToonaryCharacter = {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
};

/** ===== Backend API helpers ===== */
const API_BASE = "http://localhost:5050/api/characters";

async function fetchCharacters(): Promise<ToonaryCharacter[]> {
  const res = await fetch(API_BASE);
  if (!res.ok) throw new Error("Failed to fetch characters");
  const data = await res.json();
  return data.characters;
}

/** ===== Simple mock image generators (replace with real AI calls) ===== */
function svgDataUrl({
  w = 800,
  h = 1200,
  label = "Generated",
  subLabel,
}: {
  w?: number;
  h?: number;
  label?: string;
  subLabel?: string;
}) {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="45%" text-anchor="middle" font-family="Arial" font-size="24" fill="#666">${label}</text>
      ${subLabel ? `<text x="50%" y="55%" text-anchor="middle" font-family="Arial" font-size="16" fill="#999">${subLabel}</text>` : ''}
    </svg>
  `);
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

async function generatePanelImage(prompt: string, style: string, aspect: "1:1" | "3:4" | "16:9"): Promise<string> {
  const aspectMap = { "1:1": [1024, 1024], "3:4": [960, 1280], "16:9": [1600, 900] } as const;
  const [w, h] = aspectMap[aspect];
  return svgDataUrl({ w, h, label: "Page Image", subLabel: `${style} · ${prompt?.slice(0, 24)}` });
}

async function generateCharacterAPI(name: string, prompt: string, style: string): Promise<string> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterName: name, characterPrompt: prompt, style }),
  });
  if (!res.ok) throw new Error("Failed to generate character");
  const data = await res.json();
  return `http://localhost:5050${data.tempImageUrl}`; // Ensure absolute URL if backend returns relative
}

async function saveCharacterAPI(name: string, prompt: string, imageUrl: string): Promise<ToonaryCharacter> {
  const res = await fetch(`${API_BASE}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterName: name, characterPrompt: prompt, imageUrl }),
  });
  if (!res.ok) throw new Error("Failed to save character");
  const data = await res.json();
  // Ensure absolute URL
  const char = data.character;
  if (char.imageUrl.startsWith('/')) {
    char.imageUrl = `http://localhost:5050${char.imageUrl}`;
  }
  return char;
}

const Editor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const chapter = searchParams.get("chapter") || "1";
  const { toast } = useToast();

  /** ===== Canvas state ===== */
  const [pageImages, setPageImages] = useState<Record<number, string>>({});
  const [template, setTemplate] = useState<string>("Blank");
  const [totalPages, setTotalPages] = useState<number>(1);
  const pages = useMemo(() => Array.from({ length: totalPages }, (_, i) => i + 1), [totalPages]);

  /** ===== Navigation ===== */
  const handleBack = () => navigate(`/projects/${id}`);
  const handleSave = () => toast({ title: "Saved", description: "Your work has been saved" });

  /** ===== Character Builder state ===== */
  const [isCharOpen, setCharOpen] = useState(true);
  const [characters, setCharacters] = useState<ToonaryCharacter[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  // Load characters on mount
  useEffect(() => {
    fetchCharacters()
      .then(list => {
        setCharacters(list);
        if (list.length > 0 && !selectedCharacterId) setSelectedCharacterId(list[0].id);
      })
      .catch(err => console.error("Failed to load characters:", err));
  }, []);

  const handleGenerateCharacter = async (name: string, prompt: string, style: string) => {
    try {
      const url = await generateCharacterAPI(name, prompt, style);
      return url;
    } catch (e) {
      toast({ title: "Generation failed", description: "Could not generate character.", variant: "destructive" });
      throw e;
    }
  };

  const handleSaveCharacter = async (name: string, prompt: string, imageUrl: string) => {
    try {
      const newChar = await saveCharacterAPI(name, prompt, imageUrl);
      setCharacters(prev => [newChar, ...prev]);
      setSelectedCharacterId(newChar.id);
      toast({ title: "Character saved", description: `"${newChar.name}" added to your library.` });
    } catch (e) {
      toast({ title: "Save failed", description: "Could not save character.", variant: "destructive" });
      throw e; // Rethrow for component state management
    }
  };

  const handleDeleteCharacter = (cid: string) => {
    // Mock delete for now as API wasn't required for delete explicitly, but we should update local list
    const next = characters.filter((c) => c.id !== cid);
    setCharacters(next);
    if (selectedCharacterId === cid) setSelectedCharacterId(next[0]?.id ?? null);
  };

  /** ===== AI Assistant state ===== */
  const [isAssistantOpen, setAssistantOpen] = useState(false);
  const [cmdPrompt, setCmdPrompt] = useState("");
  const [style, setStyle] = useState<"Manga B/W" | "Webtoon Color" | "Sketch">("Manga B/W");
  const [aspect, setAspect] = useState<"1:1" | "3:4" | "16:9">("3:4");
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  const [targetPage, setTargetPage] = useState<number>(1);
  const [editingPage, setEditingPage] = useState<number | null>(null);


  const [isEditMode, setIsEditMode] = useState(false);
  const [fabricCanvas, setFabricCanvas] = useState<Canvas | null>(null);
  const { undo, redo, canUndo, canRedo } = useCanvasHistory(fabricCanvas);

  /** ===== Tool state ===== */
  const [activeTool, setActiveTool] = useState<"pan" | "select" | "brush" | "eraser" | "fill" | "shape-rect" | "shape-ellipse" | "line" | "text" | "panel-frame" | "wand" | "line-width" | "smooth" | "pen" | "picker" | "crop">("brush");
  const [brushSize, setBrushSize] = useState<number>(4);
  const [opacity, setOpacity] = useState<number>(100);
  const [hardness, setHardness] = useState<number>(80);
  const [stabilize, setStabilize] = useState<boolean>(true);
  const [color, setColor] = useState<string>("#222222");
  const [recentColors, setRecentColors] = useState<string[]>(["#222222", "#ffffff", "#e11d48", "#0ea5e9"]);

  function chooseColor(c: string) {
    setColor(c);
    setRecentColors((prev) => {
      const next = [c, ...prev.filter((x) => x !== c)];
      return next.slice(0, 8);
    });
  }

  // Clean up legacy refs
  // const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  // const drawingRef = useRef(false);
  // const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Picker Tool Logic
  useEffect(() => {
    if (!fabricCanvas) return;
    const handleMouseDown = (opt: any) => {
      if (activeTool === 'picker' && isEditMode) {
        const pointer = fabricCanvas.getPointer(opt.e);
        const ctx = fabricCanvas.getContext();
        const ratio = fabricCanvas.getRetinaScaling();
        const pixel = ctx.getImageData(pointer.x * ratio, pointer.y * ratio, 1, 1).data;
        // Convert to hex for consistency if needed, but rgba string is valid CSS color
        // Let's use RGB hex if alpha is 255, else rgba
        const r = pixel[0];
        const g = pixel[1];
        const b = pixel[2];
        const a = pixel[3] / 255;

        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        if (a >= 0.99) {
          const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
          chooseColor(hex);
        } else {
          chooseColor(`rgba(${r},${g},${b},${a.toFixed(2)})`);
        }
        toast({ title: "Color Picked", description: "Brush color updated." });
      }
    };
    fabricCanvas.on('mouse:down', handleMouseDown);
    return () => { fabricCanvas.off('mouse:down', handleMouseDown); };
  }, [fabricCanvas, activeTool, isEditMode]);

  // Track which page is currently loaded in Fabric to prevent re-loading/clearing
  const loadedPageRef = useRef<number | null>(null);

  // Load existing page image into Fabric when editing starts
  useEffect(() => {
    // Check if we already loaded this page
    if (!fabricCanvas || editingPage === null || !pageImages[editingPage]) return;
    if (loadedPageRef.current === editingPage) return;

    const imageUrl = pageImages[editingPage];
    FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' }).then((img) => {
      // Do not clear canvas here to prevent wiping strokes drawn during load
      loadedPageRef.current = editingPage;

      if (fabricCanvas.width && fabricCanvas.height) {
        const scaleX = fabricCanvas.width / img.width!;
        const scaleY = fabricCanvas.height / img.height!;
        // Use cover-like behavior or stretch? Sticking to stretch for full page feel
        img.set({
          selectable: false,
          evented: false,
          scaleX: scaleX,
          scaleY: scaleY,
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0
        });
        fabricCanvas.add(img);
        fabricCanvas.sendObjectToBack(img);
        fabricCanvas.requestRenderAll();
      }
    });

  }, [fabricCanvas, editingPage, pageImages]);

  // Reset loadedPageRef when editing stops
  useEffect(() => {
    if (editingPage === null) {
      loadedPageRef.current = null;
    }
  }, [editingPage]);


  const handleGeneratePage = async () => {
    setIsGeneratingPage(true);
    try {
      const url = await generatePanelImage(cmdPrompt, style, aspect);
      setPageImages((prev) => ({ ...prev, [targetPage]: url }));
      toast({ title: `Page ${targetPage} updated`, description: `Generated image placed on Page ${targetPage}.` });
    } finally {
      setIsGeneratingPage(false);
    }
  };

  const handleDropOnPage = (pageNum: number, url: string) => {
    setPageImages(prev => ({ ...prev, [pageNum]: url }));
    toast({ title: "Image placed", description: `Character placed on Page ${pageNum}` });
  };

  const handleDropOnCanvas = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const url = e.dataTransfer.getData("text/plain");
    if (!url || !fabricCanvas) return;

    // Use Fabric to load image
    FabricImage.fromURL(url, { crossOrigin: 'anonymous' }).then((img) => {
      // Center image or place at drop?
      // For drop position, we need to translate client coordinates to canvas coordinates.
      // Fabric canvas might be scaled or offset.
      // e.nativeEvent.offsetX/Y might be relative to the wrapper div.
      // For simplicity now, let's center it.
      if (fabricCanvas.width && fabricCanvas.height) {
        img.set({
          left: fabricCanvas.width / 2,
          top: fabricCanvas.height / 2,
          originX: 'center',
          originY: 'center',
        });
      }

      // Scale down if huge
      if (img.width && img.width > 500) {
        img.scaleToWidth(400);
      }

      fabricCanvas.add(img);
      fabricCanvas.setActiveObject(img);
      toast({ title: "Image added", description: "Character added to canvas layer" });
    }).catch(err => {
      console.error("Failed to load fabric image", err);
    });
  };

  const saveCanvasEdits = () => {
    if (editingPage == null || !fabricCanvas) return;
    const url = fabricCanvas.toDataURL({ format: 'png', multiplier: 1 }); // multiplier for resolution?
    setPageImages((prev) => ({ ...prev, [editingPage]: url }));
    toast({ title: `Saved Page ${editingPage}`, description: "Canvas saved to page." });
    setEditingPage(null);
  };

  const discardCanvasEdits = () => {
    setEditingPage(null);
  };

  const handleExport = () => {
    if (!fabricCanvas) return;
    // Temporarily disable selection controls for export if needed? 
    // toDataURL usually ignores controls if option is not set.
    const url = fabricCanvas.toDataURL({ format: 'png', multiplier: 2 });
    const link = document.createElement('a');
    link.href = url;
    link.download = `canvas-export-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exported", description: "Image downloaded as PNG." });
  };

  // Toggle Edit Mode in Fabric
  useEffect(() => {
    if (!fabricCanvas) return;
    fabricCanvas.selection = isEditMode;
    fabricCanvas.forEachObject((obj) => {
      obj.selectable = isEditMode;
      obj.evented = isEditMode;
    });
    fabricCanvas.requestRenderAll();
  }, [isEditMode, fabricCanvas, editingPage]); // Re-run if page changes or canvas re-mounts

  function hexToRgba(hex: string, opacity: number) {
    let c: any;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      c = hex.substring(1).split('');
      if (c.length == 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = '0x' + c.join('');
      return 'rgba(' + [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',') + ',' + (opacity / 100) + ')';
    }
    return hex;
  }

  // Auto-enable Edit Mode and Page selection on Tool Change
  useEffect(() => {
    // List of tools that imply editing
    const interactiveTools = ['brush', 'pen', 'eraser', 'picker', 'crop', 'select', 'shape-rect', 'shape-ellipse', 'line', 'text', 'fill', 'wand'];

    if (interactiveTools.includes(activeTool)) {
      if (!isEditMode) {
        setIsEditMode(true);
      }
      // If not editing a page, default to page 1 (or current targetPage?)
      if (editingPage === null) {
        setEditingPage(1);
      }
    }
  }, [activeTool]);

  // Handle Active Tool & Drawing
  useEffect(() => {
    if (!fabricCanvas) return;

    if (activeTool === 'brush' || activeTool === 'pen') {
      fabricCanvas.isDrawingMode = true;
      const brush = new fabric.PencilBrush(fabricCanvas);
      brush.width = brushSize || 1;
      brush.color = hexToRgba(color, opacity);
      fabricCanvas.freeDrawingBrush = brush;
    } else {
      fabricCanvas.isDrawingMode = false;
    }
  }, [activeTool, fabricCanvas, isEditMode, brushSize, color, opacity]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!fabricCanvas || !isEditMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = fabricCanvas.getActiveObjects();
        if (active.length) {
          fabricCanvas.remove(...active);
          fabricCanvas.discardActiveObject();
          fabricCanvas.requestRenderAll();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fabricCanvas, isEditMode]);

  return (
    <ResizableLayout
      onBack={handleBack}
      onSave={handleSave}
      onExport={handleExport}
      onUndo={undo}
      onRedo={redo}
      canUndo={canUndo}
      canRedo={canRedo}
      isEditMode={isEditMode}
      setIsEditMode={setIsEditMode}
      activeTool={activeTool}
      setActiveTool={setActiveTool}
      brushSize={brushSize}
      setBrushSize={setBrushSize}
      opacity={opacity}
      setOpacity={setOpacity}
      hardness={hardness}
      setHardness={setHardness}
      stabilize={stabilize}
      setStabilize={setStabilize}
      color={color}
      setColor={setColor}
      recentColors={recentColors}
      chooseColor={chooseColor}
      template={template}
      setTemplate={setTemplate}
      totalPages={totalPages}
      setTotalPages={setTotalPages}
      pages={pages}
      pageImages={pageImages}
      editingPage={editingPage}
      setEditingPage={setEditingPage}
      // Replaced props
      onCanvasReady={setFabricCanvas}
      // canvasRef={canvasRef} -> removed
      // handlePointer... -> removed
      saveCanvasEdits={saveCanvasEdits}
      discardCanvasEdits={discardCanvasEdits}
      isCharOpen={isCharOpen}
      setCharOpen={setCharOpen}
      isAssistantOpen={isAssistantOpen}
      setAssistantOpen={setAssistantOpen}
      characters={characters}
      selectedCharacterId={selectedCharacterId}
      onSelectCharacter={setSelectedCharacterId}
      onGenerateCharacter={handleGenerateCharacter}
      onSaveCharacter={handleSaveCharacter}
      handleDeleteCharacter={handleDeleteCharacter}
      cmdPrompt={cmdPrompt}
      setCmdPrompt={setCmdPrompt}
      targetPage={targetPage}
      setTargetPage={setTargetPage}
      style={style}
      setStyle={setStyle}
      aspect={aspect}
      setAspect={setAspect}
      isGeneratingPage={isGeneratingPage}
      handleGeneratePage={handleGeneratePage}
      onDropOnPage={handleDropOnPage}
      onDropOnCanvas={handleDropOnCanvas}
    />
  );
};

export default Editor;