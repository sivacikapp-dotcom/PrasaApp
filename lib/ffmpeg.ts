import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

let _ffmpeg: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

// Shared singleton — used by VideoEditor.tsx (trim) and BulkUploadReview.tsx
// (metadata extraction) so both features load/reuse the same wasm instance.
export function loadFFmpeg(): Promise<FFmpeg> {
  if (_ffmpeg?.loaded) return Promise.resolve(_ffmpeg);
  if (_loading) return _loading;
  _loading = (async () => {
    const ffmpeg = new FFmpeg();
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
      toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
    ]);
    await ffmpeg.load({ coreURL, wasmURL });
    _ffmpeg = ffmpeg;
    return ffmpeg;
  })().catch((e: unknown) => {
    _loading = null; // allow retry on failure
    throw e;
  });
  return _loading;
}
