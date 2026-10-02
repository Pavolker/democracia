import React from 'react';
import {
  RefreshCw,
  Moon,
  Sun,
  Monitor,
  SlidersHorizontal,
  BarChart3,
  Database
} from 'lucide-react';

export type TabType = 'eventos' | 'mapa' | 'calendario' | 'favoritos' | 'alertas' | 'comparador' | 'fontes';

export interface ResumoSincronizacao {
  /** Fontes consultadas de fato nesta rodada. */
  consultadas: number;
  sucesso: number;
  erro: number;
  /** Fontes catalogadas cuja coleta ainda não foi implementada. */
  pendentes: number;
}

interface HeaderProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isUpdating: boolean;
  onRefresh: () => void;
  ultimaAtualizacao: string | null;
  resumoSync: ResumoSincronizacao | null;
  totalFavoritos: number;
  totalFiltrosAtivos: number;
  theme: 'dark' | 'light' | 'system';
  onToggleTheme: () => void;
  autoUpdate: boolean;
  onToggleAutoUpdate: () => void;
  onOpenMobileFilters?: () => void;
}

/**
 * Cabeçalho global.
 *
 * Correção de honestidade: antes exibia "Sincronizado: HH:MM" incondicionalmente,
 * porque App.tsx gravava a hora mesmo quando todas as consultas falhavam. Agora o
 * rótulo descreve o resultado real da última rodada (quantas fontes responderam),
 * e a data inválida deixa de virar "Invalid Date".
 */
export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  isUpdating,
  onRefresh,
  ultimaAtualizacao,
  resumoSync,
  totalFavoritos,
  totalFiltrosAtivos,
  theme,
  onToggleTheme,
  autoUpdate,
  onToggleAutoUpdate,
  onOpenMobileFilters
}) => {
  const formatarHora = (iso: string | null): string | null => {
    if (!iso) return null;
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return null;
    return data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const hora = formatarHora(ultimaAtualizacao);

  const textoUltimaConsulta = (): string => {
    if (isUpdating) return 'Consultando fontes…';
    if (!resumoSync) return 'Nenhuma consulta feita nesta sessão';
    if (resumoSync.sucesso === 0 && resumoSync.erro > 0) {
      return `Última consulta às ${hora ?? '--:--'}: nenhuma das ${resumoSync.consultadas} fontes respondeu`;
    }
    return `Última consulta às ${hora ?? '--:--'}: ${resumoSync.sucesso} de ${resumoSync.consultadas} fontes responderam`;
  };

  const navItems: Array<{ id: TabType; label: string; badge?: number; icon?: React.ReactNode }> = [
    { id: 'eventos', label: 'Agenda Geral' },
    { id: 'mapa', label: 'Mapa Brasil' },
    { id: 'calendario', label: 'Calendário Mensal' },
    { id: 'favoritos', label: 'Salvos & Histórico', badge: totalFavoritos },
    // O recurso é um filtro salvo conferido sob demanda, não um serviço de
    // notificação. O rótulo acompanha o que ele faz.
    { id: 'alertas', label: 'Filtros Salvos', badge: totalFiltrosAtivos },
    { id: 'comparador', label: 'Comparador', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'fontes', label: 'Fontes & Cobertura', icon: <Database className="w-3.5 h-3.5" /> }
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Marca */}
          <button
            type="button"
            onClick={() => onSelectTab('eventos')}
            className="flex items-center gap-3 text-left rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 text-xl font-black">
              🏛️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
                  Legis<span className="text-emerald-600 dark:text-emerald-400">Participa</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  5 Mecanismos
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                Audiências, Consultas, Sugestões, Diálogos Sociais e Tribuna Livre
              </p>
            </div>
          </button>

          {/* Controles */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden md:inline-block text-slate-500 dark:text-slate-400" title={textoUltimaConsulta()}>
                {textoUltimaConsulta()}
              </span>

              <button
                type="button"
                onClick={onRefresh}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                aria-label={isUpdating ? 'Consultando fontes oficiais' : 'Consultar fontes oficiais agora'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin text-emerald-500' : ''}`} aria-hidden="true" />
                <span className="hidden sm:inline">{isUpdating ? 'Buscando…' : 'Atualizar'}</span>
              </button>
            </div>


            {/* Auto-atualização */}
            <button
              type="button"
              onClick={onToggleAutoUpdate}
              aria-pressed={autoUpdate}
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                autoUpdate
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
              title={
                autoUpdate
                  ? 'Recarrega as fontes a cada 30 minutos, apenas enquanto esta aba estiver aberta.'
                  : 'Auto-atualização desligada. A agenda só muda quando você clicar em Atualizar.'
              }
            >
              <span className={`w-2 h-2 rounded-full ${autoUpdate ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} aria-hidden="true" />
              <span>Auto 30m</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              aria-label={`Alterar tema (atual: ${theme === 'system' ? 'sistema' : theme === 'dark' ? 'escuro' : 'claro'})`}
              title={`Tema atual: ${theme === 'system' ? 'sistema' : theme === 'dark' ? 'escuro' : 'claro'}`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : theme === 'light' ? (
                <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
              ) : (
                <Monitor className="w-4 h-4 text-slate-500" aria-hidden="true" />
              )}
            </button>

            {onOpenMobileFilters && (
              <button
                type="button"
                onClick={onOpenMobileFilters}
                className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                aria-label="Abrir filtros da agenda"
              >
                <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Navegação */}
        <nav aria-label="Seções do aplicativo" className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sm:mx-0 sm:px-0 border-t border-slate-100 dark:border-slate-800/80">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
