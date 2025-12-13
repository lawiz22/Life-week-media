import { useState, useEffect } from 'react';
import { MediaFile } from './MediaGrid';
import { WaveformPlayer } from './WaveformPlayer';

interface ImageDetailProps {
    media: MediaFile;
    onBack: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onSongEnd?: () => void;
}

export function ImageDetail({ media, onBack, onNext, onPrev, onSongEnd }: ImageDetailProps) {
    const [showAllMeta, setShowAllMeta] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', artist: '', album: '', year: '' });
    const [selectedCover, setSelectedCover] = useState<File | null>(null);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' && onNext) onNext();
            if (e.key === 'ArrowLeft' && onPrev) onPrev();
            if (e.key === 'Escape') onBack();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrev, onBack]);

    // Safely parse metadata if string (from DB) or use object
    let metadata: any = {};
    try {
        metadata = typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata || {};
    } catch (e) {
        console.warn('Failed to parse metadata', e);
    }

    // Initialize edit form when entering edit mode
    useEffect(() => {
        if (isEditing) {
            setEditForm({
                title: metadata.title || '',
                artist: metadata.artist || '',
                album: metadata.album || '',
                year: metadata.year || ''
            });
        }
    }, [isEditing, metadata.title, metadata.artist, metadata.album, metadata.year]);

    const handleSaveMetadata = async () => {
        try {
            // Upload cover if selected
            if (selectedCover) {
                const arrayBuffer = await selectedCover.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                const result = await window.ipcRenderer?.invoke('upload-album-cover', media.id, Array.from(buffer));
                console.log('Cover upload result:', result);
            }

            const result = await window.ipcRenderer?.invoke('update-audio-metadata', media.id, editForm);
            console.log('Metadata update result:', result);

            setIsEditing(false);
            setSelectedCover(null);

            // Close detail view and hard reload to clear cache
            onBack(); // Close detail view

            // Hard reload to clear all caches
            setTimeout(() => {
                window.location.reload();
            }, 100);
        } catch (err) {
            console.error('Failed to save metadata:', err);
            alert('Failed to save metadata: ' + err);
        }
    };

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
        // Check various possible keys for GPS
        const lat = metadata?.latitude ?? metadata?.GPSLatitude ?? metadata?.gps_latitude ?? metadata?.gps?.latitude;
        const lon = metadata?.longitude ?? metadata?.GPSLongitude ?? metadata?.gps_longitude ?? metadata?.gps?.longitude;

        if (typeof lat === 'number' && typeof lon === 'number') {
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
        }
        return 'N/A';
    };

    // Helper to format Duration (seconds to MM:SS)
    const formatDuration = (sec: number) => {
        if (!sec) return undefined;
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Key stats
    const getKeyStats = () => {
        if (!metadata) return [];
        const valid = (v: any) => v !== undefined && v !== null && v !== '';

        let items: { label: string; value: any }[] = [];

        if (media.type === 'video') {
            items = [
                { label: 'Duration', value: formatDuration(metadata.duration) },
                { label: 'Resolution', value: (metadata.width && metadata.height) ? `${metadata.width}x${metadata.height}` : undefined },
                { label: 'Format', value: metadata.format_long_name || metadata.format_name },
                { label: 'Video Codec', value: metadata.codec },
                { label: 'Audio Codec', value: metadata.audio_codec },
                { label: 'FPS', value: metadata.fps },
                { label: 'Bitrate', value: metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps` : undefined },
                { label: 'Size', value: metadata.FileSize },
            ];
        } else {
            items = [
                { label: 'Camera', value: `${metadata.Make || ''} ${metadata.Model || ''}`.trim() },
                { label: 'Lens', value: metadata.LensModel || metadata.LensType || metadata.LensSpec || metadata.LensID },
                { label: 'ISO', value: metadata.ISO },
                { label: 'Aperture', value: metadata.FNumber ? `f/${metadata.FNumber}` : undefined },
                { label: 'Shutter', value: metadata.ExposureTime ? (metadata.ExposureTime < 1 ? `1/${Math.round(1 / metadata.ExposureTime)}s` : `${metadata.ExposureTime}s`) : undefined },
                { label: 'Focal Length', value: metadata.FocalLength ? `${metadata.FocalLength}mm` : undefined },
                { label: 'Dimensions', value: (metadata.ImageWidth && metadata.ImageHeight) ? `${metadata.ImageWidth} x ${metadata.ImageHeight}` : undefined },
                { label: 'File Size', value: metadata.FileSize }, // ex: "35 MB" string from exiftool sometimes
            ];
        }

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
                {/* Image/Video Area */}
                <div className="flex-1 bg-black flex items-center justify-center p-4 relative overflow-hidden">
                    {/* Background Blur */}
                    <div
                        className="absolute inset-0 opacity-20 blur-3xl scale-110"
                        style={{ backgroundImage: `url('media://thumbnail/${media.id}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    ></div>

                    {/* Main Content */}
                    <div className="relative z-10 max-w-full max-h-full flex flex-col items-center justify-center p-8 w-full h-full group">

                        {/* Nav Arrows */}
                        {onPrev && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/30 hover:bg-black/60 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50 opacity-0 group-hover:opacity-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        {onNext && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onNext(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/30 hover:bg-black/60 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50 opacity-0 group-hover:opacity-100"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {/* Video Player */}
                        {media.type === 'video' && isAvailable ? (
                            <div className="relative max-w-full max-h-full flex items-center justify-center">
                                <video
                                    controls
                                    autoPlay
                                    className="max-w-full max-h-full shadow-2xl rounded-lg bg-black cursor-pointer"
                                    src={`media://file/${btoa(media.filepath)}`}
                                    poster={`media://thumbnail/${media.id}`}
                                    onError={(e) => {
                                        console.error('Video playback error:', e.currentTarget.error);
                                        // Force show controls even if error
                                        e.currentTarget.controls = true;

                                        // If network error (4), standard fallback
                                        const err = e.currentTarget.error;
                                        if (err && err.code === 4) {
                                            // 4 = MEDIA_ERR_SRC_NOT_SUPPORTED
                                            // Could be format or path
                                        }
                                    }}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center text-white bg-black/50 pointer-events-none">
                                        <p>Your browser does not support this video format.</p>
                                    </div>
                                </video>
                            </div>
                        ) : (
                            /* Image only (not for audio files - they have player below) */
                            media.type !== 'audio' && (
                                <img
                                    src={isAvailable ? `media://file/${btoa(media.filepath)}` : `media://thumbnail/${media.id}`}
                                    alt={media.filename}
                                    onClick={() => isAvailable && setShowLightbox(true)}
                                    className={`max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-all duration-300 
                                        ${isAvailable ? 'cursor-zoom-in hover:scale-[1.01]' : 'opacity-40 grayscale cursor-not-allowed'}
                                    `}
                                    onError={(e) => {
                                        const img = e.currentTarget;
                                        if (isAvailable) setIsAvailable(false);
                                        img.src = `media://thumbnail/${media.id}`;
                                    }}
                                />
                            )
                        )}

                        {/* Audio Player */}
                        {media.type === 'audio' && isAvailable && (
                            <div className="mt-8 w-full max-w-4xl animate-in slide-in-from-bottom duration-500 fade-in fill-mode-backwards delay-150 px-8 space-y-4">
                                {/* Album Cover for Music (not for generic audio with waveform) */}
                                {media.category === 'music' && (
                                    <div className="flex justify-center">
                                        <img
                                            src={`media://thumbnail/${media.id}`}
                                            alt="Album cover"
                                            className="w-64 h-64 object-cover rounded-lg shadow-2xl border-2 border-gray-700"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    </div>
                                )}

                                <WaveformPlayer
                                    src={`media://file/${btoa(media.filepath)}`}
                                    height={160}
                                    waveColor="#4b5563"
                                    progressColor="#3b82f6"
                                    onSongEnd={onSongEnd}
                                    autoPlay={!!onSongEnd}
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
                                    {!isEditing ? (
                                        <>
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

                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit Metadata
                                            </button>
                                        </>
                                    ) : (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase block mb-1">Title</label>
                                                <input
                                                    type="text"
                                                    value={editForm.title}
                                                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase block mb-1">Artist</label>
                                                <input
                                                    type="text"
                                                    value={editForm.artist}
                                                    onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                                                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase block mb-1">Album</label>
                                                <input
                                                    type="text"
                                                    value={editForm.album}
                                                    onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                                                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase block mb-1">Year</label>
                                                <input
                                                    type="text"
                                                    value={editForm.year}
                                                    onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                                                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none"
                                                    placeholder="2024"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase block mb-1">Album Cover</label>

                                                {/* Show existing cover if available */}
                                                {!selectedCover && (
                                                    <div className="mb-2">
                                                        <img
                                                            src={`media://thumbnail/${media.id}`}
                                                            alt="Current album cover"
                                                            className="w-32 h-32 object-cover rounded border border-gray-700"
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                )}

                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={(e) => setSelectedCover(e.target.files?.[0] || null)}
                                                    className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
                                                />
                                                {selectedCover && (
                                                    <p className="text-xs text-green-400 mt-1">Selected: {selectedCover.name}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2 pt-2">
                                                <button
                                                    onClick={handleSaveMetadata}
                                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(false)}
                                                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
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
                                <p className={`font-mono ${gps !== 'N/A' ? 'text-blue-400' : 'text-gray-600'} break-all`}>{gps}</p>
                                {gps !== 'N/A' && (
                                    <button
                                        onClick={() => {
                                            const [lat, lon] = gps.split(',').map(s => s.trim());
                                            window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, '_blank');
                                        }}
                                        className="mt-2 flex items-center gap-2 text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 border border-blue-800 px-3 py-1.5 rounded transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        View on Google Maps
                                    </button>
                                )}
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
                    {media.type === 'video' ? (
                        <video
                            controls
                            autoPlay
                            className="max-w-[95vw] max-h-[95vh] rounded-lg bg-black"
                            src={`media://file/${btoa(media.filepath)}`}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <img
                            src={`media://file/${btoa(media.filepath)}`}
                            alt={media.filename}
                            className="max-w-[95vw] max-h-[95vh] object-contain"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image itself? Or allow for pan/zoom later. For now let's allow closing on background.
                        />
                    )}
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
