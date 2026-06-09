import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import StudentGrid from './StudentGrid'

const sessions = [
  {
    sessionId: 's1',
    studentName: 'Ali Yilmaz',
    examTitle: 'Matematik Vize',
    riskScore: 24,
    riskLevel: 'LOW',
    status: 'submitted',
  },
  {
    sessionId: 's2',
    studentName: 'Ayse Demir',
    examTitle: 'Fizik Final',
    riskScore: 78,
    riskLevel: 'HIGH',
    status: 'active',
  },
]

describe('StudentGrid Component', () => {
  test('ogrenci bilgilerini render etmeli', () => {
    render(<StudentGrid sessions={sessions} onNavigate={() => {}} />)

    expect(screen.getByText('Ali Yilmaz')).toBeInTheDocument()
    expect(screen.getByText('Ayse Demir')).toBeInTheDocument()
    expect(screen.getByText('Matematik Vize')).toBeInTheDocument()
    expect(screen.getByText('Fizik Final')).toBeInTheDocument()
  })

  test('risk durumlarini gostermeli', () => {
    render(<StudentGrid sessions={sessions} onNavigate={() => {}} />)

    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('Tamamlandı')).toBeInTheDocument()
    expect(screen.getByText('Yüksek Risk')).toBeInTheDocument()
  })

  test('rapor butonuna tiklaninca onNavigate calismali', async () => {
    const mockNavigate = vi.fn()

    render(<StudentGrid sessions={sessions} onNavigate={mockNavigate} />)

    await userEvent.click(screen.getAllByText('Rapor')[0])

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith('report', { sessionId: 's1' })
  })

  test('bos liste icin bos durum gostermeli', () => {
    render(<StudentGrid sessions={[]} onNavigate={() => {}} />)

    expect(screen.getByText('Henüz raporlanmış oturum yok.')).toBeInTheDocument()
  })
})
