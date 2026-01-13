import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/merk.png"
              alt="Merk Logo"
              width={200}
              height={70}
              className="h-12 w-auto"
            />
          </div>

          <div className="hidden md:flex items-center gap-8">
            <Link href="#customers" className="text-gray-600 hover:text-gray-900 transition">
              Customers
            </Link>
            <Link href="#pricing" className="text-gray-600 hover:text-gray-900 transition">
              Pricing
            </Link>
            <Link href="#about" className="text-gray-600 hover:text-gray-900 transition">
              About
            </Link>
            <Link href="#contact" className="text-gray-600 hover:text-gray-900 transition">
              Contact
            </Link>
            <Link href="/dashboard" className="text-gray-900 font-medium hover:text-gray-700 transition">
              Login
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex px-4 items-center justify-center min-h-[600px]" style={{ height: 'calc(100vh - 80px)' }}>
        <div className="max-w-7xl w-full mx-auto">
          <div className="flex flex-col sm:flex-row gap-6 md:gap-8 lg:gap-12 items-start md:items-center">
            {/* Left Content */}
            <div className="flex-shrink-0 w-full sm:w-auto sm:min-w-[300px] sm:max-w-[400px] md:max-w-[450px] lg:max-w-[500px] space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-b from-slate-800 to-slate-600 bg-clip-text text-transparent leading-tight mt-8 tracking-tight">
                Scale Viral{' '}
                <span className="hidden md:inline lg:hidden"><br /></span>
                Strategies{' '}
                <span className="hidden lg:inline"><br /></span>
                <span className="hidden md:inline lg:hidden"><br /></span>
                Like Clockwork.
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                Analyze short-form performance from any accounts (including those you don&apos;t own) in one fast, structured, and synced dashboard.
              </p>
              <div className="pt-2 flex items-center gap-4">
                <Link href="/dashboard">
                  <button className="min-h-[56px] h-14 min-w-[160px] px-8 py-4 text-lg font-semibold bg-gradient-to-br from-[#8B7EE8] to-[#6952F2] text-white rounded-2xl shadow-xl hover:shadow-2xl hover:from-[#9B8FEA] hover:to-[#7B65F3] transition-all duration-300 ease-out flex items-center gap-2">
                    Start Tracking
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                      <path d="M4.5 12h15m0 0-5.625-6m5.625 6-5.625 6"></path>
                    </svg>
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Content - Landing Image */}
            <div className="hidden md:block w-full md:max-w-[50vw] lg:max-w-[60vw] xl:max-w-[800px]">
              <Image
                src="/landing-pic.jpg"
                alt="Analytics Dashboard"
                width={700}
                height={500}
                className="w-full h-auto rounded-2xl shadow-2xl"
                priority
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
