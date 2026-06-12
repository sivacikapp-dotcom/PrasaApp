import sharp from "sharp";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="88" fill="#2A1C0A"/>
  <rect x="244" y="108" width="24" height="296" rx="6" fill="#58401C"/>
  <path d="M244 128 C198 128 138 145 104 172 L104 370 C138 343 198 326 244 326 Z" fill="#D4A843"/>
  <path d="M268 128 C314 128 374 145 408 172 L408 370 C374 343 314 326 268 326 Z" fill="#E0B84A"/>
  <rect x="284" y="198" width="104" height="10" rx="5" fill="#1A1005" opacity="0.45"/>
  <rect x="284" y="228" width="104" height="10" rx="5" fill="#1A1005" opacity="0.45"/>
  <rect x="284" y="258" width="88" height="10" rx="5" fill="#1A1005" opacity="0.45"/>
  <rect x="284" y="288" width="96" height="10" rx="5" fill="#1A1005" opacity="0.45"/>
</svg>`;

const svgBuffer = Buffer.from(svg);

async function generate() {
  await sharp(svgBuffer).resize(192, 192).png().toFile(join(publicDir, "icon-192.png"));
  console.log("✓ icon-192.png");

  await sharp(svgBuffer).resize(512, 512).png().toFile(join(publicDir, "icon-512.png"));
  console.log("✓ icon-512.png");

  await sharp(svgBuffer).resize(180, 180).png().toFile(join(publicDir, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png");
}

generate().catch(console.error);
