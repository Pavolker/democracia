import React from 'react';
import { RefreshCw, Moon, Sun, Monitor, Bell, Bookmark, SlidersHorizontal, BarChart3, Database } from 'lucide-react';

export type TabType = 'eventos' | 'mapa' | 'calendario' | 'favoritos' | 'alertas' | 'comparador' | 'fontes';

interface HeaderProps {
  currentTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isUpdating: boolean;
  onRefresh: () => void;
  ultimaAtualizacao: string | null;
  totalFavoritos: number;
  totalAlertasAtivos: number;
  theme: 'dark' | 'light' | 'system';
  onToggleTheme: () => void;
  autoUpdate: boolean;
  onToggleAutoUpdate: () => void;
  onOpenMobileFilters?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  isUpdating,
  onRefresh,
  ultimaAtualizacao,
  totalFavoritos,
  totalAlertasAtivos,
  theme,
  onToggleTheme,
  autoUpdate,
  onToggleAutoUpdate,
  onOpenMobileFilters
}) => {
  const formatTime = (isoString: string | null) => {
    if (!isoString) return 'Hoje';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Agora';
    }
  };

  const navItems: Array<{ id: TabType; label: string; badge?: number; icon?: React.ReactNode }> = [
    { id: 'eventos', label: 'Agenda Geral' },
    { id: 'mapa', label: 'Mapa Brasil' },
    { id: 'calendario', label: 'Calendário Mensal' },
    { id: 'favoritos', label: 'Salvos & Histórico', badge: totalFavoritos },
    { id: 'alertas', label: 'Alertas Cidadãos', badge: totalAlertasAtivos },
    { id: 'comparador', label: 'Comparador', icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: 'fontes', label: 'Fontes & Teste', icon: <Database className="w-3.5 h-3.5" /> }
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      {/* Top Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('eventos')}>
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
          </div>

          {/* Controls: Refresh, Auto-Update, Dark Mode */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Last update & refresh button */}
            <div className="flex items-center gap-2 text-xs">
              <span className="hidden md:inline-block text-slate-500 dark:text-slate-400">
                Sincronizado: <strong className="text-slate-700 dark:text-slate-200">{formatTime(ultimaAtualizacao)}</strong>
              </span>

              <button
                onClick={onRefresh}
                disabled={isUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all disabled:opacity-50"
                title="Sincronizar dados das fontes oficiais agora"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin text-emerald-500' : ''}`} />
                <span className="hidden sm:inline">{isUpdating ? 'Buscando...' : 'Atualizar'}</span>
              </button>
            </div>

            {/* Auto-update badge button */}
            <button
              onClick={onToggleAutoUpdate}
              className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                autoUpdate
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
              title="Auto-atualização periódica a cada 30 minutos"
            >
              <span className={`w-2 h-2 rounded-full ${autoUpdate ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span>Auto 30m</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Alternar tema claro/escuro"
              title={`Tema atual: ${theme}`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : theme === 'light' ? (
                <Moon className="w-4 h-4 text-slate-700" />
              ) : (
                <Monitor className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Mobile Filter Trigger */}
            {onOpenMobileFilters && (
              <button
                onClick={onOpenMobileFilters}
                className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                aria-label="Abrir filtros"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sm:mx-0 sm:px-0 border-t border-slate-100 dark:border-slate-800/80">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
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
