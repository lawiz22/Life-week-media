import { useState, useEffect } from 'react';
import { Settings } from './Settings';

type Tab = 'life-weeks' | 'pictures' | 'video' | 'music' | 'projects' | 'documents' | 'duplicates' | 'settings';
interface ScanResult {
    added: number;
    skipped: number;
    errors: number;
}
interface LayoutProps {
    children: React.ReactNode;
    activeTab: Tab;
    onTabChange: (tab: Tab) => void;
    onScanComplete?: () => void;
}

export function Layout({ children, activeTab, onTabChange, onScanComplete }: LayoutProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState<{ status: string; file?: string; description?: string } | null>(null);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [includeSubfolders, setIncludeSubfolders] = useState(false);

    const tabs: { id: Tab; label: string }[] = [
        { id: 'life-weeks', label: 'Life in Weeks' },
        { id: 'pictures', label: 'Pictures' },
        { id: 'video', label: 'Video' },
        { id: 'music', label: 'Music' },
        { id: 'projects', label: 'Projects' },
        { id: 'documents', label: 'Documents' },
        { id: 'duplicates', label: 'Duplicates' },
        { id: 'settings', label: 'Settings' },
    ];

    useEffect(() => {
        const handleProgress = (_: any, progress: any) => {
            setScanProgress(progress);
        };

        if (window.ipcRenderer) {
            window.ipcRenderer.on('scan-progress', handleProgress);
        }

        return () => {
            if (window.ipcRenderer) {
                window.ipcRenderer.removeAllListeners('scan-progress');
            }
        };
    }, []);

    const handleImport = async () => {
        if (isScanning) return;

        try {
            const path = await window.ipcRenderer?.invoke('select-directory');
            if (path) {
                setIsScanning(true);
                setScanResult(null);
                setScanProgress({ status: 'scanning', description: 'Starting scan...' });

                const result = await window.ipcRenderer?.invoke('start-scan', path, { includeSubfolders });

                setScanResult(result);
                // Trigger refresh immediately upon completion
                if (onScanComplete) onScanComplete();
            } else {
                setIsScanning(false);
            }
        } catch (e) {
            console.error(e);
            alert('Scan failed: ' + (e instanceof Error ? e.message : String(e)));
            setIsScanning(false);
        }
    };

    const handleReset = async () => {
        if (confirm("ARE YOU SURE?\nThis will erase all your library data. The files on disk are safe.")) {
            try {
                await window.ipcRenderer?.invoke('reset-library');
                window.location.reload();
            } catch (e) {
                alert('Reset failed');
                console.error(e);
            }
        }
    };

    return (
        <div className="flex h-screen bg-gray-950 text-white overflow-hidden font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-6 border-b border-gray-800">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                        LifeWeeks
                    </h1>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`w-full text-left px-4 py-2 rounded-md transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>

                <div className="mt-auto px-4 py-6 border-t border-gray-800 space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <input
                            type="checkbox"
                            id="include-subfolders"
                            checked={includeSubfolders}
                            onChange={(e) => setIncludeSubfolders(e.target.checked)}
                            disabled={isScanning}
                            className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500/50"
                        />
                        <label htmlFor="include-subfolders" className={`text-sm select-none ${isScanning ? 'text-gray-600' : 'text-gray-400'}`}>
                            Include Subfolders
                        </label>
                    </div>

                    <button
                        onClick={handleImport}
                        disabled={isScanning}
                        className={`w-full px-4 py-2 rounded-md transition-colors flex items-center justify-center gap-2 font-medium shadow-lg 
                            ${isScanning
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed shadow-none'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'
                            }`}
                    >
                        {isScanning ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
                                <span>Scanning...</span>
                            </>
                        ) : (
                            <>
                                <span>+</span> Import Media
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={isScanning}
                        className={`w-full px-4 py-2 border rounded-md transition-colors text-sm
                             ${isScanning
                                ? 'bg-transparent border-gray-800 text-gray-700 cursor-not-allowed'
                                : 'bg-red-950/30 hover:bg-red-900/50 text-red-400 border-red-900/30'
                            }`}
                    >
                        Reset Library
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-gray-950 relative">
                {activeTab === 'settings' ? (
                    <Settings />
                ) : (
                    children
                )}

                {/* Scanning Modal */}
                {(isScanning || scanResult) && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200">
                        <div className="w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl p-6 transform transition-all scale-100">
                            {!scanResult ? (
                                // Scanning State
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                                            <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                                            Importing Media...
                                        </h3>
                                        <span className="text-xs text-blue-400 font-mono px-2 py-1 bg-blue-400/10 rounded">
                                            {scanProgress?.status === 'scanning' ? 'Scanning' :
                                                scanProgress?.status === 'processing' ? 'Processing' :
                                                    scanProgress?.status === 'generating_thumbnail' ? 'Thumbnailing' : 'Working'}
                                        </span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-sm text-gray-300 font-medium truncate">
                                            {scanProgress?.description || 'Reading files...'}
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono truncate bg-gray-950 p-2 rounded border border-gray-800">
                                            {scanProgress?.file || 'Initializing...'}
                                        </div>
                                    </div>

                                    <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mt-2">
                                        <div className="h-full bg-blue-500 w-full animate-progress-indeterminate"></div>
                                    </div>

                                    {/* Stop Button */}
                                    <button
                                        onClick={async () => {
                                            try {
                                                await window.ipcRenderer?.invoke('cancel-scan');
                                                setScanProgress({ status: 'processing', description: 'Stopping scan...' });
                                            } catch (e) {
                                                console.error('Failed to stop scan', e);
                                            }
                                        }}
                                        className="mt-2 w-full py-2 bg-red-950/50 hover:bg-red-900/50 text-red-400 border border-red-900/30 rounded-md text-sm font-medium transition-colors"
                                    >
                                        Stop Import
                                    </button>
                                </div>
                            ) : (
                                // Results State
                                <div className="flex flex-col gap-5">
                                    <div className="flex items-center gap-3 text-green-400">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <h3 className="text-xl font-bold text-white">Scan Complete</h3>
                                    </div>

                                    <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">New Files Added</span>
                                            <span className="text-green-400 font-mono font-bold">{scanResult.added}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">Skipped (Duplicates)</span>
                                            <span className="text-yellow-400 font-mono font-bold">{scanResult.skipped}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-400">Errors</span>
                                            <span className={`font-mono font-bold ${scanResult.errors > 0 ? 'text-red-400' : 'text-gray-600'}`}>
                                                {scanResult.errors}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            setIsScanning(false);
                                            setScanResult(null);
                                            setScanProgress(null);
                                        }}
                                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors shadow-lg shadow-blue-900/20"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
