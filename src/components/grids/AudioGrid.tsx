import { MediaFile } from '../MediaGrid';

interface AudioGridProps {
    files: MediaFile[];
    onSelect?: (file: MediaFile) => void;
    viewMode: 'large' | 'medium' | 'small' | 'list';
}

export function AudioGrid({ files, onSelect, viewMode }: AudioGridProps) {

    const getGridClass = () => {
        switch (viewMode) {
            case 'large': return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
            case 'small': return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
            case 'list': return 'grid-cols-1'; // TODO: Implement proper list view
            default: return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5'; // medium
        }
    };

    return (
        <div className={`grid ${getGridClass()} gap-4`}>
            {files.map((file) => (
                <div
                    key={file.id}
                    onClick={() => onSelect && onSelect(file)}
                    className="group relative aspect-square bg-gray-800 rounded-md overflow-hidden border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                >
                    {/* Status Indicator */}
                    <div className="absolute top-2 left-2 z-10 bg-black/50 rounded-full p-1 backdrop-blur-sm">
                        {file.available ? (
                            <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>

                    {/* Audio Format Badge */}
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider backdrop-blur-sm border border-white/10 z-10">
                        {file.filename.split('.').pop()}
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
                        className="absolute top-2 right-12 p-1 bg-black/50 hover:bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 backdrop-blur-sm z-20"
                        title="Remove from Library (Keep file)"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>

                    {/* Thumbnail / Icon */}
                    {file.category === 'music' ? (
                        <img
                            src={`media://thumbnail/${file.id}`}
                            alt={file.filename}
                            className={`w-full h-full object-cover ${!file.available ? 'opacity-50 grayscale' : ''}`}
                            loading="lazy"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                // Show fallback icon if image fails
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                            <span className="text-5xl mb-2 opacity-50">🎵</span>
                        </div>
                    )}

                    {/* Fallback Icon (Hidden by default, shown on error) */}
                    <div className="hidden absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                        <span className="text-5xl mb-2 opacity-50">🎵</span>
                    </div>

                    {/* Metadata Overlay */}
                    {(() => {
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
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-8 flex flex-col justify-end text-left transition-all duration-300">
                                <div className="text-white font-bold text-sm leading-tight line-clamp-2 shadow-sm">{title}</div>
                                {artist && <div className="text-gray-300 text-xs mt-0.5 font-medium shadow-sm truncate">{artist}</div>}
                                {isMusic && album && <div className="text-gray-500 text-[10px] mt-0.5 truncate">{album}</div>}
                            </div>
                        );
                    })()}
                </div>
            ))}
        </div>
    );
}
