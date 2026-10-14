# Mango — protótipo

Etapa atual: câmera → compressão/EXIF (canvas) → salvar no navegador (IndexedDB) → galeria.
Sem Supabase, sem R2, sem contas, sem backend — tudo roda no próprio dispositivo.

```bash
npm run dev
```

Abre em `https://localhost:5173` (HTTPS autoassinado, necessário para a câmera).
As fotos ficam salvas no IndexedDB do navegador — cada dispositivo tem seu
próprio "rolo".

## Deploy

Todo push em `main` gera a imagem `ghcr.io/lhduarten/mango` (GitHub Actions,
[.github/workflows/docker.yml](.github/workflows/docker.yml)). O servidor só puxa a imagem
(tag `sha-<commit>`) e a serve com nginx. Em pull request o workflow apenas testa o build.
O app não roda mais no GitHub Pages.
