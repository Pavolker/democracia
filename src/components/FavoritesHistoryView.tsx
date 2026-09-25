import React, { useState } from 'react';
import { Evento } from '../types';
import { EventCard } from './EventCard';
import { storage } from '../services/storage';
import { Star, Clock, Trash2, Search, ArrowRight } from 'lucide-react';

interface FavoritesHistoryViewProps {
  todosEventos: Evento[];
  favoritoIds: string[];
  onToggleFavorito: (id: string) => void;
  onOpenDetalhes: (evento: Evento) => void;
  onShare: (evento: Evento) => void;
  onSelectSearchTerm: (termo: string) => void;
}

export const FavoritesHistoryView: React.FC<FavoritesHistoryViewProps> = ({
  todosEventos,
  favoritoIds,
  onToggleFavorito,
  onOpenDetalhes,
  onShare,
  onSelectSearchTerm
}) => {
  const [subTab, setSubTab] = useState<'favoritos' | 'visualizados' | 'buscas'>('favoritos');

  const favoritos = todosEventos.filter(e => favoritoIds.includes(e.id));
  const visualizados = storage.getVisualizados();
  const [buscas, setBuscas] = useState<string[]>(() => storage.getBuscas());

  const handleClearBuscas = () => {
    storage.clearBuscas();
    setBuscas([]);
  };

  return (
    <div className="space-y-6">
      {/* Sub tabs navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setSubTab('favoritos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'favoritos'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Star className="w-4 h-4 fill-current" />
          <span>Favoritos ({favoritos.length})</span>
        </button>

        <button
          onClick={() => setSubTab('visualizados')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'visualizados'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Histórico de Visualização ({visualizados.length})</span>
        </button>

        <button
          onClick={() => setSubTab('buscas')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'buscas'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Buscas Recentes ({buscas.length})</span>
        </button>
      </div>

      {/* 1. Favoritos Tab */}
      {subTab === 'favoritos' && (
        <div>
          {favoritos.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
              <Star className="w-12 h-12 text-amber-300 dark:text-amber-500/40 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Nenhum evento favoritado ainda
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Ao navegar pelas audiências ou consultas, clique no ícone de estrela para salvar eventos importantes e acessá-los rapidamente aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoritos.map(evento => (
                <EventCard
                  key={evento.id}
                  evento={evento}
                  isFavorito={true}
                  onToggleFavorito={onToggleFavorito}
                  onOpenDetalhes={onOpenDetalhes}
                  onShare={onShare}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Visualizados Recentes Tab */}
      {subTab === 'visualizados' && (
        <div>
          {visualizados.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
              <Clock className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Seu histórico está vazio
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Conforme você abrir os detalhes dos debates e consultas legislativas, eles ficarão registrados nesta linha do tempo.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visualizados.map((evento, idx) => (
                <div
                  key={`${evento.id}-${idx}`}
                  onClick={() => onOpenDetalhes(evento)}
                  className="group flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 rounded-2xl cursor-pointer transition-all shadow-xs"
                >
                  <div className="space-y-1 pr-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {evento.casa} · {evento.uf}
                      </span>
                      <span>{evento.data} às {evento.hora}</span>
                    </div>
                    <h5 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      {evento.tema}
                    </h5>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Buscas Recentes Tab */}
      {subTab === 'buscas' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">
              Termos Pesquisados
            </h4>
            {buscas.length > 0 && (
              <button
                onClick={handleClearBuscas}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
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
              {buscas.map((termo, i) => (
                <button
                  key={i}
                  onClick={() => onSelectSearchTerm(termo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 text-slate-700 dark:text-slate-300 text-xs font-medium border border-transparent hover:border-emerald-300 transition-colors"
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
