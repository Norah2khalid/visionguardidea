export function simulatedEvidenceSvg(caption: string): string {
  const safe = caption.replace(/[<>&]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <rect width="960" height="540" fill="#081018"/>
    <g opacity="0.35" stroke="#1d3a46" fill="none">
      ${Array.from({ length: 12 }, (_, i) => `<path d="M0 ${40 + i * 42} H960"/>`).join("")}
    </g>
    <circle cx="430" cy="280" r="92" fill="#102029" stroke="#e4b15a" stroke-width="6"/>
    <rect x="392" y="168" width="76" height="28" fill="#163042" stroke="#3ddec8"/>
    <path d="M120 390 H820" stroke="#8ea0b3" stroke-width="8"/>
    <circle cx="250" cy="390" r="14" fill="#3ddec8"/>
    <text x="36" y="48" fill="#3ddec8" font-size="22" font-family="sans-serif">وضع المحاكاة — البيانات تجريبية</text>
    <text x="36" y="84" fill="#e7eef4" font-size="18" font-family="sans-serif">${safe}</text>
    <text x="36" y="510" fill="#8ea0b3" font-size="14" font-family="sans-serif">عرض مولَّد داخل المنصة، وليس بثًا من كاميرا أو درون.</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
