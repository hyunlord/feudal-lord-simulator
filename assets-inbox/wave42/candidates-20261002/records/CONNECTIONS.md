# 길 접속 계약
B기본띠12개=3강도×2방향×2계절. 별도갈림/꺾임8개=뚜렷함×2형상×2방향×2계절. 나머지강도갈림/꺾임은선택사항으로이번제작제외.
띠512×64는펴진UV원본. 반복X512,port(0,32)/(512,32). NE du=(0.5,-0.25),dv=(0.5,0.25),NW du=(0.5,0.25),dv=(-0.5,0.25). repeatpitch NE(256,-128),NW(256,128). 각각독립생성,좌우반전없음.
연결조각128×128,피벗(64,80),제작1칸diamond지면중심동일. 포트NW(32,64),NE(96,64),SW(32,96),SE(96,96).
- fork_ne:SW,NE,NW. fork_nw:SE,NW,NE.
- corner_ne:SW,NW. corner_nw:SE,NE.
NW/SE포트는clear_nw동계절띠,NE/SW포트는clear_ne동계절띠와연결. 포트끼리맞추고8UVpx내외겹쳐fade,UV띠의u방향은항상SW→NE또는NW→SE로배치. 좌우flip금지. runtime적용은이패키지밖.
