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

const FORMATS = [
  { id: "mp4-h264", label: "MP4 · H.264", sub: "iPhone safe", icon: Film,   isVideo: true  },
  { id: "mp4",      label: "MP4 · Best",  sub: "highest quality", icon: Film,   isVideo: true  },
  { id: "mp3",      label: "MP3",         sub: "audio",       icon: Music2, isVideo: false },
  { id: "m4a",      label: "M4A",         sub: "audio · AAC", icon: Music2, isVideo: false },
];

function triggerDownload(originalUrl, type, quality, codec) {
  if (!originalUrl) return;
  const params = new URLSearchParams({
    url: originalUrl,
    type,
    quality: String(quality || ""),
    codec: codec || "auto",
  });
  const a = document.createElement("a");
  a.href = `${API}/download?${params.toString()}`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function PreviewCard({ data, loading, error }) {
  const [selectedFormat, setSelectedFormat] = useState("mp4-h264");
  const [qualityOpen, setQualityOpen]       = useState(false);
  const [note, setNote]                     = useState(null);

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
    return (
      <div className="glass rounded-2xl p-6 w-full" data-testid="preview-card-placeholder">
        <div className="flex gap-5 items-start">
          <div
            className="w-44 h-28 rounded-lg flex items-center justify-center font-mono text-xs text-white/30"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
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

  const meta   = PLATFORM_META[data.platform] || { color: "#ffffff", label: data.platform || "Link" };
  const accent = meta.color;

  const resolutions =
    Array.isArray(data.available_resolutions) && data.available_resolutions.length
      ? data.available_resolutions
      : [1080, 720, 480, 360];

  const originalUrl = data.original_url;
  const hasAudio    = data.has_audio !== false;
  const fmt         = FORMATS.find((f) => f.id === selectedFormat) || FORMATS[0];

  const onPickQuality = (height) => {
    setQualityOpen(false);
    const isH264 = selectedFormat === "mp4-h264";
    setNote(`Preparing ${fmt.label} · ${RES_LABELS[height] || height + "p"}…`);
    triggerDownload(originalUrl, "mp4", height, isH264 ? "h264" : "auto");
  };

  const onDownloadAudio = () => {
    if (!hasAudio) return;
    const type = selectedFormat; // "mp3" or "m4a"
    setNote(`Extracting ${fmt.label}…`);
    triggerDownload(originalUrl, type, "320", "auto");
  };

  const onFormatClick = (fmtId) => {
    setSelectedFormat(fmtId);
    setQualityOpen(false);
    const f = FORMATS.find((x) => x.id === fmtId);
    if (f && !f.isVideo) {
      // Trigger audio download immediately on selection
    }
  };

  return (
    <div
      className="glass spring-up rounded-2xl p-6 w-full relative"
      data-testid="preview-card"
      style={{ boxShadow: `0 24px 80px -24px ${accent}40, inset 0 1px 0 0 ${accent}30` }}
    >
      <div className="flex flex-col md:flex-row gap-5 md:items-start">
        {/* Thumbnail */}
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
            style={{ background: `${accent}1f`, color: accent, border: `1px solid ${accent}55` }}
            data-testid="preview-platform-badge"
          >
            {meta.label}
          </span>
        </div>

        {/* Info + controls */}
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
            {data.author || "unknown author"} · {data.duration || "—:—"}
          </div>
          <p className="text-[15px] font-semibold mt-1.5 text-white truncate" data-testid="preview-title">
            {data.title || "Untitled"}
          </p>

          {/* Format pills */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {FORMATS.map((f) => {
              const disabled = !f.isVideo && !hasAudio;
              const active   = selectedFormat === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={disabled}
                  data-testid={`format-pill-${f.id}`}
                  onClick={() => !disabled && onFormatClick(f.id)}
                  className="font-mono text-[11px] px-3 py-1 rounded-full transition-all"
                  style={{
                    background: active ? `${accent}28` : "rgba(255,255,255,0.06)",
                    color:      active ? accent          : "rgba(255,255,255,0.55)",
                    border:     active ? `1px solid ${accent}66` : "1px solid rgba(255,255,255,0.1)",
                    opacity:    disabled ? 0.35 : 1,
                    cursor:     disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-2.5 mt-3 relative">
            {fmt.isVideo ? (
              <div className="relative">
                <button
                  type="button"
                  className="btn-ghost"
                  data-testid="preview-download-mp4-btn"
                  onClick={() => setQualityOpen((v) => !v)}
                  style={{ borderColor: `${accent}66`, background: `${accent}12` }}
                >
                  <Film size={14} strokeWidth={1.6} />
                  Download {fmt.label}
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
            ) : (
              <button
                type="button"
                className="btn-ghost"
                data-testid="preview-extract-audio-btn"
                onClick={onDownloadAudio}
                disabled={!hasAudio}
                style={{ opacity: hasAudio ? 1 : 0.5, borderColor: `${accent}66`, background: `${accent}12` }}
              >
                <Music2 size={14} strokeWidth={1.6} />
                Download {fmt.label}
              </button>
            )}
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
