// Ícones de traço em 24×24, herdando a cor do texto. Decorativos por padrão (aria-hidden):
// o botão que usa o ícone é quem leva o nome acessível.
const CAMINHOS = {
  lixeira: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12', 'M9 7V4h6v3'],
  baixar: ['M12 4v11', 'm7 10 5 5 5-5', 'M5 20h14'],
  compartilhar: ['M12 15V4', 'm7 9 5-5 5 5', 'M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5'],
  copiar: ['M9 9h10v11H9z', 'M5 15V4h10'],
  fechar: ['M6 6l12 12', 'M18 6 6 18'],
  voltar: ['M19 12H5', 'm11 6-6 6 6 6'],
  anterior: ['m15 6-6 6 6 6'],
  proxima: ['m9 6 6 6-6 6'],
  alerta: ['M12 8v5', 'M12 16.5v.5', 'M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z'],
  trocarCamera: ['M20 7h-9a5 5 0 0 0-5 5v1', 'm17 4 3 3-3 3', 'M4 17h9a5 5 0 0 0 5-5v-1', 'm7 20-3-3 3-3'],
} as const

export type NomeIcone = keyof typeof CAMINHOS

export function Icone({ nome, className = 'h-6 w-6' }: { nome: NomeIcone; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {CAMINHOS[nome].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
}
