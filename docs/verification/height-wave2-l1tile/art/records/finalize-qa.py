from pathlib import Path
from PIL import Image,ImageDraw
import hashlib,json,csv,math
p=Path(__file__).resolve().parent.parent
s=113/1010;tx=15-77*s;ty=149.92025518341308-1278*s;ws=.498621726759907
roles=['body','snow','boarded','strained','neglected','vacant','plague-shut']
raws=['body-v3.png','snow-v3.png','boarded-extract-v3.png','strained-v1.png','neglected-v1.png','vacant-v2.png','plague-extract-v1.png']
body=Image.open(p/'registered/house_l1_tile-body-v2.png').convert('RGBA')
manifest=[]
for role,raw in zip(roles,raws):
 f=p/'registered'/f'house_l1_tile-{role}-v2.png';im=Image.open(f).convert('RGBA');assert im.size==(139,163)
 al=im.getchannel('A');edge=[al.getpixel((x,y)) for x in range(139) for y in (0,162)]+[al.getpixel((x,y)) for x in (0,138) for y in range(163)]
 manifest.append({'id':'l1_tile','role':role,'file':str(f.relative_to(p)),'raw':'raw/'+raw,'canvas':[139,163],'pivot':[71.66148325358851,149.92025518341308],'worldScale':ws,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'rawSHA256':hashlib.sha256((p/'raw'/raw).read_bytes()).hexdigest(),'alphaBBox':al.getbbox(),'borderMaxAlpha':max(edge),'runtimeVerified':False})
for bg,name in [((224,220,202),'bright'),((34,42,49),'dark')]:
 sheet=Image.new('RGB',(7*278,366),bg);d=ImageDraw.Draw(sheet)
 for i,role in enumerate(roles):
  a=body.copy()
  if role!='body':a.alpha_composite(Image.open(p/'registered'/f'house_l1_tile-{role}-v2.png'))
  a=a.resize((278,326),Image.Resampling.NEAREST);sheet.paste(a,(i*278,30),a);d.text((i*278+6,8),role,fill='black' if name=='bright' else 'white')
 sheet.save(p/'proofs'/f'all-roles-{name}.png')
sheet=Image.new('RGB',(7*120,220),(111,125,94));d=ImageDraw.Draw(sheet)
for i,role in enumerate(roles):
 a=body.copy()
 if role!='body':a.alpha_composite(Image.open(p/'registered'/f'house_l1_tile-{role}-v2.png'))
 for y,z in [(35,1),(140,.6)]:
  tiny=a.resize((round(139*ws*z),round(163*ws*z)),Image.Resampling.BICUBIC);sheet.paste(tiny,(i*120+20,y),tiny)
 d.text((i*120+2,8),role,fill='white')
sheet.save(p/'proofs/offline-world-scale-z1-z06.png')
oldpts={'left':[21,90],'front':[85,125],'right':[123,103]};newraw={'left':[123,933],'front':[696,1275],'right':[1050,1070]};pairs=[]
for k,o in oldpts.items():
 n=[newraw[k][0]*s+tx,newraw[k][1]*s+ty-24];delta=[n[j]-o[j] for j in (0,1)]
 pairs.append({'name':k,'originalNative':o,'newRaw':newraw[k],'newNativeTopPaddingRemoved':n,'residualNative':delta,'residualWorld':math.hypot(*delta)*ws})
foot={'method':'manual matching of three bottom foundation vertices; original native uncertainty +-1 px, new raw +-6 px; do not read residual as exact footprint equality','combinedConservativeWorldUncertainty':(1+6*s)*ws,'pairs':pairs,'maxResidualWorld':max(x['residualWorld'] for x in pairs)}
for side in ('left','right'):
 for name,pts in [('original',oldpts),('new',newraw)]:
  a=pts[side];b=pts['front'];foot[f'{name}_{side}_ground_angle_degrees']=math.degrees(math.atan2(abs(b[1]-a[1]),abs(b[0]-a[0])))
foot['strict2to1ProjectionPassed']=False
(p/'records/foundation-correspondence.json').write_text(json.dumps(foot,indent=2))
proof=Image.new('RGB',(1112,652),(214,214,198));d=ImageDraw.Draw(proof)
old=Image.new('RGBA',(139,163));old.alpha_composite(Image.open(p/'references/original-body.png').convert('RGBA'),(0,24))
for i,a in enumerate((old,body)):
 a=a.resize((556,652),Image.Resampling.NEAREST);proof.paste(a,(i*556,0),a)
 for k in oldpts:
  q=oldpts[k] if i==0 else next(x['newNativeTopPaddingRemoved'] for x in pairs if x['name']==k)
  x=i*556+q[0]*4;y=(q[1]+24)*4;d.ellipse((x-5,y-5,x+5,y+5),fill='cyan');d.text((x+7,y-15),k,fill='red')
proof.save(p/'proofs/foundation-correspondence.png')
(p/'manifest.json').write_text(json.dumps({'candidateOnly':True,'building':'l1_tile','inside_wall':'unchanged; integration owner retains existing condition','topPadding':24,'roles':manifest},indent=2))
with (p/'manifest.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['building','role','file','width','height','pivot_x','pivot_y','world_scale','sha256','runtime_verified'])
 for v in manifest:w.writerow(['l1_tile',v['role'],v['file'],139,163,*v['pivot'],ws,v['sha256'],False])
print(json.dumps({'roles':len(manifest),'borderAlpha':[v['borderMaxAlpha'] for v in manifest],'foundation':foot},indent=2))
