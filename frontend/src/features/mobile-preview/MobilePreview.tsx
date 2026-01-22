import React, { useState } from 'react';
import { useEditorStore } from '@/store/editorStore';
import { Smartphone, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';

const MobilePreview: React.FC = () => {
    const { pages, pageImages } = useEditorStore();
    const [isExporting, setIsExporting] = useState(false);

    const handleExportPDF = async () => {
        const sortedPages = [...pages].sort((a, b) => a - b);
        if (sortedPages.length === 0) return;

        setIsExporting(true);
        try {
            // Default A4 or custom size? Webtoon is usually continuous.
            // But PDF is paginated. Let's use A4 or match image aspect.
            // For simplicity, A4 vertical.
            const doc = new jsPDF();

            // Loop through pages
            for (let i = 0; i < sortedPages.length; i++) {
                const pageNum = sortedPages[i];
                const imgData = pageImages[pageNum];

                if (imgData) {
                    if (i > 0) doc.addPage();

                    const imgProps = doc.getImageProperties(imgData);
                    const pdfWidth = doc.internal.pageSize.getWidth();
                    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                }
            }

            doc.save('toonflow-chapter.pdf');
        } catch (error) {
            console.error("Export failed:", error);
            alert("Failed to export PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    // Determine content to show.
    // If we have pages defined in store, use them.
    // We will render a continuous vertical scroll of images.

    // Sort pages by index just in case, though store usually keeps them ordered?
    // The `pages` array in store usually contains objects like { id, ... }.
    // `pageImages` is Record<number, string> where number is 1-based index (targetPage).

    // Let's create an array of indices based on `pages.length`
    const pageIndices = Array.from({ length: pages.length }, (_, i) => i + 1);

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] items-center p-4 overflow-hidden">
            <div className="mb-4 text-center space-y-2 w-full">
                <div className="flex items-center justify-between px-4">
                    <h3 className="text-zinc-200 font-semibold text-sm flex items-center gap-2">
                        <Smartphone size={16} /> Mobile Preview
                    </h3>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="h-8 w-8 hover:bg-zinc-800"
                        title="Export PDF"
                    >
                        <Download size={14} className={isExporting ? "animate-bounce" : ""} />
                    </Button>
                </div>
                <p className="text-[10px] text-zinc-500">simulated phone view</p>
            </div>

            {/* Phone Frame */}
            <div
                className="relative w-full max-w-[280px] bg-black rounded-[2.5rem] p-3 shadow-2xl border-4 border-zinc-800 ring-1 ring-zinc-700/50"
                style={{ aspectRatio: '9/19' }}
            >
                {/* Notch/Dynamic Island */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-xl z-20"></div>

                {/* Screen Content */}
                <div className="w-full h-full bg-white rounded-[1.8rem] overflow-hidden relative">
                    {/* Status Bar Mockup */}
                    <div className="absolute top-0 w-full h-8 bg-black/20 backdrop-blur-sm z-10 flex justify-between px-4 items-center text-[9px] text-white font-medium">
                        <span>9:41</span>
                        <div className="flex gap-1">
                            <div className="w-3 h-3 rounded-full bg-white/20"></div>
                            <div className="w-3 h-3 rounded-full bg-white/20"></div>
                        </div>
                    </div>

                    {/* Scrollable Webtoon Content */}
                    <div className="w-full h-full overflow-y-auto no-scrollbar scroll-smooth bg-white">
                        <div className="flex flex-col min-h-full">
                            {pageIndices.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center text-zinc-400 p-8 text-center text-xs">
                                    No pages generated yet
                                </div>
                            ) : (
                                pageIndices.map(pageNum => {
                                    const imgUrl = pageImages[pageNum];
                                    return (
                                        <div key={pageNum} className="w-full">
                                            {imgUrl ? (
                                                <img
                                                    src={imgUrl}
                                                    alt={`Page ${pageNum}`}
                                                    className="w-full h-auto block"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full aspect-[3/4] bg-zinc-100 flex items-center justify-center text-zinc-300 text-xs border-b border-zinc-200">
                                                    Page {pageNum}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}

                            {/* End of content spacing */}
                            <div className="h-20 bg-zinc-50 flex items-center justify-center text-[10px] text-zinc-300 uppercase tracking-widest pb-8">
                                End of Series
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Home Indicator */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-zinc-600/50 rounded-full"></div>
            </div>
        </div>
    );
};

export default MobilePreview;
