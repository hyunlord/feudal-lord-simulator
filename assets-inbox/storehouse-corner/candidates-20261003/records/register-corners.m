#import <AppKit/AppKit.h>
int main(int argc,const char**argv){@autoreleasepool{
NSBitmapImageRep*s=[NSBitmapImageRep imageRepWithData:[NSData dataWithContentsOfFile:@(argv[1])]];
NSBitmapImageRep*b=[NSBitmapImageRep imageRepWithData:[NSData dataWithContentsOfFile:@(argv[2])]];
NSBitmapImageRep*o=[[NSBitmapImageRep alloc]initWithBitmapDataPlanes:NULL pixelsWide:256 pixelsHigh:320 bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSDeviceRGBColorSpace bitmapFormat:NSBitmapFormatAlphaNonpremultiplied bytesPerRow:0 bitsPerPixel:0];
BOOL winter=argv[4][0]=='w';
for(int y=0;y<320;y++)for(int x=0;x<256;x++){
NSUInteger sp[4]={0},bp[4]={0},zero[4]={0};[s getPixel:sp atX:x y:y];[b getPixel:bp atX:x y:y];
BOOL snow=y<140&&sp[2]>178&&sp[1]>178&&sp[2]>sp[0]*.96&&sp[3]>8;
NSUInteger*px=winter?(snow?sp:bp):sp;
if(px[3]<8||x<35||x>220||y<70||y>273)px=zero;
[o setPixel:px atX:x y:y];}
[[o representationUsingType:NSBitmapImageFileTypePNG properties:@{}]writeToFile:@(argv[3]) atomically:YES];
}return 0;}
