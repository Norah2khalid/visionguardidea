export type FrameKind = "tank" | "pipe" | "thermal" | "valve" | "corrosion" | "tower" | "pump";

export function inspectionFrame(input: {
  code: string;
  title: string;
  kind: FrameKind;
  stamp: string;
  heat: number;
  variant: "before" | "after" | "single";
}): string {
  const heat = Math.max(0, Math.min(100, input.heat));
  const hot = heat > 75 ? "#e23d3d" : heat > 55 ? "#e3a008" : "#3dbe7a";
  const shape = shapeFor(input.kind, hot, heat);
  const variant =
    input.variant === "before" ? "قبل" : input.variant === "after" ? "بعد" : "إطار";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
  <rect width="960" height="600" fill="#07111c"/>
  <g stroke="#163044" stroke-width="1">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="${i * 80}" y1="0" x2="${i * 80}" y2="600"/>`).join("")}
    ${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 75}" x2="960" y2="${i * 75}"/>`).join("")}
  </g>
  <rect x="28" y="24" width="220" height="28" fill="#102033" stroke="#2a4a63"/>
  <text x="40" y="43" fill="#8ec8e6" font-family="IBM Plex Sans Arabic, sans-serif" font-size="14">بيانات تصوير تجريبية</text>
  <text x="28" y="78" fill="#d7e4ee" font-family="IBM Plex Sans Arabic, sans-serif" font-size="22">${escapeXml(input.title)}</text>
  <text x="28" y="104" fill="#8ea3b5" font-family="IBM Plex Mono, monospace" font-size="14">${escapeXml(input.code)} · ${escapeXml(variant)}</text>
  ${shape}
  <circle cx="760" cy="180" r="70" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.8"/>
  <circle cx="760" cy="180" r="6" fill="#38bdf8"/>
  <path d="M760 96 V264 M676 180 H844" stroke="#38bdf8" stroke-width="1" opacity="0.7"/>
  <text x="28" y="560" fill="#9fb3c4" font-family="IBM Plex Mono, monospace" font-size="14">${escapeXml(input.stamp)}</text>
  <text x="760" y="560" fill="${hot}" font-family="IBM Plex Sans Arabic, sans-serif" font-size="14" text-anchor="middle">مؤشر حراري تجريبي ${heat}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function shapeFor(kind: FrameKind, hot: string, heat: number): string {
  if (kind === "tank") {
    return `<ellipse cx="430" cy="340" rx="150" ry="36" fill="#12283a" stroke="#7f9aaf"/>
      <rect x="280" y="210" width="300" height="140" fill="#102433" stroke="#8fb0c4"/>
      <ellipse cx="430" cy="210" rx="150" ry="36" fill="#183246" stroke="#8fb0c4"/>
      <rect x="300" y="250" width="${40 + heat}" height="16" fill="${hot}" opacity="0.85"/>`;
  }
  if (kind === "pipe") {
    return `<path d="M180 360 H420 L520 250 H780" fill="none" stroke="#8fb0c4" stroke-width="28"/>
      <path d="M180 360 H420 L520 250 H780" fill="none" stroke="${hot}" stroke-width="8" stroke-dasharray="18 10"/>
      <circle cx="420" cy="360" r="16" fill="#102433" stroke="#d7e4ee"/>`;
  }
  if (kind === "thermal") {
    return `<rect x="240" y="160" width="420" height="280" fill="#101820" stroke="#31485a"/>
      <circle cx="450" cy="300" r="${60 + heat / 2}" fill="${hot}" opacity="0.35"/>
      <circle cx="450" cy="300" r="40" fill="${hot}" opacity="0.8"/>
      <text x="450" y="306" text-anchor="middle" fill="#07111c" font-family="IBM Plex Mono, monospace" font-size="16">${heat}°C</text>`;
  }
  if (kind === "valve") {
    return `<rect x="390" y="180" width="80" height="220" fill="#163044" stroke="#9fb3c4"/>
      <circle cx="430" cy="180" r="46" fill="none" stroke="${hot}" stroke-width="10"/>
      <path d="M250 290 H390 M470 290 H700" stroke="#8fb0c4" stroke-width="18"/>`;
  }
  if (kind === "corrosion") {
    return `<rect x="250" y="170" width="380" height="260" fill="#1a242c" stroke="#6d7c88"/>
      <circle cx="360" cy="280" r="34" fill="#8a5a32" opacity="0.9"/>
      <circle cx="470" cy="320" r="22" fill="${hot}" opacity="0.75"/>
      <circle cx="520" cy="240" r="16" fill="#6e4b32"/>
      <path d="M280 390 C360 300 460 360 600 250" fill="none" stroke="${hot}" stroke-width="3"/>`;
  }
  if (kind === "tower") {
    return `<rect x="400" y="140" width="90" height="300" fill="#12283a" stroke="#9fb3c4"/>
      <polygon points="400,140 445,80 490,140" fill="#183246" stroke="#9fb3c4"/>
      <rect x="418" y="200" width="54" height="18" fill="${hot}"/>
      <rect x="300" y="430" width="300" height="16" fill="#0c1a26" stroke="#355066"/>`;
  }
  return `<rect x="300" y="240" width="220" height="120" rx="8" fill="#12283a" stroke="#9fb3c4"/>
    <circle cx="360" cy="300" r="34" fill="none" stroke="${hot}" stroke-width="8"/>
    <circle cx="460" cy="300" r="34" fill="none" stroke="#8fb0c4" stroke-width="8"/>
    <path d="M200 300 H300 M520 300 H740" stroke="#8fb0c4" stroke-width="14"/>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
