import Foundation
import CoreText
import CoreGraphics

struct Line: Codable { let text: String; let family: String; let postscript: String; let width: Double; let path: String; let glyphs: Int; let variations: String }
func number(_ v: CGFloat)->String { String(format:"%.3f", Double(v)) }
func outline(_ text:String,_ file:String)->Line {
 let url=URL(fileURLWithPath:file)
 CTFontManagerRegisterFontsForURL(url as CFURL,.process,nil)
 let descriptors=CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as! [CTFontDescriptor]
 let desc=CTFontDescriptorCreateCopyWithVariation(descriptors[0],NSNumber(value:0x77676874),600)
 let font=CTFontCreateWithFontDescriptor(desc,100,nil)
 let str=NSAttributedString(string:text,attributes:[NSAttributedString.Key(kCTFontAttributeName as String):font])
 let line=CTLineCreateWithAttributedString(str)
 let width=CTLineGetTypographicBounds(line,nil,nil,nil)
 let runs=CTLineGetGlyphRuns(line) as! [CTRun]
 var commands=[String]();var count=0
 for run in runs {
  let n=CTRunGetGlyphCount(run);var glyphs=[CGGlyph](repeating:0,count:n);var positions=[CGPoint](repeating:.zero,count:n)
  CTRunGetGlyphs(run,CFRange(location:0,length:0),&glyphs);CTRunGetPositions(run,CFRange(location:0,length:0),&positions)
  let attrs=CTRunGetAttributes(run) as NSDictionary
  let runFont=attrs[kCTFontAttributeName] as! CTFont
  precondition(CTFontCopyFamilyName(runFont) == CTFontCopyFamilyName(font),"Unexpected fallback")
  for i in 0..<n {
   precondition(glyphs[i] != 0,"Missing glyph")
   var t=CGAffineTransform(translationX:positions[i].x,y:positions[i].y)
   guard let p=CTFontCreatePathForGlyph(runFont,glyphs[i],&t) else {continue}
   count += 1
   p.applyWithBlock { ptr in
    let e=ptr.pointee;let q=e.points
    switch e.type {
    case .moveToPoint: commands.append("M\(number(q[0].x)) \(number(q[0].y))")
    case .addLineToPoint: commands.append("L\(number(q[0].x)) \(number(q[0].y))")
    case .addQuadCurveToPoint: commands.append("Q\(number(q[0].x)) \(number(q[0].y)) \(number(q[1].x)) \(number(q[1].y))")
    case .addCurveToPoint: commands.append("C\(number(q[0].x)) \(number(q[0].y)) \(number(q[1].x)) \(number(q[1].y)) \(number(q[2].x)) \(number(q[2].y))")
    case .closeSubpath: commands.append("Z")
    @unknown default: fatalError("Unknown path")
    }
   }
  }
 }
 return Line(text:text,family:CTFontCopyFamilyName(font) as String,postscript:CTFontCopyPostScriptName(font) as String,width:width,path:commands.joined(separator:" "),glyphs:count,variations:String(describing:CTFontCopyVariation(font)))
}
let base="/tmp/charter-kin-work-20261002/fonts/"
let results=["Charter & Kin","Charter","& Kin"].map{outline($0,base+"EBGaramond.ttf")} + ["인장과 가문","인장과","가문"].map{outline($0,base+"NotoSerifKR.ttf")}
let data=try JSONEncoder().encode(results)
try data.write(to:URL(fileURLWithPath:"/tmp/charter-kin-work-20261002/outlines.json"))
for r in results {print("\(r.text): \(r.family) \(r.width), \(r.glyphs) glyphs, \(r.variations)")}
