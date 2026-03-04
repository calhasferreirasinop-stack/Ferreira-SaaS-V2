import { useState, useEffect, useRef } from 'react';

interface ImageCarouselProps {
    images: string[];
    alt?: string;
    intervalMs?: number;
    className?: string;
}

export default function ImageCarousel({ images, alt = '', intervalMs = 3500, className = '' }: ImageCarouselProps) {
    const [current, setCurrent] = useState(0);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const validImages = images.filter(Boolean);
    const count = validImages.length;

    useEffect(() => {
        if (count <= 1 || paused) return;
        timerRef.current = setInterval(() => {
            setCurrent(prev => (prev + 1) % count);
        }, intervalMs);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [count, paused, intervalMs]);

    if (count === 0) {
        return (
            <div className={`w-full h-full bg-slate-200 flex items-center justify-center ${className}`}>
                <span className="text-slate-400 text-sm">Sem fotos</span>
            </div>
        );
    }

    if (count === 1) {
        return (
            <img
                src={validImages[0]}
                alt={alt}
                className={`w-full h-full object-cover ${className}`}
                referrerPolicy="no-referrer"
            />
        );
    }

    return (
        <div
            className={`relative w-full h-full overflow-hidden ${className}`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {/* Slides */}
            {validImages.map((src, i) => (
                <img
                    key={i}
                    src={src}
                    alt={`${alt} ${i + 1}`}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                    style={{ opacity: i === current ? 1 : 0 }}
                />
            ))}

            {/* Dots */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                {validImages.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => setCurrent(i)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 ${i === current ? 'bg-white w-5 shadow-md' : 'bg-white/50'
                            }`}
                        aria-label={`Foto ${i + 1}`}
                    />
                ))}
            </div>

            {/* Slide counter */}
            <div className="absolute top-4 right-4 bg-black/40 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm z-10">
                {current + 1}/{count}
            </div>
        </div>
    );
}
