interface StatCardProps {
  title: string;
  value: number | string;
  period?: string;
  highlighted?: boolean;
}

function StatCard({ title, value, period = "Last 7 Days", highlighted = false }: StatCardProps) {
  return (
    <div className={`bg-gray-900 p-6 rounded-xl ${
      highlighted
        ? 'border-2 border-purple-500 shadow-lg shadow-purple-500/20'
        : 'border border-gray-800'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-400 font-medium">{title}</p>
        {period && <span className="text-xs text-gray-500 font-medium">{period}</span>}
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function StatsCards() {
  const stats = [
    { title: "Views", value: 0, highlighted: true },
    { title: "Engagement", value: 0 },
    { title: "Likes", value: 0 },
    { title: "Comments", value: 0 },
    { title: "Shares", value: 0 },
    { title: "Saves", value: 0, period: "" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {stats.map((stat) => (
        <StatCard
          key={stat.title}
          title={stat.title}
          value={stat.value}
          period={stat.period}
          highlighted={stat.highlighted}
        />
      ))}
    </div>
  );
}
