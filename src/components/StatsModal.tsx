import { useMemo } from 'react';

interface StatsModalProps {
    timestamps: { createdAt: number | null }[];
    onClose: () => void;
}

export function StatsModal({ timestamps, onClose }: StatsModalProps) {
    const stats = useMemo(() => {
        const counts: Record<string, number> = {};
        timestamps.forEach(t => {
            if (!t.createdAt) return;
            const date = new Date(t.createdAt).toLocaleDateString();
            counts[date] = (counts[date] || 0) + 1;
        });

        return Object.entries(counts)
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()); // Newest first
    }, [timestamps]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-lg w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Media Statistics</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="overflow-auto flex-1 pr-2">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-gray-400 border-b border-gray-700">
                                <th className="pb-2">Date</th>
                                <th className="pb-2 text-right">Count</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            {stats.map(([date, count]) => (
                                <tr key={date} className="border-b border-gray-700/50 hover:bg-gray-700/50">
                                    <td className="py-2">{date}</td>
                                    <td className="py-2 text-right">{count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
