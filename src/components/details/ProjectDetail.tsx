import { useEffect, useState } from 'react';
import { MediaFile } from '../MediaGrid';
import abletonLogo from '../../assets/ableton_logo.jpg';

interface ProjectDetailProps {
    media: MediaFile;
    onBack: () => void;
    onNext?: () => void;
    onPrev?: () => void;
}

export function ProjectDetail({ media, onBack, onNext, onPrev }: ProjectDetailProps) {
    const [metadata, setMetadata] = useState<any>(null);

    useEffect(() => {
        try {
            if (typeof media.metadata === 'string') {
                setMetadata(JSON.parse(media.metadata));
            } else {
                setMetadata(media.metadata || {});
            }
        } catch (e) {
            console.error('Failed to parse metadata', e);
            setMetadata({});
        }
    }, [media]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' && onNext) onNext();
            if (e.key === 'ArrowLeft' && onPrev) onPrev();
            if (e.key === 'Escape') onBack();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onNext, onPrev, onBack]);

    const integrity = metadata?.integrity || {};
    const status = integrity.status || 'UNKNOWN';
    const isOk = status === 'OK';
    const missingFiles = integrity.missing || [];
    const foundFiles = integrity.found || [];

    return (
        <div className="flex flex-col h-full bg-gray-950 text-white relative">
            {/* Top Bar */}
            <div className="p-4 border-b border-gray-800 flex items-center gap-4 bg-gray-900 z-20">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors text-sm font-medium border border-gray-700"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Grid
                </button>
                <div className="flex-1 truncate">
                    <h2 className="text-lg font-semibold truncate">{media.filename}</h2>
                    <p className="text-xs text-gray-400 font-mono truncate">{media.filepath}</p>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
                {/* Nav Arrows */}
                {onPrev && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPrev(); }}
                        className="fixed left-4 top-1/2 -translate-y-1/2 p-4 bg-gray-800/50 hover:bg-gray-700 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                {onNext && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onNext(); }}
                        className="fixed right-4 top-1/2 -translate-y-1/2 p-4 bg-gray-800/50 hover:bg-gray-700 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {/* Main Content Card */}
                <div className="w-full max-w-4xl bg-gray-900/50 border border-gray-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
                    {/* Header */}
                    <div className="p-8 border-b border-gray-800 flex items-start gap-6 bg-gradient-to-r from-gray-900 to-gray-800">
                        <div className="w-24 h-24 bg-gray-950 rounded-xl overflow-hidden shadow-lg border border-gray-700 shrink-0">
                            <img src={abletonLogo} alt="Ableton Live" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold text-white">{media.filename.replace('.als', '')}</h1>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isOk ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-500'}`}>
                                    {status}
                                </span>
                            </div>
                            <p className="text-gray-400 font-mono text-sm mb-4">{media.filepath}</p>
                            <div className="flex gap-4 text-sm text-gray-500">
                                <div>
                                    <span className="block text-white font-bold text-lg">{missingFiles.length}</span>
                                    <span>Missing Files</span>
                                </div>
                                <div>
                                    <span className="block text-white font-bold text-lg">{foundFiles.length}</span>
                                    <span>Found Files</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => window.ipcRenderer?.invoke('open-external', media.filepath)}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 font-medium shadow-lg shadow-blue-900/20"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open Project
                        </button>
                    </div>

                    {/* Lists */}
                    <div className="p-0">
                        {/* Missing Files */}
                        {missingFiles.length > 0 && (
                            <div className="p-6 border-b border-gray-800 bg-red-900/5">
                                <h3 className="text-red-400 font-bold mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    Missing Audio Files ({missingFiles.length})
                                </h3>
                                <div className="bg-black/30 rounded-lg border border-red-900/30 overflow-hidden">
                                    {missingFiles.map((file: string, idx: number) => (
                                        <div key={idx} className="p-3 border-b border-red-900/10 last:border-0 text-sm font-mono text-red-200/80 hover:bg-red-500/10 transition-colors">
                                            {file}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Found Files */}
                        {foundFiles.length > 0 && (
                            <div className="p-6">
                                <h3 className="text-gray-300 font-bold mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Linked Audio Files ({foundFiles.length})
                                </h3>
                                <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden">
                                    {foundFiles.map((file: string, idx: number) => (
                                        <div key={idx} className="p-3 border-b border-gray-800 last:border-0 text-sm font-mono text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex items-center gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                            {file}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
