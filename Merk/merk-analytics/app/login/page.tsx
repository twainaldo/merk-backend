"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const VALID_CODE = "avici98lucy";

export default function LoginPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (code === VALID_CODE) {
      document.cookie = `access_code=${code}; path=/; max-age=${60 * 60 * 24 * 30}`;
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Invalid access code");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8" style={{ backgroundColor: '#111114' }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image
            src="/merk-white.png"
            alt="Merk Logo"
            width={640}
            height={142}
            className="w-52"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
          Enter access code
        </h2>
        <p className="mt-2 text-center text-sm text-gray-400">
          Enter your access code to continue
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="py-8 px-4 shadow-xl sm:rounded-lg sm:px-10 border border-gray-800" style={{ backgroundColor: '#18181b' }}>
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-300">
                Access Code
              </label>
              <div className="mt-1">
                <input
                  id="code"
                  name="code"
                  type="password"
                  autoComplete="off"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter your code"
                  className="block w-full appearance-none rounded-lg border border-gray-700 px-3 py-2 placeholder-gray-500 shadow-sm focus:border-purple-500 focus:outline-none focus:ring-purple-500 sm:text-sm text-white"
                  style={{ backgroundColor: '#111114' }}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Verifying..." : "Access Dashboard"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
