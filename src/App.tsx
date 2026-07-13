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
          const res = await fetch("/api/room/session", {
            headers: {
              "Authorization": `Bearer ${savedToken}`
            }
          });

          if (res.ok) {
            const data = await res.json();
            setSessionToken(data.sessionToken);
            setRoomCode(data.roomCode);
            setNickname(data.name);
            setView("chat");
          } else {
            // Token stale
            sessionStorage.clear();
          }
        } catch (err) {
          // If offline/server issue, fall back to clearing session or keeping local
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

  // Logout Trigger helper
  const triggerLogout = async (byTabHidden = false) => {
    const token = sessionStorage.getItem("chat_session_token") || sessionToken;
    if (token) {
      try {
        await fetch("/api/room/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
      } catch (err) {
        // Ignore network errors
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
      const res = await fetch("/api/room/create", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCreatedRoomCode(data.code);
        setView("create");
      } else {
        alert("Failed to generate room code. Please try again.");
      }
    } catch (err) {
      alert("Error contacting security service.");
    }
  };

  const handleJoinRoom = async (code: string, name: string): Promise<string | void> => {
    try {
      const currentToken = sessionStorage.getItem("chat_session_token") || "";
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": currentToken ? `Bearer ${currentToken}` : ""
        },
        body: JSON.stringify({ code, name })
      });

      const data = await res.json();

      if (!res.ok) {
        return data.error || "An unexpected error occurred.";
      }

      // Persist in sessionStorage (never localStorage!)
      sessionStorage.setItem("chat_session_token", data.sessionToken);
      sessionStorage.setItem("chat_room_code", data.roomCode);
      sessionStorage.setItem("chat_nickname", data.name);

      setSessionToken(data.sessionToken);
      setRoomCode(data.roomCode);
      setNickname(data.name);
      setView("chat");
    } catch (err) {
      return "Network error. Please try again.";
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
