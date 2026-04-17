"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import PlatformIcon from "./components/PlatformIcon";
import ViralVideos from "./components/ViralVideos";
import { Video, Platform, Account } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Period = "1d" | "3d" | "7d" | "14d" | "21d" | "1m" | "3m" | "6m" | "12m" | "all";

const PERIODS: { key: Period; label: string; short: string }[] = [
  { key: "1d", label: "Today", short: "1D" },
  { key: "3d", label: "3 Days", short: "3D" },
  { key: "7d", label: "7 Days", short: "7D" },
  { key: "14d", label: "14 Days", short: "14D" },
  { key: "21d", label: "21 Days", short: "21D" },
  { key: "1m", label: "1 Month", short: "1M" },
  { key: "3m", label: "3 Months", short: "3M" },
  { key: "6m", label: "6 Months", short: "6M" },
  { key: "12m", label: "12 Months", short: "12M" },
  { key: "all", label: "Since Jan 2025", short: "ALL" },
];

function getPeriodDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "1d": { const d = new Date(); d.setDate(d.getDate() - 1); return d; }
    case "3d": { const d = new Date(); d.setDate(d.getDate() - 3); return d; }
    case "7d": { const d = new Date(); d.setDate(d.getDate() - 7); return d; }
    case "14d": { const d = new Date(); d.setDate(d.getDate() - 14); return d; }
    case "21d": { const d = new Date(); d.setDate(d.getDate() - 21); return d; }
    case "1m": { const d = new Date(); d.setMonth(d.getMonth() - 1); return d; }
    case "3m": { const d = new Date(); d.setMonth(d.getMonth() - 3); return d; }
    case "6m": { const d = new Date(); d.setMonth(d.getMonth() - 6); return d; }
    case "12m": { const d = new Date(); d.setMonth(d.getMonth() - 12); return d; }
    case "all": return new Date("2025-01-01");
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toLocaleString();
}

interface PeriodStats {
  videos: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  engagement: string;
  avgViewsPerVideo: number;
  avgLikesPerVideo: number;
  videosPerDay: string;
}

