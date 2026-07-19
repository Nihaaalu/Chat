import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { MessageSquare, Key, User, LogIn, Lock, RefreshCw, Shield, Users, ArrowLeft, Copy, Check } from "lucide-react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase.js";
import { runVerification } from "../lib/recaptcha.js";

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

// Format helper for Room Code input: K7M2-XP9Q
const formatRoomCodeInput = (val: string): string => {
  let cleaned = val.toUpperCase().replace(/\s/g, "").replace(/[^A-Z0-9-]/g, "");
  if (cleaned === "RUBY-CARR" || cleaned === "1317") {
    return cleaned;
  }
  const hex = cleaned.replace(/-/g, "");
  if (hex.length > 4) {
    return hex.slice(0, 4) + "-" + hex.slice(4, 8);
  }
  return hex.slice(0, 8);
};

interface HomeViewProps {
  theme: ThemeConfig;
  onJoin: (
    code: string,
    username?: string,
    password?: string,
    mode?: "login" | "register",
    confirmPassword?: string
  ) => Promise<string | void>;
  onStartRandomChat: () => void;
}

export default function HomeView({ theme, onJoin, onStartRandomChat }: HomeViewProps) {
  const [step, setStep] = useState<"select" | "private-choices" | "join-form" | "create-screen">("select");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [roomFlow, setRoomFlow] = useState<"code-entry" | "register-m1" | "register-m2-or-login" | "login" | "ruby-carr-login">("code-entry");
  const [isRegisterMode, setIsRegisterMode] = useState(true);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    setError("");
    try {
      await runVerification("CREATE_ROOM");
      // 1. Generate unique 8-character alphanumeric code (excluding confusing characters O, I, L)
      const generateAlphanumericCode = () => {
        const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        let part1 = "";
        let part2 = "";
        for (let i = 0; i < 4; i++) {
          part1 += chars.charAt(Math.floor(Math.random() * chars.length));
          part2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${part1}-${part2}`;
      };

      let newCode = "";
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 20) {
        newCode = generateAlphanumericCode();
        if (newCode === "RUBY-CARR") continue;

        const docRef = doc(db, "privateRooms", newCode);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        throw new Error("Could not generate a unique room code. Please try again.");
      }

      let myUid = auth.currentUser?.uid;
      if (!myUid) {
        myUid = sessionStorage.getItem("chat_uid") || "";
        if (!myUid) {
          myUid = "anon-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
          sessionStorage.setItem("chat_uid", myUid);
        }
      }
      const now = Date.now();
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 days

      // 2. Create room document - INITIALLY NO USERS
      await setDoc(doc(db, "privateRooms", newCode), {
        code: newCode,
        createdAt: now,
        expiresAt: expiresAt,
        owner: myUid,
        members: {},
        accounts: {},
        typing: {},
        pinnedMessageId: null
      });

      setGeneratedCode(newCode);
      setStep("create-screen");
    } catch (err: any) {
      setError(err?.message || "Failed to create secure private room.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGeneratedRoom = async () => {
    setLoading(true);
    setError("");
    try {
      const roomRef = doc(db, "privateRooms", generatedCode);
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data();
        const accounts = data.accounts || {};
        setCode(generatedCode);
        setUsername("");
        setPassword("");
        setConfirmPassword("");
        if (Object.keys(accounts).length === 0) {
          setRoomFlow("register-m1");
        } else if (Object.keys(accounts).length === 1) {
          setRoomFlow("register-m2-or-login");
          setIsRegisterMode(true);
        } else {
          setRoomFlow("login");
        }
        setStep("join-form");
      } else {
        setError("Room not found.");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to join created room.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    let cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError("Please enter the room code.");
      return;
    }

    if (cleanCode === "1317") {
      cleanCode = "RUBY-CARR";
      setCode("RUBY-CARR");
    }

    // Step 1: Verification of room code if we are still in "code-entry" mode
    if (roomFlow === "code-entry") {
      setLoading(true);
      try {
        await runVerification("JOIN_ROOM");

        if (cleanCode === "RUBY-CARR") {
          setUsername("");
          setPassword("");
          setConfirmPassword("");
          setRoomFlow("ruby-carr-login");
          setLoading(false);
          return;
        }

        if (cleanCode.length !== 6 && cleanCode.length !== 9) {
          setError("Please enter a valid room code or RUBY-CARR.");
          setLoading(false);
          return;
        }

        const roomRef = doc(db, "privateRooms", cleanCode);
        const snap = await getDoc(roomRef);

        if (!snap.exists()) {
          setError("Room not found.");
          setLoading(false);
          return;
        }

        const data = snap.data();
        const now = Date.now();
        if (data.expiresAt && now > data.expiresAt) {
          setError("Room expired.");
          setLoading(false);
          return;
        }

        const accounts = data.accounts || {};
        const accountsCount = Object.keys(accounts).length;

        setUsername("");
        setPassword("");
        setConfirmPassword("");

        if (accountsCount === 0) {
          setRoomFlow("register-m1");
        } else if (accountsCount === 1) {
          setRoomFlow("register-m2-or-login");
          setIsRegisterMode(true);
        } else {
          setRoomFlow("login");
        }
      } catch (err: any) {
        setError(err?.message || "Failed to verify room.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Step 2: Form submission based on the verified state
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();
    const cleanConfirm = confirmPassword.trim();

    if (roomFlow === "ruby-carr-login") {
      if (!cleanUsername || !cleanPassword) {
        setError("Username and password are required.");
        return;
      }

      setLoading(true);
      try {
        await runVerification("PRIVATE_LOGIN");
        const errMsg = await onJoin(cleanCode, cleanUsername, cleanPassword, "login");
        if (errMsg) {
          setError(errMsg);
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }

    } else if (roomFlow === "register-m1" || (roomFlow === "register-m2-or-login" && isRegisterMode)) {
      if (!cleanUsername) {
        setError("Please enter a username.");
        return;
      }
      if (!cleanPassword || !cleanConfirm) {
        setError("Please enter and confirm your password.");
        return;
      }
      if (cleanPassword !== cleanConfirm) {
        setError("Passwords do not match.");
        return;
      }

      setLoading(true);
      try {
        await runVerification("JOIN_ROOM");
        const errMsg = await onJoin(cleanCode, cleanUsername, cleanPassword, "register", cleanConfirm);
        if (errMsg) {
          setError(errMsg);
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }

    } else {
      // login or register-m2-or-login (and isRegisterMode is false)
      if (!cleanUsername || !cleanPassword) {
        setError("Username and password are required.");
        return;
      }

      setLoading(true);
      try {
        await runVerification("PRIVATE_LOGIN");
        const errMsg = await onJoin(cleanCode, cleanUsername, cleanPassword, "login");
        if (errMsg) {
          setError(errMsg);
        }
      } catch (err: any) {
        setError(err?.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] max-md:min-h-0 px-4 w-full">
      <AnimatePresence mode="wait">
        
        {/* STEP 1: Main Mode Selection */}
        {step === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm flex flex-col gap-6"
          >
            <div className="text-center mb-4">
              <h1 className="text-2xl font-black uppercase tracking-widest" style={{ color: theme.text }}>
                Main Core
              </h1>
              <p className="text-xs opacity-60 mt-1" style={{ color: theme.textSecondary }}>
                Choose your preferred communication environment
              </p>
            </div>

            {/* Private Chat Option Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStep("private-choices")}
              className="p-5 rounded-2xl border text-center cursor-pointer transition-all duration-300"
              style={{ borderColor: theme.border, backgroundColor: theme.card }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${theme.accent}15` }}>
                <Shield className="w-5 h-5" style={{ color: theme.accent }} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: theme.text }}>
                🔒 Private Chat
              </h3>
              <p className="text-xs opacity-60 mb-4" style={{ color: theme.textSecondary }}>
                Invite-only secure conversations
              </p>
              <span className="inline-block px-6 h-9 leading-9 rounded-full text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: theme.accent }}>
                Open
              </span>
            </motion.div>

            {/* Random Chat Option Card */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onStartRandomChat}
              className="p-5 rounded-2xl border text-center cursor-pointer transition-all duration-300"
              style={{ borderColor: theme.border, backgroundColor: theme.card }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${theme.accent}15` }}>
                <Users className="w-5 h-5" style={{ color: theme.accent }} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-1" style={{ color: theme.text }}>
                🌍 Random Chat
              </h3>
              <p className="text-xs opacity-60 mb-4" style={{ color: theme.textSecondary }}>
                Talk with strangers instantly
              </p>
              <span className="inline-block px-6 h-9 leading-9 rounded-full text-xs font-bold uppercase tracking-wider text-white" style={{ backgroundColor: theme.accent }}>
                Start
              </span>
            </motion.div>
          </motion.div>
        )}

        {/* STEP 2: Private Chat Choices */}
        {step === "private-choices" && (
          <motion.div
            key="private-choices"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm flex flex-col gap-5"
          >
            <button
              onClick={() => setStep("select")}
              className="self-start flex items-center gap-1 text-xs font-bold uppercase opacity-60 hover:opacity-100 mb-2 transition-opacity"
              style={{ color: theme.text }}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="text-center mb-2">
              <h2 className="text-xl font-extrabold uppercase tracking-widest" style={{ color: theme.text }}>
                Private Chat
              </h2>
              <p className="text-xs opacity-60 mt-1" style={{ color: theme.textSecondary }}>
                Create a self-cleaning room or enter an invite code
              </p>
            </div>

            {/* Create Private Room Button */}
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full h-14 rounded-2xl border font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.text }}
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" style={{ color: theme.accent }} /> : "Create Private Room"}
            </button>

            {/* Join Private Room Button */}
            <button
              onClick={() => setStep("join-form")}
              className="w-full h-14 rounded-2xl border font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.text }}
            >
              Join Private Room
            </button>
          </motion.div>
        )}

        {/* STEP 3: Create Screen (Displays invite code) */}
        {step === "create-screen" && (
          <motion.div
            key="create-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm flex flex-col gap-6 text-center"
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-1" style={{ backgroundColor: `${theme.accent}15` }}>
              <Shield className="w-6 h-6" style={{ color: theme.accent }} />
            </div>

            <div>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-1" style={{ color: theme.text }}>
                Room Created Successfully
              </h2>
              <p className="text-[10px] opacity-60 max-w-[280px] mx-auto leading-relaxed" style={{ color: theme.textSecondary }}>
                Share this invite code with your partner. The room and all its history will expire and be permanently wiped in exactly 30 days.
              </p>
            </div>

            {/* Code display box */}
            <div 
              className="h-16 rounded-2xl border flex items-center justify-center gap-4 px-6 relative"
              style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}
            >
              <span className="font-mono text-2xl font-black tracking-[0.25em] pl-2" style={{ color: theme.accent }}>
                {generatedCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="absolute right-4 p-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-90"
                style={{ backgroundColor: `${theme.accent}12`, color: theme.accent }}
                title="Copy Room Code"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              onClick={handleJoinGeneratedRoom}
              className="w-full h-12 rounded-full font-bold text-xs uppercase tracking-widest text-white cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ backgroundColor: theme.accent }}
            >
              {loading ? <CatLoader /> : "Enter Chat Room"}
            </button>
          </motion.div>
        )}

        {/* STEP 4: Join Room Form */}
        {step === "join-form" && (
          <motion.div
            key="join-form"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-sm flex flex-col gap-4"
          >
            <button
              onClick={() => {
                setError("");
                if (roomFlow !== "code-entry") {
                  setRoomFlow("code-entry");
                  setUsername("");
                  setPassword("");
                  setConfirmPassword("");
                } else {
                  setStep("private-choices");
                }
              }}
              className="self-start flex items-center gap-1 text-xs font-bold uppercase opacity-60 hover:opacity-100 mb-1 transition-opacity"
              style={{ color: theme.text }}
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <form onSubmit={handleSubmitJoin} className="flex flex-col gap-4 w-full">
              {/* Room Code */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
                  Room Code
                </label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: theme.text }} />
                    <input
                      type="text"
                      maxLength={9}
                      value={code}
                      onChange={(e) => {
                        setError("");
                        const input = e.target;
                        const start = input.selectionStart || 0;
                        const oldLen = input.value.length;
                        const formatted = formatRoomCodeInput(input.value);
                        setCode(formatted);
                        setTimeout(() => {
                          const newLen = formatted.length;
                          let newStart = start;
                          if (newLen > oldLen && start === oldLen && formatted[newLen - 2] === "-") {
                            newStart = start + 1;
                          }
                          if (newLen < oldLen && oldLen === 5 && newLen === 4) {
                            newStart = 4;
                          }
                          input.setSelectionRange(newStart, newStart);
                        }, 0);
                      }}
                      placeholder="Enter Invite Code"
                      disabled={loading || roomFlow !== "code-entry"}
                      className="w-full h-12 pl-12 pr-4 rounded-xl text-center font-mono text-lg tracking-[0.1em] font-bold border transition-all duration-300 outline-none disabled:opacity-80"
                      style={{ borderColor: roomFlow !== "code-entry" ? theme.accent : theme.border, backgroundColor: theme.inputBg, color: theme.text }}
                      onFocus={(e) => e.target.style.borderColor = theme.accent}
                      onBlur={(e) => e.target.style.borderColor = theme.border}
                    />
                  </div>
                  {roomFlow !== "code-entry" && (
                    <button
                      type="button"
                      onClick={() => {
                        setRoomFlow("code-entry");
                        setUsername("");
                        setPassword("");
                        setConfirmPassword("");
                        setError("");
                      }}
                      className="px-4 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all"
                      style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.card }}
                    >
                      Change
                    </button>
                  )}
                </div>
              </div>

              {/* Mode toggle if in register-m2-or-login state */}
              {roomFlow === "register-m2-or-login" && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex p-1 rounded-xl border"
                  style={{ borderColor: theme.border, backgroundColor: theme.inputBg }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(true);
                      setError("");
                    }}
                    className="flex-1 py-2 text-center text-xs font-bold uppercase rounded-lg transition-all"
                    style={{
                      backgroundColor: isRegisterMode ? theme.accent : "transparent",
                      color: isRegisterMode ? "#ffffff" : theme.text
                    }}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegisterMode(false);
                      setError("");
                    }}
                    className="flex-1 py-2 text-center text-xs font-bold uppercase rounded-lg transition-all"
                    style={{
                      backgroundColor: !isRegisterMode ? theme.accent : "transparent",
                      color: !isRegisterMode ? "#ffffff" : theme.text
                    }}
                  >
                    Login
                  </button>
                </motion.div>
              )}

              {/* Subtitle instructions based on flow */}
              {roomFlow === "register-m1" && (
                <div className="text-center py-1">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.accent }}>
                    🆕 First Member Registration
                  </p>
                  <p className="text-[10px] opacity-60 mt-0.5" style={{ color: theme.textSecondary }}>
                    Choose a username and password to secure your account in this room.
                  </p>
                </div>
              )}
              {roomFlow === "register-m2-or-login" && isRegisterMode && (
                <div className="text-center py-1">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.accent }}>
                    🆕 Second Member Registration
                  </p>
                  <p className="text-[10px] opacity-60 mt-0.5" style={{ color: theme.textSecondary }}>
                    Create credentials for the second account. After this, registration is disabled.
                  </p>
                </div>
              )}
              {roomFlow === "register-m2-or-login" && !isRegisterMode && (
                <div className="text-center py-1">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.accent }}>
                    🔐 Member Login
                  </p>
                  <p className="text-[10px] opacity-60 mt-0.5" style={{ color: theme.textSecondary }}>
                    Enter your credentials to access the room.
                  </p>
                </div>
              )}
              {roomFlow === "login" && (
                <div className="text-center py-1">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: theme.accent }}>
                    🔐 Room is Full - Login Only
                  </p>
                  <p className="text-[10px] opacity-60 mt-0.5" style={{ color: theme.textSecondary }}>
                    Enter your registered username and password to join.
                  </p>
                </div>
              )}

              {/* Dynamic fields based on flow */}
              {roomFlow !== "code-entry" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex flex-col gap-4 overflow-hidden"
                >
                  {/* Username */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
                      Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: theme.text }} />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setError("");
                          setUsername(e.target.value);
                        }}
                        placeholder={roomFlow === "register-m1" || (roomFlow === "register-m2-or-login" && isRegisterMode) ? "Create Username" : "Enter Username"}
                        disabled={loading}
                        className="w-full h-12 pl-12 pr-4 rounded-xl text-sm border transition-all duration-300 outline-none"
                        style={{ borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }}
                        onFocus={(e) => e.target.style.borderColor = theme.accent}
                        onBlur={(e) => e.target.style.borderColor = theme.border}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: theme.text }} />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setError("");
                          setPassword(e.target.value);
                        }}
                        placeholder={roomFlow === "register-m1" || (roomFlow === "register-m2-or-login" && isRegisterMode) ? "Create Password" : "Enter Password"}
                        disabled={loading}
                        className="w-full h-12 pl-12 pr-4 rounded-xl text-sm border transition-all duration-300 outline-none"
                        style={{ borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }}
                        onFocus={(e) => e.target.style.borderColor = theme.accent}
                        onBlur={(e) => e.target.style.borderColor = theme.border}
                      />
                    </div>
                  </div>

                  {/* Confirm Password - only shown during registration */}
                  {(roomFlow === "register-m1" || (roomFlow === "register-m2-or-login" && isRegisterMode)) && (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold uppercase tracking-wider pl-1" style={{ color: theme.textSecondary }}>
                        Confirm Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" style={{ color: theme.text }} />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => {
                            setError("");
                            setConfirmPassword(e.target.value);
                          }}
                          placeholder="Confirm Password"
                          disabled={loading}
                          className="w-full h-12 pl-12 pr-4 rounded-xl text-sm border transition-all duration-300 outline-none"
                          style={{ borderColor: theme.border, backgroundColor: theme.inputBg, color: theme.text }}
                          onFocus={(e) => e.target.style.borderColor = theme.accent}
                          onBlur={(e) => e.target.style.borderColor = theme.border}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Error Display */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs font-medium p-3 rounded-lg border text-center leading-normal"
                  style={{ borderColor: "#fca5a5", backgroundColor: "#fef2f2", color: "#b91c1c" }}
                >
                  {error}
                </motion.div>
              )}

              {/* Join button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full flex items-center justify-center gap-2 font-semibold tracking-wide transition-all duration-300 cursor-pointer select-none mt-2 disabled:opacity-50"
                style={{ backgroundColor: theme.accent, color: "#ffffff" }}
              >
                {loading ? (
                  theme.bg === "#FFF8F2" ? <CatLoader /> : <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  roomFlow === "code-entry" ? <RefreshCw className="w-5 h-5" /> : <LogIn className="w-5 h-5" />
                )}
                {loading ? "Connecting..." : (roomFlow === "code-entry" ? "Verify Code" : "Join Chat")}
              </button>
            </form>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
