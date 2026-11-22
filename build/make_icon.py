"""Tạo icon cho Event Deck: python3 build/make_icon.py  (cần Pillow)"""
from PIL import Image, ImageDraw, ImageFilter
S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
# nền bo góc, chuyển màu dọc
bg = Image.new('RGBA', (S, S))
px = bg.load()
for y in range(S):
    t = y / S
    c = (int(30 + 14 * t), int(34 + 12 * t), int(52 + 18 * t), 255)
    for x in range(S): px[x, y] = c
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle((40, 40, S - 40, S - 40), 210, fill=255)
img.paste(bg, (0, 0), mask)
d = ImageDraw.Draw(img)
# 2 rãnh fader + núm (2 kênh) và đường sóng âm
cols = [(79, 157, 255), (62, 207, 142)]
for i, (x, col) in enumerate(zip((340, 684), cols)):
    d.rounded_rectangle((x - 22, 220, x + 22, 800), 22, fill=(58, 65, 84, 255))
    top = 360 if i == 0 else 500
    d.rounded_rectangle((x - 22, top, x + 22, 800), 22, fill=col + (255,))
    # núm fader
    d.rounded_rectangle((x - 105, top - 55, x + 105, top + 55), 34, fill=(240, 243, 250, 255))
    d.rounded_rectangle((x - 70, top - 8, x + 70, top + 8), 8, fill=col + (255,))
# bóng nhẹ cho nổi
glow = img.filter(ImageFilter.GaussianBlur(1.2))
img = Image.alpha_composite(glow, img)
img.save('build/icon.png')
img.resize((256, 256), Image.LANCZOS).save('build/icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
