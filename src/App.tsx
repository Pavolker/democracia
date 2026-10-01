import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Evento, FiltrosState, ScraperStatus, AlertaCidadao } from './types';
import { MECANISMOS_INFO } from './services/config';
import { buscarTodosEventos } from './services/scraper';
import { storage } from './services/storage';
import { casasDisponiveis, contarPorUF, filtrarEventos, filtrosIniciais, separarPorOrigem } from './services/eventos';
import { estaEncerrado } from './services/datas';
import { escreverEstadoURL, lerEstadoURL, ehAbaValida } from './services/url';
import { Header, TabType, ResumoSincronizacao } from './components/Header';
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
import { Search, ChevronDown, FlaskConical, Info, ExternalLink } from 'lucide-react';

const ITEMS_POR_PAGINA = 50;
const INTERVALO_AUTO_MS = 30 * 60 * 1000;
const ATRASO_HISTORICO_BUSCA_MS = 1200;

/** Lê o estado inicial a partir do fragmento da URL, tolerando lixo. */
function estadoInicialDaURL(): { aba: TabType; filtros: FiltrosState } {
  const base = filtrosIniciais();
  if (typeof window === 'undefined') return { aba: 'eventos', filtros: base };
  try {
    const lido = lerEstadoURL(window.location.hash);
    return {
      aba: (lido.aba as TabType) || 'eventos',
      filtros: { ...base, ...lido.filtros }
    };
  } catch {
    return { aba: 'eventos', filtros: base };
  }
}

