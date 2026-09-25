import React, { useEffect, useState } from 'react';
import { FiltrosState, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO, UFS_BRASIL } from '../services/config';
import { Search, Filter, RotateCcw, Calendar, CheckSquare, Square, X } from 'lucide-react';

interface FilterSidebarProps {
  filtros: FiltrosState;
  onChangeFiltros: (filtros: FiltrosState) => void;
  casasDisponiveis: string[];
  totalFiltrados: number;
  totalGeral: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  filtros,
  onChangeFiltros,
  casasDisponiveis,
  totalFiltrados,
  totalGeral,
  isMobileOpen,
  onCloseMobile
}) => {
  const [searchTerm, setSearchTerm] = useState(filtros.busca);

  // Debounce search term 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filtros.busca) {
        onChangeFiltros({ ...filtros, busca: searchTerm });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filtros, onChangeFiltros]);

  const toggleMecanismo = (mec: MecanismoParticipacao) => {
    const current = [...filtros.mecanismos];
    const idx = current.indexOf(mec);
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(mec);
    }
    onChangeFiltros({ ...filtros, mecanismos: current });
  };

  const selectAllMecanismos = () => {
    const all = Object.keys(MECANISMOS_INFO) as MecanismoParticipacao[];
    onChangeFiltros({
      ...filtros,
      mecanismos: filtros.mecanismos.length === all.length ? [] : all
    });
  };

  const resetAll = () => {
    setSearchTerm('');
    onChangeFiltros({
      uf: 'TODAS',
      mecanismos: Object.keys(MECANISMOS_INFO) as MecanismoParticipacao[],
      periodo: 'todos',
      busca: '',
      casa: '',
      nivel: '',
      dataInicio: undefined,
      dataFim: undefined
    });
  };

  const content = (
    <div className="space-y-6">
      {/* Header and Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Filtros Avançados
          </h3>
        </div>

        <button
          onClick={resetAll}
          className="text-xs text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
          title="Restaurar todos os filtros"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Limpar
        </button>
      </div>

      {/* Result counter pill */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2.5 text-center">
        <span className="text-xs text-emerald-900 dark:text-emerald-200 font-medium">
          Exibindo <strong>{totalFiltrados}</strong> de {totalGeral} eventos
        </span>
      </div>

      {/* Search Input */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Busca por Palavra-Chave
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Ex: Reforma, Saúde, PL 456..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                onChangeFiltros({ ...filtros, busca: '' });
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* UF Filter */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Localidade / UF
        </label>
        <select
          value={filtros.uf}
          onChange={(e) => onChangeFiltros({ ...filtros, uf: e.target.value })}
          className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="TODAS">🇧🇷 Brasil Inteiro (Todas as UFs)</option>
          <option value="FEDERAL">🏛️ Apenas Federal (Congresso Nacional)</option>
          <optgroup label="Estados da Federação & DF">
            {UFS_BRASIL.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla} - {uf.nome} ({uf.regiao})
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Mechanism Filter */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Mecanismos (5)
          </label>
          <button
            onClick={selectAllMecanismos}
            className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
          >
            {filtros.mecanismos.length === 5 ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        </div>

        <div className="space-y-1.5">
          {(Object.entries(MECANISMOS_INFO) as [MecanismoParticipacao, typeof MECANISMOS_INFO[MecanismoParticipacao]][]).map(([key, info]) => {
            const isChecked = filtros.mecanismos.includes(key);
            return (
              <div
                key={key}
                onClick={() => toggleMecanismo(key)}
                className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer border transition-all ${
                  isChecked
                    ? 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{info.emoji}</span>
                  <span className="font-medium">{info.nome}</span>
                </div>
                {isChecked ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Date Filters */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Período
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'hoje', label: 'Hoje' },
            { id: 'amanha', label: 'Amanhã' },
            { id: 'semana', label: 'Esta Semana' },
            { id: 'mes', label: 'Este Mês' },
            { id: 'personalizado', label: 'Personalizado' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeFiltros({ ...filtros, periodo: item.id as any })}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                filtros.periodo === item.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker */}
        {filtros.periodo === 'personalizado' && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>Intervalo de Datas:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400">De</span>
                <input
                  type="date"
                  value={filtros.dataInicio || ''}
                  onChange={(e) => onChangeFiltros({ ...filtros, dataInicio: e.target.value })}
                  className="w-full p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Até</span>
                <input
                  type="date"
                  value={filtros.dataFim || ''}
                  onChange={(e) => onChangeFiltros({ ...filtros, dataFim: e.target.value })}
                  className="w-full p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* House Filter (Câmara, Senado, ALESP, etc.) */}
      {casasDisponiveis.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Casa Legislativa
          </label>
          <select
            value={filtros.casa || ''}
            onChange={(e) => onChangeFiltros({ ...filtros, casa: e.target.value })}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todas as Casas Mapeadas</option>
            {casasDisponiveis.map((casa) => (
              <option key={casa} value={casa}>
                {casa}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Scope / Nível Filter */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Esfera de Poder
        </label>
        <div className="grid grid-cols-3 gap-1">
          {[
            { id: '', label: 'Todas' },
            { id: 'federal', label: 'Federal' },
            { id: 'estadual', label: 'Estadual' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeFiltros({ ...filtros, nivel: item.id })}
              className={`py-1 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                filtros.nivel === item.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs sticky top-20 self-start">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 h-full p-5 overflow-y-auto shadow-2xl animate-slide-left">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">Filtros</span>
              <button
                onClick={onCloseMobile}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
};
