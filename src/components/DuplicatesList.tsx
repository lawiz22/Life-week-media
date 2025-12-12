import { useEffect, useState } from 'react';

interface MediaFile {
    id: number;
    filepath: string;
    filename: string;
    size: number;
}

interface DuplicatesListProps {
    refreshKey?: number;
}

export function DuplicatesList({ refreshKey }: DuplicatesListProps) {
    const [loading, setLoading] = useState(true);
    const [duplicates, setDuplicates] = useState<MediaFile[]>([]);
    const [hoveredFile, setHoveredFile] = useState<MediaFile | null>(null);

    useEffect(() => {
        loadDuplicates();
    }, [refreshKey]);

    const loadDuplicates = async () => {
        try {
            setLoading(true);
            const result = await window.ipcRenderer?.invoke('get-duplicates');
            setDuplicates(result || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-400">Scanning for duplicates...</div>;

    if (duplicates.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                <p>No duplicates found.</p>
                <p className="text-sm mt-2">Great job keeping your library clean!</p>
            </div>
        );
    }

    // Group by hash logic was done in backend but flattened?
    // Backend returns: SELECT * FROM media_files WHERE hash IN (...) ORDER BY hash.
    // So it returns a flat list sorted by hash.
    // We can group them in UI.

    const groups: Record<string, MediaFile[]> = {};
    duplicates.forEach(file => {
        const hash = (file as any).hash;
        if (!groups[hash]) groups[hash] = [];
        groups[hash].push(file);
    });

    const handleDelete = async (file: MediaFile) => {
        if (!confirm(`ARE YOU SURE?\n\nThis will PERMANENTLY DELETE the file:\n${file.filename}\n\nThis action cannot be undone.`)) {
            return;
        }

        try {
            const result = await window.ipcRenderer?.invoke('delete-file', { id: file.id, filepath: file.filepath });
            if (result.success) {
                // Remove from local state immediately
                setDuplicates(prev => prev.filter(f => f.id !== file.id));
            } else {
                alert('Failed to delete file: ' + result.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error deleting file');
        }
    };

    return (
        <div className="p-4 space-y-4 relative">
            {/* Hover Preview Box */}
            {hoveredFile && (
                <div
                    className="fixed pointer-events-none z-50 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-2 flex flex-col items-center"
                    style={{
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '400px',
                        maxHeight: '400px'
                    }}
                >
                    <img
                        src={`media://${hoveredFile.filepath.replace(/\\/g, '/')}`}
                        alt="Preview"
                        className="max-w-full max-h-[300px] object-contain rounded"
                    />
                    <div className="mt-2 text-xs text-center text-gray-300 break-all">
                        {hoveredFile.filename}
                    </div>
                    <div className="text-xs text-gray-500">
                        {(hoveredFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                </div>
            )}

            <h2 className="text-xl font-bold text-white mb-4">Detected Duplicates</h2>
            {Object.entries(groups).map(([hash, files]) => (
                <div key={hash} className="bg-gray-800 rounded-md p-4 border border-gray-700">
                    <div className="mb-2 text-sm text-gray-400">Hash: {hash.substring(0, 8)}...</div>
                    <div className="space-y-2">
                        {files.map(file => (
                            <div
                                key={file.id}
                                className="flex items-center justify-between bg-gray-900 p-2 rounded hover:bg-gray-800 transition-colors group"
                                onMouseEnter={() => setHoveredFile(file)}
                                onMouseLeave={() => setHoveredFile(null)}
                            >
                                <span className="text-sm truncate flex-1 mr-4" title={file.filepath}>
                                    <span className="font-medium text-white">{file.filename}</span>
                                    <span className="text-gray-500 text-xs ml-2 select-all">{file.filepath}</span>
                                </span>

                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>

                                    <button
                                        onClick={() => handleDelete(file)}
                                        className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                        title="Permanently Delete File"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
