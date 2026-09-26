import Foundation
import Vision
import CoreGraphics
import ImageIO

func report(_ value: [String: Any]) {
    if let data = try? JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), let text = String(data: data, encoding: .utf8) { print(text) }
}
func eye(_ region: VNFaceLandmarkRegion2D, face: VNFaceObservation, width: Int, height: Int) -> [String: Any] {
    let points = region.normalizedPoints.map { point in
        [Double(face.boundingBox.minX + CGFloat(point.x) * face.boundingBox.width) * Double(width), (1 - Double(face.boundingBox.minY + CGFloat(point.y) * face.boundingBox.height)) * Double(height)]
    }
    let center = [points.map { $0[0] }.reduce(0, +) / Double(points.count), points.map { $0[1] }.reduce(0, +) / Double(points.count)]
    let span = (points.map { $0[0] }.max() ?? 0) - (points.map { $0[0] }.min() ?? 0)
    return ["center_xy": center, "horizontal_span": span, "points_xy": points]
}
for path in CommandLine.arguments.dropFirst() {
    do {
        guard let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
            report(["path": path, "status": "decode_failed"]); continue
        }
        let width = image.width, height = image.height
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
            report(["path": path, "status": "context_failed"]); continue
        }
        context.setFillColor(CGColor(gray: 1, alpha: 1)); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        guard let flattened = context.makeImage() else { report(["path": path, "status": "flatten_failed"]); continue }
        let request = VNDetectFaceLandmarksRequest()
        try VNImageRequestHandler(cgImage: flattened, orientation: .up).perform([request])
        guard let face = request.results?.max(by: { $0.confidence < $1.confidence }), let landmarks = face.landmarks, let left = landmarks.leftEye, let right = landmarks.rightEye, left.pointCount > 0, right.pointCount > 0 else {
            report(["path": path, "status": "no_eye_landmarks", "face_count": request.results?.count ?? 0]); continue
        }
        let leftInfo = eye(left, face: face, width: width, height: height)
        let rightInfo = eye(right, face: face, width: width, height: height)
        let leftCenter = leftInfo["center_xy"] as! [Double], rightCenter = rightInfo["center_xy"] as! [Double]
        let leftSpan = leftInfo["horizontal_span"] as! Double, rightSpan = rightInfo["horizontal_span"] as! Double
        let outerLips = landmarks.outerLips.map { eye($0, face: face, width: width, height: height)["points_xy"] as! [[Double]] } ?? []
        let leftBrow = landmarks.leftEyebrow.map { eye($0, face: face, width: width, height: height)["points_xy"] as! [[Double]] } ?? []
        let rightBrow = landmarks.rightEyebrow.map { eye($0, face: face, width: width, height: height)["points_xy"] as! [[Double]] } ?? []
        let contour = landmarks.faceContour.map
 { eye($0, face: face, width: width, height: height)["points_xy"] as! [[Double]] } ?? []
        let chin = contour.max(by: { $0[1] < $1[1] }) ?? []
        report(["outer_lips_points_xy": outerLips, "left_eyebrow_points_xy": leftBrow, "right_eyebrow_points_xy": rightBrow, "face_contour_xy": contour, "chin_xy": chin, "chin_y": chin.last.map { $0 as Any } ?? NSNull(), "path": path, "status": "detected",
 "width": width, "height": height,
                "face_confidence": face.confidence, "landmark_precision_confidence": NSNull(),
                "mean_eye_y": (leftCenter[1] + rightCenter[1]) / 2,
                "near_eye_inferred_by_width": leftSpan >= rightSpan ? leftInfo : rightInfo,
                "far_eye_inferred_by_width": leftSpan >= rightSpan ? rightInfo : leftInfo,
                "vision_left_eye": leftInfo, "vision_right_eye": rightInfo,
                "coordinate_system": "top-left pixels; eye center is landmark mean; near/far inferred from horizontal span"])
    } catch { report(["path": path, "status": "error", "error": String(describing: error)]) }
}
