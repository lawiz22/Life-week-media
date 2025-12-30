


interface MediaFile {
    id: number;
    filepath: string;
    filename: string;
    size: number;
    type: string;
    hash: string;
    metadata?: any;
    createdAt: number;
}

interface WeekDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    weekIndex: number;
    startDate: string;
    endDate: string;
    onNavigate: (file: any) => void;
    files: MediaFile[];
}

export function WeekDetailModal({ isOpen, onClose, weekIndex, startDate, endDate, onNavigate, files }: WeekDetailModalProps) {
    // files are passed from parent, no internal loading needed

    if (!isOpen) return null;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-800 bg-gray-900/95 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-wide uppercase">Week {weekIndex}</h2>
                        <p className="text-blue-400 text-sm mt-1">{startDate} - {endDate}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 text-2xl"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-900">
                    {files.length === 0 ? (
                        <div className="text-center text-gray-500 py-12">
                            <p>No media found for this week.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {files.map(file => (
                                <div
                                    key={file.id}
                                    className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-700 hover:border-blue-500 transition-all cursor-pointer shadow-sm hover:shadow-lg hover:scale-[1.02]"
                                    onClick={() => onNavigate(file)}
                                >
                                    {/* Thumbnail */}
                                    {file.type === 'image' ? (
                                        <img
                                            src={`media://file/${btoa(encodeURIComponent(file.filepath).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))}`}
                                            className="w-full h-full object-cover"
                                            alt={file.filename}
                                            loading="lazy"
                                        />
                                    ) : file.type === 'video' ? (
                                        <img
                                            src={`media://thumbnail/${file.id}`}
                                            className="w-full h-full object-cover"
                                            alt={file.filename}
                                            loading="lazy"
                                            onError={(e) => {
                                                // Fallback to generic icon if thumbnail missing
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                            }}
                                        />
                                    ) : file.type === 'project' ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-800 text-gray-400 group-hover:bg-gray-750">
                                            <span className="text-4xl mb-2">🎹</span>
                                            <span className="text-xs text-center truncate w-full px-2">{file.filename}</span>
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500">
                                            <span>📄</span>
                                        </div>
                                    )}

                                    {/* Type Badge */}
                                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
                                        {file.type}
                                    </div>

                                    {/* Overlay on Hover */}
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-2 opacity-0 group-hover:opacity-100">
                                        <div className="w-full text-white text-xs truncate drop-shadow-md">
                                            {file.filename}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 bg-gray-900/95 flex justify-between items-center text-xs text-gray-500">
                    <span>{files.length} items found</span>
                    <button className="text-gray-400 hover:text-white transition-colors" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}
