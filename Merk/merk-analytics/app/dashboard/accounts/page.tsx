"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import PlatformIcon from "../components/PlatformIcon";
import Image from "next/image";
import { Platform, Account } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const PLATFORMS: { key: Platform; dbName: string; label: string }[] = [
  { key: "tiktok", dbName: "TikTok", label: "TikTok" },
  { key: "instagram", dbName: "Instagram", label: "Instagram" },
  { key: "youtube", dbName: "YouTube", label: "YouTube" },
  { key: "twitter", dbName: "Twitter", label: "Twitter / X" },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AccountsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail] = useState<string>("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAccountUrl, setNewAccountUrl] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const [error, setError] = useState("");
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [fetchingVideos, setFetchingVideos] = useState<Record<string, boolean>>({});
  const [fetchingStats, setFetchingStats] = useState<Record<string, boolean>>({});
  const [fetchingPictures, setFetchingPictures] = useState<Record<string, boolean>>({});
  const [fetchMessage, setFetchMessage] = useState<Record<string, string>>({});
  const supabase = createClient();

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/accounts`);
      const data = await res.json();

      if (data.accounts) {
        const formattedAccounts: Account[] = data.accounts.map((a: any) => ({
          id: a.id,
          platform: a.platform.toLowerCase() as Platform,
          username: a.username,
          url: a.url,
          profile_picture: a.profile_picture || null,
          created_at: a.created_at,
        }));
        setAccounts(formattedAccounts);
      }
    } catch (error) {
      console.error("Error fetching accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Group accounts by platform
  const accountsByPlatform = useMemo(() => {
    const grouped: Record<string, Account[]> = {};
    PLATFORMS.forEach((p) => {
      grouped[p.key] = accounts.filter((a) => a.platform === p.key);
    });
    return grouped;
  }, [accounts]);

  const handleAddAccount = async () => {
    if (!newAccountUrl.trim()) {
      setError("Please enter a URL");
      return;
    }

    setAddingAccount(true);
    setError("");

    try {
      let platform: Platform = "tiktok";
      let username = "";

      if (newAccountUrl.includes("tiktok.com")) {
        platform = "tiktok";
        const match = newAccountUrl.match(/@([^/?]+)/);
        username = match ? match[1] : "";
      } else if (newAccountUrl.includes("instagram.com")) {
        platform = "instagram";
        const match = newAccountUrl.match(/instagram\.com\/([^/?]+)/);
        username = match ? match[1] : "";
      } else if (newAccountUrl.includes("youtube.com")) {
        platform = "youtube";
        const match = newAccountUrl.match(/youtube\.com\/@?([^/?]+)/);
        username = match ? match[1] : "";
      } else if (newAccountUrl.includes("twitter.com") || newAccountUrl.includes("x.com")) {
        platform = "twitter";
        const match = newAccountUrl.match(/(?:twitter|x)\.com\/([^/?]+)/);
        username = match ? match[1] : "";
      } else {
        setError("Unsupported platform. Use TikTok, Instagram, YouTube, or Twitter/X URLs.");
        setAddingAccount(false);
        return;
      }

      if (!username) {
        setError("Could not extract username from URL");
        setAddingAccount(false);
        return;
      }

      const dbPlatform = PLATFORMS.find((p) => p.key === platform)?.dbName || platform;

      const res = await fetch(`${API_BASE}/api/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: dbPlatform,
          username: username,
          url: newAccountUrl,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to add account");
      } else {
        setNewAccountUrl("");
        setShowAddModal(false);
        fetchAccounts();
        // Re-fetch after delay to pick up the profile picture (scraped in background)
        setTimeout(() => fetchAccounts(), 5000);
      }
    } catch (err) {
      setError("An error occurred while adding the account");
    } finally {
      setAddingAccount(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("Are you sure you want to delete this account? All associated videos will also be deleted.")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/accounts/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchAccounts();
      } else {
        console.error("Error deleting account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) {
      setError("Paste at least one URL");
      return;
    }

    setBulkAdding(true);
    setError("");
    setBulkResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/accounts/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bulkText }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to import accounts");
      } else {
        setBulkResult({ imported: data.imported, skipped: data.skipped });
        if (data.imported > 0) {
          fetchAccounts();
          setTimeout(() => fetchAccounts(), 5000);
        }
      }
    } catch (err) {
      setError("An error occurred during bulk import");
    } finally {
      setBulkAdding(false);
    }
  };

  const startSSEFetch = async (platform: string, endpoint: string, setLoading: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => {
    setLoading((prev) => ({ ...prev, [platform]: true }));
    setFetchMessage((prev) => ({ ...prev, [platform]: "Starting..." }));

    try {
      const res = await fetch(`${API_BASE}/api/apify/${endpoint}?platform=${platform}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        setFetchMessage((prev) => ({ ...prev, [platform]: err.error || "Failed" }));
        setLoading((prev) => ({ ...prev, [platform]: false }));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) { setLoading((prev) => ({ ...prev, [platform]: false })); return; }

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              setFetchMessage((prev) => ({ ...prev, [platform]: data.message }));
              if (data.type === "done" || data.type === "error") {
                setLoading((prev) => ({ ...prev, [platform]: false }));
              }
            } catch (e) {}
          }
        }
      }
    } catch (e: any) {
      setFetchMessage((prev) => ({ ...prev, [platform]: "Connection error" }));
    } finally {
      setLoading((prev) => ({ ...prev, [platform]: false }));
    }
  };

  const handleFetchVideos = (platform: string) => {
    startSSEFetch(platform, "fetch-videos", setFetchingVideos);
  };

  const handleFetchStats = (platform: string) => {
    startSSEFetch(platform, "fetch-stats", setFetchingStats);
  };

  const handleFetchPictures = async (platformKey: string) => {
    const dbName = PLATFORMS.find((p) => p.key === platformKey)?.dbName || platformKey;
    setFetchingPictures((prev) => ({ ...prev, [platformKey]: true }));
    setFetchMessage((prev) => ({ ...prev, [platformKey]: "Fetching profile pictures..." }));

    try {
      const res = await fetch(`${API_BASE}/api/accounts/fetch-pictures`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: dbName }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFetchMessage((prev) => ({ ...prev, [platformKey]: data.error || "Failed" }));
      } else {
        setFetchMessage((prev) => ({ ...prev, [platformKey]: `Done: ${data.updated} updated, ${data.failed} failed` }));
        fetchAccounts();
      }
    } catch (e) {
      setFetchMessage((prev) => ({ ...prev, [platformKey]: "Connection error" }));
    } finally {
      setFetchingPictures((prev) => ({ ...prev, [platformKey]: false }));
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#111114" }}>
      <Sidebar isOpen={sidebarOpen} userEmail={userEmail} />

      <main className="flex-1 overflow-auto" style={{ backgroundColor: "#111114" }}>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">All Accounts</h1>
              <p className="text-sm text-gray-400 mt-1">
                {accounts.length} accounts tracked across {PLATFORMS.filter((p) => accountsByPlatform[p.key].length > 0).length} platforms
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-purple-600 hover:bg-purple-600/20 rounded-lg text-purple-400 hover:text-white font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Bulk Add
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Account
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {PLATFORMS.map((platform) => {
                const platformAccounts = accountsByPlatform[platform.key];
                const isLoadingVideos = fetchingVideos[platform.key];
                const isLoadingStats = fetchingStats[platform.key];
                const isLoadingPictures = fetchingPictures[platform.key];
                const message = fetchMessage[platform.key];

                return (
                  <div
                    key={platform.key}
                    className="rounded-2xl border border-gray-800/30 overflow-hidden"
                    style={{ backgroundColor: "#18181b" }}
                  >
                    {/* Platform Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800/30" style={{ backgroundColor: "#1f1f23" }}>
                      <div className="flex items-center gap-3">
                        <PlatformIcon platform={platform.key} size="lg" />
                        <div>
                          <h2 className="text-lg font-semibold text-white">{platform.label}</h2>
                          <p className="text-xs text-gray-500">{platformAccounts.length} account{platformAccounts.length !== 1 ? "s" : ""}</p>
                        </div>
                      </div>

                      {platformAccounts.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleFetchVideos(platform.key)}
                            disabled={isLoadingVideos || isLoadingStats}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingVideos ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                            Fetch Videos
                          </button>
                          <button
                            onClick={() => handleFetchStats(platform.key)}
                            disabled={isLoadingVideos || isLoadingStats}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingStats ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            )}
                            Fetch Stats
                          </button>
                          <button
                            onClick={() => handleFetchPictures(platform.key)}
                            disabled={isLoadingPictures}
                            className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingPictures ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                            Fetch Pictures
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Status message */}
                    {message && (
                      <div className={`px-4 py-2 text-sm border-b border-gray-800/30 ${
                        message.startsWith("Done") ? "text-green-400 bg-green-900/20" :
                        message.includes("ERROR") ? "text-red-400 bg-red-900/20" :
                        "text-purple-300 bg-purple-900/20"
                      }`}>
                        {message}
                      </div>
                    )}

                    {/* Accounts list */}
                    <div className="p-4">
                      {platformAccounts.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No accounts for this platform</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {platformAccounts.map((account) => (
                            <div
                              key={account.id}
                              className="p-3 rounded-xl border border-gray-800/30 hover:border-gray-700 transition-colors flex items-center justify-between"
                              style={{ backgroundColor: "#1f1f23" }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <label className="cursor-pointer relative group flex-shrink-0" title="Click to upload avatar">
                                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const fd = new FormData();
                                    fd.append('file', file);
                                    try {
                                      const res = await fetch(`${API_BASE}/api/accounts/${account.id}/upload-avatar`, { method: 'POST', body: fd });
                                      const data = await res.json();
                                      if (data.success) { fetchAccounts(); }
                                    } catch {}
                                  }} />
                                  {account.profile_picture ? (
                                    <img
                                      src={account.profile_picture}
                                      alt={account.username}
                                      className="w-10 h-10 rounded-full object-cover group-hover:opacity-70 transition-opacity"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-sm group-hover:opacity-70 transition-opacity">
                                      {account.username[0]?.toUpperCase()}
                                    </div>
                                  )}
                                  <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  </div>
                                </label>
                                <div className="min-w-0">
                                  <p className="font-semibold text-white text-sm truncate">
                                    @{account.username.replace(/^@/, "")}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Added {formatDate(account.created_at)}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteAccount(account.id)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors flex-shrink-0"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-full max-w-md mx-4" style={{ backgroundColor: "#1f1f23" }}>
            <h2 className="text-xl font-bold text-white mb-4">Add Account</h2>
            <p className="text-sm text-gray-400 mb-4">
              Enter the profile URL of the account you want to track.
              <br />
              <span className="text-xs text-gray-500">Supported: TikTok, Instagram, YouTube, Twitter/X</span>
            </p>

            <input
              type="url"
              placeholder="https://www.tiktok.com/@username"
              value={newAccountUrl}
              onChange={(e) => setNewAccountUrl(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-4"
              style={{ backgroundColor: "#18181b" }}
            />

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewAccountUrl("");
                  setError("");
                }}
                className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                disabled={addingAccount}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingAccount ? "Adding..." : "Add Account"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Bulk Add Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="rounded-2xl p-6 w-full max-w-lg mx-4" style={{ backgroundColor: "#1f1f23" }}>
            <h2 className="text-xl font-bold text-white mb-2">Bulk Add Accounts</h2>
            <p className="text-sm text-gray-400 mb-4">
              Paste one profile URL per line. Supported: TikTok, Instagram, YouTube, Twitter/X.
            </p>

            <textarea
              placeholder={"https://www.tiktok.com/@username1\nhttps://www.instagram.com/username2\nhttps://www.youtube.com/@username3"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 mb-4 resize-none text-sm font-mono"
              style={{ backgroundColor: "#18181b" }}
            />

            {bulkText.trim() && (
              <p className="text-xs text-gray-500 mb-3">
                {bulkText.trim().split("\n").filter((l) => l.trim()).length} URL(s) detected
              </p>
            )}

            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

            {bulkResult && (
              <div className="mb-4 p-3 rounded-lg bg-green-900/20 border border-green-800/30">
                <p className="text-green-400 text-sm font-medium">
                  {bulkResult.imported} account(s) imported
                  {bulkResult.skipped > 0 && <span className="text-yellow-400"> &middot; {bulkResult.skipped} skipped</span>}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkModal(false);
                  setBulkText("");
                  setError("");
                  setBulkResult(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                {bulkResult ? "Close" : "Cancel"}
              </button>
              <button
                onClick={handleBulkAdd}
                disabled={bulkAdding || !bulkText.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkAdding ? "Importing..." : "Import All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
