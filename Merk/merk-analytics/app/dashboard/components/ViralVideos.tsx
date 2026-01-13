import { Video, Platform } from "../types";
import PlatformIcon from "./PlatformIcon";

interface ViralVideosProps {
  videos?: Video[];
  selectedPlatform?: Platform | null;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <svg className="w-16 h-16 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <p className="text-sm font-medium text-white">No viral videos yet</p>
      <p className="text-xs mt-1 text-gray-500">Your top performing videos will appear here</p>
    </div>
  );
}

function VideoCard({ video, index }: { video: Video; index: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border border-gray-800 rounded-lg hover:bg-gray-800 transition bg-gray-900">
      <div className="flex items-center justify-center w-10 h-10 bg-black text-white rounded-full font-bold text-sm flex-shrink-0">
        #{index + 1}
      </div>

      <div className="flex-shrink-0 relative group">
        <div className="w-28 h-20 bg-gradient-to-br from-purple-400 to-pink-400 rounded-md flex items-center justify-center overflow-hidden">
          <svg className="w-6 h-6 text-white opacity-80 group-hover:opacity-100 transition" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </div>
        {/* Platform Badge */}
        <div className="absolute -top-1 -right-1">
          <PlatformIcon platform={video.platform} size="sm" />
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white text-sm">{video.handle}</p>
        </div>
        <p className="text-xs text-gray-400 truncate">{video.hashtag}</p>
        <p className="text-xs text-gray-500">uploaded on {video.uploadDate}</p>
      </div>

      <div className="flex-shrink-0">
        <div className="text-xs text-gray-500 mb-1">Stats from {video.uploadDate}</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <div>
              <p className="text-[10px] text-gray-500">Views</p>
              <p className="font-semibold text-xs text-white">{video.stats.views}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <div>
              <p className="text-[10px] text-gray-500">Engagement</p>
              <p className="font-semibold text-xs text-white">{video.stats.engagement}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <div>
              <p className="text-[10px] text-gray-500">Likes</p>
              <p className="font-semibold text-xs text-white">{video.stats.likes}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div>
              <p className="text-[10px] text-gray-500">Comments</p>
              <p className="font-semibold text-xs text-white">{video.stats.comments}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViralVideos({ videos = [], selectedPlatform = null }: ViralVideosProps) {
  // Filter videos by selected platform
  const filteredVideos = selectedPlatform
    ? videos.filter(video => video.platform === selectedPlatform)
    : videos;

  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
      <h2 className="text-lg font-semibold text-white mb-6">Most Viral Videos</h2>

      <div className="grid gap-4">
        {filteredVideos.length === 0 ? (
          <EmptyState />
        ) : (
          filteredVideos.map((video, index) => (
            <VideoCard key={video.id} video={video} index={index} />
          ))
        )}
      </div>
    </div>
  );
}
