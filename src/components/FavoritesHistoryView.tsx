import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Evento } from '../types';
import { EventCard } from './EventCard';
import { storage } from '../services/storage';
import { formatarDataCurta } from '../services/datas';
import { chaveUF } from '../services/eventos';
import { Star, Clock, Trash2, Search, ArrowRight } from 'lucide-react';

interface FavoritesHistoryViewProps {
  todosEventos: Evento[];
  favoritoIds: string[];
  onToggleFavorito: (id: string) => void;
  onOpenDetalhes: (evento: Evento) => void;
  onShare: (evento: Evento) => void;
  onSelectSearchTerm: (termo: string) => void;
}

type SubTab = 'favoritos' | 'visualizados' | 'buscas';

const ORDEM_ABAS: SubTab[] = ['favoritos', 'visualizados', 'buscas'];

/** Limite aplicado por `storage.addVisualizado` no armazenamento local. */
const LIMITE_VISUALIZADOS = 30;

export const FavoritesHistoryView: React.FC<FavoritesHistoryViewProps> = ({
  todosEventos,
  favoritoIds,
  onToggleFavorito,
  onOpenDetalhes,
  onShare,
  onSelectSearchTerm
}) => {
  const [subTab, setSubTab] = useState<SubTab>('favoritos');
  // Lido uma vez na montagem; a partir daí só é relido quando o histórico pode
  // ter mudado (aba reaberta, janela refocada, detalhes abertos aqui dentro).
  const [visualizados, setVisualizados] = useState<Evento[]>(() => storage.getVisualizados());
  const [buscas, setBuscas] = useState<string[]>(() => storage.getBuscas());

  const refsAbas = useRef<Record<SubTab, HTMLButtonElement | null>>({
    favoritos: null,
    visualizados: null,
    buscas: null
  });

  const recarregarHistoricos = useCallback(() => {
    setVisualizados(storage.getVisualizados());
    setBuscas(storage.getBuscas());
  }, []);

  useEffect(() => {
    // A aba é montada ao ser aberta, então esta leitura cobre cada abertura;
    // o listener cobre o caso de a janela voltar ao foco com a aba já aberta.
    recarregarHistoricos();

    const aoVoltarParaAba = () => {
      if (!document.hidden) recarregarHistoricos();
    };

    document.addEventListener('visibilitychange', aoVoltarParaAba);
    window.addEventListener('focus', aoVoltarParaAba);
    return () => {
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
      window.removeEventListener('focus', aoVoltarParaAba);
    };
  }, [recarregarHistoricos]);

  const favoritos = todosEventos.filter((e) => favoritoIds.includes(e.id));
  const idsNaAgenda = new Set(todosEventos.map((e) => e.id));

  // Ids favoritados que não existem mais na agenda carregada: o contador do
  // cabeçalho os incluiria sem que a lista pudesse mostrá-los.
  const favoritosForaDaAgenda = Math.max(0, favoritoIds.length - favoritos.length);
  const visualizadosForaDaAgenda = visualizados.filter((v) => !idsNaAgenda.has(v.id)).length;

  const ativarAba = (aba: SubTab) => {
    setSubTab(aba);
    if (aba === 'visualizados') setVisualizados(storage.getVisualizados());
    if (aba === 'buscas') setBuscas(storage.getBuscas());
  };

  const aoTeclarNaAba = (e: React.KeyboardEvent<HTMLButtonElement>, indice: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') {
      return;
    }
    e.preventDefault();
    const total = ORDEM_ABAS.length;
    let alvo = indice;
    if (e.key === 'ArrowRight') alvo = (indice + 1) % total;
    else if (e.key === 'ArrowLeft') alvo = (indice - 1 + total) % total;
    else if (e.key === 'Home') alvo = 0;
    else alvo = total - 1;

    const destino = ORDEM_ABAS[alvo];
    ativarAba(destino);
    refsAbas.current[destino]?.focus();
  };

  const abrirDetalhes = (evento: Evento) => {
    onOpenDetalhes(evento);
    // `onOpenDetalhes` grava a visualização no storage; reler aqui evita que o
    // painel continue mostrando a lista anterior.
    setVisualizados(storage.getVisualizados());
  };

  const handleClearBuscas = () => {
    storage.clearBuscas();
    setBuscas([]);
  };

  const abas: Array<{ id: SubTab; Icone: LucideIcon; rotulo: string; ativo: string }> = [
    {
      id: 'favoritos',
      Icone: Star,
      rotulo: `Favoritos (${favoritos.length})`,
      ativo: 'bg-amber-500 text-white shadow-xs'
    },
    {
      id: 'visualizados',
      Icone: Clock,
      rotulo: `Histórico de Visualização (${visualizados.length})`,
      ativo: 'bg-emerald-600 text-white shadow-xs'
    },
    {
      id: 'buscas',
      Icone: Search,
      rotulo: `Buscas Recentes (${buscas.length})`,
      ativo: 'bg-blue-600 text-white shadow-xs'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Sub tabs navigation */}
      <div
        role="tablist"
        aria-label="Favoritos, histórico de visualização e buscas recentes"
        className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2"
      >
        {abas.map(({ id, Icone, rotulo, ativo }, indice) => {
          const selecionada = subTab === id;
          return (
            <button
              type="button"
              key={id}
              ref={(el) => {
                refsAbas.current[id] = el;
              }}
              role="tab"
              id={`aba-${id}`}
              aria-selected={selecionada}
              aria-controls={`painel-${id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => ativarAba(id)}
              onKeyDown={(e) => aoTeclarNaAba(e, indice)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                selecionada
                  ? ativo
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icone className="w-4 h-4" />
              <span>{rotulo}</span>
            </button>
          );
        })}
      </div>

      {/* 1. Favoritos Tab */}
      {subTab === 'favoritos' && (
        <div
          role="tabpanel"
          id="painel-favoritos"
          aria-labelledby="aba-favoritos"
          tabIndex={0}
          className="space-y-4 focus:outline-none"
        >
          {favoritosForaDaAgenda > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl px-3 py-2">
              {favoritosForaDaAgenda} de {favoritoIds.length} favorito(s) salvos não estão na agenda
              atual: continuam guardados no navegador, mas não há evento correspondente para listar
              agora. Eles voltam a aparecer se o evento retornar à agenda.
            </p>
          )}

          {favoritos.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
              <Star className="w-12 h-12 text-amber-300 dark:text-amber-500/40 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Nenhum evento favoritado ainda
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Ao navegar pelas audiências ou consultas, clique no ícone de estrela para salvar
                eventos importantes e acessá-los rapidamente aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoritos.map((evento) => (
                <EventCard
                  key={evento.id}
                  evento={evento}
                  isFavorito={true}
                  onToggleFavorito={onToggleFavorito}
                  onOpenDetalhes={abrirDetalhes}
                  onShare={onShare}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Visualizados Recentes Tab */}
      {subTab === 'visualizados' && (
        <div
          role="tabpanel"
          id="painel-visualizados"
          aria-labelledby="aba-visualizados"
          tabIndex={0}
          className="space-y-4 focus:outline-none"
        >
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Histórico guardado apenas no seu navegador: os últimos {LIMITE_VISUALIZADOS} eventos
            abertos, mais recentes primeiro. Os mais antigos saem da lista automaticamente e o app
            ainda não oferece um botão para apagar este histórico.
          </p>

          {visualizadosForaDaAgenda > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {visualizadosForaDaAgenda} evento(s) deste histórico não estão na agenda carregada
              agora; o registro local é exibido exatamente como foi salvo.
            </p>
          )}

          {visualizados.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
              <Clock className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Seu histórico está vazio
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Conforme você abrir os detalhes dos debates e consultas legislativas, eles ficarão
                registrados nesta linha do tempo, até o limite de {LIMITE_VISUALIZADOS} eventos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visualizados.map((evento) => (
                <button
                  type="button"
                  key={evento.id}
                  onClick={() => abrirDetalhes(evento)}
                  aria-label={`Abrir detalhes de ${evento.tema} — ${evento.casa}, ${formatarDataCurta(
                    evento.data
                  )} às ${evento.hora}`}
                  className="group w-full text-left flex items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 rounded-2xl cursor-pointer transition-all shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {evento.casa} · {chaveUF(evento)}
                      </span>
                      <span>
                        {formatarDataCurta(evento.data)} às {evento.hora}
                      </span>
                    </div>
                    <h5 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {evento.tema}
                    </h5>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Buscas Recentes Tab */}
      {subTab === 'buscas' && (
        <div
          role="tabpanel"
          id="painel-buscas"
          aria-labelledby="aba-buscas"
          tabIndex={0}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 focus:outline-none"
        >
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Termos Pesquisados</h4>
            {buscas.length > 0 && (
              <button
                type="button"
                onClick={handleClearBuscas}
                aria-label={`Limpar os ${buscas.length} termos do histórico de buscas`}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 rounded-md px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar histórico
              </button>
            )}
          </div>

          {buscas.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              Nenhuma busca registrada no navegador.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {buscas.map((termo) => (
                <button
                  type="button"
                  key={termo}
                  onClick={() => onSelectSearchTerm(termo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 text-xs font-medium border border-transparent hover:border-emerald-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <Search className="w-3 h-3 text-slate-400" />
                  <span>{termo}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
