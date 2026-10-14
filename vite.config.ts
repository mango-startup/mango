import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(() => ({
  // O app roda na raiz do domínio (servidor próprio), não mais em /mango/ do GitHub Pages
  base: '/',
  plugins: [react(), tailwindcss(), basicSsl()],
  server: {
    // câmera exige HTTPS ou localhost; acesso via IP da rede local não funciona sem certificado.
    // HTTPS é ligado pelo plugin basicSsl(); o certificado é autoassinado, então o
    // celular vai avisar "conexão não segura" na primeira vez — é só continuar mesmo assim.
    host: true,
  },
}))