function calcStats(videos: Video[], period: Period): PeriodStats {
  const views = videos.reduce((s, v) => s + v.stats.views, 0);
  const likes = videos.reduce((s, v) => s + v.stats.likes, 0);
  const comments = videos.reduce((s, v) => s + v.stats.comments, 0);
  const shares = videos.reduce((s, v) => s + v.stats.shares, 0);
  const saves = videos.reduce((s, v) => s + v.stats.saves, 0);
  const engagement = views > 0
    ? ((likes + comments + shares) / views * 100).toFixed(2)
    : "0.00";
  const avgViewsPerVideo = videos.length > 0 ? Math.round(views / videos.length) : 0;
  const avgLikesPerVideo = videos.length > 0 ? Math.round(likes / videos.length) : 0;

  // Calculate days in period
  const cutoff = getPeriodDate(period);
  const now = new Date();
  const days = Math.max(1, Math.round((now.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24)));
  const videosPerDay = (videos.length / days).toFixed(1);

  return { videos: videos.length, views, likes, comments, shares, saves, engagement, avgViewsPerVideo, avgLikesPerVideo, videosPerDay };
}

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedPlatforms] = useState<Set<string>>(new Set(["tiktok", "instagram", "youtube", "twitter"]));
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [allAccountsSelected, setAllAccountsSelected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState<Period>("all");
  const [fetchingAll, setFetchingAll] = useState(false);
  const [fetchLog, setFetchLog] = useState("");
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
          // Only set all accounts if no saved selection in localStorage
          const saved = localStorage.getItem("merk_selected_accounts");
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setSelectedAccounts(new Set(parsed));
                setAllAccountsSelected(false);
              } else {
                setSelectedAccounts(new Set(accs.map((a: Account) => String(a.id))));
              }
            } catch {
              setSelectedAccounts(new Set(accs.map((a: Account) => String(a.id))));
            }
          } else {
            setSelectedAccounts(new Set(accs.map((a: Account) => String(a.id))));
          }
        }

        // Fetch ALL videos with pagination (no limit)
        let videosData: any[] = [];
        let from = 0;
        const BATCH = 1000;
        while (true) {
          const { data, error: fetchErr } = await supabase
            .from("videos")
            .select(`
              id, video_id, video_url, views, likes, comments, shares, saves,
              duration, published_date, description, hashtags, thumbnail_url,
              accounts ( id, platform, username )
            `)
            .order("views", { ascending: false })
            .range(from, from + BATCH - 1);

          if (fetchErr) { console.error("Error fetching videos:", fetchErr); break; }
          if (!data || data.length === 0) break;
          videosData = videosData.concat(data);
          if (data.length < BATCH) break;
          from += BATCH;
        }

        if (videosData.length > 0) {
          setAllVideos(videosData.map((v: any) => ({
            id: v.id,
            video_id: v.video_id || "",
            video_url: v.video_url || "",
            account_id: v.accounts?.id || 0,
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

  // Base filtered videos (by platform + account selection)
  const baseFilteredVideos = useMemo(() => {
    return allVideos.filter((v) => {
      if (!selectedPlatforms.has(v.platform)) return false;
      if (!allAccountsSelected && !selectedAccounts.has(String(v.account_id))) return false;
      return true;
    });
  }, [allVideos, selectedPlatforms, selectedAccounts, allAccountsSelected]);

  // Stats per period
  const periodData = useMemo(() => {
    const result: Record<Period, PeriodStats> = {} as any;
    for (const p of PERIODS) {
      const cutoff = getPeriodDate(p.key);
      const filtered = baseFilteredVideos.filter((v) => {
        if (!v.uploadDate) return p.key === "all";
        return new Date(v.uploadDate) >= cutoff;
      });
      result[p.key] = calcStats(filtered, p.key);
    }
    return result;
  }, [baseFilteredVideos]);

  // Filtered videos for active period
  const filteredVideos = useMemo(() => {
    const cutoff = getPeriodDate(activePeriod);
    return baseFilteredVideos.filter((v) => {
      if (!v.uploadDate) return activePeriod === "all";
      return new Date(v.uploadDate) >= cutoff;
    });
  }, [baseFilteredVideos, activePeriod]);

  const toggleAccount = (accountId: string) => {
    setAllAccountsSelected(false);
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId); else next.add(accountId);
      localStorage.setItem("merk_selected_accounts", JSON.stringify([...next]));
      return next;
    });
  };

  const selectAllAccounts = () => {
    setAllAccountsSelected(true);
    setSelectedAccounts(new Set(accounts.map((a) => String(a.id))));
    localStorage.removeItem("merk_selected_accounts");
  };

  const activeStats = periodData[activePeriod] || calcStats([], "all");

  // Chart data: group videos by time bucket based on active period
  const chartData = useMemo(() => {
    if (filteredVideos.length === 0) return [];

    // Decide grouping: daily for 1d/7d, weekly for 1m/3m, monthly for 6m/12m/all
    const groupBy = ["1d", "3d", "7d", "14d", "21d"].includes(activePeriod) ? "day"
      : ["1m", "3m", "all"].includes(activePeriod) ? "week" : "month";

    const buckets: Record<string, { videos: number; views: number; likes: number }> = {};

    filteredVideos.forEach((v) => {
      const d = new Date(v.uploadDate);
      let key: string;
      if (groupBy === "day") {
        key = d.toISOString().split("T")[0]; // YYYY-MM-DD
      } else if (groupBy === "week") {
        // Start of week (Monday)
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        key = monday.toISOString().split("T")[0];
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
      if (!buckets[key]) buckets[key] = { videos: 0, views: 0, likes: 0 };
      buckets[key].videos++;
      buckets[key].views += v.stats.views;
      buckets[key].likes += v.stats.likes;
    });

    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        // Format label
        let label: string;
        if (groupBy === "day") {
          label = new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } else if (groupBy === "week") {
          label = "W " + new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        } else {
          const [y, m] = date.split("-");
          label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
        }
        return { date: label, ...data };
      });
  }, [filteredVideos, activePeriod]);

  const [chartMetrics, setChartMetrics] = useState<Set<string>>(new Set(["views", "videos", "likes"]));
  const [dateFrom, setDateFrom] = useState("2025-01-01");
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  // Sync date range when period changes
  useEffect(() => {
    const cutoff = getPeriodDate(activePeriod);
    setDateFrom(cutoff.toISOString().split("T")[0]);
    setDateTo(new Date().toISOString().split("T")[0]);
  }, [activePeriod]);

  const toggleChartMetric = (m: string) => {
    setChartMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(m)) { if (next.size > 1) next.delete(m); } else next.add(m);
      return next;
    });
  };

  const STAT_ROWS: { label: string; key: string; format: (stats: PeriodStats) => string }[] = [
    { label: "Videos", key: "videos", format: (s) => formatNumber(s.videos) },
    { label: "Videos / Day", key: "videosPerDay", format: (s) => s.videosPerDay },
    { label: "Views", key: "views", format: (s) => formatNumber(s.views) },
    { label: "Avg Views / Video", key: "avgViewsPerVideo", format: (s) => formatNumber(s.avgViewsPerVideo) },
    { label: "Likes", key: "likes", format: (s) => formatNumber(s.likes) },
    { label: "Avg Likes / Video", key: "avgLikesPerVideo", format: (s) => formatNumber(s.avgLikesPerVideo) },
    { label: "Comments", key: "comments", format: (s) => formatNumber(s.comments) },
    { label: "Shares", key: "shares", format: (s) => formatNumber(s.shares) },
    { label: "Saves", key: "saves", format: (s) => formatNumber(s.saves) },
    { label: "Engagement Rate", key: "engagement", format: (s) => s.engagement + "%" },
  ];

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#111114" }}>
      <Sidebar isOpen={sidebarOpen} userEmail="" />

      <main className="flex-1 overflow-auto" style={{ backgroundColor: "#111114" }}>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {/* Period selector + Fetch All */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setActivePeriod(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      activePeriod === p.key
                        ? "bg-purple-600 text-white"
                        : "text-gray-400 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  {fetchLog && (
                    <span className="text-xs text-gray-400 max-w-[300px] truncate">{fetchLog}</span>
                  )}
                  <button
                    disabled={fetchingAll}
                    onClick={async () => {
                      setFetchingAll(true);
                      setFetchLog("Starting...");
                      try {
                        const res = await fetch(`${API_BASE}/api/apify/fetch-all`);
                        const reader = res.body?.getReader();
                        if (!reader) throw new Error("No stream");
                        const decoder = new TextDecoder();
                        let buf = "";
                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;
                          buf += decoder.decode(value, { stream: true });
                          const lines = buf.split("\n");
                          buf = lines.pop() || "";
                          for (const line of lines) {
                            if (line.startsWith("data: ")) {
                              try {
                                const d = JSON.parse(line.slice(6));
                                if (d.message) setFetchLog(d.message);
                                if (d.type === "done" || d.type === "error") {
                                  setFetchingAll(false);
                                  setTimeout(() => setFetchLog(""), 5000);
                                }
                              } catch {}
                            }
                          }
                        }
                        setFetchingAll(false);
                      } catch (e: any) {
                        setFetchLog("Error: " + e.message);
                        setFetchingAll(false);
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      fetchingAll
                        ? "bg-green-600/30 text-green-300 cursor-wait"
                        : "bg-green-600 hover:bg-green-700 text-white"
                    }`}
                  >
                    {fetchingAll ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {fetchingAll ? "Fetching..." : "Fetch All New"}
                  </button>
                </div>
              </div>

              {/* Account filters */}
              <div className="rounded-2xl border border-gray-800/30 p-4" style={{ backgroundColor: "#18181b" }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 uppercase font-medium tracking-wider">Accounts</span>
                  {!allAccountsSelected && (
                    <button
                      onClick={selectAllAccounts}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      Select all
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => toggleAccount(String(account.id))}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors border ${
                        allAccountsSelected || selectedAccounts.has(String(account.id))
                          ? "border-purple-500/50 bg-purple-500/10 text-white"
                          : "border-gray-700 text-gray-500 opacity-50"
                      }`}
                    >
                      <div className="relative">
                        {account.profile_picture ? (
                          <img
                            src={account.profile_picture}
                            alt={account.username}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-[10px] text-white font-bold">
                            {account.username[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <PlatformIcon platform={account.platform} size="sm" />
                        </div>
                      </div>
                      @{account.username.replace(/^@/, "")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Big stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { label: "Videos", value: formatNumber(activeStats.videos), accent: true },
                  { label: "Views", value: formatNumber(activeStats.views) },
                  { label: "Likes", value: formatNumber(activeStats.likes) },
                  { label: "Videos / Day", value: activeStats.videosPerDay },
                  { label: "Avg Views", value: formatNumber(activeStats.avgViewsPerVideo) },
                  { label: "Avg Likes", value: formatNumber(activeStats.avgLikesPerVideo) },
                  { label: "Engagement", value: activeStats.engagement + "%" },
                ].map((card, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl border p-4 ${card.accent ? "border-purple-500/30" : "border-gray-800/30"}`}
                    style={{ backgroundColor: "#18181b" }}
                  >
                    <p className="text-xs text-gray-400">{card.label}</p>
                    <p className="text-2xl font-bold text-white mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="rounded-2xl border border-gray-800/30 overflow-hidden" style={{ backgroundColor: "#18181b" }}>
                <div className="flex items-center justify-between p-4 border-b border-gray-800/30" style={{ backgroundColor: "#1f1f23" }}>
                  <h2 className="text-lg font-semibold text-white">Analytics</h2>
                  <div className="flex items-center gap-1">
                    {([
                      { key: "views", color: "#9333ea", label: "Views" },
                      { key: "videos", color: "#f59e0b", label: "Videos" },
                      { key: "likes", color: "#ef4444", label: "Likes" },
                    ] as const).map((m) => (
                      <button
                        key={m.key}
                        onClick={() => toggleChartMetric(m.key)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                          chartMetrics.has(m.key)
                            ? "border-gray-600 text-white"
                            : "border-gray-800 text-gray-500 opacity-50"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartMetrics.has(m.key) ? m.color : "#4b5563" }} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  {chartData.length === 0 ? (
                    <div className="flex items-center justify-center h-[280px] text-gray-500 text-sm">
                      No data for this period
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gradientViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#9333ea" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#9333ea" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradientVideos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradientLikes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                          axisLine={{ stroke: "#27272a" }}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="#6b7280"
                          tick={{ fill: "#6b7280", fontSize: 11 }}
                          axisLine={{ stroke: "#27272a" }}
                          tickLine={false}
                          tickFormatter={(v: number) => {
                            if (v >= 1000000) return (v / 1000000).toFixed(1) + "M";
                            if (v >= 1000) return (v / 1000).toFixed(0) + "K";
                            return v.toString();
                          }}
                        />
                        {chartMetrics.has("videos") && (
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#6b7280"
                            tick={{ fill: "#6b7280", fontSize: 11 }}
                            axisLine={{ stroke: "#27272a" }}
                            tickLine={false}
                          />
                        )}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f1f23",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          labelStyle={{ color: "#9ca3af" }}
                          formatter={(value?: number, name?: string) => [formatNumber(value ?? 0), (name ?? "").charAt(0).toUpperCase() + (name ?? "").slice(1)]}
                        />
                        {chartMetrics.has("views") && (
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="views"
                            name="views"
                            stroke="#9333ea"
                            strokeWidth={2}
                            fill="url(#gradientViews)"
                            dot={chartData.length <= 20 ? { r: 3, fill: "#9333ea" } : false}
                          />
                        )}
                        {chartMetrics.has("likes") && (
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="likes"
                            name="likes"
                            stroke="#ef4444"
                            strokeWidth={2}
                            fill="url(#gradientLikes)"
                            dot={chartData.length <= 20 ? { r: 3, fill: "#ef4444" } : false}
                          />
                        )}
                        {chartMetrics.has("videos") && (
                          <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="videos"
                            name="videos"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fill="url(#gradientVideos)"
                            dot={chartData.length <= 20 ? { r: 3, fill: "#f59e0b" } : false}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Date range video explorer */}
              <div className="rounded-2xl border border-gray-800/30 overflow-hidden" style={{ backgroundColor: "#18181b" }}>
                <div className="flex items-center justify-between p-4 border-b border-gray-800/30" style={{ backgroundColor: "#1f1f23" }}>
                  <h2 className="text-lg font-semibold text-white">Video Explorer</h2>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-gray-700 text-white text-xs focus:outline-none focus:border-purple-500"
                      style={{ backgroundColor: "#111114", colorScheme: "dark" }}
                    />
                    <span className="text-gray-500 text-xs">to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-gray-700 text-white text-xs focus:outline-none focus:border-purple-500"
                      style={{ backgroundColor: "#111114", colorScheme: "dark" }}
                    />
                  </div>
                </div>
                <div className="p-4">
                  {(() => {
                    const from = new Date(dateFrom);
                    const to = new Date(dateTo + "T23:59:59");
                    const allDateVideos = baseFilteredVideos
                      .filter((v) => {
                        const d = new Date(v.uploadDate);
                        return d >= from && d <= to;
                      })
                      .sort((a, b) => b.stats.views - a.stats.views);
                    const dateVideos = allDateVideos.slice(0, 100);

                    const totalViews = allDateVideos.reduce((s, v) => s + v.stats.views, 0);
                    const totalLikes = allDateVideos.reduce((s, v) => s + v.stats.likes, 0);

                    return (
                      <>
                        <div className="flex items-center gap-4 mb-4 text-sm">
                          <span className="text-gray-400">{allDateVideos.length.toLocaleString()} video{allDateVideos.length !== 1 ? "s" : ""}{allDateVideos.length > 100 ? " (top 100 shown)" : ""}</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-gray-400">{formatNumber(totalViews)} views</span>
                          <span className="text-gray-600">|</span>
                          <span className="text-gray-400">{formatNumber(totalLikes)} likes</span>
                        </div>
                        {dateVideos.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-6">No videos in this date range</p>
                        ) : (
                          <div className="space-y-2">
                            {dateVideos.map((video, idx) => (
                              <div
                                key={video.id}
                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                              >
                                <span className={`w-6 text-center text-xs font-bold ${
                                  idx === 0 ? "text-yellow-400" : idx === 1 ? "text-gray-300" : idx === 2 ? "text-orange-400" : "text-gray-600"
                                }`}>
                                  {idx + 1}
                                </span>
                                <div className="relative w-12 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                                  {video.thumbnailUrl ? (
                                    <img src={video.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-purple-600/30 to-pink-600/30 flex items-center justify-center">
                                      <svg className="w-4 h-4 text-white/50" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                    </div>
                                  )}
                                  <div className="absolute top-0.5 right-0.5">
                                    <PlatformIcon platform={video.platform} size="sm" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-medium truncate">@{video.handle}</p>
                                  <p className="text-xs text-gray-500 truncate">{video.description || "No description"}</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs flex-shrink-0">
                                  <div className="text-right">
                                    <p className="text-white font-semibold">{formatNumber(video.stats.views)}</p>
                                    <p className="text-gray-500">views</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-white font-semibold">{formatNumber(video.stats.likes)}</p>
                                    <p className="text-gray-500">likes</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-white font-semibold">{formatNumber(video.stats.comments)}</p>
                                    <p className="text-gray-500">comments</p>
                                  </div>
                                  <div className="text-right">
                                    <p className={`font-semibold ${
                                      video.stats.engagement >= 10 ? "text-green-400" :
                                      video.stats.engagement >= 5 ? "text-yellow-400" :
                                      "text-white"
                                    }`}>{video.stats.engagement.toFixed(1)}%</p>
                                    <p className="text-gray-500">eng.</p>
                                  </div>
                                  <p className="text-gray-500 w-16 text-right">
                                    {new Date(video.uploadDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Comparison table */}
              <div className="rounded-2xl border border-gray-800/30 overflow-hidden" style={{ backgroundColor: "#18181b" }}>
                <div className="p-4 border-b border-gray-800/30" style={{ backgroundColor: "#1f1f23" }}>
                  <h2 className="text-lg font-semibold text-white">Performance Breakdown</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800/30" style={{ backgroundColor: "#1f1f23" }}>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-40">
                          Metric
                        </th>
                        {PERIODS.map((p) => (
                          <th
                            key={p.key}
                            className={`py-3 px-3 text-right text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors ${
                              activePeriod === p.key
                                ? "text-purple-400 bg-purple-500/5"
                                : "text-gray-400 hover:text-white"
                            }`}
                            onClick={() => setActivePeriod(p.key)}
                          >
                            {p.short}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {STAT_ROWS.map((row, idx) => (
                        <tr
                          key={row.key}
                          className={`border-b border-gray-800/10 hover:bg-white/5 transition-colors ${
                            idx % 2 === 0 ? "" : "bg-white/[0.02]"
                          }`}
                        >
                          <td className="py-3 px-4 text-sm text-gray-300 font-medium">
                            {row.label}
                          </td>
                          {PERIODS.map((p) => (
                            <td
                              key={p.key}
                              className={`py-3 px-3 text-sm text-right font-mono ${
                                activePeriod === p.key
                                  ? "text-purple-400 bg-purple-500/5 font-semibold"
                                  : "text-gray-300"
                              }`}
                            >
                              {row.format(periodData[p.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top videos for selected period */}
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">
                  Top Videos — {PERIODS.find((p) => p.key === activePeriod)?.label}
                </h2>
                <ViralVideos videos={filteredVideos} limit={3} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
