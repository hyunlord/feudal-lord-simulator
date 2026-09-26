import AppKit
import Foundation

// Deterministic raster preparation only. Pixels use premultiplied RGBA.
struct Raster {
    let width: Int
    let height: Int
    var pixels: [UInt8]
    init(width: Int, height: Int) {
        self.width = width; self.height = height
        pixels = [UInt8](repeating: 0, count: width * height * 4)
    }
    init(path: String) throws {
        let url = URL(fileURLWithPath: path)
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
              let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { throw Failure.message("Cannot decode \(path)") }
        width = image.width; height = image.height
        pixels = [UInt8](repeating: 0, count: width * height * 4)
        let w = width, h = height
        pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
            context.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        }
    }
    func image() -> CGImage {
        let data = Data(pixels) as CFData
        return CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue), provider: CGDataProvider(data: data)!, decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
    }
    func save(_ path: String) throws {
        let destination = URL(fileURLWithPath: path)
        try FileManager.default.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        guard let encoded = NSBitmapImageRep(cgImage: image()).representation(using: .png, properties: [:]) else { throw Failure.message("PNG encoding failed") }
        if path == "/dev/stdout" {
            FileHandle.standardOutput.write(encoded)
        } else {
            try encoded.write(to: destination)
        }
    }
    func resized(_ w: Int, _ h: Int) -> Raster {
        var output = Raster(width: w, height: h)
        let source = image()
        output.pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
            context.interpolationQuality = .high
            context.draw(source, in: CGRect(x: 0, y: 0, width: w, height: h))
        }
        return output
    }
    mutating func overlay(_ source: Raster, x: Int = 0, y: Int = 0) {
        for sy in 0..<source.height {
            let dy = sy + y
            guard dy >= 0 && dy < height else { continue }
            for sx in 0..<source.width {
                let dx = sx + x
                guard dx >= 0 && dx < width else { continue }
                let s = (sy * source.width + sx) * 4, d = (dy * width + dx) * 4
                let inverse = 255 - Int(source.pixels[s + 3])
                for channel in 0..<4 {
                    pixels[d + channel] = UInt8(min(255, Int(source.pixels[s + channel]) + (Int(pixels[d + channel]) * inverse + 127) / 255))
                }
            }
        }
    }
}
struct LandmarkEye: Decodable { let points_xy: [[Double]] }
struct LandmarkMaskInput: Decodable {
    let path: String
    let status: String
    let width: Int?
    let height: Int?
    let vision_left_eye: LandmarkEye?
    let vision_right_eye: LandmarkEye?
    let outer_lips_points_xy: [[Double]]?
    let left_eyebrow_points_xy: [[Double]]?
    let right_eyebrow_points_xy: [[Double]]?
}
func polygonCoverage(_ polygons: [[[Double]]], width: Int, height: Int, expansion: Double) -> Raster {
    var output = Raster(width: width, height: height)
    output.pixels.withUnsafeMutableBytes { buffer in
        let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
        context.translateBy(x: 0, y: CGFloat(height)); context.scaleBy(x: 1, y: -1)
        context.setShouldAntialias(true); context.setFillColor(CGColor(gray: 1, alpha: 1))
        context.setStrokeColor(CGColor(gray: 1, alpha: 1)); context.setLineWidth(expansion * 2); context.setLineJoin(.round)
        for polygon in polygons where polygon.count >= 3 {
            context.beginPath(); context.move(to: CGPoint(x: polygon[0][0], y: polygon[0][1]))
            for point in polygon.dropFirst() { context.addLine(to: CGPoint(x: point[0], y: point[1])) }
            context.closePath(); context.drawPath(using: .fillStroke)
        }
    }
    return output
}
struct PolygonScene: Decodable {

