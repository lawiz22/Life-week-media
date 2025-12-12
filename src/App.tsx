import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { LifeWeeks } from './components/LifeWeeks'
import { MediaGrid, MediaFile } from './components/MediaGrid'
import { DuplicatesList } from './components/DuplicatesList'
import { ImageDetail } from './components/ImageDetail'
import { ProjectDetail } from './components/ProjectDetail'

// Define Tab type locally since it's used in state
type Tab = 'life-weeks' | 'pictures' | 'video' | 'music' | 'projects' | 'documents' | 'duplicates' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('life-weeks')
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [files, setFiles] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)

  // Persisted view state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [viewMode, setViewMode] = useState<'large' | 'medium' | 'small' | 'list'>('medium')

  // Load files when tab changes
  useEffect(() => {
    const loadFiles = async () => {
      // Only load for media tabs
      const mediaTabs = ['pictures', 'video', 'music', 'documents', 'projects'];
      if (!mediaTabs.includes(activeTab)) return;

      try {
        setLoading(true)
        // Map tab name to scan type if needed, but current convention is 1:1 or close
        let type = '';
        if (activeTab === 'pictures') type = 'image';
        if (activeTab === 'video') type = 'video';
        if (activeTab === 'music') type = 'audio';
        if (activeTab === 'documents') type = 'document';
        if (activeTab === 'projects') type = 'project';

        const result = await window.ipcRenderer?.invoke('get-media', type);
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

  const currentType = activeTab === 'pictures' ? 'image' :
    activeTab === 'video' ? 'video' :
      activeTab === 'music' ? 'audio' :
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
          />
        )
      ) : (
        <>
          {/* ... other tabs ... */}
          {activeTab === 'life-weeks' && <LifeWeeks refreshKey={refreshKey} />}

          {['pictures', 'video', 'music', 'documents', 'projects'].includes(activeTab) && (
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
            />
          )}

          {activeTab === 'duplicates' && <DuplicatesList refreshKey={refreshKey} />}
        </>
      )}
    </Layout>
  )
}

export default App
