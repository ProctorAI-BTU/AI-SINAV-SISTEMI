import { render, screen } from '@testing-library/react'
import RiskBadge from './RiskBadge'

describe('RiskBadge Component', () => {

  test('score değerini ekranda göstermeli', () => {
    render(<RiskBadge score="85" level="high" />)

    expect(screen.getByText('85')).toBeInTheDocument()
  })

  test('level propuna göre doğru class vermeli', () => {
    render(<RiskBadge score="90" level="critical" />)

    const badge = screen.getByText('90')

    expect(badge).toHaveClass('risk-badge')
    expect(badge).toHaveClass('risk-badge--critical')
  })

  test('normal level classını uygulamalı', () => {
    render(<RiskBadge score="20" level="normal" />)

    const badge = screen.getByText('20')

    expect(badge).toHaveClass('risk-badge--normal')
  })

})