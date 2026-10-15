// Datas em português do jeito que se fala: "hoje às 19h", "amanhã às 10h30", "sáb, 14 de nov às 19h".

const DIA_MS = 24 * 60 * 60 * 1000

function hora(d: Date): string {
  const m = d.getMinutes()
  return `${d.getHours()}h${m ? String(m).padStart(2, '0') : ''}`
}

const diaDoMes = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
const dataCompleta = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })

function inicioDoDia(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** "hoje às 19h", "amanhã às 10h", "ontem às 22h" ou "sáb, 14 de nov às 19h". */
export function quando(iso: string, agora = new Date()): string {
  const d = new Date(iso)
  const dias = Math.round((inicioDoDia(d) - inicioDoDia(agora)) / DIA_MS)
  if (dias === 0) return `hoje às ${hora(d)}`
  if (dias === 1) return `amanhã às ${hora(d)}`
  if (dias === -1) return `ontem às ${hora(d)}`
  return `${diaDoMes.format(d).replace(/\./g, '')} às ${hora(d)}`
}

/** "14 de novembro de 2026" */
export function dataPorExtenso(iso: string): string {
  return dataCompleta.format(new Date(iso))
}

/** "13 h 20 min", "5 min", "menos de 1 min" */
export function tempoAte(iso: string, agora = new Date()): string {
  const minutos = Math.ceil((new Date(iso).getTime() - agora.getTime()) / 60000)
  if (minutos < 1) return 'menos de 1 min'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (h >= 48) return `${Math.round(h / 24)} dias`
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}
