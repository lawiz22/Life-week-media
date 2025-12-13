import { useState } from 'react';
import { MediaFile } from '../MediaGrid';
import { utf8ToBase64 } from '../../utils/encoding';

interface VideoGridProps {
    files: MediaFile[];
    onSelect?: (file: MediaFile) => void;
    viewMode: 'large' | 'medium' | 'small' | 'list';
}

export function VideoGrid({ files, onSelect, viewMode }: VideoGridProps) {
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    const getGridClass = () => {
        switch (viewMode) {
            case 'large': return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
            case 'small': return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
            case 'list': return 'grid-cols-1';
            default: return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5'; // medium
        }
    };

    const needsTranscoding = (filepath: string) => {
        const ext = filepath.toLowerCase().split('.').pop() || '';
        const legacyFormats = ['avi', 'mpg', 'mpeg', 'wmv', 'm2v', 'vob', 'flv', 'f4v', 'mov'];
        return legacyFormats.includes(ext);
    };

    return (
        <div className={`grid ${getGridClass()} gap-4`}>
            {files.map((file) => (
                <div
                    key={file.id}
                    onClick={() => onSelect && onSelect(file)}
                    onMouseEnter={() => {
                        // Optimization: Only preview small videos (<500MB ~ 15min)
                        // Large movies just show the static thumbnail (seek @ 22s)
                        // Also skip legacy formats that need transcoding
                        const isLargeVideo = (file.size || 0) > 500 * 1024 * 1024;
                        const isLegacyFormat = needsTranscoding(file.filepath);
                        if (!isLargeVideo && !isLegacyFormat) {
                            setHoveredId(file.id);
                        }
                    }}
                    onMouseLeave={() => setHoveredId(null)}
                    className="group relative aspect-square bg-gray-800 rounded-md overflow-hidden border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                >
                    {/* Status Indicator */}
                    <div className="absolute top-2 right-2 z-10 bg-black/50 rounded-full p-1 backdrop-blur-sm">
                        {file.available ? (
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>

                    {/* Legacy Format Indicator */}
                    {needsTranscoding(file.filepath) && (
                        <div className="absolute top-2 left-2 z-10 bg-blue-600/80 text-white text-[10px] px-1.5 py-0.5 rounded font-bold tracking-wider backdrop-blur-sm border border-white/10">
                            LEGACY
                        </div>
                    )}

                    {hoveredId === file.id ? (
                        <video
                            src={`media://file/${utf8ToBase64(file.filepath)}`}
                            className="w-full h-full object-cover animate-in fade-in duration-300"
                            autoPlay
                            muted
                            loop
                            playsInline
                        />
                    ) : (
                        <div className="relative w-full h-full">
                            <img
                                src={`media://thumbnail/${file.id}`}
                                alt={file.filename}
                                className={`w-full h-full object-cover ${!file.available ? 'opacity-50 grayscale' : ''}`}
                                loading="lazy"
                            />
                            {/* Duration Overlay (if available in metadata) */}
                            {file.metadata && (typeof file.metadata === 'object' || typeof file.metadata === 'string') && (() => {
                                try {
                                    const meta = typeof file.metadata === 'string' ? JSON.parse(file.metadata) : file.metadata;
                                    if (meta?.duration) {
                                        const totalSeconds = Math.round(meta.duration);
                                        const mins = Math.floor(totalSeconds / 60);
                                        const secs = totalSeconds % 60;
                                        return (
                                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono backdrop-blur-sm">
                                                {mins}:{secs.toString().padStart(2, '0')}
                                            </div>
                                        );
                                    }
                                } catch (e) { /* ignore */ }
                                return null;
                            })()}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
