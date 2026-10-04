// Generates OrchardCare app icons (icon, adaptive foreground, monochrome) as PNGs via sharp+SVG.
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', 'backend', 'node_modules', 'sharp'));

const outDir = path.join(__dirname, '..', 'mobile', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const APPLE = `M512 400 C448 330 322 336 276 446 C232 556 306 742 416 786 C458 803 480 788 512 788 C544 788 566 803 608 786 C718 742 792 556 748 446 C702 336 576 330 512 400 Z`;
const STEM = `M512 400 C508 350 522 318 552 290`;
const LEAF = `M552 300 C600 248 682 238 714 250 C702 316 630 346 556 318 Z`;

function defs() {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2e7d4f"/><stop offset="1" stop-color="#123d27"/>
    </linearGradient>
    <radialGradient id="apple" cx="0.38" cy="0.32" r="0.95">
      <stop offset="0" stop-color="#ef6a56"/><stop offset="0.55" stop-color="#d94436"/><stop offset="1" stop-color="#9c2a1e"/>
    </radialGradient>
    <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8fc573"/><stop offset="1" stop-color="#2e7d4f"/>
    </linearGradient>
  </defs>`;
}

/** Full app icon: green squircle + dashed 360 ring + apple. */
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${defs()}
  <rect width="1024" height="1024" rx="232" fill="url(#bg)"/>
  <g transform="translate(512 512) scale(0.78) translate(-512 -512)">
    <circle cx="512" cy="520" r="420" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="16" stroke-dasharray="44 30" stroke-linecap="round"/>
    <circle cx="512" cy="520" r="420" fill="none" stroke="#ffffff" stroke-opacity="0.95" stroke-width="16" stroke-dasharray="90 620" stroke-dashoffset="-160" stroke-linecap="round"/>
    <path d="${APPLE}" fill="url(#apple)"/>
    <path d="${STEM}" fill="none" stroke="#7a4a21" stroke-width="22" stroke-linecap="round"/>
    <path d="${LEAF}" fill="url(#leaf)"/>
    <ellipse cx="398" cy="540" rx="50" ry="78" fill="#ffffff" opacity="0.16" transform="rotate(-18 398 540)"/>
  </g>
</svg>`;

/** Adaptive foreground: transparent bg, artwork inside the safe zone. */
const adaptiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${defs()}
  <g transform="translate(512 512) scale(0.58) translate(-512 -512)">
    <circle cx="512" cy="520" r="420" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="18" stroke-dasharray="44 30" stroke-linecap="round"/>
    <path d="${APPLE}" fill="url(#apple)"/>
    <path d="${STEM}" fill="none" stroke="#7a4a21" stroke-width="22" stroke-linecap="round"/>
    <path d="${LEAF}" fill="url(#leaf)"/>
    <ellipse cx="398" cy="540" rx="50" ry="78" fill="#ffffff" opacity="0.16" transform="rotate(-18 398 540)"/>
  </g>
</svg>`;

/** Monochrome (Android 13 themed icons): white silhouette only. */
const monoSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(0.58) translate(-512 -512)">
    <path d="${APPLE}" fill="#ffffff"/>
    <path d="${STEM}" fill="none" stroke="#ffffff" stroke-width="22" stroke-linecap="round"/>
    <path d="${LEAF}" fill="#ffffff"/>
  </g>
</svg>`;

(async () => {
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(outDir, 'icon.png'));
  await sharp(Buffer.from(adaptiveSvg)).png().toFile(path.join(outDir, 'adaptive-icon.png'));
  await sharp(Buffer.from(monoSvg)).png().toFile(path.join(outDir, 'adaptive-icon-mono.png'));
  console.log('ICONS_GENERATED');
})();
