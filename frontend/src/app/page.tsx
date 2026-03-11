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
  judge_verdicts?: JudgeVerdict[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [topic, setTopic] = useState("");
  const [numRounds, setNumRounds] = useState(2);
  const [numJudges, setNumJudges] = useState(1);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<DebateEntry[]>([]);
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(true);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [documentBase64, setDocumentBase64] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setImageBase64(base64);
      setImagePreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocumentName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string | ArrayBuffer;
      if (typeof result === "string") {
        setDocumentText(result);
        setDocumentBase64(null);
      } else {
        const bytes = new Uint8Array(result);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        setDocumentBase64(btoa(binary));
        setDocumentText(null);
      }
    };
    if (file.name.endsWith(".pdf")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const clearImage = () => {
    setImageBase64(null);
    setImagePreview(null);
  };

  const clearDocument = () => {
    setDocumentText(null);
    setDocumentBase64(null);
    setDocumentName(null);
  };

  const runDebate = async () => {
    setLoading(true);
    setError(null);
    setTranscript([]);
    setVerdict(null);
    setShowInfo(false);
    try {
      const body: Record<string, unknown> = { topic };
      if (imageBase64) body.image_base64 = imageBase64;
      if (documentText) body.document_text = documentText;
      if (documentBase64) body.document_base64 = documentBase64;
      body.num_rounds = numRounds;
      body.num_judges = numJudges;

      const res = await fetch(`${API_URL}/debate/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
            // Skip invalid JSON
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
    { label: string; bg: string; border: string; accent: string; icon: string; img?: string }
  > = {
    moderator: {
      label: "Moderator",
      bg: "from-amber-500/10 to-amber-600/5",
      border: "border-amber-500/50",
      accent: "text-amber-400",
      icon: "📋",
      img: "/moderator.svg",
    },
    pro: {
      label: "Pro Agent",
      bg: "from-emerald-500/10 to-emerald-600/5",
      border: "border-emerald-500/50",
      accent: "text-emerald-400",
      icon: "✓",
      img: "/pro-agent.svg",
    },
    con: {
      label: "Con Agent",
      bg: "from-rose-500/10 to-rose-600/5",
      border: "border-rose-500/50",
      accent: "text-rose-400",
      icon: "✗",
      img: "/con-agent.svg",
    },
    judge: {
      label: "Judge",
      bg: "from-violet-500/10 to-violet-600/5",
      border: "border-violet-500/50",
      accent: "text-violet-400",
      icon: "⚖",
      img: "/judge.svg",
    },
  };

  const hasContent = transcript.length > 0 || verdict;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(245,158,11,0.15),transparent)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-amber-200 via-amber-100 to-amber-200 bg-clip-text text-transparent">
            DebateMind
          </h1>
          <p className="mt-3 text-lg text-slate-400 max-w-2xl">
            Multi-agent AI debate system. Watch Pro and Con agents argue in real time, with an AI Judge delivering structured evaluations.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-20">
        {/* Project info - collapsible */}
        {showInfo && !hasContent && (
          <section className="mb-12 animate-fade-in">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur">
              <h2 className="text-xl font-semibold text-slate-100 mb-4">About This Project</h2>
              <p className="text-slate-400 leading-relaxed mb-4">
                DebateMind simulates structured debates using multiple AI agents. Enter any controversial topic and watch as a Moderator introduces the debate, 
                a Pro agent argues in favor, a Con agent argues against, and finally a Judge evaluates both sides using criteria like logical consistency, 
                evidence strength, rebuttal effectiveness, and clarity.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <span className="text-amber-400 text-lg">🎯</span>
                  <div>
                    <span className="font-medium text-slate-200">Structured Reasoning</span>
                    <p className="text-slate-500 mt-0.5">Multi-turn debate with opening arguments and rebuttals</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <span className="text-emerald-400 text-lg">⚡</span>
                  <div>
                    <span className="font-medium text-slate-200">Live Streaming</span>
                    <p className="text-slate-500 mt-0.5">Watch each agent&apos;s response appear as it&apos;s generated</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                  <span className="text-violet-400 text-lg">⚖</span>
                  <div>
                    <span className="font-medium text-slate-200">Image & Document Context</span>
                    <p className="text-slate-500 mt-0.5">Upload an image or PDF to debate based on it</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Input section */}
        <section className="mb-12">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8 space-y-6">
            {/* Debate topic - full width, prominent */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Debate topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Should AI replace human teachers?"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-5 py-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all text-base min-h-[52px]"
                disabled={loading}
              />
            </div>

            {/* Rounds & Judges - horizontal row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Rounds
                </label>
                <select
                  value={numRounds}
                  onChange={(e) => setNumRounds(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  disabled={loading}
                >
                  <option value={1}>1 (opening only)</option>
                  <option value={2}>2 (opening + 1 rebuttal)</option>
                  <option value={3}>3 (opening + 2 rebuttals)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Judges
                </label>
                <select
                  value={numJudges}
                  onChange={(e) => setNumJudges(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  disabled={loading}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
            </div>

            {/* Image & Document context - equal cards, aligned */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 min-h-[140px] flex flex-col">
                <p className="text-sm font-medium text-slate-300 mb-1">Add image context (optional)</p>
                <p className="text-xs text-slate-500 mb-4">Debate based on what&apos;s in the image</p>
                <div className="flex gap-3 items-center flex-1">
                  <label className="cursor-pointer px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors shrink-0">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    Choose image
                  </label>
                  {imagePreview && (
                    <div className="relative flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Preview" className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg border border-slate-600" />
                      <button onClick={clearImage} className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-rose-500 text-white text-sm flex items-center justify-center hover:bg-rose-400" aria-label="Remove image">×</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 p-5 min-h-[140px] flex flex-col">
                <p className="text-sm font-medium text-slate-300 mb-1">Add document context (optional)</p>
                <p className="text-xs text-slate-500 mb-4">Debate based on PDF or text file</p>
                <div className="flex gap-3 items-center flex-1">
                  <label className="cursor-pointer px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors shrink-0">
                    <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleDocumentUpload} />
                    Choose file
                  </label>
                  {documentName && (
                    <span className="text-sm text-slate-400 truncate max-w-[180px] flex items-center gap-2">
                      {documentName}
                      <button onClick={clearDocument} className="text-rose-400 hover:text-rose-300 shrink-0" aria-label="Remove document">×</button>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(imagePreview || documentName) && (
              <p className="text-sm text-amber-400/90">
                ✓ Agents will base their arguments on your uploaded content
              </p>
            )}

            <div className="flex justify-end">
              <button
                onClick={runDebate}
                disabled={loading || !topic.trim()}
                className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed font-semibold text-slate-900 transition-all pulse-glow"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                    Debating…
                  </span>
                ) : (
                  "Start debate"
                )}
              </button>
            </div>
            {loading && (
              <p className="mt-3 text-sm text-slate-500">
                Responses stream in real time. This may take 1–2 minutes.
              </p>
            )}
          </div>
        </section>

        {error && (
          <div className="mb-8 rounded-xl border border-rose-500/30 bg-rose-950/20 p-5 text-rose-300">
            {error}
          </div>
        )}

        {/* Debate transcript */}
        {hasContent && (
          <section className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-200">
                Topic: <span className="text-amber-400">{topic}</span>
              </h2>
              <span className="text-sm text-slate-500">
                {transcript.length} exchange{transcript.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="space-y-6">
              {transcript.map((entry, i) => {
                if (entry.speaker === "judge" && verdict?.judge_verdicts && verdict.judge_verdicts.length > 1) {
                  return (
                    <div key={i} className="space-y-6">
                      <h3 className="text-lg font-semibold text-violet-300">Judge evaluations</h3>
                      {verdict.judge_verdicts.map((jv, idx) => {
                        const proTotal = jv.pro_scores.total ?? (jv.pro_scores.logical_consistency + jv.pro_scores.evidence_strength + jv.pro_scores.rebuttal_effectiveness + jv.pro_scores.clarity);
                        const conTotal = jv.con_scores.total ?? (jv.con_scores.logical_consistency + jv.con_scores.evidence_strength + jv.con_scores.rebuttal_effectiveness + jv.con_scores.clarity);
                        return (
                          <div key={idx} className="rounded-2xl border-2 border-violet-500/30 bg-gradient-to-br from-violet-950/20 to-slate-900/50 p-6 animate-fade-in shadow-xl">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center text-xl ring-2 ring-violet-500/30">
                                ⚖
                              </div>
                              <span className="text-violet-300 font-bold text-lg">Judge {idx + 1}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-emerald-400 font-semibold">Pro</span>
                                <span className="ml-2 font-mono text-lg text-slate-200">{proTotal} pts</span>
                                <p className="text-xs text-slate-500 mt-2">Logic {jv.pro_scores.logical_consistency} · Evidence {jv.pro_scores.evidence_strength} · Rebuttal {jv.pro_scores.rebuttal_effectiveness} · Clarity {jv.pro_scores.clarity}</p>
                              </div>
                              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                <span className="text-rose-400 font-semibold">Con</span>
                                <span className="ml-2 font-mono text-lg text-slate-200">{conTotal} pts</span>
                                <p className="text-xs text-slate-500 mt-2">Logic {jv.con_scores.logical_consistency} · Evidence {jv.con_scores.evidence_strength} · Rebuttal {jv.con_scores.rebuttal_effectiveness} · Clarity {jv.con_scores.clarity}</p>
                              </div>
                            </div>
                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                              <span className="text-amber-400 font-bold">Winner: {jv.winner.toUpperCase()}</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-slate-400">Reasoning:</span>
                              <p className="mt-2 text-slate-300 leading-relaxed">{jv.reasoning}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div className="rounded-2xl border-2 border-violet-500/40 bg-gradient-to-br from-violet-950/40 to-slate-900/50 p-8 shadow-2xl animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                          <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center text-2xl ring-2 ring-violet-500/30">
                            ⚖
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-violet-300">Final verdict</h3>
                            <p className="text-slate-500 text-sm">Aggregated from all judges</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6 mb-6">
                          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-emerald-400 font-semibold">Pro</span>
                            <span className="ml-2 font-mono text-lg text-slate-200">
                              {verdict.pro_scores.total ?? (verdict.pro_scores.logical_consistency + verdict.pro_scores.evidence_strength + verdict.pro_scores.rebuttal_effectiveness + verdict.pro_scores.clarity)}
                            </span>
                            <span className="text-slate-500 ml-1">pts</span>
                          </div>
                          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                            <span className="text-rose-400 font-semibold">Con</span>
                            <span className="ml-2 font-mono text-lg text-slate-200">
                              {verdict.con_scores.total ?? (verdict.con_scores.logical_consistency + verdict.con_scores.evidence_strength + verdict.con_scores.rebuttal_effectiveness + verdict.con_scores.clarity)}
                            </span>
                            <span className="text-slate-500 ml-1">pts</span>
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                          <span className="text-amber-400 font-bold text-lg">Winner: {verdict.winner.toUpperCase()}</span>
                        </div>
                        <p className="text-slate-400 leading-relaxed">{verdict.reasoning}</p>
                      </div>
                    </div>
                  );
                }
                const config = speakerConfig[entry.speaker] || {
                  label: entry.speaker,
                  bg: "from-slate-700/10 to-slate-800/5",
                  border: "border-slate-600/50",
                  accent: "text-slate-400",
                  icon: "•",
                };
                return (
                  <div
                    key={i}
                    className={`flex gap-6 rounded-2xl p-6 bg-gradient-to-br ${config.bg} border ${config.border} backdrop-blur shadow-xl animate-fade-in`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden bg-slate-800 ring-2 ring-slate-700/50 flex items-center justify-center">
                      <span className="absolute inset-0 flex items-center justify-center text-2xl bg-slate-700">
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
                      <span className={`text-sm font-bold uppercase tracking-widest ${config.accent}`}>
                        {config.label}
                      </span>
                      <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap text-slate-300">
                        {entry.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Single judge verdict (when only 1 judge, verdict section is separate) */}
            {verdict && (!verdict.judge_verdicts || verdict.judge_verdicts.length <= 1) && (
              <div className="rounded-2xl border-2 border-violet-500/30 bg-gradient-to-br from-violet-950/30 to-slate-900/50 p-8 shadow-2xl animate-fade-in">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500/20 flex items-center justify-center text-2xl ring-2 ring-violet-500/30">
                    ⚖
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-violet-300">Verdict</h3>
                    <p className="text-slate-500 text-sm">Final evaluation</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-emerald-400 font-semibold">Pro</span>
                    <span className="ml-2 font-mono text-lg text-slate-200">
                      {verdict.pro_scores.total ??
                        verdict.pro_scores.logical_consistency +
                          verdict.pro_scores.evidence_strength +
                          verdict.pro_scores.rebuttal_effectiveness +
                          verdict.pro_scores.clarity}
                    </span>
                    <span className="text-slate-500 ml-1">pts</span>
                  </div>
                  <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <span className="text-rose-400 font-semibold">Con</span>
                    <span className="ml-2 font-mono text-lg text-slate-200">
                      {verdict.con_scores.total ??
                        verdict.con_scores.logical_consistency +
                          verdict.con_scores.evidence_strength +
                          verdict.con_scores.rebuttal_effectiveness +
                          verdict.con_scores.clarity}
                    </span>
                    <span className="text-slate-500 ml-1">pts</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                  <span className="text-amber-400 font-bold text-lg">
                    Winner: {verdict.winner.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
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
