#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
int main(int argc,char **argv){@autoreleasepool{
 if(argc!=2)return 2; NSData *data=[NSData dataWithContentsOfFile:@(argv[1])]; NSDictionary *j=[NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
 int w=[j[@"width"] intValue],h=[j[@"height"] intValue]; CGColorSpaceRef sp=CGColorSpaceCreateDeviceRGB(); CGContextRef ctx=CGBitmapContextCreate(NULL,w,h,8,0,sp,kCGImageAlphaPremultipliedLast); CGContextSetInterpolationQuality(ctx,kCGInterpolationHigh);
 for(NSDictionary *a in j[@"items"]){NSURL *u=[NSURL fileURLWithPath:a[@"source"]]; CGImageSourceRef s=CGImageSourceCreateWithURL((__bridge CFURLRef)u,NULL); CGImageRef im=CGImageSourceCreateImageAtIndex(s,0,NULL); NSArray *b=a[@"crop"],*t=a[@"target"];
 CGImageRef crop=CGImageCreateWithImageInRect(im,CGRectMake([b[0] doubleValue],[b[1] doubleValue],[b[2] doubleValue],[b[3] doubleValue])); CGContextDrawImage(ctx,CGRectMake([t[0] doubleValue],h-[t[1] doubleValue]-[t[3] doubleValue],[t[2] doubleValue],[t[3] doubleValue]),crop); CGImageRelease(crop);CGImageRelease(im);CFRelease(s);}
 CGImageRef o=CGBitmapContextCreateImage(ctx); NSURL *out=[NSURL fileURLWithPath:j[@"output"]]; CGImageDestinationRef d=CGImageDestinationCreateWithURL((__bridge CFURLRef)out,CFSTR("public.png"),1,NULL);CGImageDestinationAddImage(d,o,NULL);return CGImageDestinationFinalize(d)?0:3;
}}
