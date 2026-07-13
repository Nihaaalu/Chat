import { ThemeType } from "../types.js";
import { themes } from "../theme.js";

interface ThemeSelectorProps {
  currentTheme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
}

export default function ThemeSelector({ currentTheme, onThemeChange }: ThemeSelectorProps) {
  const options: { value: ThemeType; label: string; tooltip: string }[] = [
    { value: "dark", label: "🌙", tooltip: "Dark Theme" },
    { value: "light", label: "☀️", tooltip: "Light Theme" },
    { value: "pink", label: "🌸", tooltip: "Pink Theme" },
    { value: "cat", label: "🐈", tooltip: "Cat Theme" }
  ];

  const config = themes[currentTheme];

  return (
    <div 
      className="flex items-center gap-1.5 p-1 rounded-full border transition-all duration-300"
      style={{ borderColor: config.border, backgroundColor: config.card }}
    >
      {options.map((opt) => {
        const isActive = currentTheme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onThemeChange(opt.value)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 cursor-pointer select-none active:scale-90"
            style={{
              backgroundColor: isActive ? config.accent : "transparent",
              filter: isActive ? "brightness(1)" : "opacity(0.65)"
            }}
            title={opt.tooltip}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
