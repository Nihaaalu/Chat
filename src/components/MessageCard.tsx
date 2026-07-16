import React from "react";
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
  const isMe = msg.sender === nickname;

  // Find original message if it's a reply
  const originalMsg = msg.replyToMessageId 
    ? allMessages.find((m) => m.id === msg.replyToMessageId) 
    : null;

  const isCat = theme.bg === "#FFF8F2";

  return (
    <div 
      className="relative group w-full overflow-visible" 
      style={{ height: "auto", minHeight: "unset" }}
    >
      {/* Desktop hover Reply button */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-250 z-10 hidden md:flex items-center"
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
      <div
        id={`msg-${msg.id}`}
        className={`p-4 border transition-all duration-300 z-10 relative select-text flex flex-col justify-start ${
          isCat ? "rounded-[24px]" : "rounded-2xl"
        } ${isHighlighted ? "ring-2" : ""}`}
        style={{
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
        {/* Reply Header (if this message is a reply) */}
        {msg.replyToMessageId && msg.replyToMessageId !== "null" && msg.replyToMessageId !== "undefined" && msg.replyToMessageId.trim() !== "" && (
          <div className="mb-2.5 w-full block" style={{ height: "auto", minHeight: "unset" }}>
            {originalMsg ? (
              <div 
                onClick={() => onReplyHeaderClick(msg.replyToMessageId!)}
                className="p-2 rounded-xl border-l-[3px] flex flex-col gap-0.5 cursor-pointer hover:opacity-90 active:scale-[0.99] transition-all duration-150 select-none"
                style={{
                  borderLeftColor: theme.accent,
                  borderColor: theme.border,
                  backgroundColor: `${theme.border}40`,
                  height: "auto",
                  minHeight: "unset"
                }}
              >
                <div className="flex flex-row items-center gap-1 font-black text-[10px] uppercase tracking-wider" style={{ color: theme.accent }}>
                  <CornerUpLeft className="w-3 h-3" />
                  <span>{originalMsg.sender}</span>
                </div>
                <p className="text-xs opacity-75 line-clamp-2 break-words" style={{ color: theme.textSecondary }}>
                  {originalMsg.content}
                </p>
              </div>
            ) : (
              <div 
                className="p-2 rounded-xl border-l-[3px] flex flex-row items-center gap-1.5 italic opacity-60 text-xs select-none"
                style={{
                  borderLeftColor: theme.border,
                  borderColor: theme.border,
                  backgroundColor: `${theme.border}20`,
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
        <div className="flex flex-row items-baseline justify-between mb-2 w-full select-none" style={{ height: "auto" }}>
          <span 
            className="text-xs font-black uppercase tracking-wider flex flex-row items-center gap-1"
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
          className="text-sm leading-relaxed break-words whitespace-pre-wrap selection:bg-slate-300 w-full block text-left"
          style={{ color: theme.text, height: "auto" }}
        >
          {msg.content}
        </p>
      </div>
    </div>
  );
}
