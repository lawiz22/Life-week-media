import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { LifeWeeks } from './components/LifeWeeks'
import { MediaGrid, MediaFile } from './components/MediaGrid'
import { DuplicatesList } from './components/DuplicatesList'
import { ImageDetail } from './components/ImageDetail'
import { ProjectDetail } from './components/ProjectDetail'

// Define Tab type locally since it's used in state
type Tab = 'life-weeks' | 'pictures' | 'video' | 'music' | 'audio' | 'projects' | 'documents' | 'duplicates' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    // Restore active tab from sessionStorage
    const saved = sessionStorage.getItem('activeTab');
    return (saved as Tab) || 'life-weeks';
  })
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)

  // Persisted view state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [viewMode, setViewMode] = useState<'large' | 'medium' | 'small' | 'list'>('medium')

  // Auto-play for music
  const [autoPlayMusic, setAutoPlayMusic] = useState(false)

  // Load files when tab changes
  useEffect(() => {
    const loadFiles = async () => {
      // Only load for media tabs
      const mediaTabs = ['pictures', 'video', 'music', 'audio', 'documents', 'projects'];
      if (!mediaTabs.includes(activeTab)) return;

      try {
        setLoading(true)
        // Map tab name to type and category
        let type = '';
        let category: string | undefined = undefined;

        if (activeTab === 'pictures') type = 'image';
        if (activeTab === 'video') type = 'video';
        if (activeTab === 'music') {
          type = 'audio';
          category = 'music';
        }
        if (activeTab === 'audio') {
          type = 'audio';
          category = 'audio';
        }
        if (activeTab === 'documents') type = 'document';
        if (activeTab === 'projects') type = 'project';

        const result = await window.ipcRenderer?.invoke('get-media', type, category);
        setFiles(result || []);
      } catch (err) {
        console.error(err);
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [activeTab, refreshKey]);

  // Save active tab to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  const handleTabChange = (t: Tab) => {
    setActiveTab(t)
    setSelectedMedia(null)
    setCurrentPage(1) // Reset page on tab switch, but keep PageSize/ViewMode
  }

  const handleScanComplete = () => {
    setRefreshKey(prev => prev + 1)
  }

  // Navigation Logic
  const handleNext = () => {
    if (!selectedMedia) return;
    const idx = files.findIndex(f => f.id === selectedMedia.id);
    if (idx !== -1 && idx < files.length - 1) {
      setSelectedMedia(files[idx + 1]);
    }
  };

  const handlePrev = () => {
    if (!selectedMedia) return;
    const idx = files.findIndex(f => f.id === selectedMedia.id);
    if (idx !== -1 && idx > 0) {
      setSelectedMedia(files[idx - 1]);
    }
  };

  const handleSongEnd = () => {
    if (autoPlayMusic && activeTab === 'music') {
      handleNext();
    }
  };

  const currentType = activeTab === 'pictures' ? 'image' :
    activeTab === 'video' ? 'video' :
      activeTab === 'music' ? 'audio' :
        activeTab === 'audio' ? 'audio' :
          activeTab === 'documents' ? 'document' :
            activeTab === 'projects' ? 'project' : '';

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange} onScanComplete={handleScanComplete}>
      {selectedMedia ? (
        activeTab === 'projects' || selectedMedia.type === 'project' ? (
          <ProjectDetail
            media={selectedMedia}
            onBack={() => setSelectedMedia(null)}
            onNext={files.findIndex(f => f.id === selectedMedia.id) < files.length - 1 ? handleNext : undefined}
            onPrev={files.findIndex(f => f.id === selectedMedia.id) > 0 ? handlePrev : undefined}
          />
        ) : (
          <ImageDetail
            media={selectedMedia}
            onBack={() => setSelectedMedia(null)}
            onNext={files.findIndex(f => f.id === selectedMedia.id) < files.length - 1 ? handleNext : undefined}
            onPrev={files.findIndex(f => f.id === selectedMedia.id) > 0 ? handlePrev : undefined}
            onSongEnd={activeTab === 'music' ? handleSongEnd : undefined}
          />
        )
      ) : (
        <>
          {/* ... other tabs ... */}
          {activeTab === 'life-weeks' && <LifeWeeks refreshKey={refreshKey} />}

          {['pictures', 'video', 'music', 'audio', 'documents', 'projects'].includes(activeTab) && (
            <MediaGrid
              type={currentType}
              files={files}
              loading={loading}
              onSelect={setSelectedMedia}

              // State Props
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              viewMode={viewMode}
              onViewModeChange={setViewMode}

              // Auto-play (music only)
              autoPlay={activeTab === 'music' ? autoPlayMusic : undefined}
              onAutoPlayChange={activeTab === 'music' ? setAutoPlayMusic : undefined}
            />
          )}

          {activeTab === 'duplicates' && <DuplicatesList refreshKey={refreshKey} />}
        </>
      )}
    </Layout>
  )
}

export default App
