import { useEffect, useState } from 'react';
import { StatsModal } from './StatsModal';

export interface MediaFile {
    id: number;
    filepath: string;
    filename: string;
    type: string;
    createdAt?: number;
    available?: boolean;
    metadata?: any;
    size?: number;
}

interface MediaGridProps {
    type: string;
    onSelect?: (file: MediaFile) => void;
    refreshKey?: number;
}

export function MediaGrid({ type, onSelect, refreshKey }: MediaGridProps) {
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showStats, setShowStats] = useState(false);
    const [viewMode, setViewMode] = useState<'large' | 'medium' | 'small' | 'list'>('medium');
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    useEffect(() => {
        loadFiles();
    }, [type, refreshKey]);

    const loadFiles = async () => {
        try {
            setLoading(true);
            const result = await window.ipcRenderer?.invoke('get-media', type);
            setFiles(result || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-400">Loading...</div>;

    if (files.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                <p>No {type}s found.</p>
                <p className="text-sm mt-2">Try importing a folder from the sidebar.</p>
            </div>
        );
    }

    const getGridClass = () => {
        switch (viewMode) {
            case 'large': return 'grid-cols-2 lg:grid-cols-3';
            case 'medium': return 'grid-cols-4 lg:grid-cols-6';
            case 'small': return 'grid-cols-8 lg:grid-cols-10';
            default: return 'grid-cols-4 lg:grid-cols-6';
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
                    <span className="text-gray-200 font-medium">Total {type === 'image' ? 'Images' : type}s: <span className="text-blue-400">{files.length}</span></span>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Controls */}
                    <div className="flex bg-gray-800 rounded p-1 mr-4 border border-gray-700">
                        <button
                            title="Large Grid"
                            onClick={() => setViewMode('large')}
                            className={`p-1.5 rounded ${viewMode === 'large' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </button>
                        <button
                            title="Medium Grid"
                            onClick={() => setViewMode('medium')}
                            className={`p-1.5 rounded ${viewMode === 'medium' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" opacity="0.5" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                            </svg>
                        </button>
                        <button
                            title="Small Grid"
                            onClick={() => setViewMode('small')}
                            className={`p-1.5 rounded ${viewMode === 'small' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <button
                            title="List View"
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h2v2H4zM4 12h2v2H4zM4 18h2v2H4z" />
                            </svg>
                        </button>
                    </div>

                    {type === 'image' && (
                        <button
                            onClick={() => setShowStats(true)}
                            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                        >
                            View Stats
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4">
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
                                {files.map((file) => (
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
                                                        src={`media://${encodeURIComponent(file.filepath)}`}
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
                        {files.map((file) => (
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
                                        src={`media://${encodeURIComponent(file.filepath)}`}
                                        className="w-full h-full object-cover animate-in fade-in duration-300"
                                        autoPlay
                                        muted
                                        loop
                                        playsInline
                                    />
                                ) : (
                                    <>
                                        <img
                                            src={`media://thumbnail/${file.id}`}
                                            alt={file.filename}
                                            className={`w-full h-full object-cover ${!file.available ? 'opacity-50 grayscale' : ''}`}
                                            loading="lazy"
                                            onError={(e) => {
                                                console.error('Failed to load image:', file.filepath);
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                        {/* Video Icon overlay (only if not hovering) */}
                                        {/* Video Icon overlay (only if not hovering) - REMOVED per user request */}
                                        {/*
                                        {file.type === 'video' && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm border border-white/20">
                                                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        )}
                                        */}
                                    </>
                                )}

                                {(type === 'project' || type === 'audio' || type === 'document') && (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2">
                                        <span className="text-4xl mb-2">📄</span>
                                        <span className="text-xs text-center break-all">{file.filename}</span>
                                    </div>
                                )}

                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                                    <span className="text-xs text-white truncate w-full shadow-black drop-shadow-md">{file.filename}</span>
                                </div>
                            </div>
                        ))}
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
