"""OpenCV preprocessing for a single rasterized transcript page (stdin -> JSON)."""

import base64
import json
import math
import sys

import cv2
import numpy as np


GRID_WIDTH = 1237
RULES = (39, 195, 262, 329, 481, 548, 614, 767, 833, 900, 1054, 1121, 1191)
MAX_EDGE = 3600


def resize_edge(image, limit):
    height, width = image.shape[:2]
    scale = min(1, limit / max(height, width))
    if scale == 1:
        return image
    return cv2.resize(image, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)


def rotate(image, angle):
    return {
        0: lambda: image,
        90: lambda: cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE),
        180: lambda: cv2.rotate(image, cv2.ROTATE_180),
        270: lambda: cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE),
    }[angle]()


def deskew(image):
    gray = cv2.cvtColor(resize_edge(image, 1300), cv2.COLOR_BGR2GRAY)
    width = gray.shape[1]
    edges = cv2.Canny(gray, 35, 100)
    segments = cv2.HoughLinesP(edges, 1, np.pi / 720, 65,
                               minLineLength=round(width * .28), maxLineGap=32)
    angles = []
    if segments is not None:
        for x1, y1, x2, y2 in segments.reshape(-1, 4):
            if x2 == x1:
                continue
            if x2 < x1:
                x1, y1, x2, y2 = x2, y2, x1, y1
            angle = math.degrees(math.atan2(int(y2) - int(y1), int(x2) - int(x1)))
            if abs(angle) <= 8:
                angles.append(angle)
    if len(angles) < 2:
        return image
    angle = float(np.median(angles))
    agreement = sum(abs(value - angle) <= .7 for value in angles)
    if abs(angle) < .18 or agreement < max(2, len(angles) * .6):
        return image
    height, width = image.shape[:2]
    matrix = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
    return cv2.warpAffine(image, matrix, (width, height), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_CONSTANT, borderValue=(255, 255, 255))


def enhance(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    size = max(15, round(image.shape[1] / 80)) | 1
    paper = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (size, size)))
    paper = cv2.GaussianBlur(paper, (0, 0), size / 8)
    ink = cv2.subtract(paper, gray).astype(np.float32)
    return np.clip(255 - np.maximum(0, ink - 11) * 3.65, 0, 255).astype(np.uint8)


