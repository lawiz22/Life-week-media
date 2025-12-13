import { useState, useEffect } from 'react';
import { MediaFile } from '../MediaGrid';
import { utf8ToBase64 } from '../../utils/encoding';

interface VideoDetailProps {
    media: MediaFile;
    onBack: () => void;
    onNext?: () => void;
    onPrev?: () => void;
}

export function VideoDetail({ media, onBack, onNext, onPrev }: VideoDetailProps) {
    const [videoLoading, setVideoLoading] = useState(true);
    const [isAvailable, setIsAvailable] = useState<boolean>(true);
    const [showAllMeta, setShowAllMeta] = useState(false);

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

    // Parse metadata
    let metadata: any = {};
    try {
        metadata = typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata || {};
    } catch (e) {
        console.warn('Failed to parse metadata', e);
    }

    const allMeta = metadata ? Object.entries(metadata)
        .filter(([, val]) => typeof val !== 'object' || val === null)
        .sort(([a], [b]) => a.localeCompare(b)) : [];

    return (
        <div className='fixed inset-0 bg-black/95 z-50 flex'>
            {/* Main Content */}
            <div className='flex-1 flex flex-col'>
                {/* Header */}
                <div className='flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent'>
                    <button
                        onClick={onBack}
                        className='p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white'
                    >
                        <svg xmlns='http://www.w3.org/2000/svg' className='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10 19l-7-7m0 0l7-7m-7 7h18' />
                        </svg>
                    </button>
                    <h2 className='text-white text-lg font-medium truncate px-4'>{media.filename}</h2>
                    <div className='w-10'></div>
                </div>

                {/* Video Container */}
                <div className='flex-1 flex items-center justify-center p-8 relative'>
                    <div
                        className='absolute inset-0 opacity-20 blur-3xl scale-110'
                        style={{ backgroundImage: `url('media://thumbnail/${media.id}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    ></div>

                    <div className='relative z-10 max-w-full max-h-full flex items-center justify-center w-full h-full group'>
                        {/* Nav Arrows */}
                        {onPrev && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                                className='absolute left-4 top-1/2 -translate-y-1/2 p-4 bg-black/30 hover:bg-black/60 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50 opacity-0 group-hover:opacity-100'
                            >
                                <svg xmlns='http://www.w3.org/2000/svg' className='h-8 w-8' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                                </svg>
                            </button>
                        )}
                        {onNext && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onNext(); }}
                                className='absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-black/30 hover:bg-black/60 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50 opacity-0 group-hover:opacity-100'
                            >
                                <svg xmlns='http://www.w3.org/2000/svg' className='h-8 w-8' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                                </svg>
                            </button>
                        )}

                        {/* Video Player */}
                        {isAvailable ? (
                            <div className='relative max-w-full max-h-full flex items-center justify-center'>
                                <video
                                    controls
                                    autoPlay
                                    className='max-w-full max-h-full shadow-2xl rounded-lg bg-black'
                                    src={`media://file/${utf8ToBase64(media.filepath)}`}
                                    poster={`media://thumbnail/${media.id}`}
                                    onLoadStart={() => {
                                        const ext = media.filepath.toLowerCase().split('.').pop() || '';
                                        const legacyFormats = ['avi', 'mpg', 'mpeg', 'wmv', 'm2v', 'vob', 'flv', 'f4v', 'mov'];
                                        if (legacyFormats.includes(ext)) {
                                            setVideoLoading(true);
                                        }
                                    }}
                                    onLoadedData={() => setVideoLoading(false)}
                                    onPlaying={() => setVideoLoading(false)}
                                >
                                </video>

                                {/* Transcoding Overlay */}
                                {(() => {
                                    const ext = media.filepath.toLowerCase().split('.').pop() || '';
                                    const legacyFormats = ['avi', 'mpg', 'mpeg', 'wmv', 'm2v', 'vob', 'flv', 'f4v', 'mov'];
                                    const needsTranscoding = legacyFormats.includes(ext);

                                    if (needsTranscoding && videoLoading) {
                                        return (
                                            <div className='absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm'>
                                                <div className='bg-gray-900/90 border border-blue-500/50 rounded-lg p-6 shadow-2xl'>
                                                    <div className='flex items-center gap-4'>
                                                        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500'></div>
                                                        <div>
                                                            <h3 className='text-white font-semibold text-lg'>Preparing Video...</h3>
                                                            <p className='text-gray-300 text-sm'>Converting {ext.toUpperCase()} to compatible format</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        ) : (
                            <div className='text-center'>
                                <div className='bg-red-900/50 text-red-200 px-6 py-4 rounded-lg'>
                                    <span className='font-medium'>Source File Offline</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Metadata Sidebar */}
            <div className='w-96 bg-gray-900/95 backdrop-blur-xl border-l border-gray-800 overflow-y-auto p-6'>
                <h3 className='text-white font-semibold text-lg mb-4'>Video Information</h3>
                <div className='space-y-3 text-sm'>
                    {metadata.width && metadata.height && (
                        <div className='flex justify-between'>
                            <span className='text-gray-400'>Resolution</span>
                            <span className='text-white'>{metadata.width}  {metadata.height}</span>
                        </div>
                    )}
                    {metadata.duration && (
                        <div className='flex justify-between'>
                            <span className='text-gray-400'>Duration</span>
                            <span className='text-white'>{Math.floor(metadata.duration / 60)}:{(Math.floor(metadata.duration) % 60).toString().padStart(2, '0')}</span>
                        </div>
                    )}
                </div>

                {allMeta.length > 0 && (
                    <div className='mt-6'>
                        <button
                            onClick={() => setShowAllMeta(!showAllMeta)}
                            className='text-blue-400 hover:text-blue-300 text-sm'
                        >
                            {showAllMeta ? 'Hide' : 'Show'} All Metadata
                        </button>
                        {showAllMeta && (
                            <div className='mt-3 space-y-2 text-xs'>
                                {allMeta.map(([key, val]) => (
                                    <div key={key} className='flex justify-between gap-2'>
                                        <span className='text-gray-500'>{key}</span>
                                        <span className='text-gray-300'>{String(val)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
