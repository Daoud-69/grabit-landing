// Platform brand icon SVG paths (outline / monochrome). currentColor lets us tint.
import React from "react";

export const YouTubeIcon = ({ size = 28, strokeWidth = 1.4, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    className={className}
    aria-hidden="true"
  >
    <rect x="2" y="2" width="60" height="44" rx="10" />
    <path d="M26 16 L44 24 L26 32 Z" />
  </svg>
);

export const TikTokIcon = ({ size = 28, strokeWidth = 1.4, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    className={className}
    aria-hidden="true"
  >
    <path d="M30 6v22a8 8 0 1 1-8-8" />
    <path d="M30 6c1 4 4 8 10 8" />
  </svg>
);

export const InstagramIcon = ({ size = 28, strokeWidth = 1.4, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    className={className}
    aria-hidden="true"
  >
    <rect x="6" y="6" width="36" height="36" rx="10" />
    <circle cx="24" cy="24" r="9" />
    <circle cx="35" cy="13" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const FacebookIcon = ({ size = 28, strokeWidth = 1.4, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    className={className}
    aria-hidden="true"
  >
    <rect x="6" y="6" width="36" height="36" rx="10" />
    <path d="M28 16h-3a3 3 0 0 0-3 3v5h-4m0 0h4m-4 0v14m4-14h4l1-4h-5" />
  </svg>
);

export const XIcon = ({ size = 28, strokeWidth = 1.4, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="square"
    className={className}
    aria-hidden="true"
  >
    <path d="M8 8 L40 40 M40 8 L8 40" />
  </svg>
);

export const DownloadIcon = ({ size = 28, strokeWidth = 1.4, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="square"
    strokeLinejoin="miter"
    className={className}
    aria-hidden="true"
  >
    <path d="M24 6v26" />
    <path d="M14 22 L24 32 L34 22" />
    <path d="M8 42 H40" />
  </svg>
);

export const PLATFORM_META = {
  youtube: { color: "#FF0033", label: "YouTube", Icon: YouTubeIcon },
  tiktok: { color: "#00F2EA", label: "TikTok", Icon: TikTokIcon },
  instagram: { color: "#E1306C", label: "Instagram", Icon: InstagramIcon },
  facebook: { color: "#1877F2", label: "Facebook", Icon: FacebookIcon },
  x: { color: "#FFFFFF", label: "X", Icon: XIcon },
};
