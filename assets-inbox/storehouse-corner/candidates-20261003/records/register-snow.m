#import <AppKit/AppKit.h>
#include <stdbool.h>
bool inside(double x,double y,const double p[][2],int n){bool yes=false;int j=n-1;for(int i=0;i<n;j=i++){if((p[i][1]>y)!=(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])yes=!yes;}return yes;}
int main(int argc,const char**argv){@autoreleasepool{
 NSBitmapImageRep*src=[NSBitmapImageRep imageRepWithData:[NSData dataWithContentsOfFile:@(argv[1])]];
 NSBitmapImageRep*base=[NSBitmapImageRep imageRepWithData:[NSData dataWithContentsOfFile:@(argv[2])]];
 const double a[3][4][2]={{{48,5},{107,33},{72,75},{12,44}},{{48,5},{95,22},{137,49},{107,33}},{{126,51},{149,64},{91,90},{78,76}}};
 const double b[3][4][2]={{{48,8},{102,37},{70,78},{16,45}},{{48,8},{101,29},{133,54},{102,37}},{{126,57},{144,67},{98,85},{87,74}}};
 const double c[3][4][2]={{{38,10},{120,54},{90,91},{9,45}},{{38,10},{97,31},{150,66},{120,54}},{{38,10},{38,10},{38,10},{38,10}}};
 const double(*poly)[4][2]=argv[4][0]=='a'?a:argv[4][0]=='b'?b:c;
 NSBitmapImageRep*out=[[NSBitmapImageRep alloc]initWithBitmapDataPlanes:NULL pixelsWide:160 pixelsHigh:136 bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSDeviceRGBColorSpace bitmapFormat:NSBitmapFormatAlphaNonpremultiplied bytesPerRow:0 bitsPerPixel:0];
 for(int y=0;y<136;y++)for(int x=0;x<160;x++){
 int sx=argv[4][0]=='c'?x+3:x,sy=argv[4][0]=='c'?y+9:y;
 NSColor*col=[(sx<160&&sy<136?[src colorAtX:sx y:sy]:[NSColor colorWithDeviceRed:0 green:0 blue:0 alpha:0])colorUsingColorSpace:NSColorSpace.deviceRGBColorSpace];NSColor*bas=[base colorAtX:x y:y];
 bool mask=inside(x+.5,y+.5,poly[0],4)||inside(x+.5,y+.5,poly[1],4)||inside(x+.5,y+.5,poly[2],4);
 bool snow=col.blueComponent>.5&&col.blueComponent>col.redComponent*.88&&col.greenComponent>.5;
 NSColor*pixel=mask&&snow&&bas.alphaComponent>.5?[NSColor colorWithDeviceRed:col.redComponent green:col.greenComponent blue:col.blueComponent alpha:fmin(col.alphaComponent,bas.alphaComponent)]:[NSColor colorWithDeviceRed:0 green:0 blue:0 alpha:0];[out setColor:pixel atX:x y:y];
 }
 [[out representationUsingType:NSBitmapImageFileTypePNG properties:@{}]writeToFile:@(argv[3]) atomically:YES];
}return 0;}
