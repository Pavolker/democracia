import React, { useState } from 'react';
import { Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO, UFS_BRASIL } from '../services/config';
import { compararPorDataHora } from '../services/datas';
import { casasDisponiveis, chaveUF, ehDemonstracao } from '../services/eventos';
import { eventoCorrespondeBusca, normalizar } from '../services/texto';
import { EventCard } from './EventCard';
import { BarChart2, GitCompare, Sparkles } from 'lucide-react';

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

/** Eventos renderizados antes do primeiro "mostrar mais". */
const LIMITE_INICIAL = 30;
/** Quantos eventos cada clique em "mostrar mais" acrescenta. */
const PASSO = 30;

const ID_PAUTA = 'comparador-pauta-livre';
const ID_MECANISMO = 'comparador-mecanismo';

/** Selo usado em qualquer linha de evento de demonstração. */
const BadgeExemplo: React.FC = () => (
  <span
    title="Evento de demonstração: amostra ilustrativa mantida no app, não é dado oficial."
    className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
  >
    Exemplo
  </span>
);

/** Nome legível da localidade de agrupamento ('FEDERAL' não é uma UF). */
function nomeLocalidade(chave: string): string {
  if (chave === 'FEDERAL') return 'Congresso Nacional (Federal)';
  return UFS_BRASIL.find((u) => u.sigla === chave)?.nome || chave;
}

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
  const [limite, setLimite] = useState(LIMITE_INICIAL);

  const activeQuery = customQuery.trim() || selectedTema;

  // Correspondência conjuntiva: todos os termos buscados precisam aparecer no
  // evento (tema, comissão, local, casa, UF e proposições), sem acento e sem
  // caixa. Antes cada palavra era testada isoladamente (OR), então
  // "Reforma Tributária e Finanças" trazia qualquer evento com "reforma".
  const eventosFiltrados = todosEventos.filter((ev) => {
    if (selectedMecanismo !== 'todos' && ev.mecanismo !== selectedMecanismo) return false;
    return eventoCorrespondeBusca(ev, activeQuery);
  });

  // Agrupa por localidade de verdade: eventos federais não são Distrito Federal.
  const porLocalidade = new Map<string, Evento[]>();
  for (const ev of eventosFiltrados) {
    const chave = chaveUF(ev);
    const lista = porLocalidade.get(chave);
    if (lista) {
      lista.push(ev);
    } else {
      porLocalidade.set(chave, [ev]);
    }
  }
  for (const lista of porLocalidade.values()) lista.sort(compararPorDataHora);
  const chaves = Array.from(porLocalidade.keys()).sort();

  // Limite de renderização: as localidades entram inteiras até o teto; a que
  // cruzar o teto aparece truncada e diz isso na própria seção.
  const gruposVisiveis: Array<{ chave: string; eventos: Evento[]; totalNoGrupo: number }> = [];
  let restante = limite;
  for (const chave of chaves) {
    if (restante <= 0) break;
    const lista = porLocalidade.get(chave) || [];
    const visiveis = lista.slice(0, restante);
    gruposVisiveis.push({ chave, eventos: visiveis, totalNoGrupo: lista.length });
    restante -= visiveis.length;
  }

  const totalCorrespondentes = eventosFiltrados.length;
  const exibidos = gruposVisiveis.reduce((soma, g) => soma + g.eventos.length, 0);
  const restam = totalCorrespondentes - exibidos;
  const totalDemonstracao = eventosFiltrados.filter(ehDemonstracao).length;

  const selecionarTema = (tema: string) => {
    setSelectedTema(tema);
    setCustomQuery('');
    setLimite(LIMITE_INICIAL);
  };

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
          Compare como cada estado e o Congresso Nacional aparecem na agenda carregada para os termos
          que você escolher. O recorte considera toda a agenda disponível no momento, inclusive
          eventos já realizados.
        </p>

        {/* Preset Topic Pills */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Pautas para Comparação Imediata:</span>
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Pautas sugeridas para comparação">
            {TEMAS_SUGERIDOS.map((tema) => {
              const selecionado = normalizar(activeQuery) === normalizar(tema);
              return (
                <button
                  type="button"
                  key={tema}
                  onClick={() => selecionarTema(tema)}
                  aria-pressed={selecionado}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    selecionado
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tema}
                </button>
              );
            })}
          </div>

          {/* Custom Search in comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label
                htmlFor={ID_PAUTA}
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Ou digite uma pauta livre:
              </label>
              <input
                id={ID_PAUTA}
                type="text"
                placeholder="Ex: Segurança pública, Juventude, Cultura..."
                value={customQuery}
                onChange={(e) => {
                  setCustomQuery(e.target.value);
                  setLimite(LIMITE_INICIAL);
                }}
                aria-describedby={`${ID_PAUTA}-ajuda`}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p
                id={`${ID_PAUTA}-ajuda`}
                className="text-[11px] text-slate-400 dark:text-slate-500 mt-1"
              >
                Busca conjuntiva: todos os termos digitados precisam aparecer no evento, sem acento e
                sem distinção de maiúsculas.
              </p>
            </div>

            <div>
              <label
                htmlFor={ID_MECANISMO}
                className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Filtrar Mecanismo:
              </label>
              <select
                id={ID_MECANISMO}
                value={selectedMecanismo}
                onChange={(e) => {
                  setSelectedMecanismo(e.target.value as MecanismoParticipacao | 'todos');
                  setLimite(LIMITE_INICIAL);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todos">Todos os Mecanismos</option>
                {(
                  Object.entries(MECANISMOS_INFO) as [
                    MecanismoParticipacao,
                    (typeof MECANISMOS_INFO)[MecanismoParticipacao]
                  ][]
                ).map(([k, info]) => (
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
      <div className="space-y-2">
        <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl">
          <div className="flex items-center gap-3">
            <BarChart2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs text-emerald-900 dark:text-emerald-200 font-medium">
              Resultado para <strong>&quot;{activeQuery}&quot;</strong>: {totalCorrespondentes}{' '}
              evento(s) em <strong>{chaves.length} localidade(s)</strong> para os termos buscados
              {selectedMecanismo !== 'todos'
                ? ` (somente ${MECANISMOS_INFO[selectedMecanismo].nome}).`
                : '.'}
            </span>
          </div>
        </div>

        {totalDemonstracao > 0 && (
          <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl px-3 py-2">
            A base comparada inclui {totalDemonstracao} evento(s) de demonstração, marcados com o selo
            &quot;Exemplo&quot;: são amostras ilustrativas mantidas no app e não dados oficiais.
          </p>
        )}

        {restam > 0 && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Exibindo {exibidos} de {totalCorrespondentes} evento(s) correspondentes; use
            &quot;mostrar mais&quot; abaixo para carregar o restante.
          </p>
        )}
      </div>

      {/* Localities Side-by-Side Comparison */}
      {chaves.length === 0 ? (
        <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Nenhum evento reúne todos os termos buscados: &quot;{activeQuery}&quot;
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Tente um termo mais curto, remova uma palavra ou selecione um dos atalhos sugeridos acima.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {gruposVisiveis.map(({ chave, eventos, totalNoGrupo }) => {
            // As casas listadas vêm do grupo inteiro, não só dos cards visíveis.
            const casas = casasDisponiveis(porLocalidade.get(chave) || eventos);
            const truncadoNoGrupo = eventos.length < totalNoGrupo;

            return (
              <div
                key={chave}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="min-w-8 h-8 px-1.5 rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 font-mono font-bold flex items-center justify-center text-[10px]">
                      {chave}
                    </span>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {nomeLocalidade(chave)}
                      </h4>
                      <p
                        className="text-[11px] text-slate-400 font-mono"
                        title={casas.length > 0 ? casas.join(', ') : undefined}
                      >
                        {casas.length > 0
                          ? `${casas.length} casa(s): ${casas.join(', ')}`
                          : 'Casa não informada nos eventos deste recorte'}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {totalNoGrupo} {totalNoGrupo === 1 ? 'evento' : 'eventos'}
                  </span>
                </div>

                {truncadoNoGrupo && (
                  <p className="text-[11px] text-slate-400">
                    Exibindo os {eventos.length} primeiros eventos desta localidade, de {totalNoGrupo}{' '}
                    no total.
                  </p>
                )}

                <div className="space-y-3">
                  {eventos.map((evento) => (
                    <div key={evento.id} className="space-y-1.5">
                      {ehDemonstracao(evento) && <BadgeExemplo />}
                      <EventCard
                        evento={evento}
                        isFavorito={favoritoIds.includes(evento.id)}
                        onToggleFavorito={onToggleFavorito}
                        onOpenDetalhes={onOpenDetalhes}
                        onShare={onShare}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {restam > 0 && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => setLimite((atual) => atual + PASSO)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500 font-bold text-xs shadow-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            Mostrar mais {Math.min(PASSO, restam)} evento(s)
          </button>
        </div>
      )}
    </div>
  );
};
