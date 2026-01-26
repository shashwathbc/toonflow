import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Copy, ArrowRight, Check } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

interface AIChatProps {
    onAutofill: (prompt: string) => void;
}

export function AIChat({ onAutofill }: AIChatProps) {
    const [userInput, setUserInput] = useState("");
    const [generatedPrompt, setGeneratedPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();

    const handleGeneratePrompt = async () => {
        if (!userInput.trim()) {
            toast({
                title: "Input Required",
                description: "Please describe what you want to create",
                variant: "destructive"
            });
            return;
        }

        setIsGenerating(true);

        try {
            // Call API to generate optimized prompt
            const response = await fetch('http://localhost:5050/api/optimize-prompt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userInput }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate prompt');
            }

            const data = await response.json();
            setGeneratedPrompt(data.optimizedPrompt || data.prompt || userInput);

            toast({
                title: "Prompt Generated!",
                description: "Your optimized prompt is ready"
            });
        } catch (error) {
            console.error('Prompt generation error:', error);
            // Fallback: use a simple enhancement of the user input
            const fallbackPrompt = `${userInput}, highly detailed, professional manga style, black and white, dramatic lighting, dynamic composition`;
            setGeneratedPrompt(fallbackPrompt);

            toast({
                title: "Using Enhanced Prompt",
                description: "API unavailable, using local enhancement",
                variant: "default"
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generatedPrompt);
            setCopied(true);
            toast({ title: "Copied!", description: "Prompt copied to clipboard" });
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            toast({
                title: "Copy Failed",
                description: "Please copy manually",
                variant: "destructive"
            });
        }
    };

    const handleAutofill = () => {
        onAutofill(generatedPrompt);
        toast({
            title: "Autofilled!",
            description: "Prompt added to AI Assistant. Switch to left sidebar to generate."
        });
    };

    return (
        <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-right-2 duration-200 p-4">
            {/* User Input Section */}
            <div className="space-y-2">
                <label className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
                    Describe Your Scene
                </label>
                <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="w-full bg-zinc-800 border-zinc-700 rounded-md text-sm p-3 min-h-[100px] resize-none focus:ring-1 focus:ring-emerald-500 outline-none text-zinc-200 placeholder:text-zinc-600"
                    placeholder="e.g. a warrior standing on a cliff at sunset..."
                />
            </div>

            <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleGeneratePrompt}
                disabled={isGenerating || !userInput.trim()}
            >
                {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                )}
                {isGenerating ? "Generating..." : "Generate Prompt"}
            </Button>

            {/* Generated Prompt Section */}
            {generatedPrompt && (
                <div className="mt-4 border-t border-zinc-800 pt-4 space-y-3 flex-1 flex flex-col">
                    <p className="text-xs text-zinc-500 font-semibold uppercase">
                        Optimized Prompt
                    </p>

                    <div className="relative flex-1 min-h-[120px]">
                        <textarea
                            value={generatedPrompt}
                            readOnly
                            className="w-full h-full bg-zinc-900/50 border border-zinc-700 rounded-md text-sm p-3 resize-none text-zinc-200 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCopy}
                            className="bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200"
                        >
                            {copied ? (
                                <Check className="mr-2 h-4 w-4 text-green-500" />
                            ) : (
                                <Copy className="mr-2 h-4 w-4" />
                            )}
                            {copied ? "Copied!" : "Copy"}
                        </Button>

                        <Button
                            size="sm"
                            onClick={handleAutofill}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <ArrowRight className="mr-2 h-4 w-4" />
                            Autofill
                        </Button>
                    </div>

                    <p className="text-xs text-zinc-600 italic text-center">
                        Use autofill to send this prompt to the AI Assistant
                    </p>
                </div>
            )}

            {/* Empty State */}
            {!generatedPrompt && !isGenerating && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-zinc-600 text-xs space-y-2 max-w-[200px]">
                        <Sparkles className="mx-auto h-8 w-8 opacity-30" />
                        <p>Describe your scene and generate an optimized prompt for AI image generation</p>
                    </div>
                </div>
            )}
        </div>
    );
}
