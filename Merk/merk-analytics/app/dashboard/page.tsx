"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import AnalyticsChart from "./components/AnalyticsChart";
import ViralVideos from "./components/ViralVideos";
import { Platform } from "./types";

// Données réelles (vides par défaut)
const chartData: { date: string; views: number }[] = [];
const viralVideos: any[] = [];

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUser();
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

        <div className="p-6">
          <StatsCards />
          <AnalyticsChart data={chartData} />
          <ViralVideos videos={viralVideos} selectedPlatform={selectedPlatform} />
        </div>
      </main>
    </div>
  );
}
