import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FONTES_OFICIAIS } from '../services/config';
import { testarFonteIndividual } from '../services/scraper';
import { normalizar } from '../services/texto';
import { FonteConfig, ScraperStatus } from '../types';
import { ExternalLink, Play, CheckCircle2, AlertTriangle, Loader2, Code, ShieldCheck, Info } from 'lucide-react';

interface SourceTesterProps {
  statuses: ScraperStatus[];
}

/** Resultado normalizado do teste pontual de uma fonte. */
interface ResultadoTeste {
  sucesso: boolean;
  tempoMs?: number;
  statusCode?: number;
  respostaBruta: string;
  eventosEncontrados: number;
  mensagem: string;
}

/**
 * Tom visual do status de sincronização.
 * Espelha exatamente os valores de `ScraperStatus['status']` — nenhuma fonte
 * recebe um tom melhor do que o realmente observado.
 */
type TomStatus = 'sucesso' | 'erro' | 'carregando' | 'neutro';

const ESTILO_TOM: Record<TomStatus, { pill: string; ponto: string }> = {
  sucesso: {
    pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    ponto: 'bg-emerald-500'
  },
  erro: {
    pill: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    ponto: 'bg-red-500'
  },
  carregando: {
    pill: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    ponto: 'bg-amber-500 animate-pulse'
  },
  neutro: {
    pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    ponto: 'bg-slate-400'
  }
};

interface SituacaoFonte {
  tom: TomStatus;
  /** Texto exibido dentro do selo de status. */
  rotulo: string;
  /** Linha secundária: números reais quando existirem. */
  detalhe?: string;
  /** Explicação honesta para fontes que o app não coleta. */
  nota?: string;
}

/** Quantas fontes catalogadas existem por UF (FEDERAL agrupa Câmara + Senado). */
const FONTES_POR_UF = FONTES_OFICIAIS.reduce<Record<string, number>>((acc, f) => {
  acc[f.uf] = (acc[f.uf] || 0) + 1;
  return acc;
}, {});

/** Siglas catalogadas, normalizadas, para decidir a quem pertence um status. */
const SIGLAS_CATALOGADAS = new Set(FONTES_OFICIAIS.map((f) => normalizar(f.sigla)));

/**
 * Localiza o status de sincronização de uma fonte.
 *
 * Regra: correspondência ESTRITA por `fonteId` (sem acento, minúsculo). A
 * busca por UF só é aceita como último recurso e apenas quando (a) a fonte não
 * é federal, (b) existe uma única casa catalogada naquela UF e (c) o
 * `fonteId` do status não pertence a outra casa catalogada.
 *
 * Sem a condição (c), o status da Câmara — que carrega `uf: 'DF'` — era
 * aplicado à CLDF, exibindo "0 eventos" em nome de uma casa que sequer foi
 * consultada.
 */
function encontrarStatus(fonte: FonteConfig, statuses: ScraperStatus[]): ScraperStatus | undefined {
  const sigla = normalizar(fonte.sigla);

  const porFonteId = statuses.find((s) => normalizar(s.fonteId) === sigla);
  if (porFonteId) return porFonteId;

  if (fonte.uf === 'FEDERAL') return undefined;
  if ((FONTES_POR_UF[fonte.uf] || 0) !== 1) return undefined;

  return statuses.find(
    (s) => s.uf === fonte.uf && !SIGLAS_CATALOGADAS.has(normalizar(s.fonteId))
  );
}

/** Traduz fonte + status real em selo, texto e números. */
function descreverFonte(fonte: FonteConfig, status: ScraperStatus | undefined): SituacaoFonte {
  const partes: string[] = [];
  if (status) {
    if (typeof status.totalEventos === 'number') {
      partes.push(`${status.totalEventos} ${status.totalEventos === 1 ? 'evento' : 'eventos'}`);
    }
    if (typeof status.tempoMs === 'number' && status.tempoMs > 0) {
      partes.push(`${status.tempoMs} ms`);
    }
    if (status.ultimaChecagem) {
      partes.push(`às ${status.ultimaChecagem}`);
    }
  }
  const detalhe = partes.length > 0 ? partes.join(' · ') : undefined;

  // 1. Houve consulta de verdade nesta sessão.
  //
  // Confiar neste registro é seguro por construção: para as 27 casas
  // subnacionais ele vem da função serverless, que só executa um adaptador com
  // `situacao: 'verificado'` — ou seja, um parser que já foi testado contra o
  // portal real. Não existe mais nenhum caminho que produza "sucesso" sem
  // requisição, que era o defeito da versão anterior.
  if (status && status.status !== 'pendente') {
    switch (status.status) {
      case 'sucesso':
        return {
          tom: 'sucesso',
          rotulo: status.totalEventos > 0 ? 'Coleta ativa' : 'Consultada, sem eventos',
          detalhe,
          nota: status.mensagem
        };
      case 'erro':
        return { tom: 'erro', rotulo: 'Falha na coleta', detalhe, nota: status.mensagem };
      case 'carregando':
        return { tom: 'carregando', rotulo: 'Coleta em andamento', detalhe, nota: status.mensagem };
      default:
        break;
    }
  }

  // 2. Sem consulta registrada: vale o estado declarado no catálogo.
  if (fonte.integracao === 'pendente') {
    return {
      tom: 'neutro',
      rotulo: 'Integração pendente',
      nota: status?.mensagem
        ? status.mensagem
        : 'Casa catalogada com endereço oficial, mas a agenda deste portal ainda não foi mapeada. Nenhuma requisição é feita a ele.'
    };
  }

  return {
    tom: 'neutro',
    rotulo: 'Sem coleta nesta sessão',
    detalhe: 'Nenhuma consulta registrada desde que a página foi aberta.'
  };
}

