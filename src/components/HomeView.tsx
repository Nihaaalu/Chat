import { motion } from "motion/react";
import { ThemeConfig } from "../theme.js";
import { MessageSquare, Plus, ArrowRight } from "lucide-react";

interface HomeViewProps {
  theme: ThemeConfig;
  onCreateRoomClick: () => void;
  onJoinRoomClick: () => void;
}

export default function HomeView({ theme, onCreateRoomClick, onJoinRoomClick }: HomeViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      {/* Visual Icon Header */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8"
        style={{ backgroundColor: `${theme.accent}15` }}
      >
        <MessageSquare className="w-8 h-8" style={{ color: theme.accent }} />
      </motion.div>

      {/* Title & Subtitle */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="text-center mb-12"
      >
        <h1 
          className="text-3xl font-extrabold tracking-widest uppercase mb-3"
          style={{ color: theme.text }}
        >
          Private Chat
        </h1>
        <p 
          className="text-sm max-w-xs mx-auto"
          style={{ color: theme.textSecondary }}
        >
          Secure temporary one-to-one conversation.
        </p>
      </motion.div>

      {/* Buttons Block */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
        className="flex flex-col gap-4 w-full"
      >
        {/* Create Room Button */}
        <button
          onClick={onCreateRoomClick}
          className="w-full h-14 rounded-full flex items-center justify-center gap-2 font-medium tracking-wide transition-all duration-300 cursor-pointer select-none border"
          style={{
            borderColor: theme.border,
            backgroundColor: theme.card,
            color: theme.text
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = `${theme.accent}08`;
            e.currentTarget.style.borderColor = theme.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.card;
            e.currentTarget.style.borderColor = theme.border;
          }}
        >
          <Plus className="w-5 h-5" style={{ color: theme.accent }} />
          Create Room
        </button>

        {/* Join Room Button */}
        <button
          onClick={onJoinRoomClick}
          className="w-full h-14 rounded-full flex items-center justify-center gap-2 font-semibold tracking-wide transition-all duration-300 cursor-pointer select-none"
          style={{
            backgroundColor: theme.accent,
            color: "#ffffff" // Always contrast with dark/light/pink accent colors
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = "brightness(0.9)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "none";
          }}
        >
          Join Room
          <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>
    </div>
  );
}
