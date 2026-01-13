# Dashboard Structure

This directory contains the dashboard page and its components.

## Structure

```
dashboard/
├── components/          # Reusable dashboard components
│   ├── Sidebar.tsx     # Navigation sidebar with user info
│   ├── Header.tsx      # Dashboard header with filters
│   ├── StatsCards.tsx  # Statistics cards (views, likes, etc.)
│   ├── AnalyticsChart.tsx  # Analytics chart component
│   └── ViralVideos.tsx # Viral videos list component
├── types.ts            # TypeScript type definitions
├── page.tsx            # Main dashboard page
└── README.md           # This file

## Components

### Sidebar
- Displays user email and profile
- Navigation menu
- Collections management

**Props:**
- `isOpen: boolean` - Controls sidebar visibility
- `userEmail: string` - User's email address

### Header
- Filter controls (collections, accounts, platforms)
- Date range selector
- Export button

**Props:**
- `onToggleSidebar: () => void` - Callback to toggle sidebar

### StatsCards
- Displays key metrics (views, engagement, likes, comments, shares, saves)
- Grid layout responsive design

**Props:** None (uses internal data)

### AnalyticsChart
- Line chart showing analytics over time
- Empty state when no data available

**Props:**
- `data?: ChartData[]` - Chart data array

### ViralVideos
- Lists most viral videos
- Shows video stats
- Empty state when no videos

**Props:**
- `videos?: Video[]` - Array of viral videos

## Types

All TypeScript types are centralized in `types.ts`:
- `ChartData` - Analytics chart data structure
- `Video` - Video object structure
- `VideoStats` - Video statistics
- `Stat` - Statistics card data
- `User` - User information

## Usage

The main dashboard page (`page.tsx`) orchestrates all components:

```tsx
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatsCards from "./components/StatsCards";
import AnalyticsChart from "./components/AnalyticsChart";
import ViralVideos from "./components/ViralVideos";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} userEmail={userEmail} />
      <main className="flex-1 overflow-auto">
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="p-6">
          <StatsCards />
          <AnalyticsChart data={chartData} />
          <ViralVideos videos={viralVideos} />
        </div>
      </main>
    </div>
  );
}
```

## Features

- 🔐 Authentication with Supabase
- 📊 Real-time analytics (when data is available)
- 📱 Responsive design
- 🎨 Clean, modern UI with Tailwind CSS
- 📈 Charts with Recharts library
- ✅ TypeScript for type safety
