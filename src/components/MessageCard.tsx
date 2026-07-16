import React, { useState } from "react";
import { motion } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { MessageType } from "../types.js";
import { CornerUpLeft } from "lucide-react";

interface MessageCardProps {
  key?: React.Key;
  msg: MessageType;
  allMessages: MessageType[];
  nickname: string;
  theme: ThemeConfig;
  onReply: (msg: MessageType) => void;
  onReplyHeaderClick: (replyToId: string) => void;
  isHighlighted: boolean;
  formatTime: (isoString: string) => string;
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
  onReply,
  onReplyHeaderClick,
  isHighlighted,
  formatTime
}: MessageCardProps) {
  const [dragX, setDragX] = useState(0);
  const isMe = msg.sender === nickname;

  // Find original message if it's a reply
  const originalMsg = msg.replyToMessageId 
    ? allMessages.find((m) => m.id === msg.replyToMessageId) 
    : null;

  const threshold = 80;
  const opacity = Math.min(Math.max(dragX, 0) / threshold, 1);
  const scale = 0.5 + Math.min(Math.max(dragX, 0) / threshold, 1) * 0.5;
  const isTriggered = dragX > threshold;

  const isCat = theme.bg === "#FFF8F2";

  return (
    <div className="relative group w-full overflow-visible">
      {/* Swipe background reveal: show reply icon on swipe right */}
      <div 
        className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-0" 
        style={{ opacity }}
      >
        <motion.div 
          animate={{ 
            scale: isTriggered ? 1.25 : scale, 
            color: isTriggered ? theme.accent : theme.textSecondary 
          }}
          transition={{ duration: 0.15 }}
          className="p-2 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${theme.border}40` }}
        >
          <CornerUpLeft className="w-4 h-4" />
        </motion.div>
      </div>

      {/* Desktop hover Reply button */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-250 z-10 hidden md:flex items-center pointer-events-none"
        style={{
          left: isMe ? "-40px" : "auto",
          right: isMe ? "auto" : "-40px"
        }}
      >
        <button
          onClick={() => onReply(msg)}
          className="p-1.5 rounded-full border cursor-pointer hover:scale-110 active:scale-95 transition-all duration-200 shadow-sm pointer-events-auto"
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

      {/* Main Message Card */}
      <motion.div
        id={`msg-${msg.id}`}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ right: 0.5, left: 0 }}
        onDrag={(event, info) => {
          // Only track positive drag (left to right)
          if (info.offset.x > 0) {
            setDragX(info.offset.x);
          } else {
            setDragX(0);
          }
        }}
        onDragEnd={(event, info) => {
          setDragX(0);
          if (info.offset.x > threshold) {
            if (window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate(10);
            }
            onReply(msg);
          }
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={
          isHighlighted 
            ? {
                opacity: 1,
                y: 0,
                scale: [1, 1.02, 0.98, 1.01, 1],
                borderColor: [
                  isCat 
                    ? (isMe ? "#F9D7AC" : "#EFE3D3")
                    : (isMe ? `${theme.accent}30` : theme.border), 
                  theme.accent, 
                  isCat 
                    ? (isMe ? "#F9D7AC" : "#EFE3D3")
                    : (isMe ? `${theme.accent}30` : theme.border)
                ],
                boxShadow: [
                  isCat ? "0 4px 20px rgba(139, 126, 116, 0.08)" : "0px 0px 0px rgba(0,0,0,0)",
                  `0px 0px 14px ${theme.accent}40`,
                  isCat ? "0 4px 20px rgba(139, 126, 116, 0.08)" : "0px 0px 0px rgba(0,0,0,0)"
                ]
              }
            : { 
                opacity: 1, 
                y: 0, 
                scale: 1,
                borderColor: isCat
                  ? (isMe ? "#F9D7AC" : "#EFE3D3")
                  : (isMe ? `${theme.accent}30` : theme.border),
                boxShadow: isCat ? "0 4px 20px rgba(139, 126, 116, 0.08)" : "0px 0px 0px rgba(0,0,0,0)"
              }
        }
        exit={{ opacity: 0 }}
        transition={
          isHighlighted 
            ? { duration: 1.2, ease: "easeInOut" }
            : { duration: 0.2 }
        }
        className={`p-4 border transition-all duration-300 z-10 relative select-text ${
          isCat ? "rounded-[24px]" : "rounded-2xl"
        }`}
        style={{
          backgroundColor: isCat
            ? (isMe ? "#FFF0DB" : "#FCF8F2")
            : (isMe ? `${theme.accent}05` : theme.card),
          marginLeft: isMe ? "2rem" : "0",
          marginRight: isMe ? "0" : "2rem"
        }}
      >
        {/* Reply Header (if this message is a reply) */}
        {msg.replyToMessageId && (
          <div className="mb-2.5">
            {originalMsg ? (
              <div 
                onClick={() => onReplyHeaderClick(msg.replyToMessageId!)}
                className="p-2 rounded-xl border-l-[3px] flex flex-col gap-0.5 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all duration-150 select-none"
                style={{
                  borderLeftColor: theme.accent,
                  borderColor: theme.border,
                  backgroundColor: `${theme.border}40`
                }}
              >
                <div className="flex items-center gap-1 font-black text-[10px] uppercase tracking-wider" style={{ color: theme.accent }}>
                  <CornerUpLeft className="w-3 h-3" />
                  <span>{originalMsg.sender}</span>
                </div>
                <p className="text-xs opacity-75 line-clamp-2 break-words" style={{ color: theme.textSecondary }}>
                  {originalMsg.content}
                </p>
              </div>
            ) : (
              <div 
                className="p-2 rounded-xl border-l-[3px] flex items-center gap-1.5 italic opacity-60 text-xs select-none"
                style={{
                  borderLeftColor: theme.border,
                  borderColor: theme.border,
                  backgroundColor: `${theme.border}20`
                }}
              >
                <CornerUpLeft className="w-3 h-3" style={{ color: theme.textSecondary }} />
                <span style={{ color: theme.textSecondary }}>Original message unavailable</span>
              </div>
            )}
          </div>
        )}

        {/* Card Header: Sender Name & Time */}
        <div className="flex items-baseline justify-between mb-2 select-none">
          <span 
            className="text-xs font-black uppercase tracking-wider flex items-center gap-1"
            style={{ color: isMe ? theme.accent : theme.text }}
          >
            {isCat && <MiniCatBadge />}
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
    </div>
  );
}
