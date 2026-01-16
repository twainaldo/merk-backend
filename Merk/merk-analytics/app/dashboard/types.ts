// Platform Types
export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook';

// Analytics Chart Types
export interface ChartData {
  date: string;
  views: number;
}

// Video Types
export interface VideoStats {
  views: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface Video {
  id: number;
  video_id: string;
  video_url: string;
  platform: Platform;
  handle: string;
  description: string;
  hashtags: string;
  uploadDate: string;
  thumbnailUrl: string;
  duration: number;
  stats: VideoStats;
}

// Account Types
export interface Account {
  id: number;
  platform: Platform;
  username: string;
  url: string;
  created_at: string;
}

// Stats Card Types
export interface Stat {
  title: string;
  value: number | string;
  change?: number;
  period?: string;
}

// Hourly Stats Types
export interface HourlyStats {
  id: number;
  account_id: number;
  timestamp: string;
  total_videos: number;
  total_views: number;
  delta_videos: number;
  delta_views: number;
  followers: number;
  likes: number;
}

// User Types
export interface User {
  email: string;
  name?: string;
}
