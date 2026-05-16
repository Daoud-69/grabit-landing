import React, { useEffect, useState } from "react";
import UrlInput from "@/components/UrlInput";

const PLATFORM_DETECT = [
  { key: "youtube", re: /(?:youtube\.com|youtu\.be)/i },
  { key: "tiktok", re: /tiktok\.com/i },
  { key: "instagram", re: /instagram\.com/i },
  { key: "facebook", re: /(?:facebook\.com|fb\.watch)/i },
  { key: "x", re: /(?:twitter\.com|x\.com)/i },
];

function detectPlatform(url) {
  if (!url) return null;
  for (const p of PLATFORM_DETECT) if (p.re.test(url)) return p.key;
  return null;
}

const HERO_WORD = "GRABIT";

export default function Hero({
  url,
  setUrl,
  onSubmit,
  loading,
  scrollY = 0,
}) {
  const platform = detectPlatform(url);
  const [letters, setLetters] = useState([]);

  useEffect(() => {
    // staggered letter draw-in
    setLetters(HERO_WORD.split(""));
  }, []);

  // Pulse the matching floating shape when a platform is first detected
  useEffect(() => {
    if (!platform) return;
    window.dispatchEvent(
      new CustomEvent("grabit:pulse-shape", { detail: { platform } })
    );
  }, [platform]);

  // Hero wordmark parallax scale 1.0 -> 0.92
  const heroScale = Math.max(0.92, 1 - scrollY / 8000);
  const heroOpacity = Math.max(0, 1 - scrollY / 700);

  return (
    <section
      data-testid="hero-section"
      className="relative w-full"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Breathing radial glow behind wordmark */}
      <div className="hero-glow" />

      <div
        className="relative z-10 w-full text-center px-6"
        style={{ transform: `scale(${heroScale})`, opacity: heroOpacity, transition: "opacity 120ms linear" }}
      >
        {/* Tiny top eyebrow */}
        <div className="font-mono text-[11px] uppercase tracking-[0.42em] text-white/35 mb-10">
          v1.0 · premium media downloader
        </div>

        {/* Stencil wordmark */}
        <h1
          className="font-stamp stencil select-none"
          data-testid="hero-wordmark"
          style={{
            fontSize: "clamp(72px, 14vw, 180px)",
            lineHeight: 0.9,
            letterSpacing: "-0.04em",
            margin: 0,
          }}
        >
          {letters.map((ch, i) => (
            <span
              key={i}
              className="hero-letter"
              style={{ animationDelay: `${120 + i * 90}ms` }}
            >
              {ch}
            </span>
          ))}
        </h1>

        <p
          className="mt-8 text-white/65"
          style={{
            fontSize: 18,
            fontWeight: 300,
            letterSpacing: "0.005em",
            animationDelay: "1.2s",
          }}
          data-testid="hero-tagline"
        >
          <span className="fade-in-up" style={{ animationDelay: "1.1s" }}>
            Paste a link.{" "}
            <span className="text-white">Take the content.</span>
          </span>
        </p>

        {/* URL input */}
        <div
          className="mx-auto mt-10 fade-in-up"
          style={{ maxWidth: 620, animationDelay: "1.4s" }}
        >
          <UrlInput
            value={url}
            onChange={setUrl}
            onPaste={() => {}}
            onSubmit={onSubmit}
            platform={platform}
            loading={loading}
          />
          <p
            className="font-mono text-[11px] text-white/30 mt-4 tracking-wider"
            data-testid="hero-supported"
          >
            youtube · tiktok · instagram · facebook · x
          </p>
        </div>
      </div>

      {/* Subtle scroll cue */}
      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-white/25"
        data-testid="scroll-cue"
      >
        SCROLL ↓
      </div>
    </section>
  );
}
