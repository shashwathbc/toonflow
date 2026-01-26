import React, { useEffect, useRef, useState } from 'react';

interface VideoBackgroundProps {
    videos: string[];
    className?: string;
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({ videos, className = '' }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleVideoEnd = () => {
            // Move to next video in the playlist
            setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length);
        };

        video.addEventListener('ended', handleVideoEnd);

        return () => {
            video.removeEventListener('ended', handleVideoEnd);
        };
    }, [videos.length]);

    useEffect(() => {
        const video = videoRef.current;
        if (video) {
            video.load();
            video.play().catch(err => console.log('Video autoplay failed:', err));
        }
    }, [currentVideoIndex]);

    return (
        <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={className}
        >
            <source src={videos[currentVideoIndex]} type="video/mp4" />
        </video>
    );
};

export default VideoBackground;
