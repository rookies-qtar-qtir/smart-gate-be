import sys
import os
import cv2
import easyocr
import numpy as np
import re

os.environ['PYTHONIOENCODING'] = 'utf-8'

_reader = None


def get_reader():
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(['en'], verbose=False, gpu=False)
    return _reader


def find_top_contrast_band(gray: np.ndarray) -> tuple[int, int]:
    h, w = gray.shape
    row_var = gray.var(axis=1).astype(np.float32)
    max_var = float(row_var.max())

    if max_var < 1e-3:
        return 0, h

    thr = 0.3 * max_var
    text_rows = row_var > thr

    segments = []
    in_seg = False
    start = 0
    
    for i, v in enumerate(text_rows):
        if v and not in_seg:
            in_seg = True
            start = i
        elif not v and in_seg:
            in_seg = False
            segments.append((start, i - 1))
    
    if in_seg:
        segments.append((start, h - 1))

    if not segments:
        return 0, h

    min_height = max(5, int(0.2 * h))
    candidates = [seg for seg in segments if (seg[1] - seg[0] + 1) >= min_height]
    
    if not candidates:
        candidates = segments

    start, end = sorted(candidates, key=lambda s: s[0])[0]
    margin = max(1, int(0.05 * h))
    y1 = max(0, start - margin)
    y2 = min(h, end + margin + 1)

    return y1, y2


def preprocess_for_ocr(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_eq = clahe.apply(gray)

    y1, y2 = find_top_contrast_band(gray_eq)
    band = gray_eq[y1:y2, :]
    band_blur = cv2.GaussianBlur(band, (3, 3), 0)

    h, w = band_blur.shape
    target_h = 50
    if h < target_h:
        scale = target_h / float(h)
        new_w = int(w * scale)
        band_blur = cv2.resize(band_blur, (new_w, target_h), interpolation=cv2.INTER_CUBIC)

    return cv2.cvtColor(band_blur, cv2.COLOR_GRAY2RGB)


def normalize_plate_text(raw_text: str) -> str:
    if not raw_text:
        return ""

    text = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
    if not text:
        return ""

    first_digit = next((i for i, ch in enumerate(text) if ch.isdigit()), len(text))

    if first_digit == len(text):
        digit_to_letter = {'0': 'O', '1': 'I', '2': 'Z', '4': 'L', '5': 'S', '6': 'G', '8': 'B'}
        return "".join(digit_to_letter.get(ch, ch) for ch in text)

    prefix = text[:first_digit]
    max_num_len = 4
    window = text[first_digit:first_digit + max_num_len]
    rest = text[first_digit + len(window):]

    letter_to_digit = {'O': '0', 'Q': '0', 'I': '1', 'Z': '2', 'L': '4', 'A': '4', 'S': '5', 'G': '6', 'B': '8'}
    
    number_fixed = ""
    suffix_extra = ""
    number_done = False

    for ch in window:
        mapped = letter_to_digit.get(ch, ch)
        if not number_done and len(number_fixed) < max_num_len and mapped.isdigit():
            number_fixed += mapped
        else:
            number_done = True
            suffix_extra += ch

    suffix_raw = suffix_extra + rest
    digit_to_letter = {'0': 'O', '1': 'I', '2': 'Z', '4': 'L', '5': 'S', '6': 'G', '8': 'B'}

    prefix_fixed = "".join(digit_to_letter.get(ch, ch) if ch.isdigit() else ch for ch in prefix)
    suffix_fixed = "".join(digit_to_letter.get(ch, ch) if ch.isdigit() else ch for ch in suffix_raw)

    return prefix_fixed + number_fixed + suffix_fixed


def extract_plate_text(bgr: np.ndarray) -> str:
    reader = get_reader()
    if reader is None:
        return ""

    processed = preprocess_for_ocr(bgr)

    results = reader.readtext(
        processed,
        detail=1,
        paragraph=False,
        allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 "
    )

    if not results:
        return ""

    results_sorted = sorted(results, key=lambda r: r[0][0][0])
    pieces = [text for _, text, prob in results_sorted if prob >= 0.2]
    text = "".join(pieces).replace(" ", "").upper()

    return normalize_plate_text(text)


def main():
    if len(sys.argv) < 2:
        print("Error: Image file path is required", file=sys.stderr)
        sys.exit(1)

    image_path = sys.argv[1]

    if not os.path.exists(image_path):
        print(f"Error: File {image_path} does not exist", file=sys.stderr)
        sys.exit(1)

    bgr = cv2.imread(image_path)
    if bgr is None:
        print(f"Error: Could not read image from {image_path}", file=sys.stderr)
        sys.exit(1)

    print(extract_plate_text(bgr))


if __name__ == "__main__":
    main()