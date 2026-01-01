import React, { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { getBrushesByCategory, getBrushById, BrushConfig, BRUSH_CATEGORIES } from '@/config/brushRegistry';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { HexColorPicker } from 'react-colorful';
import { Plus, RotateCcw } from 'lucide-react';

const ToolPropertiesPanel: React.FC = () => {
    const {
        activeCategory,
        activeBrushId,
        setActiveBrushId,
        activeTool, // For legacy check

        getStartBrushConfig,
        setBrushSetting,

        // Global setters
        color, setColor, swatches, addSwatch,
        setBrushSize, setOpacity
    } = useEditorStore();

    // Check if we are in a brush mode
    const isBrushMode = BRUSH_CATEGORIES.some(c => c.id === activeCategory);

    // If not in brush mode, show minimal or legacy properties (omitted for cleaner refactor, can fallback)
    // For now we assume this panel is primarily for brushes.

    const categoryBrushes = getBrushesByCategory(activeCategory);
    const activeBrushConfig = getStartBrushConfig(activeBrushId);

    // Auto-select first brush if category changed and current brush handles mismatch
    useEffect(() => {
        if (isBrushMode && categoryBrushes.length > 0) {
            const currentInCat = categoryBrushes.find(b => b.id === activeBrushId);
            if (!currentInCat) {
                setActiveBrushId(categoryBrushes[0].id);
            }
        }
    }, [activeCategory, activeBrushId, isBrushMode]);


    const handlePropChange = (prop: keyof BrushConfig, val: number) => {
        setBrushSetting(activeBrushId, prop, val);
        // Sync globals if needed
        if (prop === 'size') setBrushSize(val);
        if (prop === 'opacity') setOpacity(val);
    };

    if (!isBrushMode) {
        return (
            <div className="flex flex-col h-full bg-[#1e1e1e] text-zinc-300 font-sans text-xs p-4">
                <div className="text-zinc-500 italic text-center mt-10">
                    Properties not available for {activeTool}
                </div>

                {/* Still show color picker for shapes/fill */}
                <div className="mt-8 border-t border-zinc-800 pt-4">
                    <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px] mb-2">Color</div>
                    <HexColorPicker color={color} onChange={setColor} style={{ width: '100%', height: '120px' }} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-zinc-300 font-sans text-xs select-none overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {/* 1. TOP SECTION: Sub Tool Selector */}
            <div className="flex flex-col border-b border-zinc-800 flex-shrink-0">
                <div className="px-3 py-2 bg-[#252525] border-b border-zinc-900 font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    Sub Tools <span className="text-zinc-600">/</span> <span className="text-zinc-200 capitalize">{activeCategory}</span>
                </div>

                <div className="p-2 space-y-1">
                    {categoryBrushes.map((brush) => {
                        const isSelected = activeBrushId === brush.id;
                        const hasIcon = !!brush.icon;

                        return (
                            <button
                                key={brush.id}
                                onClick={() => setActiveBrushId(brush.id)}
                                className={`w-full text-left px-2 py-2 rounded-md flex items-center gap-3 transition-colors group relative overflow-hidden
                                ${isSelected
                                        ? 'bg-blue-600/10 text-blue-100 ring-1 ring-blue-500/50'
                                        : 'hover:bg-zinc-800 text-zinc-400'
                                    }`}
                            >
                                {hasIcon ? (
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className="relative w-12 h-8 rounded bg-[#1e1e1e] border border-zinc-700 overflow-hidden flex-shrink-0">
                                            <img
                                                src={brush.icon}
                                                alt={brush.label}
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                            />
                                        </div>
                                        <span className={`text-sm font-medium ${isSelected ? 'text-blue-200' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                                            {brush.label}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full border ${isSelected ? 'border-blue-400 bg-blue-400' : 'border-zinc-600'}`}></div>
                                        <span>{brush.label}</span>
                                    </div>
                                )}
                                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. MIDDLE SECTION: Brush Properties */}
            <div className="flex flex-col border-b border-zinc-800 flex-shrink-0">
                <div className="px-3 py-2 bg-[#252525] border-b border-zinc-900 border-t border-zinc-700 font-semibold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                    <span>Properties</span>
                    {/* Reset Button (Mock) */}
                    <button className="text-zinc-500 hover:text-zinc-300" title="Reset to default"><RotateCcw size={10} /></button>
                </div>

                <div className="p-4 space-y-5">
                    {/* SIZE */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-zinc-400">
                            <Label className="font-normal text-xs">Brush Size</Label>
                            <span className="text-[10px] bg-zinc-800 px-1.5 rounded">{activeBrushConfig.size}px</span>
                        </div>
                        <Slider
                            value={[activeBrushConfig.size]}
                            min={1} max={300} step={1}
                            onValueChange={(v) => handlePropChange('size', v[0])}
                        />
                    </div>

                    {/* OPACITY */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-zinc-400">
                            <Label className="font-normal text-xs">Opacity</Label>
                            <span className="text-[10px] bg-zinc-800 px-1.5 rounded">{activeBrushConfig.opacity}%</span>
                        </div>
                        <Slider
                            value={[activeBrushConfig.opacity]}
                            min={0} max={100} step={1}
                            onValueChange={(v) => handlePropChange('opacity', v[0])}
                        />
                    </div>

                    {/* FLOW */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-zinc-400">
                            <Label className="font-normal text-xs">Flow / Density</Label>
                            <span className="text-[10px] bg-zinc-800 px-1.5 rounded">{activeBrushConfig.flow}%</span>
                        </div>
                        <Slider
                            value={[activeBrushConfig.flow]}
                            min={1} max={100} step={1}
                            onValueChange={(v) => handlePropChange('flow', v[0])}
                        />
                    </div>

                    {/* HARDNESS */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-zinc-400">
                            <Label className="font-normal text-xs">Hardness</Label>
                            <span className="text-[10px] bg-zinc-800 px-1.5 rounded">{activeBrushConfig.hardness}%</span>
                        </div>
                        <Slider
                            value={[activeBrushConfig.hardness]}
                            min={0} max={100} step={5}
                            onValueChange={(v) => handlePropChange('hardness', v[0])}
                        />
                    </div>

                    {/* SPACING */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-zinc-400">
                            <Label className="font-normal text-xs">Spacing</Label>
                            <span className="text-[10px] bg-zinc-800 px-1.5 rounded">{activeBrushConfig.spacing}</span>
                        </div>
                        <Slider
                            value={[activeBrushConfig.spacing]}
                            min={0} max={50} step={0.5}
                            onValueChange={(v) => handlePropChange('spacing', v[0])}
                        />
                    </div>

                    {/* STABILIZATION */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-zinc-400">
                            <Label className="font-normal text-xs">Stabilization</Label>
                            <span className="text-[10px] bg-zinc-800 px-1.5 rounded">{activeBrushConfig.stabilization}</span>
                        </div>
                        <Slider
                            value={[activeBrushConfig.stabilization]}
                            min={0} max={50} step={1}
                            onValueChange={(v) => handlePropChange('stabilization', v[0])}
                        />
                    </div>
                </div>
            </div>

            {/* 3. COLOR SECTION */}
            <div className="flex flex-col flex-1 p-4 gap-4">
                <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px] mb-2">Color Picker</div>
                <div className="custom-color-picker">
                    <HexColorPicker color={color} onChange={setColor} style={{ width: '100%', height: '150px' }} />
                </div>
                <div className="flex items-center gap-2 bg-zinc-800 rounded px-2 py-1 border border-zinc-700">
                    <div className="w-4 h-4 rounded-sm border border-zinc-600" style={{ backgroundColor: color }}></div>
                    <input
                        className="bg-transparent border-none text-xs text-zinc-200 w-full focus:outline-none uppercase font-mono"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-6 gap-2 mt-2">
                    <button
                        onClick={() => addSwatch(color)}
                        className="aspect-square rounded-sm border border-zinc-700 bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 text-zinc-400 transition-colors"
                        title="Add current color to swatches"
                    >
                        <Plus size={14} />
                    </button>
                    {swatches.map((swatch, idx) => (
                        <button
                            key={idx}
                            onClick={() => setColor(swatch)}
                            className="aspect-square rounded-sm border border-zinc-700 relative group transition-transform hover:scale-105"
                            style={{ backgroundColor: swatch }}
                            title={swatch}
                        >
                            {color === swatch && (
                                <div className="absolute inset-0 border-2 border-white rounded-sm shadow-sm pointer-events-none"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ToolPropertiesPanel;
