import { useEffect, useState } from 'react';

interface MediaFile {
    id: number;
    filepath: string;
    filename: string;
    size: number;
}

export function DuplicatesList() {
    const [loading, setLoading] = useState(true);
    const [duplicates, setDuplicates] = useState<MediaFile[]>([]);

    useEffect(() => {
        loadDuplicates();
    }, []);

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
        // We don't have hash in the interface above, but backend returns it.
        // Let's assume we can group by filename+size or rely on order.
        // Actually, better to group by hash if available. 
        // Let's add hash to interface.
        const hash = (file as any).hash;
        if (!groups[hash]) groups[hash] = [];
        groups[hash].push(file);
    });

    return (
        <div className="p-4 space-y-4">
            <h2 className="text-xl font-bold text-white mb-4">Detected Duplicates</h2>
            {Object.entries(groups).map(([hash, files]) => (
                <div key={hash} className="bg-gray-800 rounded-md p-4 border border-gray-700">
                    <div className="mb-2 text-sm text-gray-400">Hash: {hash.substring(0, 8)}...</div>
                    <div className="space-y-2">
                        {files.map(file => (
                            <div key={file.id} className="flex items-center justify-between bg-gray-900 p-2 rounded">
                                <span className="text-sm truncate flex-1 mr-4" title={file.filepath}>
                                    {file.filename} <span className="text-gray-600 text-xs">({file.filepath})</span>
                                </span>
                                <span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
