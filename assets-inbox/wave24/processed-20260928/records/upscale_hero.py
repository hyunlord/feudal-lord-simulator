# Steam library hero, AI upscale (wave24 processed-20260928). Input: Astra's selected generation source
# hero-native-v4.png (2152x731, sha256 86623bbb...). Real-ESRGAN x2plus (official v0.2.1 weights, sha256 49fafd45...)
# via spandrel on the GPU -> 4304x1462, then the same framing as Astra's delivered file: resize cover-center with
# Lanczos to 3840x1240 (scale 0.89219 -> 3840x1304, trim 32 px top and bottom).
import hashlib, json, sys, time
import numpy as np, torch, spandrel
from PIL import Image

src, weights, out_x2, out_final = sys.argv[1:5]
assert hashlib.sha256(open(src, 'rb').read()).hexdigest().startswith('86623bbb050f14db'), 'unexpected source'
assert hashlib.sha256(open(weights, 'rb').read()).hexdigest() == '49fafd45f8fd7aa8d31ab2a22d14d91b536c34494a5cfe31eb5d89c2fa266abb'
image = Image.open(src).convert('RGB'); w, h = image.size
arr = np.asarray(image).astype(np.float32) / 255.0
pad_h = (-h) % 4; pad_w = (-w) % 4                     # the model wants multiples of 4: reflect-pad, crop after
arr = np.pad(arr, ((0, pad_h), (0, pad_w), (0, 0)), mode='reflect')
model = spandrel.ModelLoader().load_from_file(weights).eval().cuda()
t0 = time.time()
with torch.inference_mode():
    x = torch.from_numpy(arr).permute(2, 0, 1).unsqueeze(0).cuda()
    y = model(x).clamp(0, 1)[0].permute(1, 2, 0).float().cpu().numpy()
seconds = time.time() - t0
y = y[: h * 2, : w * 2]
x2 = Image.fromarray((y * 255.0 + 0.5).astype(np.uint8), 'RGB'); x2.save(out_x2, optimize=True)
scale = max(3840 / x2.width, 1240 / x2.height)
resized = x2.resize((round(x2.width * scale), round(x2.height * scale)), Image.Resampling.LANCZOS)
top = (resized.height - 1240) // 2; left = (resized.width - 3840) // 2
final = resized.crop((left, top, left + 3840, top + 1240)); final.save(out_final, optimize=True)
print(json.dumps({'source': [w, h], 'pad': [pad_w, pad_h], 'x2': list(x2.size), 'scale': scale, 'resized': list(resized.size),
  'crop_top': top, 'final': list(final.size), 'gpu_seconds': round(seconds, 2), 'torch': torch.__version__, 'spandrel': spandrel.__version__,
  'sha256_x2': hashlib.sha256(open(out_x2, 'rb').read()).hexdigest(), 'sha256_final': hashlib.sha256(open(out_final, 'rb').read()).hexdigest()}))
