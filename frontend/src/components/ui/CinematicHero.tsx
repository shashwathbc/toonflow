import { useEffect, useRef, useState } from "react";

interface CinematicHeroProps {
    videoSrc: string | string[]; // Support single video or array of videos
    posterSrc?: string;
    className?: string;
    children?: React.ReactNode;
}

const CinematicHero = ({ videoSrc, posterSrc, className = "", children }: CinematicHeroProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

    // Convert single video to array for consistent handling
    const videoSources = Array.isArray(videoSrc) ? videoSrc : [videoSrc];
    const currentVideoSrc = videoSources[currentVideoIndex];

    useEffect(() => {
        // Detect mobile device
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // Lazy load video
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        video.load();
                        observer.disconnect();
                    }
                });
            },
            { threshold: 0.1 }
        );

        observer.observe(video);

        // Handle video load
        const handleCanPlay = () => {
            setIsLoaded(true);
            video.play().catch((error) => {
                console.log("Auto-play prevented:", error);
            });
        };

        // Handle video end - switch to next video in playlist
        const handleVideoEnd = () => {
            if (videoSources.length > 1) {
                setCurrentVideoIndex((prev) => (prev + 1) % videoSources.length);
                setIsLoaded(false); // Reset for fade-in effect
            }
        };

        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('ended', handleVideoEnd);

        return () => {
            observer.disconnect();
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('ended', handleVideoEnd);
        };
    }, [currentVideoIndex, videoSources.length]);

    return (
        <section className={`relative w-full overflow-hidden ${className}`}>
            {/* Video Background */}
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                poster={posterSrc}
                preload="metadata"
                key={currentVideoSrc} // Force re-render when video changes
                className={`
          w-full h-auto object-contain
          transition-opacity duration-[600ms] ease-in-out
          ${isLoaded ? 'opacity-100' : 'opacity-0'}
        `}
                style={{
                    // Prevent layout shift
                    willChange: 'opacity',
                    transform: 'translateZ(0)',
                }}
            >
                <source src={currentVideoSrc} type="video/mp4" />
                Your browser does not support the video tag.
            </video>

            {/* Poster Fallback - Shows while video loads */}
            {posterSrc && !isLoaded && (
                <div
                    className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${posterSrc})` }}
                />
            )}

            {/* Subtle Dark Overlay - Lighter on desktop, darker on mobile */}
            <div className={`absolute inset-0 ${isMobile ? 'bg-black/30' : 'bg-black/20'}`} />

            {/* Cinematic Grain Effect (Optional) */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay"
                style={{
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
                    backgroundRepeat: 'repeat',
                }}
            />

            {/* Content Overlay */}
            {children}

            {/* Scroll Indicator */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce z-10">
                <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center">
                    <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse" />
                </div>
            </div>
        </section>
    );
};

export default CinematicHero;
