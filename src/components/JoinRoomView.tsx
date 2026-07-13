import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { ArrowLeft, Key, User, LogIn } from "lucide-react";

interface JoinRoomViewProps {
  theme: ThemeConfig;
  prefilledCode: string;
  onBack: () => void;
  onJoin: (code: string, name: string) => Promise<string | void>; // returns error message if failed
}

export default function JoinRoomView({ theme, prefilledCode, onBack, onJoin }: JoinRoomViewProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (prefilledCode) {
      setCode(prefilledCode);
    }
  }, [prefilledCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanCode = code.trim();
    const cleanName = name.trim();

    if (!cleanCode) {
      setError("Please enter a 4-digit room code.");
      return;
    }
    if (cleanCode.length !== 4 || isNaN(Number(cleanCode))) {
      setError("Room code must be exactly 4 digits.");
      return;
    }
    if (!cleanName) {
      setError("Please enter your nickname.");
      return;
    }

    setLoading(true);
    try {
      const errMsg = await onJoin(cleanCode, cleanName);
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
    <div className="flex flex-col min-h-[70vh]">
      {/* Back Button */}
      <div className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium cursor-pointer py-1.5 px-3 rounded-full border transition-all duration-300"
          style={{
            borderColor: theme.border,
            backgroundColor: theme.card,
            color: theme.text
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <h2 className="text-xl font-bold tracking-tight mb-1" style={{ color: theme.text }}>
          Join Conversation
        </h2>
        <p className="text-sm mb-6" style={{ color: theme.textSecondary }}>
          Enter the room key and select your chat moniker.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Room Code */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
              4-Digit Code
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

          {/* Nickname */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
              Your Name
            </label>
            <div className="relative">
              <User 
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40"
                style={{ color: theme.text }}
              />
              <input
                type="text"
                maxLength={15}
                value={name}
                onChange={(e) => {
                  setError("");
                  setName(e.target.value);
                }}
                placeholder="Enter name"
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
            <LogIn className="w-5 h-5" />
            {loading ? "Connecting..." : "Join Chat"}
          </button>
        </form>
      </div>
    </div>
  );
}
