import PlatformIcon from "./PlatformIcon";
import { Platform } from "../types";

interface HeaderProps {
  onToggleSidebar: () => void;
  selectedPlatform: Platform | null;
  onPlatformChange: (platform: Platform | null) => void;
}

export default function Header({ onToggleSidebar, selectedPlatform, onPlatformChange }: HeaderProps) {
  const platformLabels: Record<Platform, string> = {
    tiktok: 'TikTok',
    instagram: 'Instagram',
    youtube: 'YouTube',
    facebook: 'Facebook',
  };

  const displayLabel = selectedPlatform ? platformLabels[selectedPlatform] : 'All Platforms';
  return (
    <header className="bg-gray-900 border-b border-gray-800 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="relative">
            <select className="pl-4 pr-8 py-2 border border-gray-700 rounded-lg text-sm text-white font-medium appearance-none bg-gray-800">
              <option>Select Collections</option>
              <option>Default</option>
            </select>
            <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="flex items-center gap-1 px-3 py-2 border border-gray-700 rounded-lg text-sm text-white font-medium bg-gray-800">
            <span>All Accounts</span>
            <button className="ml-1 p-0.5 hover:bg-gray-700 rounded">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-2 border border-gray-700 rounded-lg text-sm text-white font-medium bg-gray-800 hover:bg-gray-700">
              {selectedPlatform && <PlatformIcon platform={selectedPlatform} size="sm" />}
              <span>{displayLabel}</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {/* Platform Dropdown */}
            <div className="hidden group-hover:block absolute top-full mt-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[200px]">
              <div className="p-2 space-y-1">
                <button
                  onClick={() => onPlatformChange(null)}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white hover:bg-gray-700 rounded-lg"
                >
                  <span>All Platforms</span>
                </button>
                <button
                  onClick={() => onPlatformChange('tiktok')}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white hover:bg-gray-700 rounded-lg"
                >
                  <PlatformIcon platform="tiktok" size="sm" />
                  <span>TikTok</span>
                </button>
                <button
                  onClick={() => onPlatformChange('instagram')}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white hover:bg-gray-700 rounded-lg"
                >
                  <PlatformIcon platform="instagram" size="sm" />
                  <span>Instagram</span>
                </button>
                <button
                  onClick={() => onPlatformChange('youtube')}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white hover:bg-gray-700 rounded-lg"
                >
                  <PlatformIcon platform="youtube" size="sm" />
                  <span>YouTube</span>
                </button>
                <button
                  onClick={() => onPlatformChange('facebook')}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-white hover:bg-gray-700 rounded-lg"
                >
                  <PlatformIcon platform="facebook" size="sm" />
                  <span>Facebook</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 px-3 py-2 border border-gray-700 rounded-lg text-sm text-white font-medium bg-gray-800">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>02/01/2026 - 08/01/2026</span>
            <button className="ml-1 p-0.5 hover:bg-gray-700 rounded">
              <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="relative">
            <select className="pl-4 pr-8 py-2 border border-gray-700 rounded-lg text-sm text-white font-medium appearance-none bg-gray-800">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
            <svg className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm font-medium text-white hover:bg-gray-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
