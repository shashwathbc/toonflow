
import React, { useState } from 'react';
import { useEditorStore, Layer } from '@/store/editorStore';
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2, GripVertical, MoreVertical, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const LayerPanel = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    const {
        layers, activeLayerId, setActiveLayer,
        addLayer, removeLayer, updateLayer,
        reorderLayers
    } = useEditorStore();

    // Reverse layers for display so top layer is at top of list
    const displayLayers = [...layers].reverse();

    const handleToggleVisibility = (e: React.MouseEvent, layer: Layer) => {
        e.stopPropagation();
        updateLayer(layer.id, { visible: !layer.visible });
    };

    const handleToggleLock = (e: React.MouseEvent, layer: Layer) => {
        e.stopPropagation();
        updateLayer(layer.id, { locked: !layer.locked });
    };

    return (
        <div className="flex flex-col h-full glass-panel text-zinc-100 flex-1 min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-[#252525]">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Layers</span>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-zinc-700"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Expand layers" : "Collapse layers"}
                    >
                        {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </Button>
                </div>
            </div>

            {/* Layer List */}
            {!isCollapsed && (
                <ScrollArea className="flex-1">
                    <div className="flex flex-col py-1">
                        {displayLayers.map((layer) => {
                            const isActive = layer.id === activeLayerId;

                            return (
                                <div
                                    key={layer.id}
                                    onClick={() => setActiveLayer(layer.id)}
                                    className={cn(
                                        "group flex items-center gap-2 px-2 py-2 border-b border-zinc-800/50 cursor-pointer transition-colors relative",
                                        isActive ? "bg-[#2a7bd1]/20 border-l-2 border-l-[#3b82f6]" : "hover:bg-zinc-800 border-l-2 border-l-transparent"
                                    )}
                                >
                                    {/* Visibility */}
                                    <button
                                        className="text-zinc-500 hover:text-zinc-200 p-1"
                                        onClick={(e) => handleToggleVisibility(e, layer)}
                                    >
                                        {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="text-zinc-600" />}
                                    </button>

                                    {/* Lock Status */}
                                    <button
                                        className={cn("p-1", layer.locked ? "text-amber-500" : "text-zinc-600 opacity-0 group-hover:opacity-100")}
                                        onClick={(e) => handleToggleLock(e, layer)}
                                    >
                                        {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                                    </button>

                                    {/* Thumbnail / Icon Placeholder */}
                                    <div className="w-8 h-8 rounded bg-white overflow-hidden flex items-center justify-center shrink-0 border border-zinc-700">
                                        {/* TODO: Real thumbnail */}
                                        {layer.type === 'pen' ? <div className="w-4 h-4 bg-black rounded-full" /> :
                                            layer.type === 'paint' ? <div className="w-full h-full bg-blue-500 opacity-50" /> :
                                                layer.type === 'image' ? <div className="text-[8px] text-zinc-900 font-bold">IMG</div> :
                                                    <div className="w-4 h-4 border-2 border-zinc-400" />
                                        }
                                    </div>

                                    {/* Names & Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <span className={cn("text-xs font-medium truncate", isActive ? "text-blue-200" : "text-zinc-300")}>
                                            {layer.name}
                                        </span>
                                        <span className="text-[10px] text-zinc-600 capitalize">{layer.blendMode} • {Math.round(layer.opacity * 100)}%</span>
                                    </div>

                                    {/* Actions Menu */}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="opacity-0 group-hover:opacity-100 p-1 hover:text-white text-zinc-500">
                                                <MoreVertical size={14} />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-40 bg-zinc-900 border-zinc-800 text-zinc-200">
                                            <DropdownMenuItem onClick={() => addLayer('pen')}><Plus className="mr-2 h-4 w-4" /> New Layer</DropdownMenuItem>
                                            <DropdownMenuItem><Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-400 focus:text-red-400"
                                                onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
};

export default LayerPanel;
