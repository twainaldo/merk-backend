"use client";

import { Video, Platform } from "../types";
import PlatformIcon from "./PlatformIcon";
import Image from "next/image";

interface ViralVideosProps {
  videos?: Video[];
  selectedPlatform?: Platform | null;
  limit?: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg
        className="w-20 h-20 mb-4 text-gray-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
      <p className="text-base font-medium text-white">No viral videos yet</p>
      <p className="text-sm mt-2 text-gray-500">
        Your top performing videos will appear here
      </p>
    </div>
  );
}

function VideoCard({ video, index }: { video: Video; index: number }) {
  const engagementRate = video.stats.views > 0
    ? ((video.stats.likes + video.stats.comments + video.stats.shares) / video.stats.views * 100).toFixed(2)
    : "0.00";

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 hover:bg-gray-900 transition-all duration-200">
      <div className="flex gap-4">
        {/* Rank Badge */}
        <div className="flex-shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
            index === 0 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
            index === 1 ? "bg-gray-400/20 text-gray-300 border border-gray-500/30" :
            index === 2 ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
            "bg-gray-800 text-gray-400 border border-gray-700"
          }`}>
            #{index + 1}
          </div>
        </div>

        {/* Thumbnail */}
        <div className="flex-shrink-0 relative group cursor-pointer">
          <div className="w-32 h-[180px] rounded-lg overflow-hidden bg-gray-800 relative">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={video.description || "Video thumbnail"}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="128px"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
          {/* Platform Badge */}
          <div className="absolute -top-1 -right-1">
            <PlatformIcon platform={video.platform} size="sm" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-white text-sm">@{video.handle}</span>
            </div>
            <p className="text-xs text-purple-400 truncate mb-2">{video.hashtags || "#trending"}</p>
            <p className="text-xs text-gray-500">uploaded on {formatDate(video.uploadDate)}</p>
          </div>

          {/* Stats */}
          <div className="mt-3">
            <p className="text-[10px] text-gray-600 mb-2">Stats from {formatDate(video.uploadDate)}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <div>
                  <p className="text-[10px] text-gray-500">Views</p>
                  <p className="font-semibold text-xs text-white">{formatNumber(video.stats.views)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <div>
                  <p className="text-[10px] text-gray-500">Engagement</p>
                  <p className="font-semibold text-xs text-white">{engagementRate}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <div>
                  <p className="text-[10px] text-gray-500">Likes</p>
                  <p className="font-semibold text-xs text-white">{formatNumber(video.stats.likes)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div>
                  <p className="text-[10px] text-gray-500">Comments</p>
                  <p className="font-semibold text-xs text-white">{formatNumber(video.stats.comments)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <div>
                  <p className="text-[10px] text-gray-500">Shares</p>
                  <p className="font-semibold text-xs text-white">{formatNumber(video.stats.shares)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <div>
                  <p className="text-[10px] text-gray-500">Saves</p>
                  <p className="font-semibold text-xs text-white">{formatNumber(video.stats.saves)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ViralVideos({
  videos = [],
  selectedPlatform = null,
  limit = 10,
}: ViralVideosProps) {
  // Filter videos by selected platform
  const filteredVideos = selectedPlatform
    ? videos.filter((video) => video.platform === selectedPlatform)
    : videos;

  // Sort by views and limit
  const sortedVideos = [...filteredVideos]
    .sort((a, b) => b.stats.views - a.stats.views)
    .slice(0, limit);

  return (
    <div className="bg-gray-900/30 backdrop-blur-sm p-6 rounded-2xl border border-gray-800/50">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Most Viral Videos</h2>
        <span className="text-xs text-gray-500">{sortedVideos.length} videos</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedVideos.length === 0 ? (
          <div className="col-span-full">
            <EmptyState />
          </div>
        ) : (
          sortedVideos.map((video, index) => (
            <VideoCard key={video.id} video={video} index={index} />
          ))
        )}
      </div>
    </div>
  );
}
