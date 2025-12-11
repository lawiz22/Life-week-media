import { useState } from 'react'
import { Layout } from './components/Layout'
import { LifeWeeks } from './components/LifeWeeks'
import { MediaGrid } from './components/MediaGrid'
import { DuplicatesList } from './components/DuplicatesList'

// Define Tab type locally since it's used in state
type Tab = 'life-weeks' | 'pictures' | 'video' | 'music' | 'projects' | 'documents' | 'duplicates';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('life-weeks')


  return (
    <Layout activeTab={activeTab} onTabChange={(t) => setActiveTab(t as Tab)}>
      {activeTab === 'life-weeks' && <LifeWeeks />}
      {activeTab === 'pictures' && <MediaGrid type="image" />}
      {activeTab === 'video' && <MediaGrid type="video" />}
      {activeTab === 'music' && <MediaGrid type="audio" />}
      {activeTab === 'documents' && <MediaGrid type="document" />}
      {activeTab === 'projects' && <MediaGrid type="project" />}
      {activeTab === 'duplicates' && <DuplicatesList />}
    </Layout>
  )
}

export default App
