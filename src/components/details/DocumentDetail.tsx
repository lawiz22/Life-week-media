import { useState, useEffect } from 'react';
import { MediaFile } from '../MediaGrid';


interface DocumentDetailProps {
    media: MediaFile;
    onBack: () => void;
    onNext?: () => void;
    onPrev?: () => void;
}

export function DocumentDetail({ media, onBack, onNext, onPrev }: DocumentDetailProps) {
    const [textContent, setTextContent] = useState<string | null>(null);
    const [textLoading, setTextLoading] = useState(false);
    const [textTruncated, setTextTruncated] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean>(true);

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

    // Check file availability
    useEffect(() => {
        const checkAvailability = async () => {
            if (window.ipcRenderer) {
                const exists = await window.ipcRenderer.invoke('check-file-exists', media.filepath);
                setIsAvailable(exists);
            }
        };
        checkAvailability();
    }, [media.filepath]);

    // Load text file content for TXT documents
    useEffect(() => {
        if (media.type === 'document' && media.filepath.toLowerCase().endsWith('.txt') && isAvailable) {
            setTextLoading(true);
            window.ipcRenderer?.invoke('read-text-file', media.filepath)
                .then((result: { content: string; truncated: boolean; size: number }) => {
                    setTextContent(result.content);
                    setTextTruncated(result.truncated);
                })
                .catch((err: Error) => {
                    console.error('Failed to load text file:', err);
                    setTextContent('Error loading file: ' + err.message);
                })
                .finally(() => setTextLoading(false));
        }
    }, [media.filepath, media.type, isAvailable]);

    const ext = media.filepath.toLowerCase().split('.').pop();

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

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex items-center justify-center relative p-8">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5"
                    style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                ></div>

                {/* Nav Arrows */}
                {onPrev && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPrev(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-gray-800/50 hover:bg-gray-700 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                {onNext && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onNext(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-gray-800/50 hover:bg-gray-700 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}

                {!isAvailable ? (
                    <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-8 text-center max-w-md backdrop-blur-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-xl font-bold text-white mb-2">File Not Found</h3>
                        <p className="text-red-200">The file could not be found at the specified path.</p>
                        <code className="block mt-4 p-2 bg-black/30 rounded text-xs text-red-300 break-all">{media.filepath}</code>
                    </div>
                ) : (
                    <>
                        {/* PDF Viewer */}
                        {ext === 'pdf' && (
                            <div className="w-full max-w-2xl animate-in slide-in-from-bottom duration-500 fade-in">
                                <div className="bg-gray-900/80 border border-red-900/30 rounded-2xl p-12 backdrop-blur-md text-center shadow-2xl">
                                    <svg className="w-24 h-24 mx-auto mb-6 text-red-500 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <h3 className="text-3xl font-bold text-white mb-3">PDF Document</h3>
                                    <p className="text-gray-400 mb-8 text-lg">{media.filename}</p>
                                    <button
                                        onClick={() => window.ipcRenderer?.invoke('open-external', media.filepath)}
                                        className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all hover:scale-105 hover:shadow-lg flex items-center gap-3 mx-auto font-medium"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Open in Default PDF Viewer
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* TXT Viewer */}
                        {ext === 'txt' && (
                            <div className="w-full max-w-4xl h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-500 fade-in">
                                {textLoading ? (
                                    <div className="flex flex-col items-center justify-center flex-1">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                                        <p className="text-gray-400">Loading Text Content...</p>
                                    </div>
                                ) : (
                                    <div className="bg-gray-900/90 border border-gray-700 rounded-xl flex-1 backdrop-blur-sm shadow-2xl overflow-hidden flex flex-col">
                                        <div className="bg-gray-800/50 p-3 border-b border-gray-700 flex justify-between items-center">
                                            <span className="text-xs font-mono text-gray-400 uppercase">Plain Text View</span>
                                            {textTruncated && (
                                                <span className="text-xs bg-yellow-900/50 text-yellow-200 px-2 py-0.5 rounded border border-yellow-700/50">
                                                    Truncated (Large File)
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 overflow-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                            <pre className="text-gray-200 font-mono text-sm whitespace-pre-wrap break-words">
                                                {textContent || <span className="text-gray-500 italic">No content available.</span>}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* DOC/DOCX/Other Viewer */}
                        {['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '') && (
                            <div className="w-full max-w-2xl animate-in slide-in-from-bottom duration-500 fade-in">
                                <div className="bg-gray-900/80 border border-blue-900/30 rounded-2xl p-12 backdrop-blur-md text-center shadow-2xl">
                                    <svg className="w-24 h-24 mx-auto mb-6 text-blue-500 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <h3 className="text-3xl font-bold text-white mb-3">{ext?.toUpperCase()} Document</h3>
                                    <p className="text-gray-400 mb-8 text-lg">{media.filename}</p>
                                    <p className="text-gray-500 mb-8 max-w-md mx-auto">This file type is best viewed in its native application.</p>
                                    <button
                                        onClick={() => window.ipcRenderer?.invoke('open-external', media.filepath)}
                                        className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all hover:scale-105 hover:shadow-lg flex items-center gap-3 mx-auto font-medium"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Open in Default App
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Unknown Format Fallback */}
                        {!['pdf', 'txt', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext || '') && (
                            <div className="w-full max-w-2xl animate-in slide-in-from-bottom duration-500 fade-in">
                                <div className="bg-gray-900/80 border border-gray-700/30 rounded-2xl p-12 backdrop-blur-md text-center shadow-2xl">
                                    <svg className="w-24 h-24 mx-auto mb-6 text-gray-500 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    <h3 className="text-3xl font-bold text-white mb-3">File</h3>
                                    <p className="text-gray-400 mb-8 text-lg">{media.filename}</p>
                                    <button
                                        onClick={() => window.ipcRenderer?.invoke('open-external', media.filepath)}
                                        className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all hover:scale-105 hover:shadow-lg flex items-center gap-3 mx-auto font-medium"
                                    >
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        Open File
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
