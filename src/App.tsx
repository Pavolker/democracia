import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Evento, FiltrosState, MecanismoParticipacao, ScraperStatus, AlertaCidadao } from './types';
import { MECANISMOS_INFO } from './services/config';
import { buscarTodosEventos } from './services/scraper';
import { storage } from './services/storage';
import { Header, TabType } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { FilterSidebar } from './components/FilterSidebar';
import { EventCard } from './components/EventCard';
import { EventModal } from './components/EventModal';
import { BrazilMap } from './components/BrazilMap';
import { CalendarHeatmap } from './components/CalendarHeatmap';
import { FavoritesHistoryView } from './components/FavoritesHistoryView';
import { AlertsManager } from './components/AlertsManager';
import { SourceTester } from './components/SourceTester';
import { ComparisonView } from './components/ComparisonView';
import { Sparkles, Calendar, Search, ArrowUpDown, ChevronDown } from 'lucide-react';

const ITEMS_PER_PAGE = 50;

export default function App() {
  // Main Data States
  const [eventos, setEventos] = useState<Evento[]>(() => {
    return storage.getCachedEventos() || [];
  });
  const [statuses, setStatuses] = useState<ScraperStatus[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(() => storage.getUltimaAtualizacao());

  // UI States
  const [currentTab, setCurrentTab] = useState<TabType>('eventos');
  const [selectedEventModal, setSelectedEventModal] = useState<Evento | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Preference States
  const [favoritos, setFavoritos] = useState<string[]>(() => storage.getFavoritos());
  const [alertas, setAlertas] = useState<AlertaCidadao[]>(() => storage.getAlertas());
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() => storage.getTema());
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => storage.getAutoUpdate());

  // Filters State
  const [filtros, setFiltros] = useState<FiltrosState>({
    uf: 'TODAS',
    mecanismos: Object.keys(MECANISMOS_INFO) as MecanismoParticipacao[],
    periodo: 'todos',
    busca: '',
    casa: '',
    nivel: ''
  });

  // Toast Notification Trigger
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Theme Management
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (theme === 'dark' || (theme === 'system' && mediaQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [theme]);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(nextTheme);
    storage.setTema(nextTheme);
  };

  // PWA Service Worker Registration
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('SW registration skipped or failed:', err);
      });
    }
  }, []);

  // Fetch / Sync Data
  const sincronizarDados = useCallback(async () => {
    setIsUpdating(true);
    try {
      const result = await buscarTodosEventos((status) => {
        setStatuses((prev) => {
          const idx = prev.findIndex((s) => s.fonteId === status.fonteId);
          if (idx > -1) {
            const copy = [...prev];
            copy[idx] = status;
            return copy;
          }
          return [...prev, status];
        });
      });

      setEventos(result.eventos);
      storage.setCachedEventos(result.eventos);
      const nowIso = new Date().toISOString();
      setUltimaAtualizacao(nowIso);
      showToast(`${result.eventos.length} eventos consolidados com sucesso!`);
    } catch (e: any) {
      console.error('Falha ao sincronizar:', e);
      showToast('Erro ao atualizar fontes. Mantendo dados em cache.');
    } finally {
      setIsUpdating(false);
    }
  }, [showToast]);

  // Initial Data Load
  useEffect(() => {
    if (eventos.length === 0) {
      sincronizarDados();
    }
  }, [eventos.length, sincronizarDados]);

  // Auto-Update Interval (30 minutes)
  useEffect(() => {
    if (!autoUpdate) return;
    const intervalMs = 30 * 60 * 1000;
    const interval = setInterval(() => {
      sincronizarDados();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [autoUpdate, sincronizarDados]);

  const handleToggleAutoUpdate = () => {
    const novo = !autoUpdate;
    setAutoUpdate(novo);
    storage.setAutoUpdate(novo);
    showToast(novo ? 'Atualização automática ativada (30m)' : 'Atualização automática desligada');
  };

  // Favorites Handlers
  const handleToggleFavorito = (id: string) => {
    const added = storage.toggleFavorito(id);
    setFavoritos(storage.getFavoritos());
    showToast(added ? 'Evento adicionado aos seus favoritos ⭐' : 'Evento removido dos favoritos');
  };

  // Open Details Modal & Record View History
  const handleOpenDetalhes = (evento: Evento) => {
    setSelectedEventModal(evento);
    storage.addVisualizado(evento);
  };

  // Share Event Handler
  const handleShare = async (evento: Evento) => {
    const shareData = {
      title: `[${evento.casa}] ${evento.tema}`,
      text: `Participe: ${evento.tema} - ${evento.data} às ${evento.hora} na ${evento.casa_nome}.`,
      url: evento.link_oficial || window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareData.text} Saiba mais: ${shareData.url}`);
      showToast('Link e detalhes copiados para a área de transferência! 📋');
    } catch {
      showToast('Não foi possível copiar o link.');
    }
  };

  // Alerts Management
  const handleAddAlerta = (novo: Omit<AlertaCidadao, 'id' | 'data_criacao'>) => {
    const criado = storage.addAlerta(novo);
    setAlertas(storage.getAlertas());
    showToast(`Alerta criado para "${criado.tema}" 🔔`);
  };

  const handleRemoveAlerta = (id: string) => {
    storage.removeAlerta(id);
    setAlertas(storage.getAlertas());
    showToast('Alerta removido.');
  };

  const handleToggleAlertaAtivo = (id: string) => {
    storage.toggleAlertaAtivo(id);
    setAlertas(storage.getAlertas());
  };

  // Count active alerts
  const totalAlertasAtivos = alertas.filter((a) => a.ativo).length;

  // Filtered Events
  const eventosFiltrados = useMemo(() => {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    // Tomorrow
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toISOString().split('T')[0];

    // End of 7 days
    const em7Dias = new Date(hoje);
    em7Dias.setDate(em7Dias.getDate() + 7);
    const em7DiasStr = em7Dias.toISOString().split('T')[0];

    // Current month YYYY-MM
    const mesAtual = hojeStr.slice(0, 7);

    return eventos.filter((ev) => {
      // 1. UF filter
      if (filtros.uf !== 'TODAS') {
        if (filtros.uf === 'FEDERAL') {
          if (ev.nivel !== 'federal' && ev.uf !== 'DF') return false;
        } else if (ev.uf !== filtros.uf) {
          return false;
        }
      }

      // 2. Mechanism filter
      if (!filtros.mecanismos.includes(ev.mecanismo)) {
        return false;
      }

      // 3. Date / Period filter
      if (filtros.periodo === 'hoje' && ev.data !== hojeStr) {
        return false;
      }
      if (filtros.periodo === 'amanha' && ev.data !== amanhaStr) {
        return false;
      }
      if (filtros.periodo === 'semana') {
        if (ev.data < hojeStr || ev.data > em7DiasStr) return false;
      }
      if (filtros.periodo === 'mes') {
        if (!ev.data.startsWith(mesAtual)) return false;
      }
      if (filtros.periodo === 'personalizado') {
        if (filtros.dataInicio && ev.data < filtros.dataInicio) return false;
        if (filtros.dataFim && ev.data > filtros.dataFim) return false;
      }

      // 4. House filter
      if (filtros.casa && ev.casa !== filtros.casa) {
        return false;
      }

      // 5. Nivel filter
      if (filtros.nivel && ev.nivel !== filtros.nivel) {
        return false;
      }

      // 6. Search query
      if (filtros.busca && filtros.busca.trim()) {
        const q = filtros.busca.toLowerCase().trim();
        const tema = (ev.tema || '').toLowerCase();
        const comissao = (ev.comissao || '').toLowerCase();
        const local = (ev.local || '').toLowerCase();
        const casa = (ev.casa_nome || '').toLowerCase();
        const props = (ev.proposicoes_relacionadas || []).join(' ').toLowerCase();

        const match =
          tema.includes(q) ||
          comissao.includes(q) ||
          local.includes(q) ||
          casa.includes(q) ||
          props.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [eventos, filtros]);

  // Record Search history when search term is applied
  useEffect(() => {
    if (filtros.busca && filtros.busca.trim().length >= 3) {
      storage.addBusca(filtros.busca);
    }
  }, [filtros.busca]);

  // Available houses for the filter dropdown
  const casasDisponiveis = useMemo(() => {
    const set = new Set<string>();
    eventos.forEach((e) => {
      if (e.casa) set.add(e.casa);
    });
    return Array.from(set).sort();
  }, [eventos]);

  // Events count grouped by UF (for Brazil Map & stats)
  const eventosCountPorUF = useMemo(() => {
    return eventos.reduce((acc, ev) => {
      acc[ev.uf] = (acc[ev.uf] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [eventos]);

  // Paged items to show
  const eventosExibidos = useMemo(() => {
    return eventosFiltrados.slice(0, visibleCount);
  }, [eventosFiltrados, visibleCount]);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white dark:bg-emerald-600 dark:text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 dark:border-emerald-500 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Global Header */}
      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isUpdating={isUpdating}
        onRefresh={sincronizarDados}
        ultimaAtualizacao={ultimaAtualizacao}
        totalFavoritos={favoritos.length}
        totalAlertasAtivos={totalAlertasAtivos}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        autoUpdate={autoUpdate}
        onToggleAutoUpdate={handleToggleAutoUpdate}
        onOpenMobileFilters={() => setMobileFilterOpen(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. AGENDA GERAL TAB */}
        {currentTab === 'eventos' && (
          <div className="space-y-6">
            {/* Overview Stats Bar */}
            <StatsOverview
              eventos={eventos}
              onFilterByMecanismo={(mec) => {
                setFiltros((prev) => ({
                  ...prev,
                  mecanismos: [mec]
                }));
              }}
            />

            {/* Layout with Sidebar + Event Cards */}
            <div className="flex gap-6 items-start">
              <FilterSidebar
                filtros={filtros}
                onChangeFiltros={setFiltros}
                casasDisponiveis={casasDisponiveis}
                totalFiltrados={eventosFiltrados.length}
                totalGeral={eventos.length}
                isMobileOpen={mobileFilterOpen}
                onCloseMobile={() => setMobileFilterOpen(false)}
              />

              {/* Main Events Feed */}
              <div className="flex-1 space-y-4 min-w-0">
                {/* Active Filters Summary Pills */}
                {(filtros.uf !== 'TODAS' ||
                  filtros.periodo !== 'todos' ||
                  filtros.mecanismos.length !== 5 ||
                  filtros.busca ||
                  filtros.casa) && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-semibold text-slate-500">Filtros ativos:</span>
                    {filtros.uf !== 'TODAS' && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                        UF: {filtros.uf}
                      </span>
                    )}
                    {filtros.periodo !== 'todos' && (
                      <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">
                        Período: {filtros.periodo}
                      </span>
                    )}
                    {filtros.mecanismos.length !== 5 && (
                      <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-medium">
                        {filtros.mecanismos.length} mecanismos selecionados
                      </span>
                    )}
                    {filtros.busca && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                        &quot;{filtros.busca}&quot;
                      </span>
                    )}
                    {filtros.casa && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium">
                        Casa: {filtros.casa}
                      </span>
                    )}
                    <button
                      onClick={() =>
                        setFiltros({
                          uf: 'TODAS',
                          mecanismos: Object.keys(MECANISMOS_INFO) as MecanismoParticipacao[],
                          periodo: 'todos',
                          busca: '',
                          casa: '',
                          nivel: ''
                        })
                      }
                      className="text-xs text-red-500 hover:underline ml-auto font-medium"
                    >
                      Limpar todos
                    </button>
                  </div>
                )}

                {/* Empty State */}
                {eventosFiltrados.length === 0 ? (
                  <div className="text-center py-20 px-6 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl space-y-3">
                    <Search className="w-12 h-12 text-slate-400 mx-auto" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                      Nenhum evento encontrado para este filtro
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      Tente ampliar o período da busca, selecionar mais mecanismos ou buscar por termos mais genéricos como &quot;Educação&quot;, &quot;Saúde&quot; ou &quot;Orçamento&quot;.
                    </p>
                    <button
                      onClick={() =>
                        setFiltros({
                          uf: 'TODAS',
                          mecanismos: Object.keys(MECANISMOS_INFO) as MecanismoParticipacao[],
                          periodo: 'todos',
                          busca: '',
                          casa: '',
                          nivel: ''
                        })
                      }
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      Restaurar todos os eventos
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Events Grid (Responsive 1/2/3 columns) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {eventosExibidos.map((evento) => (
                        <EventCard
                          key={evento.id}
                          evento={evento}
                          isFavorito={favoritos.includes(evento.id)}
                          onToggleFavorito={handleToggleFavorito}
                          onOpenDetalhes={handleOpenDetalhes}
                          onShare={handleShare}
                        />
                      ))}
                    </div>

                    {/* Pagination / Load More */}
                    {eventosFiltrados.length > visibleCount && (
                      <div className="pt-6 text-center">
                        <button
                          onClick={handleLoadMore}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500 font-bold text-xs shadow-xs transition-all"
                        >
                          <ChevronDown className="w-4 h-4" />
                          <span>
                            Carregar mais 50 eventos (Restam {eventosFiltrados.length - visibleCount})
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. MAPA BRASIL TAB */}
        {currentTab === 'mapa' && (
          <div className="space-y-6">
            <BrazilMap
              eventosCountPorUF={eventosCountPorUF}
              selectedUF={filtros.uf}
              onSelectUF={(uf) => {
                setFiltros((prev) => ({ ...prev, uf }));
                if (uf !== 'TODAS') {
                  setCurrentTab('eventos');
                }
              }}
            />

            {/* State Grid breakdown */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
              <h4 className="font-bold text-slate-900 dark:text-white text-base mb-4">
                Distribuição de Mecanismos por Unidade Federativa
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <button
                  onClick={() => {
                    setFiltros((prev) => ({ ...prev, uf: 'FEDERAL' }));
                    setCurrentTab('eventos');
                  }}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    filtros.uf === 'FEDERAL'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <p className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    FEDERAL
                  </p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    Congresso Nacional
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {eventosCountPorUF['FEDERAL'] || eventosCountPorUF['DF'] || 0} eventos
                  </p>
                </button>

                {Object.entries(eventosCountPorUF)
                  .filter(([uf]) => uf !== 'FEDERAL')
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([uf, count]) => (
                    <button
                      key={uf}
                      onClick={() => {
                        setFiltros((prev) => ({ ...prev, uf }));
                        setCurrentTab('eventos');
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        filtros.uf === uf
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {uf}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {count} {count === 1 ? 'evento' : 'eventos'}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* 3. CALENDÁRIO MENSAL TAB */}
        {currentTab === 'calendario' && (
          <div className="space-y-6">
            <CalendarHeatmap
              eventos={eventos}
              selectedDate={filtros.periodo === 'personalizado' ? filtros.dataInicio : undefined}
              onSelectDate={(dateStr) => {
                if (dateStr) {
                  setFiltros((prev) => ({
                    ...prev,
                    periodo: 'personalizado',
                    dataInicio: dateStr,
                    dataFim: dateStr
                  }));
                  setCurrentTab('eventos');
                } else {
                  setFiltros((prev) => ({
                    ...prev,
                    periodo: 'todos',
                    dataInicio: undefined,
                    dataFim: undefined
                  }));
                }
              }}
            />
          </div>
        )}

        {/* 4. SALVOS & HISTÓRICO TAB */}
        {currentTab === 'favoritos' && (
          <FavoritesHistoryView
            todosEventos={eventos}
            favoritoIds={favoritos}
            onToggleFavorito={handleToggleFavorito}
            onOpenDetalhes={handleOpenDetalhes}
            onShare={handleShare}
            onSelectSearchTerm={(termo) => {
              setFiltros((prev) => ({ ...prev, busca: termo }));
              setCurrentTab('eventos');
            }}
          />
        )}

        {/* 5. ALERTAS CIDADÃOS TAB */}
        {currentTab === 'alertas' && (
          <AlertsManager
            alertas={alertas}
            onAddAlerta={handleAddAlerta}
            onRemoveAlerta={handleRemoveAlerta}
            onToggleAtivo={handleToggleAlertaAtivo}
            todosEventos={eventos}
            onOpenDetalhes={handleOpenDetalhes}
          />
        )}

        {/* 6. COMPARADOR TAB */}
        {currentTab === 'comparador' && (
          <ComparisonView
            todosEventos={eventos}
            onOpenDetalhes={handleOpenDetalhes}
            favoritoIds={favoritos}
            onToggleFavorito={handleToggleFavorito}
            onShare={handleShare}
          />
        )}

        {/* 7. FONTES & TESTES TAB */}
        {currentTab === 'fontes' && <SourceTester statuses={statuses} />}
      </main>

      {/* Global Event Details Modal */}
      {selectedEventModal && (
        <EventModal
          evento={selectedEventModal}
          onClose={() => setSelectedEventModal(null)}
          isFavorito={favoritos.includes(selectedEventModal.id)}
          onToggleFavorito={handleToggleFavorito}
          onShare={handleShare}
          todosEventos={eventos}
          onSelectRelacionado={(rel) => setSelectedEventModal(rel)}
        />
      )}

      {/* Institutional Civic Footer */}
      <footer className="mt-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🏛️</span>
            <span className="font-bold text-slate-700 dark:text-slate-300">LegisParticipa</span>
            <span>· Plataforma Cidadã de Controle Social e Transparência Legislativa</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span>Dados Oficiais Abertos (Lei 12.527/2011)</span>
            <span>·</span>
            <span>100% Autônomo (Client-Side)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
