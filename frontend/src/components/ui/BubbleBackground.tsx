
import { useEffect, useState } from "react";

const BubbleBackground = () => {
    const [bubbles, setBubbles] = useState<Array<{ id: number; style: React.CSSProperties }>>([]);

    useEffect(() => {
        // Generate random bubbles
        const newBubbles = Array.from({ length: 15 }).map((_, i) => {
            const size = Math.random() * 60 + 20; // 20px - 80px
            const left = Math.random() * 100; // 0% - 100%
            const duration = Math.random() * 10 + 10; // 10s - 20s
            const delay = Math.random() * 10; // 0s - 10s

            return {
                id: i,
                style: {
                    width: `${size}px`,
                    height: `${size}px`,
                    left: `${left}%`,
                    animation: `float-up ${duration}s linear infinite`,
                    animationDelay: `-${delay}s`, // Start at random times
                    bottom: '-100px', // Start below screen to avoid pop-in if not animating immediately
                }
            };
        });

        setBubbles(newBubbles);
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {bubbles.map((bubble) => (
                <div key={bubble.id} className="bubble" style={bubble.style} />
            ))}
        </div>
    );
};

export default BubbleBackground;
