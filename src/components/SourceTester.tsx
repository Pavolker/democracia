import React, { useState } from 'react';
import { FONTES_OFICIAIS } from '../services/config';
import { testarFonteIndividual } from '../services/scraper';
import { ScraperStatus } from '../types';
import { ExternalLink, Play, CheckCircle2, AlertTriangle, Loader2, Code, ShieldCheck } from 'lucide-react';

interface SourceTesterProps {
  statuses: ScraperStatus[];
}

export const SourceTester: React.FC<SourceTesterProps> = ({ statuses }) => {
  const [selectedFonteSigla, setSelectedFonteSigla] = useState('Câmara');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testarFonteIndividual(selectedFonteSigla);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        sucesso: false,
        mensagem: err.message || 'Erro inesperado ao executar teste',
        respostaBruta: ''
      });
    } finally {
      setIsTesting(false);
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
            Realize testes de conexão pontuais contra as fontes oficiais (APIs de dados abertos ou raspagem via proxy CORS) e inspecione a resposta bruta.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <select
              value={selectedFonteSigla}
              onChange={(e) => setSelectedFonteSigla(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <optgroup label="Casas Federais">
                <option value="Câmara">Câmara dos Deputados (API REST)</option>
                <option value="Senado">Senado Federal (e-Cidadania)</option>
              </optgroup>
              <optgroup label="27 Assembleias Legislativas Estaduais">
                {FONTES_OFICIAIS.filter(f => f.uf !== 'FEDERAL').map(f => (
                  <option key={f.sigla} value={f.sigla}>
                    {f.uf} - {f.nome} ({f.sigla})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <button
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult.sucesso ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                )}
                <span className="font-bold text-xs text-slate-900 dark:text-white">
                  {testResult.sucesso ? 'Teste Concluído com Sucesso' : 'Falha na Conexão'}
                </span>
              </div>

              {testResult.tempoMs && (
                <span className="text-xs font-mono text-slate-400">
                  Latência: {testResult.tempoMs}ms
                </span>
              )}
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300">
              {testResult.mensagem}
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
          Mapeamento Oficial de Fontes Legislativas
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Todas as 27 Assembleias Estaduais e o Congresso Nacional cadastrados para verificação periódica.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="pb-3 pl-2">UF</th>
                <th className="pb-3">Casa Legislativa</th>
                <th className="pb-3">Tipo de Integração</th>
                <th className="pb-3">Status de Sincronização</th>
                <th className="pb-3 pr-2 text-right">Portal Oficial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {FONTES_OFICIAIS.map((fonte) => {
                const statusObj = statuses.find(s => s.uf === fonte.uf || s.fonteId.toLowerCase() === fonte.sigla.toLowerCase());

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
                        {fonte.tipo === 'api' ? 'API REST' : 'HTML Scraping + Proxy'}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {statusObj ? statusObj.mensagem || 'Mapeado & Operacional' : 'Operacional'}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right">
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
