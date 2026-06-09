import { render, screen } from '@testing-library/react'
import ExamTimer from './ExamTimer'

describe('ExamTimer Component', () => {

  test('verilen süreyi ekranda göstermeli', () => {
    render(<ExamTimer time="00:45:12" />)

    expect(screen.getByText('00:45:12')).toBeInTheDocument()
  })

  test('exam-timer classına sahip olmalı', () => {
    render(<ExamTimer time="01:20:00" />)

    const timer = screen.getByText('01:20:00')

    expect(timer).toHaveClass('exam-timer')
  })

})