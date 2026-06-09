import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'

import AdminPanel from './AdminPanel'

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }) => <div data-testid="qr-code">{value}</div>,
}))

vi.mock('../services/auth.js', () => ({
  default: {
    getCurrentUser: vi.fn(),
    getAllUsers: vi.fn(),
    listInstructorCodes: vi.fn(),
    generateInstructorCode: vi.fn(),
  },
}))

import authService from '../services/auth.js'

const instructors = [
  {
    id: 'i1',
    name: 'Ali Eğitmen',
    email: 'ali@test.com',
    createdAt: '2026-06-09T10:00:00.000Z',
  },
]

const students = [
  {
    id: 's1',
    name: 'Ayşe Öğrenci',
    email: 'ayse@test.com',
    createdAt: '2026-06-08T10:00:00.000Z',
  },
]

const codes = [
  {
    _id: 'c1',
    code: 'ABC123',
    isUsed: false,
    usedBy: null,
  },
  {
    _id: 'c2',
    code: 'USED01',
    isUsed: true,
    usedBy: {
      name: 'Mehmet Eğitmen',
    },
  },
]

describe('AdminPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    authService.getCurrentUser.mockReturnValue({
      id: 'admin-1',
      role: 'admin',
    })

    authService.getAllUsers.mockImplementation((role) => {
      if (role === 'instructor') {
        return Promise.resolve({
          data: {
            users: instructors,
          },
        })
      }

      if (role === 'student') {
        return Promise.resolve({
          data: {
            users: students,
          },
        })
      }

      return Promise.resolve({
        data: {
          users: [],
        },
      })
    })

    authService.listInstructorCodes.mockResolvedValue({
      data: {
        codes,
      },
    })

    authService.generateInstructorCode.mockResolvedValue({
      data: {
        code: {
          code: 'NEW999',
        },
      },
    })

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    })
  })

  test('admin panel temel alanları render edilmeli', async () => {
    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Çıkış')).toBeInTheDocument()

    expect(screen.getByText('Eğitmenler')).toBeInTheDocument()
    expect(screen.getByText('Öğrenciler')).toBeInTheDocument()
    expect(screen.getByText('Eğitmen Oluştur')).toBeInTheDocument()

    expect(await screen.findByText('Ali Eğitmen')).toBeInTheDocument()
    expect(screen.getByText('ali@test.com')).toBeInTheDocument()
  })

  test('admin olmayan kullanıcı dashboarda yönlendirilmeli', async () => {
    const mockNavigate = vi.fn()

    authService.getCurrentUser.mockReturnValue({
      id: 'user-1',
      role: 'student',
    })

    render(<AdminPanel onNavigate={mockNavigate} onLogout={() => {}} />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('instructor-dashboard')
    })
  })

  test('Dashboard butonu instructor-dashboard sayfasına yönlendirmeli', async () => {
    const mockNavigate = vi.fn()

    render(<AdminPanel onNavigate={mockNavigate} onLogout={() => {}} />)

    await userEvent.click(screen.getByText('Dashboard'))

    expect(mockNavigate).toHaveBeenCalledWith('instructor-dashboard')
  })

  test('Çıkış butonu onLogout çağırmalı', async () => {
    const mockLogout = vi.fn()

    render(<AdminPanel onNavigate={() => {}} onLogout={mockLogout} />)

    await userEvent.click(screen.getByText('Çıkış'))

    expect(mockLogout).toHaveBeenCalledTimes(1)
  })

  test('eğitmen arama filtreleme yapmalı', async () => {
    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    expect(await screen.findByText('Ali Eğitmen')).toBeInTheDocument()

    await userEvent.type(
      screen.getByPlaceholderText('Ad veya e-posta ara...'),
      'olmayan'
    )

    expect(screen.getByText('Sonuç bulunamadı.')).toBeInTheDocument()
  })

  test('Öğrenciler tabı öğrenci listesini göstermeli', async () => {
    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    await userEvent.click(screen.getByText('Öğrenciler'))

    expect(await screen.findByText('Ayşe Öğrenci')).toBeInTheDocument()
    expect(screen.getByText('ayse@test.com')).toBeInTheDocument()
  })

  test('öğrenci arama filtreleme yapmalı', async () => {
    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    await userEvent.click(screen.getByText('Öğrenciler'))

    expect(await screen.findByText('Ayşe Öğrenci')).toBeInTheDocument()

    await userEvent.type(
      screen.getByPlaceholderText('Ad veya e-posta ara...'),
      'xyz'
    )

    expect(screen.getByText('Sonuç bulunamadı.')).toBeInTheDocument()
  })

  test('Eğitmen Kodu Üret tabında kodlar listelenmeli', async () => {
    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    await userEvent.click(screen.getByText('Eğitmen Oluştur'))

    expect(await screen.findByText('Eğitmen Davet Kodu Üret')).toBeInTheDocument()
    expect(screen.getByText('Davet Kodları')).toBeInTheDocument()

    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('USED01')).toBeInTheDocument()
    expect(screen.getByText('Aktif')).toBeInTheDocument()
    expect(screen.getByText('Kullanıldı')).toBeInTheDocument()
    expect(screen.getByText('Mehmet Eğitmen')).toBeInTheDocument()
  })

  test('yeni eğitmen kodu üretilebilmeli', async () => {
    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    await userEvent.click(screen.getByText('Eğitmen Oluştur'))

    const button = await screen.findByText('Yeni Davet Kodu Üret')
    await userEvent.click(button)

    expect(authService.generateInstructorCode).toHaveBeenCalledTimes(1)

    expect(await screen.findAllByText('NEW999')).toHaveLength(2)
    expect(screen.getByTestId('qr-code')).toHaveTextContent('NEW999')
  })

  test('üretilen kod kopyalanmalı', async () => {
    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    await userEvent.click(screen.getByText('Eğitmen Oluştur'))

    const button = await screen.findByText('Yeni Davet Kodu Üret')
    await userEvent.click(button)

    expect(await screen.findAllByText('NEW999')).toHaveLength(2)

    await userEvent.click(screen.getByText('Kopyala'))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('NEW999')
    expect(screen.getByText('✓ Kopyalandı')).toBeInTheDocument()
  })

  test('kullanıcılar yüklenemezse hata mesajı göstermeli', async () => {
    authService.getAllUsers.mockRejectedValue(new Error('Kullanıcılar alınamadı'))

    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    expect(await screen.findByText('Kullanıcılar alınamadı')).toBeInTheDocument()
  })

  test('kod üretme hatası gösterilmeli', async () => {
    authService.generateInstructorCode.mockRejectedValue(
      new Error('Kod üretilemedi')
    )

    render(<AdminPanel onNavigate={() => {}} onLogout={() => {}} />)

    await userEvent.click(screen.getByText('Eğitmen Oluştur'))

    const button = await screen.findByText('Yeni Davet Kodu Üret')
    await userEvent.click(button)

    expect(await screen.findByText('Kod üretilemedi')).toBeInTheDocument()
  })
})
