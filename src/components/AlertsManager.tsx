import React, { useState } from 'react';
import { AlertaCidadao, Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO, UFS_BRASIL } from '../services/config';
import { Bell, BellOff, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AlertsManagerProps {
  alertas: AlertaCidadao[];
  onAddAlerta: (alerta: Omit<AlertaCidadao, 'id' | 'data_criacao'>) => void;
  onRemoveAlerta: (id: string) => void;
  onToggleAtivo: (id: string) => void;
  todosEventos: Evento[];
  onOpenDetalhes: (evento: Evento) => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({
  alertas,
  onAddAlerta,
  onRemoveAlerta,
  onToggleAtivo,
  todosEventos,
  onOpenDetalhes
}) => {
  const [novoTema, setNovoTema] = useState('');
  const [novaUf, setNovaUf] = useState('TODAS');
  const [novoMecanismo, setNovoMecanismo] = useState<MecanismoParticipacao | 'todos'>('todos');
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTema.trim()) return;

    onAddAlerta({
      tema: novoTema.trim(),
      uf: novaUf,
      mecanismo: novoMecanismo,
      ativo: true
    });

    setNovoTema('');
    setShowForm(false);
  };

  // Helper to find matching events for an alert
  const getEventosCorrespondentes = (alerta: AlertaCidadao) => {
    if (!alerta.ativo) return [];
    const t = alerta.tema.toLowerCase();

    return todosEventos.filter(ev => {
      // Check UF
      if (alerta.uf !== 'TODAS') {
        if (alerta.uf === 'FEDERAL' && ev.nivel !== 'federal') return false;
        if (alerta.uf !== 'FEDERAL' && ev.uf !== alerta.uf) return false;
      }
      // Check mecanismo
      if (alerta.mecanismo && alerta.mecanismo !== 'todos') {
        if (ev.mecanismo !== alerta.mecanismo) return false;
      }
      // Check tema
      const evTema = (ev.tema || '').toLowerCase();
      const evProps = (ev.proposicoes_relacionadas || []).join(' ').toLowerCase();
      return evTema.includes(t) || evProps.includes(t);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Alert Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Alertas Cidadãos Personalizados
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Receba aviso visual imediato sempre que novas audiências, consultas ou proposições baterem com seu tema de interesse.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors self-start sm:self-auto shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Alerta</span>
        </button>
      </div>

      {/* New Alert Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 bg-white dark:bg-slate-900 border-2 border-emerald-500/40 rounded-2xl shadow-sm space-y-4 animate-fade-in"
        >
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">
            Configurar Alerta Temático
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Palavra-chave ou Tema
              </label>
              <input
                type="text"
                placeholder="Ex: Reforma Tributária, Clima, Saúde..."
                value={novoTema}
                onChange={(e) => setNovoTema(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Localidade (UF)
              </label>
              <select
                value={novaUf}
                onChange={(e) => setNovaUf(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="TODAS">Qualquer estado ou Federal</option>
                <option value="FEDERAL">Apenas Federal (Congresso)</option>
                {UFS_BRASIL.map(u => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.sigla} - {u.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mecanismo
              </label>
              <select
                value={novoMecanismo}
                onChange={(e) => setNovoMecanismo(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todos">Todos os 5 Mecanismos</option>
                {(Object.entries(MECANISMOS_INFO) as [MecanismoParticipacao, typeof MECANISMOS_INFO[MecanismoParticipacao]][]).map(([k, info]) => (
                  <option key={k} value={k}>
                    {info.emoji} {info.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Salvar Alerta
            </button>
          </div>
        </form>
      )}

      {/* Alerts List */}
      <div className="space-y-4">
        {alertas.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
            <Bell className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Nenhum alerta ativo
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Crie um alerta para monitorar pautas sobre sua cidade, estado ou área de atuação.
            </p>
          </div>
        ) : (
          alertas.map(alerta => {
            const matches = getEventosCorrespondentes(alerta);

            return (
              <div
                key={alerta.id}
                className={`p-5 rounded-2xl border transition-all ${
                  alerta.ativo
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        🔔 &quot;{alerta.tema}&quot;
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {alerta.uf === 'TODAS' ? 'Qualquer UF' : alerta.uf}
                      </span>
                      {alerta.mecanismo && alerta.mecanismo !== 'todos' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {MECANISMOS_INFO[alerta.mecanismo]?.nome}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {matches.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {matches.length} evento(s) correspondente(s) identificado(s) na agenda
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Nenhum evento futuro com este termo até o momento
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onToggleAtivo(alerta.id)}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-colors ${
                        alerta.ativo
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'text-slate-400 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                      title={alerta.ativo ? 'Desativar alerta' : 'Ativar alerta'}
                    >
                      {alerta.ativo ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => onRemoveAlerta(alerta.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Excluir alerta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Matched items accordion / preview */}
                {matches.length > 0 && alerta.ativo && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Eventos Detectados:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matches.map(m => (
                        <div
                          key={m.id}
                          onClick={() => onOpenDetalhes(m)}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 cursor-pointer text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                            <span>{m.casa} · {m.uf}</span>
                            <span>{m.data}</span>
                          </div>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                            {m.tema}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
