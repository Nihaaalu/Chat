import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { ThemeType, MessageType } from "../types.js";
import { ArrowLeft, RefreshCw, Send, Users, ShieldAlert, X, CornerUpLeft, Settings, Volume2, VolumeX } from "lucide-react";

// Synthesizes a high-fidelity, subtle dual-tone chime using Web Audio API (perfectly self-contained)
const playNotificationSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const audioContext = new AudioCtx();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gainNode.gain.setValueAtTime(0, start);
      gainNode.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gainNode);
      gainNode.connect(audioContext.destination);
      osc.start(start);
      osc.stop(start + duration);
    };
    const now = audioContext.currentTime;
    playTone(880, now, 0.22); // A5
    playTone(1046.5, now + 0.08, 0.32); // C6
  } catch (err) {
    console.error("Failed to play notification sound:", err);
  }
};

// Custom, highly elegant cozy cat cafe line-art logo
const CatSvgLogo = ({ className = "w-5 h-5", isBlinking = false }: { className?: string; isBlinking?: boolean }) => (
  <motion.svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    animate={isBlinking ? { scaleY: [1, 0.1, 1] } : {}}
    transition={{ duration: 0.35, ease: "easeInOut" }}
  >
    {/* Cat ears and head contour */}
    <path d="M3 11c0 4.4 3.6 8 8 8s8-3.6 8-8c0-1.8-.6-3.6-1.6-5L15 8.5H9L6.6 6C5.6 7.4 5 9.2 5 11z" fill="currentColor" fillOpacity="0.12" />
    {/* Sleepy curved eyes */}
    <path d="M8.5 12.5c.3 .4.9 .4 1.2 0" />
    <path d="M14.5 12.5c.3 .4.9 .4 1.2 0" />
    {/* Heart-shaped cute nose */}
    <path d="M11.5 14.5h1l-.5 .8z" fill="currentColor" stroke="none" />
  </motion.svg>
);

// Cozy staggered paw loader for the cat café theme
const StaggeredPawLoader = () => (
  <div className="flex items-center gap-1 inline-flex shrink-0">
    <style>{`
      @keyframes paw-fade {
        0%, 100% { opacity: 0.15; transform: scale(0.85); }
        33% { opacity: 1; transform: scale(1.05); }
      }
      .paw-step-1 { animation: paw-fade 1.2s infinite ease-in-out; }
      .paw-step-2 { animation: paw-fade 1.2s infinite ease-in-out 0.3s; }
      .paw-step-3 { animation: paw-fade 1.2s infinite ease-in-out 0.6s; }
    `}</style>
    {[1, 2, 3].map((num) => (
      <svg key={num} width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={`paw-step-${num} text-amber-600`}>
        <path d="M8,14 C6,14 4.5,12.5 4.5,10.5 C4.5,9.5 5.5,8.5 8,8.5 C10.5,8.5 11.5,9.5 11.5,10.5 C11.5,12.5 10,14 8,14 Z" />
        <circle cx="4" cy="6" r="1.5" />
        <circle cx="6.5" cy="4" r="1.5" />
        <circle cx="9.5" cy="4" r="1.5" />
        <circle cx="12" cy="6" r="1.5" />
      </svg>
    ))}
  </div>
);

// High-fidelity custom illustration of a sleeping cat with floating Zzz letters
const SleepingCatIllustration = () => (
  <div className="relative w-36 h-24 mb-4 flex items-center justify-center">
    {/* Animated Zzz floating up */}
    <div className="absolute right-4 top-0 flex flex-col items-start font-mono text-[10px] font-bold text-amber-700/60 select-none">
      <span className="cat-zzz-1 absolute">Z</span>
      <span className="cat-zzz-2 absolute ml-2 mt-1">z</span>
      <span className="cat-zzz-3 absolute ml-4 mt-2 text-[7px]">z</span>
    </div>
    {/* Sleepy cat SVG */}
    <svg viewBox="0 0 100 60" className="w-28 h-20 text-amber-600/80" fill="currentColor">
      {/* Sleepy cat body (curved ball) */}
      <path d="M20,45 C20,30 35,20 55,20 C75,20 85,32 85,45 C85,52 75,55 55,55 C35,55 20,52 20,45 Z" fill="currentColor" fillOpacity="0.15" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Cat head tucked in */}
      <circle cx="32" cy="40" r="13" fill="#FFF8F2" stroke="#B45309" strokeWidth="2.5" />
      {/* Ears */}
      <path d="M22,32 L20,20 L30,28 Z" fill="#F5D7A1" stroke="#B45309" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M42,32 L44,20 L34,28 Z" fill="#F5D7A1" stroke="#B45309" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Curved sleeping eyes */}
      <path d="M24,42 C25,44 28,44 29,42" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
      <path d="M35,42 C36,44 39,44 40,42" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" />
      {/* Nose */}
      <path d="M31.5,45 L32.5,45 L32,45.8 Z" fill="#B45309" />
      {/* Tail curled around body */}
      <path d="M84,45 C88,48 90,52 85,54 C80,56 75,53 72,50" fill="none" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  </div>
);

