import { render, screen } from '@testing-library/react'
import AlertFeed from './AlertFeed'

describe('AlertFeed Component', () => {
  const stats = { activeExams: 3, activeSessions: 48, criticalAlerts: 4 }

  test('istatistik degerlerini render etmeli', () => {
    render(<AlertFeed stats={stats} />)

    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('48')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  test('istatistik labellarini gostermeli', () => {
    render(<AlertFeed stats={stats} />)

    expect(screen.getByText('Bugunku Aktif Sinavlar')).toBeInTheDocument()
    expect(screen.getByText('Aktif Oturumlar')).toBeInTheDocument()
    expect(screen.getByText('Kritik Alarm')).toBeInTheDocument()
  })

  test('kritik alarm danger classina sahip olmali', () => {
    render(<AlertFeed stats={stats} />)

    expect(screen.getByText('4')).toHaveClass('stat-number--danger')
  })
})
