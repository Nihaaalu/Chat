import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { ThemeType, MessageType } from "../types.js";
import { ArrowLeft, RefreshCw, Send, Users, ShieldAlert } from "lucide-react";
import { collection, doc, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase.js";
import ThemeSelector from "./ThemeSelector.js";

interface ChatViewProps {
  theme: ThemeConfig;
  currentThemeType: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  roomCode: string;
  sessionToken: string;
  nickname: string;
  onLeave: () => void;
}

export default function ChatView({
  theme,
  currentThemeType,
  onThemeChange,
  roomCode,
  sessionToken,
  nickname,
  onLeave
}: ChatViewProps) {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [participants, setParticipants] = useState<{ id: string; name: string; joinedAt: string }[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [connected, setConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Set up Firebase listeners
  useEffect(() => {
    if (!roomCode) return;

    // 1. Listen to active room document for participant updates
    const roomRef = doc(db, "rooms", roomCode);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        // Room was deleted or expired
        onLeave();
        return;
      }

      const data = snapshot.data();
      const membersList = data.members || [];
      
      // Map members array to visual participants structure
      setParticipants(membersList.map((name: string) => ({
        id: name,
        name: name,
        joinedAt: new Date().toISOString()
      })));
      setConnected(true);
    }, (err) => {
      console.error("Room document snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, `rooms/${roomCode}`);
    });

    // 2. Listen to real-time messages subcollection
    const messagesRef = collection(db, "rooms", roomCode, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    
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
            : new Date().toISOString()
        });
      });
      setMessages(msgs);
      scrollToBottom();
    }, (err) => {
      console.error("Messages subcollection snapshot error:", err);
      handleFirestoreError(err, OperationType.GET, `rooms/${roomCode}/messages`);
    });

    return () => {
      unsubscribeRoom();
      unsubscribeMessages();
    };
  }, [roomCode, onLeave]);

  // Manual message pull (Refresh button)
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const messagesRef = collection(db, "rooms", roomCode, "messages");
      const q = query(messagesRef, orderBy("timestamp", "asc"));
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `rooms/${roomCode}/messages`);
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
            : new Date().toISOString()
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

    try {
      const messagesRef = collection(db, "rooms", roomCode, "messages");
      try {
        await addDoc(messagesRef, {
          sender: nickname,
          text: text,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `rooms/${roomCode}/messages`);
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
    <div className="flex flex-col min-h-screen">
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
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-40" style={{ color: theme.text }}>
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

                const isMe = msg.sender === nickname;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="p-4 rounded-2xl border transition-all duration-300"
                    style={{
                      borderColor: isMe ? `${theme.accent}30` : theme.border,
                      backgroundColor: isMe ? `${theme.accent}05` : theme.card,
                      marginLeft: isMe ? "2rem" : "0",
                      marginRight: isMe ? "0" : "2rem"
                    }}
                  >
                    {/* Card Header: Sender Name & Time */}
                    <div className="flex items-baseline justify-between mb-2">
                      <span 
                        className="text-xs font-black uppercase tracking-wider"
                        style={{ color: isMe ? theme.accent : theme.text }}
                      >
                        {msg.sender}
                      </span>
                      <span className="text-[10px] font-mono opacity-40 pl-2" style={{ color: theme.text }}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>

                    {/* Card Body: Message */}
                    <p 
                      className="text-sm leading-relaxed break-words whitespace-pre-wrap selection:bg-slate-300"
                      style={{ color: theme.text }}
                    >
                      {msg.content}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
          <div ref={messageEndRef} />
        </div>
      </main>

      {/* BOTTOM INPUT FOOTER */}
      <footer 
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] px-4 pb-5 pt-3 z-20 border-t transition-colors duration-300"
        style={{ borderColor: theme.border, backgroundColor: theme.bg }}
      >
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
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
    </div>
  );
}
