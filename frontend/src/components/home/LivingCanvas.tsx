import React, { useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ArrowRight, Palette, Layers, Zap, PenTool } from 'lucide-react';

const LivingCanvas = () => {
    return (
        <section className="relative w-full py-24 bg-[#050505] overflow-hidden">
            {/* Background Noise & Gradient */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <svg className="w-full h-full">
                    <filter id="noiseFilter">
                        <feTurbulence type="fractalNoise" baseFrequency="0.6" stitchTiles="stitch" />
                        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noiseFilter)" opacity="0.4" />
                </svg>
            </div>

            {/* Glow Orbs */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] pointer-events-none mix-blend-screen animate-pulse-glow" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

            <div className="container relative z-10 mx-auto px-4">
                <div className="mb-16 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="mb-4"
                    >
                        <h1 className="text-5xl md:text-7xl mb-2">The Living Canvas</h1>
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className="text-lg text-gray-400 max-w-2xl mx-auto"
                    >
                        Where your stories breathe. A professional studio environment designed for the modern webtoon creator.
                    </motion.p>
                </div>

                {/* Asymmetric Grid */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 max-w-7xl mx-auto auto-rows-[300px]">

                    {/* Card 1: Large Feature */}
                    <div className="md:col-span-8 md:row-span-2">
                        <CanvasCard
                            title="Infinite Layers"
                            subtitle="Non-destructive workflow"
                            icon={<Layers className="w-8 h-8 text-cyan-400" />}
                            color="cyan"
                            image="/assets/showcase/ramayana.png" // Keep specific small preview if needed, or remove. 
                            backgroundImage="/assets/showcase/infinite-layers.png"
                        />
                    </div>

                    {/* Card 2: Tool */}
                    <div className="md:col-span-4 md:row-span-1">
                        <CanvasCard
                            title="Smart Brushes"
                            subtitle="AI-assisted inking"
                            icon={<PenTool className="w-8 h-8 text-violet-400" />}
                            color="violet"
                            backgroundImage="/assets/showcase/smart-brushes.png"
                        />
                    </div>

                    {/* Card 3: Feature */}
                    <div className="md:col-span-4 md:row-span-1">
                        <CanvasCard
                            title="Color Harmony"
                            subtitle="Auto-palette generation"
                            icon={<Palette className="w-8 h-8 text-pink-400" />}
                            color="pink"
                            backgroundImage="/assets/showcase/color-harmony.png"
                        />
                    </div>

                    {/* Card 4: Performance */}
                    <div className="md:col-span-4 md:row-span-1">
                        <CanvasCard
                            title="3D References"
                            subtitle="Poseable models built-in"
                            icon={<Zap className="w-8 h-8 text-amber-400" />}
                            color="amber"
                            backgroundImage="/assets/showcase/3d-references.png"
                        />
                    </div>

                    {/* Card 5: Connect */}
                    <div className="md:col-span-8 md:row-span-1">
                        <CanvasCard
                            title="Collaborative Studio"
                            subtitle="Real-time multi-user editing"
                            icon={<ArrowRight className="w-8 h-8 text-white" />}
                            color="white"
                            className="md:flex-row items-center"
                            backgroundImage="/assets/showcase/collaborative-studio.png"
                        />
                    </div>

                </div>
            </div>
        </section>
    );
};

const CanvasCard = ({ title, subtitle, icon, color, image, backgroundImage, className }: {
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    color: string,
    image?: string,
    backgroundImage?: string,
    className?: string
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const xSpring = useSpring(x, { stiffness: 300, damping: 30 });
    const ySpring = useSpring(y, { stiffness: 300, damping: 30 });

    const transform = useMotionTemplate`rotateX(${xSpring}deg) rotateY(${ySpring}deg)`;

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        const mouseX = (e.clientX - rect.left) * 32.5;
        const mouseY = (e.clientY - rect.top) * 32.5;

        const rX = (mouseY / height - 32.5 / 2) * -1;
        const rY = (mouseX / width - 32.5 / 2);

        x.set(rX);
        y.set(rY);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    const glowColor = {
        cyan: "shadow-cyan-500/20",
        violet: "shadow-violet-500/20",
        pink: "shadow-pink-500/20",
        amber: "shadow-amber-500/20",
        white: "shadow-white/10",
    }[color] || "shadow-white/10";

    const accentColor = {
        cyan: "text-cyan-400",
        violet: "text-violet-400",
        pink: "text-pink-400",
        amber: "text-amber-400",
        white: "text-white",
    }[color] || "text-white";

    const bgGradient = {
        cyan: "from-cyan-900/40 to-black/80",
        violet: "from-violet-900/40 to-black/80",
        pink: "from-pink-900/40 to-black/80",
        amber: "from-amber-900/40 to-black/80",
        white: "from-white/10 to-black/80",
    }[color] || "from-white/10 to-black/80";

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                transformStyle: "preserve-3d",
                transform
            }}
            className={cn(
                "relative h-full w-full rounded-xl bg-[#0f0f13] border border-white/5 overflow-hidden transition-all duration-200 group cursor-pointer",
                "hover:border-white/20 hover:shadow-2xl",
                glowColor,
                className
            )}
        >
            {/* Background Image with Overlay */}
            {backgroundImage && (
                <div className="absolute inset-0 z-0">
                    <img
                        src={backgroundImage}
                        alt="background"
                        className="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className={cn("absolute inset-0 bg-gradient-to-t", bgGradient)} />
                </div>
            )}


            {/* Z-depth layering */}
            <div
                style={{ transform: "translateZ(50px)" }}
                className="relative z-10 flex flex-col h-full justify-between p-8"
            >
                <div className="flex items-start justify-between">
                    <div className={cn("p-3 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 mb-4 inline-block shadow-lg", accentColor)}>
                        {icon}
                    </div>
                    {image && (
                        <div className="w-12 h-12 rounded-full border border-white/10 overflow-hidden bg-white/5 shadow-lg">
                            <img src={image} alt="preview" className="w-full h-full object-cover opacity-80" />
                        </div>
                    )}
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:translate-x-1 transition-transform drop-shadow-md">{title}</h3>
                    <p className="text-gray-300 font-medium group-hover:text-white transition-colors drop-shadow-sm">{subtitle}</p>
                </div>
            </div>

            {/* Noise Texture Overlay for Card */}
            <div className="relative z-20 absolute inset-0 opacity-[0.05] pointer-events-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")` }}
            />

        </motion.div>
    );
};

export default LivingCanvas;
