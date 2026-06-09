import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import authService from '../services/auth'
import Login from './Login'

vi.mock('../services/auth', () => ({
  default: {
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}))

describe('Login Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authService.login.mockResolvedValue({ success: true })
    authService.register.mockResolvedValue({ success: true })
    authService.forgotPassword.mockResolvedValue({ success: true })
    authService.getCurrentUser.mockReturnValue({ id: 'u1', role: 'student' })
  })

  test('login ekrani baslangicta render edilmeli', () => {
    render(<Login onNavigate={() => {}} />)

    expect(screen.getByText('AI Destekli Online Sınav Sistemi')).toBeInTheDocument()
    expect(screen.getByLabelText('E-posta')).toBeInTheDocument()
    expect(screen.getByLabelText('Şifre')).toBeInTheDocument()
    expect(screen.getByText('Giriş Yap')).toBeInTheDocument()
    expect(screen.getByText('Kayıt Ol')).toBeInTheDocument()
    expect(screen.getByText('Yardım / Şifremi Unuttum')).toBeInTheDocument()
  })

  test('Kayit Ol butonuna basinca kayit ekranina gecmeli', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={() => {}} />)

    await user.click(screen.getByText('Kayıt Ol'))

    expect(screen.getByText('Kayıt Oluştur')).toBeInTheDocument()
    expect(screen.getByLabelText('Ad Soyad')).toBeInTheDocument()
    expect(screen.getByLabelText('Rol')).toBeInTheDocument()
    expect(screen.getByText('Hesap Oluştur')).toBeInTheDocument()
    expect(screen.getByText('Vazgeç')).toBeInTheDocument()
    expect(screen.queryByText('Yardım / Şifremi Unuttum')).not.toBeInTheDocument()
  })

  test('Vazgec butonuna basinca tekrar login ekranina donmeli', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={() => {}} />)

    await user.click(screen.getByText('Kayıt Ol'))
    await user.click(screen.getByText('Vazgeç'))

    expect(screen.getByText('AI Destekli Online Sınav Sistemi')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ad Soyad')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Rol')).not.toBeInTheDocument()
  })

  test('Giris Yap butonuna basinca role gore dashboard yonlendirmesi calismali', async () => {
    const user = userEvent.setup()
    const mockNavigate = vi.fn()
    authService.getCurrentUser.mockReturnValue({ id: 'u2', role: 'instructor' })

    render(<Login onNavigate={mockNavigate} />)

    await user.type(screen.getByLabelText('E-posta'), 'egitmen@example.com')
    await user.type(screen.getByLabelText('Şifre'), 'secret123')
    await user.click(screen.getByText('Giriş Yap'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1))
    expect(authService.login).toHaveBeenCalledWith({
      email: 'egitmen@example.com',
      password: 'secret123',
    })
    expect(mockNavigate).toHaveBeenCalledWith('instructor-dashboard')
  })

  test('kayit ekraninda Hesap Olustur butonuna basinca ogrenciyi ogrenci ekranina yollar', async () => {
    const user = userEvent.setup()
    const mockNavigate = vi.fn()

    render(<Login onNavigate={mockNavigate} />)

    await user.click(screen.getByText('Kayıt Ol'))
    await user.type(screen.getByLabelText('Ad Soyad'), 'Ali Yilmaz')
    await user.type(screen.getByLabelText('E-posta'), 'ali@example.com')
    await user.type(screen.getByLabelText('Şifre'), 'secret123')
    await user.click(screen.getByText('Hesap Oluştur'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1))
    expect(authService.register).toHaveBeenCalledWith({
      name: 'Ali Yilmaz',
      email: 'ali@example.com',
      password: 'secret123',
      role: 'student',
      instructorCode: '',
    })
    expect(mockNavigate).toHaveBeenCalledWith('student-home')
  })
})
