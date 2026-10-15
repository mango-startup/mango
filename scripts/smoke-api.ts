// Roteiro de verificação da api real contra um servidor de verdade (sem dependência nova; Node 24 roda TypeScript).
//   docker compose -f docker-compose.dev.yml up --build -d
//   node scripts/smoke-api.ts [http://localhost:3000]
// Percorre o ciclo inteiro: criar evento, entrar, fotografar (com reenvio), moderar, revelar, álbum, ZIP, privacidade, excluir.
// Cria dados de teste no servidor indicado: não aponte para a produção.
import assert from 'node:assert/strict'
import { criarApiReal } from '../src/lib/api/real.ts'
import { sessaoEmMemoria } from '../src/lib/api/sessao.ts'
import { ErroApi } from '../src/lib/api/tipos.ts'

const base = process.argv[2] ?? 'http://localhost:3000'
if (/razielhub\.cloud/.test(base)) throw new Error('Este roteiro cria eventos de teste: não rode contra a produção.')

const anfitriao = criarApiReal({ sessao: sessaoEmMemoria(), base, origem: 'https://exemplo.test' })
// Dois aparelhos de convidado (cada um com a sua sessão, como no mundo real).
const ana = criarApiReal({ sessao: sessaoEmMemoria(), base })
const beto = criarApiReal({ sessao: sessaoEmMemoria(), base })

const jpeg = (marca: number, tamanho = 200) => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(tamanho).fill(marca)])], { type: 'image/jpeg' })
const erroDe = async (f: () => Promise<unknown>): Promise<ErroApi> => {
  try {
    await f()
  } catch (e) {
    assert.ok(e instanceof ErroApi, `esperava ErroApi, veio ${String(e)}`)
    return e
  }
  throw new Error('esperava um erro')
}
let passos = 0
const ok = (nome: string) => console.log(`  ✔ ${nome}`) || passos++

console.log(`Api real contra ${base}`)

// --- pacotes e criação
const pacotes = await anfitriao.pacotes()
assert.deepEqual(pacotes.map((p) => p.id), ['teste', 'festa', 'celebracao', 'casamento'])
assert.equal(pacotes[0].poses_max, 12)
ok('pacotes vêm do servidor')

assert.equal((await erroDe(() => anfitriao.criarEvento({ nome: '', captura_inicio: 'x', captura_fim: 'y' }))).erro, 'nome_invalido')
ok('erro do servidor vira ErroApi com o código certo')

