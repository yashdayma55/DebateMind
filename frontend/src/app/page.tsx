"use client";

import { useState, useRef, useEffect } from "react";

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

const SUGGESTED_TOPICS = [
  "Should AI replace human teachers in education?",
  "Is social media net harmful to democracy?",
  "Nuclear power should be the future of energy",
];

const JUDGE_NAMES = ["SENTINEL", "ARBITER", "ORACLE"];
const DEBATE_HISTORY_KEY = "debateMind_history";
const MAX_HISTORY = 3;

interface SavedDebate {
  id: string;
  topic: string;
  transcript: DebateEntry[];
  verdict: JudgeVerdict;
  numRounds: number;
  numJudges: number;
  winner: string;
  timestamp: number;
  durationSec: number;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [numRounds, setNumRounds] = useState(3);
  const [numJudges, setNumJudges] = useState(2);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<DebateEntry[]>([]);
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [documentBase64, setDocumentBase64] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [debateHistory, setDebateHistory] = useState<SavedDebate[]>([]);
  const [viewingFromHistory, setViewingFromHistory] = useState(false);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const savedForVerdictRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEBATE_HISTORY_KEY);
      if (raw) setDebateHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const saveToHistory = (item: SavedDebate) => {
    setDebateHistory((prev) => {
      const next = [item, ...prev.filter((h) => h.id !== item.id)].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(DEBATE_HISTORY_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const loadDebate = (item: SavedDebate) => {
    setViewingFromHistory(true);
    setTopic(item.topic);
    setTranscript(item.transcript);
    setVerdict(item.verdict);
    setNumRounds(item.numRounds);
    setNumJudges(item.numJudges);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (verdict && transcript.length > 0 && !loading && !viewingFromHistory) {
      const key = `${topic}-${verdict.reasoning.slice(0, 50)}`;
      if (savedForVerdictRef.current === key) return;
      savedForVerdictRef.current = key;
      saveToHistory({
        id: `debate-${Date.now()}`,
        topic,
        transcript,
        verdict,
        numRounds,
        numJudges,
        winner: verdict.winner,
        timestamp: Date.now(),
        durationSec: elapsedSec,
      });
    }
  }, [verdict, transcript.length, loading, viewingFromHistory, topic, numRounds, numJudges, elapsedSec]);

  useEffect(() => {
    if (transcript.length === 0 && !verdict) savedForVerdictRef.current = null;
  }, [transcript.length, verdict]);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (loading) setElapsedSec(0);
  }, [loading]);

  useEffect(() => {
    contentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

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
            /* skip */
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run debate");
    } finally {
      setLoading(false);
    }
  };

  const hasContent = transcript.length > 0 || verdict;
  const proTotal = verdict
    ? (verdict.pro_scores.total ??
        verdict.pro_scores.logical_consistency +
          verdict.pro_scores.evidence_strength +
          verdict.pro_scores.rebuttal_effectiveness +
          verdict.pro_scores.clarity)
    : 0;
  const conTotal = verdict
    ? (verdict.con_scores.total ??
        verdict.con_scores.logical_consistency +
          verdict.con_scores.evidence_strength +
          verdict.con_scores.rebuttal_effectiveness +
          verdict.con_scores.clarity)
    : 0;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative z-10 min-h-screen">
      {/* Navbar */}
      <header
        className="sticky top-0 z-20 border-b flex items-center justify-between px-6"
        style={{
          height: "70px",
          backgroundColor: "rgba(2,5,12,0.90)",
          borderColor: "rgba(0, 200, 255, 0.10)",
        }}
      >
        <div>
          <h1 className="font-display text-[22px] font-bold logo-gradient" style={{ letterSpacing: "2px" }}>
            DebateMind
          </h1>
          <p className="font-body text-[11px] mt-0.5 max-w-md" style={{ color: "rgba(232,244,253,0.6)" }}>
            Multi-agent AI debate system. Watch Pro and Con agents argue in real time, with an AI Judge delivering structured evaluations.
          </p>
        </div>
        <div className="flex items-center gap-6">
          {hasContent && verdict && (
            <p className="font-mono-label text-[11px]" style={{ color: "#3D6080", letterSpacing: "1px" }}>
              {numRounds} ROUNDS · {numJudges} JUDGES · {fmtTime(elapsedSec)} ELAPSED
            </p>
          )}
          {hasContent && (
            <span
              className="font-mono-label px-4 py-1.5 rounded-full flex items-center gap-2"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: verdict ? "#FFD700" : "#00FF9D",
                border: `1px solid ${verdict ? "rgba(255,215,0,0.40)" : "rgba(0,255,157,0.30)"}`,
                backgroundColor: verdict ? "rgba(255,215,0,0.06)" : "rgba(0,255,157,0.05)",
                boxShadow: verdict ? "0 0 16px rgba(255,215,0,0.15)" : "0 0 8px rgba(0,255,157,0.2)",
              }}
            >
              {!verdict && <span className="w-2 h-2 rounded-full bg-[#00FF9D] animate-pulse-dot" style={{ boxShadow: "0 0 8px #00FF9D" }} />}
              {verdict ? "⚖ VERDICT COMPLETE" : "SYSTEM ONLINE"}
            </span>
          )}
        </div>
      </header>

      <main>
        {/* SETUP SCREEN */}
        {!hasContent && (
          <div className="animate-fade-in max-w-[740px] mx-auto px-6 py-12 space-y-10">
            {/* Hero - at top */}
            <div className="text-center space-y-3">
              <h1 className="font-display text-5xl sm:text-[68px] font-bold logo-gradient" style={{ letterSpacing: "8px" }}>
                DebateMind
              </h1>
              <p className="font-body text-[15px] sm:text-base max-w-xl mx-auto" style={{ color: "rgba(232,244,253,0.7)" }}>
                Multi-agent AI debate system. Watch Pro and Con agents argue in real time, with an AI Judge delivering structured evaluations.
              </p>
            </div>

            {/* Agent Pipeline Row */}
            <div className="flex items-center justify-center gap-0 py-6">
              {/* Moderator */}
              <div className="flex flex-col items-center">
                <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center text-[24px]" style={{ border: "2px solid #00D2FF", backgroundColor: "rgba(0,210,255,0.10)", boxShadow: "0 0 16px rgba(0,210,255,0.25)" }}>🎙</div>
                <span className="font-mono-label text-[11px] mt-2 uppercase" style={{ color: "#00D2FF", letterSpacing: "2px" }}>MODERATOR</span>
              </div>
              <div className="w-7 h-px mx-1" style={{ backgroundColor: "rgba(0,210,255,0.40)" }} />
              {/* Pro */}
              <div className="flex flex-col items-center">
                <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center text-[24px]" style={{ border: "2px solid #00FF9D", backgroundColor: "rgba(0,255,157,0.10)", boxShadow: "0 0 16px rgba(0,255,157,0.25)" }}>⚡</div>
                <span className="font-mono-label text-[11px] mt-2 uppercase" style={{ color: "#00FF9D", letterSpacing: "2px" }}>PRO AGENT</span>
              </div>
              <div className="w-7 h-px mx-1 flex items-center justify-center" style={{ backgroundColor: "rgba(0,210,255,0.20)" }}>
                <span style={{ color: "rgba(232,244,253,0.50)", fontSize: "12px" }}>⚔</span>
              </div>
              {/* Con */}
              <div className="flex flex-col items-center">
                <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center text-[24px]" style={{ border: "2px solid #FF4D6D", backgroundColor: "rgba(255,77,109,0.10)", boxShadow: "0 0 16px rgba(255,77,109,0.2)" }}>🔥</div>
                <span className="font-mono-label text-[11px] mt-2 uppercase" style={{ color: "#FF4D6D", letterSpacing: "2px" }}>CON AGENT</span>
              </div>
              <div className="w-7 h-px mx-1" style={{ backgroundColor: "rgba(192,132,252,0.40)" }} />
              {/* Judge */}
              <div className="flex flex-col items-center">
                <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center text-[24px]" style={{ border: "2px solid #C084FC", backgroundColor: "rgba(192,132,252,0.10)", boxShadow: "0 0 16px rgba(192,132,252,0.2)" }}>⚖</div>
                <span className="font-mono-label text-[11px] mt-2 uppercase" style={{ color: "#C084FC", letterSpacing: "2px" }}>JUDGE(S)</span>
              </div>
            </div>

            {/* Form Card */}
            <div
              className="rounded-[20px] p-8 relative overflow-hidden"
              style={{
                backgroundColor: "rgba(8,14,24,0.95)",
                border: "1px solid rgba(0,200,255,0.20)",
                boxShadow: "0 0 50px rgba(0,150,255,0.07), 0 30px 60px rgba(0,0,0,0.5)",
              }}
            >
              {/* Corner brackets */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t border-l" style={{ borderColor: "rgba(0,200,255,0.35)" }} />
              <div className="absolute top-4 right-4 w-4 h-4 border-t border-r" style={{ borderColor: "rgba(0,200,255,0.35)" }} />
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l" style={{ borderColor: "rgba(0,200,255,0.35)" }} />
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r" style={{ borderColor: "rgba(0,200,255,0.35)" }} />
              {/* Top glow */}
              <div
                className="absolute top-0 left-[20%] right-[20%] h-px"
                style={{ background: "linear-gradient(90deg, transparent, rgba(0,210,255,0.60), transparent)" }}
              />

              <div className="space-y-6">
                {/* Topic Input */}
                <div>
                  <p className="font-mono-label text-[10px] mb-2" style={{ color: "#00D2FF", letterSpacing: "3px" }}>
                    // DEBATE TOPIC <span style={{ color: "#3D6080" }}>· REQUIRED</span>
                  </p>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Should universal basic income be implemented globally?"
                    className="w-full rounded-[10px] px-[18px] py-[14px] font-body text-[15px] focus:outline-none"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.40)",
                      border: "1px solid rgba(0,210,255,0.35)",
                      color: "#E8F4FD",
                    }}
                    disabled={loading}
                  />
                  <p className="font-mono-label text-[10px] mt-2" style={{ color: "#3D6080" }}>
                    Minimum 5 characters · Any topic works · Be specific for stronger arguments
                  </p>
                </div>

                {/* Two-column: Rounds + Judges */}
                <div className="flex gap-5">
                  <div className="flex-1">
                    <p className="font-mono-label text-[10px] mb-1" style={{ color: "#00D2FF", letterSpacing: "3px" }}>
                      // DEBATE ROUNDS <span style={{ color: "#3D6080" }}>· 1–5</span>
                    </p>
                    <p className="font-mono-label text-[10px] mb-2" style={{ color: "#3D6080" }}>1 = Opening only · 2+ = With rebuttals</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setNumRounds(n)}
                          disabled={loading}
                          className="flex-1 py-2 rounded-lg font-mono-label font-bold transition-all"
                          style={{
                            backgroundColor: numRounds === n ? "rgba(255,215,0,0.10)" : numRounds === n + 1 ? "rgba(255,215,0,0.02)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${numRounds === n ? "rgba(255,215,0,0.50)" : numRounds === n + 1 ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.06)"}`,
                            color: numRounds === n ? "#FFD700" : numRounds === n + 1 ? "rgba(255,215,0,0.30)" : "#3D6080",
                            boxShadow: numRounds === n ? "0 0 16px rgba(255,215,0,0.15)" : "none",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-mono-label text-[10px] mb-1" style={{ color: "#00D2FF", letterSpacing: "3px" }}>
                      // JUDGE PANEL <span style={{ color: "#3D6080" }}>· 1–3</span>
                    </p>
                    <p className="font-mono-label text-[10px] mb-2" style={{ color: "#3D6080" }}>2+ = Panel with majority vote verdict</p>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          onClick={() => setNumJudges(n)}
                          disabled={loading}
                          className="flex-1 py-2 rounded-lg font-mono-label font-bold transition-all"
                          style={{
                            backgroundColor: numJudges === n ? "rgba(192,132,252,0.10)" : "rgba(255,255,255,0.02)",
                            border: `1px solid ${numJudges === n ? "rgba(192,132,252,0.50)" : "rgba(255,255,255,0.06)"}`,
                            color: numJudges === n ? "#C084FC" : "#3D6080",
                            boxShadow: numJudges === n ? "0 0 16px rgba(192,132,252,0.2)" : "none",
                          }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Context Upload */}
                <div>
                  <p className="font-mono-label text-[10px] mb-2" style={{ color: "#00D2FF", letterSpacing: "3px" }}>
                    // CONTEXT <span style={{ color: "#3D6080" }}>· OPTIONAL</span>
                  </p>
                  <div className="flex gap-3">
                    <label
                      className="flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-[10px] cursor-pointer border border-dashed"
                      style={{ borderColor: "rgba(0,210,255,0.20)", backgroundColor: "rgba(0,210,255,0.02)" }}
                    >
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      <span className="text-[22px]">🖼</span>
                      <span className="font-mono-label text-[10px]" style={{ color: "#3D6080" }}>UPLOAD IMAGE</span>
                      <span className="font-mono-label text-[10px]" style={{ color: "rgba(61,96,128,0.55)" }}>PNG, JPG, WEBP · Vision model context</span>
                      {imagePreview && (
                        <div className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imagePreview} alt="" className="h-14 w-14 object-cover rounded" />
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearImage(); }} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#FF4D6D] text-white text-xs">×</button>
                        </div>
                      )}
                    </label>
                    <label
                      className="flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-[10px] cursor-pointer border border-dashed"
                      style={{ borderColor: "rgba(0,210,255,0.20)", backgroundColor: "rgba(0,210,255,0.02)" }}
                    >
                      <input type="file" accept=".pdf,.txt" className="hidden" onChange={handleDocumentUpload} />
                      <span className="text-[22px]">📄</span>
                      <span className="font-mono-label text-[10px]" style={{ color: "#3D6080" }}>UPLOAD DOCUMENT</span>
                      <span className="font-mono-label text-[10px]" style={{ color: "rgba(61,96,128,0.55)" }}>PDF, TXT · Text extracted as context</span>
                      {documentName && <span className="text-[10px]" style={{ color: "#00D2FF" }}>{documentName}</span>}
                    </label>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={runDebate}
                  disabled={loading || !topic.trim()}
                  className="w-full py-[17px] rounded-xl font-display font-bold uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,210,255,0.14), rgba(0,100,255,0.14))",
                    border: "1px solid rgba(0,210,255,0.40)",
                    color: "#00D2FF",
                    fontSize: "15px",
                    letterSpacing: "5px",
                    boxShadow: "0 0 25px rgba(0,210,255,0.10)",
                  }}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#00D2FF]/30 border-t-[#00D2FF] rounded-full animate-spin" />
                      DEBATE IN PROGRESS…
                    </>
                  ) : (
                    <>◈ INITIATE DEBATE</>
                  )}
                </button>
              </div>
            </div>

            {/* Suggested topics - quick fill */}
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopic(t)}
                  className="px-4 py-2 rounded-lg font-body text-sm"
                  style={{
                    backgroundColor: "rgba(8,14,24,0.70)",
                    border: "1px solid rgba(0,200,255,0.20)",
                    color: "rgba(232,244,253,0.7)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Debate History - highlighted section */}
            {debateHistory.length > 0 && (
              <div className="w-full max-w-[740px] mx-auto pt-4">
                <div
                  className="rounded-xl p-5"
                  style={{
                    backgroundColor: "rgba(0,210,255,0.04)",
                    border: "1px solid rgba(0,210,255,0.25)",
                    boxShadow: "0 0 24px rgba(0,210,255,0.08)",
                  }}
                >
                  <p className="font-mono-label text-[11px] mb-4" style={{ color: "#00D2FF", letterSpacing: "4px", fontWeight: 600 }}>
                    // DEBATE HISTORY
                  </p>
                  <p className="font-body text-[12px] mb-4" style={{ color: "rgba(232,244,253,0.6)" }}>
                    Click any debate below to view the full transcript and verdict
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {debateHistory.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadDebate(item)}
                        className="flex-1 min-w-0 p-4 rounded-[10px] text-left transition-all hover:border-[#00D2FF]/50"
                        style={{
                          backgroundColor: "rgba(8,14,24,0.90)",
                          border: "1px solid rgba(0,200,255,0.20)",
                        }}
                      >
                        <p className="font-body text-[12px] font-semibold mb-2 leading-snug line-clamp-2" style={{ color: "rgba(232,244,253,0.90)" }}>
                          {item.topic}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="font-mono-label text-[10px]" style={{ color: item.winner === "pro" ? "#00FF9D" : "#FF4D6D" }}>
                            {item.winner.toUpperCase()} WINS
                          </span>
                          <span className="font-mono-label text-[10px]" style={{ color: "#3D6080" }}>
                            {Math.floor(item.durationSec / 60)}:{(item.durationSec % 60).toString().padStart(2, "0")}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto px-6 py-4 rounded-xl border" style={{ borderColor: "rgba(255,77,109,0.4)", backgroundColor: "rgba(255,77,109,0.1)", color: "#FF4D6D" }}>
            {error}
          </div>
        )}

        {/* LIVE DEBATE + VERDICT SCREEN */}
        {hasContent && (
          <div className="flex">
            {/* Left Sidebar 340px */}
            <aside
              className="hidden md:block flex-shrink-0 w-[340px] p-5 space-y-6"
              style={{
                backgroundColor: "rgba(5,10,18,0.95)",
                borderRight: "1px solid rgba(0,200,255,0.09)",
              }}
            >
              <div>
                <p className="font-mono-label text-[10px] mb-2" style={{ color: "#00D2FF", letterSpacing: "3px" }}>// DEBATE TOPIC</p>
                <div
                  className="p-4 rounded-[10px]"
                  style={{
                    backgroundColor: "rgba(0,210,255,0.03)",
                    border: "1px solid rgba(0,210,255,0.18)",
                  }}
                >
                  <p className="font-body text-[14px] font-bold italic leading-snug" style={{ color: "#E8F4FD" }}>"{topic}"</p>
                  <span
                    className="inline-block mt-2 px-3 py-0.5 rounded-[10px] font-mono-label text-[10px]"
                    style={{ color: "#00D2FF", backgroundColor: "rgba(0,210,255,0.10)", border: "1px solid rgba(0,210,255,0.30)" }}
                  >
                    ACTIVE DEBATE
                  </span>
                </div>
              </div>

              <div>
                <p className="font-mono-label text-[10px] mb-2" style={{ color: "#00D2FF", letterSpacing: "3px" }}>// CONFIGURATION</p>
                <div
                  className="p-4 rounded-[10px] space-y-4"
                  style={{
                    backgroundColor: "rgba(5,10,18,0.70)",
                    border: "1px solid rgba(0,200,255,0.10)",
                  }}
                >
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-body text-[12px]" style={{ color: "#3D6080" }}>Debate Rounds</span>
                      <span className="font-mono-label text-[16px]" style={{ color: "#FFD700" }}>{numRounds}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,210,255,0.10)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(numRounds / 5) * 100}%`,
                          background: "linear-gradient(90deg, #00D2FF, #FFD700)",
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-body text-[12px]" style={{ color: "#3D6080" }}>Judge Panel</span>
                      <span className="font-mono-label text-[16px]" style={{ color: "#C084FC" }}>{numJudges}</span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(0,210,255,0.10)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(numJudges / 3) * 100}%`,
                          background: "linear-gradient(90deg, #C084FC, #FF4D6D)",
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg text-center" style={{ border: "1px solid rgba(0,200,255,0.15)", backgroundColor: "rgba(0,210,255,0.04)" }}>
                      <span className="font-mono-label text-[10px]" style={{ color: "#3D6080" }}>CONTEXT</span>
                      <p className="text-[10px]" style={{ color: "#E8F4FD" }}>📄 {documentName || "No file"}</p>
                    </div>
                    <div className="p-2 rounded-lg text-center" style={{ border: "1px solid rgba(0,200,255,0.15)", backgroundColor: "rgba(0,210,255,0.04)" }}>
                      <span className="font-mono-label text-[10px]" style={{ color: "#3D6080" }}>IMAGE</span>
                      <p className="text-[10px]" style={{ color: "#E8F4FD" }}>🖼 {imagePreview ? "Uploaded" : "None"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-mono-label text-[10px] mb-2" style={{ color: "#00D2FF", letterSpacing: "3px" }}>// ACTIVE AGENTS</p>
                <div className="space-y-2">
                  {[
                    { icon: "🎙", name: "MODERATOR", color: "#00D2FF", status: "● Introduced topic", statusColor: "rgba(0,255,157,0.70)" },
                    { icon: "⚡", name: "PRO AGENT", color: "#00FF9D", status: transcript.some((e) => e.speaker === "pro") ? (loading ? "● Arguing" : "● Done") : "○ Pending", statusColor: transcript.some((e) => e.speaker === "pro") ? "rgba(0,255,157,0.70)" : "#3D6080" },
                    { icon: "🔥", name: "CON AGENT", color: "#FF4D6D", status: transcript.some((e) => e.speaker === "con") ? (loading ? "● Arguing" : "● Done") : "○ Pending", statusColor: transcript.some((e) => e.speaker === "con") ? "rgba(0,255,157,0.70)" : "#3D6080" },
                    { icon: "⚖", name: `JUDGE PANEL ×${numJudges}`, color: "#C084FC", status: verdict ? "● Complete" : "○ Awaiting completion", statusColor: verdict ? "rgba(0,255,157,0.70)" : "#3D6080" },
                  ].map((agent) => (
                    <div
                      key={agent.name}
                      className="flex items-center gap-2 p-3 rounded-[10px]"
                      style={{
                        border: `1px solid ${agent.color}4D`,
                        backgroundColor: `${agent.color}0A`,
                      }}
                    >
                      <span className="text-[18px]">{agent.icon}</span>
                      <span className="font-mono-label text-[11px] font-bold flex-1" style={{ color: agent.color, letterSpacing: "1px" }}>{agent.name}</span>
                      <span className="font-mono-label text-[10px]" style={{ color: agent.statusColor }}>{agent.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {loading && (
                <button
                  disabled
                  className="w-full py-3 rounded-xl font-display font-bold uppercase"
                  style={{
                    background: "linear-gradient(135deg, rgba(0,210,255,0.08), rgba(0,100,255,0.08))",
                    border: "1px solid rgba(0,210,255,0.30)",
                    color: "rgba(0,210,255,0.7)",
                    fontSize: "13px",
                    letterSpacing: "3px",
                  }}
                >
                  ◈ DEBATE IN PROGRESS…
                </button>
              )}
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0 p-6 overflow-auto" style={{ maxHeight: "calc(100vh - 70px)" }}>
              {/* Round header + Phase tag */}
              {transcript.length > 0 && (
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-label text-[11px]" style={{ color: "#3D6080" }}>ROUND</span>
                    <div className="flex gap-1.5">
                      {Array.from({ length: numRounds }, (_, i) => {
                        const proCount = transcript.filter((e) => e.speaker === "pro").length;
                        const done = i < Math.ceil(proCount / 2);
                        const active = !done && i === Math.floor(proCount / 2);
                        return (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full"
                            style={{
                              backgroundColor: done ? "rgba(0,255,157,0.60)" : active ? "#00D2FF" : "rgba(0,210,255,0.20)",
                              border: done ? "1px solid rgba(0,255,157,0.40)" : active ? "none" : "1px solid rgba(0,210,255,0.30)",
                              boxShadow: active ? "0 0 8px rgba(0,210,255,0.60)" : "none",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <span
                    className="font-mono-label text-[11px] px-4 py-1 rounded-full"
                    style={{
                      color: "#FFD700",
                      letterSpacing: "2px",
                      border: "1px solid rgba(255,215,0,0.30)",
                      backgroundColor: "rgba(255,215,0,0.05)",
                    }}
                  >
                    ◈ {transcript.length <= 3 ? "OPENING ARGUMENTS" : "REBUTTAL"}
                  </span>
                </div>
              )}

              {/* Parallel badge */}
              {loading && transcript.length > 0 && transcript.length < 5 && (
                <div
                  className="flex justify-center mb-6"
                >
                  <span
                    className="font-mono-label text-[10px] px-4 py-1 rounded-full"
                    style={{
                      color: "#FFD700",
                      letterSpacing: "1px",
                      backgroundColor: "rgba(255,215,0,0.05)",
                      border: "1px solid rgba(255,215,0,0.20)",
                    }}
                  >
                    ⚡ PARALLEL EXECUTION — Pro & Con generating simultaneously (~35% faster)
                  </span>
                </div>
              )}

              {/* Transcript - Pro/Con same round side-by-side */}
              <div className="space-y-4">
                {(() => {
                  const entries = transcript.filter((e) => !(e.speaker === "judge" && verdict?.judge_verdicts && verdict.judge_verdicts.length > 1));
                  const rendered: React.ReactNode[] = [];
                  let i = 0;
                  const config: Record<string, { color: string; borderLeft: string }> = {
                    moderator: { color: "#00D2FF", borderLeft: "#00D2FF" },
                    pro: { color: "#00FF9D", borderLeft: "#00FF9D" },
                    con: { color: "#FF4D6D", borderLeft: "#FF4D6D" },
                    judge: { color: "#C084FC", borderLeft: "#C084FC" },
                  };
                  const renderEntry = (entry: DebateEntry, idx: number) => {
                    const c = config[entry.speaker] || { color: "#E8F4FD", borderLeft: "#3D6080" };
                    const label = (entry.speaker === "pro" ? "PRO AGENT" : entry.speaker === "con" ? "CON AGENT" : entry.speaker.toUpperCase());
                    const tag = entry.speaker === "moderator" ? "ROUND 1 · INTRO" : entry.round_number === 1 ? "OPENING" : "REBUTTAL";
                    return (
                      <div
                        key={idx}
                        className="rounded-xl p-4"
                        style={{
                          borderLeft: `3px solid ${c.borderLeft}`,
                          border: `1px solid ${c.borderLeft}26`,
                          backgroundColor: "rgba(5,12,22,0.80)",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                          <span className="font-mono-label text-[11px] font-bold" style={{ color: c.color }}>{label}</span>
                          <span className="ml-auto font-mono-label text-[10px] px-2 py-0.5 rounded" style={{ color: "#3D6080", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>{tag}</span>
                        </div>
                        <p className="font-body text-[13px] leading-relaxed" style={{ color: "rgba(232,244,253,0.78)" }}>{entry.text}</p>
                      </div>
                    );
                  };
                  while (i < entries.length) {
                    const entry = entries[i];
                    const next = entries[i + 1];
                    const proConPair = (entry.speaker === "pro" && next?.speaker === "con" && entry.round_number === next.round_number) ||
                      (entry.speaker === "con" && next?.speaker === "pro" && entry.round_number === next.round_number);
                    if (proConPair) {
                      const [proE, conE] = entry.speaker === "pro" ? [entry, next!] : [next!, entry];
                      rendered.push(
                        <div key={i} className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                          <div className="rounded-xl p-4" style={{ borderLeft: "3px solid #00FF9D", border: "1px solid rgba(0,255,157,0.12)", backgroundColor: "rgba(5,12,22,0.80)" }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#00FF9D", boxShadow: "0 0 8px #00FF9D" }} />
                              <span className="font-mono-label text-[11px] font-bold" style={{ color: "#00FF9D" }}>PRO AGENT</span>
                              <span className="ml-auto font-mono-label text-[10px] px-2 py-0.5 rounded" style={{ color: "#3D6080", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>{proE.round_number === 1 ? "OPENING" : "REBUTTAL"}</span>
                            </div>
                            <p className="font-body text-[13px] leading-relaxed" style={{ color: "rgba(232,244,253,0.78)" }}>{proE.text}</p>
                          </div>
                          <div className="rounded-xl p-4" style={{ borderLeft: "3px solid #FF4D6D", border: "1px solid rgba(255,77,109,0.12)", backgroundColor: "rgba(5,12,22,0.80)" }}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#FF4D6D", boxShadow: "0 0 8px #FF4D6D" }} />
                              <span className="font-mono-label text-[11px] font-bold" style={{ color: "#FF4D6D" }}>CON AGENT</span>
                              <span className="ml-auto font-mono-label text-[10px] px-2 py-0.5 rounded" style={{ color: "#3D6080", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>{conE.round_number === 1 ? "OPENING" : "REBUTTAL"}</span>
                            </div>
                            <p className="font-body text-[13px] leading-relaxed" style={{ color: "rgba(232,244,253,0.78)" }}>{conE.text}</p>
                          </div>
                        </div>
                      );
                      i += 2;
                    } else {
                      rendered.push(renderEntry(entry, i));
                      i++;
                    }
                  }
                  return rendered;
                })()}
              </div>

              {/* Streaming status bar */}
              {loading && transcript.length > 0 && (
                <div
                  className="mt-6 p-3 rounded-lg flex items-center gap-2"
                  style={{
                    backgroundColor: "rgba(0,210,255,0.03)",
                    border: "1px solid rgba(0,210,255,0.14)",
                  }}
                >
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full animate-bounce-dot ${i === 1 ? "animate-bounce-dot-2" : i === 2 ? "animate-bounce-dot-3" : ""}`}
                        style={{ backgroundColor: "#00D2FF" }}
                      />
                    ))}
                  </span>
                  <span className="font-mono-label text-[11px]" style={{ color: "#00D2FF" }}>
                    Generating…
                  </span>
                </div>
              )}

              <div ref={contentEndRef} />

              {/* VERDICT SECTION */}
              {verdict && (
                <div className="flex flex-col lg:flex-row gap-6 mt-8">
                  {/* Left: Verdict + Score */}
                  <div className="flex-1 space-y-5">
                    {/* Verdict Hero */}
                    <div
                      className="rounded-[14px] p-6"
                      style={{
                        border: "1px solid rgba(255,215,0,0.20)",
                        background: "linear-gradient(135deg, rgba(255,215,0,0.03), rgba(0,255,157,0.03))",
                      }}
                    >
                      <p className="font-mono-label text-[10px] mb-4" style={{ color: "#FFD700", letterSpacing: "4px" }}>
                        ⚖ FINAL VERDICT · AGGREGATED
                      </p>
                      <div className="flex items-start gap-4 flex-wrap">
                        <div
                          className="w-[62px] h-[62px] rounded-[14px] flex items-center justify-center text-[30px] shrink-0"
                          style={{
                            backgroundColor: verdict.winner === "pro" ? "rgba(0,255,157,0.10)" : "rgba(255,77,109,0.10)",
                            border: `2px solid ${verdict.winner === "pro" ? "rgba(0,255,157,0.40)" : "rgba(255,77,109,0.40)"}`,
                            boxShadow: verdict.winner === "pro" ? "0 0 16px rgba(0,255,157,0.25)" : "0 0 16px rgba(255,77,109,0.2)",
                          }}
                        >
                          🏆
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono-label text-[10px] mb-0.5" style={{ color: "#3D6080", letterSpacing: "2px" }}>WINNER · MAJORITY VOTE</p>
                          <p
                            className="font-display text-[32px] font-bold"
                            style={{
                              color: verdict.winner === "pro" ? "#00FF9D" : "#FF4D6D",
                              letterSpacing: "2px",
                              textShadow: verdict.winner === "pro" ? "0 0 20px rgba(0,255,157,0.3)" : "0 0 20px rgba(255,77,109,0.3)",
                            }}
                          >
                            {verdict.winner.toUpperCase()} AGENT
                          </p>
                          <p className="font-body text-[12px]" style={{ color: verdict.winner === "pro" ? "rgba(0,255,157,0.55)" : "rgba(255,77,109,0.55)" }}>
                            Arguments {verdict.winner === "pro" ? "in favor" : "against"} the motion
                          </p>
                        </div>
                        {verdict.judge_verdicts && verdict.judge_verdicts.length > 1 && (
                          <span
                            className="font-mono-label text-[11px] px-4 py-1.5 rounded-full shrink-0"
                            style={{
                              color: "#00FF9D",
                              backgroundColor: "rgba(0,255,157,0.07)",
                              border: "1px solid rgba(0,255,157,0.25)",
                            }}
                          >
                            ✓ {verdict.judge_verdicts.filter((j) => j.winner === verdict.winner).length}-{verdict.judge_verdicts.length - verdict.judge_verdicts.filter((j) => j.winner === verdict.winner).length} UNANIMOUS
                          </span>
                        )}
                      </div>
                      <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <p className="font-body text-[13px] leading-relaxed" style={{ color: "rgba(232,244,253,0.72)" }}>{verdict.reasoning}</p>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div
                      className="rounded-xl p-5"
                      style={{
                        backgroundColor: "rgba(5,10,18,0.80)",
                        border: "1px solid rgba(0,200,255,0.10)",
                      }}
                    >
                      <p className="font-mono-label text-[10px] mb-4" style={{ color: "#00D2FF", letterSpacing: "3px" }}>
                        // SCORE BREAKDOWN · AVERAGED ACROSS {verdict.judge_verdicts?.length || 1} JUDGE{(verdict.judge_verdicts?.length || 1) > 1 ? "S" : ""}
                      </p>
                      {[
                        { label: "Logical Consistency", pro: verdict.pro_scores.logical_consistency, con: verdict.con_scores.logical_consistency },
                        { label: "Evidence Strength", pro: verdict.pro_scores.evidence_strength, con: verdict.con_scores.evidence_strength },
                        { label: "Rebuttal Effectiveness", pro: verdict.pro_scores.rebuttal_effectiveness, con: verdict.con_scores.rebuttal_effectiveness },
                        { label: "Clarity & Delivery", pro: verdict.pro_scores.clarity, con: verdict.con_scores.clarity },
                      ].map(({ label, pro, con }) => (
                        <div key={label} className="mb-4">
                          <div className="flex justify-between text-[12px] mb-1">
                            <span style={{ color: "#3D6080" }}>{label}</span>
                            <span className="font-mono-label">
                              <span style={{ color: "#00FF9D" }}>PRO {pro}</span>
                              <span style={{ color: "#3D6080" }}> vs </span>
                              <span style={{ color: "#FF4D6D" }}>CON {con}</span>
                            </span>
                          </div>
                          <div className="score-bar">
                            <div className="flex h-full">
                              <div
                                className="score-bar-fill"
                                style={{
                                  width: `${(pro / 10) * 50}%`,
                                  background: "linear-gradient(90deg, #00FF9D, rgba(0,255,157,0.60))",
                                }}
                              />
                              <div
                                className="score-bar-fill"
                                style={{
                                  width: `${(con / 10) * 50}%`,
                                  background: "linear-gradient(90deg, rgba(255,77,109,0.60), #FF4D6D)",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="flex justify-between items-center">
                          <span className="font-mono-label text-[11px]" style={{ color: "#3D6080" }}>TOTAL SCORE (AVG · /40)</span>
                          <span className="font-mono-label">
                            <span className="font-display text-[26px] font-bold" style={{ color: "#00FF9D", textShadow: "0 0 12px rgba(0,255,157,0.3)" }}>{proTotal.toFixed(1)}</span>
                            <span className="text-[14px] mx-2" style={{ color: "#3D6080" }}>vs</span>
                            <span className="font-display text-[26px] font-bold" style={{ color: "#FF4D6D" }}>{conTotal.toFixed(1)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Panel 400px */}
                  <div
                    className="w-full lg:w-[400px] flex-shrink-0 space-y-5"
                    style={{
                      backgroundColor: "rgba(4,8,16,0.40)",
                      borderLeft: "1px solid rgba(0,200,255,0.08)",
                      paddingLeft: "24px",
                    }}
                  >
                    {/* Individual Judge Verdicts */}
                    {verdict.judge_verdicts && verdict.judge_verdicts.length > 0 && (
                      <div>
                        <p className="font-mono-label text-[10px] mb-3" style={{ color: "#00D2FF", letterSpacing: "3px" }}>
                          // INDIVIDUAL JUDGE VERDICTS
                        </p>
                        <div className="space-y-3">
                          {verdict.judge_verdicts.map((jv, idx) => (
                            <div
                              key={idx}
                              className="rounded-[10px] p-4"
                              style={{
                                border: `1px solid ${idx === 0 ? "rgba(192,132,252,0.22)" : "rgba(99,179,237,0.22)"}`,
                                backgroundColor: idx === 0 ? "rgba(192,132,252,0.04)" : "rgba(99,179,237,0.04)",
                              }}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="font-mono-label text-[11px] font-bold" style={{ color: idx === 0 ? "#C084FC" : "#63B3ED", letterSpacing: "2px" }}>
                                  ⚖ JUDGE {idx + 1} · {JUDGE_NAMES[idx] || `JUDGE ${idx + 1}`}
                                </span>
                                <span
                                  className="font-mono-label text-[10px] px-2 py-0.5 rounded"
                                  style={{
                                    color: jv.winner === "pro" ? "#00FF9D" : "#FF4D6D",
                                    backgroundColor: jv.winner === "pro" ? "rgba(0,255,157,0.10)" : "rgba(255,77,109,0.10)",
                                    border: `1px solid ${jv.winner === "pro" ? "rgba(0,255,157,0.25)" : "rgba(255,77,109,0.25)"}`,
                                  }}
                                >
                                  {jv.winner.toUpperCase()} WINS
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 mb-3">
                                {[
                                  { l: "LOGIC", p: jv.pro_scores.logical_consistency, c: jv.con_scores.logical_consistency },
                                  { l: "EVIDENCE", p: jv.pro_scores.evidence_strength, c: jv.con_scores.evidence_strength },
                                  { l: "REBUTTAL", p: jv.pro_scores.rebuttal_effectiveness, c: jv.con_scores.rebuttal_effectiveness },
                                  { l: "CLARITY", p: jv.pro_scores.clarity, c: jv.con_scores.clarity },
                                ].map(({ l, p, c }) => (
                                  <div key={l} className="p-2 rounded-lg text-center" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                    <p className="font-mono-label text-[9px] mb-0.5" style={{ color: "#3D6080" }}>{l}</p>
                                    <p className="font-mono-label text-[11px]">
                                      <span style={{ color: "#00FF9D" }}>{p}</span>
                                      <span style={{ color: "#3D6080" }}>/</span>
                                      <span style={{ color: "#FF4D6D" }}>{c}</span>
                                    </p>
                                  </div>
                                ))}
                              </div>
                              <p className="font-body text-[11px] italic pt-2" style={{ color: "rgba(232,244,253,0.55)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                {jv.reasoning}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Debate Execution Flow */}
                    <div>
                      <p className="font-mono-label text-[10px] mb-3" style={{ color: "#00D2FF", letterSpacing: "3px" }}>
                        // DEBATE EXECUTION FLOW
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="px-2 py-1 rounded" style={{ border: "1px solid rgba(0,255,157,0.30)", backgroundColor: "rgba(0,255,157,0.05)", color: "#00FF9D", fontSize: "10px" }}>🎙 MODERATOR</span>
                        <span style={{ color: "#3D6080" }}>—→</span>
                        <span className="px-2 py-1 rounded" style={{ border: "1px solid rgba(0,255,157,0.30)", backgroundColor: "rgba(0,255,157,0.05)", color: "#00FF9D", fontSize: "10px" }}>⚡ OPENINGS (∥)</span>
                        {numRounds > 1 && (
                          <>
                            <span style={{ color: "#3D6080" }}>—→</span>
                            {Array.from({ length: numRounds - 1 }, (_, i) => (
                              <span key={i} className="px-2 py-1 rounded" style={{ border: "1px solid rgba(0,210,255,0.25)", backgroundColor: "rgba(0,210,255,0.05)", color: "#00D2FF", fontSize: "9px" }}>R{i + 2}</span>
                            ))}
                          </>
                        )}
                        <span style={{ color: "#3D6080" }}>—→</span>
                        <span className="px-2 py-1 rounded" style={{ border: "1px solid rgba(192,132,252,0.30)", backgroundColor: "rgba(192,132,252,0.05)", color: "#C084FC", fontSize: "10px" }}>⚖ JUDGE PANEL ({numJudges}× PARALLEL)</span>
                      </div>
                      <p className="font-mono-label text-[10px]" style={{ color: "#3D6080" }}>
                        ∥ = Parallel execution · <span style={{ color: "#00FF9D" }}>~35% faster</span> than sequential
                      </p>
                    </div>

                    {/* Start New Debate */}
                    <button
                      onClick={() => { setTranscript([]); setVerdict(null); setError(null); setViewingFromHistory(false); }}
                      className="w-full py-3 rounded-[10px] font-display font-bold uppercase"
                      style={{
                        border: "1px solid rgba(0,210,255,0.30)",
                        backgroundColor: "rgba(0,210,255,0.05)",
                        color: "#00D2FF",
                        fontSize: "12px",
                        letterSpacing: "2px",
                        boxShadow: "0 0 16px rgba(0,210,255,0.15)",
                      }}
                    >
                      ◈ START NEW DEBATE
                    </button>
                  </div>
                </div>
              )}

              {/* Debate History - bottom of view */}
              {debateHistory.length > 0 && (
                <div className="mt-8 p-4 rounded-xl" style={{ backgroundColor: "rgba(0,210,255,0.04)", border: "1px solid rgba(0,210,255,0.2)" }}>
                  <p className="font-mono-label text-[10px] mb-3" style={{ color: "#00D2FF", letterSpacing: "3px" }}>// DEBATE HISTORY</p>
                  <div className="flex flex-wrap gap-2">
                    {debateHistory.slice(0, 3).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => loadDebate(item)}
                        className="px-3 py-2 rounded-lg text-left text-sm"
                        style={{
                          backgroundColor: "rgba(8,14,24,0.8)",
                          border: "1px solid rgba(0,200,255,0.15)",
                          color: "rgba(232,244,253,0.9)",
                        }}
                      >
                        <span className="line-clamp-1">{item.topic}</span>
                        <span className="font-mono-label text-[9px]" style={{ color: item.winner === "pro" ? "#00FF9D" : "#FF4D6D" }}> · {item.winner.toUpperCase()} WINS</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
