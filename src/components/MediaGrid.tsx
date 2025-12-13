import { useState } from 'react';
import { StatsModal } from './StatsModal';

export interface MediaFile {
    id: number;
    filepath: string;
    filename: string;
    type: string;
    category?: string; // 'music' or 'audio' for type='audio'
    createdAt?: number;
    available?: boolean;
    metadata?: any;
    size?: number;
}

interface MediaGridProps {
    type: string;
    onSelect?: (file: MediaFile) => void;
    // Controlled Props
    files: MediaFile[];
    loading: boolean;
    currentPage: number;
    onPageChange: (page: number) => void;
    pageSize: number;
    onPageSizeChange: (size: number) => void;
    viewMode: 'large' | 'medium' | 'small' | 'list';
    onViewModeChange: (mode: 'large' | 'medium' | 'small' | 'list') => void;
    // Auto-play (music only)
    autoPlay?: boolean;
    onAutoPlayChange?: (value: boolean) => void;
}

export function MediaGrid({
    type,
    onSelect,
    files,
    loading,
    currentPage,
    onPageChange,
    pageSize,
    onPageSizeChange,
    viewMode,
    onViewModeChange,
    autoPlay,
    onAutoPlayChange
}: MediaGridProps) {
    // hover state remains local as it's transient
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [showStats, setShowStats] = useState(false);




    if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

    if (files.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                {/* Always show Stats button for Projects even if empty */}
                {type === 'project' && (
                    <div
                        onClick={() => setShowStats(true)}
                        className="mb-8 group relative w-32 h-32 bg-gray-900 rounded-md overflow-hidden border-2 border-blue-500/50 hover:border-blue-400 transition-colors cursor-pointer flex flex-col items-center justify-center text-center p-4 hover:bg-gray-800 shadow-lg shadow-blue-900/10"
                    >
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-colors">
                            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h3 className="text-white font-medium text-sm">Projects per Week</h3>
                        <p className="text-blue-300 text-xs mt-1">View Stats</p>
                    </div>
                )}

                <p>No {type}s found.</p>
                <p className="text-sm mt-2">Try importing a folder from the sidebar.</p>
            </div>
        );
    }

    // Pagination Logic
    const totalPages = Math.ceil(files.length / pageSize);
    const paginatedFiles = files.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            onPageChange(newPage);
        }
    };

    const getGridClass = () => {
        switch (viewMode) {
            case 'large': return 'grid-cols-4 lg:grid-cols-5';  // Previously Medium
            case 'medium': return 'grid-cols-6 lg:grid-cols-8'; // Previously Small-ish
            case 'small': return 'grid-cols-10 lg:grid-cols-12'; // New Tiny
            default: return 'grid-cols-6 lg:grid-cols-8';
        }
    };

    // Format helpers
    const formatDate = (ts?: number) => ts ? new Date(ts).toLocaleDateString() : 'N/A';
    const getResolution = (m: any) => {
        if (!m) return '';
        const w = m.ImageWidth || m.ExifImageWidth || m.image_width;
        const h = m.ImageHeight || m.ExifImageHeight || m.image_height;
        return (w && h) ? `${w} x ${h}` : '';
    };
    const getCamera = (m: any) => m?.Model || m?.model || '';

    return (
        <div className="flex flex-col h-full">
            {/* Header / Stats Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <span className="text-gray-200 font-medium">Total: <span className="text-blue-400">{files.length}</span></span>

                    {/* Page Size Selector */}
                    <div className="flex items-center gap-2 ml-4 border-l border-gray-700 pl-4">
                        <span className="text-xs text-gray-500 uppercase font-bold">Per Page:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                onPageSizeChange(Number(e.target.value));
                                onPageChange(1);
                            }}
                            className="bg-gray-800 text-gray-300 text-sm border border-gray-700 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                            {[12, 20, 48, 96, 200].map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>

                    {/* Top Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-2 ml-4 border-l border-gray-700 pl-4">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-300"
                                title="Previous Page"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <span className="text-sm font-mono text-gray-400">
                                {currentPage} / {totalPages}
                            </span>
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="p-1 rounded hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-gray-300"
                                title="Next Page"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* View Controls */}
                    <div className="flex bg-gray-800 rounded p-1 mr-4 border border-gray-700">
                        <button
                            title="Large Grid"
                            onClick={() => onViewModeChange('large')}
                            className={`p-1.5 rounded ${viewMode === 'large' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            {/* Large: 2x2 grid look */}
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4V4zM13 4h7v7h-7V4zM4 13h7v7H4v-7zM13 13h7v7h-7v-7z" />
                            </svg>
                        </button>
                        <button
                            title="Medium Grid"
                            onClick={() => onViewModeChange('medium')}
                            className={`p-1.5 rounded ${viewMode === 'medium' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            {/* Medium: 3x3 grid look */}
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h4v4H4V4zM10 4h4v4h-4V4zM16 4h4v4h-4V4zM4 10h4v4H4v-4zM10 10h4v4h-4v-4zM16 10h4v4h-4v-4zM4 16h4v4H4v-4zM10 16h4v4h-4v-4zM16 16h4v4h-4v-4z" />
                            </svg>
                        </button>
                        <button
                            title="Small Grid"
                            onClick={() => onViewModeChange('small')}
                            className={`p-1.5 rounded ${viewMode === 'small' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            {/* Small: Dense dots/grid */}
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 4h2v2H4V4zm4 0h2v2H8V4zm4 0h2v2h-2V4zm4 0h2v2h-2V4zM4 8h2v2H4V8zm4 0h2v2H8V8zm4 0h2v2h-2V8zm4 0h2v2h-2V8zM4 12h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM4 16h2v2H4v-2zm4 0h2v2H8v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z" />
                            </svg>
                        </button>
                        <button
                            title="List View"
                            onClick={() => onViewModeChange('list')}
                            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h2v2H4zM4 12h2v2H4zM4 18h2v2H4z" />
                            </svg>
                        </button>
                    </div>

                    {(type === 'image' || type === 'video') && (
                        <button
                            onClick={() => setShowStats(true)}
                            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                        >
                            View Stats
                        </button>
                    )}

                    {type === 'audio' && onAutoPlayChange && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="auto-play-music"
                                checked={autoPlay || false}
                                onChange={(e) => onAutoPlayChange(e.target.checked)}
                                className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500/50"
                            />
                            <label htmlFor="auto-play-music" className="text-sm text-gray-300 select-none cursor-pointer">
                                Auto-play next song
                            </label>
                        </div>
                    )}
                </div>
            </div>

            {/* Project Disclaimer */}
            {type === 'project' && (
                <div className="bg-blue-900/20 border-b border-blue-900/50 px-6 py-2 text-xs text-blue-300 flex items-center justify-center">
                    <span className="mr-2">ℹ️</span>
                    Currently supports <strong>Ableton Live Projects (.als)</strong> only. Integrity check scans for missing samples automatically.
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
                <div className="flex-1">
                    {viewMode === 'list' ? (
                        // List View
                        <div className="w-full">
                            <table className="w-full text-left border-collapse">
                                <thead className="text-xs uppercase text-gray-500 border-b border-gray-800 sticky top-0 bg-gray-950/90 backdrop-blur-sm z-10">
                                    <tr>
                                        <th className="py-3 px-4 font-medium">Preview</th>
                                        <th className="py-3 px-4 font-medium">Name</th>
                                        <th className="py-3 px-4 font-medium">Date Taken</th>
                                        <th className="py-3 px-4 font-medium">Dimensions</th>
                                        <th className="py-3 px-4 font-medium">Camera</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {paginatedFiles.map((file) => (
                                        <tr
                                            key={file.id}
                                            onClick={() => onSelect && onSelect(file)}
                                            onMouseEnter={() => file.type === 'video' && setHoveredId(file.id)}
                                            onMouseLeave={() => setHoveredId(null)}
                                            className="hover:bg-gray-900/50 cursor-pointer transition-colors group"
                                        >
                                            <td className="py-2 px-4 w-16">
                                                <div className="w-10 h-10 rounded overflow-hidden bg-gray-800 border border-gray-700 group-hover:border-blue-500/50 relative">
                                                    {/* In List view, hover preview might be too small, but we enable it anyway or styling can limit it */}
                                                    {hoveredId === file.id && file.type === 'video' ? (
                                                        <video
                                                            src={`media://file/${btoa(file.filepath)}`}
                                                            className="w-full h-full object-cover"
                                                            autoPlay
                                                            muted
                                                            loop
                                                            playsInline
                                                        />
                                                    ) : (
                                                        <img
                                                            src={`media://thumbnail/${file.id}`}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-2 px-4">
                                                <div className="text-sm text-gray-200 font-medium truncate max-w-[300px]" title={file.filename}>
                                                    {file.filename}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate max-w-[300px]">
                                                    {file.filepath}
                                                </div>
                                            </td>
                                            <td className="py-2 px-4 text-sm text-gray-400">
                                                {file.metadata?.CreateDate ? new Date(file.metadata.CreateDate).toLocaleDateString() :
                                                    file.metadata?.DateTimeOriginal ? new Date(file.metadata.DateTimeOriginal).toLocaleDateString() :
                                                        formatDate(file.createdAt)}
                                            </td>
                                            <td className="py-2 px-4 text-xs text-gray-500 font-mono">
                                                {getResolution(file.metadata)}
                                            </td>
                                            <td className="py-2 px-4 text-xs text-gray-400">
                                                {getCamera(file.metadata)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        // Grid View
                        <div className={`grid ${getGridClass()} gap-4`}>
                            {/* Project Stats Button (First item in grid) */}
                            {type === 'project' && currentPage === 1 && (
                                <div
                                    onClick={() => setShowStats(true)}
                                    className="group relative aspect-square bg-gray-900 rounded-md overflow-hidden border-2 border-blue-500/50 hover:border-blue-400 transition-colors cursor-pointer flex flex-col items-center justify-center text-center p-4 hover:bg-gray-800 shadow-lg shadow-blue-900/10"
                                >
                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-colors">
                                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-white font-medium text-sm">Projects per Week</h3>
                                    <p className="text-blue-300 text-xs mt-1">View Stats</p>
                                </div>
                            )}

                            {paginatedFiles.map((file) => (
                                <div
                                    key={file.id}
                                    onClick={() => onSelect && onSelect(file)}
                                    onMouseEnter={() => {
                                        // Optimization: Only preview small videos (<500MB ~ 15min)
                                        // Large movies just show the static thumbnail (seek @ 22s)
                                        const isLargeVideo = (file.size || 0) > 500 * 1024 * 1024;
                                        if (file.type === 'video' && !isLargeVideo) {
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

                                    {hoveredId === file.id && file.type === 'video' ? (
                                        <video
                                            src={`media://file/${btoa(file.filepath)}`}
                                            className="w-full h-full object-cover animate-in fade-in duration-300"
                                            autoPlay
                                            muted
                                            loop
                                            playsInline
                                        />
                                    ) : (
                                        <>
                                            {type !== 'project' && (
                                                <img
                                                    src={`media://thumbnail/${file.id}`}
                                                    alt={file.filename}
                                                    className={`w-full h-full object-cover ${!file.available ? 'opacity-50 grayscale' : ''}`}
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        // Only log error if it's strictly an image type failing
                                                        if (type === 'image') console.warn('Failed to load image:', file.filepath);
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            )}

                                            {/* Audio/Music Metadata Overlay */}
                                            {file.type === 'audio' && (() => {
                                                // Parse metadata safely
                                                let meta: any = {};
                                                try {
                                                    meta = typeof file.metadata === 'string' ? JSON.parse(file.metadata) : file.metadata || {};
                                                } catch { }

                                                const title = meta.title || file.filename;
                                                const artist = meta.artist;
                                                const album = meta.album;
                                                const isMusic = file.category === 'music';

                                                return (
                                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-6 flex flex-col justify-end text-left transition-all duration-300">
                                                        <div className="text-white font-bold text-sm leading-tight line-clamp-2 shadow-sm">{title}</div>
                                                        {artist && <div className="text-gray-300 text-xs mt-0.5 font-medium shadow-sm truncate">{artist}</div>}
                                                        {isMusic && album && <div className="text-gray-400 text-xs mt-0.5 truncate">{album}</div>}
                                                    </div>
                                                );
                                            })()}

                                            {/* Audio Format Badge */}
                                            {file.type === 'audio' && (
                                                <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider backdrop-blur-sm border border-white/10 z-10">
                                                    {file.filename.split('.').pop()}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {(type === 'audio' || type === 'document') && (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2">
                                            <span className="text-4xl mb-2">{type === 'audio' ? '🎵' : '📄'}</span>
                                            <span className="text-xs text-center break-all">{file.filename}</span>
                                        </div>
                                    )}

                                    {type === 'project' && (() => {
                                        // Parse integrity
                                        let integrity: any = null;
                                        try {
                                            const m = typeof file.metadata === 'string' ? JSON.parse(file.metadata) : file.metadata;
                                            integrity = m?.integrity;
                                        } catch { }

                                        const status = integrity?.status || 'UNKNOWN';
                                        const isOk = status === 'OK';
                                        const isMissing = status === 'MISSING_FILES';

                                        return (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4 relative">
                                                {/* Ableton Logo Image */}
                                                <div className="mb-3 w-10 h-10 rounded overflow-hidden shadow-sm opacity-90">
                                                    <img src="/src/assets/ableton_logo.jpg" alt="Ableton Live" className="w-full h-full object-cover" />
                                                </div>

                                                <span className="text-xs text-center font-bold text-gray-300 break-all line-clamp-2 px-2">
                                                    {file.filename.replace('.als', '')}
                                                </span>

                                                {/* Integrity Badge */}
                                                <div className={`absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full shadow-lg border ${isOk ? 'bg-green-500/20 border-green-500 text-green-400' : isMissing ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-gray-700 border-gray-600 text-gray-400'}`}>
                                                    {isOk && (
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                    {isMissing && (
                                                        <span className="text-xs font-bold">!</span>
                                                    )}
                                                    {!isOk && !isMissing && (
                                                        <span className="text-xs font-bold">?</span>
                                                    )}
                                                </div>

                                                {/* Missing Count Badge */}
                                                {isMissing && (
                                                    <div className="absolute bottom-2 inset-x-2 bg-red-900/80 text-red-200 text-[10px] py-1 px-2 rounded text-center border border-red-800/50 backdrop-blur-sm">
                                                        {integrity.missing.length} Missing Files
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                                        <span className="text-xs text-white truncate w-full shadow-black drop-shadow-md">{file.filename}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 py-6 mt-4 border-t border-gray-800">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-2 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <div className="text-sm text-gray-400 font-medium">
                            Page <span className="text-white">{currentPage}</span> of <span className="text-white">{totalPages}</span>
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-2 rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {showStats && (
                <StatsModal
                    timestamps={files.map(f => ({ createdAt: f.createdAt || null }))}
                    onClose={() => setShowStats(false)}
                />
            )}
        </div>
    );
}
