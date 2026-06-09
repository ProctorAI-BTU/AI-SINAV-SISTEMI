import { render, screen } from '@testing-library/react'
import QuestionCard from './QuestionCard'

const mockQuestion = {
  _id: "q1",
  text: "Aşağıdaki integrali çözünüz: ∫x² dx",
  options: [
    "A) x³/3 + C",
    "B) x³ + C",
    "C) 2x + C",
    "D) x²/2 + C"
  ]
};

describe('QuestionCard Component', () => {

  test('soru metnini render etmeli', () => {
    render(<QuestionCard question={mockQuestion} selectedOption={null} onOptionSelect={() => {}} />)

    expect(
      screen.getByText('Aşağıdaki integrali çözünüz: ∫x² dx')
    ).toBeInTheDocument()
  })

  test('tüm seçenekleri göstermeli', () => {
    render(<QuestionCard question={mockQuestion} selectedOption={null} onOptionSelect={() => {}} />)

    expect(screen.getByText('A) x³/3 + C')).toBeInTheDocument()
    expect(screen.getByText('B) x³ + C')).toBeInTheDocument()
    expect(screen.getByText('C) 2x + C')).toBeInTheDocument()
    expect(screen.getByText('D) x²/2 + C')).toBeInTheDocument()
  })

  test('4 adet radio input render etmeli', () => {
    render(<QuestionCard question={mockQuestion} selectedOption={null} onOptionSelect={() => {}} />)

    const radioButtons = screen.getAllByRole('radio')

    expect(radioButtons).toHaveLength(4)
  })

  test('tüm radio buttonlar aynı question name değerine sahip olmalı', () => {
    render(<QuestionCard question={mockQuestion} selectedOption={null} onOptionSelect={() => {}} />)

    const radioButtons = screen.getAllByRole('radio')

    radioButtons.forEach((radio) => {
      expect(radio).toHaveAttribute('name', 'q_q1')
    })
  })

})