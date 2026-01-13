// Platform Types
export type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook';

// Analytics Chart Types
export interface ChartData {
  date: string;
  views: number;
}

// Video Types
export interface VideoStats {
  views: string | number;
  engagement: string | number;
  likes: string | number;
  comments: string | number;
}

export interface Video {
  id: number;
  platform: Platform;
  handle: string;
  hashtag: string;
  uploadDate: string;
  stats: VideoStats;
}

// Stats Card Types
export interface Stat {
  title: string;
  value: number | string;
  period?: string;
}

// User Types
export interface User {
  email: string;
  name?: string;
}
