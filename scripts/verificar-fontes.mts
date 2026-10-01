/**
 * Verificação ao vivo das fontes.
 *
 * Roda cada adaptador contra o portal real e imprime o que foi coletado.
 * É o comando que se usa depois de mexer em um parser: nenhum adaptador deve
 * entrar em `casas.mts` sem ter passado por aqui.
 *
 *   npm run verificar:fontes            # todas as casas
 *   npm run verificar:fontes -- SP,PR   # só algumas
 *
 * Não faz parte do `npm test` porque depende de rede e dos portais estarem no ar.
 */

import { montarRegistro } from '../netlify/functions/lib/registro.mts';
import type { Adaptador } from '../netlify/functions/lib/adaptadores.mts';

// Aceita `SP,PR` ou `SP PR` — espaço ou vírgula.
const filtro = process.argv
  .slice(2)
  .join(',')
  .split(',')
  .map((uf) => uf.trim().toUpperCase())
  .filter(Boolean);

const registro = montarRegistro();
const alvo = filtro.length > 0 ? registro.filter((a) => filtro.includes(a.uf)) : registro;

const TIMEOUT_MS = 90_000;

async function comTimeout<T>(promessa: Promise<T>, ms: number, rotulo: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error(`excedeu ${ms / 1000}s`)), ms);
  });
  try {
    return await Promise.race([promessa, limite]);
  } finally {
    clearTimeout(timer!);
    void rotulo;
  }
}

interface Linha {
  uf: string;
  sigla: string;
  situacao: string;
  status: string;
  total: number;
  ms: number;
  exemplo: string;
  mensagem: string;
}

async function executar(adaptador: Adaptador): Promise<Linha> {
  const inicio = Date.now();

  if (adaptador.situacao !== 'verificado' || !adaptador.executar) {
    return {
      uf: adaptador.uf,
      sigla: adaptador.sigla,
      situacao: adaptador.situacao,
      status: 'sem coleta',
      total: 0,
      ms: 0,
      exemplo: '',
      mensagem: adaptador.observacao
    };
  }

  try {
    const { buscarTexto } = await import('../netlify/functions/lib/http.mts');
    const eventos = await comTimeout(
      adaptador.executar({ buscarTexto }),
      TIMEOUT_MS,
      adaptador.uf
    );
    const exemplo = eventos[0]
      ? `${eventos[0].data} ${eventos[0].hora ?? '--:--'} · ${eventos[0].mecanismo} · ${eventos[0].tema.slice(0, 70)}`
      : '';

    return {
      uf: adaptador.uf,
      sigla: adaptador.sigla,
      situacao: adaptador.situacao,
      status: eventos.length > 0 ? 'OK' : 'vazio',
      total: eventos.length,
      ms: Date.now() - inicio,
      exemplo,
      mensagem: adaptador.observacao
    };
  } catch (erro) {
    return {
      uf: adaptador.uf,
      sigla: adaptador.sigla,
      situacao: adaptador.situacao,
      status: 'ERRO',
      total: 0,
      ms: Date.now() - inicio,
      exemplo: '',
      mensagem: erro instanceof Error ? erro.message : 'erro desconhecido'
    };
  }
}

const linhas: Linha[] = [];
// Sequencial de propósito: não queremos disparar 27 portais públicos ao mesmo tempo.
for (const adaptador of alvo) {
  const linha = await executar(adaptador);
  linhas.push(linha);
  const marca = linha.status === 'OK' ? '✅' : linha.status === 'vazio' ? '⚪' : linha.status === 'ERRO' ? '❌' : '·';
  console.log(
    `${marca} ${linha.uf} ${linha.sigla.padEnd(6)} ${linha.status.padEnd(9)} ` +
      `${String(linha.total).padStart(3)} eventos ${String(linha.ms).padStart(6)}ms  ${linha.situacao}`
  );
  if (linha.exemplo) console.log(`      ex.: ${linha.exemplo}`);
  if (linha.status === 'ERRO') console.log(`      erro: ${linha.mensagem}`);
}

const comColeta = linhas.filter((l) => l.situacao === 'verificado');
const comEventos = linhas.filter((l) => l.total > 0);
const semFonte = linhas.filter((l) => l.situacao === 'sem_agenda');
const aMapear = linhas.filter((l) => l.situacao === 'nao_implementado');

console.log('\n─── Resumo ───');
console.log(`  adaptadores implementados : ${comColeta.length}`);
console.log(`  devolvendo eventos        : ${comEventos.length}  (${comEventos.map((l) => l.uf).join(', ') || '—'})`);
console.log(`  total de eventos          : ${linhas.reduce((s, l) => s + l.total, 0)}`);
console.log(`  sem fonte no portal       : ${semFonte.length}`);
console.log(`  ainda a mapear            : ${aMapear.length}  (${aMapear.map((l) => l.uf).join(', ') || '—'})`);

const erros = linhas.filter((l) => l.status === 'ERRO');
if (erros.length > 0) {
  console.log(`\n⚠️  ${erros.length} adaptador(es) com erro: ${erros.map((l) => `${l.uf} (${l.mensagem.slice(0, 60)})`).join(' | ')}`);
  process.exitCode = 1;
}
