"""Tạo build/icon.png, icon-small.png và icon.ico từ build/source-icon.webp (ảnh chữ S do người dùng cung cấp).
Chạy: python3 build/make_icon.py   (cần Pillow). Cắt nền ngoài, bo góc sạch, ghép .ico (cỡ nhỏ dùng bản phóng to)."""
from PIL import Image, ImageDraw
import struct, io
src = Image.open('build/source-icon.webp').convert('RGB')
box = (94, 94, 1161, 1143); rad = 296; ss = 4
m = Image.new('L', (1254 * ss,) * 2, 0); ImageDraw.Draw(m).rounded_rectangle([v * ss for v in box], rad * ss, fill=255)
rgba = src.convert('RGBA'); rgba.putalpha(m.resize((1254, 1254), Image.LANCZOS))
cx, cy = (box[0] + box[2]) // 2, (box[1] + box[3]) // 2; side = max(box[2] - box[0], box[3] - box[1]) + 20
full = rgba.crop((cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)).resize((1024, 1024), Image.LANCZOS)
full.save('build/icon.png')
z = int(side * 0.80)
small = src.crop((cx - z // 2, cy - z // 2, cx - z // 2 + z, cy - z // 2 + z)).resize((1024, 1024), Image.LANCZOS).convert('RGBA')
m2 = Image.new('L', (1024 * ss,) * 2, 0); ImageDraw.Draw(m2).rounded_rectangle((20 * ss, 20 * ss, 1004 * ss, 1004 * ss), 235 * ss, fill=255)
small.putalpha(m2.resize((1024, 1024), Image.LANCZOS)); small.save('build/icon-small.png')
entries = []
for sz in (256, 128, 64, 48, 32, 24, 16):
    im = (full if sz >= 64 else small).resize((sz, sz), Image.LANCZOS); b = io.BytesIO(); im.save(b, 'PNG'); entries.append((sz, b.getvalue()))
hdr = struct.pack('<HHH', 0, 1, len(entries)); off = 6 + 16 * len(entries); dirs = b''; data = b''
for sz, png in entries:
    dirs += struct.pack('<BBBBHHII', sz % 256, sz % 256, 0, 0, 1, 32, len(png), off + len(data)); data += png
open('build/icon.ico', 'wb').write(hdr + dirs + data)
