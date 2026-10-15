import type { Pool } from 'pg'
import type { Storage } from './storage/storage.ts'

/**
 * Apaga do armazenamento os arquivos que já passaram do prazo:
 * - foto removida pelo anfitrião há 30 dias ou mais;
 * - foto de evento expirado (o álbum acabou, o arquivo não precisa existir);
 * - foto de evento excluído há 30 dias ou mais.
 * Mantém a linha no banco com `arquivo_apagado_em` (metadados mínimos). Idempotente; se o
 * armazenamento falhar numa foto, ela fica sem marca e entra de novo na próxima rodada.
 */
export async function limparArquivos(pool: Pick<Pool, 'query'>, storage: Storage, agora = new Date(), lote = 200): Promise<number> {
  const r = await pool.query<{ id: string; chave_storage: string; miniatura_chave: string | null }>(
    `select f.id, f.chave_storage, f.miniatura_chave
     from fotos f join eventos e on e.id = f.evento_id
     where f.arquivo_apagado_em is null and (
       (f.removida_em is not null and f.removida_em <= $1::timestamptz - interval '30 days')
       or e.estado = 'expirado'
       or (e.excluido_em is not null and e.excluido_em <= $1::timestamptz - interval '30 days')
     )
     order by f.id limit $2`,
    [agora, lote],
  )
  let apagadas = 0
  for (const foto of r.rows) {
    try {
      await storage.apagar(foto.chave_storage)
      if (foto.miniatura_chave) await storage.apagar(foto.miniatura_chave)
    } catch (erro) {
      console.error(`Limpeza: não consegui apagar a foto ${foto.id}:`, erro)
      continue
    }
    await pool.query('update fotos set arquivo_apagado_em = $2::timestamptz where id = $1', [foto.id, agora])
    apagadas++
  }
  return apagadas
}
