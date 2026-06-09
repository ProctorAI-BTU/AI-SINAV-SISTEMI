"""Hybrid face detection engine: MediaPipe first, OpenCV Haar fallback."""

import logging

import cv2
import numpy as np

from .utils import bgr_to_rgb, decode_base64_image, normalize_confidence, validate_image

logger = logging.getLogger(__name__)

try:
    import mediapipe as mp
    _mp_fm = mp.solutions.face_mesh

    MEDIAPIPE_AVAILABLE = True
    logger.info("MediaPipe FaceMesh loaded for face detection.")
except Exception as exc:
    MEDIAPIPE_AVAILABLE = False
    logger.warning(f"MediaPipe could not be loaded ({exc}); Haar fallback is active.")


class FaceDetector:
    """Detect whether an exam camera frame contains zero, one, or multiple faces."""

    def __init__(self):
        self._mp_detector = None
        if MEDIAPIPE_AVAILABLE:
            try:
                self._mp_detector = _mp_fm.FaceMesh(
                    max_num_faces=2,
                    refine_landmarks=False,
                    min_detection_confidence=0.85,
                    min_tracking_confidence=0.65,
                )
                logger.info("MediaPipe FaceMesh initialized.")
            except Exception as exc:
                logger.warning(f"MediaPipe FaceMesh could not initialize: {exc}")

        self._haar = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        if self._haar.empty():
            logger.warning("OpenCV Haar cascade could not be loaded.")

    def detect(self, image_base64: str) -> dict:
        img = decode_base64_image(image_base64)

        if not validate_image(img):
            return self._result(
                False,
                False,
                0,
                0.0,
                "FACE_NOT_FOUND",
                "Image is invalid or could not be decoded.",
            )

        if self._mp_detector is not None:
            mp_result = self._run_mediapipe(img)
            # MediaPipe sorunsuz çalıştıysa sonucunu dön (0 yüz bulsa bile). 
            # Eğer 0 yüz bulduğunda Haar'a düşersek, Haar arka plandaki gölgeleri yüz sanıp yanlış alarm veriyor.
            if mp_result is not None:
                return mp_result

        return self._run_haar(img)

    def _run_mediapipe(self, img: np.ndarray) -> dict | None:
        """Run MediaPipe. Return None only when processing fails."""
        try:
            results = self._mp_detector.process(bgr_to_rgb(img))
        except Exception as exc:
            logger.warning(f"MediaPipe processing failed: {exc}")
            return None

        if not results.multi_face_landmarks:
            return self._result(
                False,
                False,
                0,
                0.0,
                "FACE_NOT_FOUND",
                "No face detected.",
            )

        valid_bboxes = []
        for face_landmarks in results.multi_face_landmarks:
            x_coords = [lm.x for lm in face_landmarks.landmark]
            y_coords = [lm.y for lm in face_landmarks.landmark]
            
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            width_ratio = max_x - min_x
            height_ratio = max_y - min_y

            if width_ratio > 0.15 and height_ratio > 0.15:
                valid_bboxes.append((min_x, min_y, max_x, max_y))

        # Aynı yüze ait çift (duplicate) tespiti önleme (Mesafe Bazlı NMS)
        # Hareket bulanıklığı sırasında aynı yüz iki kez tespit edilirse engeller.
        final_faces = []
        for bbox in valid_bboxes:
            is_duplicate = False
            cx1, cy1 = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
            
            for f_bbox in final_faces:
                cx2, cy2 = (f_bbox[0] + f_bbox[2]) / 2, (f_bbox[1] + f_bbox[3]) / 2
                dist = ((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2) ** 0.5
                
                # İki yüzün merkezi ekran boyutunun %35'inden daha yakınsa aynı yüzdür (çok daha esnek yapıldı)
                if dist < 0.35:
                    is_duplicate = True
                    break
                    
            if not is_duplicate:
                final_faces.append(bbox)

        valid_faces = len(final_faces)

        if valid_faces == 0:
            return self._result(
                False,
                False,
                0,
                0.0,
                "FACE_NOT_FOUND",
                "No valid face detected (too small or none).",
            )

        confidence = 0.9  # FaceMesh doesn't provide a single confidence score easily

        if valid_faces == 1:
            return self._result(
                True,
                False,
                1,
                confidence,
                "FACE_OK",
                f"Single face detected. confidence={confidence:.2f}",
            )

        return self._result(
            True,
            True,
            valid_faces,
            confidence,
            "MULTIPLE_FACE_DETECTED",
            f"{valid_faces} faces detected.",
        )

    def _run_haar(self, img: np.ndarray) -> dict:
        """OpenCV Haar Cascade fallback."""
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = self._haar.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(60, 60),
            )
        except Exception as exc:
            logger.error(f"Haar detection failed: {exc}")
            return self._result(
                False,
                False,
                0,
                0.0,
                "FACE_NOT_FOUND",
                f"Image processing failed: {exc}",
            )

        count = len(faces)
        if count == 0:
            return self._result(False, False, 0, 0.0, "FACE_NOT_FOUND", "No face detected.")

        if count == 1:
            x, y, w, h = faces[0]
            area_ratio = (w * h) / (img.shape[0] * img.shape[1])
            confidence = normalize_confidence(min(area_ratio * 8, 0.8))
            return self._result(
                True,
                False,
                1,
                confidence,
                "FACE_OK",
                f"Single face detected by Haar. confidence={confidence:.2f}",
            )

        return self._result(
            True,
            True,
            count,
            0.85,
            "MULTIPLE_FACE_DETECTED",
            f"{count} faces detected by Haar.",
        )

    @staticmethod
    def _result(
        detected: bool,
        multiple: bool,
        count: int,
        confidence: float,
        event: str,
        message: str,
    ) -> dict:
        return {
            "face_detected": detected,
            "multiple_faces": multiple,
            "face_count": count,
            "confidence": confidence,
            "event_type": event,
            "message": message,
        }


detector = FaceDetector()
