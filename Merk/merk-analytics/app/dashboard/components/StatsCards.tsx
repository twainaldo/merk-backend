"use client";

import { Stat } from "../types";

interface StatCardProps {
  title: string;
  value: number | string;
  period?: string;
  highlighted?: boolean;
}

function formatValue(value: number | string): string {
  if (typeof value === "string") return value;
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toLocaleString();
}

function StatCard({ title, value, period = "Last 7 Days", highlighted = false }: StatCardProps) {
  return (
    <div
      className={`bg-gray-900/50 backdrop-blur-sm p-5 rounded-xl transition-all duration-200 hover:bg-gray-900 ${
        highlighted
          ? "border-2 border-purple-500/50 shadow-lg shadow-purple-500/10"
          : "border border-gray-800/50 hover:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        {period && <span className="text-[10px] text-gray-600 font-medium">{period}</span>}
      </div>
      <p className="text-2xl font-bold text-white">{formatValue(value)}</p>
    </div>
  );
}

interface StatsCardsProps {
  stats?: Stat[];
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const defaultStats: Stat[] = [
    { title: "Views", value: 0, period: "Last 7 Days" },
    { title: "Engagement", value: "0%", period: "Last 7 Days" },
    { title: "Likes", value: 0, period: "Last 7 Days" },
    { title: "Comments", value: 0, period: "Last 7 Days" },
    { title: "Shares", value: 0, period: "Last 7 Days" },
    { title: "Saves", value: 0, period: "Last 7 Days" },
  ];

  const displayStats = stats && stats.length > 0 ? stats : defaultStats;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {displayStats.map((stat, index) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          period={stat.period}
          highlighted={index === 0}
        />
      ))}
    </div>
  );
}
