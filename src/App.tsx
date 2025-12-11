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

  const handleTabChange = (t: Tab) => {
    setActiveTab(t)
    setSelectedMedia(null)
  }

  return (
    <Layout activeTab={activeTab} onTabChange={handleTabChange}>
      {selectedMedia ? (
        <ImageDetail media={selectedMedia} onBack={() => setSelectedMedia(null)} />
      ) : (
        <>
          {activeTab === 'life-weeks' && <LifeWeeks />}
          {activeTab === 'pictures' && <MediaGrid type="image" onSelect={setSelectedMedia} />}
          {activeTab === 'video' && <MediaGrid type="video" />}
          {activeTab === 'music' && <MediaGrid type="audio" />}
          {activeTab === 'documents' && <MediaGrid type="document" />}
          {activeTab === 'projects' && <MediaGrid type="project" />}
          {activeTab === 'duplicates' && <DuplicatesList />}
        </>
      )}
    </Layout>
  )
}

export default App
