# Content Creation Studio

A free recording studio for talking-head reels that runs in the browser. It's a static site with no backend, no API keys and no paid services.

- Live camera with beauty filters on WebGL2: skin smoothing, shine control, under-eye, brightness, warmth, contrast, glow
- Lips & Eyes: lip tint (nude, rose, berry, coral, red, or any color), gloss, fullness and liner. Eye whites, iris pop, lash and liner, eye enlarge and lift, brows, and eye-contact correction
- Sculpt: neck slimming, jaw and chin contour, auto-level for head tilt, and a "higher camera angle" perspective fix
- Background blur, a solid color or an image (MediaPipe selfie segmentation)
- A teleprompter that is never recorded
- Records with a 3-2-1 countdown and saves takes on the device (IndexedDB)
- Trim, audio cleanup (high-pass, noise gate, compressor) and MP4/WebM export
- "Enhance video" mode puts the same look on a video you upload

Face tracking uses Google MediaPipe Tasks Vision (Apache-2.0). It loads from jsDelivr, and the public models come from storage.googleapis.com. The font is Nunito (OFL), from Google Fonts.
