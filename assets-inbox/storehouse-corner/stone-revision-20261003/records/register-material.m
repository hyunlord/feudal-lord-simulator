#import <AppKit/AppKit.h>
int main(int argc,const char**argv){@autoreleasepool{
NSBitmapImageRep*s=[NSBitmapImageRep imageRepWithData:[NSData dataWithContentsOfFile:@(argv[1])]];
NSBitmapImageRep*b=[NSBitmapImageRep imageRepWithData:[NSData dataWithContentsOfFile:@(argv[2])]];
NSBitmapImageRep*o=[[NSBitmapImageRep alloc]initWithBitmapDataPlanes:NULL pixelsWide:256 pixelsHigh:320 bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSDeviceRGBColorSpace bitmapFormat:NSBitmapFormatAlphaNonpremultiplied bytesPerRow:0 bitsPerPixel:0];
BOOL winter=argv[4][0]=='w';
for(int y=0;y<320;y++)for(int x=0;x<256;x++){
NSUInteger sp[4]={0},bp[4]={0},out[4]={0};[b getPixel:bp atX:x y:y];
int sx=lround(40+(x-41)*177.0/175),sy=lround(86+(y-81)*190.0/188);
if(sx>=0&&sx<256&&sy>=0&&sy<320)[s getPixel:sp atX:sx y:sy];
if(!winter&&bp[3]>0&&sp[3]<32){
int best=999;
for(int dy=-4;dy<=4;dy++)for(int dx=-4;dx<=4;dx++){
int xx=sx+dx,yy=sy+dy;NSUInteger t[4]={0};if(xx<0||xx>=256||yy<0||yy>=320)continue;
[s getPixel:t atX:xx y:yy];if(t[3]>=32&&dx*dx+dy*dy<best){best=dx*dx+dy*dy;for(int k=0;k<4;k++)sp[k]=t[k];}
}}
BOOL snow=y<140&&sp[2]>168&&sp[1]>168&&sp[2]>sp[0]*.94&&sp[3]>8;
if(winter){for(int k=0;k<4;k++)out[k]=(snow?sp:bp)[k];}
else if(bp[3]>0){for(int k=0;k<3;k++)out[k]=sp[k];out[3]=bp[3];}
if(out[3]==0)out[0]=out[1]=out[2]=0;
[o setPixel:out atX:x y:y];}
[[o representationUsingType:NSBitmapImageFileTypePNG properties:@{}]writeToFile:@(argv[3]) atomically:YES];
}return 0;}