def locate_table(gray):
    height, width = gray.shape
    if not 300 <= height <= 1050:
        return None
    gray = gray.astype(np.int16)
    vertical = np.zeros(width, dtype=np.int32)
    edge = np.maximum(gray[::2, :-12], gray[::2, 12:]) - gray[::2, 6:-6]
    vertical[6:-6] = np.count_nonzero(edge > 12, axis=0)
    threshold = cv2.adaptiveThreshold(gray.astype(np.uint8), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                      cv2.THRESH_BINARY_INV, 31, 8)
    long_rules = cv2.morphologyEx(threshold, cv2.MORPH_OPEN, np.ones((max(21, height // 10), 1), np.uint8))
    projection = vertical + np.count_nonzero(long_rules[::2], axis=0) // 3
    best_strength = 0
    rules = []
    for zoom in (1, 1.02, 1.04, 1.06, 1.08, 1.10):
        for offset in range(-63, 8, 7):
            positions = []
            for rule in RULES:
                expected = max(6, min(width - 7, round(rule * zoom + offset)))
                first, last = max(6, expected - 8), min(width - 7, expected + 8)
                positions.append(first + int(np.argmax(projection[first:last + 1])))
            strength = int(projection[positions].sum())
            if strength > best_strength:
                best_strength, rules = strength, positions
    if not rules or np.count_nonzero(vertical[rules] >= min(130, height * .185)) < 11:
        return None
    scale = (rules[11] - rules[1]) / (RULES[11] - RULES[1])
    if not .97 <= scale <= 1.13 or min(np.diff(rules)) < 40 * scale:
        return None

    horizontal = np.zeros_like(gray, dtype=bool)
    horizontal[4:-4] = np.maximum(gray[:-8], gray[8:]) - gray[4:-4] > 14
    signals = np.count_nonzero(horizontal[:, rules[0]:rules[-1]:2], axis=1)
    minimum = (rules[-1] - rules[0]) * .2
    header = None
    best = 0
    for y in range(round(36 * scale), height - 100):
        top = y - round(33 * scale)
        heading = int(signals[max(0, top - 2):top + 3].max())
        if signals[y] >= minimum and heading >= minimum:
            score = 2 * int(signals[y]) + heading
            if score > best:
                header, best = y, score
    if header is None:
        return None
    pitch = 14 * scale
    body_bottom = height
    for y in range(header + round(pitch * 9), min(height - 2, round(header + pitch * 31))):
        dark = np.min(gray[y - 2:y + 3], axis=0) < 150
        if all(np.count_nonzero(dark[rules[i]:rules[i + 3]:2]) >= (rules[i + 3] - rules[i]) * .37
               for i in (0, 3, 6, 9)):
            body_bottom = y
            break
    return rules, header, body_bottom, scale, horizontal


def fit_rows(positions, ink, pitch, pitch_steps, phase_limit):
    if not len(ink):
        return pitch, 0
    max_step = pitch_steps if np.any(positions >= pitch * 5) else 0
    steps = np.arange(-max_step, max_step + 1)
    phases = np.arange(-phase_limit, phase_limit + .25, .5)
    pitches = pitch + steps * .125
    phase_angles = 2 * np.pi * (positions[None, None, :] - phases[None, :, None]) / pitches[:, None, None]
    scores = np.sum(np.cos(phase_angles) * ink, axis=2) / ink.sum()
    scores -= np.abs(steps[:, None]) * .001 + np.abs(phases[None, :]) * .01
    row, col = np.unravel_index(np.argmax(scores), scores.shape)
    return (float(pitches[row]), float(phases[col])) if scores[row, col] >= .16 else (pitch, 0)


def read_grid(gray):
    layout = locate_table(gray)
    if layout is None:
        return None
    rules, header, body_bottom, scale, horizontal = layout
    height = gray.shape[0]
    gray = gray.astype(np.int16)
    nominal = 14 * scale
    edge = np.zeros_like(gray)
    edge[4:-4] = np.maximum(gray[:-8], gray[8:]) - gray[4:-4]

    def local_header(left, right):
        locations = np.arange(max(4, header - 7), header + 8)
        signals = np.count_nonzero(horizontal[locations, left + 4:right - 4:2], axis=1)
        scores = signals - np.abs(locations - header) * .15
        best = int(np.argmax(scores))
        return int(locations[best]) if scores[best] > (right - left - 8) * .3 else header

    def scan_semester(left, right, first):
        start_y = max(4, math.floor(first - nominal))
        end_y = min(height - 4, body_bottom - 3, math.ceil(first + nominal * 28))
        width = right - left - 10
        sample = gray[start_y:end_y, left + 5:right - 5]
        marks = (sample < 235) & (edge[start_y:end_y, left + 5:right - 5] > 16)
        wide = cv2.erode(marks.astype(np.uint8), np.ones((1, math.ceil(width * .45)), np.uint8),
                        borderType=cv2.BORDER_CONSTANT, borderValue=0)
        skip = np.any(wide, axis=1) | (marks.sum(axis=1) >= width * .66)
        marks[skip] = False
        scans = np.zeros((3, height), dtype=np.int16)
        scans[0, start_y:end_y] = np.count_nonzero(marks & (sample < 211), axis=1)
        scans[1, start_y:end_y] = np.count_nonzero(marks[:, :(width + 1) // 2], axis=1)
        scans[2, start_y:end_y] = np.count_nonzero(marks[:, (width + 1) // 2:], axis=1)
        return scans

    evidence = []
    geometry = []
    for start in (0, 3, 6, 9):
        left, fall, spring, right = rules[start:start + 4]
        column_header = local_header(left, fall)
        first = column_header + 9 * scale
        offsets = (local_header(fall, spring) - column_header, local_header(spring, right) - column_header)
        scans = (scan_semester(fall, spring, first), scan_semester(spring, right, first))
        y = np.arange(max(4, -min(offsets), math.floor(first - nominal / 2)),
                      min(height - max(0, *offsets), math.ceil(first + nominal * 26)))
        combined = np.zeros(len(y), dtype=np.int16)
        for scan, offset in zip(scans, offsets):
            strong, credit, grade = scan[:, y + offset]
            combined += np.maximum(strong, 2 * np.minimum(credit, grade))
        weights = np.clip(combined - 4, 0, 20)
        evidence.append((y[weights > 0] - first, weights[weights > 0]))
        geometry.append((left, fall, spring, right, column_header, first, offsets, scans))

    common_pitch, _ = fit_rows(np.concatenate([item[0] for item in evidence]),
                               np.concatenate([item[1] for item in evidence]), nominal, 16, 2)

    def has_value(scan, center):
        window = scan[:, max(0, center - 5):center + 6]
        lines = np.count_nonzero(window >= 2, axis=1)
        strength = np.sum(window, axis=1)
        return bool((lines[0] >= 5 and strength[0] >= 30)
                    or (lines[1] >= 5 and strength[1] >= 18 and lines[2] >= 5 and strength[2] >= 24))

    columns = []
    top_count = 0
    bottom_count = 0
    for info, data in zip(geometry, evidence):
        left, fall, spring, right, column_header, first, offsets, scans = info
        pitch, shift = fit_rows(*data, common_pitch, 12, 4)
        last_center = min(height - 10, body_bottom - 6) - max(0, *offsets)
        lines = []
        last_active = 0
        for index in range(min(26, math.floor((last_center - first - shift) / pitch) + 1)):
            center = round(first + shift + index * pitch)
            up_center, down_center = (center + offset for offset in offsets)
            up, down = has_value(scans[0], up_center), has_value(scans[1], down_center)
            line = index + 1
            lines.append(dict(line=line, center=center, upperCenter=up_center, lowerCenter=down_center, upper=up, lower=down))
            if up or down:
                last_active = line
                top_count += int(line <= 12)
                bottom_count += int(line >= 22)
        top = max(0, column_header - round(47 * scale))
        columns.append(dict(left=left, upperLeft=fall, lowerLeft=spring, right=right, headerTop=top,
                            headerHeight=column_header - top + 1, bodyBottom=body_bottom, rowHeight=pitch,
                            lines=lines[:last_active + 1] if last_active else []))
    return columns if top_count >= 10 and top_count >= bottom_count * 3 else None


def encode(image, quality=94):
    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("JPEG encoding failed")
    return base64.b64encode(encoded).decode("ascii")


def orientation_previews(image):
    return [encode(enhance(resize_edge(rotate(image, angle), 1100)), 85) for angle in (0, 90, 180, 270)]


def preprocess(image, selected_rotation=None):
    image = resize_edge(image, MAX_EDGE)
    if selected_rotation is not None:
        image = rotate(image, selected_rotation)
        return dict(original=encode(image, 96), enhanced=encode(enhance(image)), columns=None, height=0)
    height, width = image.shape[:2]
    candidates = (0, 180) if width >= height else (90, 270)
    ratio = max(height, width) / min(height, width)
    corrected = None
    if 1.25 <= ratio <= 3.8:
        for angle in candidates:
            upright = deskew(rotate(image, angle))
            if corrected is None:
                corrected = rotate(upright, (-angle) % 360)
            grid_height = round(upright.shape[0] * GRID_WIDTH / upright.shape[1])
            gray = cv2.cvtColor(upright, cv2.COLOR_BGR2GRAY)
            reduced = cv2.resize(gray, (GRID_WIDTH, grid_height), interpolation=cv2.INTER_AREA)
            columns = read_grid(reduced)
            if not columns:
                adjusted = cv2.resize(enhance(upright), (GRID_WIDTH, grid_height), interpolation=cv2.INTER_AREA)
                columns = read_grid(adjusted)
            if columns:
                return dict(original=encode(upright, 96), enhanced=encode(enhance(upright)),
                            columns=columns, height=grid_height, previews=orientation_previews(upright))
    if corrected is None:
        corrected = deskew(image)
    return dict(original=encode(corrected, 96), enhanced=encode(enhance(corrected)), columns=None,
                height=0, previews=orientation_previews(corrected))


def main():
    cv2.setNumThreads(1)
    image = cv2.imdecode(np.frombuffer(sys.stdin.buffer.read(), np.uint8), cv2.IMREAD_COLOR)
    if image is None or min(image.shape[:2]) < 32:
        raise ValueError("Invalid transcript image")
    rotation = int(sys.argv[1]) if len(sys.argv) > 1 else None
    print(json.dumps(preprocess(image, rotation), separators=(",", ":")))


if __name__ == "__main__":
    main()
