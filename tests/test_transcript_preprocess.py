import importlib.util
from pathlib import Path
import unittest

import cv2
import numpy as np


spec = importlib.util.spec_from_file_location(
    "transcript_preprocess", Path(__file__).resolve().parents[1] / "scripts" / "transcript-preprocess.py"
)
preprocess = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preprocess)


def sample_form():
    form = np.full((878, 1237, 3), 252, np.uint8)
    rules = preprocess.RULES
    for x in rules:
        cv2.line(form, (x, 168), (x, 601), (160, 160, 160), 1)
    for y in (174, 207, 600):
        cv2.line(form, (39, y), (1190, y), (160, 160, 160), 1)
    for column in range(4):
        for row in range(9):
            y = 216 + round(row * (13.4 if column == 3 else 14))
            for semester in range(2):
                x = rules[column * 3 + semester + 1] + 10
                if (row + semester) % 3 != 2:
                    for offset in (0, 26):
                        cv2.rectangle(form, (x + offset, y - 4), (x + offset + 6, y + 4), (135, 135, 135), -1)
                else:
                    cv2.line(form, (x, y), (x + 7, y), (140, 140, 140), 1)
    return form


class TranscriptPreprocessTest(unittest.TestCase):
    def test_corrects_sideways_and_skewed_form_with_independent_semester_cells(self):
        form = sample_form()
        for angle in (0, 2.3):
            with self.subTest(angle=angle):
                matrix = cv2.getRotationMatrix2D((619, 439), angle, 1)
                tilted = cv2.warpAffine(form, matrix, (1237, 878), borderValue=(255, 255, 255))
                result = preprocess.preprocess(cv2.rotate(tilted, cv2.ROTATE_90_COUNTERCLOCKWISE))
                self.assertEqual(result["height"], 878)
                self.assertEqual(len(result["columns"]), 4)
                for column in result["columns"]:
                    marks = [(line["upper"], line["lower"]) for line in column["lines"][:9]]
                    self.assertEqual(marks, [(row % 3 != 2, (row + 1) % 3 != 2) for row in range(9)])
                self.assertLess(result["columns"][-1]["rowHeight"], result["columns"][0]["rowHeight"])

    def test_provides_opencv_previews_for_an_unrecognized_layout(self):
        result = preprocess.preprocess(np.full((420, 310, 3), 255, np.uint8))
        self.assertIsNone(result["columns"])
        self.assertEqual(len(result["previews"]), 4)


if __name__ == "__main__":
    unittest.main()
