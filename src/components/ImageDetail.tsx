import { useState, useEffect } from 'react';
import { MediaFile } from './MediaGrid';

interface ImageDetailProps {
    media: MediaFile;
    onBack: () => void;
}

export function ImageDetail({ media, onBack }: ImageDetailProps) {
    const [showAllMeta, setShowAllMeta] = useState(false);

    // Safely parse metadata if string (from DB) or use object
    let metadata: any = {};
    try {
        metadata = typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata || {};
    } catch (e) {
        console.warn('Failed to parse metadata', e);
    }

    // Helper to format date
    const getDate = () => {
        // ExifTool provides these as 'Tags' object. Note: keys often PascalCase.
        // User requested ModifiedDate preferably.
        // Exiftool key for modified date is usually 'ModifyDate'
        // ExifTools returns keys in varying formats depending on version/config
        // User dump shows snake_case (e.g. modify_date)
        const rawDate =
            metadata?.DateTimeOriginal || metadata?.date_time_original || metadata?.dateTimeOriginal ||
            metadata?.CreateDate || metadata?.create_date ||
            metadata?.ModifyDate || metadata?.modify_date;

        if (rawDate) {
            // ExifTool often returns a proper Date object or a string resembling "2023:12:25 10:00:00"
            // or sometimes an object { year, month, ... }.
            // However, typical JSON serialization might turn it into string ISO if date object.
            // If it's the "YYYY:MM:DD" format:
            let dateObj: Date | null = null;

            if (typeof rawDate === 'object' && rawDate instanceof Date) {
                dateObj = rawDate;
            } else if (typeof rawDate === 'string') {
                // Try parsing ISO first
                const ts = Date.parse(rawDate);
                if (!isNaN(ts)) {
                    dateObj = new Date(ts);
                } else {
                    // Try "YYYY:MM:DD HH:MM:SS"
                    try {
                        const [d, t] = rawDate.split(' ');
                        const iso = d.replace(/:/g, '-') + (t ? 'T' + t : '');
                        dateObj = new Date(iso);
                    } catch { }
                }
            } else if (typeof rawDate === 'object') {
                // Sometimes exiftool returns typed date objects, assume string representation helps
                // Check if it has .toString() that is useful
                if (rawDate.rawValue) return rawDate.rawValue;
            }

            if (dateObj && !isNaN(dateObj.getTime())) {
                return dateObj.toLocaleDateString(undefined, {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            return String(rawDate);
        }

        // Fallback
        if (media.createdAt) {
            const d = new Date(media.createdAt);
            return d.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        return null;
    };

    // Helper to format GPS
    const getGPS = () => {
        // Exiftool returns GPSLatitude / GPSLongitude as numbers (decimal) usually
        // Exiftool usually returns numbers, check both cases
        const lat = metadata?.GPSLatitude || metadata?.gps_latitude;
        const lon = metadata?.GPSLongitude || metadata?.gps_longitude;

        if (typeof lat === 'number' && typeof lon === 'number') {
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
        return 'N/A';
    };

    // Key stats
    const getKeyStats = () => {
        if (!metadata) return [];
        const valid = (v: any) => v !== undefined && v !== null && v !== '';

        const items = [
            { label: 'Camera', value: `${metadata.Make || ''} ${metadata.Model || ''}`.trim() },
            { label: 'Lens', value: metadata.LensModel || metadata.LensType || metadata.LensSpec || metadata.LensID },
            { label: 'ISO', value: metadata.ISO },
            { label: 'Aperture', value: metadata.FNumber ? `f/${metadata.FNumber}` : undefined },
            { label: 'Shutter', value: metadata.ExposureTime ? (metadata.ExposureTime < 1 ? `1/${Math.round(1 / metadata.ExposureTime)}s` : `${metadata.ExposureTime}s`) : undefined },
            { label: 'Focal Length', value: metadata.FocalLength ? `${metadata.FocalLength}mm` : undefined },
            { label: 'Dimensions', value: (metadata.ImageWidth && metadata.ImageHeight) ? `${metadata.ImageWidth} x ${metadata.ImageHeight}` : undefined },
            { label: 'File Size', value: metadata.FileSize }, // ex: "35 MB" string from exiftool sometimes
        ];

        return items.filter(i => valid(i.value));
    };

    const date = getDate();
    const gps = getGPS();
    const stats = getKeyStats();

    // Flatten all metadata for "Show All"
    const allMeta = metadata ? Object.entries(metadata)
        .filter(([, val]) => typeof val !== 'object' || val === null) // Simple values only for top level list, or recurse? 
        // Exiftool is mostly flat.
        .sort(([a], [b]) => a.localeCompare(b)) : [];

    const [isAvailable, setIsAvailable] = useState<boolean>(true);
    const [showLightbox, setShowLightbox] = useState(false);

    useEffect(() => {
        // Check if file exists on disk
        const checkAvailability = async () => {
            if (window.ipcRenderer) {
                const exists = await window.ipcRenderer.invoke('check-file-exists', media.filepath);
                setIsAvailable(exists);
            }
        };
        checkAvailability();
    }, [media.filepath]);

    return (
        <div className="flex flex-col h-full bg-gray-950 text-white relative">
            {/* Top Bar */}
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 z-20">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors text-sm font-medium border border-gray-700"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Grid
                </button>
                <div className="flex-1 truncate">
                    <h2 className="text-lg font-semibold truncate">{media.filename}</h2>
                    <p className="text-xs text-gray-400 font-mono truncate">{media.filepath}</p>
                </div>
            </div>

            {/* Content w/ Scrollable Area */}
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10">
                {/* Image Area */}
                <div className="flex-1 bg-black flex items-center justify-center p-4 relative overflow-hidden">
                    {/* Background Blur */}
                    <div
                        className="absolute inset-0 opacity-20 blur-3xl scale-110"
                        style={{ backgroundImage: `url('media://thumbnail/${media.id}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    ></div>

                    {/* Main Image or Audio Player */}
                    <div className="relative z-10 max-w-full max-h-full flex flex-col items-center justify-center p-8 w-full">
                        <img
                            src={isAvailable && media.type !== 'audio' ? `media://${encodeURIComponent(media.filepath)}` : `media://thumbnail/${media.id}`}
                            alt={media.filename}
                            onClick={() => isAvailable && media.type !== 'audio' && setShowLightbox(true)}
                            className={`max-w-full max-h-[60vh] object-contain shadow-2xl rounded-lg transition-all duration-300 
                                ${media.type === 'audio' ? 'w-96 h-96 shadow-blue-900/40' : ''}
                                ${isAvailable && media.type !== 'audio' ? 'cursor-zoom-in hover:scale-[1.01]' : ''}
                                ${!isAvailable && media.type !== 'audio' ? 'opacity-40 grayscale cursor-not-allowed' : ''}
                            `}
                            onError={(e) => {
                                const img = e.currentTarget;
                                if (isAvailable && media.type !== 'audio') setIsAvailable(false);
                                img.src = `media://thumbnail/${media.id}`;
                            }}
                        />

                        {/* Audio Player */}
                        {media.type === 'audio' && isAvailable && (
                            <div className="mt-8 w-full max-w-2xl animate-in slide-in-from-bottom duration-500 fade-in fill-mode-backwards delay-150">
                                <audio
                                    controls
                                    autoPlay
                                    className="w-full h-12 shadow-lg"
                                    src={`media://${encodeURIComponent(media.filepath)}`}
                                />
                            </div>
                        )}

                        {!isAvailable && (
                            <div className="mt-4 bg-red-900/50 text-red-200 px-4 py-2 rounded-full flex items-center gap-2 border border-red-700/50 backdrop-blur-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Source File Offline</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar - Metadata */}
                <div className="w-full md:w-96 bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-xl flex flex-col">
                    <div className="p-6 space-y-8 flex-1">
                        {/* Major Info */}
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                {media.type === 'audio' ? 'Track Details' : 'Date Taken'}
                            </h3>
                            {media.type === 'audio' ? (
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-2xl font-bold text-white leading-tight">{metadata?.title || media.filename}</div>
                                        <div className="text-lg text-blue-400 font-medium">{metadata?.artist || 'Unknown Artist'}</div>
                                    </div>

                                    {metadata?.album && (
                                        <div>
                                            <div className="text-xs text-gray-500 uppercase">Album</div>
                                            <div className="text-gray-300">{metadata.album}</div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        {metadata?.year && (
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase">Year</div>
                                                <div className="text-gray-300">{metadata.year}</div>
                                            </div>
                                        )}
                                        {metadata?.genre && (
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase">Genre</div>
                                                <div className="text-gray-300">{Array.isArray(metadata.genre) ? metadata.genre.join(', ') : metadata.genre}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-xl font-extrabold text-white tracking-tight">
                                    {date || <span className="text-gray-600 font-normal italic">Unknown Date</span>}
                                </p>
                            )}
                        </div>

                        {media.type !== 'audio' && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">GPS Location</h3>
                                <p className={`font-mono ${gps !== 'N/A' ? 'text-blue-400' : 'text-gray-600'}`}>{gps}</p>
                            </div>
                        )}

                        {/* Snapshot Stats */}
                        {stats.length > 0 && (
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Key Details</h3>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                    {stats.map((s) => (
                                        <div key={s.label}>
                                            <div className="text-xs text-gray-500">{s.label}</div>
                                            <div className="text-sm font-medium text-gray-200 truncate" title={String(s.value)}>{String(s.value)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer / Show All Action */}
                    <div className="p-4 border-t border-gray-800 bg-gray-900 sticky bottom-0">
                        <button
                            onClick={() => setShowAllMeta(true)}
                            className="w-full py-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded text-sm text-gray-300 font-medium transition-colors"
                        >
                            Show All Metadata ({metadata ? Object.keys(metadata).length : 0})
                        </button>
                    </div>
                </div>
            </div>

            {/* Lightbox / Full Screen View (Only if available) */}
            {showLightbox && isAvailable && (
                <div
                    className="fixed inset-0 z-[100] bg-black flex items-center justify-center animate-in fade-in duration-200"
                    onClick={() => setShowLightbox(false)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/50 hover:text-white p-2"
                        onClick={() => setShowLightbox(false)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <img
                        src={`media://${encodeURIComponent(media.filepath)}`}
                        alt={media.filename}
                        className="max-w-[95vw] max-h-[95vh] object-contain"
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image itself? Or allow for pan/zoom later. For now let's allow closing on background.
                    />
                </div>
            )}

            {/* Full Metadata Overlay Modal */}
            {showAllMeta && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
                    <div className="w-full md:w-[600px] h-full bg-gray-950 border-l border-gray-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                            <h3 className="font-bold text-white">Full Metadata</h3>
                            <button onClick={() => setShowAllMeta(false)} className="p-2 hover:bg-gray-800 rounded">
                                ✕
                            </button>
                        </div>
                        {/* Error/fallback warning */}
                        {(metadata?.fallback || metadata?.error) && (
                            <div className="p-4 bg-yellow-900/30 border-b border-yellow-700/50 text-yellow-200 text-sm">
                                <p className="font-bold">⚠️ Using Backup Date</p>
                                <p className="opacity-80 mt-1">
                                    The camera's original date was missing or invalid, so we're using the file's created date instead.
                                </p>
                                {metadata.error && (
                                    <p className="font-mono text-xs mt-2 bg-black/30 p-2 rounded">
                                        Error: {metadata.error}
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
                            <div className="space-y-1">
                                {allMeta.map(([key, value]) => (
                                    <div key={key} className="grid grid-cols-[200px_1fr] border-b border-gray-800/50 pb-1 hover:bg-white/5">
                                        <span className="text-blue-400 truncate pr-2 select-all" title={key}>{key}</span>
                                        <span className="text-gray-300 break-all select-all">{String(value)}</span>
                                    </div>
                                ))}
                                {(!metadata || allMeta.length === 0) && (
                                    <p className="text-gray-500 italic">No metadata found.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
