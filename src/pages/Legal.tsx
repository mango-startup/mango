import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MangoLogo } from '../components/MangoLogo'
import { useConfigPublica } from '../lib/configPublica'
import { useTitulo } from '../lib/useTitulo'

// Textos provisórios: seguem as regras do plano do MVP e precisam de revisão jurídica antes do lançamento.

interface Secao {
  titulo: string
  conteudo: ReactNode
}

function DocumentoLegal({ titulo, resumo, secoes, rascunho = true }: { titulo: string; resumo: string; secoes: Secao[]; rascunho?: boolean }) {
  useTitulo(titulo)
  return (
    <div className="min-h-dvh bg-base px-5 pb-14 pt-[env(safe-area-inset-top)] text-paper">
      <header className="mx-auto flex min-h-16 max-w-[680px] items-center">
        <Link to="/" className="flex min-h-11 items-center gap-2 font-display text-[22px] leading-none">
          <MangoLogo className="h-[21px] w-4" />
          <span className="pb-0.5">mango</span>
        </Link>
      </header>

      <main className="mx-auto mt-8 max-w-[680px]">
        {rascunho && (
          <p className="mb-6 inline-flex rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">
            Rascunho: texto provisório até a revisão jurídica
          </p>
        )}
        <h1 className="font-display text-[44px] leading-none">{titulo}</h1>
        <p className="mt-4 text-[17px] leading-normal text-muted">{resumo}</p>

        <div className="mt-10 flex flex-col">
          {secoes.map((s) => (
            <section key={s.titulo} className="border-t border-line py-6">
              <h2 className="text-[17px] font-semibold">{s.titulo}</h2>
              <div className="mt-2 flex max-w-[64ch] flex-col gap-3 text-[15px] leading-relaxed text-muted [text-wrap:pretty]">{s.conteudo}</div>
            </section>
          ))}
        </div>

        <nav aria-label="Outras páginas" className="mt-6 flex flex-wrap gap-x-6 border-t border-line pt-6 text-sm">
          <Link to="/termos" className="flex min-h-11 items-center text-muted hover:text-paper">
            Termos de uso
          </Link>
          <Link to="/privacidade" className="flex min-h-11 items-center text-muted hover:text-paper">
            Privacidade
          </Link>
          <Link to="/ajuda" className="flex min-h-11 items-center text-muted hover:text-paper">
            Ajuda
          </Link>
        </nav>
      </main>
    </div>
  )
}

// O canal de contato é a configuração `contato_suporte` (admin). Sem ela, avisa que ainda será publicado.
function Contato() {
  const { contato_suporte: canal } = useConfigPublica()
  return canal ? <>Fale com a gente: {canal}.</> : <>O canal de contato do Mango será publicado aqui antes do lançamento.</>
}

export function TermsPage() {
  return (
    <DocumentoLegal
      titulo="Termos de uso"
      resumo="As regras para criar eventos e fotografar com o Mango, em linguagem simples."
      secoes={[
        {
          titulo: 'O que é o Mango',
          conteudo: (
            <p>
              Uma câmera descartável digital para eventos. O anfitrião cria a câmera e compartilha um link; cada convidado fotografa pelo navegador, com um número
              limitado de poses, e as fotos só aparecem para todos na revelação.
            </p>
          ),
        },
        {
          titulo: 'Quem cria o evento',
          conteudo: (
            <>
              <p>Quem cria o evento é o anfitrião e responde por ele: por quem recebe o link, pelo uso das fotos e pela moderação do álbum.</p>
              <p>O link de anfitrião dá controle total do evento. Guarde-o e não o compartilhe com os convidados.</p>
            </>
          ),
        },
        {
          titulo: 'Quem fotografa',
          conteudo: (
            <p>
              Ao entrar pelo link, o convidado concorda com estes termos. Cada aparelho recebe um rolo com o número de poses definido pelo anfitrião. As fotos tiradas
              não podem ser apagadas pelo convidado antes da revelação; depois, é possível pedir a remoção ao anfitrião.
            </p>
          ),
        },
        {
          titulo: 'Conteúdo proibido',
          conteudo: (
            <p>
              Não é permitido enviar fotos ilegais, de nudez ou sexo, de violência, que exponham alguém de forma humilhante ou que violem direitos de outras pessoas.
              O anfitrião pode apagar qualquer foto do evento, e o Mango pode remover conteúdo e encerrar eventos que descumpram estes termos.
            </p>
          ),
        },
        {
          titulo: 'Pagamento e reembolso',
          conteudo: (
            <p>
              Os pacotes pagos são cobrados uma vez por evento, sem assinatura. O reembolso é integral enquanto nenhuma foto tiver sido tirada no evento. Os prazos de
              arrependimento previstos no Código de Defesa do Consumidor serão detalhados aqui após a revisão jurídica.
            </p>
          ),
        },
        {
          titulo: 'Por quanto tempo as fotos ficam',
          conteudo: (
            <p>
              O álbum fica disponível por 12 meses depois da revelação nos pacotes pagos e por 30 dias no teste grátis. Depois disso, as fotos são apagadas. Baixe as
              que quiser guardar antes do fim do prazo.
            </p>
          ),
        },
        { titulo: 'Contato', conteudo: <p><Contato /></p> },
      ]}
    />
  )
}

