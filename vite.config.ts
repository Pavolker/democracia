import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import netlify from '@netlify/vite-plugin';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  // O plugin da Netlify emula as funções serverless DENTRO do `npm run dev`
  // (é o que permite testar a coleta das assembleias em desenvolvimento, sem o
  // CLI). Ele NÃO entra no build de produção: a Netlify já empacota as funções
  // por conta própria a partir de `netlify/functions` (ver netlify.toml), e
  // carregar um emulador de plataforma durante o build de CI é risco sem
  // contrapartida.
  const somenteEmDesenvolvimento = command === 'serve';

  // `edgeFunctions: { enabled: false }` é necessário: a emulação de edge
  // functions sobe um servidor Deno com uma flag que a versão instalada não
  // aceita ("unexpected argument '--allow-scripts'"), e a falha derruba o dev
  // server alguns segundos depois de ele ficar pronto. Este projeto não usa
  // edge functions, então desligar essa parte não remove nada.
  const plugins = [
    react(),
    tailwindcss(),
    ...(somenteEmDesenvolvimento ? [netlify({ edgeFunctions: { enabled: false } })] : []),
  ];

  return {
    base: './',
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