export default function App() {
  const inicial = useMemo(estadoInicialDaURL, []);

  // --------------------------------------------------------------- Dados
  const [eventos, setEventos] = useState<Evento[]>(() => storage.getCachedEventos() || []);
  const [statuses, setStatuses] = useState<ScraperStatus[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string | null>(
    () => storage.getUltimaAtualizacao()
  );
  const [resumoSync, setResumoSync] = useState<ResumoSincronizacao | null>(null);
  const [avisoCota, setAvisoCota] = useState<string | null>(null);

  // ------------------------------------------------------------- Interface
  const [currentTab, setCurrentTab] = useState<TabType>(inicial.aba);
  const [selectedEventModal, setSelectedEventModal] = useState<Evento | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_POR_PAGINA);

  // ----------------------------------------------------------- Preferências
  const [favoritos, setFavoritos] = useState<string[]>(() => storage.getFavoritos());
  const [alertas, setAlertas] = useState<AlertaCidadao[]>(() => storage.getAlertas());
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>(() => storage.getTema());
  const [autoUpdate, setAutoUpdate] = useState<boolean>(() => storage.getAutoUpdate());
  const [modoDemo, setModoDemo] = useState<boolean>(() => storage.getModoDemo());

  const [filtros, setFiltros] = useState<FiltrosState>(inicial.filtros);

  const toastTimer = useRef<number | null>(null);
  const idsAnterioresRef = useRef<Set<string>>(new Set(eventos.map((e) => e.id)));
  const ultimaBuscaGravadaRef = useRef<string>('');

  // -------------------------------------------------------------- Utilidades
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMessage(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------- Tema
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const aplicar = () => {
      if (theme === 'dark' || (theme === 'system' && media.matches)) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    aplicar();
    media.addEventListener('change', aplicar);
    return () => media.removeEventListener('change', aplicar);
  }, [theme]);

  const handleToggleTheme = () => {
    const proximo = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system';
    setTheme(proximo);
    storage.setTema(proximo);
  };

  // -------------------------------------------------- Service Worker (PWA)
  useEffect(() => {
    // Antes só registrava sob `https:`, o que impedia testar o PWA em
    // localhost. O SW é registrado em contexto seguro, que inclui localhost.
    const seguro = window.isSecureContext;
    if ('serviceWorker' in navigator && seguro) {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('Service worker não registrado:', err);
      });
    }
  }, []);

  // ------------------------------------------------ Estado na URL (deep link)
  useEffect(() => {
    const query = escreverEstadoURL(currentTab, filtros);
    const alvo = `${window.location.pathname}${window.location.search}#${query}`;
    window.history.replaceState(null, '', alvo);
  }, [currentTab, filtros]);

  useEffect(() => {
    const aoMudarHash = () => {
      const lido = lerEstadoURL(window.location.hash);
      if (lido.aba && ehAbaValida(lido.aba)) setCurrentTab(lido.aba as TabType);
      setFiltros((anterior) => ({ ...anterior, ...lido.filtros }));
    };
    window.addEventListener('hashchange', aoMudarHash);
    return () => window.removeEventListener('hashchange', aoMudarHash);
  }, []);

  // ----------------------------------------------------- Sincronização
  /**
   * Aplica uma lista de eventos marcando o que é novo em relação à última
   * consulta. `isNew` significava antes "veio da rede" e aparecia em todo
   * cartão; agora significa "não estava na consulta anterior".
   */
  const aplicarEventos = useCallback((lista: Evento[]) => {
    const anteriores = idsAnterioresRef.current;
    setEventos(
      lista.map((e) => (anteriores.has(e.id) ? { ...e, isNew: false } : { ...e, isNew: true }))
    );
  }, []);

  // Ref para o modo demonstração: `sincronizarDados` é memoizado, então sem
  // isto o botão que liga o modo chamava a sincronização com o valor ANTIGO
  // (false) e a amostra nunca aparecia.
  const modoDemoRef = useRef(modoDemo);
  modoDemoRef.current = modoDemo;

  const sincronizarDados = useCallback(
    async (incluirDemonstracaoParam?: boolean) => {
      const incluirDemonstracao = incluirDemonstracaoParam ?? modoDemoRef.current;
      setIsUpdating(true);
      setAvisoCota(null);
      idsAnterioresRef.current = new Set(eventos.map((e) => e.id));
      setStatuses([]);

      const acumulados: ScraperStatus[] = [];
      try {
        const resultado = await buscarTodosEventos({
          incluirDemonstracao,
          onStatusUpdate: (status) => {
            setStatuses((anteriores) => {
              const idx = anteriores.findIndex((s) => s.fonteId === status.fonteId);
              if (idx === -1) return [...anteriores, status];
              const copia = [...anteriores];
              copia[idx] = status;
              return copia;
            });
            const idx = acumulados.findIndex((s) => s.fonteId === status.fonteId);
            if (idx === -1) acumulados.push(status);
            else acumulados[idx] = status;
          },
          // Renderização progressiva: cada fonte que responde já aparece na tela.
          //
          // E também já vai para o cache. A coleta das assembleias estaduais leva
          // alguns segundos, então gravar o cache só no fim significava que
          // fechar a aba no meio da sincronização descartava tudo o que já tinha
          // chegado — inclusive o que o usuário estava vendo na tela.
          onParcial: (parciais) => {
            aplicarEventos(parciais);
            storage.setCachedEventos(parciais);
          }
        });

        aplicarEventos(resultado.eventos);

        const consultadas = acumulados.filter((s) => s.status === 'sucesso' || s.status === 'erro');
        const sucesso = consultadas.filter((s) => s.status === 'sucesso').length;
        const erro = consultadas.filter((s) => s.status === 'erro').length;
        const pendentes = acumulados.filter((s) => s.status === 'pendente').length;

        setResumoSync({ consultadas: consultadas.length, sucesso, erro, pendentes });

        const gravou = storage.setCachedEventos(resultado.eventos);
        if (!gravou) {
          setAvisoCota(
            'A agenda foi carregada, mas o navegador não conseguiu guardá-la em cache (armazenamento cheio). ' +
              'Na próxima visita os dados serão consultados de novo.'
          );
        }

        setUltimaAtualizacao(new Date().toISOString());

        const oficiais = separarPorOrigem(resultado.eventos).reais.length;
        showToast(
          erro > 0
            ? `${oficiais} evento(s) oficial(is). ${erro} de ${consultadas.length} fontes não responderam.`
            : `${oficiais} evento(s) oficiais consolidados de ${sucesso} fonte(s).`
        );
      } catch (e) {
        console.error('Falha ao sincronizar:', e);
        showToast('Erro inesperado ao consultar as fontes. Os dados em cache foram mantidos.');
      } finally {
        setIsUpdating(false);
      }
    },
    [aplicarEventos, eventos, showToast]
  );

  // Primeira carga: só consulta se não houver cache.
  useEffect(() => {
    if (eventos.length === 0) sincronizarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-atualização
  useEffect(() => {
    if (!autoUpdate) return;
    const id = window.setInterval(() => sincronizarDados(), INTERVALO_AUTO_MS);
    return () => window.clearInterval(id);
  }, [autoUpdate, sincronizarDados]);

  const handleToggleAutoUpdate = () => {
    const novo = !autoUpdate;
    setAutoUpdate(novo);
    storage.setAutoUpdate(novo);
    showToast(novo ? 'Auto-atualização ligada (a cada 30 min, nesta aba).' : 'Auto-atualização desligada.');
  };

  const handleToggleModoDemo = () => {
    const novo = !modoDemo;
    setModoDemo(novo);
    storage.setModoDemo(novo);
    showToast(
      novo
        ? 'Modo demonstração LIGADO: a agenda passa a incluir uma amostra ilustrativa marcada como "Exemplo".'
        : 'Modo demonstração desligado: somente dados das fontes oficiais.'
    );
    // Passa o valor explicitamente: `sincronizarDados` é memoizado e ainda
    // enxergaria o modo anterior.
    void sincronizarDados(novo);
  };

  // ------------------------------------------------------------- Favoritos
  const handleToggleFavorito = (id: string) => {
    const adicionado = storage.toggleFavorito(id);
    setFavoritos(storage.getFavoritos());
    showToast(adicionado ? 'Evento salvo nos favoritos ⭐' : 'Evento removido dos favoritos');
  };

  const handleOpenDetalhes = (evento: Evento) => {
    setSelectedEventModal(evento);
    storage.addVisualizado(evento);
  };

  const handleShare = async (evento: Evento) => {
    const url = evento.link_oficial || window.location.href;
    const texto = `[${evento.casa}] ${evento.tema} — ${evento.data} às ${evento.hora}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: texto, text: `Participe: ${texto}`, url });
        return;
      } catch {
        /* usuário cancelou ou não há suporte: cai no clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${texto}\n${url}\n\n(Via LegisParticipa)`);
      showToast('Detalhes e link copiados para a área de transferência 📋');
    } catch {
      showToast('Não foi possível copiar o link.');
    }
  };

  // --------------------------------------------------------------- Filtros salvos
  const handleAddAlerta = (novo: Omit<AlertaCidadao, 'id' | 'data_criacao'>) => {
    const criado = storage.addAlerta(novo);
    if ('erro' in criado) {
      showToast(criado.erro);
      return;
    }
    setAlertas(storage.getAlertas());
    showToast(`Filtro salvo para "${criado.tema}" 🔖`);
  };

  const handleRemoveAlerta = (id: string) => {
    storage.removeAlerta(id);
    setAlertas(storage.getAlertas());
    showToast('Filtro salvo removido.');
  };

  const handleToggleAlertaAtivo = (id: string) => {
    storage.toggleAlertaAtivo(id);
    setAlertas(storage.getAlertas());
  };

  const totalFiltrosAtivos = alertas.filter((a) => a.ativo).length;

  // -------------------------------------------------- Eventos filtrados
  const eventosFiltrados = useMemo(() => filtrarEventos(eventos, filtros), [eventos, filtros]);

  // Reinicia a paginação sempre que o recorte muda.
  useEffect(() => {
    setVisibleCount(ITEMS_POR_PAGINA);
  }, [filtros]);

  // Histórico de busca: só grava depois de uma pausa, e o storage substitui
  // prefixos parciais (antes cada tecla virava uma entrada).
  useEffect(() => {
    const termo = filtros.busca.trim();
    if (termo.length < 3) return;
    const id = window.setTimeout(() => {
      if (ultimaBuscaGravadaRef.current === termo) return;
      ultimaBuscaGravadaRef.current = termo;
      storage.addBusca(termo);
    }, ATRASO_HISTORICO_BUSCA_MS);
    return () => window.clearTimeout(id);
  }, [filtros.busca]);

  const casas = useMemo(() => casasDisponiveis(eventos), [eventos]);
  const eventosPorUF = useMemo(() => contarPorUF(eventos), [eventos]);
  const eventosExibidos = useMemo(
    () => eventosFiltrados.slice(0, visibleCount),
    [eventosFiltrados, visibleCount]
  );

  const oficials = useMemo(() => separarPorOrigem(eventos), [eventos]);
  const totalEncerrados = useMemo(
    () => oficials.reais.filter((e) => estaEncerrado(e)).length,
    [oficials.reais]
  );

  // ------------------------------------------------------- Atalhos de teclado
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedEventModal) setSelectedEventModal(null);
      if (mobileFilterOpen) setMobileFilterOpen(false);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [selectedEventModal, mobileFilterOpen]);

  const filtrosAtivos =
    filtros.uf !== 'TODAS' ||
    filtros.periodo !== 'todos' ||
    filtros.mecanismos.length !== Object.keys(MECANISMOS_INFO).length ||
    Boolean(filtros.busca) ||
    Boolean(filtros.casa) ||
    Boolean(filtros.nivel) ||
    filtros.situacao === 'todos';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Estrutura de documento: o app não tinha nenhum h1. */}
      <h1 className="sr-only">
        LegisParticipa — agenda nacional dos cinco mecanismos de participação cidadã do Legislativo brasileiro
      </h1>

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white dark:bg-emerald-700 px-4 py-3 rounded-2xl shadow-xl border border-slate-700 dark:border-emerald-500 text-xs font-semibold animate-fade-in"
        >
          {toastMessage}
        </div>
      )}

      <Header
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isUpdating={isUpdating}
        onRefresh={sincronizarDados}
        ultimaAtualizacao={ultimaAtualizacao}
        resumoSync={resumoSync}
        totalFavoritos={favoritos.length}
        totalFiltrosAtivos={totalFiltrosAtivos}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        autoUpdate={autoUpdate}
        onToggleAutoUpdate={handleToggleAutoUpdate}
        modoDemo={modoDemo}
        onToggleModoDemo={handleToggleModoDemo}
        onOpenMobileFilters={() => setMobileFilterOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Avisos globais: amostra ilustrativa e falha de cache */}
        {modoDemo && (
          <div
            role="note"
            className="flex items-start gap-3 p-4 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs"
          >
            <FlaskConical className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>
              <strong>Modo demonstração ligado.</strong> A agenda inclui uma amostra ilustrativa
              ({oficials.demonstracao.length} registros) escrita no código para exercitar a interface. Ela está
              marcada com o selo <em>Exemplo</em>, não é dado oficial, boa parte dos links de inscrição não existe, e
              nenhum registro dela entra em exportações.
            </p>
          </div>
        )}

        {avisoCota && (
          <div
            role="alert"
            className="flex items-start gap-3 p-4 rounded-2xl border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800 text-orange-900 dark:text-orange-200 text-xs"
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{avisoCota}</p>
          </div>
        )}

        {currentTab === 'eventos' && (
          <div className="space-y-6">
            <StatsOverview
              eventos={eventos}
              onFilterByMecanismo={(mec) => {
                // Antes só trocava o mecanismo e mantinha os demais filtros, então
                // o número do cartão clicado não correspondia ao resultado.
                setFiltros((anterior) => ({
                  ...filtrosIniciais(),
                  mecanismos: [mec],
                  situacao: anterior.situacao
                }));
              }}
            />

            <div className="flex gap-6 items-start">
              <FilterSidebar
                filtros={filtros}
                onChangeFiltros={setFiltros}
                casasDisponiveis={casas}
                totalFiltrados={eventosFiltrados.length}
                totalGeral={eventos.length}
                isMobileOpen={mobileFilterOpen}
                onCloseMobile={() => setMobileFilterOpen(false)}
              />

              <div className="flex-1 space-y-4 min-w-0">
                {filtrosAtivos && (
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                    <span className="font-semibold text-slate-500">Filtros ativos:</span>
                    {filtros.uf !== 'TODAS' && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-medium">
                        {filtros.uf === 'FEDERAL' ? 'Congresso Nacional (federal)' : `UF: ${filtros.uf}`}
                      </span>
                    )}
                    {filtros.periodo !== 'todos' && (
                      <span className="px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-medium">
                        Período: {filtros.periodo}
                      </span>
                    )}
                    {filtros.mecanismos.length !== Object.keys(MECANISMOS_INFO).length && (
                      <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-medium">
                        {filtros.mecanismos.length === 0
                          ? 'Nenhum mecanismo selecionado'
                          : `${filtros.mecanismos.length} mecanismos selecionados`}
                      </span>
                    )}
                    {filtros.busca && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                        Busca: &quot;{filtros.busca}&quot;
                      </span>
                    )}
                    {filtros.casa && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium">
                        Casa: {filtros.casa}
                      </span>
                    )}
                    {filtros.situacao === 'todos' && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-medium">
                        Inclui já realizados
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFiltros(filtrosIniciais())}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline ml-auto font-medium"
                    >
                      Limpar todos os filtros
                    </button>
                  </div>
                )}

                {eventosExibidos.length === 0 ? (
                  <div className="text-center py-16 px-6 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl space-y-4">
                    <Search className="w-12 h-12 text-slate-400 mx-auto" aria-hidden="true" />
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {eventos.length === 0
                        ? 'Nenhum evento de participação nas fontes consultadas'
                        : 'Nenhum evento encontrado com estes filtros'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                      {eventos.length === 0 ? (
                        <>
                          Somente a Câmara dos Deputados e o Senado Federal são consultados nesta versão, e o
                          recorte olha apenas eventos que correspondem a um dos cinco mecanismos de participação.
                          Nenhum registro compatível foi encontrado no período. As outras 27 casas legislativas
                          estão catalogadas, mas a coleta ainda não foi implementada para elas.
                        </>
                      ) : (
                        <>
                          Tente ampliar o período, marcar mais mecanismos ou incluir eventos já realizados.
                          A busca ignora acentos e exige todos os termos digitados.
                        </>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {filtrosAtivos && (
                        <button
                          type="button"
                          onClick={() => setFiltros(filtrosIniciais())}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                        >
                          Limpar filtros
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCurrentTab('fontes')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        Ver cobertura das fontes
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Exibindo <strong>{eventosExibidos.length}</strong> de{' '}
                      <strong>{eventosFiltrados.length}</strong> evento(s)
                      {totalEncerrados > 0 && filtros.situacao !== 'todos' ? (
                        <> · {totalEncerrados} já realizado(s) oculto(s)</>
                      ) : null}
                      .
                    </p>

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

                    {eventosFiltrados.length > visibleCount && (
                      <div className="pt-6 text-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCount((p) => p + ITEMS_POR_PAGINA)}
                          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500 font-bold text-xs shadow-xs transition-all"
                        >
                          <ChevronDown className="w-4 h-4" aria-hidden="true" />
                          <span>
                            Carregar mais {ITEMS_POR_PAGINA} eventos (restam{' '}
                            {eventosFiltrados.length - visibleCount})
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

        {currentTab === 'mapa' && (
          <div className="space-y-6">
            <BrazilMap
              eventosCountPorUF={eventosPorUF}
              selectedUF={filtros.uf}
              onSelectUF={(uf) => {
                setFiltros((anterior) => ({ ...anterior, uf }));
                if (uf !== 'TODAS') setCurrentTab('eventos');
              }}
            />

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs">
              <h2 className="font-bold text-slate-900 dark:text-white text-base mb-1">
                Eventos por casa legislativa e unidade federativa
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Contagem sobre a base carregada agora, em todos os períodos. O Congresso Nacional aparece em uma
                linha própria, separado do Distrito Federal.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFiltros((anterior) => ({ ...anterior, uf: 'FEDERAL' }));
                    setCurrentTab('eventos');
                  }}
                  aria-pressed={filtros.uf === 'FEDERAL'}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    filtros.uf === 'FEDERAL'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <p className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">FEDERAL</p>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    Congresso Nacional
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {eventosPorUF['FEDERAL'] ?? 0} evento(s)
                  </p>
                </button>

                {Object.entries(eventosPorUF)
                  .filter(([uf]) => uf !== 'FEDERAL')
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([uf, count]) => (
                    <button
                      key={uf}
                      type="button"
                      onClick={() => {
                        setFiltros((anterior) => ({ ...anterior, uf }));
                        setCurrentTab('eventos');
                      }}
                      aria-pressed={filtros.uf === uf}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        filtros.uf === uf
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-mono text-xs font-bold text-slate-900 dark:text-white">{uf}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {count} {count === 1 ? 'evento' : 'eventos'}
                      </p>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {currentTab === 'calendario' && (
          <CalendarHeatmap
            eventos={eventosFiltrados}
            selectedDate={filtros.periodo === 'personalizado' ? filtros.dataInicio : undefined}
            onSelectDate={(dateStr) => {
              if (dateStr) {
                setFiltros((anterior) => ({
                  ...anterior,
                  periodo: 'personalizado',
                  dataInicio: dateStr,
                  dataFim: dateStr
                }));
                setCurrentTab('eventos');
              } else {
                setFiltros((anterior) => ({
                  ...anterior,
                  periodo: 'todos',
                  dataInicio: undefined,
                  dataFim: undefined
                }));
              }
            }}
          />
        )}

        {currentTab === 'favoritos' && (
          <FavoritesHistoryView
            todosEventos={eventos}
            favoritoIds={favoritos}
            onToggleFavorito={handleToggleFavorito}
            onOpenDetalhes={handleOpenDetalhes}
            onShare={handleShare}
            onSelectSearchTerm={(termo) => {
              setFiltros((anterior) => ({ ...anterior, busca: termo }));
              setCurrentTab('eventos');
            }}
          />
        )}

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

        {currentTab === 'comparador' && (
          <ComparisonView
            todosEventos={eventos}
            onOpenDetalhes={handleOpenDetalhes}
            favoritoIds={favoritos}
            onToggleFavorito={handleToggleFavorito}
            onShare={handleShare}
          />
        )}

        {currentTab === 'fontes' && <SourceTester statuses={statuses} />}
      </main>

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

      <footer className="mt-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 py-8 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">
              🏛️
            </span>
            <span className="font-bold text-slate-700 dark:text-slate-300">LegisParticipa</span>
            <span>· Plataforma cidadã de acompanhamento da participação legislativa</span>
          </div>

          <div className="text-[11px] leading-relaxed">
            <p>
              {(() => {
                // Cobertura declarada a partir do que foi REALMENTE consultado
                // nesta sessão — não de uma promessa fixa no rodapé. Quando os
                // adaptadores das assembleias forem entrando, este número sobe
                // sozinho; enquanto não houver nenhum, a frase diz isso.
                const federais = ['camara', 'senado'];
                const consultadas = statuses.filter(
                  (s) => s.status === 'sucesso' || s.status === 'erro'
                );
                const federaisOk = consultadas.filter((s) => federais.includes(s.fonteId)).length;
                const estaduaisOk = consultadas.filter(
                  (s) => !federais.includes(s.fonteId) && s.uf !== 'FEDERAL'
                ).length;
                const estaduaisTotal = statuses.filter((s) => !federais.includes(s.fonteId)).length;

                if (estaduaisTotal === 0) {
                  return 'Consultando as fontes oficiais…';
                }
                return (
                  <>
                    Consultadas nesta sessão:{' '}
                    <strong className="text-slate-700 dark:text-slate-300">
                      {federaisOk} de 2 fontes federais (Câmara e Senado)
                      {estaduaisOk > 0
                        ? ` e ${estaduaisOk} de ${estaduaisTotal} casas estaduais`
                        : ''}
                    </strong>
                    .
                    {estaduaisOk < estaduaisTotal && (
                      <>
                        {' '}
                        As demais casas estaduais e distrital estão catalogadas, mas a agenda do portal
                        delas ainda não foi mapeada — nenhuma requisição é feita a elas.
                      </>
                    )}
                  </>
                );
              })()}
            </p>
            <p className="mt-1">
              Executa inteiramente no seu navegador; nenhum dado pessoal é enviado a servidores. A coleta
              das assembleias estaduais usa uma função no servidor apenas porque esses portais não liberam
              acesso direto ao navegador.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
