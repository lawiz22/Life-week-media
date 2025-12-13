import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveformPlayerProps {
    src: string;
    height?: number;
    waveColor?: string;
    progressColor?: string;
    onSongEnd?: () => void;
    autoPlay?: boolean;
}

export function WaveformPlayer({
    src,
    height = 120,
    waveColor = '#4b5563', // gray-600
    progressColor = '#3b82f6', // blue-500
    onSongEnd,
    autoPlay,
}: WaveformPlayerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [zoom, setZoom] = useState(0);
    const [duration, setDuration] = useState(0);

    // Format time helper (MM:SS)
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (wavesurferRef.current) {
            wavesurferRef.current.zoom(zoom);
        }
    }, [zoom]);

    useEffect(() => {
        if (!containerRef.current) return;

        let isMounted = true;
        let ws: WaveSurfer | null = null;
        let blobUrl: string | null = null;

        const init = async () => {
            // Create instance
            ws = WaveSurfer.create({
                container: containerRef.current!,
                waveColor: waveColor,
                progressColor: progressColor,
                height: height,
                barWidth: 2,
                barGap: 1,
                barRadius: 2,
                cursorColor: '#ffffff',
                cursorWidth: 1,
                normalize: true,
                minPxPerSec: 0,
                fillParent: true,
            });

            // Set up events
            ws.on('ready', () => {
                if (isMounted) setDuration(ws!.getDuration());
            });

            ws.on('audioprocess', (time) => {
                if (isMounted) setCurrentTime(time);
            });

            ws.on('error', (err) => {
                console.error('WaveformPlayer: WaveSurfer Error:', err);
            });

            ws.on('play', () => isMounted && setIsPlaying(true));
            ws.on('pause', () => isMounted && setIsPlaying(false));
            ws.on('finish', () => {
                if (isMounted) {
                    setIsPlaying(false);
                    onSongEnd?.();
                }
            });

            // Pass the full media:// URL to the IPC handler
            // The backend will handle decoding (base64 for media://file/, or legacy for media://)
            try {
                // Fetch buffer from Main process
                // @ts-ignore
                const buffer = await window.ipcRenderer?.invoke('read-file-buffer', src);

                if (isMounted && buffer) {
                    const blob = new Blob([buffer], { type: 'audio/wav' });

                    if (ws) {
                        // WaveSurfer v7 supports loading a Blob directly
                        await ws.loadBlob(blob);
                        wavesurferRef.current = ws;

                        // Auto-play if enabled
                        if (autoPlay) {
                            ws.play();
                        }
                    }
                }
            } catch (e) {
                console.error('WaveformPlayer: Error loading audio:', e);
            }
        };

        init();

        return () => {
            isMounted = false;
            // Cleanup
            if (ws) {
                // ws.destroy(); // Keep destroy to stop playback
                ws.destroy();
            }
            if (blobUrl) {
                // URL.revokeObjectURL(blobUrl); // Disable revoke to rule out race condition
            }
        };
    }, [src, height, waveColor, progressColor]);

    const togglePlay = () => {
        if (wavesurferRef.current) {
            wavesurferRef.current.playPause();
        }
    };

    return (
        <div className="w-full bg-gray-900/50 rounded-xl p-4 border border-gray-800 backdrop-blur-sm shadow-xl">
            {/* Waveform Container */}
            <div className="relative group">
                {/* Scrollable Container Wrapper */}
                <div
                    ref={containerRef}
                    className="w-full overflow-x-auto overflow-y-hidden cursor-crosshair no-scrollbar"
                />

                {/* Overlay Play Button (Centered before play) */}
                {!isPlaying && currentTime === 0 && (
                    <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="bg-blue-600/90 text-white p-4 rounded-full shadow-lg backdrop-blur-sm animate-in zoom-in duration-300">
                            <svg className="w-8 h-8 pl-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between mt-4">
                <button
                    onClick={togglePlay}
                    className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg shadow-blue-900/40 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                    {isPlaying ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                        </svg>
                    ) : (
                        <svg className="w-5 h-5 pl-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    )}
                </button>

                <div className="flex-1 mx-4 flex flex-col justify-center">
                    {/* Time & Zoom */}
                    <div className="flex justify-between items-center text-xs font-mono text-gray-400 mb-1">
                        <div className="flex gap-4">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>

                        {/* Zoom Control */}
                        <div className="flex items-center gap-2 group/zoom">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-500 group-hover/zoom:text-blue-400 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                            <input
                                type="range"
                                min="0"
                                max="500"
                                value={zoom}
                                onChange={(e) => setZoom(Number(e.target.value))}
                                className="w-20 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer hover:bg-gray-600 accent-blue-500 transition-colors"
                            />
                        </div>
                    </div>
                </div>

                {/* Volume / Other controls could go here */}
            </div>

            <style>{`
                /* Hide scrollbar for Chrome, Safari and Opera */
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                /* Hide scrollbar for IE, Edge and Firefox */
                .no-scrollbar {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
            `}</style>
        </div>
    );
}
