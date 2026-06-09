import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import ReportPage from './ReportDetail'

vi.mock('react-chartjs-2', () => ({
  Line: () => null,
}))

const report = {
  sessionId: 'S12345',
  studentName: 'Ali Yilmaz',
  examTitle: 'Matematik Vize',
  riskScore: 68,
  riskLevel: 'MEDIUM',
  riskLabel: 'Orta',
  eventCounts: { GAZE_AWAY: 1 },
  summary: {
    face: 1,
    multipleFace: 0,
    gaze: 3,
    audio: 1,
    objects: 1,
    tab: 2,
    fullscreen: 1,
  },
  timeline: [
    {
      id: 'e1',
      eventType: 'FULLSCREEN_EXIT',
      label: 'Tam ekrandan cikildi',
      message: '5 saniye',
      riskScore: 20,
      timestamp: '2026-05-17T10:00:00.000Z',
    },
    {
      id: 'e2',
      eventType: 'GAZE_AWAY',
      label: 'Bakis ekran disina kaydi',
      message: '8 saniye',
      riskScore: 68,
      timestamp: '2026-05-17T10:01:00.000Z',
    },
  ],
}

vi.mock('../services/reporting.js', () => ({
  default: {
    getReports: vi.fn(() => Promise.resolve([report])),
    getReport: vi.fn(() => Promise.resolve(report)),
  },
}))

describe('ReportPage', () => {
  test('sayfa basligi ve ogrenci bilgileri render edilmeli', async () => {
    render(<ReportPage onNavigate={() => {}} sessionId="S12345" />)

    expect(screen.getByText('Risk Raporu')).toBeInTheDocument()
    expect(await screen.findByText('Risk Raporu - Oturum #S12345')).toBeInTheDocument()
    expect(screen.getByText('Ali Yilmaz')).toBeInTheDocument()
    expect(screen.getByText('Matematik Vize')).toBeInTheDocument()
  })

  test('genel risk bilgileri render edilmeli', async () => {
    render(<ReportPage onNavigate={() => {}} sessionId="S12345" />)

    expect(await screen.findByText('68')).toBeInTheDocument()
    expect(screen.getByText('(Orta Risk)')).toBeInTheDocument()
  })

  test('ihlal ozeti bilgileri render edilmeli', async () => {
    render(<ReportPage onNavigate={() => {}} sessionId="S12345" />)

    expect(await screen.findByText('Tam ekran ihlali:')).toBeInTheDocument()
    expect(screen.getByText('Sekme degisimi:')).toBeInTheDocument()
    expect(screen.getByText('Supheli ses:')).toBeInTheDocument()
    expect(screen.getByText('Bakis kaybi:')).toBeInTheDocument()
    expect(screen.getByText('Telefon / nesne:')).toBeInTheDocument()
  })

  test('timeline eventleri render edilmeli', async () => {
    render(<ReportPage onNavigate={() => {}} sessionId="S12345" />)

    expect(await screen.findByText(/Tam ekrandan cikildi/)).toBeInTheDocument()
    expect(screen.getByText(/Bakis ekran disina kaydi/)).toBeInTheDocument()
  })

  test('aksiyon butonlari render edilmeli', async () => {
    render(<ReportPage onNavigate={() => {}} sessionId="S12345" />)

    expect(await screen.findByText('JSON Disa Aktar')).toBeInTheDocument()
    expect(screen.getByText('Oturumlari Goster')).toBeInTheDocument()
  })

  test('geri don butonu onNavigate calistirmali', async () => {
    const mockNavigate = vi.fn()

    render(<ReportPage onNavigate={mockNavigate} sessionId="S12345" />)

    await userEvent.click(screen.getByText('Geri Don'))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('admin-dashboard')
  })
})
