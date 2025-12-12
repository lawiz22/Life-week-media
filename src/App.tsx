import { useState } from 'react'
import { Layout } from './components/Layout'
import { LifeWeeks } from './components/LifeWeeks'
import { MediaGrid, MediaFile } from './components/MediaGrid'
import { DuplicatesList } from './components/DuplicatesList'
import { ImageDetail } from './components/ImageDetail'

// Define Tab type locally since it's used in state
type Tab = 'life-weeks' | 'pictures' | 'video' | 'music' | 'projects' | 'documents' | 'duplicates' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('life-weeks')
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleTabChange = (t: Tab) => {
    setActiveTab(t)
    setSelectedMedia(null)
  }

  const handleScanComplete = () => {
    setRefreshKey(prev => prev + 1)
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange} onScanComplete={handleScanComplete}>
      {selectedMedia ? (
        <ImageDetail media={selectedMedia} onBack={() => setSelectedMedia(null)} />
      ) : (
        <>
          {activeTab === 'life-weeks' && <LifeWeeks refreshKey={refreshKey} />}
          {activeTab === 'pictures' && <MediaGrid type="image" onSelect={setSelectedMedia} refreshKey={refreshKey} />}
          {activeTab === 'video' && <MediaGrid type="video" onSelect={setSelectedMedia} refreshKey={refreshKey} />}
          {activeTab === 'music' && <MediaGrid type="audio" onSelect={setSelectedMedia} refreshKey={refreshKey} />}
          {activeTab === 'documents' && <MediaGrid type="document" onSelect={setSelectedMedia} refreshKey={refreshKey} />}
          {activeTab === 'projects' && <MediaGrid type="project" onSelect={setSelectedMedia} refreshKey={refreshKey} />}
          {activeTab === 'duplicates' && <DuplicatesList refreshKey={refreshKey} />}
        </>
      )}
    </Layout>
  )
}

export default App
