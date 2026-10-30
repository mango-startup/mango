// Laboratório da câmera (/admin/laboratorio-camera): o site roda dentro de um iframe com este nome e, ali, usa a api
// simulada com dados e sessão separados dos reais. Nada do laboratório chega ao servidor, ao banco ou aos eventos de verdade.
export const NOME_DO_LABORATORIO = 'mango-lab'

export const EM_LABORATORIO = typeof window !== 'undefined' && window.name === NOME_DO_LABORATORIO

/** Prefixo dos nomes de armazenamento: o laboratório não mistura seus dados com os do uso real. */
export const ESPACO = EM_LABORATORIO ? 'lab-' : ''
