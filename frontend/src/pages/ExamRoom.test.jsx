import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import ExamRoom from './ExamRoom'

const proctoringMock = {
  videoRef: { current: null },
  cameraActive: true,
  cameraError: null,
  stream: null,
  faceResult: { face_detected: true },
  gazeResult: { gaze: 'screen' },
  riskData: { risk_score: 12, risk_level: 'LOW', event_counts: {} },
  isAnalyzing: false,
  aiHealth: [],
  aiError: 'Basarili',
  isTabVisible: true,
  isFullscreen: true,
  violations: { tabSwitch: 0, fullscreenExit: 0 },
  violationCount: 0,
  requestFullscreen: vi.fn(),
  startProctoring: vi.fn(() => Promise.resolve()),
  stopProctoring: vi.fn(),
}

vi.mock('../hooks/useProctoring.js', () => ({
  default: vi.fn(() => proctoringMock),
}))

vi.mock('../services/exam.js', () => ({
  default: {
    startSession: vi.fn(() => Promise.resolve({
      exam: { _id: 'demo-exam', title: 'Demo Sinav', duration: 45, accessCode: 'DEMO01' },
      session: { sessionId: 'session-1', remainingSeconds: 2700 },
    })),
    joinByCode: vi.fn(),
    finishSession: vi.fn(() => Promise.resolve({ success: true })),
    submitAnswer: vi.fn(() => Promise.resolve({ success: true })),
  },
}))

vi.mock('../services/proctoring.js', () => ({
  default: {
    startSession: vi.fn(() => Promise.resolve({ success: true })),
    completeSession: vi.fn(() => Promise.resolve({ success: true })),
    sendEvent: vi.fn(() => Promise.resolve({ risk_score: 12 })),
  },
}))

vi.mock('../services/auth.js', () => ({
  default: {
    getCurrentUser: vi.fn(() => ({ id: 'student-1', name: 'Test Ogrenci', role: 'student' })),
    getUserRole: vi.fn(() => 'student'),
    logout: vi.fn(),
  },
}))

describe('ExamRoom Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('sinav baslangic ekrani ve kod alani render edilmeli', () => {
    render(<ExamRoom onNavigate={() => {}} />)

    expect(screen.getByText('Sınava Başlamadan Önce')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Örn: DEMO01')).toBeInTheDocument()
    expect(screen.getByText('Sınavı Başlat')).toBeInTheDocument()
  })

  test('sinav kodu buyuk harfe cevrilmeli', async () => {
    render(<ExamRoom onNavigate={() => {}} />)

    const input = screen.getByPlaceholderText('Örn: DEMO01')
    await userEvent.type(input, 'abc123')

    expect(input).toHaveValue('ABC123')
  })

  test('baslatinca soru ekrani ve durumlar gorunmeli', async () => {
    render(<ExamRoom onNavigate={() => {}} />)

    await userEvent.click(screen.getByText('Sınavı Başlat'))

    expect(await screen.findByText('Sınav: Demo Sinav')).toBeInTheDocument()
    expect(screen.getByText('00:45:00')).toBeInTheDocument()
    expect(screen.getByText('Kamera: Aktif')).toBeInTheDocument()
    expect(screen.getByText('Yüz: Algılandı')).toBeInTheDocument()
    expect(screen.getByText('Soru 1 / 2')).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
  })

  test('onceki butonu ilk soruda disabled olmali', async () => {
    render(<ExamRoom onNavigate={() => {}} />)

    await userEvent.click(screen.getByText('Sınavı Başlat'))

    expect(await screen.findByText('Önceki')).toBeDisabled()
  })

  test('son soruda sinavi bitir butonu oturumu kapatmali', async () => {
    const mockNavigate = vi.fn()
    render(<ExamRoom onNavigate={mockNavigate} />)

    await userEvent.click(screen.getByText('Sınavı Başlat'))
    await userEvent.click(await screen.findByText('Sonraki'))
    await userEvent.click(await screen.findByText('Sınavı Bitir'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('student-home'))
  })
})
