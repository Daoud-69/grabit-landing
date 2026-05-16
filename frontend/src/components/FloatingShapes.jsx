import React, { useEffect, useState } from "react";
import {
  YouTubeIcon,
  TikTokIcon,
  InstagramIcon,
  FacebookIcon,
  XIcon,
  DownloadIcon,
} from "@/components/PlatformIcons";

/**
 * Floating, parallax SVG shapes layer.
 * - Fixed position covers viewport, sits behind content (z-index 0)
 * - Each shape has its own float animation (CSS keyframes)
 * - Listens for `grabit:pulse-shape` custom events to flash a specific shape
 */
const SHAPES = [
  {
    key: "youtube",
    cls: "shape-yt",
    size: 170,
    style: { top: "8%", left: "4%", opacity: 0.12 },
    Component: YouTubeIcon,
  },
  {
    key: "tiktok",
    cls: "shape-tt",
    size: 90,
    style: { top: "10%", right: "8%", opacity: 0.13 },
    Component: TikTokIcon,
  },
  {
    key: "instagram",
    cls: "shape-ig",
    size: 60,
    style: { top: "72%", left: "6%", opacity: 0.11 },
    Component: InstagramIcon,
  },
  {
    key: "facebook",
    cls: "shape-fb",
    size: 140,
    style: { top: "44%", right: "3%", opacity: 0.10 },
    Component: FacebookIcon,
  },
  {
    key: "x",
    cls: "shape-x",
    size: 80,
    style: { top: "52%", right: "16%", opacity: 0.09 },
    Component: XIcon,
  },
  {
    key: "download",
    cls: "shape-dl",
    size: 110,
    style: { top: "78%", left: "58%", opacity: 0.14 },
    Component: DownloadIcon,
  },
  // Extras placed deeper in the page for full-scroll texture
  {
    key: "youtube-2",
    cls: "shape-yt",
    size: 70,
    style: { top: "160%", right: "12%", opacity: 0.08 },
    Component: YouTubeIcon,
  },
  {
    key: "tiktok-2",
    cls: "shape-tt",
    size: 55,
    style: { top: "210%", left: "9%", opacity: 0.07 },
    Component: TikTokIcon,
  },
  {
    key: "facebook-2",
    cls: "shape-fb",
    size: 80,
    style: { top: "280%", left: "40%", opacity: 0.06 },
    Component: FacebookIcon,
  },
  {
    key: "x-2",
    cls: "shape-x",
    size: 50,
    style: { top: "330%", right: "8%", opacity: 0.06 },
    Component: XIcon,
  },
];

export default function FloatingShapes() {
  const [scrollY, setScrollY] = useState(0);
  const [pulseKey, setPulseKey] = useState(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        raf = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onPulse = (e) => {
      const platform = e.detail?.platform;
      if (!platform) return;
      setPulseKey({ platform, ts: Date.now() });
      // clear after animation
      setTimeout(() => setPulseKey(null), 950);
    };
    window.addEventListener("grabit:pulse-shape", onPulse);
    return () => window.removeEventListener("grabit:pulse-shape", onPulse);
  }, []);

  return (
    <div
      data-testid="floating-shapes-layer"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        transform: `translate3d(0, ${-scrollY * 0.3}px, 0)`,
        willChange: "transform",
      }}
    >
      {SHAPES.map((s) => {
        const isPulsing =
          pulseKey &&
          (s.key === pulseKey.platform || s.key.startsWith(pulseKey.platform + "-"));
        return (
          <div
            key={s.key}
            className={`shape ${s.cls} ${isPulsing ? "shape-pulse-once" : ""}`}
            style={{
              ...s.style,
              filter: `drop-shadow(0 0 10px currentColor)`,
              pointerEvents: "auto",
            }}
            data-testid={`floating-shape-${s.key}`}
          >
            <s.Component size={s.size} strokeWidth={1.2} />
          </div>
        );
      })}
    </div>
  );
}
