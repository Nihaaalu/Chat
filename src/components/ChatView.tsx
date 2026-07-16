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
  const [participants, setParticipants] = useState<{ id: string; name: string; joinedAt: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageType | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

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

      setMessages(msgs);
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
      setMessages(msgs);
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
    <div className="flex flex-col min-h-screen relative overflow-hidden">
      {currentThemeType === "cat" && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
          {/* Subtle static paw print watermark 1 */}
          <div className="absolute left-[10%] top-[25%]" style={{ color: theme.border, opacity: 0.035 }}>
            <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8,14 C6,14 4.5,12.5 4.5,10.5 C4.5,9.5 5.5,8.5 8,8.5 C10.5,8.5 11.5,9.5 11.5,10.5 C11.5,12.5 10,14 8,14 Z" />
              <circle cx="4" cy="6" r="1.5" />
              <circle cx="6.5" cy="4" r="1.5" />
              <circle cx="9.5" cy="4" r="1.5" />
              <circle cx="12" cy="6" r="1.5" />
            </svg>
          </div>
          {/* Subtle static paw print watermark 2 */}
          <div className="absolute right-[15%] top-[50%]" style={{ color: theme.border, opacity: 0.035 }}>
            <svg width="60" height="60" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8,14 C6,14 4.5,12.5 4.5,10.5 C4.5,9.5 5.5,8.5 8,8.5 C10.5,8.5 11.5,9.5 11.5,10.5 C11.5,12.5 10,14 8,14 Z" />
              <circle cx="4" cy="6" r="1.5" />
              <circle cx="6.5" cy="4" r="1.5" />
              <circle cx="9.5" cy="4" r="1.5" />
              <circle cx="12" cy="6" r="1.5" />
            </svg>
          </div>
          {/* Subtle static paw print watermark 3 */}
          <div className="absolute left-[12%] top-[75%]" style={{ color: theme.border, opacity: 0.035 }}>
            <svg width="40" height="40" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8,14 C6,14 4.5,12.5 4.5,10.5 C4.5,9.5 5.5,8.5 8,8.5 C10.5,8.5 11.5,9.5 11.5,10.5 C11.5,12.5 10,14 8,14 Z" />
              <circle cx="4" cy="6" r="1.5" />
              <circle cx="6.5" cy="4" r="1.5" />
              <circle cx="9.5" cy="4" r="1.5" />
              <circle cx="12" cy="6" r="1.5" />
            </svg>
          </div>
        </div>
      )}
      {/* HEADER TOP BAR */}
      <header 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] h-16 px-4 flex items-center justify-between border-b z-20 transition-colors duration-300"
        style={{ borderColor: theme.border, backgroundColor: theme.bg }}
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
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-40 flex items-center gap-1" style={{ color: theme.text }}>
            {currentThemeType === "cat" && <span className="text-xs">🐈</span>}
            Secure Vault
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
              refreshing ? "animate-spin" : "active:scale-90"
            }`}
            style={{ borderColor: theme.border, backgroundColor: theme.card, color: theme.text }}
            title="Refresh Messages"
          >
            <RefreshCw className="w-4 h-4" />
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
      <main className="flex-1 overflow-y-auto px-1 pt-4 pb-28">
        <div className="flex flex-col gap-3.5">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
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
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isSystem = msg.sender === "SYSTEM";
                
                if (isSystem) {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-1.5 py-1.5 px-4 text-[10px] font-bold rounded-xl border text-center my-1"
                      style={{
                        borderColor: theme.border,
                        backgroundColor: `${theme.card}80`,
                        color: theme.textSecondary
                      }}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 opacity-60" style={{ color: theme.accent }} />
                      <span>{msg.content}</span>
                    </motion.div>
                  );
                }

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
              })}
            </AnimatePresence>
          )}
          <div ref={messageEndRef} />
        </div>
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
            placeholder="Type a message..."
            className="flex-1 h-12 px-4 rounded-full text-sm outline-none border transition-all duration-300"
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
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed select-none"
            style={{
              backgroundColor: theme.accent,
              color: "#ffffff"
            }}
          >
            <Send className="w-5 h-5" />
          </button>
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
