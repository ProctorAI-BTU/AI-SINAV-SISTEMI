import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import PreExamCheck from "./PreExamCheck";
import proctoringService from "../services/proctoring";

vi.mock("../services/proctoring", () => ({
  default: {
    precheckFace: vi.fn(),
  },
}));

describe("PreExamCheck Page", () => {
  let mockStream;
  let originalCreateElement;
  let user;

  beforeEach(() => {
    user = userEvent.setup();

    mockStream = {
      getTracks: vi.fn(() => [{ stop: vi.fn() }]),
      getVideoTracks: vi.fn(() => [{}]),
      getAudioTracks: vi.fn(() => [{}]),
    };

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(() => Promise.resolve(mockStream)),
      },
    });

    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.documentElement,
    });

    document.documentElement.requestFullscreen = vi.fn(() =>
      Promise.resolve()
    );

    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());

    Object.defineProperty(HTMLVideoElement.prototype, "readyState", {
      configurable: true,
      get: () => 4,
    });

    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
      configurable: true,
      get: () => 640,
    });

    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
      configurable: true,
      get: () => 480,
    });

    originalCreateElement = document.createElement.bind(document);

    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: vi.fn(() => ({
            drawImage: vi.fn(),
          })),
          toDataURL: vi.fn(() => "data:image/jpeg;base64,MOCK_FRAME"),
        };
      }

      return originalCreateElement(tag);
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("başlangıç ekranı render edilmeli", () => {
    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    expect(screen.getByText("Sınav Öncesi Kontroller")).toBeInTheDocument();
    expect(screen.getByText("Kontrolleri Başlat")).toBeInTheDocument();
    expect(screen.getByText("Sınava Geç")).toBeInTheDocument();
  });

  test("exam title gösterilmeli", () => {
    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    expect(screen.getByText("Demo Sınavı")).toBeInTheDocument();
  });

  test("başlangıçta sınava geç butonu disabled olmalı", () => {
    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    expect(screen.getByText("Sınava Geç")).toBeDisabled();
  });

  test("kamera ve mikrofon erişimi istenmeli", async () => {
    proctoringService.precheckFace.mockResolvedValue({
      face_detected: true,
    });

    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    await user.click(screen.getByText("Kontrolleri Başlat"));

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: 640,
          height: 480,
          facingMode: "user",
        },
        audio: true,
      });
    });
  });

  test("face check başarılı olursa sınava geç aktifleşmeli", async () => {
    proctoringService.precheckFace.mockResolvedValue({
      face_detected: true,
    });

    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    await user.click(screen.getByText("Kontrolleri Başlat"));

    await screen.findByText("Yüz algılandı. Sınava geçebilirsiniz.");

    expect(proctoringService.precheckFace).toHaveBeenCalledWith("MOCK_FRAME");

    expect(screen.getByText("Sınava Geç")).not.toBeDisabled();
  });

  test("nested face response başarılı olursa sınava geç aktifleşmeli", async () => {
    proctoringService.precheckFace.mockResolvedValue({
      face: {
        face_detected: true,
      },
    });

    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    await user.click(screen.getByText("Kontrolleri Başlat"));

    await screen.findByText("Yüz algılandı. Sınava geçebilirsiniz.");

    expect(screen.getByText("Sınava Geç")).not.toBeDisabled();
  });

  test("face check başarısız olursa hata mesajı gösterilmeli", async () => {
    proctoringService.precheckFace.mockResolvedValue({
      face_detected: false,
    });

    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    await user.click(screen.getByText("Kontrolleri Başlat"));

    await screen.findByText(
      "Yüz algılanmadı. Lütfen kameraya net görünecek şekilde tekrar deneyin."
    );

    expect(screen.getByText("Sınava Geç")).toBeDisabled();
  });

  test("kamera veya mikrofon izni alınamazsa hata mesajı gösterilmeli", async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(
      new Error("Permission denied")
    );

    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={() => {}}
      />
    );

    await user.click(screen.getByText("Kontrolleri Başlat"));

    await screen.findByText("Kamera veya mikrofon izni alınamadı.");

    expect(screen.getByText("Sınava Geç")).toBeDisabled();
  });

  test("tüm kontroller başarılıysa sınava geç butonu onComplete çağırmalı", async () => {
    proctoringService.precheckFace.mockResolvedValue({
      face_detected: true,
    });

    const onComplete = vi.fn();

    render(
      <PreExamCheck
        examTitle="Demo Sınavı"
        onComplete={onComplete}
      />
    );

    await user.click(screen.getByText("Kontrolleri Başlat"));

    await screen.findByText("Yüz algılandı. Sınava geçebilirsiniz.");

    await user.click(screen.getByText("Sınava Geç"));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
