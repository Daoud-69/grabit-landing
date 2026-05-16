import React from "react";
import {
  ShieldOff,
  UserX,
  Activity,
  Settings2,
  Music2,
  BadgeX,
  Eye,
  Code2,
} from "lucide-react";

const FEATURES = [
  { Icon: ShieldOff, label: "No watermarks" },
  { Icon: UserX, label: "No sign-up" },
  { Icon: Activity, label: "Live progress bar" },
  { Icon: Settings2, label: "MP4 quality selector" },
  { Icon: Music2, label: "MP3 extraction" },
  { Icon: BadgeX, label: "Zero ads" },
  { Icon: Eye, label: "Instant preview" },
  { Icon: Code2, label: "Open source backend" },
];

export default function Features() {
  return (
    <section
      data-testid="features-section"
      className="relative z-10 mx-auto"
      style={{ maxWidth: 1180, padding: "120px 24px" }}
    >
      <div className="reveal" data-reveal>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/40 mb-3">
          The fine print
        </p>
        <h2 className="text-[32px] sm:text-[40px] leading-[1.05] font-extrabold tracking-tight text-white max-w-3xl">
          Built like a tool.
          <br />
          Priced like nothing.
        </h2>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        {FEATURES.map(({ Icon, label }, i) => (
          <div
            key={label}
            className="feature-pill reveal"
            data-reveal
            data-testid={`feature-${label.toLowerCase().replace(/\s+/g, "-")}`}
            style={{ transitionDelay: `${i * 50}ms` }}
          >
            <Icon size={15} strokeWidth={1.5} className="text-white/85" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