export const SourceTester: React.FC<SourceTesterProps> = ({ statuses }) => {
  const [selectedFonteSigla, setSelectedFonteSigla] = useState('Câmara');
  const [testResult, setTestResult] = useState<ResultadoTeste | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Evita atualizar estado depois que o painel saiu da tela (troca de aba
  // durante um teste em andamento).
  const montadoRef = useRef(true);
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  const fontesFederais = useMemo(() => FONTES_OFICIAIS.filter((f) => f.uf === 'FEDERAL'), []);
  const fontesEstaduais = useMemo(
    () => FONTES_OFICIAIS.filter((f) => f.uf !== 'FEDERAL' && f.uf !== 'DF'),
    []
  );
  const fontesDistritais = useMemo(() => FONTES_OFICIAIS.filter((f) => f.uf === 'DF'), []);

  // Resumo do catálogo, calculado a partir do próprio catálogo.
  const resumo = useMemo(() => {
    const integradas = FONTES_OFICIAIS.filter((f) => f.integracao === 'integrada');
    const pendentes = FONTES_OFICIAIS.filter((f) => f.integracao === 'pendente');
    const nomesIntegradas = integradas.map((f) => f.nome).join(' e ');
    const comSucesso = integradas.filter(
      (f) => encontrarStatus(f, statuses)?.status === 'sucesso'
    ).length;
    const comErro = integradas.filter((f) => encontrarStatus(f, statuses)?.status === 'erro').length;
    return {
      total: FONTES_OFICIAIS.length,
      integradas: integradas.length,
      pendentes: pendentes.length,
      nomesIntegradas,
      comSucesso,
      comErro,
      houveSincronizacao: statuses.length > 0
    };
  }, [statuses]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testarFonteIndividual(selectedFonteSigla);
      if (!montadoRef.current) return;
      setTestResult({
        sucesso: res.sucesso,
        tempoMs: res.tempoMs,
        statusCode: res.statusCode,
        respostaBruta: res.respostaBruta,
        eventosEncontrados: res.eventosEncontrados,
        mensagem: res.mensagem
      });
    } catch (err: unknown) {
      if (!montadoRef.current) return;
      setTestResult({
        sucesso: false,
        respostaBruta: err instanceof Error ? err.message : 'Falha de rede ou timeout',
        eventosEncontrados: 0,
        mensagem:
          err instanceof Error
            ? `Erro inesperado ao executar o teste: ${err.message}`
            : 'Erro inesperado ao executar o teste'
      });
    } finally {
      if (montadoRef.current) setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Test Execution Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="max-w-2xl mb-6">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Diagnóstico e Testador de Fontes Legislativas
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Realize testes de conexão pontuais contra as fontes oficiais e inspecione o que foi realmente extraído em cada uma.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor="fonte-teste"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5"
            >
              Fonte a testar
            </label>
            <select
              id="fonte-teste"
              value={selectedFonteSigla}
              onChange={(e) => setSelectedFonteSigla(e.target.value)}
              disabled={isTesting}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
            >
              <optgroup label="Casas federais (Congresso Nacional)">
                {fontesFederais.map((f) => (
                  <option key={f.sigla} value={f.sigla}>
                    {f.nome} ({f.sigla})
                  </option>
                ))}
              </optgroup>
              <optgroup
                label={`${fontesEstaduais.length} Assembleias Legislativas Estaduais`}
              >
                {fontesEstaduais.map((f) => (
                  <option key={f.sigla} value={f.sigla}>
                    {f.uf} — {f.nome} ({f.sigla})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Câmara Legislativa do Distrito Federal (não é Assembleia Estadual)">
                {fontesDistritais.map((f) => (
                  <option key={f.sigla} value={f.sigla}>
                    {f.uf} — {f.nome} ({f.sigla})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
            type="button"
            onClick={handleTest}
            disabled={isTesting}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50 shadow-xs"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Testando Conexão...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Testar Fonte Selecionada</span>
              </>
            )}
          </button>
        </div>

        {/* Test Result Output Box */}
        {testResult && (
          <div className="mt-6 p-4 rounded-2xl border bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3 animate-fade-in">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {testResult.sucesso ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                )}
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {testResult.sucesso
                    ? 'Resposta recebida — a amostra abaixo precisa ser conferida'
                    : 'Falha na conexão'}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                {typeof testResult.statusCode === 'number' && (
                  <span>HTTP {testResult.statusCode}</span>
                )}
                {typeof testResult.tempoMs === 'number' && <span>{testResult.tempoMs} ms</span>}
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300">{testResult.mensagem}</p>

            {testResult.sucesso && (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  Um HTTP 200 significa apenas que o servidor respondeu: páginas de bloqueio
                  (WAF/captcha), avisos de manutenção e conteúdo montado por JavaScript também
                  retornam 200. Este teste não confirma que a fonte está saudável nem que os eventos
                  foram coletados.
                </span>
              </p>
            )}

            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Menções a mecanismos de participação na amostra:{' '}
              <span className="font-mono">{testResult.eventosEncontrados}</span>
              {testResult.eventosEncontrados === 0 &&
                ' — ausência de menções pode indicar bloqueio, conteúdo dinâmico ou simplesmente nenhuma audiência/consulta no período.'}
            </p>

            {testResult.respostaBruta && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Code className="w-3.5 h-3.5" /> Amostra do Payload / HTML Retornado
                </p>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48">
                  {testResult.respostaBruta}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sources Directory Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">
          Fontes Legislativas Catalogadas
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {resumo.integradas} de {resumo.total} fontes com coleta ativa nesta versão (
          {resumo.nomesIntegradas}). As outras {resumo.pendentes} casas estão catalogadas com
          endereço oficial, mas o app ainda não as consulta na sincronização.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
          O catálogo cobre o Congresso Nacional, {fontesEstaduais.length} Assembleias Legislativas
          Estaduais e a Câmara Legislativa do Distrito Federal. Nenhuma verificação periódica
          automática é feita: os dados são atualizados quando você aciona a sincronização.
          {resumo.houveSincronizacao && (
            <>
              {' '}
              Nesta sessão: {resumo.comSucesso} fonte(s) com sucesso
              {resumo.comErro > 0 ? `, ${resumo.comErro} com erro` : ''}.
            </>
          )}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">
              {resumo.total} fontes legislativas catalogadas, com tipo de integração, status real de
              sincronização e link para o portal oficial.
            </caption>
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th scope="col" className="pb-3 pl-2">UF</th>
                <th scope="col" className="pb-3">Casa Legislativa</th>
                <th scope="col" className="pb-3">Tipo de Integração</th>
                <th scope="col" className="pb-3">Status de Sincronização</th>
                <th scope="col" className="pb-3 pr-2 text-right">Portal Oficial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {FONTES_OFICIAIS.map((fonte) => {
                const statusDaFonte = encontrarStatus(fonte, statuses);
                const situacao = descreverFonte(fonte, statusDaFonte);
                const estilo = ESTILO_TOM[situacao.tom];
                // "Houve consulta de verdade nesta sessão" — é o que decide se a
                // casa tem coleta, e não o palpite estático do catálogo.
                const consultada = Boolean(statusDaFonte && statusDaFonte.status !== 'pendente');

                return (
                  <tr key={fonte.sigla} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 pl-2 font-mono font-bold text-slate-900 dark:text-white">
                      {fonte.uf}
                    </td>
                    <td className="py-3">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{fonte.nome}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{fonte.sigla}</p>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {fonte.tipo === 'api' ? 'API de dados abertos' : 'Coleta no portal oficial'}
                      </span>
                      <p className="text-[11px] mt-1 text-slate-500 dark:text-slate-400">
                        {consultada
                          ? 'Consultada nesta sessão'
                          : fonte.integracao === 'integrada'
                            ? 'Consultada na sincronização'
                            : 'Coleta ainda não implementada'}
                      </p>
                    </td>
                    <td className="py-3 align-top">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${estilo.pill}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${estilo.ponto}`} aria-hidden="true" />
                        {situacao.rotulo}
                      </span>
                      {situacao.detalhe && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {situacao.detalhe}
                        </p>
                      )}
                      {situacao.nota && (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
                          {situacao.nota}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-2 text-right align-top">
                      <a
                        href={fonte.urlBase}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium"
                      >
                        <span>Acessar</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
