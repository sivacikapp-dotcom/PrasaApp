import { copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const src = join('node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const dest = join('public', 'ffmpeg');

mkdirSync(dest, { recursive: true });
copyFileSync(join(src, 'ffmpeg-core.js'), join(dest, 'ffmpeg-core.js'));
copyFileSync(join(src, 'ffmpeg-core.wasm'), join(dest, 'ffmpeg-core.wasm'));

console.log('✓ FFmpeg core copied to public/ffmpeg/');
