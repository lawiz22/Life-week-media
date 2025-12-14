import { useEffect, useState, useMemo } from 'react';

interface MediaFile {
    id: number;
    filepath: string;
    filename: string;
    size: number;
    type: string;
    hash: string;
}

interface DuplicatesListProps {
    refreshKey?: number;
}

export function DuplicatesList({ refreshKey }: DuplicatesListProps) {
    const [loading, setLoading] = useState(true);
    const [duplicates, setDuplicates] = useState<MediaFile[]>([]);
    const [hoveredFile, setHoveredFile] = useState<MediaFile | null>(null);
    const [sortByName, setSortByName] = useState(false);
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

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

    const handleDelete = async (file: MediaFile) => {
        if (!confirm(`Permanently delete:\n${file.filename}?`)) return;

        try {
            const result = await window.ipcRenderer?.invoke('delete-file', { id: file.id, filepath: file.filepath });
            if (result.success) {
                setDuplicates(prev => prev.filter(f => f.id !== file.id));
            } else {
                alert('Failed to delete: ' + result.error);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleType = (type: string) => {
        setExpandedTypes(prev => {
            const next = new Set(prev);
            if (next.has(type)) {
                next.delete(type);
            } else {
                next.add(type);
            }
            return next;
        });
    };

    // Grouping Logic
    const groupedDuplicates = useMemo(() => {
        // 1. Group by Type
        const byType: Record<string, Record<string, MediaFile[]>> = {};

        duplicates.forEach(file => {
            const type = file.type || 'unknown';
            if (!byType[type]) byType[type] = {};

            if (!byType[type][file.hash]) byType[type][file.hash] = [];
            byType[type][file.hash].push(file);
        });

        // 2. Convert to array for rendering and sorting
        const typeGroups = Object.entries(byType).map(([type, hashGroups]) => {
            let sets = Object.values(hashGroups);

            // Filter out single items (orphans after deletion)
            sets = sets.filter(set => set.length > 1);

            if (sets.length === 0) return null;

            // Sort logic
            if (sortByName) {
                sets.sort((a, b) => a[0].filename.localeCompare(b[0].filename));
            }

            return {
                type,
                count: sets.length, // number of duplicate sets
                sets
            };
        }).filter(g => g !== null);

        return typeGroups;
    }, [duplicates, sortByName]);

    if (loading) return <div className="p-8 text-gray-500 text-sm">Scanning for duplicates...</div>;

    if (duplicates.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                <p>No duplicates found.</p>
                <p className="text-xs mt-1">Great job keeping your library clean!</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 relative max-w-6xl mx-auto">
            {/* Header / Controls */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-200 uppercase tracking-widest">Duplicate Recap</h2>

                <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-400 cursor-pointer select-none flex items-center gap-2 hover:text-white transition-colors">
                        <input
                            type="checkbox"
                            checked={sortByName}
                            onChange={(e) => setSortByName(e.target.checked)}
                            className="rounded border-gray-700 bg-gray-800 text-blue-500 focus:ring-0 w-3 h-3"
                        />
                        Sort by Name
                    </label>
                </div>
            </div>

            {/* Hover Preview Box (Images Only) */}
            {hoveredFile && hoveredFile.type === 'image' && (
                <div
                    className="fixed pointer-events-none z-50 bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-1 flex flex-col items-center"
                    style={{
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '300px',
                        maxHeight: '300px'
                    }}
                >
                    <img
                        src={`media://file/${btoa(hoveredFile.filepath)}`}
                        alt="Preview"
                        className="max-w-full max-h-[250px] object-contain rounded-sm"
                    />
                    <div className="mt-1 text-[10px] text-center text-gray-300 break-all px-1">
                        {hoveredFile.filename}
                    </div>
                </div>
            )}

            {/* Type Groups */}
            <div className="grid grid-cols-1 gap-6">
                {groupedDuplicates.map((group) => {
                    const isExpanded = expandedTypes.has(group!.type);
                    return (
                        <div key={group!.type} className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
                            {/* Type Header */}
                            <div
                                onClick={() => toggleType(group!.type)}
                                className="bg-gray-800/80 px-4 py-2 border-b border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-800 transition-colors select-none"
                            >
                                <h3 className="text-sm font-semibold text-blue-100 uppercase tracking-wider flex items-center gap-3">
                                    <span className="w-5 h-5 flex items-center justify-center bg-gray-700/50 rounded text-xs text-blue-400">
                                        {isExpanded ? '−' : '+'}
                                    </span>
                                    {group!.type}
                                    <span className="text-gray-500 text-xs normal-case">({group!.count} sets)</span>
                                </h3>
                            </div>

                            {/* Duplicate Sets List */}
                            {isExpanded && (
                                <div className="p-4 space-y-4">
                                    {group!.sets.map((set, idx) => (
                                        <div key={idx} className="bg-black/20 rounded border border-gray-800 p-2 hover:border-gray-700 transition-colors">
                                            {/* Set Header */}
                                            <div className="text-[10px] text-gray-600 mb-1 flex justify-between px-1">
                                                <span className="font-mono">Set #{idx + 1} <span className="text-gray-700 mx-2">|</span> {set[0].hash.substring(0, 12)}...</span>
                                                <span>{(set[0].size / 1024 / 1024).toFixed(2)} MB</span>
                                            </div>

                                            {/* Files in Set */}
                                            <div className="space-y-1">
                                                {set.map(file => (
                                                    <div
                                                        key={file.id}
                                                        className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-white/5 group transition-colors"
                                                        onMouseEnter={() => setHoveredFile(file)}
                                                        onMouseLeave={() => setHoveredFile(null)}
                                                    >
                                                        <div className="flex-1 min-w-0 mr-4 flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                {file.type === 'project' && (
                                                                    <span
                                                                        title={(file as any).metadata?.missing_files?.length > 0
                                                                            ? `Missing ${(file as any).metadata.missing_files.length} files`
                                                                            : 'Project Integrity Check Passed: No missing files'}
                                                                        className="cursor-help"
                                                                    >
                                                                        {(file as any).metadata?.missing_files?.length > 0 ? '❌' : '✅'}
                                                                    </span>
                                                                )}
                                                                <span className={`font-medium truncate ${file.filepath.includes('Copy') || file.filename.match(/\(\d+\)/) ? 'text-yellow-100' : 'text-gray-300'}`}>
                                                                    {file.filename}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-gray-600 truncate">{file.filepath}</span>
                                                        </div>

                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(file);
                                                            }}
                                                            className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                                            title="Delete this copy"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}

                {groupedDuplicates.length === 0 && duplicates.length > 0 && (
                    <div className="text-center text-gray-500 py-8 text-sm">
                        Orphaned records found (files deleted externaly?). Rescan recommended.
                    </div>
                )}
            </div>
        </div>
    );
}
