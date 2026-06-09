import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import SubmitButton from './SubmitButton'

describe('SubmitButton Component', () => {
  test('buton metnini render etmeli', () => {
    render(<SubmitButton onSubmit={() => {}} />)

    expect(screen.getByText('Sınavı Bitir')).toBeInTheDocument()
  })

  test('buton dogru classlara sahip olmali', () => {
    render(<SubmitButton onSubmit={() => {}} />)

    const button = screen.getByRole('button')

    expect(button).toHaveClass('btn-exam')
    expect(button).toHaveClass('btn-exam--submit')
  })

  test('butona tiklaninca onSubmit calismali', async () => {
    const mockSubmit = vi.fn()

    render(<SubmitButton onSubmit={mockSubmit} />)

    await userEvent.click(screen.getByRole('button'))

    expect(mockSubmit).toHaveBeenCalledTimes(1)
  })

  test('disabled durumda bitiriliyor metni gostermeli', () => {
    render(<SubmitButton onSubmit={() => {}} disabled />)

    expect(screen.getByText('Bitiriliyor...')).toBeDisabled()
  })
})
