"use client";

import { useState } from "react";

interface DebateEntry {
  speaker: string;
  text: string;
  round_number: number;
}

interface JudgeScores {
  logical_consistency: number;
  evidence_strength: number;
  rebuttal_effectiveness: number;
  clarity: number;
  total?: number;
}

interface JudgeVerdict {
  winner: string;
  pro_scores: JudgeScores;
  con_scores: JudgeScores;
  reasoning: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [topic, setTopic] = useState("Should AI replace human teachers?");
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<DebateEntry[]>([]);
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDebate = async () => {
    setLoading(true);
    setError(null);
    setTranscript([]);
    setVerdict(null);
    try {
      const res = await fetch(`${API_URL}/debate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) throw new Error(await res.text());
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "entry") {
              setTranscript((prev) => [...prev, data.entry]);
            } else if (data.type === "verdict") {
              setVerdict(data.verdict);
            } else if (data.type === "error") {
              setError(data.message);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run debate");
    } finally {
      setLoading(false);
    }
  };

  const speakerConfig: Record<
    string,
    { label: string; bg: string; border: string; icon: string; img?: string }
  > = {
    moderator: {
      label: "Moderator",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-500",
      icon: "📋",
      img: "/moderator.svg",
    },
    pro: {
      label: "Pro Agent",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-600",
      icon: "✓",
      img: "/pro-agent.svg",
    },
    con: {
      label: "Con Agent",
      bg: "bg-rose-50 dark:bg-rose-950/30",
      border: "border-rose-600",
      icon: "✗",
      img: "/con-agent.svg",
    },
    judge: {
      label: "Judge",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      border: "border-violet-600",
      icon: "⚖",
      img: "/judge.svg",
    },
  };

  const hasContent = transcript.length > 0 || verdict;

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 font-[family-name:var(--font-geist-sans)]">
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 backdrop-blur">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
            DebateMind
          </h1>
          <p className="text-stone-600 dark:text-stone-400 mt-1 text-sm">
            AI agents debate. A judge decides. Watch it unfold in real time.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="space-y-4 mb-10">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
            Debate topic
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Should AI replace human teachers?"
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-4 py-3 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            disabled={loading}
          />
          <button
            onClick={runDebate}
            disabled={loading || !topic.trim()}
            className="rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-stone-400 px-6 py-3 font-medium text-white transition-colors"
          >
            {loading ? "Debating…" : "Start debate"}
          </button>
          {loading && (
            <p className="text-sm text-stone-500">
              Watch each speaker appear as they respond…
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 p-4 text-rose-800 dark:text-rose-200 mb-8">
            {error}
          </div>
        )}

        {hasContent && (
          <section className="space-y-6">
            <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-200">
              Topic: {topic}
            </h2>

            <div className="space-y-6">
              {transcript.map((entry, i) => {
                const config = speakerConfig[entry.speaker] || {
                  label: entry.speaker,
                  bg: "bg-stone-100 dark:bg-stone-800",
                  border: "border-stone-400",
                  icon: "•",
                };
                return (
                  <div
                    key={i}
                    className={`flex gap-4 rounded-xl p-5 border-l-4 ${config.border} ${config.bg} shadow-sm`}
                  >
                    <div className="relative flex-shrink-0 w-14 h-14 rounded-full overflow-hidden bg-white dark:bg-stone-800 ring-2 ring-white/50 dark:ring-stone-700/50 flex items-center justify-center">
                      <span className="absolute inset-0 flex items-center justify-center text-2xl bg-stone-200 dark:bg-stone-700">
                        {config.icon}
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={config.img}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover z-10"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        {config.label}
                      </span>
                      <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap text-stone-800 dark:text-stone-200">
                        {entry.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {verdict && (
              <div className="rounded-xl border-2 border-violet-300 dark:border-violet-700 bg-white dark:bg-stone-900 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">⚖</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/judge.svg"
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover z-10"
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                    />
                  </div>
                  <h3 className="text-lg font-bold text-violet-700 dark:text-violet-300">
                    Verdict
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">Pro</span>
                    <span className="ml-2 font-mono">
                      {verdict.pro_scores.total ??
                        verdict.pro_scores.logical_consistency +
                          verdict.pro_scores.evidence_strength +
                          verdict.pro_scores.rebuttal_effectiveness +
                          verdict.pro_scores.clarity}
                    </span>
                    <span className="text-stone-500 dark:text-stone-400 ml-1">pts</span>
                  </div>
                  <div>
                    <span className="font-medium text-rose-700 dark:text-rose-400">Con</span>
                    <span className="ml-2 font-mono">
                      {verdict.con_scores.total ??
                        verdict.con_scores.logical_consistency +
                          verdict.con_scores.evidence_strength +
                          verdict.con_scores.rebuttal_effectiveness +
                          verdict.con_scores.clarity}
                    </span>
                    <span className="text-stone-500 dark:text-stone-400 ml-1">pts</span>
                  </div>
                </div>
                <p className="font-semibold text-stone-800 dark:text-stone-200">
                  Winner: {verdict.winner.toUpperCase()}
                </p>
                <p className="mt-2 text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
                  {verdict.reasoning}
                </p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
