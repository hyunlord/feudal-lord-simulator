// Offline whole-sprite coordinate registration; never edits game files.
// clang -fobjc-arc register.m -framework Foundation -framework CoreImage -framework CoreGraphics -framework ImageIO -o /tmp/astra-register
// /tmp/astra-register ROOT
#import <Foundation/Foundation.h>
#import <CoreImage/CoreImage.h>
#import <ImageIO/ImageIO.h>
int main(int argc, const char * argv[]) {
  @autoreleasepool {
    if (argc != 2) return 2;
    NSString *root = [NSString stringWithUTF8String:argv[1]];
    NSError *error = nil;
    NSData *data = [NSData dataWithContentsOfFile:[root stringByAppendingPathComponent:@"records/transforms.json"] options:0 error:&error];
    if (!data) { NSLog(@"%@", error); return 3; }
    NSArray *rows = [NSJSONSerialization JSONObjectWithData:data options:0 error:&error];
    if (![rows isKindOfClass:NSArray.class]) { NSLog(@"Invalid transforms: %@", error); return 4; }
    CIContext *context = [CIContext contextWithOptions:@{kCIContextUseSoftwareRenderer:@YES}];
    for (NSDictionary *row in rows) {
      NSString *name = row[@"filename"];
      NSURL *input = [NSURL fileURLWithPath:[[root stringByAppendingPathComponent:@"raw"] stringByAppendingPathComponent:name]];
      CIImage *image = [CIImage imageWithContentsOfURL:input];
      if (!image) { NSLog(@"Missing %@", input); return 5; }
      NSArray *m = row[@"matrix"];
      double a=[m[0] doubleValue], b=[m[1] doubleValue], c=[m[2] doubleValue];
      double tx=[m[3] doubleValue], ty=[m[4] doubleValue];
      // Source/top-down x'=a*x+tx; y'=b*x+c*y+ty. Convert to CI bottom-up coordinates.
      CGAffineTransform transform = CGAffineTransformMake(a,-b,0,c,tx,2048-c*image.extent.size.height-ty);
      CIImage *registered = [image imageByApplyingTransform:transform];
      CGImageRef cg = [context createCGImage:registered fromRect:CGRectMake(0,0,2048,2048)];
      if (!cg) return 6;
      NSURL *output = [NSURL fileURLWithPath:[[root stringByAppendingPathComponent:@"assets"] stringByAppendingPathComponent:name]];
      CGImageDestinationRef destination=CGImageDestinationCreateWithURL((__bridge CFURLRef)output, CFSTR("public.png"),1,NULL);
      if (!destination) { CGImageRelease(cg); return 7; }
      CGImageDestinationAddImage(destination,cg,NULL);
      bool ok=CGImageDestinationFinalize(destination);
      CFRelease(destination); CGImageRelease(cg);
      if (!ok) return 8;
      printf("%s\n", name.UTF8String);
    }
  }
  return 0;
}
