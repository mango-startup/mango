import type { Evento } from './api'
import { dataPorExtenso, quando } from './datas'

/** Uma linha que diz em que pé o evento está e o que vem a seguir. */
export function situacao(e: Evento): { texto: string; ativo: boolean } {
  const revelacao = e.revelacao_manual || !e.revelacao_em ? 'quando você decidir' : quando(e.revelacao_em)
  switch (e.estado) {
    case 'rascunho':
      return { texto: 'Rascunho', ativo: false }
    case 'aguardando_pagamento':
      return { texto: 'Aguardando pagamento', ativo: false }
    case 'pronto':
      return { texto: e.captura_inicio ? `Pronto · a câmera abre ${quando(e.captura_inicio)}` : 'Pronto', ativo: false }
    case 'captura_aberta':
      return { texto: e.captura_fim ? `Câmera aberta até ${quando(e.captura_fim)}` : 'Câmera aberta', ativo: true }
    case 'captura_encerrada':
      return { texto: `Câmera fechada · revelação ${revelacao}`, ativo: false }
    case 'revelado':
      return { texto: e.expira_em ? `Revelado · álbum até ${dataPorExtenso(e.expira_em)}` : 'Revelado', ativo: true }
    case 'expirado':
      return { texto: 'Álbum expirado', ativo: false }
    case 'cancelado':
      return { texto: 'Cancelado', ativo: false }
  }
}
