import { useEffect, useState } from 'react';

interface LifeStage {
    name: string;
    color: string;
    startAge: number;
    endAge: number;
}

interface LifeWeeksProps {
    refreshKey?: number;
}

export function LifeWeeks({ refreshKey }: LifeWeeksProps) {
    const [dob, setDob] = useState<string | null>(null);
    const [stages, setStages] = useState<LifeStage[]>([]);
    const [loading, setLoading] = useState(true);

    const [imageCounts, setImageCounts] = useState<Record<number, number>>({});
    const [videoCounts, setVideoCounts] = useState<Record<number, number>>({});
    const [projectCounts, setProjectCounts] = useState<Record<number, number>>({});

    const WEEKS_IN_YEAR = 52;
    const TOTAL_YEARS = 90;
    const TOTAL_WEEKS = TOTAL_YEARS * WEEKS_IN_YEAR;

    useEffect(() => {
        const load = async () => {
            const settingsPromise = window.ipcRenderer?.invoke('get-settings');
            // get-media-stats now returns metadata
            const statsPromise = window.ipcRenderer?.invoke('get-media-stats', 'image');
            const videoStatsPromise = window.ipcRenderer?.invoke('get-media-stats', 'video');
            const projectStatsPromise = window.ipcRenderer?.invoke('get-media-stats', 'project');

            const [settings, stats, videoStats, projectStats] = await Promise.all([settingsPromise, statsPromise, videoStatsPromise, projectStatsPromise]);

            let dobVal = null;
            if (settings) {
                setDob(settings.dob);
                setStages(settings.stages);
                dobVal = settings.dob;
            }

            if (dobVal) {
                const birthTime = new Date(dobVal).getTime();

                // Helper to process stats into counts
                const processStats = (items: any[]) => {
                    const counts: Record<number, number> = {};
                    if (!items) return counts;

                    items.forEach((item: { createdAt: number; metadata?: any }) => {
                        let itemDate = item.createdAt;

                        // Try to get date from metadata
                        if (item.metadata) {
                            const m = item.metadata;
                            // Projects often have 'created' or 'created_date' in metadata if scanned well
                            // But fallback to createdAt is usually fine
                            const dateStr = m.DateTimeOriginal || m.date_time_original || m.CreateDate || m.create_date || m.ModifyDate || m.modify_date || m.created;
                            if (dateStr) {
                                try {
                                    const d = new Date(dateStr);
                                    if (!isNaN(d.getTime())) {
                                        itemDate = d.getTime();
                                    }
                                } catch (e) { /* ignore parse error */ }
                            }
                        }

                        if (!itemDate) return;
                        const diffTime = itemDate - birthTime;

                        // Allow for slightly before birth (pre-natal?) or just ignore
                        const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
                        if (diffWeeks >= 0 && diffWeeks < TOTAL_WEEKS) {
                            counts[diffWeeks] = (counts[diffWeeks] || 0) + 1;
                        }
                    });
                    return counts;
                };

                const imgCounts = processStats(stats);
                const vidCounts = processStats(videoStats);
                const projCounts = processStats(projectStats);

                setImageCounts(imgCounts);
                setVideoCounts(vidCounts);
                setProjectCounts(projCounts);
            }

            setLoading(false);
        };
        load();
    }, [refreshKey]);

    // Calculate age for a given week index
    const getStageForWeek = (weekIndex: number) => {
        const yearIndex = Math.floor(weekIndex / WEEKS_IN_YEAR);
        // Sort stages by start age (removed visibility filter to handle hidden stages manually)
        const sortedStages = stages
            .sort((a, b) => a.startAge - b.startAge);
        return sortedStages.find(s => yearIndex >= s.startAge && yearIndex < s.endAge);
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

    const getWeekDateRange = (weekIndex: number) => {
        if (!dob) return '';
        const birthDate = new Date(dob);
        const weekStart = new Date(birthDate.getTime() + weekIndex * 7 * 24 * 60 * 60 * 1000);
        const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);

        const formatDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        return `${formatDate(weekStart)} - ${formatDate(weekEnd)}`;
    };

    return (
        <div className="p-8 flex justify-center">
            <div className="inline-block">
                <h2 className="text-2xl font-bold mb-6 text-gray-200 text-center">Your Life in Weeks</h2>

                {/* Legend */}
                <div className="mb-6 flex flex-wrap gap-4 justify-center">
                    {stages.filter(s => (s as any).visible !== false).map((stage, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: stage.color }}></div>
                            <span className="text-sm text-gray-300">{stage.name}</span>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                        <div className="w-3 h-3 border-[1.5px] border-white bg-gray-600"></div>
                        <span className="text-sm text-gray-300">Photos & Videos</span>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                        {/* Greyed out style for projects */}
                        <div className="w-3 h-3 bg-gray-900/80 border border-gray-600 relative overflow-hidden">
                            <div className="absolute inset-0 bg-black/40"></div>
                        </div>
                        <span className="text-sm text-gray-300">Has Projects</span>
                    </div>
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-4">
                    {/* Y-Axis Labels (Ages) */}
                    <div className="flex flex-col justify-between py-1 text-xs text-gray-500 text-right pr-2" style={{ height: 'calc(100% - 20px)' }}>
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(age => (
                            <div key={age} className="h-4">{age}</div>
                        ))}
                    </div>

                    <div className="flex flex-wrap gap-[2px] max-w-[900px]">
                        {Array.from({ length: TOTAL_WEEKS })
                            .map((_, i) => ({ index: i, stage: getStageForWeek(i) }))
                            .filter(item => !item.stage || (item.stage as any).visible !== false)
                            .map(({ index: i, stage }) => {
                                const isPast = i <= currentWeekIndex;
                                const imgCount = imageCounts[i] || 0;
                                const vidCount = videoCounts[i] || 0;
                                const projCount = projectCounts[i] || 0;
                                const hasActivity = imgCount > 0 || vidCount > 0 || projCount > 0;
                                const dateRange = getWeekDateRange(i);

                                // Border Logic: Photos OR Videos get white border
                                const isPhotoOrVideo = imgCount > 0 || vidCount > 0;
                                const isProject = projCount > 0;

                                // "Grey out" effect for projects: Darken the cell
                                const bgStyle = isProject
                                    ? { backgroundColor: '#1f2937' } // dark grey (gray-800)
                                    : { backgroundColor: stage ? stage.color : '#374151' };

                                // If project, apply grayscale filter
                                const filterStyle = isProject ? 'grayscale(0.8) brightness(0.8)' : 'none';

                                const activityBorder = isPhotoOrVideo ? '1.5px solid #fff' : isProject ? '1px solid #4b5563' : (matchesBirthday(i) ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.1)');

                                return (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 border rounded-[1px] transition-all duration-300 box-border ${hasActivity ? 'hover:scale-150 z-10' : ''}`}
                                        style={{
                                            ...bgStyle,
                                            filter: filterStyle,
                                            opacity: isPast ? 1 : 0.3, // Dim future weeks
                                            border: activityBorder,
                                        }}
                                        title={`Week ${i} (Age ${Math.floor(i / 52)})\n${dateRange}\nStage: ${stage?.name || 'Unknown'}${imgCount > 0 ? `\n📸 ${imgCount} Images` : ''}${vidCount > 0 ? `\n🎬 ${vidCount} Videos` : ''}${projCount > 0 ? `\n🎹 ${projCount} Projects` : ''}`}
                                    />
                                );
                            })}
                    </div>
                </div>


            </div>
        </div>
    );
}
