import React, { useEffect } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { TOOLS_REGISTRY, ToolPropertyConfig } from '@/config/tools';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { HexColorPicker } from 'react-colorful';
import { Plus } from 'lucide-react';

const ToolPropertiesPanel: React.FC = () => {
    const {
        activeTool,
        activeSubTool,
        setActiveSubTool,
        toolSettings,
        setToolSetting,
        // Global visual state setters to sync provided sliders to actual store
        setBrushSize,
        setOpacity,
        // Color State
        color,
        setColor,
        swatches,
        addSwatch
    } = useEditorStore();

    const toolConfig = TOOLS_REGISTRY[activeTool] || TOOLS_REGISTRY['default'];
    const activeSubToolConfig = toolConfig.subTools?.find(st => st.id === activeSubTool) || toolConfig.subTools?.[0];

    // Ensure we have a valid subtool selected if possible
    useEffect(() => {
        if (toolConfig.subTools?.length > 0 && !toolConfig.subTools.find(st => st.id === activeSubTool)) {
            setActiveSubTool(toolConfig.subTools[0].id);
        }
    }, [activeTool, toolConfig, activeSubTool, setActiveSubTool]);

    // Handler for property changes
    const handlePropChange = (propId: string, val: any) => {
        if (!activeSubToolConfig) return;
        setToolSetting(activeSubToolConfig.id, propId, val);

        // SYNC: Map specific properties to global store limits for immediate canvas reaction
        // Ideally this logic moves to a subscriber or the canvas reads from toolSettings directly.
        // For now, we sync the common ones:
        if (propId === 'size') setBrushSize(val);
        if (propId === 'opacity') setOpacity(val);
    };

    // Get value helper
    const getValue = (prop: ToolPropertyConfig) => {
        if (!activeSubToolConfig) return prop.default;
        const saved = toolSettings[activeSubToolConfig.id]?.[prop.id];
        return saved !== undefined ? saved : prop.default;
    };

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-zinc-300 font-sans text-xs select-none overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {/* 1. TOP SECTION: Sub Tool Selector */}
            <div className="flex flex-col border-b border-zinc-800 flex-shrink-0">
                <div className="px-3 py-2 bg-[#252525] border-b border-zinc-900 font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    Sub Tools
                    <span className="text-zinc-600">/</span>
                    <span className="text-zinc-200">{toolConfig.label}</span>
                </div>

                <div className="p-2 space-y-1">
                    {toolConfig.subTools.length === 0 ? (
                        <div className="text-zinc-500 italic p-2 text-center">No sub-tools available</div>
                    ) : (
                        toolConfig.subTools.map((sub) => (
                            <button
                                key={sub.id}
                                onClick={() => setActiveSubTool(sub.id)}
                                className={`w-full text-left px-3 py-2 rounded-sm flex items-center gap-3 transition-colors
                                    ${activeSubTool === sub.id
                                        ? 'bg-blue-600/20 text-blue-100 border border-blue-600/30'
                                        : 'hover:bg-zinc-800 text-zinc-400'
                                    }`}
                            >
                                {/* Placeholder Icon */}
                                <div className={`w-4 h-4 rounded-full border ${activeSubTool === sub.id ? 'border-blue-400 bg-blue-400' : 'border-zinc-600'}`}></div>
                                <span>{sub.label}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* 2. MIDDLE SECTION: Tool Properties */}
            <div className="flex flex-col border-b border-zinc-800 flex-shrink-0">
                <div className="px-3 py-2 bg-[#252525] border-b border-zinc-900 border-t border-zinc-700 font-semibold text-zinc-400 uppercase tracking-wider">
                    Tool Properties
                </div>

                <div className="p-4 space-y-6">
                    {!activeSubToolConfig ? (
                        <div className="text-zinc-500 italic text-center">Select a tool to view properties</div>
                    ) : (
                        activeSubToolConfig.properties.map((prop) => (
                            <div key={prop.id} className="space-y-2">
                                <div className="flex justify-between items-center text-zinc-400">
                                    <Label className="font-normal text-xs">{prop.label}</Label>
                                    <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500">
                                        {getValue(prop)}
                                    </span>
                                </div>

                                {prop.type === 'slider' && (
                                    <Slider
                                        defaultValue={[prop.default]}
                                        value={[getValue(prop)]}
                                        min={prop.min}
                                        max={prop.max}
                                        step={prop.step || 1}
                                        onValueChange={(vals) => handlePropChange(prop.id, vals[0])}
                                        className="py-1"
                                    />
                                )}

                                {prop.type === 'boolean' && (
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            checked={getValue(prop)}
                                            onCheckedChange={(checked) => handlePropChange(prop.id, checked)}
                                        />
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 3. COLOR SECTION (New) */}
            <div className="flex flex-col flex-1 p-4 gap-4">
                <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[10px] mb-2">Color Picker</div>

                {/* Picker */}
                <div className="custom-color-picker">
                    <HexColorPicker color={color} onChange={setColor} style={{ width: '100%', height: '150px' }} />
                </div>

                {/* Hex Input */}
                <div className="flex items-center gap-2 bg-zinc-800 rounded px-2 py-1 border border-zinc-700">
                    <div className="w-4 h-4 rounded-sm border border-zinc-600" style={{ backgroundColor: color }}></div>
                    <input
                        className="bg-transparent border-none text-xs text-zinc-200 w-full focus:outline-none uppercase font-mono"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                    />
                </div>

                {/* Swatches Grid */}
                <div className="grid grid-cols-6 gap-2 mt-2">
                    {/* Add Button */}
                    <button
                        onClick={() => addSwatch(color)}
                        className="aspect-square rounded-sm border border-zinc-700 bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 text-zinc-400 transition-colors"
                        title="Add current color to swatches"
                    >
                        <Plus size={14} />
                    </button>

                    {/* Swatch Items */}
                    {swatches.map((swatch, idx) => (
                        <button
                            key={idx}
                            onClick={() => setColor(swatch)}
                            className="aspect-square rounded-sm border border-zinc-700 relative group transition-transform hover:scale-105"
                            style={{ backgroundColor: swatch }}
                            title={swatch}
                        >
                            {/* Simple active indicator */}
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
