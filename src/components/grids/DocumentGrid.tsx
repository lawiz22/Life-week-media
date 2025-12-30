import { MediaFile } from '../MediaGrid';

interface DocumentGridProps {
    files: MediaFile[];
    onSelect?: (file: MediaFile) => void;
    viewMode: 'large' | 'medium' | 'small' | 'list';
}

export function DocumentGrid({ files, onSelect, viewMode }: DocumentGridProps) {

    const getGridClass = () => {
        if (viewMode === 'list') return 'grid-cols-1';
        switch (viewMode) {
            case 'large': return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
            case 'small': return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
            default: return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5'; // medium
        }
    };

    return (
        <div className={`grid ${getGridClass()} gap-4`}>
            {files.map(media => {
                // Determine icon based on extension
                const ext = media.filepath.toLowerCase().split('.').pop();

                const getIconColor = () => {
                    switch (ext) {
                        case 'pdf': return 'text-red-500';
                        case 'doc':
                        case 'docx': return 'text-blue-500';
                        case 'xls':
                        case 'xlsx': return 'text-green-500';
                        case 'ppt':
                        case 'pptx': return 'text-orange-500';
                        case 'txt': return 'text-gray-400';
                        default: return 'text-gray-500';
                    }
                };

                const iconColor = getIconColor();

                if (viewMode === 'list') {
                    return (
                        <div
                            key={media.id}
                            onClick={() => onSelect && onSelect(media)}
                            className="p-2 flex items-center gap-4 hover:bg-white/5 rounded-lg cursor-pointer group transition-colors bg-gray-900 border border-gray-800"
                        >
                            <div className={`w-10 h-10 rounded flex items-center justify-center bg-gray-800 ${iconColor}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-200 truncate group-hover:text-white">
                                    {media.filename}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    <span className="uppercase">{ext}</span>
                                    <span>•</span>
                                    <span>{media.createdAt ? new Date(media.createdAt).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                            {/* Delete Button (List View) */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('Remove from Library ONLY? File will remain on disk.')) {
                                        (window as any).ipcRenderer.invoke('delete-file', { id: media.id, filepath: media.filepath, onlyDb: true });
                                        window.location.reload();
                                    }
                                }}
                                className="p-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove from Library"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </div>
                    );
                }

                return (
                    <div
                        key={media.id}
                        onClick={() => onSelect && onSelect(media)}
                        className="group relative aspect-square bg-gray-900 rounded-xl overflow-hidden cursor-pointer border border-gray-800 hover:border-gray-600 transition-all hover:shadow-xl"
                    >
                        {/* Main Icon Area */}
                        <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 ${iconColor} bg-gradient-to-br from-gray-800 to-gray-900`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-1/2 h-1/2 opacity-80 group-hover:scale-110 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="mt-4 font-mono text-xs uppercase opacity-50 font-bold tracking-wider">{ext}</div>
                        </div>

                        {/* Overlay Info */}
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
                            <div className="text-white text-sm font-medium truncate">{media.filename}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{media.createdAt ? new Date(media.createdAt).toLocaleDateString() : ''}</div>
                        </div>

                        {/* Delete Button (Grid View) */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm('Remove from Library ONLY? File will remain on disk.')) {
                                    (window as any).ipcRenderer.invoke('delete-file', { id: media.id, filepath: media.filepath, onlyDb: true });
                                    window.location.reload();
                                }
                            }}
                            className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 backdrop-blur-sm z-10"
                            title="Remove from Library (Keep file)"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
