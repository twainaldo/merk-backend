"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartData } from "../types";

interface AnalyticsChartProps {
  data?: ChartData[];
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

export default function AnalyticsChart({ data = [] }: AnalyticsChartProps) {
  return (
    <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">Analytics Overview</h2>
        <div className="flex gap-2">
          <button className="px-3 py-1 text-sm bg-purple-500/20 text-purple-400 rounded-lg font-medium">
            Daily
          </button>
          <button className="px-3 py-1 text-sm text-gray-400 hover:bg-gray-800 rounded-lg font-medium">
            Cumulative
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative">
          {/* Watermark */}
          <div className="absolute top-2 right-2 flex items-center gap-2 text-gray-600 z-10">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10" opacity="0.3"/>
            </svg>
            <span className="text-xs font-medium">Merk</span>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="views"
                stroke="#9333ea"
                strokeWidth={2}
                dot={{ fill: '#9333ea', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
