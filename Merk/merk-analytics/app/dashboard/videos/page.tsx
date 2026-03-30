"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import PlatformIcon from "../components/PlatformIcon";
import Image from "next/image";
import { Platform, Video, Account } from "../types";

type SortField = "views" | "likes";
const LIMITS = [100, 200, 300, 500, 1000, "all"] as const;
type Limit = (typeof LIMITS)[number];

const PLATFORMS: { key: Platform; label: string }[] = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "twitter", label: "Twitter / X" },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function VideoRow({ video, index }: { video: Video; index: number }) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(video.video_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <tr className="border-b border-gray-800/30 hover:bg-white/5 transition-colors">
      <td className="py-3 px-4">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
          index === 0 ? "bg-yellow-500/20 text-yellow-400" :
          index === 1 ? "bg-gray-400/20 text-gray-300" :
          index === 2 ? "bg-orange-500/20 text-orange-400" :
          "bg-gray-800 text-gray-500"
        }`}>
          {index + 1}
        </span>
      </td>

      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="relative w-16 h-22 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 group">
            {video.thumbnailUrl ? (
              <Image src={video.thumbnailUrl} alt="" fill className="object-cover group-hover:scale-105 transition-transform" sizes="64px" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/50" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
            {video.duration > 0 && (
              <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded">
                {formatDuration(video.duration)}
              </div>
            )}
            <div className="absolute top-0.5 right-0.5">
              <PlatformIcon platform={video.platform} size="sm" />
            </div>
          </a>

          <div className="min-w-0 max-w-[200px]">
            <p className="font-semibold text-white text-sm">@{video.handle.replace(/^@/, "")}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{video.description || "No description"}</p>
          </div>
        </div>
      </td>

      <td className="py-3 px-4 text-sm text-gray-400">{formatDate(video.uploadDate)}</td>
      <td className="py-3 px-4 text-white font-semibold text-sm">{formatNumber(video.stats.views)}</td>
      <td className="py-3 px-4 text-gray-300 text-sm">{formatNumber(video.stats.likes)}</td>
      <td className="py-3 px-4 text-gray-300 text-sm">{formatNumber(video.stats.comments)}</td>
      <td className="py-3 px-4 text-gray-300 text-sm">{formatNumber(video.stats.shares)}</td>
      <td className="py-3 px-4 text-gray-300 text-sm">{formatNumber(video.stats.saves)}</td>

      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <a
            href={video.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 rounded-lg transition-colors"
            title="Open video"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <button
            onClick={copyLink}
            className={`p-1.5 rounded-lg transition-colors ${copied ? "text-green-400 bg-green-400/10" : "text-gray-500 hover:text-white hover:bg-white/10"}`}
            title="Copy link"
          >
            {copied ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function VideosPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail] = useState<string>("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>("views");
  const [searchTerm, setSearchTerm] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [displayLimit, setDisplayLimit] = useState<Limit>(100);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<Platform>>(new Set(["tiktok", "instagram", "youtube", "twitter"]));
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [copiedAll, setCopiedAll] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch accounts
        const { data: accountsData } = await supabase
          .from("accounts")
          .select("*")
          .order("platform");

        if (accountsData) {
          const accs = accountsData.map((a: any) => ({
            id: a.id,
            platform: a.platform.toLowerCase() as Platform,
            username: a.username,
            url: a.url,
            profile_picture: a.profile_picture || null,
            created_at: a.created_at,
          }));
          setAccounts(accs);
          setSelectedAccounts(new Set(accs.map((a: Account) => a.username)));
        }

        // Fetch videos
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
          .limit(5000);

        setTotalCount(count || 0);

        if (!error && videosData) {
          setVideos(videosData.map((v: any) => ({
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
          })));
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  };

  const toggleAccount = (username: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  };

  const filteredVideos = useMemo(() => {
    let result = videos
      .filter(v => selectedPlatforms.has(v.platform))
      .filter(v => selectedAccounts.has(v.handle));

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(v =>
        v.handle.toLowerCase().includes(term) ||
        v.description.toLowerCase().includes(term) ||
        v.hashtags.toLowerCase().includes(term)
      );
    }

    result.sort((a, b) =>
      sortField === "views"
        ? b.stats.views - a.stats.views
        : b.stats.likes - a.stats.likes
    );

    const limit = displayLimit === "all" ? result.length : displayLimit;
    return result.slice(0, limit);
  }, [videos, selectedPlatforms, selectedAccounts, searchTerm, sortField, displayLimit]);

  const copyAllLinks = () => {
    const links = filteredVideos.map(v => v.video_url).join("\n");
    navigator.clipboard.writeText(links);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#111114" }}>
      <Sidebar isOpen={sidebarOpen} userEmail={userEmail} />

      <main className="flex-1 overflow-auto" style={{ backgroundColor: "#111114" }}>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">All Videos</h1>
              <p className="text-sm text-gray-400 mt-1">
                {totalCount.toLocaleString()} total &middot; {filteredVideos.length.toLocaleString()} shown
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={copyAllLinks}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white font-medium transition-all ${
                  copiedAll ? "bg-green-600" : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {copiedAll ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
                {copiedAll ? "Copied!" : `Copy All Links (${filteredVideos.length})`}
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="rounded-2xl border border-gray-800/30 p-4 mb-4" style={{ backgroundColor: "#18181b" }}>
            <div className="flex flex-wrap items-center gap-4">
              {/* Platform Filters */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase font-medium">Platform</span>
                {PLATFORMS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => togglePlatform(p.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPlatforms.has(p.key)
                        ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                        : "bg-gray-800/50 text-gray-500 border border-gray-700/30 hover:text-gray-300"
                    }`}
                  >
                    <PlatformIcon platform={p.key} size="sm" />
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-gray-700" />

              {/* Account Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500 uppercase font-medium">Account</span>
                {accounts
                  .filter(acc => selectedPlatforms.has(acc.platform))
                  .map(acc => (
                  <button
                    key={acc.username}
                    onClick={() => toggleAccount(acc.username)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedAccounts.has(acc.username)
                        ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                        : "bg-gray-800/50 text-gray-500 border border-gray-700/30 hover:text-gray-300"
                    }`}
                  >
                    <PlatformIcon platform={acc.platform} size="sm" />
                    @{acc.username}
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-gray-700" />

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase font-medium">Sort</span>
                <button
                  onClick={() => setSortField("views")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortField === "views" ? "bg-purple-600 text-white" : "bg-gray-800/50 text-gray-400 hover:text-white"
                  }`}
                >
                  Most Views
                </button>
                <button
                  onClick={() => setSortField("likes")}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sortField === "likes" ? "bg-purple-600 text-white" : "bg-gray-800/50 text-gray-400 hover:text-white"
                  }`}
                >
                  Most Likes
                </button>
              </div>

              <div className="w-px h-6 bg-gray-700" />

              {/* Limit */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 uppercase font-medium">Show</span>
                {LIMITS.map(limit => (
                  <button
                    key={limit}
                    onClick={() => setDisplayLimit(limit)}
                    className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      displayLimit === limit ? "bg-purple-600 text-white" : "bg-gray-800/50 text-gray-400 hover:text-white"
                    }`}
                  >
                    {limit === "all" ? "All" : limit}
                  </button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Search */}
              <div className="relative">
                <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 border border-gray-800/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50 w-48"
                  style={{ backgroundColor: "#1f1f23" }}
                />
              </div>
            </div>
          </div>

          {/* Videos Table */}
          <div className="rounded-2xl border border-gray-800/30 overflow-hidden" style={{ backgroundColor: "#18181b" }}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <svg className="w-16 h-16 mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-base font-medium text-white">No videos found</p>
                <p className="text-sm mt-2 text-gray-500">
                  {searchTerm ? "Try a different search term" : "Adjust your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-800/50" style={{ backgroundColor: "#1f1f23" }}>
                    <tr>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase w-10">#</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase">Video</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase">Date</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white" onClick={() => setSortField("views")}>
                        Views {sortField === "views" && <span className="text-purple-400">&#9660;</span>}
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase cursor-pointer hover:text-white" onClick={() => setSortField("likes")}>
                        Likes {sortField === "likes" && <span className="text-purple-400">&#9660;</span>}
                      </th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase">Comments</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase">Shares</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase">Saves</th>
                      <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVideos.map((video, index) => (
                      <VideoRow key={video.id} video={video} index={index} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
