interface HeaderProps {
  onToggleSidebar: () => void;
}

export default function Header({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="border-b border-gray-800/50 p-6" style={{ backgroundColor: '#111114' }}>
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="text-xl font-semibold text-white ml-3">Dashboard</h1>
      </div>
    </header>
  );
}