import { collection, doc, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase.js";
import ThemeSelector from "./ThemeSelector.js";
import MessageCard from "./MessageCard.js";

interface ChatViewProps {
  theme: ThemeConfig;
  currentThemeType: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  roomCode: string;
  sessionToken: string;
  nickname: string;
  onLeave: () => void;
  registerUnsubscribe: (unsub: () => void) => void;
}

export default function ChatView({
  theme,
  currentThemeType,
  onThemeChange,
  roomCode,
  sessionToken,
  nickname,
  onLeave,
  registerUnsubscribe
}: ChatViewProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);

  // STEP 1 & STEP 2: Process, sanitize, and log Firestore documents
  const processFetchedMessages = (rawMsgs: MessageType[]) => {
    // Check if Firestore contains documents with empty text, null values, typical placeholders, or SYSTEM messages.
    // We want a pure continuous chat feed exactly like WhatsApp or Instagram, so we exclude SYSTEM messages completely.
    const filtered = rawMsgs.filter(m => {
      if (!m || !m.id || !m.content) return false;
      const content = m.content.trim();
      if (content === "") return false;

      // Filter out typical placeholders
      const lowerContent = content.toLowerCase();
      if (
        lowerContent === "null" ||
        lowerContent === "undefined" ||
        lowerContent === "date_separator" ||
        lowerContent === "reply_placeholder" ||
        lowerContent === "deleted_message"
      ) {
        return false;
      }

      // Filter out SYSTEM notifications to guarantee a 100% clean and flat continuous chat feed with no layout space from them
      if (m.sender === "SYSTEM" || m.sender === "system") {
        return false;
      }

      return true;
    });

    // Ensure no duplicates
    const uniqueMap = new Map<string, MessageType>();
    filtered.forEach(m => {
      uniqueMap.set(m.id, m);
    });
    const unique = Array.from(uniqueMap.values());

    // Ensure strict chronological sort by createdAt ascending
    const sorted = unique.sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Log every Firestore document after loading (console.table)
    console.log("Firestore documents after loading:");
    console.table(sorted.map(m => ({
      id: m.id,
      sender: m.sender,
      text: m.content,
      timestamp: m.createdAt,
      replyToMessageId: m.replyToMessageId || "none"
    })));

    return sorted;
  };
  const [participants, setParticipants] = useState<{ id: string; name: string; joinedAt: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [activeMicroAnimation, setActiveMicroAnimation] = useState<"paw" | "blink" | null>(null);

  // Micro-animations scheduling: randomly every 45-75 seconds
  useEffect(() => {
    if (currentThemeType !== "cat") return;

    let timer: NodeJS.Timeout;

    const triggerAnimation = () => {
      const chosen = Math.random() > 0.5 ? "paw" : "blink";
      setActiveMicroAnimation(chosen);

      // Animation lasts 1.8 seconds (completely subtle)
      setTimeout(() => {
        setActiveMicroAnimation(null);
      }, 1800);

      // Schedule next one randomly between 45 and 75 seconds
      const nextDelay = (45 + Math.random() * 30) * 1000;
      timer = setTimeout(triggerAnimation, nextDelay);
    };

    // First trigger after 20 seconds of active chat so they see it soon, but not instantly
    timer = setTimeout(triggerAnimation, 20000);

    return () => {
      clearTimeout(timer);
    };
  }, [currentThemeType]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem("chat_sound_enabled") !== "false";
    } catch (e) {
      return true;
    }
  });

  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Request notification permission the first time user1 logs in
  useEffect(() => {
    if (nickname === "user1" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, [nickname]);

  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (replyingTo) {
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  const handleReplyHeaderClick = (replyToId: string) => {
    setHighlightedMessageId(replyToId);
    const el = document.getElementById(`msg-${replyToId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setTimeout(() => {
      setHighlightedMessageId(null);
    }, 1500);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Set up Firebase listeners
  useEffect(() => {
    if (!roomCode) return;

    // 1. Listen to active room document for participant updates
    const roomRef = doc(db, "chat", roomCode);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Room doesn't exist yet, we will stay in the session and wait
        return;
      }

      const data = snapshot.data();
      const membersMap = data.members || {};
      
      // Map members map (uid -> name) to visual participants structure
      const membersList = Object.entries(membersMap).map(([uid, name]) => ({
        id: uid,
        name: name as string,
        joinedAt: new Date().toISOString()
      }));

      setParticipants(membersList);
      setConnected(true);
    }, (err) => {
      console.error("Room document snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, `chat/${roomCode}`);
    });

    // 2. Listen to real-time messages subcollection
    const messagesRef = collection(db, "chat", roomCode, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
    let isInitial = true;
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs: MessageType[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          roomCode,
          sender: data.sender || "SYSTEM",
          content: data.text || "",
          createdAt: data.timestamp 
            ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) 
            : new Date().toISOString(),
          replyToMessageId: data.replyToMessageId || undefined
        });
      });

      // Handle real-time notifications for user1 when user2 sends a message
      if (!isInitial) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const sender = data.sender;
            const text = data.text || "";
            
            if (sender === "user2") {
              const hasFocus = typeof (window as any).hasFocus === "function" 
                ? (window as any).hasFocus() 
                : (document.hasFocus ? document.hasFocus() : true);
              const isFocused = document.visibilityState === "visible" && hasFocus;

              if (!isFocused && nickname === "user1") {
                const permissionGranted = "Notification" in window && Notification.permission === "granted";

                // Show browser notification if permitted
                if (permissionGranted) {
                  const title = "Private Chat";
                  const body = `user2:\n${text}`;
                  const iconUrl = document.querySelector("link[rel*='icon']")?.getAttribute("href") || "/favicon.ico";

                  const notification = new Notification(title, {
                    body,
                    icon: iconUrl,
                    tag: "private-chat-new-msg"
                  });

                  notification.onclick = () => {
                    window.focus();
                    try {
                      parent.focus();
                    } catch (e) {}
                  };
                }

                // Play subtle tone if enabled and permission is granted
                if (soundEnabledRef.current && permissionGranted) {
                  playNotificationSound();
                }
              }
            }
          }
        });
      } else {
        isInitial = false;
      }

      const processedMsgs = processFetchedMessages(msgs);
      setMessages(processedMsgs);
      scrollToBottom();
    }, (err) => {
      console.error("Messages subcollection snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, `chat/${roomCode}/messages`);
    });

    registerUnsubscribe(unsubscribeRoom);
    registerUnsubscribe(unsubscribeMessages);

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
    };
  }, [roomCode, onLeave, registerUnsubscribe]);

  // Manual message pull (Refresh button)
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const messagesRef = collection(db, "chat", roomCode, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `chat/${roomCode}/messages`);
        throw err;
      }
      const msgs: MessageType[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          roomCode,
          sender: data.sender || "SYSTEM",
          content: data.text || "",
          createdAt: data.timestamp 
            ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : new Date(data.timestamp).toISOString()) 
            : new Date().toISOString(),
          replyToMessageId: data.replyToMessageId || undefined
        });
      });
      const processedMsgs = processFetchedMessages(msgs);
      setMessages(processedMsgs);
      scrollToBottom();
    } catch (err) {
      console.error("Manual refresh messages failed:", err);
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  // Send message to Firestore
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim()) return;

    const text = inputValue.trim();
    setInputValue("");

    const replyToId = replyingTo?.id;
    if (replyingTo) {
      setReplyingTo(null);
    }

    try {
      const messagesRef = collection(db, "chat", roomCode, "messages");
      const messageDoc: Record<string, any> = {
        sender: nickname,
        text: text,
        timestamp: serverTimestamp()
      };
      if (replyToId) {
        messageDoc.replyToMessageId = replyToId;
      }
      try {
        await addDoc(messagesRef, messageDoc);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `chat/${roomCode}/messages`);
        throw err;
      }
    } catch (err) {
      console.error("Failed to add message:", err);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (err) {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden">
      {/* Background pattern for Cat Theme */}
      {currentThemeType === "cat" && (
        <>
          {/* Layer 1: Cozy radial cream-caramel gradient */}
          <div 
            className="absolute inset-0 pointer-events-none z-0" 
            style={{ 
              background: "radial-gradient(circle at 50% 30%, #FFFDFB 0%, #FFF4EB 50%, #FFF0E2 100%)"
            }} 
          />
          {/* Layer 2: Ultra-subtle paper/noise texture */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.015] z-0" 
            style={{ 
              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`
                <svg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'>
                  <filter id='noiseFilter'>
                    <feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/>
                  </filter>
                  <rect width='100%' height='100%' filter='url(#noiseFilter)'/>
                </svg>
              `)}")`
            }} 
          />
          {/* Layer 3: Faint hand-drawn paw and yarn repeating pattern */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" 
            style={{ 
              backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`
                <svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'>
                  <!-- Cute micro paw print -->
                  <g fill='#D97706'>
                    <path d='M30 45 c-2.2 0 -3.5 -1.8 -3.5 -4 c0 -1.2 1.2 -2.2 3.5 -2.2 c2.3 0 3.5 1 3.5 2.2 c0 2.2 -1.3 4 -3.5 4 z' />
                    <circle cx='25' cy='35' r='1.2' />
                    <circle cx='28.3' cy='32.5' r='1.2' />
                    <circle cx='31.7' cy='32.5' r='1.2' />
                    <circle cx='35' cy='35' r='1.2' />
                  </g>
                  <!-- Yarn ball with a trailing thread -->
                  <g stroke='#D97706' fill='none' stroke-width='0.6'>
                    <circle cx='90' cy='85' r='6.5' />
                    <path d='M86.5 81.5 C89 88.5 91 81.5 93.5 88.5' />
                    <path d='M83.5 85 C90.5 82.5 83.5 90.5 96.5 85' />
                    <path d='M90 91.5 C91 93 93 94 95 93' />
                  </g>
                </svg>
              `)}")`,
              backgroundRepeat: "repeat",
              backgroundSize: "120px 120px"
            }}
          />
        </>
      )}

      {/* Floating Paw micro-animation */}
      {activeMicroAnimation === "paw" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: [0, 0.25, 0.25, 0], scale: [0.8, 1.05, 1.05, 0.9], y: [10, 0, 0, -12] }}
          transition={{ duration: 1.8, times: [0, 0.15, 0.85, 1], ease: "easeInOut" }}
          className="absolute left-6 bottom-24 pointer-events-none z-10"
          style={{ color: theme.accent }}
        >
          <svg width="32" height="32" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8,14 C6,14 4.5,12.5 4.5,10.5 C4.5,9.5 5.5,8.5 8,8.5 C10.5,8.5 11.5,9.5 11.5,10.5 C11.5,12.5 10,14 8,14 Z" />
            <circle cx="4" cy="6" r="1.5" />
            <circle cx="6.5" cy="4" r="1.5" />
            <circle cx="9.5" cy="4" r="1.5" />
            <circle cx="12" cy="6" r="1.5" />
          </svg>
        </motion.div>
      )}

      {/* HEADER TOP BAR */}
      <header 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-16 px-4 flex items-center justify-between border-b z-20 transition-all duration-300"
        style={{ 
          borderColor: theme.border, 
          backgroundColor: theme.bg,
          boxShadow: currentThemeType === "cat" ? "0 2px 14px rgba(139, 126, 116, 0.05)" : "none"
        }}
      >
        <button
          onClick={onLeave}
          className="p-2 -ml-2 rounded-full transition-colors duration-200 cursor-pointer text-sm font-medium flex items-center gap-1 opacity-70 hover:opacity-100"
          style={{ color: theme.text }}
          title="Leave Chat"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="sr-only sm:not-sr-only text-xs">Leave</span>
        </button>

        {/* Room Code Display */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex items-center gap-1" style={{ color: theme.text }}>
            {currentThemeType === "cat" ? (
              <span className="flex items-center gap-1.5 text-amber-800 font-extrabold tracking-widest">
                <CatSvgLogo className="w-4 h-4 text-amber-600 shrink-0" isBlinking={activeMicroAnimation === "blink"} />
                Secure Vault
              </span>
            ) : "Secure Vault"}
          </span>
          <span className="text-sm font-mono font-bold tracking-widest pl-1" style={{ color: theme.text }}>
            #{roomCode}
          </span>
        </div>

        {/* Action Tray */}
        <div className="flex items-center gap-2">
          {/* Theme buttons */}
          <ThemeSelector currentTheme={currentThemeType} onThemeChange={onThemeChange} />

          {/* Settings button - ONLY FOR USER1 */}
          {nickname === "user1" && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full border transition-all duration-300 cursor-pointer active:scale-90"
              style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.text }}
              title="Chat Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          {/* Manual pull/refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer ${
              refreshing && currentThemeType !== "cat" ? "animate-spin" : "active:scale-90"
            }`}
            style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.text }}
            title="Refresh Messages"
          >
            {refreshing && currentThemeType === "cat" ? (
              <StaggeredPawLoader />
            ) : (
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            )}
          </button>
        </div>
      </header>

      {/* ACTIVE PARTICIPANTS TRAY */}
      <div 
        className="mt-20 px-4 py-2 flex items-center justify-between rounded-2xl border text-xs font-medium transition-all duration-300"
        style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.text }}
      >
        <div className="flex items-center gap-1.5 opacity-80">
          <Users className="w-3.5 h-3.5" style={{ color: theme.accent }} />
          <span>Participants ({participants.length}/2)</span>
        </div>
        <div className="flex items-center gap-2">
          {participants.map((p) => (
            <span 
              key={p.id}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
              style={{
                backgroundColor: p.name === nickname ? `${theme.accent}15` : `${theme.text}10`,
                color: p.name === nickname ? theme.accent : theme.text
              }}
            >
              {p.name === nickname ? "You" : p.name}
            </span>
          ))}
          {participants.length < 2 && (
            <span className="animate-pulse text-[10px] opacity-50 font-mono">
              waiting for peer...
            </span>
          )}
        </div>
      </div>

      {/* MESSAGE LIST */}
      <main 
        className={`flex-1 px-1 pt-4 pb-28 ${currentThemeType === "cat" ? "cat-scrollbar" : ""}`}
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "stretch",
          gap: "12px",
          overflowY: "auto"
        }}
      >
        {/* STEP 3: Log messages.length immediately before rendering */}
        {(() => {
          console.log("Immediately before rendering, messages count is:", messages.length);
          return null;
        })()}

        {messages.length === 0 ? (
          currentThemeType === "cat" ? (
            <div 
              className="flex flex-col items-center justify-center py-20 text-center px-6 select-none z-10 w-full" 
              style={{ height: "auto" }}
            >
              <SleepingCatIllustration />
              <h3 className="text-sm font-bold mb-1 text-amber-900">
                No conversations yet.
              </h3>
              <p className="text-xs leading-relaxed max-w-xs opacity-70 text-amber-800/70">
                Start your conversation.
              </p>
            </div>
          ) : (
            <div 
              className="flex flex-col items-center justify-center py-16 text-center px-6 w-full" 
              style={{ height: "auto" }}
            >
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 opacity-50"
                style={{ backgroundColor: `${theme.accent}15` }}
              >
                <Users className="w-6 h-6" style={{ color: theme.accent }} />
              </div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: theme.text }}>
                Vault Active & Secured
              </h3>
              <p className="text-xs leading-relaxed max-w-xs" style={{ color: theme.textSecondary }}>
                All correspondence is highly secure and temporary. State is destroyed once you disconnect.
              </p>
            </div>
          )
        ) : (
          messages.map((msg) => {
            return (
              <MessageCard
                key={msg.id}
                msg={msg}
                allMessages={messages}
                nickname={nickname}
                theme={theme}
                onReply={(targetMsg) => setReplyingTo(targetMsg)}
                onReplyHeaderClick={handleReplyHeaderClick}
                isHighlighted={highlightedMessageId === msg.id}
                formatTime={formatTime}
              />
            );
          })
        )}
        <div ref={messageEndRef} style={{ height: 0, minHeight: 0, flexShrink: 0 }} />
      </main>

      {/* BOTTOM INPUT FOOTER */}
      <footer 
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] px-4 pb-5 pt-3 z-20 border-t transition-colors duration-300 flex flex-col gap-2"
        style={{ borderColor: theme.border, backgroundColor: theme.bg }}
      >
        <AnimatePresence initial={false}>
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 4 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div 
                className="p-3 rounded-2xl border flex items-start justify-between gap-3 text-xs"
                style={{
                  borderColor: theme.border,
                  backgroundColor: `${theme.card}bf`,
                  backdropFilter: "blur(4px)"
                }}
              >
                <div className="flex-1 min-w-0 flex items-start gap-2">
                  <CornerUpLeft className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: theme.accent }} />
                  <div className="min-w-0">
                    <div className="font-black uppercase tracking-wider text-[10px]" style={{ color: theme.accent }}>
                      Replying to {replyingTo.sender}
                    </div>
                    <p className="opacity-70 truncate max-w-full text-xs" style={{ color: theme.text }}>
                      {replyingTo.content.length > 80 
                        ? replyingTo.content.substring(0, 80) + "..." 
                        : replyingTo.content}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  style={{ color: theme.textSecondary }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={currentThemeType === "cat" ? "🐾 Whisper a cozy message..." : "Type a message..."}
            className={`flex-1 h-12 px-4 text-sm outline-none border transition-all duration-300 ${
              currentThemeType === "cat" ? "rounded-[22px]" : "rounded-full"
            }`}
            style={{
              borderColor: theme.border,
              backgroundColor: currentThemeType === "cat" ? "#FFF5EB" : theme.inputBg,
              color: theme.text,
              caretColor: currentThemeType === "cat" ? "#FF8E9E" : "auto",
              boxShadow: (currentThemeType === "cat" && inputFocused) ? `0 0 0 3px rgba(245, 158, 11, 0.22)` : "none"
            }}
            onFocus={(e) => {
              setInputFocused(true);
              e.target.style.borderColor = theme.accent;
            }}
            onBlur={(e) => {
              setInputFocused(false);
              e.target.style.borderColor = theme.border;
            }}
          />
          <motion.button
            type="submit"
            disabled={!inputValue.trim()}
            whileHover={currentThemeType === "cat" && inputValue.trim() ? { y: -1, scale: 1.02 } : {}}
            whileTap={currentThemeType === "cat" && inputValue.trim() ? { y: 2, scale: 0.98 } : {}}
            className={`h-12 flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed select-none ${
              currentThemeType === "cat" ? "w-14 rounded-[20px]" : "w-12 rounded-full"
            }`}
            style={{
              backgroundColor: theme.accent,
              color: "#ffffff",
              borderBottom: currentThemeType === "cat" && inputValue.trim() ? "3px solid #B45309" : "none",
              boxShadow: currentThemeType === "cat" && inputValue.trim() ? "0 4px 12px rgba(245, 158, 11, 0.35)" : "none"
            }}
            title="Send Message"
          >
            {currentThemeType === "cat" ? (
              <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8,14 C6,14 4.5,12.5 4.5,10.5 C4.5,9.5 5.5,8.5 8,8.5 C10.5,8.5 11.5,9.5 11.5,10.5 C11.5,12.5 10,14 8,14 Z" />
                <circle cx="4" cy="6" r="1.5" />
                <circle cx="6.5" cy="4" r="1.5" />
                <circle cx="9.5" cy="4" r="1.5" />
                <circle cx="12" cy="6" r="1.5" />
              </svg>
            ) : (
              <Send className="w-5 h-5" />
            )}
          </motion.button>
        </form>
      </footer>

      {/* SETTINGS DIALOG MODAL FOR USER1 */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="w-full max-w-[340px] p-6 rounded-3xl border relative"
              style={{
                borderColor: theme.border,
                backgroundColor: theme.card,
                color: theme.text
              }}
            >
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full opacity-60 hover:opacity-100 transition-colors cursor-pointer"
                style={{ color: theme.text }}
              >
                <X className="w-4 h-4" />
              </button>

              <h2 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2">
                <Settings className="w-4 h-4" style={{ color: theme.accent }} />
                Vault Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 rounded-2xl border" style={{ borderColor: theme.border, backgroundColor: theme.bg }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold" style={{ color: theme.text }}>
                      Notification Sound
                    </div>
                    <p className="text-[10px] opacity-60 mt-0.5 leading-relaxed" style={{ color: theme.text }}>
                      Play sound on new messages when away or unfocused.
                    </p>
                  </div>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2 rounded-full border transition-all duration-300 cursor-pointer active:scale-90"
                    style={{ 
                      borderColor: theme.border, 
                      backgroundColor: soundEnabled ? theme.accent : theme.card,
                      color: soundEnabled ? "#ffffff" : theme.text 
                    }}
                    title={soundEnabled ? "Disable Sound" : "Enable Sound"}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95"
                  style={{ backgroundColor: theme.accent, color: "#ffffff" }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
