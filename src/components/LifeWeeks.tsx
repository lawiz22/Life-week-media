import { useEffect, useState } from 'react';

interface LifeStage {
    name: string;
    color: string;
    startAge: number;
    endAge: number;
}

export function LifeWeeks() {
    const [dob, setDob] = useState<string | null>(null);
    const [stages, setStages] = useState<LifeStage[]>([]);
    const [loading, setLoading] = useState(true);

    const [imageCounts, setImageCounts] = useState<Record<number, number>>({});

    const WEEKS_IN_YEAR = 52;
    const TOTAL_YEARS = 90;
    const TOTAL_WEEKS = TOTAL_YEARS * WEEKS_IN_YEAR;

    useEffect(() => {
        const load = async () => {
            const settingsPromise = window.ipcRenderer?.invoke('get-settings');
            const statsPromise = window.ipcRenderer?.invoke('get-media-stats', 'image');

            const [settings, stats] = await Promise.all([settingsPromise, statsPromise]);

            let dobVal = null;
            if (settings) {
                setDob(settings.dob);
                setStages(settings.stages);
                dobVal = settings.dob;
            }

            if (stats && dobVal) {
                // Calculate week counts
                const birthTime = new Date(dobVal).getTime();
                const counts: Record<number, number> = {};

                stats.forEach((item: { createdAt: number }) => {
                    if (!item.createdAt) return;
                    const diffTime = item.createdAt - birthTime;
                    if (diffTime < 0) return; // Created before birth?!
                    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
                    if (diffWeeks >= 0 && diffWeeks < TOTAL_WEEKS) {
                        counts[diffWeeks] = (counts[diffWeeks] || 0) + 1;
                    }
                });
                setImageCounts(counts);
            }

            setLoading(false);
        };
        load();
    }, []);

    // Calculate age for a given week index
    const getStageForWeek = (weekIndex: number) => {
        const yearIndex = Math.floor(weekIndex / WEEKS_IN_YEAR);
        // Find stage that covers this year
        return stages.find(s => yearIndex >= s.startAge && yearIndex < s.endAge);
    };

    if (loading) return <div className="p-8 text-gray-500">Loading visualization...</div>;

    // Calculate current week
    let currentWeekIndex = -1;
    if (dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - birthDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        currentWeekIndex = Math.floor(diffDays / 7);
    }

    const matchesBirthday = (weekIndex: number) => {
        return weekIndex % 52 === 0;
    }

    return (
        <div className="p-8 flex justify-center">
            <div className="inline-block">
                <h2 className="text-2xl font-bold mb-6 text-gray-200 text-center">Your Life in Weeks</h2>

                <div className="grid grid-cols-[auto_1fr] gap-4">
                    {/* Y-Axis Labels (Ages) */}
                    <div className="flex flex-col justify-between py-1 text-xs text-gray-500 text-right pr-2" style={{ height: 'calc(100% - 20px)' }}>
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(age => (
                            <div key={age} className="h-4">{age}</div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-[2px] max-w-[900px]">
                        {Array.from({ length: TOTAL_WEEKS }).map((_, i) => {
                            const stage = getStageForWeek(i);
                            const isPast = i <= currentWeekIndex;
                            const count = imageCounts[i] || 0;

                            return (
                                <div
                                    key={i}
                                    className={`w-3 h-3 border rounded-[1px] transition-all duration-300 ${count > 0 ? 'hover:scale-150 z-10' : ''}`}
                                    style={{
                                        backgroundColor: stage ? stage.color : '#374151',
                                        opacity: isPast ? 1 : 0.3, // Dim future weeks
                                        borderColor: count > 0 ? '#fff' : (matchesBirthday(i) ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
                                        borderWidth: count > 0 ? '1.5px' : '1px'
                                    }}
                                    title={`Week ${i} (Age ${Math.floor(i / 52)}) - ${stage?.name || 'Unknown'}\n${count > 0 ? `📸 ${count} Images` : ''}`}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Legend */}
                <div className="mt-8 flex flex-wrap gap-4 justify-center">
                    {stages.map((stage, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: stage.color }}></div>
                            <span className="text-sm text-gray-300">{stage.name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                        <div className="w-3 h-3 border-2 border-white bg-gray-600"></div>
                        <span className="text-sm text-gray-300">Has Photos</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
