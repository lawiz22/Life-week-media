import { MediaFile } from './MediaGrid';

interface ProjectDetailProps {
    media: MediaFile;
    onBack: () => void;
    onNext?: () => void;
    onPrev?: () => void;
}

export function ProjectDetail({ media, onBack, onNext, onPrev }: ProjectDetailProps) {

    // Parse metadata safely
    let metadata: any = {};
    try {
        metadata = typeof media.metadata === 'string' ? JSON.parse(media.metadata) : media.metadata || {};
    } catch (e) {
        console.warn('Failed to parse metadata', e);
    }

    const integrity = metadata.integrity || { status: 'UNKNOWN', missing: [], total_samples: 0 };
    const missingFiles = integrity.missing || [];
    const isMissing = integrity.status === 'MISSING_FILES';

    // Stats
    const tempo = integrity.tempo ? Math.round(integrity.tempo * 100) / 100 : '-';
    const timeSig = integrity.timeSignature || '-';
    const totalFiles = integrity.total_samples || 0;

    // Dates & Version
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const created = formatDate(integrity.created);
    const modified = formatDate(integrity.modified);
    const version = integrity.creator ? `${integrity.creator}` : '-';
    const versionDetail = integrity.majorVersion ? `(v${integrity.majorVersion}.${integrity.minorVersion})` : '';

    return (
        <div className="flex flex-col h-full bg-gray-900 text-white">
            {/* Header / Nav */}
            <div className="flex items-center p-4 border-b border-gray-800 bg-gray-950/50">
                <button
                    onClick={onBack}
                    className="p-2 hover:bg-gray-800 rounded-full mr-4 transition-colors"
                    title="Back to Grid"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <h2 className="text-lg font-semibold truncate flex-1">{media.filename}</h2>

                <div className="flex space-x-2">
                    <button onClick={onPrev} disabled={!onPrev} className="p-2 hover:bg-gray-800 rounded-full disabled:opacity-30">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button onClick={onNext} disabled={!onNext} className="p-2 hover:bg-gray-800 rounded-full disabled:opacity-30">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Top Identity Section */}
                    <div className="flex items-start space-x-6">
                        {/* Big Logo */}
                        <div className="w-24 h-24 flex-shrink-0 bg-gray-950 rounded-xl overflow-hidden shadow-xl border border-gray-800">
                            <img src="/src/assets/ableton_logo.jpg" alt="Ableton Live" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1">
                            <h1 className="text-3xl font-bold mb-2">{media.filename}</h1>
                            <p className="text-gray-400 text-sm font-mono break-all">{media.filepath}</p>

                            {/* Integrity Badge Banner */}
                            <div className={`mt-6 p-4 rounded-lg border ${isMissing
                                ? 'bg-red-900/20 border-red-500/50 text-red-200'
                                : 'bg-green-900/20 border-green-500/50 text-green-200'
                                } flex items-center`}>
                                <div className={`p-2 rounded-full mr-4 ${isMissing ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                                    {isMissing ? (
                                        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">{isMissing ? 'Missing Files Detected' : 'Project Integrity Verified'}</h3>
                                    <p className="text-sm opacity-80">
                                        {isMissing
                                            ? `This project references ${missingFiles.length} file(s) that could not be found.`
                                            : 'All referenced audio samples were found successfully.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Tempo</div>
                            <div className="text-lg font-mono">{tempo} <span className="text-sm text-gray-500">BPM</span></div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Time Signature</div>
                            <div className="text-lg font-mono">{timeSig}</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Total Samples Used</div>
                            <div className="text-lg font-mono">{totalFiles}</div>
                        </div>

                        {/* Row 2: Metadata */}
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Created</div>
                            <div className="text-base font-mono">{created}</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Modified</div>
                            <div className="text-base font-mono">{modified}</div>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <div className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Ableton Version</div>
                            <div className="text-base font-mono truncate" title={version + ' ' + versionDetail}>
                                {version} <span className="text-xs text-gray-500">{versionDetail}</span>
                            </div>
                        </div>
                    </div>

                    {/* Missing Files List (Top Priority) */}
                    {isMissing && missingFiles.length > 0 && (
                        <div className="bg-gray-800 rounded-lg border border-red-900/50 overflow-hidden flex flex-col">
                            <div className="bg-red-900/20 px-4 py-2 border-b border-red-900/30 flex justify-between items-center flex-shrink-0">
                                <h3 className="font-semibold text-red-300 flex items-center gap-2 text-sm">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Missing Files
                                </h3>
                                <span className="text-[10px] bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full">{missingFiles.length} files</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto p-0 resize-y min-h-[100px]">
                                <ul className="divide-y divide-gray-700/50">
                                    {missingFiles.map((file: string, idx: number) => (
                                        <li key={idx} className="px-4 py-2 text-xs font-mono text-red-300/80 hover:bg-gray-700/50 flex items-start gap-2 break-all">
                                            <span className="opacity-50 text-[10px] mt-0.5 flex-shrink-0">❌</span>
                                            {file}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Verified Audio Files (Green List) */}
                    {integrity.valid_samples && integrity.valid_samples.length > 0 && (
                        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col">
                            <div className="bg-green-900/10 px-4 py-2 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                                <h3 className="font-semibold text-green-400 flex items-center gap-2 text-sm">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Found Audio Files
                                </h3>
                                <span className="text-[10px] bg-green-900/20 text-green-400 border border-green-900/30 px-2 py-0.5 rounded-full">{integrity.valid_samples.length} files</span>
                            </div>
                            <div className="max-h-96 overflow-y-auto p-0 resize-y min-h-[100px]">
                                <ul className="divide-y divide-gray-700">
                                    {integrity.valid_samples.map((file: string, idx: number) => (
                                        <li key={idx} className="px-4 py-1.5 text-xs font-mono text-green-300/80 hover:bg-gray-700/50 flex items-start gap-3 break-all">
                                            <svg className="w-3 h-3 flex-shrink-0 text-green-500/50 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                            <span className="break-all">{file}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
