import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeType } from "./types.js";
import { themes } from "./theme.js";
import HomeView from "./components/HomeView.js";
import CreateRoomView from "./components/CreateRoomView.js";
import JoinRoomView from "./components/JoinRoomView.js";
import ChatView from "./components/ChatView.js";
import ThemeSelector from "./components/ThemeSelector.js";
import { Shield, ShieldCheck, X } from "lucide-react";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./lib/firebase.js";

export default function App() {
  // 1. Theme State
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("chat_theme_selection");
    return (saved as ThemeType) || "dark";
  });

  const handleThemeChange = (newTheme: ThemeType) => {
    setCurrentTheme(newTheme);
    localStorage.setItem("chat_theme_selection", newTheme);
  };

  const themeConfig = themes[currentTheme];

  // 2. Active Session States (Strictly sessionStorage - cleared on tab close)
  const [view, setView] = useState<"home" | "create" | "join" | "chat">("home");
  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  // Prefill helper for join form when coming from Create view
  const [prefilledCode, setPrefilledCode] = useState("");

  // Temporary container for newly generated room code
  const [createdRoomCode, setCreatedRoomCode] = useState("");

  // Custom visual overlay for security logouts
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Security references for timeouts
  const tabTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 3. Auto-Restore session on initial mount / page refresh
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = sessionStorage.getItem("chat_session_token");
      const savedRoom = sessionStorage.getItem("chat_room_code");
      const savedNick = sessionStorage.getItem("chat_nickname");

      if (savedToken && savedRoom && savedNick) {
        try {
          const roomRef = doc(db, "rooms", savedRoom);
          let snap;
          try {
            snap = await getDoc(roomRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `rooms/${savedRoom}`);
            throw err;
          }
          if (snap.exists()) {
            const data = snap.data();
            const members = data.members || [];
            if (members.includes(savedNick)) {
              setSessionToken(savedToken);
              setRoomCode(savedRoom);
              setNickname(savedNick);
              setView("chat");
              return;
            }
          }
          // If room doesn't exist or we are not in members, clear session
          sessionStorage.clear();
        } catch (err) {
          sessionStorage.clear();
        }
      }
    };

    restoreSession();
  }, []);

  // 4. SECURITY FEATURE 1: Tab Hidden Countdown (20 seconds)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (view === "chat" && sessionToken) {
          // Trigger logout if away for 20 seconds
          tabTimeoutRef.current = setTimeout(() => {
            triggerLogout(true);
          }, 20000);
        }
      } else {
        // Tab is active again, clear timeout
        if (tabTimeoutRef.current) {
          clearTimeout(tabTimeoutRef.current);
          tabTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (tabTimeoutRef.current) clearTimeout(tabTimeoutRef.current);
    };
  }, [view, sessionToken]);

  // 5. SECURITY FEATURE 2: Inactivity Timeout (30 minutes)
  useEffect(() => {
    if (view !== "chat" || !sessionToken) return;

    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        triggerLogout(false);
      }, 30 * 60 * 1000); // 30 minutes
    };

    const activityEvents = ["mousedown", "mousemove", "keypress", "scroll", "touchstart"];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetInactivityTimer);
    });

    // Initial run
    resetInactivityTimer();

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetInactivityTimer);
      });
    };
  }, [view, sessionToken]);

  // Logout Trigger helper with active document pruning
  const triggerLogout = async (byTabHidden = false) => {
    const activeCode = sessionStorage.getItem("chat_room_code") || roomCode;
    const activeNick = sessionStorage.getItem("chat_nickname") || nickname;

    if (activeCode && activeNick) {
      try {
        const roomRef = doc(db, "rooms", activeCode);
        let snap;
        try {
          snap = await getDoc(roomRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `rooms/${activeCode}`);
          throw err;
        }
        if (snap.exists()) {
          const data = snap.data();
          const currentMembers = data.members || [];
          const updatedMembers = currentMembers.filter((m: string) => m !== activeNick);

          if (updatedMembers.length === 0) {
            // Delete room completely if no participants left
            try {
              await deleteDoc(roomRef);
            } catch (err) {
              handleFirestoreError(err, OperationType.DELETE, `rooms/${activeCode}`);
              throw err;
            }
          } else {
            // Update members list and insert left alert message
            try {
              await updateDoc(roomRef, {
                members: updatedMembers
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.UPDATE, `rooms/${activeCode}`);
              throw err;
            }
            const messagesRef = collection(db, "rooms", activeCode, "messages");
            try {
              await addDoc(messagesRef, {
                sender: "SYSTEM",
                text: `${activeNick} has left the room${byTabHidden ? " due to tab inactivity" : ""}.`,
                timestamp: serverTimestamp()
              });
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `rooms/${activeCode}/messages`);
              throw err;
            }
          }
        }
      } catch (err) {
        console.error("Logout cleanup failed:", err);
      }
    }

    sessionStorage.clear();
    setSessionToken("");
    setRoomCode("");
    setNickname("");
    setView("home");

    if (byTabHidden) {
      setSecurityNotice("You have been automatically logged out to preserve your privacy after leaving the browser tab for over 20 seconds.");
    } else {
      setSecurityNotice("You have been logged out automatically due to 30 minutes of inactivity.");
    }
  };

  // 6. User Action Handlers
  const handleCreateRoom = async () => {
    try {
      let code = "";
      let isUnique = false;
      let attempts = 0;

      while (!isUnique && attempts < 10) {
        attempts++;
        code = Math.floor(1000 + Math.random() * 9000).toString();
        const roomRef = doc(db, "rooms", code);
        let snap;
        try {
          snap = await getDoc(roomRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `rooms/${code}`);
          throw err;
        }
        if (!snap.exists()) {
          isUnique = true;
        }
      }

      if (!isUnique) {
        alert("Failed to generate a unique room code. Please try again.");
        return;
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days expiration

      const roomRef = doc(db, "rooms", code);
      try {
        await setDoc(roomRef, {
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(expiresAt),
          members: [],
          createdBy: ""
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `rooms/${code}`);
        throw err;
      }

      setCreatedRoomCode(code);
      setView("create");
    } catch (err) {
      console.error("Failed to generate room:", err);
      alert("Error contacting security service.");
    }
  };

  const handleJoinRoom = async (code: string, name: string): Promise<string | void> => {
    try {
      const roomRef = doc(db, "rooms", code);
      let snap;
      try {
        snap = await getDoc(roomRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `rooms/${code}`);
        throw err;
      }

      if (!snap.exists()) {
        return "Invalid room code. Please check and try again.";
      }

      const data = snap.data();
      
      // Check expiration
      const expiresAt = data.expiresAt;
      if (expiresAt) {
        const expireDate = expiresAt.toDate ? expiresAt.toDate() : new Date(expiresAt);
        if (expireDate < new Date()) {
          try {
            await deleteDoc(roomRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.DELETE, `rooms/${code}`);
            throw err;
          }
          return "This room has expired.";
        }
      }

      const currentMembers: string[] = data.members || [];

      // Check room fullness
      if (currentMembers.length >= 2 && !currentMembers.includes(name)) {
        return "Room is full. Only 2 participants are allowed.";
      }

      // Check duplicate nickname
      if (currentMembers.includes(name)) {
        // If they already joined, let them back in
        const restoredToken = name + "-" + code;
        sessionStorage.setItem("chat_session_token", restoredToken);
        sessionStorage.setItem("chat_room_code", code);
        sessionStorage.setItem("chat_nickname", name);

        setSessionToken(restoredToken);
        setRoomCode(code);
        setNickname(name);
        setView("chat");
        return;
      }

      // Add to members list
      const updatedMembers = [...currentMembers, name];
      const updates: any = {
        members: updatedMembers
      };
      if (!data.createdBy) {
        updates.createdBy = name;
      }

      try {
        await updateDoc(roomRef, updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `rooms/${code}`);
        throw err;
      }

      // Post SYSTEM join notification
      const messagesRef = collection(db, "rooms", code, "messages");
      try {
        await addDoc(messagesRef, {
          sender: "SYSTEM",
          text: `${name} has joined the room.`,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `rooms/${code}/messages`);
        throw err;
      }

      const generatedToken = name + "-" + code + "-" + Math.random().toString(36).substring(2, 7);

      // Persist in sessionStorage (never localStorage!)
      sessionStorage.setItem("chat_session_token", generatedToken);
      sessionStorage.setItem("chat_room_code", code);
      sessionStorage.setItem("chat_nickname", name);

      setSessionToken(generatedToken);
      setRoomCode(code);
      setNickname(name);
      setView("chat");
    } catch (err) {
      console.error("Join room failed:", err);
      return "Network error joining room. Please try again.";
    }
  };

  const handleGoToJoin = (prefill = "") => {
    setPrefilledCode(prefill);
    setView("join");
  };

  return (
    <div 
      className="min-h-screen w-full flex justify-center transition-all duration-300 relative select-none font-sans" 
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
    >
      <div className="w-full max-w-[420px] min-h-screen px-4 flex flex-col justify-between py-6">
        
        {/* TOP THEME TOGGLE / SECURITY BADGE IN HOMEPAGE/CREATE/JOIN */}
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
                  onCreateRoomClick={handleCreateRoom}
                  onJoinRoomClick={() => handleGoToJoin("")}
                />
              </motion.div>
            )}

            {view === "create" && (
              <motion.div
                key="create"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <CreateRoomView
                  theme={themeConfig}
                  roomCode={createdRoomCode}
                  onBack={() => setView("home")}
                  onJoinWithCode={(code) => handleGoToJoin(code)}
                />
              </motion.div>
            )}

            {view === "join" && (
              <motion.div
                key="join"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <JoinRoomView
                  theme={themeConfig}
                  prefilledCode={prefilledCode}
                  onBack={() => setView("home")}
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
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MINIMAL FOOTER FOR HOMEPAGE/CREATE/JOIN */}
        {view !== "chat" && (
          <footer className="text-center mt-8 py-2">
            <span className="text-[10px] opacity-25 font-mono tracking-widest pl-1">
              EPHEMERAL SECURE ENDPOINT
            </span>
          </footer>
        )}
      </div>

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
