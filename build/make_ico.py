"""Ghép build/icon.ico từ icon.png (bản đầy đủ) và icon-small.png (bản đơn giản cho cỡ nhỏ).
Quy trình:  node build/render-svg.js build/icon.svg build/icon.png 1024
            node build/render-svg.js build/icon-small.svg build/icon-small.png 1024
            python3 build/make_ico.py"""
import struct, io
from PIL import Image
full = Image.open('build/icon.png').convert('RGBA'); small = Image.open('build/icon-small.png').convert('RGBA')
entries = []
for sz in (256, 128, 64, 48, 32, 24, 16):
    im = (full if sz >= 64 else small).resize((sz, sz), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'PNG'); entries.append((sz, b.getvalue()))
hdr = struct.pack('<HHH', 0, 1, len(entries)); off = 6 + 16 * len(entries); dirs = b''; data = b''
for sz, png in entries:
    dirs += struct.pack('<BBBBHHII', sz % 256, sz % 256, 0, 0, 1, 32, len(png), off + len(data)); data += png
open('build/icon.ico', 'wb').write(hdr + dirs + data)