export function PrivacyPage() {
  return (
    <DocumentoLegal
      titulo="Privacidade"
      resumo="Quais dados o Mango usa, para quê e por quanto tempo. A regra é coletar o mínimo."
      secoes={[
        {
          titulo: 'O que coletamos',
          conteudo: (
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>As fotos tiradas pela câmera do Mango, com largura, altura e horário.</li>
              <li>O nome que o convidado escolhe mostrar no álbum, se escolher (é opcional).</li>
              <li>Um código aleatório que identifica o aparelho dentro do evento, para manter o rolo de cada convidado.</li>
              <li>Os dados do evento informados pelo anfitrião (nome, datas e configurações).</li>
              <li>Nos pacotes pagos, o valor, a data e o identificador da cobrança. O pagamento é feito na página do Stripe: o Mango não recebe nem guarda o número do cartão.</li>
            </ul>
          ),
        },
        {
          titulo: 'O que não coletamos',
          conteudo: (
            <p>
              Não pedimos cadastro aos convidados. As fotos tiradas pelo Mango saem sem localização (GPS) nem outros dados da câmera (EXIF): a imagem é gerada de novo
              no aparelho antes do envio.
            </p>
          ),
        },
        {
          titulo: 'Quem vê as fotos',
          conteudo: (
            <p>
              Antes da revelação, só o anfitrião, na moderação. Depois, quem tem o link do evento, a menos que o anfitrião deixe o álbum visível só para ele. O álbum não
              é público nem aparece em buscadores. Se o link circular demais, o anfitrião pode trocá-lo.
            </p>
          ),
        },
        {
          titulo: 'Por quanto tempo guardamos',
          conteudo: (
            <p>
              As fotos ficam até o fim do prazo do álbum (12 meses depois da revelação nos pacotes pagos, 30 dias no teste grátis) ou até o anfitrião excluir o evento.
              Fotos apagadas somem do álbum na hora e saem dos nossos servidores em até 30 dias.
            </p>
          ),
        },
        {
          titulo: 'Fotos de crianças',
          conteudo: (
            <p>
              Festas costumam ter crianças. O anfitrião é responsável por quem recebe o link e pode apagar qualquer foto. Pais e responsáveis podem pedir a remoção de
              fotos em que seus filhos aparecem, pelo próprio álbum ou pelo contato abaixo.
            </p>
          ),
        },
        {
          titulo: 'Seus direitos',
          conteudo: (
            <p>
              Pela LGPD, você pode pedir acesso, correção ou exclusão dos seus dados e a remoção de fotos em que aparece. <Contato />
            </p>
          ),
        },
      ]}
    />
  )
}

export function HelpPage() {
  return (
    <DocumentoLegal
      titulo="Ajuda"
      resumo="Respostas rápidas para quem está fotografando e para quem organizou a festa."
      rascunho={false}
      secoes={[
        {
          titulo: 'A câmera não abre',
          conteudo: (
            <>
              <p>O navegador precisa da sua permissão para usar a câmera.</p>
              <p>No iPhone: Ajustes › Safari › Câmera › Permitir. No Android: toque no cadeado ao lado do endereço › Permissões › Câmera.</p>
              <p>Se o link abriu dentro do Instagram ou de outro app e a câmera não aparece, toque em "Usar a câmera do celular" ou abra o link no navegador.</p>
            </>
          ),
        },
        {
          titulo: 'Aparece "fotos aguardando envio"',
          conteudo: (
            <p>
              As fotos ficam guardadas no seu celular e sobem sozinhas quando a conexão volta. Mantenha a página aberta e não limpe os dados do navegador até a contagem
              zerar. Se fechar a página, é só abrir o mesmo link de novo.
            </p>
          ),
        },
        {
          titulo: 'Não consigo ver as minhas fotos',
          conteudo: <p>É de propósito: ninguém vê as fotos antes da revelação. No horário marcado, o mesmo link vira o álbum.</p>,
        },
        {
          titulo: 'Quero tirar uma foto do álbum',
          conteudo: (
            <p>Abra a foto e toque em "Pedir remoção": o anfitrião recebe o pedido. Se você é o anfitrião, apague direto em Moderar fotos, no painel do evento.</p>
          ),
        },
        {
          titulo: 'Perdi o link de anfitrião',
          conteudo: (
            <p>
              Ele fica salvo no aparelho em que você criou o evento: abra Meus eventos por lá e copie o link no painel. Sem esse link, não dá para administrar o evento
              em outro aparelho.
            </p>
          ),
        },
        {
          titulo: 'O link dos convidados vazou',
          conteudo: <p>No painel do evento, use "Trocar o link dos convidados". O link antigo para de funcionar e você manda o novo para quem deve receber.</p>,
        },
        {
          titulo: 'Evento com mais de 200 convidados',
          conteudo: <p>Casamentos e formaturas grandes têm preço combinado. <Contato /></p>,
        },
        { titulo: 'Falar com a gente', conteudo: <p><Contato /></p> },
      ]}
    />
  )
}
