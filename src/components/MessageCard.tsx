import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { MessageType, ThemeType } from "../types.js";
import { CornerUpLeft, Smile, Copy, Edit3, Trash2, Pin, Check } from "lucide-react";

interface MessageCardProps {
  msg: MessageType;
  allMessages: MessageType[];
  nickname: string;
  theme: ThemeConfig;
  currentThemeType: ThemeType;
  onReply: (msg: MessageType) => void;
  onReplyHeaderClick: (replyToId: string) => void;
  isHighlighted: boolean;
  formatTime: (isoString: string) => string;
  onReaction: (msgId: string, emoji: string) => void;
  onPin: (msg: MessageType) => void;
  onCopy: (msg: MessageType) => void;
  onDelete: (msgId: string, forEveryone: boolean) => void;
  onStartEditing: (msg: MessageType) => void;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  showTimestamps: boolean;
}

const MiniCatBadge = () => (
  <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-amber-100 border border-amber-200 shrink-0 select-none">
    <svg viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-2.5 h-2.5">
      <path d="M4 11a8 8 0 0 0 16 0c0-1.5-.5-3.5-1.5-5.5L15.5 8H8.5L5.5 5.5C4.5 7.5 4 9.5 4 11z" />
    </svg>
  </span>
);

export default function MessageCard({
  msg,
  allMessages,
  nickname,
  theme,
  currentThemeType,
  onReply,
  onReplyHeaderClick,
  isHighlighted,
  formatTime,
  onReaction,
  onPin,
  onCopy,
  onDelete,
  onStartEditing,
  fontSize,
  compactMode,
  showTimestamps
}: MessageCardProps) {
  const isMe = msg.sender === nickname;
  const isCat = currentThemeType === "cat";

  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  // Find original message if it's a reply
  const originalMsg = msg.replyToMessageId 
    ? allMessages.find((m) => m.id === msg.replyToMessageId) 
    : null;

  // Handles long press and right click context menus
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (msg.isDeleted) return;
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if (msg.isDeleted) return;
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setMenuPosition({ x: touch.clientX, y: touch.clientY });
      setShowMenu(true);
      try {
        if (window.navigator.vibrate) {
          window.navigator.vibrate(40);
        }
      } catch (err) {}
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  useEffect(() => {
    if (!showMenu) return;
    const closeMenu = () => setShowMenu(false);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, [showMenu]);

  // Utility to determine font size classes
  const getFontSizeClass = () => {
    if (fontSize === 'small') return 'text-xs';
    if (fontSize === 'large') return 'text-base';
    return 'text-sm';
  };

  // Renders the checkmark statuses for own messages
  const renderMessageStatus = () => {
    if (!isMe || msg.isDeleted) return null;
    const status = msg.status || "sent";
    if (status === "read") {
      return (
        <span className="flex items-center text-[10px] font-black select-none ml-1.5 shrink-0" style={{ color: theme.accent }} title="Read">
          ✓✓
        </span>
      );
    } else if (status === "delivered") {
      return (
        <span className="flex items-center text-[10px] font-black opacity-50 select-none ml-1.5 shrink-0" style={{ color: theme.textSecondary }} title="Delivered">
          ✓✓
        </span>
      );
    } else {
      return (
        <span className="flex items-center text-[10px] font-black opacity-40 select-none ml-1.5 shrink-0" style={{ color: theme.textSecondary }} title="Sent">
          ✓
        </span>
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: isMe ? 0 : 8, scale: isMe ? 0.97 : 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      drag={!msg.isDeleted ? "x" : false}
      dragDirectionLock
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.4 }}
      onDragEnd={(event, info) => {
        if (info.offset.x > 80) {
          onReply(msg);
        }
      }}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative group w-full overflow-visible"
      style={{ height: "auto", minHeight: "unset" }}
    >
      {/* Background reply visual cue on swipe-right */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 pl-3 opacity-0 group-drag-active:opacity-100 transition-opacity pointer-events-none z-0">
        <CornerUpLeft className="w-5 h-5" style={{ color: theme.accent }} />
      </div>

      {/* Desktop hover button bar */}
      {!msg.isDeleted && (
        <div 
          className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 hidden md:flex items-center gap-1"
          style={{
            left: isMe ? "-75px" : "auto",
            right: isMe ? "auto" : "-75px"
          }}
        >
          {/* Smile button for quick reaction picker */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuPosition({ x: e.clientX, y: e.clientY });
              setShowMenu(true);
            }}
            className="p-1.5 rounded-full border cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-sm"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.card,
              color: theme.textSecondary
            }}
            title="React"
          >
            <Smile className="w-3.5 h-3.5" style={{ color: theme.accent }} />
          </button>

          {/* Reply button */}
          <button
            onClick={() => onReply(msg)}
            className="p-1.5 rounded-full border cursor-pointer hover:scale-110 active:scale-95 transition-all shadow-sm"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.card,
              color: theme.textSecondary
            }}
            title="Reply"
          >
            <CornerUpLeft className="w-3.5 h-3.5" style={{ color: theme.accent }} />
          </button>
        </div>
      )}

      {/* Main Message Bubble card */}
      <div
        id={`msg-${msg.id}`}
        className={`border transition-all duration-300 z-10 relative select-text flex flex-col justify-start ${
          isCat ? "rounded-[24px]" : "rounded-2xl"
        } ${isHighlighted ? "scale-[1.01] shadow-md ring-2" : ""}`}
        style={{
          padding: compactMode ? "0.6rem 0.95rem" : "1rem",
          backgroundColor: isCat
            ? (isMe ? "#FFF0DB" : "#FCF8F2")
            : (isMe ? `${theme.accent}05` : theme.card),
          borderColor: isHighlighted 
            ? theme.accent 
            : (isCat 
                ? (isMe ? "#F9D7AC" : "#EFE3D3") 
                : (isMe ? `${theme.accent}30` : theme.border)),
          boxShadow: isHighlighted
            ? `0px 0px 14px ${theme.accent}40`
            : (isCat ? "0 4px 20px rgba(139, 126, 116, 0.08)" : "0px 0px 0px rgba(0,0,0,0)"),
          marginLeft: isMe ? "2rem" : "0",
          marginRight: isMe ? "0" : "2rem",
          height: "auto",
          minHeight: "unset",
          flexGrow: 0,
          flexShrink: 0
        }}
      >
        {/* Reply Header */}
        {!msg.isDeleted && msg.replyToMessageId && msg.replyToMessageId !== "null" && msg.replyToMessageId !== "undefined" && msg.replyToMessageId.trim() !== "" && (
          <div className="mb-2 w-full block" style={{ height: "auto", minHeight: "unset" }}>
            {originalMsg ? (
              <div 
                onClick={() => onReplyHeaderClick(msg.replyToMessageId!)}
                className="p-2 rounded-xl border-l-[3px] flex flex-col gap-0.5 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all duration-150 select-none text-left"
                style={{
                  borderLeftColor: theme.accent,
                  borderColor: theme.border,
                  backgroundColor: isCat ? "#FFF6EB" : `${theme.border}30`,
                  height: "auto",
                  minHeight: "unset"
                }}
              >
                <div className="flex flex-row items-center gap-1 font-black text-[9px] uppercase tracking-wider" style={{ color: theme.accent }}>
                  <CornerUpLeft className="w-3 h-3" />
                  <span>{originalMsg.sender}</span>
                </div>
                <p className="text-[11px] opacity-75 line-clamp-1 break-all" style={{ color: theme.textSecondary }}>
                  {originalMsg.isDeleted ? "This message was deleted." : originalMsg.content}
                </p>
              </div>
            ) : (
              <div 
                className="p-1.5 rounded-xl border-l-[3px] flex flex-row items-center gap-1.5 italic opacity-50 text-[11px] select-none text-left"
                style={{
                  borderLeftColor: theme.border,
                  borderColor: theme.border,
                  backgroundColor: `${theme.border}15`,
                  height: "auto",
                  minHeight: "unset"
                }}
              >
                <CornerUpLeft className="w-3 h-3" style={{ color: theme.textSecondary }} />
                <span style={{ color: theme.textSecondary }}>Original message unavailable</span>
              </div>
            )}
          </div>
        )}

        {/* Card Header: Sender Name & Time */}
        <div className="flex flex-row items-baseline justify-between mb-1.5 w-full select-none" style={{ height: "auto" }}>
          <span 
            className="text-[11px] font-black uppercase tracking-wider flex flex-row items-center gap-1"
            style={{ color: isMe ? theme.accent : theme.text }}
          >
            {isCat && <MiniCatBadge />}
            {msg.sender}
          </span>
          {showTimestamps && (
            <div className="flex items-center text-[9px] font-mono opacity-40 pl-2 shrink-0" style={{ color: theme.text }}>
              {msg.isEdited && <span className="mr-1 italic font-bold">Edited</span>}
              <span>{formatTime(msg.createdAt)}</span>
              {renderMessageStatus()}
            </div>
          )}
        </div>

        {/* Card Body: Message */}
        <div className="w-full text-left" style={{ height: "auto" }}>
          {msg.isDeleted ? (
            <p className="text-xs italic opacity-50 select-none flex items-center gap-1" style={{ color: theme.text }}>
              <span>This message was deleted.</span>
            </p>
          ) : (
            <p 
              className={`${getFontSizeClass()} leading-relaxed break-words whitespace-pre-wrap selection:bg-slate-300 w-full block`}
              style={{ color: theme.text }}
            >
              {msg.content}
            </p>
          )}
        </div>

        {/* Message Reactions display below message text */}
        {!msg.isDeleted && msg.reactions && Object.entries(msg.reactions).some(([_, users]) => users.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-2.5 select-none" style={{ height: "auto" }}>
            {Object.entries(msg.reactions).map(([emoji, users]) => {
              if (!users || users.length === 0) return null;
              const hasMyReaction = users.includes(nickname);
              return (
                <motion.button
                  key={emoji}
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: [0.7, 1.15, 1], opacity: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onReaction(msg.id, emoji)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-bold cursor-pointer transition-colors"
                  style={{
                    borderColor: hasMyReaction ? theme.accent : theme.border,
                    backgroundColor: hasMyReaction ? `${theme.accent}15` : theme.card,
                    color: hasMyReaction ? theme.accent : theme.textSecondary
                  }}
                >
                  <span>{emoji}</span>
                  <span>{users.length}</span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* High-Fidelity Custom Dropdown Context Menu (rendered as absolute fixed popup) */}
      <AnimatePresence>
        {showMenu && (
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowMenu(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 5 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 5 }}
              transition={{ duration: 0.12 }}
              className="fixed z-50 rounded-2xl border p-2 shadow-xl flex flex-col gap-0.5 w-44"
              style={{
                top: `${Math.min(window.innerHeight - 200, menuPosition.y)}px`,
                left: `${Math.min(window.innerWidth - 190, menuPosition.x)}px`,
                backgroundColor: theme.card,
                borderColor: theme.border,
                color: theme.text,
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Emojis Reaction Picker row */}
              <div className="flex items-center justify-between border-b pb-1.5 mb-1 gap-0.5 px-1">
                {["❤️", "👍", "😂", "😮", "😢", "🔥", "✨"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onReaction(msg.id, emoji);
                      setShowMenu(false);
                    }}
                    className="text-base hover:scale-130 active:scale-95 transition-transform duration-100 cursor-pointer shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Pin Message Option */}
              <button
                onClick={() => {
                  onPin(msg);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
              >
                <Pin className="w-3.5 h-3.5" style={{ color: theme.accent }} />
                <span>Pin Message</span>
              </button>

              {/* Copy Message Option */}
              <button
                onClick={() => {
                  onCopy(msg);
                  setShowMenu(false);
                }}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-blue-500" />
                <span>Copy Message</span>
              </button>

              {/* Edit Message Option (only if own message and under 10 minutes) */}
              {isMe && (new Date().getTime() - new Date(msg.createdAt).getTime() < 10 * 60 * 1000) && (
                <button
                  onClick={() => {
                    onStartEditing(msg);
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-left cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-500" />
                  <span>Edit Message</span>
                </button>
              )}

              {/* Delete Message options */}
              <div className="border-t my-1 pt-1">
                <button
                  onClick={() => {
                    onDelete(msg.id, false); // Delete for Me
                    setShowMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold rounded-xl text-red-500 hover:bg-red-500/10 text-left cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete for Me</span>
                </button>

                {isMe && (
                  <button
                    onClick={() => {
                      onDelete(msg.id, true); // Delete for Everyone
                      setShowMenu(false);
                    }}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-bold rounded-xl text-red-600 hover:bg-red-600/10 text-left cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete for Everyone</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
