import React from "react";

const STEPS = [
  {
    n: "01",
    label: "Paste Link",
    desc: "Drop any supported URL into the bar.",
  },
  {
    n: "02",
    label: "Preview Loads",
    desc: "Title, thumbnail, platform — instant.",
  },
  {
    n: "03",
    label: "Download or Extract",
    desc: "MP4 in any quality, or audio as MP3.",
  },
];

export default function HowItWorks() {
  return (
    <section
      data-testid="how-it-works-section"
      className="relative z-10 mx-auto"
      style={{ maxWidth: 1180, padding: "120px 24px" }}
    >
      <div className="reveal" data-reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/40 mb-3">
          How it works
        </p>
        <h2 className="text-[32px] sm:text-[40px] leading-[1.05] font-extrabold tracking-tight text-white max-w-2xl">
          Three steps.
          <br />
          One bar between you and the file.
        </h2>
      </div>

      <div className="mt-16 grid gap-12 md:grid-cols-3 relative">
        {/* Dashed connectors (md+) */}
        <svg
          aria-hidden="true"
          className="hidden md:block absolute left-0 right-0 pointer-events-none"
          style={{ top: 36, height: 2, width: "100%" }}
        >
          <line
            x1="14%"
            x2="42%"
            y1="1"
            y2="1"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            className="dash-line"
          />
          <line
            x1="58%"
            x2="86%"
            y1="1"
            y2="1"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
            className="dash-line"
          />
        </svg>

        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="reveal relative"
            data-reveal
            data-testid={`step-${s.n}`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <div
              className="font-mono leading-none"
              style={{
                fontSize: 80,
                fontWeight: 300,
                color: "rgba(255,255,255,0.10)",
                letterSpacing: "-0.04em",
              }}
            >
              {s.n}
            </div>
            <div className="mt-3 text-[20px] font-bold tracking-tight text-white">
              {s.label}
            </div>
            <p className="mt-2 text-[14px] text-white/55 max-w-[260px]">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
