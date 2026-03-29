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

  // Clean handle - remove @ if already present
  const cleanHandle = video.handle.startsWith('@') ? video.handle.slice(1) : video.handle;

  return (
    <div className="rounded-xl p-4 border border-gray-800/30" style={{ backgroundColor: '#1f1f23' }}>
      {/* Header with rank and platform */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
          index === 0 ? "bg-yellow-500/20 text-yellow-400" :
          index === 1 ? "bg-gray-500/20 text-gray-300" :
          index === 2 ? "bg-orange-500/20 text-orange-400" :
          "bg-gray-800 text-gray-500"
        }`}>
          {index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-base">@{cleanHandle}</span>
          <PlatformIcon platform={video.platform} size="sm" />
        </div>
      </div>

      {/* Hashtags */}
      <p className="text-sm text-purple-400 mb-2 truncate">{video.hashtags || "#trending"}</p>

      {/* Upload date */}
      <p className="text-sm text-gray-500 mb-3">uploaded on {formatDate(video.uploadDate)}</p>

      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="relative w-32 h-44 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 group cursor-pointer">
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
              <svg className="w-6 h-6 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          )}
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Stats - vertical list */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 mb-3">Stats from {formatDate(video.uploadDate)}</p>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Views</span>
              <span className="text-sm text-white font-semibold">{formatNumber(video.stats.views)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Engagement</span>
              <span className="text-sm text-white font-semibold">{engagementRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Likes</span>
              <span className="text-sm text-white font-semibold">{formatNumber(video.stats.likes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Comments</span>
              <span className="text-sm text-white font-semibold">{formatNumber(video.stats.comments)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Shares</span>
              <span className="text-sm text-white font-semibold">{formatNumber(video.stats.shares)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Saves</span>
              <span className="text-sm text-white font-semibold">{formatNumber(video.stats.saves)}</span>
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
  limit = 3,
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
    <div className="p-6 rounded-2xl border border-gray-800/30" style={{ backgroundColor: '#18181b' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Daily Viral Videos</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
