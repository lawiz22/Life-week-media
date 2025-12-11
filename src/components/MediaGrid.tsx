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
}

interface MediaGridProps {
    type: string;
    onSelect?: (file: MediaFile) => void;
}

export function MediaGrid({ type, onSelect }: MediaGridProps) {
    const [files, setFiles] = useState<MediaFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [showStats, setShowStats] = useState(false);

    useEffect(() => {
        loadFiles();
    }, [type]);

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

    return (
        <div className="flex flex-col h-full">
            {/* Header / Stats Bar */}
            <div className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
                <div className="flex items-center gap-4">
                    <span className="text-gray-200 font-medium">Total {type === 'image' ? 'Images' : type}s: <span className="text-blue-400">{files.length}</span></span>
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

            {/* Scrollable Grid */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {files.map((file) => (
                        <div
                            key={file.id}
                            onClick={() => onSelect && onSelect(file)}
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
                            {type === 'video' && (
                                <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <span className="text-xs">{file.filename}</span>
                                </div>
                            )}
                            {(type === 'project' || type === 'audio' || type === 'document') && (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2">
                                    <span className="text-4xl mb-2">📄</span>
                                    <span className="text-xs text-center break-all">{file.filename}</span>
                                </div>
                            )}

                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                <span className="text-xs text-white truncate w-full">{file.filename}</span>
                            </div>
                        </div>
                    ))}
                </div>
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
