# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow"]
# ///
# Run: python3 /tmp/astra-era-work-20261003/proofs.py
from pathlib import Path
from typing import Final
import json
import random
import hashlib
from PIL import Image, ImageDraw, ImageFont

ROOT: Final = Path('/tmp/astra-era-pilot-20261003')
REPO: Final = Path('/Users/rexxa/fls-astra-era')
PROOFS: Final = ROOT / 'proofs'
BLIND: Final = Path('/tmp/astra-era-blind-20261003')
FONT: Final = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 14)
ROLES: Final = ('labor_m','labor_f','merchant_m','gentry_f')
IDS: Final = ('I037','I040','I043','I046','I049','I060')
ERAS: Final = (1300,1380,1420)

def rgba(path: Path) -> Image.Image:
    with Image.open(path) as im:
        return im.convert('RGBA')

def bounds(im: Image.Image) -> tuple[int,int,int,int]:
    b = im.getchannel('A').point(lambda x:255 if x>=8 else 0).getbbox()
    assert b is not None
    return b

def place(canvas: Image.Image, im: Image.Image, xy: tuple[int,int]) -> None:
    canvas.alpha_composite(im, xy)

def tile_background() -> Image.Image:
    canvas=Image.new('RGBA',(720,430),(107,112,75,255))
    grass=rgba(REPO/'public/assets/terrain/grass.png')
    earth=rgba(REPO/'public/assets/terrain/packed_earth_road.png')
    soil=Image.new('RGBA',canvas.size)
    for x in range(0,720,256):
        for y in range(0,430,256):
            place(canvas,grass,(x,y));place(soil,earth,(x,y))
    mask=Image.new('L',canvas.size)
    ImageDraw.Draw(mask).polygon([(-80,70),(15,15),(800,408),(800,455)],fill=255)
    return Image.composite(soil,canvas,mask)

def street(year: int) -> Image.Image:
    scene=tile_background()
    house_year=1420 if year>=1420 else 1300
    actors=[]
    for side in range(2):
        for i in range(8):
            level=2+i%3
            x=66+i*73+side*25
            y=76+i*36+side*107
            actors.append((y,'house',level,x,y))
    for i in range(24):
        x=63+i*24
        y=round(0.5*x+85+(i%3)*9)
        actors.append((y,'walker',i%4,x,y))
    manifest=json.loads((ROOT/'records/inventory/walker_selected_manifest.json').read_text())
    for _,kind,index,x,y in sorted(actors):
        match kind:
            case 'house':
                im=rgba(ROOT/f'pilot/houses/house_l{index}_{house_year}.png')
                b=bounds(im);scale=56.32/(b[2]-b[0])
                resized=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
                place(scene,resized,(x-round((b[0]+b[2])*0.5*scale),y-round(b[3]*scale)))
                sign_type=('bread','ale','smith','textile')[(x//73)%4]
                sign=rgba(ROOT/f'pilot/signs/sign_{sign_type}_{house_year}.png')
                sb=bounds(sign);sign=sign.crop(sb);sign=sign.resize((8,round(8*sign.height/sign.width)),Image.Resampling.LANCZOS)
                place(scene,sign,(x-19,y-25))
            case 'walker':
                role=ROLES[index]; col=(x//24)%4;row=(x//48)%2
                sheet=rgba(ROOT/f'pilot/walkers/wk_{role}_{year}.png')
                frame=sheet.crop((col*74,row*74,(col+1)*74,(row+1)*74))
                spec=manifest[index]['frames'][row*4+col]
                scale=17.6/spec['figureHeight'];n=round(74*scale)
                frame=frame.resize((n,n),Image.Resampling.LANCZOS)
                place(scene,frame,(x-round(spec['foot']['x']*scale),y-round(spec['foot']['y']*scale)))
            case _:
                raise RuntimeError(kind)
    return scene

def panels() -> None:
    board=Image.new('RGBA',(960,535),(226,221,208,255));draw=ImageDraw.Draw(board)
    for row,level in enumerate((2,3,4)):
        draw.text((10,row*175+10),f'L{level}',font=FONT,fill='black')
        for col,year in enumerate((1300,1420)):
            im=rgba(ROOT/f'pilot/houses/house_l{level}_{year}.png')
            place(board,im,(65+col*210,row*175+7))
            draw.text((65+col*210,row*175+155),str(year),font=FONT,fill='black')
        a=rgba(ROOT/f'pilot/houses/house_l{level}_1300.png');b=rgba(ROOT/f'pilot/houses/house_l{level}_1420.png')
        overlay=Image.blend(a,b,0.5)
        place(board,overlay,(530,row*175+7));draw.text((530,row*175+155),'50/50 geometry overlay',font=FONT,fill='black')
    board.convert('RGB').save(PROOFS/'houses-comparison.jpg',quality=92)
    for size in (256,96):
        board=Image.new('RGB',(4*(size+12)+70,6*(size+30)),(228,223,212));draw=ImageDraw.Draw(board)
        for row,identity in enumerate(IDS):
            draw.text((5,row*(size+30)+5),identity,font=FONT,fill='black')
            paths=[REPO/f'assets-inbox/portrait-pool/pool1-20260926/assets/portraits/{identity}_mature.png']+[ROOT/f'pilot/portraits/{identity}_{era}.png' for era in ERAS]
            for col,path in enumerate(paths):
                im=rgba(path).resize((size,size),Image.Resampling.LANCZOS)
                board.paste(im.convert('RGB'),(70+col*(size+12),row*(size+30)))
                draw.text((70+col*(size+12),row*(size+30)+size+3),('source','1300','1380','1420')[col],font=FONT,fill='black')
        board.save(PROOFS/f'portraits-{size}.jpg',quality=93)

PROOFS.mkdir(exist_ok=True);BLIND.mkdir(exist_ok=True)
trials=[]
for year in ERAS:
    im=street(year)
    for zoom in (1.0,0.6):
        target=im.resize((round(im.width*zoom),round(im.height*zoom)),Image.Resampling.LANCZOS).convert('RGB')
        name=f'street-{year}-zoom{zoom:.1f}.png';target.save(PROOFS/name)
        trials.append((year,zoom,name))
random.Random(961003).shuffle(trials)
key=[]
for i,(year,zoom,name) in enumerate(trials):
    filename=f'scene-{chr(65+i)}.png';data=(PROOFS/name).read_bytes();(BLIND/filename).write_bytes(data)
    key.append({'file':filename,'year':year,'zoom':zoom,'sha256':hashlib.sha256(data).hexdigest()})
Path('/tmp/astra-era-work-20261003/blind-key.json').write_text(json.dumps(key,indent=2))
for zoom in (1.0,0.6):
    frames=[rgba(PROOFS/f'street-{year}-zoom{zoom:.1f}.png') for year in ERAS]
    board=Image.new('RGB',(frames[0].width*3,frames[0].height+30),(225,222,211));draw=ImageDraw.Draw(board)
    for i,frame in enumerate(frames):
        board.paste(frame.convert('RGB'),(i*frame.width,30));draw.text((i*frame.width+8,7),f'{ERAS[i]} / zoom {zoom:.1f}',font=FONT,fill='black')
    board.save(PROOFS/f'street-comparison-zoom{zoom:.1f}.jpg',quality=94)
panels()
print('Rendered six frozen street trials and source/era comparison panels.')
