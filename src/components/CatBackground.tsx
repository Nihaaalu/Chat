import React, { useEffect, useRef } from "react";
import { ThemeConfig } from "../theme.js";

interface CatBackgroundProps {
  theme: ThemeConfig;
}

export default function CatBackground({ theme }: CatBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // DOM element refs for direct 60 FPS animation (no React re-render lag)
  const catContainerRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<SVGPathElement | null>(null);
  const headRef = useRef<SVGGElement | null>(null);
  const tailRef = useRef<SVGPathElement | null>(null);
  const eyeLRef = useRef<SVGCircleElement | null>(null);
  const eyeRRef = useRef<SVGCircleElement | null>(null);
  const eyeLClosedRef = useRef<SVGLineElement | null>(null);
  const eyeRClosedRef = useRef<SVGLineElement | null>(null);

  // Set up high-performance Canvas for floating paw prints
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to full screen
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);
    handleResize();

    // Floating Paw print interface
    interface FloatingPaw {
      x: number;
      y: number;
      speedY: number;
      driftSpeed: number;
      driftRange: number;
      scale: number;
      opacity: number;
      phase: number;
    }

    // Paw pool
    const paws: FloatingPaw[] = [];
    const maxPaws = 8; // Gentle and subtle, not distracting

    // Spawn a single paw print near the bottom
    const spawnPaw = (isInitial = false): FloatingPaw => {
      return {
        x: Math.random() * window.innerWidth,
        y: isInitial ? Math.random() * window.innerHeight : window.innerHeight + 20,
        speedY: 0.3 + Math.random() * 0.4, // Very slow drift upwards
        driftSpeed: 0.001 + Math.random() * 0.002,
        driftRange: 15 + Math.random() * 20,
        scale: 0.6 + Math.random() * 0.4,
        opacity: isInitial ? Math.random() * 0.6 : 0.8,
        phase: Math.random() * Math.PI * 2,
      };
    };

    // Initialize with a few paws already on screen
    for (let i = 0; i < maxPaws; i++) {
      paws.push(spawnPaw(true));
    }

    let animationFrameId: number;
    let lastTime = performance.now();

    // Helper to draw a single paw print on canvas
    const drawPawPrint = (c: CanvasRenderingContext2D, x: number, y: number, scale: number, opacity: number) => {
      c.save();
      c.translate(x, y);
      c.scale(scale, scale);
      c.fillStyle = `${theme.border}${Math.floor(opacity * 255).toString(16).padStart(2, "0")}`;

      // Main center pad
      c.beginPath();
      c.arc(0, 0, 7, 0, Math.PI * 2);
      c.fill();

      // Lower center bump of pad for realistic paw look
      c.beginPath();
      c.ellipse(0, 3, 9, 6, 0, 0, Math.PI * 2);
      c.fill();

      // 4 tiny toes
      c.beginPath();
      c.arc(-8, -6, 2.5, 0, Math.PI * 2); // left outer toe
      c.fill();

      c.beginPath();
      c.arc(-3, -11, 2.5, 0, Math.PI * 2); // left inner toe
      c.fill();

      c.beginPath();
      c.arc(3, -11, 2.5, 0, Math.PI * 2); // right inner toe
      c.fill();

      c.beginPath();
      c.arc(8, -6, 2.5, 0, Math.PI * 2); // right outer toe
      c.fill();

      c.restore();
    };

    const runLoop = (now: number) => {
      // Pause animation when page is not visible
      if (document.hidden) {
        lastTime = now;
        animationFrameId = requestAnimationFrame(runLoop);
        return;
      }

      const delta = Math.min(now - lastTime, 100);
      lastTime = now;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Update and draw floating paw prints
      for (let i = 0; i < paws.length; i++) {
        const p = paws[i];

        // Float up
        p.y -= p.speedY * (delta / 16);
        
        // Horizontal wave drift
        p.phase += p.driftSpeed * delta;
        const currentX = p.x + Math.sin(p.phase) * p.driftRange;

        // Fade slowly as it gets higher
        p.opacity -= 0.001 * (delta / 16);

        // Recycle paw if it goes off screen or fades completely
        if (p.y < -20 || p.opacity <= 0) {
          paws[i] = spawnPaw(false);
        } else {
          drawPawPrint(ctx, currentX, p.y, p.scale, p.opacity);
        }
      }

      // 2. Animate the cute Cat Illustration components directly via DOM styles
      // Breathing cycle (constant, slow, cozy Y scale fluctuation)
      const breathe = 1 + Math.sin(now * 0.0018) * 0.015;
      if (bodyRef.current) {
        bodyRef.current.style.transform = `scaleY(${breathe})`;
      }

      // Head slight cozy tilt matching the breathing
      if (headRef.current) {
        const headTilt = Math.sin(now * 0.0018) * 1;
        headRef.current.style.transform = `rotate(${headTilt}deg) translateY(${Math.sin(now * 0.0018) * 0.8}px)`;
      }

      // Blinking eyes: close eye circles and show closed line segments for 150ms every 4.2 seconds
      const blinkCycle = now % 4200;
      const isBlinking = blinkCycle > 4050;
      if (eyeLRef.current && eyeRRef.current && eyeLClosedRef.current && eyeRClosedRef.current) {
        if (isBlinking) {
          eyeLRef.current.style.opacity = "0";
          eyeRRef.current.style.opacity = "0";
          eyeLClosedRef.current.style.opacity = "1";
          eyeRClosedRef.current.style.opacity = "1";
        } else {
          eyeLRef.current.style.opacity = "1";
          eyeRRef.current.style.opacity = "1";
          eyeLClosedRef.current.style.opacity = "0";
          eyeRClosedRef.current.style.opacity = "0";
        }
      }

      // Tail wag: wags playfully for 1.8s, then rests for 3s
      const tailCycle = now % 4800;
      let tailAngle = 0;
      if (tailCycle < 1800) {
        // Active tail wagging
        tailAngle = Math.sin(tailCycle * 0.008) * 12;
      } else {
        // Gentle resting position
        tailAngle = Math.sin(now * 0.001) * 2;
      }
      if (tailRef.current) {
        tailRef.current.style.transform = `rotate(${tailAngle}deg)`;
      }

      animationFrameId = requestAnimationFrame(runLoop);
    };

    animationFrameId = requestAnimationFrame(runLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [theme]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* 🐾 Canvas particle background */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* 🐈 Cozy sitting cat illustration + yarn ball centered at bottom */}
      <div
        ref={catContainerRef}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] flex items-end justify-between px-10 pb-2 overflow-visible select-none"
      >
        {/* Cozy Sitting Cat Illustration */}
        <div className="relative w-28 h-28 overflow-visible flex items-end">
          <svg
            viewBox="0 0 100 100"
            width="112"
            height="112"
            className="overflow-visible"
          >
            {/* Tail (wagging back and forth from bottom-right base) */}
            <path
              ref={tailRef}
              d="M 62,80 C 72,78 88,72 82,50 C 78,35 68,40 70,25 C 72,12 85,15 82,6"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="5.5"
              strokeLinecap="round"
              style={{ transformOrigin: "62px 80px", transition: "transform 0.1s ease-out" }}
            />

            {/* Back Hip / Leg (Sitting curve) */}
            <path
              d="M 24,84 C 14,84 10,74 15,68 C 22,60 30,68 34,74 C 36,78 32,84 24,84 Z"
              fill="#E08300"
            />

            {/* Main Chubby Body (breathing up and down) */}
            <path
              ref={bodyRef}
              d="M 28,84 C 20,84 24,52 35,42 C 45,34 58,40 65,54 C 72,68 68,84 60,84 Z"
              fill="#F59E0B"
              style={{ transformOrigin: "45px 84px" }}
            />

            {/* Soft Creamy Underbelly */}
            <ellipse cx="44" cy="68" rx="12" ry="10" fill="#FFFFFF" opacity="0.95" />

            {/* Front paws neatly aligned together */}
            <g>
              {/* Left Front Leg/Paw */}
              <rect x="36" y="70" width="6" height="15" rx="3" fill="#E08300" />
              <circle cx="39" cy="85" r="3.5" fill="#FFFFFF" />

              {/* Right Front Leg/Paw */}
              <rect x="44" y="70" width="6" height="15" rx="3" fill="#F59E0B" />
              <circle cx="47" cy="85" r="3.5" fill="#FFFFFF" />
            </g>

            {/* Head and Face (tilts slightly with breath) */}
            <g ref={headRef} style={{ transformOrigin: "46px 36px" }}>
              {/* Left Ear */}
              <polygon points="34,26 28,10 41,20" fill="#F59E0B" />
              <polygon points="35,24 30,13 39,20" fill="#FCA5A5" />

              {/* Right Ear */}
              <polygon points="58,20 71,10 65,26" fill="#F59E0B" />
              <polygon points="59,20 68,13 64,24" fill="#FCA5A5" />

              {/* Chubby Head */}
              <rect x="30" y="20" width="32" height="26" rx="12" fill="#F59E0B" />
              {/* Cheek highlights */}
              <ellipse cx="36" cy="38" rx="4" ry="2.5" fill="#FCA5A5" opacity="0.4" />
              <ellipse cx="56" cy="38" rx="4" ry="2.5" fill="#FCA5A5" opacity="0.4" />

              {/* Eyes Open */}
              <circle ref={eyeLRef} cx="40" cy="30" r="2.2" fill="#2B2B2B" className="transition-opacity duration-75" />
              <circle ref={eyeRRef} cx="52" cy="30" r="2.2" fill="#2B2B2B" className="transition-opacity duration-75" />

              {/* Eyes Closed (Blinking) */}
              <line
                ref={eyeLClosedRef}
                x1="37.5"
                y1="30"
                x2="42.5"
                y2="30"
                stroke="#2B2B2B"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ opacity: 0 }}
              />
              <line
                ref={eyeRClosedRef}
                x1="49.5"
                y1="30"
                x2="54.5"
                y2="30"
                stroke="#2B2B2B"
                strokeWidth="2"
                strokeLinecap="round"
                style={{ opacity: 0 }}
              />

              {/* Cute little pink nose */}
              <polygon points="45,34 47,34 46,35.5" fill="#FCA5A5" />

              {/* Whiskers */}
              <line x1="22" y1="34" x2="32" y2="35" stroke="#2B2B2B" strokeWidth="1" opacity="0.4" />
              <line x1="20" y1="38" x2="32" y2="37" stroke="#2B2B2B" strokeWidth="1" opacity="0.4" />

              <line x1="60" y1="35" x2="70" y2="34" stroke="#2B2B2B" strokeWidth="1" opacity="0.4" />
              <line x1="60" y1="37" x2="72" y2="38" stroke="#2B2B2B" strokeWidth="1" opacity="0.4" />

              {/* Mouth */}
              <path d="M 44.5,37 Q 45.2,38.2 46,37 Q 46.8,38.2 47.5,37" fill="none" stroke="#2B2B2B" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        {/* Playful Yarn Ball Decoration */}
        <div className="relative w-12 h-12 flex items-end justify-center mb-1 overflow-visible">
          <svg
            viewBox="0 0 50 50"
            width="44"
            height="44"
            className="overflow-visible animate-[bounce_3s_infinite_ease-in-out]"
          >
            {/* Yarn shadows */}
            <circle cx="25" cy="27" r="16" fill="rgba(0,0,0,0.06)" />

            {/* Loop thread on the floor */}
            <path
              d="M 8,43 Q -4,40 5,30 Q 15,20 18,34 Q 20,40 30,35"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.9"
            />

            {/* The Yarn Sphere */}
            <circle cx="25" cy="25" r="15" fill="#F59E0B" />

            {/* Winding details / thread textures */}
            <path d="M 14,18 C 18,12 32,12 36,18" fill="none" stroke="#E08300" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 12,25 C 16,33 34,33 38,25" fill="none" stroke="#E08300" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 25,10 C 17,16 17,34 25,40" fill="none" stroke="#E08300" strokeWidth="2.2" strokeLinecap="round" />
            <path d="M 25,10 C 33,16 33,34 25,40" fill="none" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.4" />
            <path d="M 18,14 Q 30,25 32,36" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />

            {/* Cute mini bow tie or tag on the thread */}
            <path d="M 6,31 L 2,27 L 3,35 Z" fill="#FCA5A5" />
            <path d="M 6,31 L 10,27 L 9,35 Z" fill="#FCA5A5" />
            <circle cx="6" cy="31" r="1.5" fill="#FFFFFF" />
          </svg>
        </div>
      </div>
    </div>
  );
}