const agora = Date.now()
const evento = await anfitriao.criarEvento({
  nome: 'Roteiro de teste',
  captura_inicio: new Date(agora - 60_000).toISOString(),
  captura_fim: new Date(agora + 3600_000).toISOString(),
  revelacao_manual: true,
})
assert.equal(evento.estado, 'pronto')
assert.ok(anfitriao.anfitriaoNesteAparelho())
const link = await anfitriao.linkDoAnfitriao(evento.id)
assert.match(link, /^https:\/\/exemplo\.test\/anfitriao#.{20,}$/)
ok('evento criado, token guardado e link secreto montado')

const codigo = evento.codigo
let publico = await ana.eventoPublico(codigo)
assert.equal(publico.fotos, 0)
assert.equal(publico.lotado, false)
ok('estado público (com o total de fotos)')

// --- convidados
assert.equal((await erroDe(() => ana.eu(codigo))).status, 401)
const entradaAna = await ana.entrar(codigo, 'Ana')
assert.equal(entradaAna.poses_restantes, 12)
const entradaDeNovo = await ana.entrar(codigo)
assert.equal(entradaDeNovo.convidado_id, entradaAna.convidado_id)
await beto.entrar(codigo, 'Beto')
ok('entrar guarda o token e reentrar reconhece o aparelho')

// --- fotos: envio, idempotência, miniatura
const idsAna = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
for (const [i, id] of idsAna.entries()) {
  const r = await ana.enviarFoto(codigo, id, jpeg(i + 1), { largura: 1200, altura: 1600, tirada_em: new Date().toISOString() })
  assert.equal(r.repetida, false)
  await ana.enviarMiniatura(codigo, id, jpeg(50 + i, 40))
}
assert.equal((await ana.enviarFoto(codigo, idsAna[0], jpeg(1))).repetida, true)
const idBeto = crypto.randomUUID()
await beto.enviarFoto(codigo, idBeto, jpeg(9))
const eu = await ana.eu(codigo)
assert.equal(eu.poses_restantes, 9)
assert.deepEqual(eu.fotos.sort(), [...idsAna].sort())
publico = await ana.eventoPublico(codigo)
assert.equal(publico.fotos, 4)
ok('enviar, reenviar sem duplicar, miniatura e contagem de poses e de fotos')

assert.equal((await erroDe(() => ana.enviarFoto(codigo, crypto.randomUUID(), new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' })))).erro, 'tipo_invalido')
assert.equal((await erroDe(() => ana.enviarFoto(codigo, idBeto, jpeg(9)))).erro, 'id_em_uso')
ok('o servidor recusa o que não é JPEG e o id de outro convidado')

// --- painel e moderação antes da revelação
const painel = await anfitriao.painel(evento.id)
assert.equal(painel.convidados, 2)
assert.equal(painel.fotos, 4)
assert.equal((await anfitriao.meusEventos()).length, 1)
const moderacao = await anfitriao.albumDoAnfitriao(evento.id)
assert.equal(moderacao.total, 4)
assert.ok(moderacao.fotos.every((f) => f.miniatura_url.startsWith('blob:')))
assert.equal((await erroDe(() => ana.album(codigo))).erro, 'nao_revelado')
ok('painel, meus eventos e moderação (miniaturas como blob) antes da revelação; convidado ainda não vê nada')

// --- revelar, álbum, pedido de remoção
assert.equal((await erroDe(() => anfitriao.revelar(evento.id))).erro, 'transicao_invalida')
assert.equal((await anfitriao.encerrar(evento.id)).estado, 'captura_encerrada')
assert.equal((await anfitriao.revelar(evento.id)).estado, 'revelado')
const album = await ana.album(codigo)
assert.equal(album.total, 4)
assert.deepEqual(album.fotos.map((f) => f.numero), [1, 2, 3, 4])
assert.equal(album.fotos[0].url, `${base}/api/eventos/${codigo}/fotos/${album.fotos[0].id}/arquivo`)
const bytes = await (await fetch(album.fotos[0].miniatura_url)).arrayBuffer()
assert.ok(bytes.byteLength > 0)
assert.equal((await ana.album(codigo, { minhas: true })).total, 3)
assert.equal((await beto.album(codigo, { minhas: true })).total, 1)
ok('álbum do convidado: numeração, urls montadas, miniatura baixável e "minhas"')

const pedido = await beto.pedirRemocao(codigo, idsAna[0], 'Não gostei')
assert.equal(pedido.repetido, false)
assert.equal((await beto.pedirRemocao(codigo, idsAna[0])).repetido, true)
const pendentes = await anfitriao.pedidosDeRemocao(evento.id)
assert.equal(pendentes.length, 1)
assert.equal(pendentes[0].numero, 1)
await anfitriao.manterFoto(evento.id, pendentes[0].id)
assert.equal((await anfitriao.pedidosDeRemocao(evento.id)).length, 0)
await beto.pedirRemocao(codigo, idsAna[1], 'Remover')
await anfitriao.apagarFoto(evento.id, idsAna[1])
assert.equal((await ana.album(codigo)).total, 3)
assert.equal((await anfitriao.pedidosDeRemocao(evento.id)).length, 0)
ok('pedir remoção, manter, apagar foto (204 sem corpo) e resolução dos pedidos')

// --- privacidade, código, ZIP
assert.equal((await anfitriao.editarEvento(evento.id, { album_privado: true })).album_privado, true)
assert.equal((await erroDe(() => ana.album(codigo))).erro, 'album_privado')
assert.equal((await anfitriao.albumDoAnfitriao(evento.id)).total, 3)
await anfitriao.editarEvento(evento.id, { album_privado: false })
const zip = await anfitriao.baixarAlbum(evento.id)
assert.equal(new TextDecoder().decode(new Uint8Array(await zip.slice(0, 2).arrayBuffer())), 'PK')
const { codigo: novoCodigo } = await anfitriao.trocarCodigo(evento.id)
assert.notEqual(novoCodigo, codigo)
assert.equal((await erroDe(() => ana.eventoPublico(codigo))).erro, 'nao_encontrado')
assert.equal((await ana.eventoPublico(novoCodigo)).nome, 'Roteiro de teste')
assert.equal((await anfitriao.albumDoAnfitriao(evento.id)).total, 3) // o código novo é usado sozinho
ok('álbum privado, ZIP, e troca de código derrubando o link antigo')

// --- outro aparelho entra com o link secreto
const outroAparelho = criarApiReal({ sessao: sessaoEmMemoria(), base })
const token = link.split('#')[1]
assert.equal((await outroAparelho.entrarComoAnfitriao(token)).id, evento.id)
assert.equal((await outroAparelho.painel(evento.id)).fotos, 3)
assert.equal((await erroDe(() => outroAparelho.entrarComoAnfitriao('token-errado'))).erro, 'nao_autorizado')
ok('link secreto abre o painel em outro aparelho; token errado é recusado')

// --- cancelar e excluir
const sobra = await anfitriao.criarEvento({ nome: 'Para cancelar', captura_inicio: new Date(agora + 3600_000).toISOString(), captura_fim: new Date(agora + 7200_000).toISOString() })
assert.equal((await anfitriao.cancelar(sobra.id)).estado, 'cancelado')
await anfitriao.excluir(sobra.id)
await anfitriao.excluir(evento.id)
assert.equal(anfitriao.anfitriaoNesteAparelho(), false)
assert.equal((await erroDe(() => ana.eventoPublico(novoCodigo))).status, 404)
ok('cancelar e excluir; o aparelho esquece os eventos excluídos')

// --- rede fora: NÃO é ErroApi (a fila de envio entende como "sem conexão")
const semRede = criarApiReal({ sessao: sessaoEmMemoria(), base: 'http://127.0.0.1:1' })
await assert.rejects(semRede.pacotes(), (e: unknown) => !(e instanceof ErroApi))
ok('falha de rede sobe como erro comum, não como ErroApi')

console.log(`\n${passos} verificações passaram.`)
