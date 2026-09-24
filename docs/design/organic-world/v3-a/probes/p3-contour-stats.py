# Probe P3 (read-only): size of label-field contours for the real 64x64 map (drives render-cost estimates).
import json, sys, collections
for f in sys.argv[1:]:
    s=json.load(open(f)); W,H=s['width'],s['height']; t=s['tiles']
    lab=lambda x,y: ('road' if t[y*W+x]['hasRoad'] and t[y*W+x]['terrain']!='water' else t[y*W+x]['terrain'])
    pairs=collections.Counter()
    for y in range(H):
        for x in range(W):
            for dx,dy in ((1,0),(0,1)):
                if x+dx<W and y+dy<H:
                    a,b=lab(x,y),lab(x+dx,y+dy)
                    if a!=b: pairs[tuple(sorted((a,b)))]+=1
    # connected regions per label (4-neighbour)
    seen=set(); regions=collections.Counter()
    for y in range(H):
        for x in range(W):
            if (x,y) in seen: continue
            L=lab(x,y); regions[L]+=1; st=[(x,y)]; seen.add((x,y))
            while st:
                cx,cy=st.pop()
                for nx,ny in ((cx+1,cy),(cx-1,cy),(cx,cy+1),(cx,cy-1)):
                    if 0<=nx<W and 0<=ny<H and (nx,ny) not in seen and lab(nx,ny)==L: seen.add((nx,ny)); st.append((nx,ny))
    total=sum(pairs.values())
    print(f.split('/')[-1], 'boundaryCellEdges(=marching-squares segments)=',total, dict(pairs), 'regions=',dict(regions), 'contourVerticesAfterChaikin3~', total*8)
