import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  query, 
  orderBy, 
  serverTimestamp,
  runTransaction,
  where,
  limit
} from "firebase/firestore";
import { auth, db, collection, doc, onSnapshot, addDoc, getDocs, deleteDoc, setDoc, updateDoc } from "../lib/firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, Send, RefreshCw, MessageSquare } from "lucide-react";
import { ThemeConfig } from "../theme.js";
import { runVerification } from "../lib/recaptcha.js";

interface Message {
  id: string;
  sender: string;
  text: string;
  createdAt: string;
}

interface RandomChatViewProps {
  theme: ThemeConfig;
  onLeave: () => void;
}

export default function RandomChatView({ theme, onLeave }: RandomChatViewProps) {
  const [matchStatus, setMatchStatus] = useState<"searching" | "connecting" | "connected" | "disconnected">("searching");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [strangerUid, setStrangerUid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStrangerTyping, setIsStrangerTyping] = useState(false);
  const [isMeTyping, setIsMeTyping] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const [myUid, setMyUid] = useState(() => {
    if (auth.currentUser?.uid) {
      return auth.currentUser.uid;
    }
    const saved = sessionStorage.getItem("chat_uid");
    if (saved) return saved;
    const fallback = "anon-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem("chat_uid", fallback);
    return fallback;
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setMyUid(user.uid);
        sessionStorage.setItem("chat_uid", user.uid);
      }
    });
    return () => unsub();
  }, []);

  const [lastPartners, setLastPartners] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem("chat_last_partners");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const addLastPartner = (partnerId: string) => {
    setLastPartners(prev => {
      let updated = [partnerId, ...prev.filter(id => id !== partnerId)];
      if (updated.length > 50) {
        updated = updated.slice(0, 50);
      }
      sessionStorage.setItem("chat_last_partners", JSON.stringify(updated));
      return updated;
    });
  };

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const unsubscribesRef = useRef<(() => void)[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const headerRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const [mainHeight, setMainHeight] = useState<string | number>("auto");

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      const viewportH = vv.height;
      const headerH = headerRef.current ? headerRef.current.offsetHeight : 52;
      const footerH = footerRef.current ? footerRef.current.offsetHeight : 76;

      const available = viewportH - headerH - footerH - 32;

      setMainHeight(available > 80 ? available : 80);
    };

    handleResize();

    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", handleResize);
    window.addEventListener("resize", handleResize);

    const timer = setTimeout(handleResize, 100);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("scroll", handleResize);
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, [matchStatus, securityError]);

  const scrollToBottom = (behavior: "smooth" | "auto" = "smooth") => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, matchStatus]);

  // Auto-scroll to bottom when keyboard opens/closes via visual viewport
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const handleViewportChange = () => {
      scrollToBottom("auto");
    };
    window.visualViewport.addEventListener("resize", handleViewportChange);
    window.visualViewport.addEventListener("scroll", handleViewportChange);
    return () => {
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, []);

  // Handle matchmaking on mount
  useEffect(() => {
    startSearch("RANDOM_QUEUE");

    return () => {
      cleanUpListeners();
      handleDisconnectOnExit();
    };
  }, []);

  // Heartbeat mechanism: update lastHeartbeat every 60 seconds while searching
  useEffect(() => {
    if (matchStatus === "searching") {
      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          const myQueueRef = doc(db, "waitingQueue", myUid);
          await updateDoc(myQueueRef, {
            lastHeartbeat: Date.now()
          });
        } catch (e) {
          console.error("Heartbeat update failed:", e);
        }
      }, 60000);
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [matchStatus, myUid]);

  const cleanUpListeners = () => {
    unsubscribesRef.current.forEach(unsub => {
      try {
        unsub();
      } catch (e) {}
    });
    unsubscribesRef.current = [];
  };

  const handleDisconnectOnExit = async () => {
    const sessId = activeSessionId;
    if (sessId) {
      await disconnectSession(sessId);
    }
    await deleteDoc(doc(db, "waitingQueue", myUid)).catch(() => {});
  };

  const disconnectSession = async (sessId: string) => {
    try {
      const sessRef = doc(db, "randomSessions", sessId);
      await updateDoc(sessRef, { status: "disconnected" }).catch(() => {});

      // Delete messages in subcollection
      const msgsRef = collection(db, "randomSessions", sessId, "messages");
      const snap = await getDocs(msgsRef);
      for (const d of snap.docs) {
        await deleteDoc(d.ref).catch(() => {});
      }
      // Delete session doc itself
      await deleteDoc(sessRef).catch(() => {});
    } catch (e) {
      console.error("Error disconnecting session:", e);
    }
  };

  const startSearch = async (actionType: "RANDOM_QUEUE" | "NEXT_CHAT" = "RANDOM_QUEUE") => {
    setSecurityError(null);
    try {
      await runVerification(actionType);
    } catch (err: any) {
      setSecurityError(err.message || "Security verification failed.");
      setMatchStatus("disconnected");
      return;
    }

    cleanUpListeners();
    const currentSessId = activeSessionId;
    if (currentSessId) {
      await disconnectSession(currentSessId);
    }
    
    setMatchStatus("searching");
    setActiveSessionId(null);
    setStrangerUid(null);
    setMessages([]);
    setInputValue("");
    setIsStrangerTyping(false);

    const myQueueRef = doc(db, "waitingQueue", myUid);
    await deleteDoc(myQueueRef).catch(() => {});

    try {
      // Add ourselves to the waitingQueue
      await setDoc(myQueueRef, {
        userId: myUid,
        joinedAt: Date.now(),
        status: "waiting",
        lastHeartbeat: Date.now(),
        matchedSessionId: ""
      });

      // Query the top 50 candidates in the waiting queue
      const q = query(
        collection(db, "waitingQueue"),
        orderBy("joinedAt", "asc"),
        limit(50)
      );
      const snap = await getDocs(q);

      const now = Date.now();
      const candidates: { userId: string; lastHeartbeat: number; status: string; joinedAt: number }[] = [];

      for (const d of snap.docs) {
        if (d.id === myUid) continue;
        const data = d.data();
        
        // Remove stale waiting users automatically if lastHeartbeat is older than 2 minutes
        if (now - (data.lastHeartbeat || 0) > 120000) {
          deleteDoc(doc(db, "waitingQueue", d.id)).catch(() => {});
          continue;
        }

        if (data.status === "waiting") {
          candidates.push({
            userId: d.id,
            lastHeartbeat: data.lastHeartbeat || 0,
            status: data.status,
            joinedAt: data.joinedAt || 0
          });
        }
      }

      if (candidates.length > 0) {
        // Prioritize users who are not in lastPartners
        const preferred = candidates.filter(c => !lastPartners.includes(c.userId));
        const seenBefore = candidates.filter(c => lastPartners.includes(c.userId));

        preferred.sort((a, b) => a.joinedAt - b.joinedAt);
        seenBefore.sort((a, b) => a.joinedAt - b.joinedAt);

        const sortedCandidates = [...preferred, ...seenBefore];

        let matchSuccessful = false;
        for (const cand of sortedCandidates) {
          const partnerId = cand.userId;
          const sessionId = "rand_" + [myUid, partnerId].sort().join("_") + "_" + now;

          try {
            await runTransaction(db, async (transaction) => {
              const myDoc = await transaction.get(myQueueRef);
              const partnerQueueRef = doc(db, "waitingQueue", partnerId);
              const partnerDoc = await transaction.get(partnerQueueRef);

              if (!myDoc.exists() || !partnerDoc.exists()) {
                throw new Error("One of the queue documents does not exist");
              }

              const myData = myDoc.data() as any;
              const partnerData = partnerDoc.data() as any;

              if (myData.status !== "waiting") {
                throw new Error("I am no longer waiting");
              }
              if (partnerData.status !== "waiting") {
                throw new Error("Partner is no longer waiting");
              }

              // Atomically claim both users
              transaction.update(partnerQueueRef, {
                status: "matched",
                matchedSessionId: sessionId
              });
              transaction.update(myQueueRef, {
                status: "matched",
                matchedSessionId: sessionId
              });

              // Create randomSession document
              const sessionRef = doc(db, "randomSessions", sessionId);
              transaction.set(sessionRef, {
                sessionId: sessionId,
                participants: [myUid, partnerId],
                createdAt: now,
                status: "active",
                typing: {
                  [myUid]: false,
                  [partnerId]: false
                }
              });
            });

            matchSuccessful = true;
            addLastPartner(partnerId);
            setMatchStatus("connecting");
            setActiveSessionId(sessionId);
            setStrangerUid(partnerId);
            subscribeToSession(sessionId);
            await deleteDoc(myQueueRef).catch(() => {});
            break;
          } catch (transErr) {
            console.warn(`Transaction match failed for partner ${partnerId}, trying next...`, transErr);
          }
        }

        if (matchSuccessful) {
          return;
        }
      }

      // No match could be immediately established, listen to our own queue status
      const unsubQueue = onSnapshot(myQueueRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.status === "matched" && data.matchedSessionId) {
            unsubQueue();
            const sessId = data.matchedSessionId;
            setMatchStatus("connecting");
            setActiveSessionId(sessId);
            subscribeToSession(sessId);
            await deleteDoc(myQueueRef).catch(() => {});
          }
        }
      });
      unsubscribesRef.current.push(unsubQueue);

    } catch (err) {
      console.error("Matchmaking failed:", err);
    }
  };

  const subscribeToSession = (sessionId: string) => {
    // 1. Listen to active session document for metadata and status
    const sessRef = doc(db, "randomSessions", sessionId);
    const unsubSess = onSnapshot(sessRef, (snap) => {
      if (!snap.exists()) {
        setMatchStatus("disconnected");
        setActiveSessionId(null);
        return;
      }
      const data = snap.data();
      if (data.status === "disconnected") {
        setMatchStatus("disconnected");
        setActiveSessionId(null);
        return;
      }

      const participants = data.participants || [];
      const otherUid = participants.find((p: string) => p !== myUid);
      if (otherUid) {
        setStrangerUid(otherUid);
        setIsStrangerTyping(data.typing?.[otherUid] === true);
      }
      setMatchStatus("connected");
    });
    unsubscribesRef.current.push(unsubSess);

    // 2. Listen to messages in the active session
    const msgsRef = collection(db, "randomSessions", sessionId, "messages");
    const q = query(msgsRef, orderBy("timestamp", "asc"));
    const unsubMsgs = onSnapshot(q, (snap) => {
      const msgsList: Message[] = [];
      snap.forEach((d) => {
        const data = d.data();
        msgsList.push({
          id: d.id,
          sender: data.sender,
          text: data.text || "",
          createdAt: data.timestamp?.toDate 
            ? data.timestamp.toDate().toISOString() 
            : new Date().toISOString()
        });
      });
      setMessages(msgsList);
      scrollToBottom();
    });
    unsubscribesRef.current.push(unsubMsgs);
  };

  const updateTypingState = async (isTyping: boolean) => {
    if (!activeSessionId) return;
    try {
      await updateDoc(doc(db, "randomSessions", activeSessionId), {
        [`typing.${myUid}`]: isTyping
      });
    } catch (e) {}
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    if (!isMeTyping) {
      setIsMeTyping(true);
      updateTypingState(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsMeTyping(false);
      updateTypingState(false);
    }, 2500);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || !activeSessionId) return;

    try {
      await runVerification("SEND_MESSAGE");
    } catch (err: any) {
      showToast(err.message || "Message blocked due to security.");
      return;
    }

    const text = inputValue.trim();
    setInputValue("");
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsMeTyping(false);
    updateTypingState(false);

    try {
      const msgsRef = collection(db, "randomSessions", activeSessionId, "messages");
      await addDoc(msgsRef, {
        sender: myUid,
        text: text,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleLeave = async () => {
    await handleDisconnectOnExit();
    onLeave();
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden" style={{ backgroundColor: theme.bg }}>
      {/* Top Header */}
      <header 
        ref={headerRef}
        className="h-16 max-md:h-[52px] px-4 flex items-center justify-between border-b shrink-0 z-20"
        style={{ borderColor: theme.border, backgroundColor: theme.bg }}
      >
        <button 
          onClick={handleLeave}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider cursor-pointer opacity-70 hover:opacity-100 select-none"
          style={{ color: theme.text }}
        >
          <ArrowLeft className="w-4 h-4" />
          Leave
        </button>

        <div className="text-center flex-1 pr-6 flex flex-col justify-center">
          <h2 className="text-xs font-bold uppercase tracking-wider leading-tight" style={{ color: theme.text }}>
            Anonymous Stranger
          </h2>
          <span className="text-[10px] font-medium leading-none opacity-60" style={{ color: theme.accent }}>
            {matchStatus === "searching" && "Searching for stranger..."}
            {matchStatus === "connecting" && "Connecting..."}
            {matchStatus === "connected" && (isStrangerTyping ? "Typing..." : "Connected")}
            {matchStatus === "disconnected" && "Stranger disconnected."}
          </span>
        </div>
      </header>

      {/* Main Container Area */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col justify-between relative mobile-no-scrollbar"
        style={{ height: mainHeight, maxHeight: mainHeight, minHeight: 0 }}
      >
        {securityError && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-950/40 text-red-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1 text-red-600">
                Security Check Failed
              </p>
              <p className="text-[10px] opacity-65 max-w-[240px] mx-auto leading-relaxed text-red-500">
                {securityError}
              </p>
              <button
                onClick={() => {
                  setSecurityError(null);
                  startSearch("RANDOM_QUEUE");
                }}
                className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {matchStatus === "searching" && !securityError && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${theme.accent}15` }}
            >
              <MessageSquare className="w-6 h-6 animate-pulse" style={{ color: theme.accent }} />
            </motion.div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.text }}>
                Searching for stranger...
              </p>
              <p className="text-[10px] opacity-60 max-w-[240px] mx-auto leading-relaxed" style={{ color: theme.textSecondary }}>
                Waiting in the queue to securely link you with a random online stranger.
              </p>
            </div>
          </div>
        )}

        {matchStatus === "connecting" && !securityError && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <RefreshCw className="w-6 h-6 animate-spin" style={{ color: theme.accent }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: theme.text }}>
                Connecting...
              </p>
              <p className="text-[10px] opacity-60 leading-relaxed" style={{ color: theme.textSecondary }}>
                Establishing a fully isolated chat session...
              </p>
            </div>
          </div>
        )}

        {(matchStatus === "connected" || matchStatus === "disconnected") && !securityError && (
          <div className="flex-1 flex flex-col gap-3 py-2 overflow-y-auto pr-1 mobile-no-scrollbar">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <span className="text-sm select-none mb-1">🌍</span>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1" style={{ color: theme.text }}>
                  Connected
                </p>
                <p className="text-[9px] opacity-30 max-w-[200px]" style={{ color: theme.textSecondary }}>
                  Your conversation is private and anonymous. Say hello!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender === myUid;
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex flex-col max-w-[75%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
                  >
                    <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest mb-0.5 px-1.5" style={{ color: theme.text }}>
                      {isMe ? "You" : "Stranger"}
                    </span>
                    <div 
                      className="px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed font-medium break-words shadow-sm"
                      style={{
                        backgroundColor: isMe ? theme.accent : theme.inputBg,
                        color: isMe ? "#ffffff" : theme.text,
                        borderColor: isMe ? "transparent" : theme.border,
                        borderWidth: isMe ? 0 : 1
                      }}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input / controls footer bar */}
      <footer 
        ref={footerRef}
        className="p-4 border-t z-10 shrink-0" 
        style={{ borderColor: theme.border, backgroundColor: theme.bg }}
      >
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Next Button */}
          <button
            type="button"
            onClick={() => startSearch("NEXT_CHAT")}
            className="h-11 px-4 rounded-xl flex items-center justify-center font-black text-[10px] uppercase tracking-wider cursor-pointer transition-transform active:scale-95 border"
            style={{ 
              borderColor: theme.border, 
              backgroundColor: theme.card,
              color: theme.text 
            }}
          >
            {matchStatus === "searching" || matchStatus === "connecting" ? "Skip" : "Next"}
          </button>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={matchStatus !== "connected"}
            placeholder={matchStatus === "connected" ? "Type a message..." : "Waiting for connection..."}
            className="flex-1 h-11 px-4 rounded-xl text-xs font-medium border outline-none transition-all duration-200"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.inputBg,
              color: theme.text,
            }}
            onFocus={(e) => {
              if (matchStatus === "connected") e.target.style.borderColor = theme.accent;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = theme.border;
            }}
          />

          <button
            type="submit"
            disabled={!inputValue.trim() || matchStatus !== "connected"}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 disabled:opacity-40 cursor-pointer"
            style={{
              backgroundColor: theme.accent,
              color: "#ffffff"
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-xs font-bold shadow-lg border"
            style={{ backgroundColor: theme.card, borderColor: theme.border, color: theme.text }}
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
