"use client";

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import { ApifyKey } from "../types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function SettingsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [keys, setKeys] = useState<ApifyKey[]>([]);
  const [keyCount, setKeyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bulkKeys, setBulkKeys] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/settings/apify-keys`);
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
        setKeyCount(data.count || 0);
      }
    } catch (e) {
      console.error("Failed to fetch keys:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleAddKeys = async () => {
    if (!bulkKeys.trim()) {
      setError("Paste at least one API key");
      return;
    }

    setAdding(true);
    setError("");
    setSuccess("");

    const lines = bulkKeys
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));

    let added = 0;
    let skipped = 0;

    for (const key of lines) {
      try {
        const res = await fetch(`${API_BASE}/api/settings/apify-keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: key }),
        });
        if (res.ok) {
          added++;
        } else {
          skipped++;
        }
      } catch (e) {
        skipped++;
      }
    }

    setBulkKeys("");
    setSuccess(`${added} key(s) added, ${skipped} skipped (duplicates)`);
    fetchKeys();
    setTimeout(() => setSuccess(""), 5000);
    setAdding(false);
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm("Delete this API key?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/settings/apify-keys/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch (e) {
      console.error("Failed to delete key:", e);
    }
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#111114" }}>
      <Sidebar isOpen={sidebarOpen} userEmail="" />

      <main className="flex-1 overflow-auto" style={{ backgroundColor: "#111114" }}>
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div className="p-6 max-w-3xl">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-gray-400 mt-1">Manage your Apify API keys for scraping</p>
          </div>

          {/* Add Key Section */}
          <div
            className="rounded-2xl border border-gray-800/30 p-6 mb-6"
            style={{ backgroundColor: "#18181b" }}
          >
            <h2 className="text-lg font-semibold text-white mb-4">Add Apify API Keys</h2>
            <p className="text-sm text-gray-400 mb-4">Paste one key per line. Duplicates are automatically skipped.</p>

            {error && (
              <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-900/30 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm mb-4">
                {success}
              </div>
            )}

            <div className="space-y-3">
              <textarea
                placeholder={"apify_api_key1\napify_api_key2\napify_api_key3"}
                value={bulkKeys}
                onChange={(e) => setBulkKeys(e.target.value)}
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm font-mono resize-y"
                style={{ backgroundColor: "#111114" }}
              />
              <button
                onClick={handleAddKeys}
                disabled={adding}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {adding ? "Adding..." : "Add Keys"}
              </button>
            </div>
          </div>

          {/* Keys List */}
          <div
            className="rounded-2xl border border-gray-800/30 p-6"
            style={{ backgroundColor: "#18181b" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">API Keys</h2>
              <span className="text-sm text-gray-500">{keyCount} / 100</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-10">
                <svg
                  className="w-16 h-16 mx-auto mb-3 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                <p className="text-white font-medium">No API keys added</p>
                <p className="text-sm text-gray-500 mt-1">Add an Apify API key to start scraping</p>
              </div>
            ) : (
              <div className="space-y-2">
                {keys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-800/30 hover:border-gray-700 transition-colors"
                    style={{ backgroundColor: "#1f1f23" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">
                          {key.label || "API Key"}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">{key.api_key}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {key.last_used_at && (
                        <span className="text-xs text-gray-500">
                          Used {new Date(key.last_used_at).toLocaleDateString()}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
