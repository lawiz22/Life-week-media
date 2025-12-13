import { useState, useEffect } from 'react';
import { MediaFile } from '../MediaGrid';
import { WaveformPlayer } from '../WaveformPlayer';
import { utf8ToBase64 } from '../../utils/encoding';

interface AudioDetailProps {
    media: MediaFile;
    onBack: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onSongEnd?: () => void;
}

export function AudioDetail({ media, onBack, onNext, onPrev, onSongEnd }: AudioDetailProps) {
    const [isAvailable, setIsAvailable] = useState<boolean>(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ title: '', artist: '', album: '', year: '' });
    const [selectedCover, setSelectedCover] = useState<File | null>(null);

    // Parse metadata
    let metadata: any = {};
    try {
        metadata = typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata || {};
    } catch (e) {
        console.warn('Failed to parse metadata', e);
    }

    // Initialize edit form
    useEffect(() => {
        if (isEditing) {
            setEditForm({
                title: metadata.title || '',
                artist: metadata.artist || '',
                album: metadata.album || '',
                year: metadata.year || ''
            });
        }
    }, [isEditing, metadata.title, metadata.artist, metadata.album, metadata.year]);

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

    const handleSaveMetadata = async () => {
        try {
            // Upload cover if selected
            if (selectedCover) {
                const arrayBuffer = await selectedCover.arrayBuffer();
                const buffer = new Uint8Array(arrayBuffer);
                await window.ipcRenderer?.invoke('upload-album-cover', media.id, Array.from(buffer));
            }

            await window.ipcRenderer?.invoke('update-audio-metadata', media.id, editForm);

            setIsEditing(false);
            setSelectedCover(null);

            // Reload to show changes (cache clearing strategy)
            onBack();
            setTimeout(() => window.location.reload(), 100);
        } catch (err) {
            console.error('Failed to save metadata:', err);
            alert('Failed to save metadata: ' + err);
        }
    };

    const formatDuration = (sec: number) => {
        if (!sec) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

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
                    <h2 className="text-lg font-semibold truncate">{metadata.title || media.filename}</h2>
                    <p className="text-xs text-gray-400 font-mono truncate">{media.filepath}</p>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10">
                {/* Main Player Area */}
                <div className="flex-1 bg-black flex items-center justify-center p-8 relative overflow-hidden">
                    {/* Background Blur */}
                    {media.category === 'music' && (
                        <div
                            className="absolute inset-0 opacity-20 blur-3xl scale-150"
                            style={{ backgroundImage: `url('media://thumbnail/${media.id}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                        ></div>
                    )}

                    <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
                        {/* Nav Arrows */}
                        {onPrev && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onPrev(); }}
                                className="absolute left-0 top-1/2 -translate-y-1/2 p-4 bg-black/30 hover:bg-black/60 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        {onNext && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onNext(); }}
                                className="absolute right-0 top-1/2 -translate-y-1/2 p-4 bg-black/30 hover:bg-black/60 rounded-full text-white/50 hover:text-white transition-all backdrop-blur-sm z-50"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}

                        {isAvailable ? (
                            <div className="w-full space-y-8 animate-in slide-in-from-bottom duration-500">
                                {/* Album Art */}
                                {media.category === 'music' && (
                                    <div className="flex justify-center">
                                        <img
                                            src={`media://thumbnail/${media.id}`}
                                            alt="Album cover"
                                            className="w-64 h-64 object-cover rounded-lg shadow-2xl border-2 border-gray-700 hover:scale-105 transition-transform duration-500"
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    </div>
                                )}

                                {/* Generic Audio Icon if not music or no cover */}
                                {media.category !== 'music' && (
                                    <div className="flex justify-center mb-8">
                                        <div className="w-32 h-32 bg-gray-800 rounded-full flex items-center justify-center border-4 border-gray-700 shadow-xl">
                                            <span className="text-6xl opacity-50">🎵</span>
                                        </div>
                                    </div>
                                )}

                                {/* Waveform Player */}
                                <div className="bg-gray-900/80 p-6 rounded-2xl border border-gray-800 backdrop-blur-md shadow-2xl">
                                    <WaveformPlayer
                                        src={`media://file/${utf8ToBase64(media.filepath)}`}
                                        height={120}
                                        waveColor="#60a5fa"
                                        progressColor="#2563eb"
                                        onSongEnd={onSongEnd}
                                        autoPlay={!!onSongEnd} // Auto-play if part of playlist/queue logic
                                    />
                                    <div className="mt-2 flex justify-between text-xs text-gray-500 font-mono px-2">
                                        <div>{media.filename}</div>
                                        <div>{metadata.bitrate ? `${Math.round(metadata.bitrate / 1000)} kbps` : ''}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-red-900/50 text-red-200 px-6 py-4 rounded-lg flex items-center gap-3 border border-red-700/50 backdrop-blur-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <h3 className="font-bold">Source File Offline</h3>
                                    <p className="text-sm opacity-80">The file could not be found at the specified path.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-full md:w-96 bg-gray-900 border-l border-gray-800 overflow-y-auto shadow-xl flex flex-col z-20">
                    <div className="p-6 space-y-6 flex-1">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-gray-800 pb-2">
                            {isEditing ? 'Edit Metadata' : 'Track Details'}
                        </h3>

                        {!isEditing ? (
                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Title</label>
                                    <div className="text-xl font-bold text-white leading-tight mt-1">{metadata.title || media.filename}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase">Artist</label>
                                    <div className="text-lg text-blue-400 font-medium mt-1">{metadata.artist || 'Unknown Artist'}</div>
                                </div>
                                {metadata.album && (
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase">Album</label>
                                        <div className="text-gray-300 mt-1">{metadata.album}</div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    {metadata.year && (
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase">Year</label>
                                            <div className="text-gray-300 mt-1">{metadata.year}</div>
                                        </div>
                                    )}
                                    {metadata.genre && (
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase">Genre</label>
                                            <div className="text-gray-300 mt-1">{Array.isArray(metadata.genre) ? metadata.genre.join(', ') : metadata.genre}</div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase">Duration</label>
                                        <div className="text-gray-300 mt-1 font-mono">{formatDuration(metadata.duration)}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase">Format</label>
                                        <div className="text-gray-300 mt-1 font-mono">{media.filename.split('.').pop()?.toUpperCase()}</div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="w-full mt-4 bg-gray-800 hover:bg-black text-white px-4 py-3 rounded-lg transition-colors border border-gray-700 flex items-center justify-center gap-2 group"
                                >
                                    <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit Metadata
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase block mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                        className="w-full bg-black/50 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase block mb-1">Artist</label>
                                    <input
                                        type="text"
                                        value={editForm.artist}
                                        onChange={(e) => setEditForm({ ...editForm, artist: e.target.value })}
                                        className="w-full bg-black/50 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase block mb-1">Album</label>
                                    <input
                                        type="text"
                                        value={editForm.album}
                                        onChange={(e) => setEditForm({ ...editForm, album: e.target.value })}
                                        className="w-full bg-black/50 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase block mb-1">Year</label>
                                    <input
                                        type="text"
                                        value={editForm.year}
                                        onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                                        className="w-full bg-black/50 text-white px-3 py-2 rounded border border-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-800">
                                    <label className="text-xs text-gray-500 uppercase block mb-2">Update Cover Art</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setSelectedCover(e.target.files ? e.target.files[0] : null)}
                                        className="w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-900/30 file:text-blue-400 hover:file:bg-blue-900/50"
                                    />
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <button
                                        onClick={() => setIsEditing(false)}
                                        className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveMetadata}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors font-medium shadow-lg shadow-blue-900/20"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
