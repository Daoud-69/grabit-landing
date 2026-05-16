import React from "react";

export default function Footer() {
  return (
    <footer
      data-testid="footer-section"
      className="relative z-10 mx-auto"
      style={{ maxWidth: 1180, padding: "80px 24px 64px" }}
    >
      <div className="hairline mb-12" />
      <div className="flex flex-col items-center text-center gap-3">
        <div
          className="font-mono text-[12px] uppercase tracking-[0.4em] text-white/85"
          data-testid="footer-wordmark"
        >
          GRABIT
        </div>
        <p className="font-mono text-[12px] text-white/40">
          Your content. Your rules.
        </p>
        <div className="flex items-center gap-6 mt-4 font-mono text-[12px]">
          <a
            href="#"
            className="text-white/45 hover:text-white transition-colors"
            data-testid="footer-link-github"
          >
            GitHub
          </a>
          <span className="text-white/15">·</span>
          <a
            href="#"
            className="text-white/45 hover:text-white transition-colors"
            data-testid="footer-link-privacy"
          >
            Privacy
          </a>
          <span className="text-white/15">·</span>
          <a
            href="#"
            className="text-white/45 hover:text-white transition-colors"
            data-testid="footer-link-status"
          >
            Status
          </a>
        </div>
      </div>
    </footer>
  );
}
