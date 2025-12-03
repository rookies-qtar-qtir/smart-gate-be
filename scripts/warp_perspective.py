import cv2
import numpy as np
import sys


def order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    diff = np.diff(pts, axis=1)
    
    rect[0] = pts[np.argmin(s)]
    rect[1] = pts[np.argmin(diff)]
    rect[2] = pts[np.argmax(s)]
    rect[3] = pts[np.argmax(diff)]
    
    return rect


def warp_perspective(image_path: str, output_path: str, quad_pts) -> bool:
    image = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if image is None:
        print(f"Error: Could not read {image_path}", file=sys.stderr)
        return False

    rect = order_points(np.array(quad_pts, dtype="float32"))
    tl, tr, br, bl = rect

    width = max(int(np.linalg.norm(br - bl)), int(np.linalg.norm(tr - tl)))
    height = max(int(np.linalg.norm(tr - br)), int(np.linalg.norm(tl - bl)))

    if width <= 0 or height <= 0:
        print("Error: Invalid dimensions", file=sys.stderr)
        return False

    dst = np.array([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, M, (width, height))
    
    if warped.shape[0] > warped.shape[1]:
        warped = cv2.rotate(warped, cv2.ROTATE_90_CLOCKWISE)

    if not cv2.imwrite(output_path, warped):
        print(f"Error: Failed to write {output_path}", file=sys.stderr)
        return False

    print(f"Warped: {warped.shape[1]}x{warped.shape[0]}")
    return True


def main():
    if len(sys.argv) != 11:
        print("Usage: python warp_perspective.py <input> <output> x1 y1 x2 y2 x3 y3 x4 y4", file=sys.stderr)
        sys.exit(1)

    try:
        coords = list(map(float, sys.argv[3:11]))
        quad = [(coords[i], coords[i + 1]) for i in range(0, 8, 2)]
        success = warp_perspective(sys.argv[1], sys.argv[2], quad)
        sys.exit(0 if success else 1)
    except ValueError:
        print("Error: Coordinates must be numeric", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()