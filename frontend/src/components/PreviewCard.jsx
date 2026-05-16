import React, { useEffect, useState } from "react";
import { ChevronDown, Music2, Film } from "lucide-react";
import { PLATFORM_META } from "@/components/PlatformIcons";

const API = `${process.env.REACT_APP_BACKEND_URL || ""}/api`;

const RES_LABELS = {
  2160: "2160p · 4K",
  1440: "1440p · 2K",
  1080: "1080p · HD",
  720: "720p",
  480: "480p",
  360: "360p",
};

// Kick off a download by navigating an offscreen anchor to the stream endpoint.
function triggerDownload(originalUrl, type, quality) {
  if (!originalUrl) return;
  const params = new URLSearchParams({
    url: originalUrl,
    type,
    quality: String(quality || ""),
  });
  const a = document.createElement("a");
  a.href = `${API}/download?${params.toString()}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function PreviewCard({ data, loading, error }) {
  const [qualityOpen, setQualityOpen] = useState(false);
  const [note, setNote] = useState(null);

  // Auto-clear the transient status note
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  if (loading) {
    return (
      <div className="glass spring-up rounded-2xl p-6 w-full" data-testid="preview-card-loading">
        <div className="flex gap-5 items-center">
          <div className="w-44 h-28 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-2/3 rounded" style={{ background: "rgba(255,255,255,0.08)" }} />
            <div className="h-3 w-1/3 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
            <div className="h-9 w-40 rounded-full mt-3" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>
        </div>
        <p className="font-mono text-[11px] mt-5 text-white/40">[fetching metadata…]</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 w-full" data-testid="preview-card-error">
        <p className="font-mono text-[13px] text-white/70">// error: {error}</p>
      </div>
    );
  }

  if (!data) {
    // Placeholder mock card so the section always feels alive
    return (
      <div className="glass rounded-2xl p-6 w-full" data-testid="preview-card-placeholder">
        <div className="flex gap-5 items-start">
          <div
            className="w-44 h-28 rounded-lg flex items-center justify-center font-mono text-xs text-white/30"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            preview
          </div>
          <div className="flex-1">
            <div className="font-mono text-[11px] uppercase tracking-widest text-white/40">
              awaiting link
            </div>
            <p className="text-[15px] font-semibold mt-1.5 text-white/85">
              Paste a link above to see a live preview here.
            </p>
            <p className="text-[12px] text-white/45 mt-1.5 font-mono">
              YouTube · TikTok · Instagram · Facebook · X
            </p>
          </div>
        </div>
      </div>
    );
  }

  const meta = PLATFORM_META[data.platform] || {
    color: "#ffffff",
    label: data.platform || "Link",
  };
  const accent = meta.color;

  const resolutions =
    Array.isArray(data.available_resolutions) && data.available_resolutions.length
      ? data.available_resolutions
      : [1080, 720, 480, 360];

  const originalUrl = data.original_url;
  const hasAudio = data.has_audio !== false;

  const onPickQuality = (height) => {
    setQualityOpen(false);
    setNote(`Preparing MP4 · ${RES_LABELS[height] || height + "p"}…`);
    triggerDownload(originalUrl, "mp4", height);
  };

  const onExtractMp3 = () => {
    if (!hasAudio) return;
    setNote("Extracting MP3 · 320 kbps…");
    triggerDownload(originalUrl, "mp3", "320");
  };

  return (
    <div
      className="glass spring-up rounded-2xl p-6 w-full relative"
      data-testid="preview-card"
      style={{
        boxShadow: `0 24px 80px -24px ${accent}40, inset 0 1px 0 0 ${accent}30`,
      }}
    >
      <div className="flex flex-col md:flex-row gap-5 md:items-start">
        <div
          className="relative md:w-52 w-full h-32 rounded-lg overflow-hidden flex-shrink-0"
          style={{ border: `1px solid ${accent}30` }}
        >
          {data.thumbnail ? (
            <img
              src={data.thumbnail}
              alt={data.title || "preview"}
              className="w-full h-full object-cover"
              data-testid="preview-thumbnail"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center font-mono text-xs text-white/40"
              style={{ background: "rgba(255,255,255,0.04)" }}
              data-testid="preview-thumb-placeholder"
            >
              [ no thumbnail ]
            </div>
          )}
          <span
            className="absolute top-2 left-2 font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              background: `${accent}1f`,
              color: accent,
              border: `1px solid ${accent}55`,
            }}
            data-testid="preview-platform-badge"
          >
            {meta.label}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            {data.author || "unknown author"} · {data.duration || "—:—"}
          </div>
          <p
            className="text-[15px] font-semibold mt-1.5 text-white truncate"
            data-testid="preview-title"
          >
            {data.title || "Untitled"}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-4 relative">
            <div className="relative">
              <button
                type="button"
                className="btn-ghost"
                data-testid="preview-download-mp4-btn"
                onClick={() => setQualityOpen((v) => !v)}
                style={{
                  borderColor: `${accent}66`,
                  background: `${accent}12`,
                }}
              >
                <Film size={14} strokeWidth={1.6} />
                Download MP4
                <ChevronDown size={13} strokeWidth={1.8} />
              </button>

              {qualityOpen && (
                <div
                  className="popover-card rounded-xl absolute left-0 top-full mt-2 p-1.5 z-30 w-44"
                  data-testid="quality-popover"
                >
                  {resolutions.map((height) => (
                    <button
                      key={height}
                      type="button"
                      onClick={() => onPickQuality(height)}
                      className="font-mono w-full text-left px-3 py-1.5 text-[12px] rounded-md hover:bg-white/10 transition-colors text-white/85"
                      data-testid={`quality-option-${height}`}
                    >
                      {RES_LABELS[height] || `${height}p`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="btn-ghost"
              data-testid="preview-extract-mp3-btn"
              onClick={onExtractMp3}
              disabled={!hasAudio}
              style={{ opacity: hasAudio ? 1 : 0.5 }}
            >
              <Music2 size={14} strokeWidth={1.6} />
              Extract MP3
            </button>
          </div>

          {note && (
            <p
              className="font-mono text-[11px] mt-3"
              style={{ color: accent }}
              data-testid="preview-download-note"
            >
              {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
