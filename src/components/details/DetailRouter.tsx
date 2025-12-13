import { MediaFile } from '../MediaGrid';
import { ImageDetail } from '../ImageDetail';
import { VideoDetail } from './VideoDetail';
import { AudioDetail } from './AudioDetail';
import { DocumentDetail } from './DocumentDetail';
import { ProjectDetail } from './ProjectDetail';
// Import other detail components as they're created
// import { DocumentDetail } from './DocumentDetail';
// import { ProjectDetail } from './ProjectDetail';

interface DetailRouterProps {
    media: MediaFile;
    onBack: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onSongEnd?: () => void;
}

export function DetailRouter({ media, onBack, onNext, onPrev, onSongEnd }: DetailRouterProps) {
    // Route to appropriate detail component based on media type
    switch (media.type) {
        case 'video':
            return <VideoDetail media={media} onBack={onBack} onNext={onNext} onPrev={onPrev} />;

        case 'audio':
            return <AudioDetail media={media} onBack={onBack} onNext={onNext} onPrev={onPrev} onSongEnd={onSongEnd} />;

        case 'document':
            return <DocumentDetail media={media} onBack={onBack} onNext={onNext} onPrev={onPrev} />;

        // ... (import moved to top)

        case 'project':
            return <ProjectDetail media={media} onBack={onBack} onNext={onNext} onPrev={onPrev} />;

        case 'image':
        default:
            // Images use the existing ImageDetail
            return <ImageDetail media={media} onBack={onBack} onNext={onNext} onPrev={onPrev} />;
    }
}
