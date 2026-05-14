/**
 * Placeholder PWA icon generator. Renders a flat tile with a "W"
 * monogram via SVG and rasterizes through Sharp. Swap these PNGs
 * before shipping to users; they exist so the manifest, iOS install,
 * and Lighthouse PWA audits stop complaining during M1.
 */

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const BG = "#18181b"; // zinc-900
const FG = "#fafafa"; // zinc-50

function tileSvg(size: number, opts: { maskable?: boolean } = {}) {
  const safeRatio = opts.maskable ? 0.6 : 0.78;
  const fontSize = Math.round(size * safeRatio);
  const offsetY = Math.round(size * 0.5 + fontSize * 0.36);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="${BG}"/>
      <text
        x="50%"
        y="${offsetY}"
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-weight="900"
        font-size="${fontSize}"
        fill="${FG}">W</text>
    </svg>
  `;
}

async function writePng(filename: string, size: number, maskable = false) {
  const buf = await sharp(Buffer.from(tileSvg(size, { maskable })))
    .png()
    .toBuffer();
  await writeFile(join(PUBLIC_DIR, filename), buf);
  console.log(`wrote ${filename} (${size}x${size}${maskable ? ", maskable" : ""})`);
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  await writePng("icon-192.png", 192);
  await writePng("icon-512.png", 512);
  await writePng("icon-512-maskable.png", 512, true);
  await writePng("apple-touch-icon.png", 180);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
