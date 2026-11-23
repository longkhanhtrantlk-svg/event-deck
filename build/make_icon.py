"""Tạo icon SoundLane: python3 build/make_icon.py  (cần Pillow)
4 làn sóng âm song song + nút Play, màu chuyển xanh ngọc -> tím."""
from PIL import Image, ImageDraw, ImageFilter, ImageChops

S = 1024
SS = 1  # vẽ trực tiếp ở 1024 rồi làm mịn viền

def rr(mask, box, r):
    ImageDraw.Draw(mask).rounded_rectangle(box, r, fill=255)

# ---- nền: ô vuông bo góc, chuyển màu xanh đêm + ánh tím ở góc dưới phải
bg = Image.new('RGBA', (S, S))
px = bg.load()
for y in range(S):
    for x in range(S):
        t = (x * 0.35 + y * 0.65) / S
        r = int(8 + 22 * t); g = int(14 + 10 * t); b = int(58 + 50 * t)
        # quầng tím góc dưới phải
        d = ((x - 900) ** 2 + (y - 930) ** 2) ** 0.5 / 700
        k = max(0, 1 - d) ** 2
        px[x, y] = (min(255, int(r + 90 * k)), min(255, int(g + 20 * k)), min(255, int(b + 80 * k)), 255)
mask = Image.new('L', (S, S), 0)
rr(mask, (40, 40, S - 40, S - 40), 235)
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
icon.paste(bg, (0, 0), mask)

# ---- hình: 4 làn + tam giác Play
shape = Image.new('L', (S, S), 0)
bw, gap, cy = 84, 46, 512
heights = [250, 430, 330, 520]
x0 = 150
for i, h in enumerate(heights):
    x = x0 + i * (bw + gap)
    rr(shape, (x, cy - h // 2, x + bw, cy + h // 2), bw // 2)
# tam giác Play, bo góc bằng cách làm mờ rồi cắt ngưỡng
tri = Image.new('L', (S, S), 0)
tx = x0 + 4 * (bw + gap) + 10
ImageDraw.Draw(tri).polygon([(tx + 20, cy - 270), (tx + 20, cy + 270), (tx + 300, cy)], fill=255)
tri = tri.filter(ImageFilter.GaussianBlur(26)).point(lambda v: 255 if v > 140 else 0).filter(ImageFilter.GaussianBlur(1.2))
shape = ImageChops.lighter(shape, tri)

# ---- tô màu chuyển ngang: xanh ngọc -> xanh dương -> tím -> hồng
stops = [(0.0, (34, 227, 255)), (0.4, (59, 130, 246)), (0.72, (150, 90, 250)), (1.0, (236, 120, 250))]
def grad(t):
    for (a, ca), (b, cb) in zip(stops, stops[1:]):
        if t <= b:
            u = (t - a) / (b - a)
            return tuple(int(ca[i] + (cb[i] - ca[i]) * u) for i in range(3))
    return stops[-1][1]
fill = Image.new('RGBA', (S, S))
fp = fill.load()
xmin, xmax = x0, tx + 320
cols = [grad(min(1, max(0, (x - xmin) / (xmax - xmin)))) for x in range(S)]
for y in range(S):
    for x in range(S):
        fp[x, y] = cols[x] + (255,)
# ánh sáng nhẹ phía trên mỗi hình
hl = Image.new('L', (S, S))
hp = hl.load()
for y in range(S):
    v = int(max(0, 70 * (1 - (y - 230) / 400))) if y > 230 else 70
    for x in range(S): hp[x, y] = v
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
glow.paste(fill, (0, 0), shape.filter(ImageFilter.GaussianBlur(26)).point(lambda v: int(v * 0.55)))
icon = Image.alpha_composite(icon, ImageChops.multiply(glow, Image.new('RGBA', (S, S), (255, 255, 255, 255))))
lit = Image.composite(Image.new('RGBA', (S, S), (255, 255, 255, 255)), fill, hl)
icon.paste(lit, (0, 0), shape)
# cắt lại theo hình bo góc để quầng sáng không tràn ra ngoài
alpha = ImageChops.multiply(icon.getchannel('A'), mask)
icon.putalpha(alpha)

icon.save('build/icon.png')
icon.resize((256, 256), Image.LANCZOS).save('build/icon.ico', sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
# bản xem thử
prev = Image.new('RGBA', (560, 300), (30, 30, 40, 255))
x = 10
for sz in (256, 128, 64, 32, 16):
    prev.paste(icon.resize((sz, sz), Image.LANCZOS), (x, 20), icon.resize((sz, sz), Image.LANCZOS)); x += sz + 12
prev.save('/tmp/claude-0/-home-user-event-deck/ec630201-aef7-579d-84c4-9c2b5598ee36/scratchpad/icon_preview.png')
