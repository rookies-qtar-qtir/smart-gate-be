import sys
import os
import cv2
import easyocr
import numpy as np
import re
import json
import base64
from plate_regions import VALID_PREFIXES, DIGIT_TO_LETTER, LETTER_TO_DIGIT

os.environ["PYTHONIOENCODING"] = "utf-8"

_reader = None

PLATE_ID_RE = re.compile(r"^[A-Z]{1,2}\d{1,4}[A-Z]{0,3}$")

def get_reader():
    global _reader
    if _reader is None:
        _reader = easyocr.Reader(["en"], verbose=False, gpu=True, recognizer=True, detector=False)
    return _reader

def find_top_contrast_band(gray_image: np.ndarray) -> np.ndarray:
    h, w = gray_image.shape

    row_var = gray_image.var(axis=1).astype(np.float32)
    max_var = float(row_var.max())
    
    if max_var < 1e-3: 
        return gray_image[0:int(h * 0.75), :]
    
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
    if in_seg: segments.append((start, h - 1))
    
    if not segments: 
        return gray_image[0:int(h * 0.75), :]
    
    min_height = max(5, int(0.2 * h))
    candidates = [seg for seg in segments if (seg[1] - seg[0] + 1) >= min_height]
    
    if not candidates: candidates = segments
    
    best_start, best_end = sorted(candidates, key=lambda s: s[0])[0]
    
    margin = max(1, int(0.05 * h))
    y1 = max(0, best_start - margin)
    y2 = min(h, best_end + margin + 1)
    
    current_height = y2 - y1

    if current_height < (h * 0.40):
        return gray_image[0:int(h * 0.75), :]
        
    return gray_image[y1:y2, :]

