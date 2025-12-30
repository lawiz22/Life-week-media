import { useState } from 'react';
import { MediaFile } from '../MediaGrid';
import { utf8ToBase64 } from '../../utils/encoding';

interface VideoGridProps {
    files: MediaFile[];
    onSelect?: (file: MediaFile) => void;
    viewMode: 'large' | 'medium' | 'small' | 'list';
    sortConfig?: { key: keyof MediaFile | 'date'; direction: 'asc' | 'desc' };
    onSort?: (key: keyof MediaFile | 'date') => void;
}

export function VideoGrid({ files, onSelect, viewMode, sortConfig, onSort }: VideoGridProps) {
    const [hoveredId, setHoveredId] = useState<number | null>(null);

    const getGridClass = () => {
        switch (viewMode) {
            case 'large': // Was medium
                return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
            case 'medium': // Was small
                return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
            case 'small': // New dense mode
                return 'grid-cols-6 md:grid-cols-8 lg:grid-cols-10';
            default:
                return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
        }
    };

    const needsTranscoding = (filepath: string) => {
        const ext = filepath.toLowerCase().split('.').pop() || '';
        const legacyFormats = ['avi', 'mpg', 'mpeg', 'wmv', 'm2v', 'vob', 'flv', 'f4v', 'mov'];
        return legacyFormats.includes(ext);
    };

    const formatDate = (ts?: number) => ts ? new Date(ts).toLocaleDateString() : 'N/A';

    const getResolution = (m: any) => {
        if (!m) return '';
        const w = m.ImageWidth || m.ExifImageWidth || m.image_width || m.width;
        const h = m.ImageHeight || m.ExifImageHeight || m.image_height || m.height;
        return (w && h) ? `${w} x ${h}` : '';
    };

    const getDuration = (m: any) => {
        if (!m) return '';
        const meta = typeof m === 'string' ? JSON.parse(m) : m;
        if (meta?.duration) {
            const totalSeconds = Math.round(meta.duration);
            const mins = Math.floor(totalSeconds / 60);
            const secs = totalSeconds % 60;
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return '';
    };

    if (viewMode === 'list') {
        return (
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-400 border-b border-gray-800 text-xs uppercase tracking-wider">
                            <th className="py-3 px-4 w-24">Preview</th>
                            <th
                                className="py-3 px-4 cursor-pointer hover:text-blue-400 transition-colors"
                                onClick={() => onSort && onSort('filename')}
                            >
                                <div className="flex items-center gap-1">
                                    Name
                                    {sortConfig?.key === 'filename' && (
                                        <span className="text-blue-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </th>
                            <th
                                className="py-3 px-4 cursor-pointer hover:text-blue-400 transition-colors"
                                onClick={() => onSort && onSort('date')}
                            >
                                <div className="flex items-center gap-1">
                                    Date
                                    {sortConfig?.key === 'date' && (
                                        <span className="text-blue-500">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </th>
                            <th className="py-3 px-4">Duration</th>
                            <th className="py-3 px-4">Resolution</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {files.map((file) => (
                            <tr
                                key={file.id}
                                className="hover:bg-gray-800/50 transition-colors cursor-pointer group"
                                onClick={() => onSelect && onSelect(file)}
                            >
                                <td className="py-2 px-4">
                                    <div className="w-16 h-16 bg-gray-900 rounded overflow-hidden relative">
                                        <div className="absolute top-0 right-0 z-10 p-0.5">
                                            <svg className="w-3 h-3 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        </div>
                                        <img
                                            src={`media://thumbnail/${file.id}`}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                        />
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
                                <td className="py-2 px-4 text-xs text-gray-400 font-mono">
                                    {getDuration(file.metadata)}
                                </td>
                                <td className="py-2 px-4 text-xs text-gray-500 font-mono">
                                    {getResolution(file.metadata)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }





    return (
        <div className={`grid ${getGridClass()} gap-4`}>
            {files.map((file) => (
                <div
                    key={file.id}
                    onClick={() => onSelect && onSelect(file)}
                    onMouseEnter={() => {
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
                    <div className="absolute top-2 right-2 z-10 bg-black/50 rounded-full p-1 backdrop-blur-sm pointer-events-none">
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

                    {/* Delete Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Remove from Library ONLY? File will remain on disk.')) {
                                (window as any).ipcRenderer.invoke('delete-file', { id: file.id, filepath: file.filepath, onlyDb: true });
                                window.location.reload();
                            }
                        }}
                        className="absolute top-2 right-10 p-1 bg-black/50 hover:bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 backdrop-blur-sm z-20"
                        title="Remove from Library (Keep file)"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>

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

                            {/* Hover Overlay: Filename & Date */}
                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/90 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end">
                                <p className="text-white text-xs font-medium truncate drop-shadow-md">{file.filename}</p>
                                <p className="text-gray-300 text-[10px] font-mono truncate">
                                    {file.metadata?.CreateDate ? new Date(file.metadata.CreateDate).toLocaleDateString() : 'Unknown Date'}
                                </p>
                            </div>

                            {/* Duration Overlay (always visible in corner) */}
                            {Boolean(getDuration(file.metadata)) && (
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono backdrop-blur-sm group-hover:opacity-0 transition-opacity">
                                    {getDuration(file.metadata)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
