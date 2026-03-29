"use client";

import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartData } from "../types";

interface AnalyticsChartProps {
  data?: ChartData[];
}

function formatViews(value: number): string {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M";
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(1) + "K";
  }
  return value.toString();
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
      <svg className="w-16 h-16 mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p className="text-sm font-medium text-white">No data available</p>
      <p className="text-xs mt-1 text-gray-500">Analytics data will appear here once you connect your accounts</p>
    </div>
  );
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg p-3 border border-gray-700" style={{ backgroundColor: '#1f1f23' }}>
        <p className="text-gray-400 text-sm mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-400">{entry.name}:</span>
            <span className="text-white font-semibold">
              {entry.name === "Views" ? formatViews(entry.value) : entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function AnalyticsChart({ data = [] }: AnalyticsChartProps) {
  return (
    <div className="p-6 rounded-xl border border-gray-800/50 mb-8" style={{ backgroundColor: '#18181b' }}>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white">Analytics Overview</h2>
      </div>

      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="date"
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={{ stroke: '#27272a' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={{ stroke: '#27272a' }}
                tickFormatter={formatViews}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#6b7280"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                axisLine={{ stroke: '#27272a' }}
                tickLine={{ stroke: '#27272a' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
              />
              <Bar
                yAxisId="right"
                dataKey="videos"
                name="Videos"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="views"
                name="Views"
                stroke="#9333ea"
                strokeWidth={3}
                dot={{ fill: '#9333ea', r: 4, strokeWidth: 0 }}
                activeDot={{ fill: '#9333ea', r: 6, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
