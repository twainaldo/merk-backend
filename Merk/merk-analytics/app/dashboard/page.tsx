"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import AnalyticsChart from "./components/AnalyticsChart";
import ViralVideos from "./components/ViralVideos";
import { Platform, Video, ChartData, Stat } from "./types";

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
  }, []);

  // Fetch videos and stats from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch videos with account info
        const { data: videosData, error: videosError } = await supabase
          .from("videos")
          .select(`
            id,
            video_id,
            video_url,
            views,
            likes,
            comments,
            shares,
            saves,
            duration,
            published_date,
            description,
            hashtags,
            thumbnail_url,
            accounts (
              id,
              platform,
              username
            )
          `)
          .order("views", { ascending: false })
          .limit(50);

        if (videosError) {
          console.error("Error fetching videos:", videosError);
        } else if (videosData) {
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

          // Calculate total stats
          const totalViews = formattedVideos.reduce((sum, v) => sum + v.stats.views, 0);
          const totalLikes = formattedVideos.reduce((sum, v) => sum + v.stats.likes, 0);
          const totalComments = formattedVideos.reduce((sum, v) => sum + v.stats.comments, 0);
          const totalShares = formattedVideos.reduce((sum, v) => sum + v.stats.shares, 0);
          const totalSaves = formattedVideos.reduce((sum, v) => sum + v.stats.saves, 0);
          const avgEngagement = totalViews > 0
            ? ((totalLikes + totalComments + totalShares) / totalViews * 100).toFixed(2)
            : "0.00";

          setStats([
            { title: "Views", value: totalViews, period: "Last 7 Days" },
            { title: "Engagement", value: `${avgEngagement}%`, period: "Last 7 Days" },
            { title: "Likes", value: totalLikes, period: "Last 7 Days" },
            { title: "Comments", value: totalComments, period: "Last 7 Days" },
            { title: "Shares", value: totalShares, period: "Last 7 Days" },
            { title: "Saves", value: totalSaves, period: "Last 7 Days" },
          ]);
        }

        // Fetch hourly stats for chart
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: hourlyData, error: hourlyError } = await supabase
          .from("hourly_stats")
          .select("timestamp, total_views, delta_views")
          .gte("timestamp", sevenDaysAgo)
          .order("timestamp", { ascending: true });

        if (hourlyError) {
          console.error("Error fetching hourly stats:", hourlyError);
        } else if (hourlyData && hourlyData.length > 0) {
          // Group by day
          const byDay: Record<string, { views: number; count: number }> = {};
          hourlyData.forEach((stat: any) => {
            const day = stat.timestamp.split("T")[0];
            if (!byDay[day]) {
              byDay[day] = { views: 0, count: 0 };
            }
            byDay[day].views += stat.total_views || 0;
            byDay[day].count++;
          });

          const chartDataFormatted: ChartData[] = Object.entries(byDay).map(([date, data]) => ({
            date,
            views: Math.round(data.views / data.count),
          }));
          setChartData(chartDataFormatted);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="flex h-screen bg-gray-950">
      <Sidebar isOpen={sidebarOpen} userEmail={userEmail} />

      <main className="flex-1 overflow-auto bg-gray-950">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          selectedPlatform={selectedPlatform}
          onPlatformChange={setSelectedPlatform}
        />

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              <StatsCards stats={stats} />
              <AnalyticsChart data={chartData} />
              <ViralVideos
                videos={videos}
                selectedPlatform={selectedPlatform}
                limit={9}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
