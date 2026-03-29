"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import PlatformIcon from "../components/PlatformIcon";
import Image from "next/image";
import { Platform, Video } from "../types";

type SortField = "views" | "likes" | "comments" | "shares" | "saves" | "uploadDate";
type SortOrder = "asc" | "desc";

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
    month: "short",
    year: "numeric",
  });
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface VideoRowProps {
  video: Video;
  index: number;
}

function VideoRow({ video, index }: VideoRowProps) {
  const engagementRate = video.stats.views > 0
    ? ((video.stats.likes + video.stats.comments + video.stats.shares) / video.stats.views * 100).toFixed(2)
    : "0.00";

  return (
    <tr className="border-b border-gray-800/30 hover:bg-white/5 transition-colors">
      {/* Rank */}
      <td className="py-4 px-4">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
          index === 0 ? "bg-yellow-500/20 text-yellow-400" :
          index === 1 ? "bg-gray-400/20 text-gray-300" :
          index === 2 ? "bg-orange-500/20 text-orange-400" :
          "bg-gray-800 text-gray-500"
        }`}>
          {index + 1}
        </span>
      </td>

      {/* Video Info */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="relative w-20 h-28 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 group cursor-pointer">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={video.description || "Video thumbnail"}
                fill
                className="object-cover group-hover:scale-105 transition-transform"
                sizes="80px"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-white/50" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            )}
            {/* Play overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
            {/* Duration badge */}
            {video.duration > 0 && (
              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                {formatDuration(video.duration)}
              </div>
            )}
            {/* Platform badge */}
            <div className="absolute top-1 right-1">
              <PlatformIcon platform={video.platform} size="sm" />
            </div>
          </div>

          {/* Video Details */}
          <div className="min-w-0 max-w-[250px]">
            <p className="font-semibold text-white text-sm">@{video.handle.replace(/^@/, '')}</p>
            <p className="text-xs text-gray-400 truncate max-w-xs mt-1">
              {video.description || "No description"}
            </p>
            <p className="text-xs text-purple-400 truncate mt-1">
              {video.hashtags || "#trending"}
            </p>
          </div>
        </div>
      </td>

      {/* Upload Date */}
      <td className="py-4 px-4 text-sm text-gray-400">
        {formatDate(video.uploadDate)}
      </td>

      {/* Views */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span className="text-white font-semibold">{formatNumber(video.stats.views)}</span>
        </div>
      </td>

      {/* Engagement */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <span className="text-white font-semibold">{engagementRate}%</span>
        </div>
      </td>

      {/* Likes */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span className="text-gray-300">{formatNumber(video.stats.likes)}</span>
        </div>
      </td>

      {/* Comments */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span className="text-gray-300">{formatNumber(video.stats.comments)}</span>
        </div>
      </td>

      {/* Shares */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          <span className="text-gray-300">{formatNumber(video.stats.shares)}</span>
        </div>
      </td>

      {/* Saves */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <span className="text-gray-300">{formatNumber(video.stats.saves)}</span>
        </div>
      </td>
    </tr>
  );
}

export default function VideosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("views");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(100);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Reset visible count when search/sort changes
  useEffect(() => { setVisibleCount(100); }, [searchTerm, sortField, sortOrder]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 100);
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loaderRef.current, visibleCount]);
  const supabase = createClient();

  // Fetch all videos from Supabase
  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        // Fetch top 1000 videos for display + total count
        const { count } = await supabase
          .from("videos")
          .select("id", { count: "exact", head: true });

        const { data: videosData, error } = await supabase
          .from("videos")
          .select(`
            id, video_id, video_url, views, likes, comments, shares, saves,
            duration, published_date, description, hashtags, thumbnail_url,
            accounts ( id, platform, username )
          `)
          .order("views", { ascending: false })
          .limit(1000);

        setTotalCount(count || 0);

        if (error) {
          console.error("Error fetching videos:", error);
        } else if (videosData && videosData.length > 0) {
          const formattedVideos: Video[] = videosData.map((v: any) => ({
            id: v.id,
            video_id: v.video_id || "",
            video_url: v.video_url || "",
            platform: (v.accounts?.platform?.toLowerCase() || "tiktok") as Platform,
            handle: v.accounts?.username || "unknown",
            description: v.description || "",
            hashtags: v.hashtags || "",
            uploadDate: v.published_date || new Date().toISOString(),
            thumbnailUrl: v.thumbnail_url || "",
            duration: v.duration || 0,
            stats: {
              views: v.views || 0,
              likes: v.likes || 0,
              comments: v.comments || 0,
              shares: v.shares || 0,
              saves: v.saves || 0,
              engagement: v.views > 0
                ? Number((((v.likes || 0) + (v.comments || 0) + (v.shares || 0)) / v.views * 100).toFixed(2))
                : 0,
            },
          }));
          setVideos(formattedVideos);
        }
      } catch (error) {
        console.error("Error fetching videos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  // Filter and sort videos
  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          v.handle.toLowerCase().includes(term) ||
          v.description.toLowerCase().includes(term) ||
          v.hashtags.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;

      switch (sortField) {
        case "views":
          aVal = a.stats.views;
          bVal = b.stats.views;
          break;
        case "likes":
          aVal = a.stats.likes;
          bVal = b.stats.likes;
          break;
        case "comments":
          aVal = a.stats.comments;
          bVal = b.stats.comments;
          break;
        case "shares":
          aVal = a.stats.shares;
          bVal = b.stats.shares;
          break;
        case "saves":
          aVal = a.stats.saves;
          bVal = b.stats.saves;
          break;
        case "uploadDate":
          aVal = new Date(a.uploadDate).getTime();
          bVal = new Date(b.uploadDate).getTime();
          break;
        default:
          aVal = a.stats.views;
          bVal = b.stats.views;
      }

      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [videos, searchTerm, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <th
      className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortField === field && (
          <svg
            className={`w-4 h-4 transition-transform ${sortOrder === "asc" ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
    </th>
  );

  return (
    <div className="flex h-screen" style={{ backgroundColor: '#111114' }}>
      <Sidebar isOpen={sidebarOpen} userEmail={userEmail} />

      <main className="flex-1 overflow-auto" style={{ backgroundColor: '#111114' }}>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">All Videos</h1>
              <p className="text-sm text-gray-400 mt-1">
                {totalCount.toLocaleString()} videos tracked{totalCount > 1000 ? ` (showing top 1,000)` : ""}
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <svg
                className="w-5 h-5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search videos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-800/50 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 w-64" style={{ backgroundColor: '#1f1f23' }}
              />
            </div>
          </div>

          {/* Videos Table */}
          <div className="rounded-2xl border border-gray-800/30 overflow-hidden" style={{ backgroundColor: '#18181b' }}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              </div>
            ) : filteredAndSortedVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
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
                <p className="text-base font-medium text-white">No videos found</p>
                <p className="text-sm mt-2 text-gray-500">
                  {searchTerm ? "Try a different search term" : "Videos will appear here once tracked"}
                </p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-800/50" style={{ backgroundColor: '#1f1f23' }}>
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-12">
                        #
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-80">
                        Video
                      </th>
                      <SortHeader field="uploadDate" label="Uploaded" />
                      <SortHeader field="views" label="Views" />
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Eng.
                      </th>
                      <SortHeader field="likes" label="Likes" />
                      <SortHeader field="comments" label="Comments" />
                      <SortHeader field="shares" label="Shares" />
                      <SortHeader field="saves" label="Saves" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedVideos.slice(0, visibleCount).map((video, index) => (
                      <VideoRow key={video.id} video={video} index={index} />
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < filteredAndSortedVideos.length && (
                <div
                  ref={loaderRef}
                  className="flex items-center justify-center py-6"
                >
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
                  <span className="ml-3 text-sm text-gray-500">
                    Showing {Math.min(visibleCount, filteredAndSortedVideos.length).toLocaleString()} of {filteredAndSortedVideos.length.toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </main>
    </div>
  );
}
