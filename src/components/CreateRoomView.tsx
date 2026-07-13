import { useState } from "react";
import { motion } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { Copy, Check, MessageSquare, ArrowLeft } from "lucide-react";

interface CreateRoomViewProps {
  theme: ThemeConfig;
  roomCode: string;
  onBack: () => void;
  onJoinWithCode: (code: string) => void;
}

export default function CreateRoomView({ theme, roomCode, onBack, onJoinWithCode }: CreateRoomViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback
    }
  };

  return (
    <div className="flex flex-col min-h-[70vh]">
      {/* Header Back Button */}
      <div className="flex items-center mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium cursor-pointer py-1.5 px-3 rounded-full border transition-all duration-300"
          style={{
            borderColor: theme.border,
            backgroundColor: theme.card,
            color: theme.text
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {/* State Indicator */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="px-4 py-2 rounded-full border text-xs font-semibold uppercase tracking-wider mb-6"
          style={{
            borderColor: `${theme.accent}30`,
            backgroundColor: `${theme.accent}08`,
            color: theme.accent
          }}
        >
          Room Created
        </motion.div>

        {/* The Code block */}
        <motion.div
          initial={{ y: 15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-8"
        >
          <h2 className="text-xs uppercase tracking-widest mb-2" style={{ color: theme.textSecondary }}>
            Room Code
          </h2>
          <div 
            className="text-6xl font-black tracking-[0.25em] pl-[0.25em] select-all font-mono py-4 rounded-3xl"
            style={{ color: theme.text }}
          >
            {roomCode}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3.5">
          {/* Copy Code */}
          <button
            onClick={handleCopy}
            className="w-full h-14 rounded-full flex items-center justify-center gap-2 font-medium tracking-wide transition-all duration-300 cursor-pointer select-none border"
            style={{
              borderColor: theme.border,
              backgroundColor: theme.card,
              color: theme.text
            }}
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" style={{ color: theme.accent }} />
                Copy Code
              </>
            )}
          </button>

          {/* Join Chat */}
          <button
            onClick={() => onJoinWithCode(roomCode)}
            className="w-full h-14 rounded-full flex items-center justify-center gap-2 font-semibold tracking-wide transition-all duration-300 cursor-pointer select-none"
            style={{
              backgroundColor: theme.accent,
              color: "#ffffff"
            }}
          >
            <MessageSquare className="w-5 h-5" />
            Join Chat
          </button>
        </div>
      </div>
    </div>
  );
}
