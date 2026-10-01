import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const PERIODOS: Array<{ id: FiltrosState['periodo']; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'amanha', label: 'Amanhã' },
  { id: 'semana', label: 'Esta Semana' },
  { id: 'mes', label: 'Este Mês' },
  { id: 'personalizado', label: 'Personalizado' }
];

const NIVEIS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Todas' },
  { id: 'federal', label: 'Federal' },
  { id: 'estadual', label: 'Estadual' }
];

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

  // Refs: o envio debounced não pode depender do objeto `filtros`, senão cada
  // mudança de filtro reagenda o envio do termo antigo — era exatamente isso
  // que fazia a busca apagada voltar 300 ms depois.
  const filtrosRef = useRef(filtros);
  filtrosRef.current = filtros;
  const onChangeRef = useRef(onChangeFiltros);
  onChangeRef.current = onChangeFiltros;
  const timerRef = useRef<number | null>(null);
  const ultimoEnviadoRef = useRef(filtros.busca);

  const cancelarPendente = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // (1) Adota o termo quando ele muda por fora (URL, histórico, "limpar filtros").
  useEffect(() => {
    if (filtros.busca === ultimoEnviadoRef.current) return;
    ultimoEnviadoRef.current = filtros.busca;
    cancelarPendente();
    setSearchTerm(filtros.busca);
  }, [filtros.busca, cancelarPendente]);

  // (2) Qualquer mudança externa nos filtros cancela um envio pendente.
  //     Sem isto, digitar e clicar em "Limpar" dentro da janela de 300 ms
  //     ressuscitava o termo apagado.
  useEffect(() => {
    if (timerRef.current === null) return;
    cancelarPendente();
    setSearchTerm(filtrosRef.current.busca);
  }, [filtros, cancelarPendente]);

  useEffect(() => () => cancelarPendente(), [cancelarPendente]);

  const aoDigitarBusca = (valor: string) => {
    setSearchTerm(valor);
    cancelarPendente();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      ultimoEnviadoRef.current = valor;
      onChangeRef.current({ ...filtrosRef.current, busca: valor });
    }, 300);
  };

  const toggleMecanismo = (mec: MecanismoParticipacao) => {
    const atual = [...filtros.mecanismos];
    const idx = atual.indexOf(mec);
    if (idx > -1) atual.splice(idx, 1);
    else atual.push(mec);
    onChangeFiltros({ ...filtros, mecanismos: atual });
  };

  const todosOsMecanismos = Object.keys(MECANISMOS_INFO) as MecanismoParticipacao[];

  const selectAllMecanismos = () => {
    onChangeFiltros({
      ...filtros,
      mecanismos: filtros.mecanismos.length === todosOsMecanismos.length ? [] : todosOsMecanismos
    });
  };

  const resetAll = () => {
    cancelarPendente();
    ultimoEnviadoRef.current = '';
    setSearchTerm('');
    onChangeFiltros({
      uf: 'TODAS',
      mecanismos: todosOsMecanismos,
      periodo: 'todos',
      busca: '',
      casa: '',
      nivel: '',
      dataInicio: undefined,
      dataFim: undefined,
      situacao: 'proximos'
    });
  };

  const content = (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h2 className="font-bold text-slate-900 dark:text-white text-sm">Filtros</h2>
        </div>

        <button
          type="button"
          onClick={resetAll}
          className="text-xs text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
          aria-label="Restaurar todos os filtros para o padrão"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Limpar
        </button>
      </div>

      <p className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2.5 text-center text-xs text-emerald-900 dark:text-emerald-200 font-medium">
        Exibindo <strong>{totalFiltrados}</strong> de {totalGeral} eventos carregados
      </p>

      {/* Busca */}
      <div>
        <label
          htmlFor="filtro-busca"
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
        >
          Busca por palavra-chave
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="filtro-busca"
            type="search"
            placeholder="Ex: saúde, reforma, PL 2338"
            value={searchTerm}
            onChange={(e) => aoDigitarBusca(e.target.value)}
            aria-describedby="filtro-busca-ajuda"
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                cancelarPendente();
                ultimoEnviadoRef.current = '';
                setSearchTerm('');
                onChangeFiltros({ ...filtros, busca: '' });
              }}
              aria-label="Limpar o termo de busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <p id="filtro-busca-ajuda" className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Ignora acentos e exige todos os termos digitados.
        </p>
      </div>

      {/* Localidade */}
      <div>
        <label
          htmlFor="filtro-uf"
          className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
        >
          Localidade / UF
        </label>
        <select
          id="filtro-uf"
          value={filtros.uf}
          onChange={(e) => onChangeFiltros({ ...filtros, uf: e.target.value })}
          className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="TODAS">🇧🇷 Brasil inteiro (todas as localidades)</option>
          <option value="FEDERAL">🏛️ Congresso Nacional (esfera federal)</option>
          <optgroup label="Estados da Federação e Distrito Federal">
            {UFS_BRASIL.map((uf) => (
              <option key={uf.sigla} value={uf.sigla}>
                {uf.sigla} - {uf.nome} ({uf.regiao})
              </option>
            ))}
          </optgroup>
        </select>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          A opção federal traz só o Congresso; a UF DF traz só a Câmara Legislativa do DF.
        </p>
      </div>

      {/* Mecanismos */}
      <fieldset>
        <legend className="flex items-center justify-between w-full mb-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Mecanismos ({todosOsMecanismos.length})
          </span>
        </legend>
        <div className="flex justify-end -mt-6 mb-2">
          <button
            type="button"
            onClick={selectAllMecanismos}
            className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
            aria-label={
              filtros.mecanismos.length === todosOsMecanismos.length
                ? 'Desmarcar todos os mecanismos'
                : 'Marcar todos os mecanismos'
            }
          >
            {filtros.mecanismos.length === todosOsMecanismos.length ? 'Desmarcar todos' : 'Marcar todos'}
          </button>
        </div>

        <div className="space-y-1.5">
          {(
            Object.entries(MECANISMOS_INFO) as Array<
              [MecanismoParticipacao, (typeof MECANISMOS_INFO)[MecanismoParticipacao]]
            >
          ).map(([key, info]) => {
            const marcado = filtros.mecanismos.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleMecanismo(key)}
                aria-pressed={marcado}
                className={`w-full flex items-center justify-between p-2 rounded-xl text-xs border transition-all text-left ${
                  marcado
                    ? 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
                    : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden="true">{info.emoji}</span>
                  <span className="font-medium">{info.nome}</span>
                </span>
                {marcado ? (
                  <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Situação */}
      <div>
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Situação
        </span>
        <button
          type="button"
          onClick={() =>
            onChangeFiltros({
              ...filtros,
              situacao: filtros.situacao === 'todos' ? 'proximos' : 'todos'
            })
          }
          aria-pressed={filtros.situacao === 'todos'}
          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs border transition-all text-left ${
            filtros.situacao === 'todos'
              ? 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white'
              : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          <span className="font-medium">Incluir eventos já realizados</span>
          {filtros.situacao === 'todos' ? (
            <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          ) : (
            <Square className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          )}
        </button>
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          Por padrão a agenda mostra apenas o que ainda vai acontecer.
        </p>
      </div>

      {/* Período */}
      <div>
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Período
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {PERIODOS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeFiltros({ ...filtros, periodo: item.id })}
              aria-pressed={filtros.periodo === item.id}
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

        {filtros.periodo === 'personalizado' && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Intervalo de datas</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="filtro-data-inicio" className="text-[10px] text-slate-500 dark:text-slate-400">
                  De
                </label>
                <input
                  id="filtro-data-inicio"
                  type="date"
                  value={filtros.dataInicio || ''}
                  onChange={(e) => onChangeFiltros({ ...filtros, dataInicio: e.target.value })}
                  className="w-full p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="filtro-data-fim" className="text-[10px] text-slate-500 dark:text-slate-400">
                  Até
                </label>
                <input
                  id="filtro-data-fim"
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

      {/* Casa legislativa */}
      {casasDisponiveis.length > 0 && (
        <div>
          <label
            htmlFor="filtro-casa"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2"
          >
            Casa legislativa
          </label>
          <select
            id="filtro-casa"
            value={filtros.casa || ''}
            onChange={(e) => onChangeFiltros({ ...filtros, casa: e.target.value })}
            className="w-full py-2 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Todas as casas carregadas</option>
            {casasDisponiveis.map((casa) => (
              <option key={casa} value={casa}>
                {casa}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Esfera */}
      <div>
        <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
          Esfera de poder
        </span>
        <div className="grid grid-cols-3 gap-1">
          {NIVEIS.map((item) => (
            <button
              key={item.id || 'todas'}
              type="button"
              onClick={() => onChangeFiltros({ ...filtros, nivel: item.id })}
              aria-pressed={filtros.nivel === item.id}
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
      <aside
        aria-label="Filtros da agenda"
        className="hidden lg:block w-72 shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs sticky top-20 self-start"
      >
        {content}
      </aside>

      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-900/60 backdrop-blur-xs flex justify-end">
          {/* Backdrop clicável: antes o overlay não fechava nada. */}
          <button
            type="button"
            aria-label="Fechar filtros"
            onClick={onCloseMobile}
            className="absolute inset-0 cursor-default"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros da agenda"
            className="relative w-full max-w-xs bg-white dark:bg-slate-900 h-full p-5 overflow-y-auto shadow-2xl animate-slide-left"
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">Filtros</span>
              <button
                type="button"
                onClick={onCloseMobile}
                aria-label="Fechar filtros"
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            {content}
          </div>
        </div>
      )}
    </>
  );
};
