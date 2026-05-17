import React from "react";
import { Link as LinkIcon, X } from "lucide-react";
import { PLATFORM_META } from "@/components/PlatformIcons";

/**
 * Premium glassmorphic URL input.
 * Props:
 *  - value, onChange, onPaste
 *  - platform: detected platform key ("youtube" | "tiktok" | ...) or null
 *  - loading: bool
 */
export default function UrlInput({
  value,
  onChange,
  onPaste,
  onSubmit,
  platform,
  loading,
}) {
  const meta = platform && PLATFORM_META[platform];
  const Icon = meta?.Icon;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className="relative w-full"
      data-testid="url-input-form"
    >
      <div
        className="absolute left-5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center"
        style={{ width: 24, height: 24 }}
      >
        {Icon ? (
          <span
            key={platform}
            className="platform-icon-pop"
            style={{ color: meta.color, display: "inline-flex" }}
            data-testid={`platform-icon-${platform}`}
          >
            <Icon size={22} strokeWidth={1.6} />
          </span>
        ) : (
          <LinkIcon
            size={18}
            strokeWidth={1.6}
            color="rgba(255,255,255,0.35)"
            data-testid="platform-icon-generic"
          />
        )}
      </div>

      <input
        type="url"
        inputMode="url"
        autoComplete="off"
        spellCheck="false"
        className="url-input"
        data-platform={platform || ""}
        data-testid="url-input"
        placeholder="https://..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => onPaste?.(e)}
      />

      <div
        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2"
        style={{ height: 40 }}
      >
        {value && !loading && (
          <button
            type="button"
            onClick={() => onChange("")}
            data-testid="url-clear-btn"
            aria-label="Clear link"
            title="Clear"
            style={{
              height: 30,
              width: 30,
              borderRadius: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.14)",
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 180ms ease, color 180ms ease",
            }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !value}
          data-testid="url-submit-btn"
          className="font-mono"
          style={{
            height: 40,
            padding: "0 18px",
            borderRadius: 9999,
            background: meta ? meta.color : "rgba(255,255,255,0.08)",
            color: meta ? (platform === "x" ? "#000" : "#fff") : "#fff",
            border: "1px solid rgba(255,255,255,0.14)",
            fontSize: 12,
            letterSpacing: "0.04em",
            cursor: value ? "pointer" : "not-allowed",
            opacity: value ? 1 : 0.55,
            transition: "background 220ms ease, transform 220ms ease",
          }}
        >
          {loading ? "FETCHING…" : "GRAB"}
        </button>
      </div>
    </form>
  );
}
