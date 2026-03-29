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
      className={`p-4 rounded-xl border ${
        highlighted
          ? "border-purple-500/30"
          : "border-gray-800/30"
      }`}
      style={{ backgroundColor: '#18181b' }}
    >
      <p className="text-sm text-gray-400 font-medium mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{formatValue(value)}</p>
    </div>
  );
}

interface StatsCardsProps {
  stats?: Stat[];
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const defaultStats: Stat[] = [
    { title: "Videos Posted", value: 0, period: "Last 7 Days" },
    { title: "Views", value: 0, period: "Last 7 Days" },
    { title: "Engagement", value: "0%", period: "Last 7 Days" },
    { title: "Likes", value: 0, period: "Last 7 Days" },
    { title: "Comments", value: 0, period: "Last 7 Days" },
    { title: "Shares", value: 0, period: "Last 7 Days" },
    { title: "Saves", value: 0, period: "Last 7 Days" },
  ];

  const displayStats = stats && stats.length > 0 ? stats : defaultStats;

  return (
    <div className="grid grid-cols-7 gap-3">
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