def remove_plate_borders(gray_image: np.ndarray) -> np.ndarray:
    h, w = gray_image.shape
    
    if w / h > 3.5:
        return gray_image

    _, binary = cv2.threshold(gray_image, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    valid_rects = []
    for cnt in contours:
        x, y, cw, ch = cv2.boundingRect(cnt)
        aspect_ratio = cw / float(ch)
        height_ratio = ch / float(h)
        
        if 0.2 < height_ratio < 0.95 and 0.1 < aspect_ratio < 1.5:
            valid_rects.append((x, y, cw, ch))
            
    if not valid_rects: 
        return gray_image
    
    min_x = min(r[0] for r in valid_rects)
    max_x = max(r[0] + r[2] for r in valid_rects)
    
    new_width = max_x - min_x
    
    if new_width < (w * 0.5):
        return gray_image
    
    padding = max(10, int(w * 0.05))
    
    new_x1 = max(0, min_x - padding)
    new_x2 = min(w, max_x + padding)
    
    return gray_image[:, new_x1:new_x2]

def preprocess_for_ocr(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray_eq = clahe.apply(gray)
    
    band_v = find_top_contrast_band(gray_eq)
    
    band_h = remove_plate_borders(band_v)

    band_smooth = cv2.bilateralFilter(band_h, 7, 50, 50)
    
    band_sharp = cv2.addWeighted(band_smooth, 1.3, cv2.GaussianBlur(band_smooth, (0, 0), 1.0), -0.3, 0,)
    
    h, w = band_sharp.shape
    target_h = 60
    if h < target_h:
        scale = target_h / float(h)
        if w == 0: w = 1
        new_w = int(w * scale)
        band_sharp = cv2.resize(band_sharp, (new_w, target_h), interpolation=cv2.INTER_CUBIC)
        
    return cv2.cvtColor(band_sharp, cv2.COLOR_GRAY2RGB)

def _letters_only_fix(s: str) -> str:
    return "".join(DIGIT_TO_LETTER.get(ch, ch) if ch.isdigit() else ch for ch in s)

def calculate_logic_score(cand_plate: str, prefix: str, suffix: str, region_data: dict, conversion_count: int) -> float:
    logic_score = 100.0

    if "detail" in region_data:
        if not suffix:
            logic_score -= 50
        else:
            first_char_suffix = suffix[0]
            is_valid_region_code = False

            for area_name, allowed_codes in region_data["detail"].items():
                if first_char_suffix in allowed_codes:
                    is_valid_region_code = True
                    break

            if is_valid_region_code:
                logic_score += 150
            else:
                logic_score += 20
    else:
        logic_score += 100

    digits = re.findall(r'\d+', cand_plate)
    if digits:
        number_str = digits[0]
        num_len = len(number_str)

        if num_len > 4:
            logic_score -= 200
        elif num_len == 0:
            logic_score -= 500
        elif number_str.startswith('0'):
            logic_score -= 100
    else:
        logic_score -= 500

    logic_score -= (conversion_count * 60.0)

    if len(prefix) == 2:
        logic_score += 20

    return logic_score


def normalize_plate_text_id(raw_text: str) -> tuple[str, float]:
    if not raw_text:
        return "", -1000.0

    base_text = re.sub(r"[^A-Z0-9]", "", raw_text.upper())
    if not base_text:
        return "", -1000.0

    best_cand = ""
    best_logic_score = -99999.0
    found_valid = False

    text_variations = [base_text]
    if len(base_text) > 1 and base_text[0] in ['I', '1']:
        text_variations.append(base_text[1:])

    for text in text_variations:
        if not text:
            continue

        for prefix_len in range(1, 3):
            if len(text) <= prefix_len:
                continue

            prefix_raw = text[:prefix_len]
            rest_raw = text[prefix_len:]

            conversion_cost = 0

            prefix_fixed_list = []
            for ch in prefix_raw:
                if ch.isdigit():
                    converted = DIGIT_TO_LETTER.get(ch, ch)
                    if converted != ch:
                        conversion_cost += 1
                    prefix_fixed_list.append(converted)
                else:
                    prefix_fixed_list.append(ch)

            prefix = "".join(prefix_fixed_list)

            if prefix not in VALID_PREFIXES:
                continue

            region_data = VALID_PREFIXES[prefix]

            digits = []
            idx = 0

            while idx < len(rest_raw) and len(digits) < 4:
                ch = rest_raw[idx]

                if ch.isdigit():
                    digits.append(ch)
                    idx += 1
                else:
                    mapped = LETTER_TO_DIGIT.get(ch, None)

                    if mapped is not None:
                        digits.append(mapped)
                        conversion_cost += 1
                        idx += 1
                    else:
                        break

            if not digits:
                continue

            number = "".join(digits)
            suffix_raw = rest_raw[idx:]

            suffix_fixed_list = []
            for ch in suffix_raw:
                if ch.isdigit():
                    converted = DIGIT_TO_LETTER.get(ch, ch)
                    if converted != ch:
                        conversion_cost += 1
                    suffix_fixed_list.append(converted)
                else:
                    suffix_fixed_list.append(ch)

            suffix = "".join(suffix_fixed_list)

            if len(suffix) > 3:
                continue

            cand = prefix + number + suffix

            if not PLATE_ID_RE.match(cand):
                continue

            current_logic_score = calculate_logic_score(
                cand, prefix, suffix, region_data, conversion_cost
            )

            if current_logic_score > best_logic_score:
                best_logic_score = current_logic_score
                best_cand = cand
                found_valid = True

    if not found_valid:
        return base_text, -500.0

    return best_cand, best_logic_score


def _score_candidate(norm: str, avg_prob: float, logic_score: float) -> float:
    if not norm:
        return -1e9
    
    final_score = 0.0
    
    final_score += logic_score

    if avg_prob > 0.8:
        final_score += 100
    elif avg_prob > 0.5:
        final_score += 50
    else:
        final_score -= 50

    final_score += len(norm) * 2.0

    return final_score

def extract_plate_text_and_image(bgr: np.ndarray) -> tuple[str, np.ndarray]:
    reader = get_reader()
    processed = preprocess_for_ocr(bgr)

    if reader is None:
        return "", processed

    results = reader.recognize(
        processed,
        detail=1,
        paragraph=False,
        allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
    )

    if not results:
        return "", processed

    results_sorted = sorted(results, key=lambda r: r[0][0][0])
    
    # COLLECTING TEXT PIECES
    pieces = []
    probs = []
    for _, txt, prob in results_sorted:
        t = (txt or "").strip()
        if not t: continue
        pieces.append(t)
        probs.append(float(prob))

    raw_candidates = []

    # CREATE CANDIDATE
    for i, t in enumerate(pieces):
        raw_candidates.append((t, probs[i]))

    # COMBINE CANDIDATE
    if pieces:
        joined = "".join(pieces)
        avg_prob = sum(probs) / max(1, len(probs))
        raw_candidates.append((joined, avg_prob))

    best_final_text = ""
    best_total_score = -1e18

    for raw, avg_prob in raw_candidates:
        cleaned = re.sub(r"\s+", "", raw).upper()
        
        norm_text, logic_score = normalize_plate_text_id(cleaned)
        
        total_score = _score_candidate(norm_text, avg_prob, logic_score)

        if total_score > best_total_score:
            best_total_score = total_score
            best_final_text = norm_text

    return best_final_text, processed

def main():
    output = {
        "ocrText": None,
        "processedImage": None,
        "error": None
    }

    if len(sys.argv) < 2:
        output["error"] = "Image file path is required"
        print(json.dumps(output))
        sys.exit(1)

    image_path = sys.argv[1]

    if not os.path.exists(image_path):
        output["error"] = f"File {image_path} does not exist"
        print(json.dumps(output))
        sys.exit(1)

    bgr = cv2.imread(image_path)
    if bgr is None:
        output["error"] = f"Could not read image from {image_path}"
        print(json.dumps(output))
        sys.exit(1)

    try:
        ocr_text, processed_img = extract_plate_text_and_image(bgr)
        
        output["ocrText"] = ocr_text

        if processed_img is not None:
            retval, buffer = cv2.imencode('.png', processed_img)
            if retval:
                b64_str = base64.b64encode(buffer).decode('utf-8')
                output["processedImage"] = f"data:image/png;base64,{b64_str}"

        print(json.dumps(output))

    except Exception as e:
        output["error"] = str(e)
        print(json.dumps(output))
        sys.exit(1)

if __name__ == "__main__":
    main()