import { useEffect, useState } from 'react';
import { WeekDetailModal } from './WeekDetailModal';

interface LifeStage {
    name: string;
    color: string;
    startAge: number;
    endAge: number;
}

interface LifeWeeksProps {
    refreshKey?: number;
    onNavigateToMedia: (file: any) => void;
}

export function LifeWeeks({ refreshKey, onNavigateToMedia }: LifeWeeksProps) {
    const [dob, setDob] = useState<string | null>(null);
    const [stages, setStages] = useState<LifeStage[]>([]);
    const [loading, setLoading] = useState(true);

    const [imageFiles, setImageFiles] = useState<Record<number, any[]>>({});
    const [videoFiles, setVideoFiles] = useState<Record<number, any[]>>({});
    const [projectFiles, setProjectFiles] = useState<Record<number, any[]>>({});

    const WEEKS_IN_YEAR = 52;
    const TOTAL_YEARS = 90;
    const TOTAL_WEEKS = TOTAL_YEARS * WEEKS_IN_YEAR;

    const [legendPosition, setLegendPosition] = useState<'top' | 'bottom'>('top');
    const [showWeekTotals, setShowWeekTotals] = useState(true);

    const [selectedWeek, setSelectedWeek] = useState<{ index: number; start: string; end: string; files: any[] } | null>(null);

    const handleWeekClick = (weekIndex: number) => {
        const files = [
            ...(imageFiles[weekIndex] || []),
            ...(videoFiles[weekIndex] || []),
            ...(projectFiles[weekIndex] || [])
        ];

        setSelectedWeek({
            index: weekIndex,
            start: getWeekDateRange(weekIndex).split(' - ')[0],
            end: getWeekDateRange(weekIndex).split(' - ')[1],
            files
        });
    };

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
                if (settings.legendPosition) setLegendPosition(settings.legendPosition);
                if (settings.showWeekTotals !== undefined) setShowWeekTotals(settings.showWeekTotals);
                dobVal = settings.dob;
            }

            if (dobVal) {
                const birthTime = new Date(dobVal).getTime();

                // Helper to process stats into files
                const processStats = (items: any[]) => {
                    const counts: Record<number, any[]> = {};
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
                            if (!counts[diffWeeks]) counts[diffWeeks] = [];
                            counts[diffWeeks].push(item);
                        }
                    });
                    return counts;
                };

                const imgFiles = processStats(stats);
                const vidFiles = processStats(videoStats);
                const projFiles = processStats(projectStats);

                setImageFiles(imgFiles);
                setVideoFiles(vidFiles);
                setProjectFiles(projFiles);
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

    const legend = (
        <div className={`flex flex-wrap gap-4 justify-center ${legendPosition === 'bottom' ? 'mt-6' : 'mb-6'}`}>
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
    );



    return (
        <div className="w-full p-8 flex flex-col items-center relative">
            {/* Modal */}
            <WeekDetailModal
                isOpen={!!selectedWeek}
                onClose={() => setSelectedWeek(null)}
                weekIndex={selectedWeek?.index || 0}
                startDate={selectedWeek?.start || ''}
                endDate={selectedWeek?.end || ''}
                onNavigate={onNavigateToMedia}
                files={selectedWeek?.files || []}
            />

            <div className="flex flex-col items-center">
                <h2 className="text-3xl font-light tracking-[0.2em] uppercase mb-8 text-blue-100/90 text-center drop-shadow-sm">Your Life in Weeks</h2>

                {/* Legend Top (Removed) */}
                {/* {legendPosition === 'top' && legend} */}

                <div className="grid grid-cols-[auto_1fr_auto] gap-4 w-full max-w-[1400px]">
                    {/* Y-Axis Labels (Ages) */}
                    <div className="flex flex-col justify-between py-1 text-xs text-gray-500 text-right pr-2" style={{ height: 'calc(100% - 20px)' }}>
                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(age => (
                            <div key={age} className="h-4">{age}</div>
                        ))}
                    </div>

                    <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(52, min-content)' }}>
                        {Array.from({ length: TOTAL_WEEKS })
                            .map((_, i) => ({ index: i, stage: getStageForWeek(i) }))
                            .filter(item => !item.stage || (item.stage as any).visible !== false)
                            .map(({ index: i, stage }) => {
                                const isPast = i <= currentWeekIndex;
                                const imgCount = imageFiles[i]?.length || 0;
                                const vidCount = videoFiles[i]?.length || 0;
                                const projCount = projectFiles[i]?.length || 0;
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

                                let title = `Week ${i} (Age ${Math.floor(i / 52)})\n${dateRange}\nStage: ${stage?.name || 'Unknown'}`;
                                if (showWeekTotals) {
                                    if (imgCount > 0) title += `\n📸 ${imgCount} Images`;
                                    if (vidCount > 0) title += `\n🎬 ${vidCount} Videos`;
                                    if (projCount > 0) title += `\n🎹 ${projCount} Projects`;
                                }

                                return (
                                    <div
                                        key={i}
                                        className={`w-3 h-3 border rounded-[1px] transition-all duration-300 box-border ${hasActivity ? 'hover:scale-150 z-10 cursor-pointer' : ''}`}
                                        style={{
                                            ...bgStyle,
                                            filter: filterStyle,
                                            opacity: isPast ? 1 : 0.3, // Dim future weeks
                                            border: activityBorder,
                                        }}
                                        title={title}
                                        onClick={() => hasActivity && handleWeekClick(i)}
                                    />
                                );
                            })}
                    </div>

                    {/* Right Axis - Stage Labels */}
                    <div className="relative h-full min-w-[150px] hidden md:block">
                        {stages.filter(s => (s as any).visible !== false).map((stage, i) => (
                            <div
                                key={i}
                                className="absolute left-0 text-xs font-light uppercase tracking-widest transition-opacity hover:opacity-100 opacity-80"
                                style={{
                                    top: `${(stage.startAge / 90) * 100}%`,
                                    color: stage.color,
                                    transform: 'translateY(-50%)', // Center on the line
                                    marginTop: '8px' // Slight optical adjustment
                                }}
                            >
                                {stage.name}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mini Legend - Media Types */}
                <div className="flex items-center gap-6 mt-8 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-[1.5px] border-white bg-gray-600"></div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">Moments</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-900/80 border border-gray-600 relative overflow-hidden">
                            <div className="absolute inset-0 bg-black/40"></div>
                        </div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">Projects</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
