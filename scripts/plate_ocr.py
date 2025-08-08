import sys
import cv2
import easyocr
import os

os.environ['PYTHONIOENCODING'] = 'utf-8'

_reader = None

def get_reader():
    global _reader
    if _reader is None:
        try:
            _reader = easyocr.Reader(['en'], verbose=False)
        except Exception as e:
            print(f"Error initializing EasyOCR: {e}", file=sys.stderr)
            return None
    return _reader

def crop_first_line(plate_crop):
    h, w, _ = plate_crop.shape
    y_start = int(h * 0.05)
    y_end = int(h * 0.7)
    margin_x = int(w * 0.0275)
    x_start = margin_x
    x_end = w - margin_x
    return plate_crop[y_start:y_end, x_start:x_end]

def extract_first_line_text(image):
    reader = get_reader()
    if reader is None:
        return ""
        
    try:
        results = reader.readtext(image, detail=1, paragraph=False)
        
        if not results:
            return ""

        sorted_results = sorted(results, key=lambda r: r[0][0][1])
        top_y = sorted_results[0][0][0][1]
        tolerance = 20

        first_line_words = [text for (bbox, text, prob) in results if abs(bbox[0][1] - top_y) < tolerance]
        return ''.join(first_line_words).replace(' ', '')
    except Exception as e:
        print(f"Error during OCR processing: {e}", file=sys.stderr)
        return ""

def main():
    if len(sys.argv) < 2:
        print("Error: Image file path is required", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]
    
    if not os.path.exists(image_path):
        print(f"Error: File {image_path} does not exist", file=sys.stderr)
        sys.exit(1)
    
    image = cv2.imread(image_path)
    
    if image is None:
        print(f"Error: Could not read image from {image_path}", file=sys.stderr)
        sys.exit(1)
    
    first_line_crop = crop_first_line(image)
    result = extract_first_line_text(first_line_crop)
    print(result.upper())

if __name__ == '__main__':
    main()
