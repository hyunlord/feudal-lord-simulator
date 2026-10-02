#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
int main(int argc, char **argv) {
 @autoreleasepool {
  if(argc!=13) return 2;
  int n[10]; for(int i=0;i<10;i++) n[i]=atoi(argv[i+3]);
  NSURL *in=[NSURL fileURLWithPath:@(argv[1])];
  CGImageSourceRef source=CGImageSourceCreateWithURL((__bridge CFURLRef)in,NULL);
  if(!source) return 3;
  CGImageRef input=CGImageSourceCreateImageAtIndex(source,0,NULL);
  CGImageRef crop=CGImageCreateWithImageInRect(input,CGRectMake(n[2],n[3],n[4],n[5]));
  CGColorSpaceRef space=CGColorSpaceCreateDeviceRGB();
  CGContextRef ctx=CGBitmapContextCreate(NULL,n[0],n[1],8,0,space,kCGImageAlphaPremultipliedLast);
  CGContextSetInterpolationQuality(ctx,kCGInterpolationHigh);
  CGContextDrawImage(ctx,CGRectMake(n[6],n[1]-n[7]-n[9],n[8],n[9]),crop);
  CGImageRef output=CGBitmapContextCreateImage(ctx);
  NSURL *out=[NSURL fileURLWithPath:@(argv[2])];
  CGImageDestinationRef dest=CGImageDestinationCreateWithURL((__bridge CFURLRef)out,CFSTR("public.png"),1,NULL);
  CGImageDestinationAddImage(dest,output,NULL);
  return CGImageDestinationFinalize(dest)?0:4;
 }
}
