import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { PaginaProvisoria } from '../components/PaginaProvisoria'
import { ErroApi, api } from '../lib/api'

// /entrar: o anfitrião cola ou abre o link secreto que recebeu ao criar o evento.
export function HostSignInPage() {
  return (
    <PaginaProvisoria
      titulo="Acesso do anfitrião"
      descricao="Abra o link secreto que você recebeu ao criar o evento. Quem tem esse link administra o evento."
      issue={41}
      links={[
        { para: '/criar', rotulo: 'Criar uma câmera' },
        { para: '/eventos', rotulo: 'Meus eventos' },
      ]}
    />
  )
}

// /anfitriao#<token>: guarda o acesso neste aparelho e leva ao painel do evento.
export function HostLinkPage() {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const token = hash.slice(1)
    if (!token) {
      navigate('/entrar', { replace: true })
      return
    }
    api
      .entrarComoAnfitriao(token)
      .then((evento) => navigate(`/eventos/${evento.id}`, { replace: true }))
      .catch((e: unknown) => setErro(e instanceof ErroApi ? e.message : 'Não foi possível abrir este link.'))
  }, [hash, navigate])

  return (
    <PaginaProvisoria
      titulo={erro ? 'Link inválido' : 'Abrindo o evento'}
      descricao={erro ?? 'Guardando o acesso de anfitrião neste aparelho.'}
      issue={41}
      links={erro ? [{ para: '/entrar', rotulo: 'Tentar outro link' }] : []}
    />
  )
}
