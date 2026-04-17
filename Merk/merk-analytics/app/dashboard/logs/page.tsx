"use client";

import { useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface LogEntry {
  time: string;
  message: string;
  type: string;
}

export default function LogsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Connect to SSE log stream
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/logs/stream`);
        if (!res.ok || !res.body) return;

        setConnected(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const entry = JSON.parse(line.slice(6));
                const time = new Date(entry.time).toLocaleTimeString("en-US", {
                  hour12: false,
                });
                setLogs((prev) => [...prev, { ...entry, time }]);
              } catch (e) {}
            }
          }
        }
      } catch (e) {
        console.error("Log stream error:", e);
      } finally {
        setConnected(false);
        // Reconnect after 3s
        if (!cancelled) {
          setTimeout(connect, 3000);
        }
      }
    };

    connect();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#111114" }}>
      <Sidebar isOpen={sidebarOpen} userEmail="" />

      <main
        className="flex-1 overflow-auto"
        style={{ backgroundColor: "#111114" }}
      >
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <div
          className="p-6 flex flex-col"
          style={{ height: "calc(100vh - 65px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Logs</h1>
              <p className="text-sm text-gray-400 mt-1">
                {connected ? (
                  <span className="text-green-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    Connected — streaming live
                  </span>
                ) : (
                  <span className="text-yellow-400 flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full" />
                    Connecting...
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const text = logs.map(l => `[${l.time}] ${l.message}`).join("\n");
                  navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className={`px-3 py-1.5 text-sm border rounded-lg transition-all ${
                  copied
                    ? "text-green-400 border-green-600 bg-green-500/10"
                    : "text-gray-400 hover:text-white border-gray-700 hover:border-gray-600"
                }`}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
              <button
                onClick={() => setLogs([])}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Log terminal */}
          <div
            className="flex-1 rounded-xl border border-gray-800/30 overflow-hidden flex flex-col"
            style={{ backgroundColor: "#0a0a0c" }}
          >
            {/* Terminal header */}
            <div
              className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/30"
              style={{ backgroundColor: "#141417" }}
            >
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
              </div>
              <span className="text-xs text-gray-500 ml-2 font-mono">
                merk-logs
              </span>
              {connected && (
                <span className="ml-auto text-xs text-green-400 animate-pulse">
                  LIVE
                </span>
              )}
            </div>

            {/* Log content */}
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed">
              {logs.length === 0 ? (
                <div className="text-gray-600 text-center mt-10">
                  <p className="text-sm">No logs yet</p>
                  <p className="text-xs mt-1">
                    Logs will appear here when actions are triggered from
                    Accounts
                  </p>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className="flex gap-3 hover:bg-white/5 px-1 rounded"
                  >
                    <span className="text-gray-600 flex-shrink-0 select-none">
                      {log.time}
                    </span>
                    <span
                      className={
                        log.type === "done"
                          ? "text-green-400"
                          : log.type === "error"
                          ? "text-red-400"
                          : log.message.includes("ERROR")
                          ? "text-red-400"
                          : log.message.includes("saved") ||
                            log.message.includes("updated")
                          ? "text-emerald-400"
                          : log.message.includes("Account added") ||
                            log.message.includes("Profile picture")
                          ? "text-blue-400"
                          : "text-gray-300"
                      }
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
