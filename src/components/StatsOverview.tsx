import React, { useMemo } from 'react';
import { Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { exportarCSV, exportarJSON } from '../services/calendarExport';
import {
  filtrarParaExportacao,
  separarPorOrigem,
  contarPorMecanismo
} from '../services/eventos';
import { estaEncerrado } from '../services/datas';
import { FileSpreadsheet, FileCode, AlertTriangle } from 'lucide-react';

interface StatsOverviewProps {
  eventos: Evento[];
  onFilterByMecanismo: (mecanismo: MecanismoParticipacao) => void;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  eventos,
  onFilterByMecanismo
}) => {
  // Separação explícita entre dado oficial e amostra ilustrativa.
  const { reais, demonstracao } = useMemo(() => separarPorOrigem(eventos), [eventos]);

  // Contagens por mecanismo: uma sobre o conjunto recebido (o que a agenda
  // mostrará ao clicar) e outra apenas sobre os registros oficiais.
  const countByMec = useMemo(() => contarPorMecanismo(eventos), [eventos]);
  const countOficialByMec = useMemo(() => contarPorMecanismo(reais), [reais]);

  const total = eventos.length;
  const temExemplos = demonstracao.length > 0;
  const eventosExportaveis = useMemo(() => filtrarParaExportacao(eventos), [eventos]);

  // Quantos registros oficiais ainda não terminaram: a base carregada inclui
  // histórico, e a agenda esconde os já encerrados por padrão.
  const aindaPorAcontecer = reais.filter((ev) => !estaEncerrado(ev, new Date())).length;

  return (
    <div className="space-y-4">
      {/* Top row: Summary + Export actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              Painel Nacional Unificado
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            {reais.length} registros oficiais na base
          </h2>
          <p className="text-xs text-slate-300">
            Total da base coletada, sem recorte de filtros: {aindaPorAcontecer} ainda por acontecer
            e {reais.length - aindaPorAcontecer} já encerrados — a agenda esconde os encerrados por
            padrão.
          </p>
          <p className="text-xs text-slate-300">
            {temExemplos &&
              `Além dos ${reais.length} registros oficiais, a base carrega ${demonstracao.length} ${
                demonstracao.length === 1 ? 'registro de exemplo' : 'registros de exemplo'
              } (demonstração), que nunca entram nas exportações. `}
            Os cartões abaixo contam os {total} registros do conjunto atual, por mecanismo; clicar em
            um cartão aplica esse mecanismo como filtro da agenda.
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => exportarCSV(eventosExportaveis)}
            aria-label={`Exportar ${eventosExportaveis.length} eventos oficiais em CSV, sem registros de exemplo`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
            title="Exportar em CSV apenas os eventos oficiais — registros de exemplo são excluídos"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV (sem exemplos)</span>
          </button>

          <button
            type="button"
            onClick={() => exportarJSON(eventosExportaveis)}
            aria-label={`Exportar ${eventosExportaveis.length} eventos oficiais em JSON, sem registros de exemplo`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs border border-white/10 transition-colors"
            title="Exportar em JSON apenas os eventos oficiais — registros de exemplo são excluídos"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>JSON (sem exemplos)</span>
          </button>
        </div>
      </div>

      {/* Aviso explícito de dados de demonstração na base */}
      {temExemplos && (
        <div
          role="note"
          className="flex items-start gap-2 border border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/30 rounded-2xl p-3 text-amber-900 dark:text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs">
            <span className="font-bold">A base carregada contém dados de exemplo.</span>{' '}
            {demonstracao.length} de {total} registros são amostras ilustrativas mantidas no
            código-fonte, não são dados oficiais e não entram nas exportações. Os números oficiais
            deste painel consideram apenas os {reais.length} registros coletados de fontes oficiais.
            As contagens por mecanismo abaixo incluem as amostras, porque é isso que a agenda exibe
            enquanto a demonstração estiver ligada.
          </p>
        </div>
      )}

      {/* 5 Mechanism stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.entries(MECANISMOS_INFO) as [MecanismoParticipacao, typeof MECANISMOS_INFO[MecanismoParticipacao]][]).map(([key, info]) => {
          const noConjunto = countByMec[key] || 0;
          const oficiais = countOficialByMec[key] || 0;
          const exemplos = noConjunto - oficiais;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onFilterByMecanismo(key)}
              aria-label={`Filtrar por ${info.nome}, ${noConjunto} ${noConjunto === 1 ? 'evento' : 'eventos'} no conjunto atual`}
              className="group cursor-pointer text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 transition-all duration-150 shadow-xs hover:shadow-md flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg" aria-hidden="true">{info.emoji}</span>
                <span className="text-xs font-bold text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Filtrar →
                </span>
              </div>

              <div>
                <p className="text-2xl font-black text-slate-900 dark:text-white">
                  {noConjunto}
                </p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 line-clamp-1">
                  {info.nome}
                </p>
                <p className="text-[10px] text-slate-400">
                  {oficiais} {oficiais === 1 ? 'oficial' : 'oficiais'}
                  {exemplos > 0 && ` · ${exemplos} de exemplo`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
