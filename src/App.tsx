import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ThemeType } from "./types.js";
import { themes } from "./theme.js";
import HomeView from "./components/HomeView.js";
import ChatView from "./components/ChatView.js";
import ThemeSelector from "./components/ThemeSelector.js";
import CatBackground from "./components/CatBackground.js";
import { Shield, ShieldCheck, X } from "lucide-react";
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./lib/firebase.js";

export default function App() {
  // 1. Theme State
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("chat_theme_selection");
    return (saved as ThemeType) || "cat";
  });

  const handleThemeChange = (newTheme: ThemeType) => {
    setCurrentTheme(newTheme);
    localStorage.setItem("chat_theme_selection", newTheme);
  };

  const themeConfig = themes[currentTheme];

  // 2. Active Session States (sessionStorage only)
  const [view, setView] = useState<"home" | "chat">("home");
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  // Custom visual overlay for security logouts
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Warning banner for grace period return
  const [gracePeriodBanner, setGracePeriodBanner] = useState<string | null>(null);

  // Auto-dismiss the grace period warning banner after 6 seconds
  useEffect(() => {
    if (gracePeriodBanner) {
      const timer = setTimeout(() => {
        setGracePeriodBanner(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [gracePeriodBanner]);

  // Dynamic Favicon for Cat Theme
  useEffect(() => {
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "shortcut icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    if (currentTheme === "cat") {
      link.type = "image/svg+xml";
      link.href = "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🐈</text></svg>";
    } else {
      link.type = "image/x-icon";
      link.href = "/favicon.ico";
    }
  }, [currentTheme]);

  // Security references for timeouts
  const tabTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribesRef = useRef<(() => void)[]>([]);

  // 3. Auto-Restore session on initial mount / page refresh
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = sessionStorage.getItem("chat_session_token");
      const savedRoom = sessionStorage.getItem("chat_room_code");
      const savedNick = sessionStorage.getItem("chat_nickname");
      const savedUid = sessionStorage.getItem("chat_uid");

      if (savedToken && savedRoom === "1317" && savedNick && savedUid) {
        try {
          const chatRef = doc(db, "chat", "1317");
          let snap;
          try {
            snap = await getDoc(chatRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, "chat/1317");
            throw err;
          }
          if (snap.exists()) {
            const data = snap.data();
            const members = data.members || {};
            if (members[savedUid] === savedNick) {
              setSessionToken(savedToken);
              setRoomCode("1317");
              setNickname(savedNick);
              setView("chat");
              return;
            }
          }
          sessionStorage.clear();
        } catch (err) {
          sessionStorage.clear();
        }
      }
    };

    restoreSession();
  }, []);

  // 4. SECURITY FEATURE 1: Tab Hidden Countdown (30 seconds)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const currentNick = nickname || sessionStorage.getItem("chat_nickname") || localStorage.getItem("chat_nickname");
      if (currentNick === "user1") return;

      if (document.visibilityState === "hidden") {
        if (view === "chat" && sessionToken) {
          // Trigger logout if away for 30 seconds
          tabTimeoutRef.current = setTimeout(() => {
            triggerLogout(true);
          }, 30000);
        }
      } else {
        // Tab is active again, clear timeout
        if (tabTimeoutRef.current) {
          clearTimeout(tabTimeoutRef.current);
          tabTimeoutRef.current = null;
          setGracePeriodBanner("Session preserved. You returned before the 30-second privacy timeout.");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (tabTimeoutRef.current) clearTimeout(tabTimeoutRef.current);
    };
  }, [view, sessionToken, nickname]);

  // 5. SECURITY FEATURE 2: Inactivity Timeout (30 minutes)
  useEffect(() => {
    const currentNick = nickname || sessionStorage.getItem("chat_nickname") || localStorage.getItem("chat_nickname");
    if (view !== "chat" || !sessionToken || currentNick === "user1") return;

    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        triggerLogout(false, true);
      }, 30 * 60 * 1000); // 30 minutes
    };

    const activityEvents = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [view, sessionToken, nickname]);

  // 6. Cleanup presence on unexpected exits (beforeunload, pagehide, visibilitychange)
  useEffect(() => {
    const handleExit = () => {
      const uid = sessionStorage.getItem("chat_uid");
      const activeNick = sessionStorage.getItem("chat_nickname") || nickname;
      if (uid && view === "chat") {
        const chatRef = doc(db, "chat", "1317");
        const updates: Record<string, any> = {
          [`members.${uid}`]: deleteField()
        };
        if (activeNick) {
          updates[`lastSeen.${activeNick}`] = deleteField();
        }
        // Fire-and-forget Firestore updates on unexpected browser tab close attempts
        updateDoc(chatRef, updates).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleExit);
    window.addEventListener("pagehide", handleExit);

    return () => {
      window.removeEventListener("beforeunload", handleExit);
      window.removeEventListener("pagehide", handleExit);
    };
  }, [view, nickname]);

  // 7. Heartbeat: update lastSeen field every 15 seconds while user is logged in
  useEffect(() => {
    if (view !== "chat" || !nickname) return;

    const uid = sessionStorage.getItem("chat_uid");
    if (!uid) return;

    const sendHeartbeat = async () => {
      try {
        const chatRef = doc(db, "chat", "1317");
        await updateDoc(chatRef, {
          [`lastSeen.${nickname}`]: Date.now()
        });
      } catch (err) {
        console.error("Heartbeat failed:", err);
      }
    };

    // Initial heartbeat immediately upon entering
    sendHeartbeat();

    const interval = setInterval(sendHeartbeat, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [view, nickname]);

  // Logout Trigger helper with active presence pruning
  const triggerLogout = async (byTabHidden = false, byInactivity = false) => {
    // 1. Stop all Firestore realtime listeners.
    unsubscribesRef.current.forEach((unsub) => {
      try {
        unsub();
      } catch (e) {
        console.error("Failed to stop Firestore listener on logout:", e);
      }
    });
    unsubscribesRef.current = [];

    const activeNick = sessionStorage.getItem("chat_nickname") || nickname;
    const uid = sessionStorage.getItem("chat_uid");

    // 2. Remove the current user from the activeUsers collection (or wherever active users are stored).
    if (uid) {
      try {
        const chatRef = doc(db, "chat", "1317");
        const updates: Record<string, any> = {
          [`members.${uid}`]: deleteField()
        };
        if (activeNick) {
          updates[`lastSeen.${activeNick}`] = deleteField();
        }

        // 3. Wait until the Firestore delete/update operation completes successfully using await.
        await updateDoc(chatRef, updates);

        const messagesRef = collection(db, "chat", "1317", "messages");
        try {
          await addDoc(messagesRef, {
            sender: "SYSTEM",
            text: `${activeNick} has left the room${byTabHidden ? " due to tab inactivity" : ""}.`,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "chat/1317/messages");
        }
      } catch (err) {
        console.error("Logout cleanup failed:", err);
      }
    }

    // 4. Clear local React state.
    setSessionToken("");
    setRoomCode("");
    setNickname("");

    // 5. Clear sessionStorage.
    sessionStorage.clear();

    // 6. Clear any in-memory authentication state (none in our custom unauthenticated setup).

    // 7. Redirect to the login page.
    setView("home");

    if (byTabHidden) {
      setSecurityNotice("You have been automatically logged out to preserve your privacy after leaving the browser tab for over 30 seconds.");
    } else if (byInactivity) {
      setSecurityNotice("You have been logged out automatically due to 30 minutes of inactivity.");
    }
  };

  const handleJoinRoom = async (code: string, username: string, password: string): Promise<string | void> => {
    try {
      // 1. Verify room credentials using the fixed allowed accounts
      if (code !== "1317" || !((username === "user1" && password === "user1") || (username === "user2" && password === "user2"))) {
        return "Invalid credentials.";
      }

      // 2. Fetch the room document
      const chatRef = doc(db, "chat", "1317");
      let snap;
      try {
        snap = await getDoc(chatRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, "chat/1317");
        throw err;
      }

      let members: Record<string, string> = {};
      let lastSeenMap: Record<string, number> = {};

      if (snap.exists()) {
        const data = snap.data();
        members = data.members || {};
        lastSeenMap = data.lastSeen || {};
      } else {
        try {
          await setDoc(chatRef, { members: {}, lastSeen: {} });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "chat/1317");
          throw err;
        }
      }

      const uid = sessionStorage.getItem("chat_uid") || "uid-" + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem("chat_uid", uid);

      // 3. Verify if the selected username is already connected under a different session/UID
      const existingSession = Object.entries(members).find(
        ([mUid, mName]) => mName === username && mUid !== uid
      );

      if (existingSession) {
        const [existingUid] = existingSession;
        const lastSeenTime = lastSeenMap[username];
        const isStale = lastSeenTime ? (Date.now() - lastSeenTime > 60000) : true;

        if (isStale) {
          // Stale session detected! Automatically consider dead, remove from Firestore, and allow the login
          try {
            await updateDoc(chatRef, {
              [`members.${existingUid}`]: deleteField(),
              [`lastSeen.${username}`]: deleteField()
            });
            // Update local structures to allow immediate flow
            delete members[existingUid];
            delete lastSeenMap[username];
          } catch (err) {
            console.error("Cleanup of stale session failed:", err);
          }
        } else {
          return "This account is already active.";
        }
      }

      // 4. Update members list
      try {
        await updateDoc(chatRef, {
          [`members.${uid}`]: username,
          [`lastSeen.${username}`]: Date.now()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, "chat/1317");
        throw err;
      }

      // 5. Post SYSTEM join notification
      const messagesRef = collection(db, "chat", "1317", "messages");
      try {
        await addDoc(messagesRef, {
          sender: "SYSTEM",
          text: `${username} has joined the room.`,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, "chat/1317/messages");
        throw err;
      }

      const generatedToken = username + "-1317-" + Math.random().toString(36).substring(2, 7);

      sessionStorage.setItem("chat_session_token", generatedToken);
      sessionStorage.setItem("chat_room_code", "1317");
      sessionStorage.setItem("chat_nickname", username);

      setSessionToken(generatedToken);
      setRoomCode("1317");
      setNickname(username);
      setView("chat");
    } catch (err) {
      console.error("Join failed:", err);
      return "Network error joining chat room.";
    }
  };

  return (
    <div 
      className="min-h-screen w-full flex justify-center transition-all duration-300 relative select-none font-sans" 
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
    >
      {currentTheme === "cat" && view === "home" && <CatBackground theme={themeConfig} />}
      <div className="w-full max-w-[420px] min-h-screen px-4 flex flex-col justify-between py-6">
        
        {/* TOP THEME TOGGLE / SECURITY BADGE IN HOMEPAGE */}
        {view !== "chat" && (
          <header className="flex items-center justify-between h-12 mb-4">
            <div className="flex items-center gap-1.5 opacity-60">
              <Shield className="w-4 h-4" style={{ color: themeConfig.accent }} />
              <span className="text-[10px] font-bold tracking-widest uppercase">
                Privacy Active
              </span>
            </div>
            <ThemeSelector currentTheme={currentTheme} onThemeChange={handleThemeChange} />
          </header>
        )}

        {/* WORKSPACE AREA with slide transitions */}
        <div className="flex-1 flex flex-col justify-center">
          <AnimatePresence mode="wait">
            {view === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <HomeView
                  theme={themeConfig}
                  onJoin={handleJoinRoom}
                />
              </motion.div>
            )}

            {view === "chat" && (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full"
              >
                <ChatView
                  theme={themeConfig}
                  currentThemeType={currentTheme}
                  onThemeChange={handleThemeChange}
                  roomCode={roomCode}
                  sessionToken={sessionToken}
                  nickname={nickname}
                  onLeave={() => triggerLogout(false)}
                  registerUnsubscribe={(unsub) => {
                    unsubscribesRef.current.push(unsub);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MINIMAL FOOTER FOR HOMEPAGE */}
        {view !== "chat" && (
          <footer className="text-center mt-8 py-2">
            <span className="text-[10px] opacity-25 font-mono tracking-widest pl-1">
              EPHEMERAL SECURE ENDPOINT
            </span>
          </footer>
        )}
      </div>

      {/* GRACE PERIOD BANNER */}
      <AnimatePresence>
        {gracePeriodBanner && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[380px] p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg z-50 transition-colors duration-300"
            style={{
              borderColor: themeConfig.border,
              backgroundColor: themeConfig.card,
              color: themeConfig.text
            }}
          >
            <div className="flex items-center gap-2">
              {currentTheme === "cat" ? (
                <span className="text-lg flex-shrink-0 select-none">🐾</span>
              ) : (
                <ShieldCheck className="w-5 h-5 flex-shrink-0" style={{ color: themeConfig.accent }} />
              )}
              <p className="text-xs font-semibold leading-relaxed">
                {gracePeriodBanner}
              </p>
            </div>
            <button
              onClick={() => setGracePeriodBanner(null)}
              className="p-1 rounded-full opacity-60 hover:opacity-100 transition-colors cursor-pointer"
              style={{ color: themeConfig.text }}
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RE-ENTRY / SECURITY NOTIFICATION OVERLAY */}
      <AnimatePresence>
        {securityNotice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="w-full max-w-[340px] p-6 rounded-3xl border text-center relative"
              style={{
                borderColor: themeConfig.border,
                backgroundColor: themeConfig.card
              }}
            >
              <button
                onClick={() => setSecurityNotice(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full opacity-60 hover:opacity-100 transition-colors"
                style={{ color: themeConfig.text }}
              >
                <X className="w-4 h-4" />
              </button>

              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${themeConfig.accent}15` }}
              >
                <ShieldCheck className="w-6 h-6" style={{ color: themeConfig.accent }} />
              </div>

              <h4 className="text-sm font-bold tracking-tight uppercase mb-2" style={{ color: themeConfig.text }}>
                Vault Auto-Locked
              </h4>
              <p className="text-xs leading-relaxed opacity-80 mb-5" style={{ color: themeConfig.text }}>
                {securityNotice}
              </p>

              <button
                onClick={() => setSecurityNotice(null)}
                className="w-full h-11 rounded-full font-semibold text-xs tracking-wider uppercase transition-all duration-200 active:scale-95 cursor-pointer"
                style={{
                  backgroundColor: themeConfig.accent,
                  color: "#ffffff"
                }}
              >
                Acknowledge
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
