import { useEffect, useState } from 'react';

interface LifeStage {
    id?: number;
    name: string;
    color: string;
    startAge: number;
    endAge: number;
    visible?: boolean;
}

export function Settings() {
    const [dob, setDob] = useState('');
    const [stages, setStages] = useState<LifeStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await window.ipcRenderer?.invoke('get-settings');
            if (data) {
                setDob(data.dob);
                setStages(data.stages);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await window.ipcRenderer?.invoke('save-settings', { dob, stages });
            alert('Settings saved!');
        } catch (err) {
            console.error(err);
            alert('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = async () => {
        if (!confirm('Are you sure you want to delete ALL media and reset the database? This cannot be undone.')) return;
        try {
            const res = await window.ipcRenderer?.invoke('reset-library');
            if (res.success) {
                alert('Library reset successfully.');
            } else {
                alert('Reset failed: ' + res.error);
            }
        } catch (e) {
            console.error(e);
            alert('Error resetting library');
        }
    };

    const updateStage = (index: number, field: keyof LifeStage, value: any) => {
        const newStages = [...stages];
        newStages[index] = { ...newStages[index], [field]: value };
        setStages(newStages);
    };

    if (loading) return <div className="p-8 text-gray-400">Loading settings...</div>;

    return (
        <div className="p-8 max-w-5xl mx-auto text-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Settings</h2>
                <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm font-medium transition-colors"
                >
                    RESET LIBRARY
                </button>
            </div>

            <div className="mb-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
                <h3 className="text-lg font-semibold mb-4">Your Details</h3>
                <div className="flex flex-col gap-2">
                    <label className="text-sm text-gray-400">Date of Birth</label>
                    <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded p-2 text-white focus:outline-none focus:border-blue-500"
                    />
                </div>
            </div>

            <div className="mb-8 p-6 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Life Stages</h3>
                    <button
                        onClick={async () => {
                            if (!confirm('Reset life stages to the new 13 defaults? This will overwrite your current stages.')) return;
                            setLoading(true);
                            try {
                                const res = await window.ipcRenderer?.invoke('reset-life-stages');
                                if (res.success) {
                                    setStages(res.stages);
                                }
                            } catch (e) { console.error(e); }
                            setLoading(false);
                        }}
                        className="text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-gray-300"
                    >
                        Reset to Defaults
                    </button>
                </div>
                <p className="text-sm text-gray-400 mb-4">Define the chapters of your life. Uncheck "Show" to hide a stage from the main view.</p>

                <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 text-sm text-gray-500 font-medium px-2">
                        <div className="col-span-1 text-center">Show</div>
                        <div className="col-span-3">Name</div>
                        <div className="col-span-2">Color</div>
                        <div className="col-span-2">Start Age</div>
                        <div className="col-span-2">End Age</div>
                        <div className="col-span-2">Duration</div>
                    </div>
                    {stages.map((stage, index) => (
                        <div key={index} className="grid grid-cols-12 gap-4 items-center bg-gray-900/50 p-2 rounded hover:bg-gray-900 transition-colors">
                            <div className="col-span-1 flex justify-center">
                                <input
                                    type="checkbox"
                                    checked={stage.visible !== false}
                                    onChange={(e) => updateStage(index, 'visible', e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                                />
                            </div>
                            <div className="col-span-3">
                                <input
                                    type="text"
                                    value={stage.name}
                                    onChange={(e) => updateStage(index, 'name', e.target.value)}
                                    className="w-full bg-transparent border-b border-gray-700 focus:border-blue-500 focus:outline-none px-1"
                                />
                            </div>
                            <div className="col-span-2 flex items-center gap-2">
                                <input
                                    type="color"
                                    value={stage.color}
                                    onChange={(e) => updateStage(index, 'color', e.target.value)}
                                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                                />
                                <span className="text-xs font-mono">{stage.color}</span>
                            </div>
                            <div className="col-span-2">
                                <input
                                    type="number"
                                    value={stage.startAge}
                                    onChange={(e) => updateStage(index, 'startAge', parseInt(e.target.value))}
                                    className="w-full bg-transparent border-b border-gray-700 focus:border-blue-500 focus:outline-none px-1"
                                />
                            </div>
                            <div className="col-span-2">
                                <input
                                    type="number"
                                    value={stage.endAge}
                                    onChange={(e) => updateStage(index, 'endAge', parseInt(e.target.value))}
                                    className="w-full bg-transparent border-b border-gray-700 focus:border-blue-500 focus:outline-none px-1"
                                />
                            </div>
                            <div className="col-span-2 text-sm text-gray-500">
                                {stage.endAge - stage.startAge} years
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded text-white font-medium transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
}