    let width: Int?
    let height: Int?
    let regions: [[[Double]]]
    let holes: [[[Double]]]?
}
struct WarpScene: Decodable {
    let x: [[Double]]
    let y: [[Double]]
    let xFadeY: [Double]?
    let yFadeX: [Double]?
}
func validKnots(_ knots: [[Double]], extent: Int) -> Bool {
    guard knots.count >= 2, knots.allSatisfy({ $0.count == 2 && $0.allSatisfy(\.isFinite) }), knots.first![0] == 0, knots.first![1] == 0, (knots.last![0] == Double(extent - 1) || knots.last![0] == Double(extent)), knots.last![1] == knots.last![0] else { return false }
    return zip(knots, knots.dropFirst()).allSatisfy { $0[0] < $1[0] && $0[1] < $1[1] }
}
func inverseCoordinate(_ coordinate: Double, knots: [[Double]]) -> Double {
    for i in 1..<knots.count where coordinate <= knots[i][1] {
        let a = knots[i - 1], b = knots[i]
        return a[0] + (coordinate - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
    }
    return knots.last![0]
}
struct BoardScene: Decodable {

    let width: Int
    let height: Int
    let background: String
    let images: [BoardImage]
    let texts: [BoardText]
}
struct BoardImage: Decodable {
    let file: String
    let x: Int
    let y: Int
    let width: Int
    let height: Int
}
struct BoardText: Decodable {
    let text: String
    let x: Int
    let y: Int
    let size: Double
    let color: String?
}
func rgb(_ value: String) throws -> (UInt8, UInt8, UInt8) {
    guard value.hasPrefix("#"), value.count == 7,
          let bits = UInt32(value.dropFirst(), radix: 16) else { throw Failure.message("Expected #RRGGBB color: \(value)") }
    return (UInt8((bits >> 16) & 255), UInt8((bits >> 8) & 255), UInt8(bits & 255))
}
enum Failure: Error
 { case message(String) }
func jsonData(_ path: String) throws -> Data {
    if path == "-" { return FileHandle.standardInput.readDataToEndOfFile() }
    return try Data(contentsOf: URL(fileURLWithPath: path))
}
func number(_ text: String) throws -> Int {
    guard let value = Int(text), value > 0 else { throw Failure.message("Expected positive integer: \(text)") }
    return value
}
let args = Array(CommandLine.arguments.dropFirst())
do {
    guard let command = args.first else { throw Failure.message("Commands: resize IN OUT [W H]; mask-hair IN OUT; mask-skin IN OUT; composite OUT LAYER... (back to front); sheet OUT COLS SIZE IMAGE...; info IMAGE...") }
    switch command {
    case "enclosed-mask":
        guard args.count == 3 || args.count == 4 else { throw Failure.message("enclosed-mask IN OUT [ERODE(0|1)]") }
        let erosion = args.count == 4 ? Int(args[3]) : 0
        guard let erosion, (0...1).contains(erosion) else { throw Failure.message("Optional erosion must be0or1") }
        let source = try Raster(path: args[1]), width = source.width, height = source.height
        var exterior = [Bool](repeating: false, count: width * height), queue: [Int] = []
        for y in 0..<height { for x in 0..<width where y == 0 || y == height - 1 || x == 0 || x == width - 1 {
            let p = y * width + x
            if source.pixels[p * 4 + 3] < 128 && !exterior[p] { exterior[p] = true; queue.append(p) }
        }}
        var cursor = 0
        while cursor < queue.count {
            let p = queue[cursor], x = p % width, y = p / width; cursor += 1
            for (nx, ny) in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)] where nx >= 0 && nx < width && ny >= 0 && ny < height {
                let q = ny * width + nx
                if !exterior[q] && source.pixels[q * 4 + 3] < 128 { exterior[q] = true; queue.append(q) }
            }
        }
        var output = Raster(width: width, height: height), filled = 0
        for y in 0..<height { for x in 0..<width {
            let p = y * width + x
            var inside = !exterior[p]
            if erosion == 1 && inside {
                for dy in -1...1 { for dx in -1...1 {
                    let nx = x + dx, ny = y + dy
                    if nx < 0 || nx >= width || ny < 0 || ny >= height || exterior[ny * width + nx] { inside = false }
                }}
            }
            let a: UInt8 = inside ? 255 : 0
            if inside && source.pixels[p * 4 + 3] < 128 { filled += 1 }
            for c in 0..<4 { output.pixels[p * 4 + c] = a }
        }}
        try output.save(args[2])
        FileHandle.standardError.write(Data("enclosed-mask: exteriorPixels=\(queue.count), filledHolePixels=\(filled), erosion=\(erosion)\n".utf8))
    case "feather-mask":

        guard args.count == 4, let radius = Int(args[3]), (0...8).contains(radius) else { throw Failure.message("feather-mask IN OUT RADIUS(0...8); alpha erosion then fixed2px inward feather") }
        let source = try Raster(path: args[1])
        var eroded = [UInt8](repeating: 0, count: source.width * source.height)
        for y in 0..<source.height { for x in 0..<source.width {
            var a: UInt8 = 255
            for dy in -radius...radius { for dx in -radius...radius where dx * dx + dy * dy <= radius * radius {
                let nx = x + dx, ny = y + dy
                if nx < 0 || nx >= source.width || ny < 0 || ny >= source.height { a = 0 }
                else { a = min(a, source.pixels[(ny * source.width + nx) * 4 + 3]) }
            }}
            eroded[y * source.width + x] = a
        }}
        var output = Raster(width: source.width, height: source.height)
        for y in 0..<source.height { for x in 0..<source.width {
            var total = 0
            for dy in -2...2 { for dx in -2...2 {
                let nx = x + dx, ny = y + dy
                if nx >= 0 && nx < source.width && ny >= 0 && ny < source.height { total += Int(eroded[ny * source.width + nx]) }
            }}
            let a = min(eroded[y * source.width + x], UInt8((total + 12) / 25)), p = (y * source.width + x) * 4
            for c in 0..<4 { output.pixels[p + c] = a }
        }}
        try output.save(args[2])
    case "defringe":

        guard args.count == 4, let radius = Int(args[3]), (1...2).contains(radius) else { throw Failure.message("defringe IN OUT RADIUS(1|2)") }
        let source = try Raster(path: args[1])
        var output = source
        var changed = 0, unresolved = 0
        for y in 0..<source.height { for x in 0..<source.width {
            let p = (y * source.width + x) * 4, a = Int(source.pixels[p + 3])
            guard a > 0 && a <= 250 else { continue }
            var nearest: Int? = nil, best = Int.max
            for dy in -radius...radius { for dx in -radius...radius {
                let nx = x + dx, ny = y + dy, distance = dx * dx + dy * dy
                guard nx >= 0 && nx < source.width && ny >= 0 && ny < source.height && distance > 0 && distance <= radius * radius else { continue }
                let q = (ny * source.width + nx) * 4
                if source.pixels[q + 3] >= 250 && distance < best { nearest = q; best = distance }
            }}
            if let q = nearest {
                let qa = Int(source.pixels[q + 3])
                for channel in 0..<3 { output.pixels[p + channel] = UInt8(min(a, (Int(source.pixels[q + channel]) * a + qa / 2) / qa)) }
                changed += 1
            } else { unresolved += 1 }
        }}
        try output.save(args[2])
        FileHandle.standardError.write(Data("defringe: replaced=\(changed), no_interior_within_radius=\(unresolved); alpha preserved\n".utf8))
    case "polygon-mask":
        guard args.count == 3 else { throw Failure.message("polygon-mask OUT JSON") }
        let scene = try JSONDecoder().decode(PolygonScene.self, from: jsonData(args[2]))
        let width = scene.width ?? 256, height = scene.height ?? 256
        guard width > 0 && height > 0 && width <= 4096 && height <= 4096 else { throw Failure.message("Invalid mask size") }
        let polygons = scene.regions + (scene.holes ?? [])
        guard polygons.allSatisfy({ $0.count >= 3 && $0.allSatisfy({ $0.count == 2 && $0.allSatisfy(\.isFinite) }) }) else { throw Failure.message("Each polygon needs 3+ finite [x,y] vertices") }
        var output = Raster(width: width, height: height)
        output.pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
            context.translateBy(x: 0, y: CGFloat(height)); context.scaleBy(x: 1, y: -1)
            context.setShouldAntialias(true)
            context.setFillColor(CGColor(gray: 1, alpha: 1))
            for (i, polygon) in polygons.enumerated() {
                context.setBlendMode(i < scene.regions.count ? .normal : .clear)
                context.beginPath(); context.move(to: CGPoint(x: polygon[0][0], y: polygon[0][1]))
                for point in polygon.dropFirst() { context.addLine(to: CGPoint(x: point[0], y: point[1])) }
                context.closePath(); context.fillPath()
            }
        }
        try output.save(args[1])
    case "warp":
        guard args.count == 4 else { throw Failure.message("warp IN OUT JSON {x:[[source,target]...],y:[...]}; monotonic endpoints 0 and size-1") }
        let source = try Raster(path: args[1])
        let scene = try JSONDecoder().decode(WarpScene.self, from: jsonData(args[3]))
        guard validKnots(scene.x, extent: source.width), validKnots(scene.y, extent: source.height) else { throw Failure.message("Warp knots must be strictly increasing on both axes with fixed 0,size-1 endpoints") }
        if let fade = scene.yFadeX {
            guard fade.count == 4 && fade.allSatisfy(\.isFinite) && zip(fade, fade.dropFirst()).allSatisfy({ $0 < $1 }) else { throw Failure.message("yFadeX requires increasing [outerLeft,innerLeft,innerRight,outerRight]") }
        }
        if let fade = scene.xFadeY {

            guard fade.count == 2 && fade.allSatisfy(\.isFinite) && fade[0] < fade[1] else { throw Failure.message("xFadeY requires [targetYStart,targetYEnd] increasing finite values") }
        }
        var output = Raster(width: source.width, height: source.height)

        for y in 0..<output.height { for x in 0..<output.width {
            let blend = scene.xFadeY.map { 1 - min(1, max(0, (Double(y) - $0[0]) / ($0[1] - $0[0]))) } ?? 1
            let sx = Double(x) + (inverseCoordinate(Double(x), knots: scene.x) - Double(x)) * blend
            let yBlend = scene.yFadeX.map { fade -> Double in
                let tx = Double(x)
                if tx <= fade[0] || tx >= fade[3] { return 0 }
                if tx < fade[1] { return (tx - fade[0]) / (fade[1] - fade[0]) }
                if tx <= fade[2] { return 1 }
                return (fade[3] - tx) / (fade[3] - fade[2])
            } ?? 1
            let sy = Double(y) + (inverseCoordinate(Double(y), knots: scene.y) - Double(y)) * yBlend


            let x0 = Int(floor(sx)), y0 = Int(floor(sy)), x1 = min(x0 + 1, source.width - 1), y1 = min(y0 + 1, source.height - 1)
            let fx = sx - Double(x0), fy = sy - Double(y0), p = (y * output.width + x) * 4
            for c in 0..<4 {
                let a = Double(source.pixels[(y0 * source.width + x0) * 4 + c]), b = Double(source.pixels[(y0 * source.width + x1) * 4 + c])
                let d = Double(source.pixels[(y1 * source.width + x0) * 4 + c]), e = Double(source.pixels[(y1 * source.width + x1) * 4 + c])
                output.pixels[p + c] = UInt8(max(0, min(255, ((a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy).rounded())))
            }
        }}
        try output.save(args[2])
    case "recolor-skin":
        guard args.count == 5 else { throw Failure.message("recolor-skin IN MASK OUT #RRGGBB") }
        let source = try Raster(path: args[1]), mask = try Raster(path: args[2]), target = try rgb(args[4])
        guard source.width == mask.width && source.height == mask.height else { throw Failure.message("Mask dimensions differ") }
        var luminances: [Double] = []
        for p in stride(from: 0, to: source.pixels.count, by: 4) where source.pixels[p + 3] >= 128 && mask.pixels[p + 3] >= 128 {
            let a = Double(source.pixels[p + 3])
            luminances.append((0.2126 * Double(source.pixels[p]) + 0.7152 * Double(source.pixels[p + 1]) + 0.0722 * Double(source.pixels[p + 2])) * 255 / a)
        }
        guard !luminances.isEmpty else { throw Failure.message("No sufficiently opaque selected skin pixels") }
        luminances.sort(); let median = max(1, luminances[luminances.count / 2])
        let targetChannels = [Double(target.0), Double(target.1), Double(target.2)]
        var output = source
        for p in stride(from: 0, to: source.pixels.count, by: 4) where source.pixels[p + 3] > 0 && mask.pixels[p + 3] > 0 {
            let a = Double(source.pixels[p + 3]), weight = Double(mask.pixels[p + 3]) / 255
            let luminance = (0.2126 * Double(source.pixels[p]) + 0.7152 * Double(source.pixels[p + 1]) + 0.0722 * Double(source.pixels[p + 2])) * 255 / a
            for c in 0..<3 {
                let tinted = min(255, targetChannels[c] * luminance / median) * a / 255
                output.pixels[p + c] = UInt8(max(0, min(a, (Double(source.pixels[p + c]) * (1 - weight) + tinted * weight).rounded())))
            }
        }
        try output.save(args[3])
        FileHandle.standardError.write(Data("recolor-skin: source selected median luminance=\(median); relative shading preserved, hue replaced\n".utf8))
    case "resize":

        guard args.count == 3 || args.count == 5 else { throw Failure.message("resize IN OUT [W H]") }
        let width = args.count == 5 ? try number(args[3]) : 256
        let height = args.count == 5 ? try number(args[4]) : 256
        try Raster(path: args[1]).resized(width, height).save(args[2])
    case "crop":
        guard args.count == 7, let x = Int(args[3]), let y = Int(args[4]) else { throw Failure.message("crop IN OUT X Y W H") }
        let source = try Raster(path: args[1])
        let w = try number(args[5]), h = try number(args[6])
        guard x >= 0 && y >= 0 && x + w <= source.width && y + h <= source.height else { throw Failure.message("Crop outside image") }
        var output = Raster(width: w, height: h)
        output.overlay(source, x: -x, y: -y)
        try output.save(args[2])
    case "place":
        guard args.count == 7, let x = Int(args[5]), let y = Int(args[6]) else { throw Failure.message("place IN OUT RESIZED_W RESIZED_H X Y (256 canvas)") }
        let source = try Raster(path: args[1]).resized(try number(args[3]), try number(args[4]))
        var output = Raster(width: 256, height: 256)
        output.overlay(source, x: x, y: y)
        try output.save(args[2])
    case "mask-skin-v2":
        guard args.count == 4 else { throw Failure.message("mask-skin-v2 IN OUT LANDMARKS.json (object/array/JSONL)") }
        let source = try Raster(path: args[1]), data = try jsonData(args[3]), decoder = JSONDecoder()
        let entries: [LandmarkMaskInput]
        if let array = try? decoder.decode([LandmarkMaskInput].self, from: data) { entries = array }
        else if let object = try? decoder.decode(LandmarkMaskInput.self, from: data) { entries = [object] }
        else {
            guard let text = String(data: data, encoding: .utf8) else { throw Failure.message("Landmarks JSON is not UTF8") }
            entries = try text.split(separator: "\n").filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.map { try decoder.decode(LandmarkMaskInput.self, from: Data($0.utf8)) }
        }
        let basename = URL(fileURLWithPath: args[1]).lastPathComponent
        let matches = entries.filter { $0.path == args[1] || URL(fileURLWithPath: $0.path).lastPathComponent == basename }
        guard let selected = matches.count == 1 ? matches.first : (entries.count == 1 ? entries.first : nil), selected.status == "detected",
              selected.width == source.width, selected.height == source.height,
              let leftEye = selected.vision_left_eye?.points_xy, let rightEye = selected.vision_right_eye?.points_xy,
              let lips = selected.outer_lips_points_xy, let leftBrow = selected.left_eyebrow_points_xy, let rightBrow = selected.right_eyebrow_points_xy else { throw Failure.message("Unique detected landmarks with matching dimensions, eyes, lips and brows required") }
        let polygons = [leftEye, rightEye, lips, leftBrow, rightBrow]
        guard polygons.allSatisfy({ $0.count >= 3 && $0.allSatisfy({ $0.count == 2 && $0.allSatisfy(\.isFinite) }) }) else { throw Failure.message("Invalid landmark polygons") }
        let features = polygonCoverage([leftEye, rightEye, lips], width: source.width, height: source.height, expansion: 0.5)
        let brows = polygonCoverage([leftBrow, rightBrow], width: source.width, height: source.height, expansion: 1)
        var output = Raster(width: source.width, height: source.height)
        var removed = 0
        for p in stride(from: 0, to: source.pixels.count, by: 4) {
            let alpha = Int(source.pixels[p + 3])
            var exclusion = Int(features.pixels[p + 3])
            if alpha > 0 && brows.pixels[p + 3] > 0 {
                let luminance = (0.2126 * Double(source.pixels[p]) + 0.7152 * Double(source.pixels[p + 1]) + 0.0722 * Double(source.pixels[p + 2])) * 255 / Double(alpha)
                if luminance < 100 { exclusion = max(exclusion, Int(brows.pixels[p + 3])) }
            }
            let a = UInt8((alpha * (255 - exclusion) + 127) / 255)
            if Int(a) < alpha { removed += 1 }
            for c in 0..<4 { output.pixels[p + c] = a }
        }
        try output.save(args[2])
        FileHandle.standardError.write(Data("mask-skin-v2: feature-protected pixels=\(removed); eye/lip polygon coverage AA; dark eyebrow pixels only; remaining skin alpha preserved\n".utf8))
    case "mask-hair", "mask-skin":


        guard args.count == 3 else { throw Failure.message("\(command) IN OUT") }
        var raster = try Raster(path: args[1])
        for y in 0..<raster.height {
            for x in 0..<raster.width {
                let p = (y * raster.width + x) * 4
                var alpha = raster.pixels[p + 3]
                if command == "mask-skin", alpha > 0 {
                    let scale = 255.0 / Double(alpha)
                    let r = Double(raster.pixels[p]) * scale, g = Double(raster.pixels[p + 1]) * scale, b = Double(raster.pixels[p + 2]) * scale
                    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
                    let nx = Double(x) * 256.0 / Double(raster.width), ny = Double(y) * 256.0 / Double(raster.height)
                    let eyeBand = (ny >= 103 && ny <= 118 && nx >= 75 && nx <= 101) || (ny >= 99 && ny <= 117 && nx >= 110 && nx <= 137) || (ny >= 96 && ny <= 106 && nx >= 75 && nx <= 103) || (ny >= 93 && ny <= 105 && nx >= 108 && nx <= 141)
                    let mouthBand = ny >= 150 && ny <= 156 && nx >= 76 && nx <= 110
                    let darkEye = eyeBand && (lum < 55 || (abs(r - g) < 13 && lum > 210))
                    let lip = mouthBand && (lum < 105 && r > g * 1.15 && r - g > 12)
                    let skin = true // Preserve skin regardless of tone; only narrow feature exclusions apply.
                    if !skin || darkEye || lip { alpha = 0 }
                }
                raster.pixels[p] = alpha; raster.pixels[p + 1] = alpha; raster.pixels[p + 2] = alpha; raster.pixels[p + 3] = alpha
            }
        }
        try raster.save(args[2])
    case "clip-alpha":
        guard args.count == 4 else { throw Failure.message("clip-alpha INPUT MASK OUTPUT") }
        var input = try Raster(path: args[1])
        let mask = try Raster(path: args[2])
        guard input.width == mask.width && input.height == mask.height else { throw Failure.message("Input and mask dimensions differ") }
        for p in stride(from: 0, to: input.pixels.count, by: 4) {
            let alpha = Int(mask.pixels[p + 3])
            for channel in 0..<4 {
                input.pixels[p + channel] = UInt8((Int(input.pixels[p + channel]) * alpha + 127) / 255)
            }
        }
        try input.save(args[3])
    case "intersect-alpha-mask":
        guard args.count >= 3 else { throw Failure.message("intersect-alpha-mask OUTPUT INPUT...") }
        var output = try Raster(path: args[2])
        for path in args.dropFirst(3) {
            let layer = try Raster(path: path)
            guard layer.width == output.width && layer.height == output.height else { throw Failure.message("Mask dimensions differ: \(path)") }
            for p in stride(from: 0, to: output.pixels.count, by: 4) {
                output.pixels[p + 3] = min(output.pixels[p + 3], layer.pixels[p + 3])
            }
        }
        for p in stride(from: 0, to: output.pixels.count, by: 4) {
            let a = output.pixels[p + 3]
            output.pixels[p] = a; output.pixels[p + 1] = a; output.pixels[p + 2] = a
        }
        try output.save(args[1])
    case "composite":

        guard args.count >= 3 else { throw Failure.message("composite OUT LAYER... (back to front)") }
        let first = try Raster(path: args[2])
        var output = Raster(width: first.width, height: first.height)
        for path in args.dropFirst(2) {
            let layer = try Raster(path: path)
            guard layer.width == output.width && layer.height == output.height else { throw Failure.message("Layer dimensions differ: \(path)") }
            output.overlay(layer)
        }
        try output.save(args[1])
    case "sheet":
        guard args.count >= 5 else { throw Failure.message("sheet OUT COLS SIZE IMAGE...") }
        let columns = try number(args[2]), size = try number(args[3])
        let paths = Array(args.dropFirst(4)), padding = 12, label = 25
        let rows = (paths.count + columns - 1) / columns
        let width = columns * (size + padding) + padding, height = rows * (size + label + padding) + padding
        var output = Raster(width: width, height: height)
        for i in stride(from: 0, to: output.pixels.count, by: 4) {
            output.pixels[i] = 235; output.pixels[i + 1] = 231; output.pixels[i + 2] = 221; output.pixels[i + 3] = 255
        }
        for (i, path) in paths.enumerated() {
            output.overlay(try Raster(path: path).resized(size, size), x: padding + i % columns * (size + padding), y: padding + i / columns * (size + label + padding))
        }
        output.pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
            context.translateBy(x: 0, y: CGFloat(height)); context.scaleBy(x: 1, y: -1)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
            for (i, path) in paths.enumerated() {
                let name = URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent
                let text = NSAttributedString(string: name, attributes: [.font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor.black])
                text.draw(in: CGRect(x: padding + i % columns * (size + padding), y: padding + i / columns * (size + label + padding) + size + 3, width: size, height: label))
            }
            NSGraphicsContext.restoreGraphicsState()
        }
        try output.save(args[1])
    case "board":
        guard args.count == 3 else { throw Failure.message("board OUT SCENE.json") }
        let sceneURL = URL(fileURLWithPath: args[2])
        let scene = try JSONDecoder().decode(BoardScene.self, from: Data(contentsOf: sceneURL))
        guard scene.width > 0 && scene.height > 0 && scene.width <= 20000 && scene.height <= 20000 else { throw Failure.message("Board dimensions must be 1...20000") }
        let background = try rgb(scene.background)
        var output = Raster(width: scene.width, height: scene.height)
        for p in stride(from: 0, to: output.pixels.count, by: 4) {
            output.pixels[p] = background.0; output.pixels[p + 1] = background.1
            output.pixels[p + 2] = background.2; output.pixels[p + 3] = 255
        }
        for item in scene.images {
            guard item.width > 0 && item.height > 0 else { throw Failure.message("Board image dimensions must be positive") }
            let path = item.file.hasPrefix("/") ? item.file : sceneURL.deletingLastPathComponent().appendingPathComponent(item.file).path
            output.overlay(try Raster(path: path).resized(item.width, item.height), x: item.x, y: item.y)
        }
        let colors = try scene.texts.map { try rgb($0.color ?? "#202020") }
        guard scene.texts.allSatisfy({ $0.size > 0 && $0.size <= 1000 }) else { throw Failure.message("Text size must be positive and <=1000") }
        output.pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(data: buffer.baseAddress, width: scene.width, height: scene.height, bitsPerComponent: 8, bytesPerRow: scene.width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
            context.translateBy(x: 0, y: CGFloat(scene.height)); context.scaleBy(x: 1, y: -1)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: true)
            for (index, item) in scene.texts.enumerated() {
                let c = colors[index]
                let color = NSColor(srgbRed: CGFloat(c.0) / 255, green: CGFloat(c.1) / 255, blue: CGFloat(c.2) / 255, alpha: 1)
                let text = NSAttributedString(string: item.text, attributes: [.font: NSFont.systemFont(ofSize: item.size), .foregroundColor: color])
                text.draw(in: CGRect(x: item.x, y: item.y, width: max(1, scene.width - item.x), height: max(1, scene.height - item.y)))
            }
            NSGraphicsContext.restoreGraphicsState()
        }
        try output.save(args[1])
    case "info":

        for path in args.dropFirst() {
            let r = try Raster(path: path)
            var minX = r.width, minY = r.height, maxX = -1, maxY = -1, count = 0, translucent = 0
            for y in 0..<r.height { for x in 0..<r.width {
                let a = r.pixels[(y * r.width + x) * 4 + 3]
                if a > 0 { minX = min(minX, x); minY = min(minY, y); maxX = max(maxX, x); maxY = max(maxY, y); count += 1 }
                if a > 0 && a < 255 { translucent += 1 }
            }}
            var thresholdStats: [String: Any] = [:]
            for threshold in [16, 128, 240] {
                var x0 = r.width, y0 = r.height, x1 = -1, y1 = -1, n = 0
                for y in 0..<r.height { for x in 0..<r.width {
                    if Int(r.pixels[(y * r.width + x) * 4 + 3]) >= threshold {
                        x0 = min(x0, x); y0 = min(y0, y); x1 = max(x1, x); y1 = max(y1, y); n += 1
                    }
                }}
                thresholdStats[String(threshold)] = ["bbox_xyxy": x1 < 0 ? [] : [x0, y0, x1, y1], "pixels": n]
            }
            let object: [String: Any] =
 ["alpha_thresholds": thresholdStats, "path": path, "width": r.width, "height": r.height, "alpha_bbox_xyxy": maxX < 0 ? [] : [minX, minY, maxX, maxY], "nonzero_alpha_pixels": count, "partial_alpha_pixels": translucent, "transparent_pixels": r.width * r.height - count]
            print(String(data: try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]), encoding: .utf8)!)
        }
    default: throw Failure.message("Unknown command: \(command)")
    }
} catch {
    FileHandle.standardError.write(Data("raster: \(error)\n".utf8)); exit(1)
}
