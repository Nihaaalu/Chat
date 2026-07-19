import { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ThemeType } from "./types.js";
import { themes } from "./theme.js";
import HomeView from "./components/HomeView.js";
import ChatView from "./components/ChatView.js";
import RandomChatView from "./components/RandomChatView.js";
import ThemeSelector from "./components/ThemeSelector.js";
import CatBackground from "./components/CatBackground.js";
import { Shield, ShieldCheck, X } from "lucide-react";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { serverTimestamp, deleteField } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType, initError, missingEnvVars, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, deleteDoc } from "./lib/firebase.js";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export default function App() {
  if (initError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans selection:bg-rose-500/30 selection:text-rose-200">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
          {/* Subtle ambient light behind */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Logo / Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-rose-500/10 border border-rose-500/20 text-rose-500">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wider uppercase text-slate-100">Setup Required</h1>
              <p className="text-[10px] uppercase font-mono tracking-widest text-slate-500">Firebase & App Check config</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-slate-400 mb-6">
            The application's connection to Firebase services is currently not configured or failed to initialize. Please define the required environment variables.
          </p>

          {/* Checklist */}
          <div className="space-y-3 mb-8 bg-slate-950/50 rounded-xl p-4 border border-slate-800/40">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Required Variables</h3>
            {[
              "VITE_FIREBASE_API_KEY",
              "VITE_FIREBASE_AUTH_DOMAIN",
              "VITE_FIREBASE_PROJECT_ID",
              "VITE_FIREBASE_STORAGE_BUCKET",
              "VITE_FIREBASE_MESSAGING_SENDER_ID",
              "VITE_FIREBASE_APP_ID"
            ].map((v) => {
              const isMissing = missingEnvVars.includes(v);
              return (
                <div key={v} className="flex items-center justify-between text-xs font-mono">
                  <span className={isMissing ? "text-slate-500 line-through" : "text-rose-400"}>{v}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${isMissing ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"}`}>
                    {isMissing ? "Missing" : "Configured"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Instructions */}
          <div className="text-xs space-y-2 text-slate-400 border-t border-slate-800/80 pt-6 font-mono">
            <div className="flex items-start gap-2">
              <span className="text-rose-500 font-bold">1.</span>
              <span>Open the <span className="text-slate-200 underline font-bold">Settings</span> menu at the top or bottom of the window.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-rose-500 font-bold">2.</span>
              <span>Input your Firebase credentials under <span className="text-slate-200 font-bold">Secrets / Env Variables</span>.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-rose-500 font-bold">3.</span>
              <span>The application will automatically reload and connect securely.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 1. Theme States (separated by section)
  const [homeTheme, setHomeTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("chat_home_theme");
    return (saved === "dark" || saved === "light") ? (saved as ThemeType) : "dark";
  });

  const [privateTheme, setPrivateTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("chat_private_theme");
    return (saved === "dark" || saved === "light" || saved === "pink" || saved === "cat") ? (saved as ThemeType) : "cat";
  });

  const [randomTheme, setRandomTheme] = useState<ThemeType>(() => {
    const saved = localStorage.getItem("chat_random_theme");
    return (saved === "dark" || saved === "light") ? (saved as ThemeType) : "dark";
  });

  // 2. Active Session States (sessionStorage only)
  const [view, setView] = useState<"home" | "chat" | "random-chat">("home");

  // Derive currentTheme based on active view
  const currentTheme = view === "home" ? homeTheme : (view === "chat" ? privateTheme : randomTheme);

  const handleThemeChange = (newTheme: ThemeType) => {
    if (view === "home") {
      if (newTheme === "dark" || newTheme === "light") {
        setHomeTheme(newTheme);
        localStorage.setItem("chat_home_theme", newTheme);
      }
    } else if (view === "chat") {
      setPrivateTheme(newTheme);
      localStorage.setItem("chat_private_theme", newTheme);
    } else if (view === "random-chat") {
      if (newTheme === "dark" || newTheme === "light") {
        setRandomTheme(newTheme);
        localStorage.setItem("chat_random_theme", newTheme);
      }
    }
  };

  const themeConfig = themes[currentTheme];

  const [roomCode, setRoomCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  // Custom visual overlay for security logouts
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  // Warning banner for grace period return
  const [gracePeriodBanner, setGracePeriodBanner] = useState<string | null>(null);

  // Dynamic Viewport Height for mobile keyboard resilience
  const [viewportHeight, setViewportHeight] = useState<string>("100vh");

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const updateHeight = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
      } else {
        setViewportHeight(`${window.innerHeight}px`);
      }
    };
    
    updateHeight();
    
    window.visualViewport?.addEventListener("resize", updateHeight);
    window.visualViewport?.addEventListener("scroll", updateHeight);
    window.addEventListener("resize", updateHeight);
    
    return () => {
      window.visualViewport?.removeEventListener("resize", updateHeight);
      window.visualViewport?.removeEventListener("scroll", updateHeight);
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

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

  // 3. Ensure Anonymous Firebase Auth Session on Mount
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        signInAnonymously(auth).catch((err) => {
          console.warn("Anonymous authentication failed (it might be disabled in the Firebase Console). Falling back to session-based UID.", err);
          if (!sessionStorage.getItem("chat_uid")) {
            const fallbackUid = "anon-" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            sessionStorage.setItem("chat_uid", fallbackUid);
          }
        });
      } else {
        sessionStorage.setItem("chat_uid", user.uid);
      }
    });
    return () => unsubAuth();
  }, []);

  // 4. Auto-Restore session on initial mount / page refresh
  useEffect(() => {
    const restoreSession = async () => {
      const savedToken = sessionStorage.getItem("chat_session_token");
      let savedRoom = sessionStorage.getItem("chat_room_code");
      const savedNick = sessionStorage.getItem("chat_nickname");
      const savedUid = sessionStorage.getItem("chat_uid");

      if (savedRoom === "1317") {
        savedRoom = "RUBY-CARR";
        sessionStorage.setItem("chat_room_code", "RUBY-CARR");
      }

      if (savedToken && savedRoom && savedNick && savedUid) {
        try {
          const collectionName = savedRoom === "RUBY-CARR" ? "chat" : "privateRooms";
          const chatRef = doc(db, collectionName, savedRoom);
          let snap;
          try {
            snap = await getDoc(chatRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `${collectionName}/${savedRoom}`);
            throw err;
          }
          if (snap.exists()) {
            const data = snap.data();
            const members = data.members || {};
            if (members[savedUid] === savedNick) {
              setSessionToken(savedToken);
              setRoomCode(savedRoom);
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

  // 5. SECURITY FEATURE 1: Tab Hidden Countdown (30 minutes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (view === "chat" && sessionToken) {
          // Trigger logout if away for 30 minutes
          tabTimeoutRef.current = setTimeout(() => {
            triggerLogout(true);
          }, 30 * 60 * 1000); // 30 minutes
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

  // 6. SECURITY FEATURE 2: Inactivity Timeout (30 minutes)
  useEffect(() => {
    if (view !== "chat" || !sessionToken) return;

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
  }, [view, sessionToken]);

  // 7. Cleanup presence on unexpected exits (beforeunload, pagehide, visibilitychange)
  useEffect(() => {
    const handleExit = () => {
      const uid = sessionStorage.getItem("chat_uid");
      const activeNick = sessionStorage.getItem("chat_nickname") || nickname;
      const activeRoom = sessionStorage.getItem("chat_room_code") || roomCode;

      if (uid && view === "chat" && activeRoom) {
        const collectionName = activeRoom === "RUBY-CARR" ? "chat" : "privateRooms";
        const chatRef = doc(db, collectionName, activeRoom);
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
  }, [view, nickname, roomCode]);

  // 8. Presence: update lastSeen field ONLY on login, logout, disconnect, and reconnect
  useEffect(() => {
    if (view !== "chat" || !nickname || !roomCode) return;

    const uid = sessionStorage.getItem("chat_uid");
    if (!uid) return;

    const updatePresence = async (status: "online" | "offline") => {
      try {
        const collectionName = roomCode === "RUBY-CARR" ? "chat" : "privateRooms";
        const chatRef = doc(db, collectionName, roomCode);
        if (status === "online") {
          console.log(`[Firestore Write] Presence - updateDoc (online) on ${collectionName}/${roomCode} for ${nickname}`);
          await updateDoc(chatRef, {
            [`lastSeen.${nickname}`]: Date.now(),
            [`members.${uid}`]: nickname
          });
        } else {
          console.log(`[Firestore Write] Presence - updateDoc (offline) on ${collectionName}/${roomCode} for ${nickname}`);
          await updateDoc(chatRef, {
            [`lastSeen.${nickname}`]: deleteField(),
            [`members.${uid}`]: deleteField()
          });
        }
      } catch (err) {
        console.error("Presence update failed:", err);
      }
    };

    // Set online status immediately upon entering the chat
    updatePresence("online");

    const handleOnline = () => updatePresence("online");
    const handleOffline = () => updatePresence("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [view, nickname, roomCode]);

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
    const activeRoom = sessionStorage.getItem("chat_room_code") || roomCode;

    // 2. Remove the current user from active room
    if (uid && activeRoom) {
      try {
        const collectionName = activeRoom === "RUBY-CARR" ? "chat" : "privateRooms";
        const chatRef = doc(db, collectionName, activeRoom);
        const updates: Record<string, any> = {
          [`members.${uid}`]: deleteField()
        };
        if (activeNick) {
          updates[`lastSeen.${activeNick}`] = deleteField();
        }

        // 3. Wait until the Firestore delete/update operation completes successfully using await.
        await updateDoc(chatRef, updates);

        const messagesRef = collection(db, collectionName, activeRoom, "messages");
        try {
          await addDoc(messagesRef, {
            sender: "SYSTEM",
            text: `${activeNick} has left the room${byTabHidden ? " due to tab inactivity" : ""}.`,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `${collectionName}/${activeRoom}/messages`);
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

    // 6. Redirect to the login page.
    setView("home");

    if (byTabHidden) {
      setSecurityNotice("You have been automatically logged out to preserve your privacy after leaving the browser tab for over 30 minutes.");
    } else if (byInactivity) {
      setSecurityNotice("You have been logged out automatically due to 30 minutes of inactivity.");
    }
  };

  const handleJoinRoom = async (
    code: string,
    username?: string,
    password?: string,
    mode?: "login" | "register",
    confirmPassword?: string
  ): Promise<string | void> => {
    try {
      const cleanCode = code.trim().toUpperCase();

      if (cleanCode === "RUBY-CARR") {
        if (!username || !password) {
          return "Invalid credentials.";
        }
        // 1. Verify permanent room credentials using fixed accounts
        if (!((username === "user1" && password === "user1") || (username === "user2" && password === "user2"))) {
          return "Invalid credentials.";
        }

        // 2. Fetch or create RUBY-CARR in the "chat" collection
        const chatRef = doc(db, "chat", "RUBY-CARR");
        let snap;
        try {
          snap = await getDoc(chatRef);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, "chat/RUBY-CARR");
          throw err;
        }

        let members: Record<string, string> = {};
        let lastSeenMap: Record<string, number> = {};

        if (snap.exists()) {
          const data = snap.data();
          members = data.members || {};
          lastSeenMap = data.lastSeen || {};
        } else {
          // Initialize first-time entry
          try {
            await setDoc(chatRef, { code: "RUBY-CARR", members: {}, lastSeen: {}, migrated: true });
            
            // Migrate history from 1317 (if any old logs exist)
            const oldRef = collection(db, "chat", "1317", "messages");
            const newRef = collection(db, "chat", "RUBY-CARR", "messages");
            try {
              const oldSnap = await getDocs(oldRef);
              for (const docSnap of oldSnap.docs) {
                const msgData = docSnap.data();
                await setDoc(doc(newRef, docSnap.id), {
                  sender: msgData.sender,
                  text: msgData.text,
                  timestamp: msgData.timestamp || serverTimestamp(),
                  replyTo: msgData.replyTo || null,
                  reactions: msgData.reactions || {}
                });
              }
            } catch (migErr) {
              console.error("Migration of messages failed:", migErr);
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, "chat/RUBY-CARR");
            throw err;
          }
        }

        const uid = auth.currentUser?.uid || sessionStorage.getItem("chat_uid") || "uid-" + Math.random().toString(36).substring(2, 15);
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
            // Stale session detected! Evict the existing session
            try {
              await updateDoc(chatRef, {
                [`members.${existingUid}`]: deleteField(),
                [`lastSeen.${username}`]: deleteField()
              });
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
          handleFirestoreError(err, OperationType.UPDATE, "chat/RUBY-CARR");
          throw err;
        }

        // 5. Post SYSTEM join notification
        const messagesRef = collection(db, "chat", "RUBY-CARR", "messages");
        try {
          await addDoc(messagesRef, {
            sender: "SYSTEM",
            text: `${username} has joined the room.`,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, "chat/RUBY-CARR/messages");
          throw err;
        }

        const generatedToken = username + "-RUBY-CARR-" + Math.random().toString(36).substring(2, 7);

        sessionStorage.setItem("chat_session_token", generatedToken);
        sessionStorage.setItem("chat_room_code", "RUBY-CARR");
        sessionStorage.setItem("chat_nickname", username);

        setSessionToken(generatedToken);
        setRoomCode("RUBY-CARR");
        setNickname(username);
        setView("chat");
        return;

      } else {
        // Custom invite-only secure private room (supporting 6-digit legacy or 9-character K7M2-XP9Q codes)
        if (cleanCode.length !== 6 && cleanCode.length !== 9) {
          return "Please enter a valid room code or RUBY-CARR.";
        }

        const roomRef = doc(db, "privateRooms", cleanCode);
        const snap = await getDoc(roomRef);

        if (!snap.exists()) {
          return "Room not found.";
        }

        const data = snap.data();
        const now = Date.now();

        if (now > data.expiresAt) {
          // Room expired - trigger automatic database wiping
          try {
            const messagesRef = collection(db, "privateRooms", cleanCode, "messages");
            const msgSnap = await getDocs(messagesRef);
            for (const d of msgSnap.docs) {
              await deleteDoc(d.ref).catch(() => {});
            }
            await deleteDoc(roomRef).catch(() => {});
          } catch (e) {
            console.error("Automatic clean cleanup of expired room failed:", e);
          }
          return "Room expired.";
        }

        const members = data.members || {};
        const accounts = data.accounts || {};
        const lastSeenMap = data.lastSeen || {};
        const accountsCount = Object.keys(accounts).length;

        const myUid = auth.currentUser?.uid || sessionStorage.getItem("chat_uid") || "uid-" + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem("chat_uid", myUid);

        if (mode === "register") {
          if (!username || !password || !confirmPassword) {
            return "Please fill out all fields.";
          }
          if (password !== confirmPassword) {
            return "Passwords do not match.";
          }
          const cleanUsername = username.trim();
          if (!cleanUsername) {
            return "Username cannot be empty.";
          }

          if (accountsCount >= 2) {
            return "Room is full. Registration is disabled.";
          }

          if (accounts[cleanUsername]) {
            return "Username already exists.";
          }

          // Secure password hash
          const hashedPassword = await hashPassword(password);

          const updatedAccounts = {
            ...accounts,
            [cleanUsername]: { hashedPassword }
          };

          await updateDoc(roomRef, {
            accounts: updatedAccounts,
            [`members.${myUid}`]: cleanUsername,
            [`lastSeen.${cleanUsername}`]: Date.now()
          });

          // Post SYSTEM join notification
          const messagesRef = collection(db, "privateRooms", cleanCode, "messages");
          await addDoc(messagesRef, {
            sender: "SYSTEM",
            text: `${cleanUsername} has joined the room.`,
            timestamp: serverTimestamp()
          });

          const generatedToken = cleanUsername + "-" + cleanCode + "-" + Math.random().toString(36).substring(2, 7);
          sessionStorage.setItem("chat_session_token", generatedToken);
          sessionStorage.setItem("chat_room_code", cleanCode);
          sessionStorage.setItem("chat_nickname", cleanUsername);

          setSessionToken(generatedToken);
          setRoomCode(cleanCode);
          setNickname(cleanUsername);
          setView("chat");
          return;

        } else if (mode === "login") {
          if (!username || !password) {
            return "Please enter username and password.";
          }
          const cleanUsername = username.trim();
          if (!accounts[cleanUsername]) {
            return "Invalid username or password.";
          }

          const hashedInput = await hashPassword(password);
          if (accounts[cleanUsername].hashedPassword !== hashedInput) {
            return "Invalid username or password.";
          }

          // Verify if the selected username is already connected under a different session/UID
          const existingSession = Object.entries(members).find(
            ([mUid, mName]) => mName === cleanUsername && mUid !== myUid
          );

          if (existingSession) {
            const [existingUid] = existingSession;
            const lastSeenTime = lastSeenMap[cleanUsername];
            const isStale = lastSeenTime ? (Date.now() - lastSeenTime > 60000) : true;

            if (isStale) {
              await updateDoc(roomRef, {
                [`members.${existingUid}`]: deleteField(),
                [`lastSeen.${cleanUsername}`]: deleteField()
              });
              delete members[existingUid];
              delete lastSeenMap[cleanUsername];
            } else {
              return "This account is already active.";
            }
          }

          // Update members list & presence
          await updateDoc(roomRef, {
            [`members.${myUid}`]: cleanUsername,
            [`lastSeen.${cleanUsername}`]: Date.now()
          });

          // Post SYSTEM join notification
          const messagesRef = collection(db, "privateRooms", cleanCode, "messages");
          await addDoc(messagesRef, {
            sender: "SYSTEM",
            text: `${cleanUsername} has joined the room.`,
            timestamp: serverTimestamp()
          });

          const generatedToken = cleanUsername + "-" + cleanCode + "-" + Math.random().toString(36).substring(2, 7);
          sessionStorage.setItem("chat_session_token", generatedToken);
          sessionStorage.setItem("chat_room_code", cleanCode);
          sessionStorage.setItem("chat_nickname", cleanUsername);

          setSessionToken(generatedToken);
          setRoomCode(cleanCode);
          setNickname(cleanUsername);
          setView("chat");
          return;
        } else {
          return "Verification failed. Please try again.";
        }
      }
    } catch (err) {
      console.error("Join failed:", err);
      return "Network error joining chat room.";
    }
  };

  const handleStartRandomChat = () => {
    setView("random-chat");
  };

  const handleLeaveRandomChat = () => {
    setView("home");
  };

  const handleLeaveCallback = useCallback(() => {
    triggerLogout(false);
  }, [nickname, roomCode]);

  const registerUnsubscribeCallback = useCallback((unsub: () => void) => {
    unsubscribesRef.current.push(unsub);
  }, []);

  return (
    <div 
      className="min-h-screen w-full flex justify-center transition-all duration-300 relative select-none font-sans mobile-no-scrollbar" 
      style={{ backgroundColor: themeConfig.bg, color: themeConfig.text }}
    >
      {currentTheme === "cat" && view === "home" && <CatBackground theme={themeConfig} />}
      <div 
        className={`w-full max-w-[420px] flex flex-col mobile-no-scrollbar ${view !== "home" ? "overflow-hidden" : "h-screen max-md:h-dvh px-4 justify-between py-6 overflow-y-auto"}`}
        style={{ height: view !== "home" ? viewportHeight : undefined }}
      >
        
        {/* TOP THEME TOGGLE / SECURITY BADGE IN HOMEPAGE */}
        {view === "home" && (
          <header className="flex items-center justify-between h-12 mb-4 shrink-0">
            <div className="flex items-center gap-1.5 opacity-60">
              <Shield className="w-4 h-4" style={{ color: themeConfig.accent }} />
              <span className="text-[10px] font-bold tracking-widest uppercase">
                Privacy Active
              </span>
            </div>
            <ThemeSelector currentTheme={currentTheme} onThemeChange={handleThemeChange} allowedThemes={["dark", "light"]} />
          </header>
        )}

        {/* WORKSPACE AREA with slide transitions */}
        <div className={`flex flex-col ${view !== "home" ? "h-full w-full overflow-hidden" : "flex-1 justify-center shrink-0"}`}>
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
                  onStartRandomChat={handleStartRandomChat}
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
                  onLeave={handleLeaveCallback}
                  registerUnsubscribe={registerUnsubscribeCallback}
                />
              </motion.div>
            )}

            {view === "random-chat" && (
              <motion.div
                key="random-chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full h-full"
              >
                <RandomChatView
                  theme={themeConfig}
                  onLeave={handleLeaveRandomChat}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MINIMAL FOOTER FOR HOMEPAGE */}
        {view === "home" && (
          <footer className="text-center mt-8 py-2 shrink-0">
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
