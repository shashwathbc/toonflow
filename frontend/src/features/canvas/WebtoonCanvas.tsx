import React from 'react';
import { useEditorStore } from '@/store/editorStore';
import { TOOL_CONFIG } from '../palettes/Tools/ToolPalette';
import CanvasSegment from './CanvasSegment';

const WebtoonCanvas: React.FC = () => {
    const { pages, activeTool } = useEditorStore();

    // Resolve Cursor from Config
    const currentToolConfig = TOOL_CONFIG.find(t => t.id === activeTool);
    const cursorStyle = currentToolConfig?.cursor || 'default';

    return (
        <div
            className="w-full h-full overflow-y-auto bg-zinc-800/50 flex flex-col items-center py-10 scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent"
            style={{ cursor: cursorStyle }}
        >
            <div className="flex flex-col shadow-2xl bg-white">
                {pages.map((pageId) => (
                    <CanvasSegment
                        key={pageId}
                        pageId={pageId}
                        width={700} // Webtoon standard width approx
                        height={1000} // Default height per chunk
                    />
                ))}

                {/* Footer / Extend Button area could go here */}
                <div className="w-full bg-zinc-100 p-4 flex justify-center border-t border-dashed border-zinc-300 text-zinc-500 text-sm hover:bg-zinc-200 cursor-pointer transition-colors">
                    + Add Page / Extend Canvas
                </div>
            </div>
        </div>
    );
};

export default WebtoonCanvas;
