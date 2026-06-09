import { render, screen } from '@testing-library/react'
import StatusIndicator from './StatusIndicator'

describe('StatusIndicator Component', () => {
  test('camera type icin dogru label gostermeli', () => {
    render(<StatusIndicator type="camera" status="active" />)

    expect(screen.getByText('Kamera: Aktif')).toBeInTheDocument()
  })

  test('mic type icin dogru label gostermeli', () => {
    render(<StatusIndicator type="mic" status="active" />)

    expect(screen.getByText('Mikrofon: Aktif')).toBeInTheDocument()
  })

  test('fullscreen type icin dogru label gostermeli', () => {
    render(<StatusIndicator type="fullscreen" status="active" />)

    expect(screen.getByText('Tam ekran: Açık')).toBeInTheDocument()
  })

  test('active status icin yesil dot classi vermeli', () => {
    const { container } = render(<StatusIndicator type="camera" status="active" />)

    expect(container.querySelector('.dot')).toHaveClass('dot--green')
  })

  test('inactive status icin kirmizi dot classi vermeli', () => {
    const { container } = render(<StatusIndicator type="camera" status="inactive" />)

    expect(container.querySelector('.dot')).toHaveClass('dot--red')
  })
})
