import React, { useState } from "react";
import { motion } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { MessageSquare, Key, User, LogIn, Lock, RefreshCw } from "lucide-react";

// Lightweight animated cat paw loader
const CatLoader = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="inline-block">
    <style>{`
      @keyframes paw-pulse-home {
        0%, 100% { opacity: 0.2; transform: scale(0.9); }
        35% { opacity: 1; transform: scale(1.05); }
      }
      .toe-h1 { animation: paw-pulse-home 1.2s infinite ease-in-out; }
      .toe-h2 { animation: paw-pulse-home 1.2s infinite ease-in-out 0.15s; }
      .toe-h3 { animation: paw-pulse-home 1.2s infinite ease-in-out 0.3s; }
      .toe-h4 { animation: paw-pulse-home 1.2s infinite ease-in-out 0.45s; }
      .pad-hmain { animation: paw-pulse-home 1.2s infinite ease-in-out 0.6s; }
    `}</style>
    <path className="pad-hmain origin-center" fill="currentColor" d="M12 18c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
    <circle className="toe-h1 origin-center" cx="7" cy="8" r="1.5" fill="currentColor" />
    <circle className="toe-h2 origin-center" cx="10" cy="5" r="1.5" fill="currentColor" />
    <circle className="toe-h3 origin-center" cx="14" cy="5" r="1.5" fill="currentColor" />
    <circle className="toe-h4 origin-center" cx="17" cy="8" r="1.5" fill="currentColor" />
  </svg>
);

interface HomeViewProps {
  theme: ThemeConfig;
  onJoin: (code: string, username: string, password: string) => Promise<string | void>;
}

export default function HomeView({ theme, onJoin }: HomeViewProps) {
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanCode = code.trim();
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanCode) {
      setError("Please enter the room code.");
      return;
    }
    if (!cleanUsername) {
      setError("Please enter the username.");
      return;
    }
    if (!cleanPassword) {
      setError("Please enter the password.");
      return;
    }

    setLoading(true);
    try {
      const errMsg = await onJoin(cleanCode, cleanUsername, cleanPassword);
      if (errMsg) {
        setError(errMsg);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] max-md:min-h-0 px-4">
      {/* Visual Icon Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8"
        style={{ backgroundColor: `${theme.accent}15` }}
      >
        <MessageSquare className="w-8 h-8" style={{ color: theme.accent }} />
      </motion.div>

      {/* Title & Subtitle */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="text-center mb-8"
      >
        <h1 
          className="text-3xl font-extrabold tracking-widest uppercase mb-3"
          style={{ color: theme.text }}
        >
          Private Chat
        </h1>
        <p 
          className="text-sm max-w-xs mx-auto"
          style={{ color: theme.textSecondary }}
        >
          Secure temporary one-to-one conversation.
        </p>
      </motion.div>

      {/* Form */}
      <motion.form 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        onSubmit={handleSubmit} 
        className="flex flex-col gap-5 w-full max-w-sm"
      >
        {/* Room Code */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
            Room Code
          </label>
          <div className="relative">
            <Key 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40"
              style={{ color: theme.text }}
            />
            <input
              type="text"
              maxLength={4}
              value={code}
              onChange={(e) => {
                setError("");
                setCode(e.target.value.replace(/\D/g, ""));
              }}
              placeholder="0000"
              disabled={loading}
              className="w-full h-12 pl-12 pr-4 rounded-xl text-center font-mono text-xl tracking-[0.2em] font-bold border transition-all duration-300 outline-none"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.inputBg,
                color: theme.text
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.accent;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.border;
              }}
            />
          </div>
        </div>

        {/* Username */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
            Username
          </label>
          <div className="relative">
            <User 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40"
              style={{ color: theme.text }}
            />
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setError("");
                setUsername(e.target.value);
              }}
              placeholder="Enter username"
              disabled={loading}
              className="w-full h-12 pl-12 pr-4 rounded-xl text-sm border transition-all duration-300 outline-none"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.inputBg,
                color: theme.text
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.accent;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.border;
              }}
            />
          </div>
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
            Password
          </label>
          <div className="relative">
            <Lock 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40"
              style={{ color: theme.text }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setError("");
                setPassword(e.target.value);
              }}
              placeholder="Enter password"
              disabled={loading}
              className="w-full h-12 pl-12 pr-4 rounded-xl text-sm border transition-all duration-300 outline-none"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.inputBg,
                color: theme.text
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.accent;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.border;
              }}
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-medium p-3 rounded-lg border text-center leading-normal"
            style={{
              borderColor: "#fca5a5",
              backgroundColor: "#fef2f2",
              color: "#b91c1c"
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Join button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-full flex items-center justify-center gap-2 font-semibold tracking-wide transition-all duration-300 cursor-pointer select-none mt-2 disabled:opacity-50"
          style={{
            backgroundColor: theme.accent,
            color: "#ffffff"
          }}
        >
          {loading ? (
            theme.bg === "#FFF8F2" ? <CatLoader /> : <RefreshCw className="w-5 h-5 animate-spin" />
          ) : (
            <LogIn className="w-5 h-5" />
          )}
          {loading ? "Connecting..." : "Join Chat"}
        </button>
      </motion.form>
    </div>
  );
}
