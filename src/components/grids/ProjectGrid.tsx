import { MediaFile } from '../MediaGrid';
import abletonLogo from '../../assets/ableton_logo.jpg';

interface ProjectGridProps {
    files: MediaFile[];
    onSelect?: (file: MediaFile) => void;
    viewMode: 'large' | 'medium' | 'small' | 'list';
    currentPage: number;
    onShowStats: () => void;
}

export function ProjectGrid({ files, onSelect, viewMode, currentPage, onShowStats }: ProjectGridProps) {

    const getGridClass = () => {
        if (viewMode === 'list') return 'grid-cols-1';
        switch (viewMode) {
            case 'large': return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
            case 'small': return 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8';
            default: return 'grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
        }
    };

    return (
        <div className={`grid ${getGridClass()} gap-4`}>
            {/* Project Stats Button (First item in grid on page 1) */}
            {currentPage === 1 && (
                <div
                    onClick={onShowStats}
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

            {files.map((file) => {
                let integrity: any = null;
                try {
                    const m = typeof file.metadata === 'string' ? JSON.parse(file.metadata) : file.metadata || {};
                    integrity = m?.integrity;
                } catch { }

                const status = integrity?.status || 'UNKNOWN';
                const isOk = status === 'OK';
                const isMissing = status === 'MISSING_FILES';

                if (viewMode === 'list') {
                    return (
                        <div
                            key={file.id}
                            onClick={() => onSelect && onSelect(file)}
                            className="p-2 flex items-center gap-4 hover:bg-white/5 rounded-lg cursor-pointer group transition-colors bg-gray-900 border border-gray-800"
                        >
                            <div className="w-10 h-10 rounded overflow-hidden shadow-sm opacity-90">
                                <img src={abletonLogo} alt="Ableton Live" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-200 truncate group-hover:text-white">
                                    {file.filename.replace('.als', '')}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                    {isOk && <span className="text-green-500">Integrity OK</span>}
                                    {isMissing && <span className="text-red-500">{integrity?.missing?.length || 0} Missing Files</span>}
                                    {!isOk && !isMissing && <span className="text-gray-500">{status}</span>}
                                    <span>•</span>
                                    <span>{file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ''}</span>
                                </div>
                            </div>
                        </div>
                    );
                }

                return (
                    <div
                        key={file.id}
                        onClick={() => onSelect && onSelect(file)}
                        className="group relative aspect-square bg-gray-800 rounded-md overflow-hidden border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
                    >
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-4 relative">
                            <div className="mb-3 w-10 h-10 rounded overflow-hidden shadow-sm opacity-90">
                                <img src={abletonLogo} alt="Ableton Live" className="w-full h-full object-cover" />
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
                                {isMissing && <span className="text-xs font-bold">!</span>}
                                {!isOk && !isMissing && <span className="text-xs font-bold">?</span>}
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
                                className="absolute top-2 left-2 p-1.5 bg-black/50 hover:bg-red-600/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 backdrop-blur-sm z-20"
                                title="Remove from Library (Keep file)"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>

                            {isMissing && integrity?.missing && (
                                <div className="absolute bottom-2 inset-x-2 bg-red-900/80 text-red-200 text-[10px] py-1 px-2 rounded text-center border border-red-800/50 backdrop-blur-sm">
                                    {integrity.missing.length} Missing Files
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
