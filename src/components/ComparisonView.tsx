import React, { useState } from 'react';
import { Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO, UFS_BRASIL } from '../services/config';
import { EventCard } from './EventCard';
import { BarChart2, GitCompare, Sparkles, Filter } from 'lucide-react';

interface ComparisonViewProps {
  todosEventos: Evento[];
  onOpenDetalhes: (evento: Evento) => void;
  favoritoIds: string[];
  onToggleFavorito: (id: string) => void;
  onShare: (evento: Evento) => void;
}

const TEMAS_SUGERIDOS = [
  'Meio Ambiente e Clima',
  'Educação',
  'Saúde e Saneamento',
  'Reforma Tributária e Finanças',
  'Transporte e Logística',
  'Tecnologia e Inovação'
];

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  todosEventos,
  onOpenDetalhes,
  favoritoIds,
  onToggleFavorito,
  onShare
}) => {
  const [selectedTema, setSelectedTema] = useState('Meio Ambiente e Clima');
  const [selectedMecanismo, setSelectedMecanismo] = useState<MecanismoParticipacao | 'todos'>('todos');
  const [customQuery, setCustomQuery] = useState('');

  const activeQuery = customQuery.trim() || selectedTema;

  // Filter events matching query
  const eventosFiltrados = todosEventos.filter(ev => {
    if (selectedMecanismo !== 'todos' && ev.mecanismo !== selectedMecanismo) {
      return false;
    }
    const q = activeQuery.toLowerCase();
    const tema = (ev.tema || '').toLowerCase();
    const comissao = (ev.comissao || '').toLowerCase();
    const props = (ev.proposicoes_relacionadas || []).join(' ').toLowerCase();

    // Split query terms for smart matching
    const terms = q.split(' ').filter(t => t.length > 2);
    if (terms.length === 0) return true;
    return terms.some(t => tema.includes(t) || comissao.includes(t) || props.includes(t));
  });

  // Group by UF
  const porUF = eventosFiltrados.reduce((acc, ev) => {
    if (!acc[ev.uf]) acc[ev.uf] = [];
    acc[ev.uf].push(ev);
    return acc;
  }, {} as Record<string, Evento[]>);

  const ufsPresentes = Object.keys(porUF).sort();

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Comparador Interestadual de Participação Cidadã
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          Compare simultaneamente como diferentes estados e o Congresso Nacional estão debatendo temas prioritários da sociedade.
        </p>

        {/* Preset Topic Pills */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Pautas para Comparação Imediata:</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {TEMAS_SUGERIDOS.map((tema) => (
              <button
                key={tema}
                onClick={() => {
                  setSelectedTema(tema);
                  setCustomQuery('');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  activeQuery.toLowerCase() === tema.toLowerCase()
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {tema}
              </button>
            ))}
          </div>

          {/* Custom Search in comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Ou digite uma pauta livre:
              </label>
              <input
                type="text"
                placeholder="Ex: Segurança pública, Juventude, Cultura..."
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Filtrar Mecanismo:
              </label>
              <select
                value={selectedMecanismo}
                onChange={(e) => setSelectedMecanismo(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todos">Todos os Mecanismos</option>
                {(Object.entries(MECANISMOS_INFO) as [MecanismoParticipacao, typeof MECANISMOS_INFO[MecanismoParticipacao]][]).map(([k, info]) => (
                  <option key={k} value={k}>
                    {info.emoji} {info.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Summary Banner */}
      <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs text-emerald-900 dark:text-emerald-200 font-medium">
            Resultado para <strong>&quot;{activeQuery}&quot;</strong>: {eventosFiltrados.length} evento(s) distribuídos em <strong>{ufsPresentes.length} localidades</strong> brasileiras.
          </span>
        </div>
      </div>

      {/* States Side-by-Side Comparison */}
      {ufsPresentes.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Nenhum evento localizado com o termo &quot;{activeQuery}&quot;
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Tente outro tema ou selecione um dos atalhos sugeridos acima.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ufsPresentes.map((uf) => {
            const list = porUF[uf];
            const nomeUf = UFS_BRASIL.find(u => u.sigla === uf)?.nome || (uf === 'DF' ? 'Distrito Federal / Federal' : uf);

            return (
              <div
                key={uf}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold flex items-center justify-center text-xs">
                      {uf}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {nomeUf}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {list[0]?.casa_nome}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {list.length} {list.length === 1 ? 'evento' : 'eventos'}
                  </span>
                </div>

                <div className="space-y-3">
                  {list.map(evento => (
                    <EventCard
                      key={evento.id}
                      evento={evento}
                      isFavorito={favoritoIds.includes(evento.id)}
                      onToggleFavorito={onToggleFavorito}
                      onOpenDetalhes={onOpenDetalhes}
                      onShare={onShare}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
