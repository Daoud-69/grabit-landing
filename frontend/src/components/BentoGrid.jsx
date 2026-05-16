import React from "react";
import { PLATFORM_META } from "@/components/PlatformIcons";

const CELLS = [
  {
    key: "youtube",
    wide: true,
    note: "MP4 up to 4K · MP3 extract · No watermark",
  },
  { key: "tiktok", wide: false, note: "Watermark-free MP4 · Original audio" },
  { key: "instagram", wide: false, note: "Reels · Posts · Stories" },
  { key: "facebook", wide: false, note: "Public videos · HD" },
  { key: "x", wide: false, note: "Posts & video threads" },
];

export default function BentoGrid() {
  return (
    <section
      data-testid="bento-section"
      className="relative z-10 mx-auto"
      style={{ maxWidth: 1180, padding: "120px 24px" }}
    >
      <div className="reveal" data-reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/40 mb-3">
          Five platforms. One bar.
        </p>
        <h2 className="text-[32px] sm:text-[40px] leading-[1.05] font-extrabold tracking-tight text-white max-w-2xl">
          Every link.
          <br />
          Every format.
        </h2>
      </div>

      <div
        className="mt-12 grid gap-px rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.06)",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridAutoRows: "minmax(220px, auto)",
        }}
      >
        {CELLS.map((cell, i) => {
          const meta = PLATFORM_META[cell.key];
          const Icon = meta.Icon;
          return (
            <div
              key={cell.key}
              data-testid={`bento-cell-${cell.key}`}
              className="bento-cell glass reveal"
              data-reveal
              style={{
                gridColumn: cell.wide ? "span 2 / span 2" : "span 1 / span 1",
                padding: "32px",
                minHeight: 220,
                transitionDelay: `${i * 80}ms`,
                "--brand": meta.color,
              }}
            >
              <div
                className="flood"
                style={{ background: meta.color }}
              />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div
                  className="logo-mono"
                  style={{ "--brand": meta.color }}
                >
                  <Icon size={cell.wide ? 56 : 40} strokeWidth={1.3} />
                </div>
                <div>
                  <div className="font-stamp text-white text-[22px] tracking-tight">
                    {meta.label}
                  </div>
                  <p className="font-mono text-[12px] text-white/50 mt-2 max-w-xs">
                    {cell.note}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
