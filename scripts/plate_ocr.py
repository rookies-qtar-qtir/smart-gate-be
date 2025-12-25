import sys
import os
import cv2
import easyocr
import numpy as np
import re
from plate_regions import VALID_PREFIXES, DIGIT_TO_LETTER, LETTER_TO_DIGIT

os.environ["PYTHONIOENCODING"] = "utf-8"

_reader = None

# Regex pattern for valid Indonesian plate format: 1-2 letters, 1-4 digits, 0-3 letters
PLATE_ID_RE = re.compile(r"^[A-Z]{1,2}\d{1,4}[A-Z]{0,3}$")

def get_reader():
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["en"], verbose=False, gpu=True)
    return _reader

def find_top_contrast_band(gray: np.ndarray) -> tuple[int, int]:
    h, _ = gray.shape
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
    target_h = 60
    if h < target_h:
        scale = target_h / float(h)
        new_w = int(w * scale)
        band_blur = cv2.resize(band_blur, (new_w, target_h), interpolation=cv2.INTER_CUBIC)

    return cv2.cvtColor(band_blur, cv2.COLOR_GRAY2RGB)

def _letters_only_fix(s: str) -> str:
    return "".join(DIGIT_TO_LETTER.get(ch, ch) if ch.isdigit() else ch for ch in s)

def normalize_plate_text_id(raw_text: str) -> str:
    if not raw_text:
        return ""

    base_text = re.sub(r"[^A-Z0-9]", "", raw_text.upper())
    if not base_text:
        return ""

    best = ""
    best_score = -1e18

    text_variations = [base_text]
    if len(base_text) > 1 and base_text[0] in ['I', '1']:
        text_variations.append(base_text[1:])

    for text in text_variations:
        if not text: continue

        for prefix_len in (2, 1):
            if len(text) <= prefix_len:
                continue

            prefix_raw = text[:prefix_len]
            rest_raw = text[prefix_len:]
            prefix = _letters_only_fix(prefix_raw)

            if not prefix.isalpha():
                continue

            if prefix not in VALID_PREFIXES:
                continue

            region_data = VALID_PREFIXES[prefix]

            digits = []
            idx = 0
            while idx < len(rest_raw) and len(digits) < 4:
                ch = rest_raw[idx]
                mapped = LETTER_TO_DIGIT.get(ch, ch)
                if mapped.isdigit():
                    digits.append(mapped)
                    idx += 1
                else:
                    break

            if not digits:
                continue

            number = "".join(digits)
            suffix_raw = rest_raw[idx:]
            suffix = _letters_only_fix(suffix_raw)

            if len(suffix) > 3:
                continue
            if suffix and (not suffix.isalpha()):
                continue

            cand = prefix + number + suffix
            
            if not PLATE_ID_RE.match(cand):
                continue

            current_score = (len(number) * 10) - len(suffix)

            if "detail" in region_data:
                if not suffix:
                    current_score -= 5
                else:
                    first_char = suffix[0]
                    is_valid_region_code = False
                    
                    for area_name, allowed_codes in region_data["detail"].items():
                        if first_char in allowed_codes:
                            is_valid_region_code = True
                            break
                    
                    if is_valid_region_code:
                        current_score += 50
                    else:
                        current_score -= 20
            
            elif "detail" not in region_data:
                current_score += 5

            if current_score > best_score:
                best_score = current_score
                best = cand

    return best or base_text

def _score_candidate(norm: str, avg_prob: float) -> float:
    if not norm:
        return -1e9
    score = 0.0
    if PLATE_ID_RE.match(norm):
        score += 1000.0
    score += len(norm) * 5.0
    score += avg_prob * 100.0
    return score

# Preprocess -> OCR -> generate candidates -> normalize -> score -> return best
def extract_plate_text(bgr: np.ndarray) -> str:
    reader = get_reader()
    if reader is None:
        return ""

    processed = preprocess_for_ocr(bgr)

    results = reader.readtext(
        processed,
        detail=1,
        paragraph=False,
        allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
    )

    if not results:
        return ""

    # Sort text segments left to right
    results_sorted = sorted(results, key=lambda r: r[0][0][0])

    pieces = []
    probs = []
    for _, txt, prob in results_sorted:
        t = (txt or "").strip()
        if not t:
            continue
        pieces.append(t)
        probs.append(float(prob))

    raw_candidates = []

    # Add individual segments as candidates
    for i, t in enumerate(pieces):
        raw_candidates.append((t, probs[i]))

    # Add full concatenation as candidate
    if pieces:
        joined = "".join(pieces)
        avg_prob = sum(probs) / max(1, len(probs))
        raw_candidates.append((joined, avg_prob))

    best_norm = ""
    best_score = -1e18

    # Normalize and score all candidates
    for raw, avg_prob in raw_candidates:
        cleaned = re.sub(r"\s+", "", raw).upper()
        norm = normalize_plate_text_id(cleaned)
        sc = _score_candidate(norm, avg_prob)
        if sc > best_score:
            best_score = sc
            best_norm = norm

    return best_norm

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