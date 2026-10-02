import React, { useState } from 'react';
import { AlertaCidadao, Evento, MecanismoParticipacao } from '../types';
import { MECANISMOS_INFO, UFS_BRASIL } from '../services/config';
import {
  compararPorDataHora,
  estaEncerrado,
  formatarDataBR,
  formatarDataCurta,
  hojeISO,
  rotuloStatus
} from '../services/datas';
import { chaveUF, eventoCorrespondeAlerta } from '../services/eventos';
import { normalizar } from '../services/texto';
import { Bell, BellOff, CheckCircle2, Plus, Trash2 } from 'lucide-react';

interface AlertsManagerProps {
  alertas: AlertaCidadao[];
  onAddAlerta: (alerta: Omit<AlertaCidadao, 'id' | 'data_criacao'>) => void;
  onRemoveAlerta: (id: string) => void;
  onToggleAtivo: (id: string) => void;
  todosEventos: Evento[];
  onOpenDetalhes: (evento: Evento) => void;
}

/** Quantos eventos correspondentes são listados antes do botão "mostrar todos". */
const LIMITE_PREVIA = 12;

const ID_TEMA = 'filtro-salvo-tema';
const ID_UF = 'filtro-salvo-uf';
const ID_MECANISMO = 'filtro-salvo-mecanismo';
const ID_INCLUIR_ENCERRADOS = 'filtro-salvo-incluir-encerrados';

/** Rótulo do mecanismo para textos que precisam citar a escolha do usuário. */
function rotuloMecanismo(mecanismo: MecanismoParticipacao | 'todos' | undefined): string {
  if (!mecanismo || mecanismo === 'todos') return 'todos os mecanismos';
  return MECANISMOS_INFO[mecanismo]?.nome ?? mecanismo;
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
  const [erroForm, setErroForm] = useState<string | null>(null);
  /** Quando verdadeiro, a correspondência também considera eventos já encerrados. */
  const [incluirEncerrados, setIncluirEncerrados] = useState(false);
  /** Ids com a prévia totalmente expandida. */
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  /** Id do filtro aguardando confirmação de exclusão. */
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

  // Instante deste render: é ele que carimba a hora exibida para a
  // correspondência. Nada é recalculado em segundo plano, então exibir outra
  // hora seria mentira.
  const agora = new Date();
  const horaCalculo = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const hoje = formatarDataBR(hojeISO());

  const janela = incluirEncerrados
    ? 'na agenda completa carregada agora (inclui eventos já encerrados)'
    : 'na agenda a partir de hoje';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tema = novoTema.trim();
    const temaNormalizado = normalizar(tema);

    if (!temaNormalizado) {
      setErroForm('Informe um tema ou palavra-chave para salvar o filtro.');
      return;
    }

    const duplicado = alertas.some(
      (a) =>
        normalizar(a.tema) === temaNormalizado &&
        a.uf === novaUf &&
        (a.mecanismo ?? 'todos') === novoMecanismo
    );

    if (duplicado) {
      setErroForm(
        `Já existe um filtro salvo para "${tema}" em ${
          novaUf === 'TODAS' ? 'qualquer UF' : novaUf
        } com ${rotuloMecanismo(novoMecanismo)}.`
      );
      return;
    }

    onAddAlerta({
      tema,
      uf: novaUf,
      mecanismo: novoMecanismo,
      ativo: true
    });

    setNovoTema('');
    setErroForm(null);
    setShowForm(false);
  };

  /**
   * Correspondência de um filtro salvo com os eventos carregados.
   * Usa a mesma normalização da busca (`eventoCorrespondeAlerta`), então
   * "Educacao" casa com "Educação" e temas de várias palavras exigem todos
   * os termos — antes era um `includes` cru e quase nunca casava.
   */
  const encontrarCorrespondentes = (alerta: AlertaCidadao): Evento[] => {
    if (!alerta.ativo) return [];

    return todosEventos
      .filter((ev) => {
        if (!incluirEncerrados && estaEncerrado(ev, agora)) return false;
        if (alerta.mecanismo && alerta.mecanismo !== 'todos' && ev.mecanismo !== alerta.mecanismo) {
          return false;
        }
        return eventoCorrespondeAlerta(ev, alerta.tema, alerta.uf);
      })
      .sort(compararPorDataHora);
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Saved Filter Button */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Filtros Salvos de Interesse
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
            Guarde temas de interesse e veja aqui, sempre que abrir esta aba, quais eventos da agenda
            atual casam com cada tema. A conferência roda somente nesta tela, enquanto ela está
            aberta: o app não envia notificação, e-mail ou push, e nada é verificado em segundo plano.
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
            <label
              htmlFor={ID_INCLUIR_ENCERRADOS}
              className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <input
                id={ID_INCLUIR_ENCERRADOS}
                type="checkbox"
                checked={incluirEncerrados}
                onChange={(e) => setIncluirEncerrados(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-600 focus:ring-emerald-500"
              />
              Considerar também eventos já encerrados
            </label>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Base: {todosEventos.length} evento(s) carregado(s) agora.{' '}
              {incluirEncerrados
                ? 'Correspondência sobre a agenda completa, inclusive eventos já encerrados.'
                : `Correspondência a partir de ${hoje}.`}{' '}
              Recalculada neste render às {horaCalculo}.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowForm(!showForm);
            setErroForm(null);
          }}
          aria-expanded={showForm}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors self-start sm:self-auto shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Filtro</span>
        </button>
      </div>

      {/* New Saved Filter Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="p-5 bg-white dark:bg-slate-900 border-2 border-emerald-500/40 rounded-2xl shadow-sm space-y-4 animate-fade-in"
        >
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Configurar Filtro Salvo
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Os termos são comparados com o tema, a comissão, o local, a sigla e o nome da casa, a UF
              e as proposições relacionadas de cada evento. Temas com mais de uma palavra exigem que
              todos os termos apareçam, e a comparação ignora acentos e maiúsculas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label
                htmlFor={ID_TEMA}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Palavra-chave ou Tema
              </label>
              <input
                id={ID_TEMA}
                type="text"
                placeholder="Ex: Reforma Tributária, Clima, Saúde..."
                value={novoTema}
                onChange={(e) => {
                  setNovoTema(e.target.value);
                  setErroForm(null);
                }}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor={ID_UF}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Localidade (UF)
              </label>
              <select
                id={ID_UF}
                value={novaUf}
                onChange={(e) => {
                  setNovaUf(e.target.value);
                  setErroForm(null);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="TODAS">Qualquer estado ou Federal</option>
                <option value="FEDERAL">Apenas Federal (Congresso)</option>
                {UFS_BRASIL.map((u) => (
                  <option key={u.sigla} value={u.sigla}>
                    {u.sigla} - {u.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor={ID_MECANISMO}
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
                Mecanismo
              </label>
              <select
                id={ID_MECANISMO}
                value={novoMecanismo}
                onChange={(e) => {
                  setNovoMecanismo(e.target.value as MecanismoParticipacao | 'todos');
                  setErroForm(null);
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="todos">Todos os 5 Mecanismos</option>
                {(
                  Object.entries(MECANISMOS_INFO) as [
                    MecanismoParticipacao,
                    (typeof MECANISMOS_INFO)[MecanismoParticipacao]
                  ][]
                ).map(([k, info]) => (
                  <option key={k} value={k}>
                    {info.emoji} {info.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {erroForm && (
            <p
              role="alert"
              className="flex items-start gap-2 text-[11px] font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-xl px-3 py-2"
            >
              <span>{erroForm}</span>
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setErroForm(null);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Salvar Filtro
            </button>
          </div>
        </form>
      )}

      {/* Saved Filters List */}
      <div className="space-y-4">
        {alertas.length === 0 ? (
          <div className="text-center py-12 px-4 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-3xl">
            <Bell className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Nenhum filtro salvo
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Guarde um tema de interesse para ver, a cada abertura desta aba, quais eventos da agenda
              atual casam com ele. Use o botão &quot;Novo Filtro&quot; para começar. Nada é monitorado
              fora desta tela.
            </p>
          </div>
        ) : (
          alertas.map((alerta) => {
            const matches = encontrarCorrespondentes(alerta);
            const expandido = expandidos[alerta.id] === true;
            const visiveis = expandido ? matches : matches.slice(0, LIMITE_PREVIA);
            const localidade = alerta.uf === 'TODAS' ? 'Qualquer UF' : alerta.uf;
            const confirmando = confirmandoId === alerta.id;

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
                        {localidade}
                      </span>
                      {alerta.mecanismo && alerta.mecanismo !== 'todos' && (
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {MECANISMOS_INFO[alerta.mecanismo]?.nome}
                        </span>
                      )}
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                          alerta.ativo
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}
                      >
                        {alerta.ativo ? 'Filtro ativo' : 'Filtro desativado'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {!alerta.ativo ? (
                        <span className="text-slate-400">
                          Filtro desativado: nenhuma correspondência é calculada enquanto ele estiver
                          assim.
                        </span>
                      ) : matches.length > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {matches.length} evento(s) correspondente(s) {janela}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          Nenhum evento corresponde a este tema {janela}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleAtivo(alerta.id)}
                      aria-pressed={alerta.ativo}
                      aria-label={
                        alerta.ativo
                          ? `Desativar filtro salvo ${alerta.tema}`
                          : `Ativar filtro salvo ${alerta.tema}`
                      }
                      title={alerta.ativo ? 'Desativar filtro salvo' : 'Ativar filtro salvo'}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                        alerta.ativo
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'text-slate-400 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                      }`}
                    >
                      {alerta.ativo ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>

                    {confirmando ? (
                      <div className="flex items-center gap-2">
                        <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400">
                          Excluir este filtro salvo?
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveAlerta(alerta.id);
                            setConfirmandoId(null);
                          }}
                          aria-label={`Confirmar exclusão do filtro salvo ${alerta.tema}`}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmandoId(null)}
                          aria-label={`Cancelar exclusão do filtro salvo ${alerta.tema}`}
                          className="px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmandoId(alerta.id)}
                        aria-label={`Excluir filtro salvo ${alerta.tema}`}
                        title="Excluir filtro salvo"
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Matched events preview */}
                {matches.length > 0 && alerta.ativo && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Eventos correspondentes ({janela}):
                    </p>

                    <div
                      id={`eventos-${alerta.id}`}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {visiveis.map((m) => {
                        const status = rotuloStatus(m, agora);
                        return (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => onOpenDetalhes(m)}
                            aria-label={`Abrir detalhes de ${m.tema} — ${m.casa}, ${formatarDataCurta(
                              m.data
                            )} às ${m.hora}`}
                            className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer text-xs transition-colors"
                          >
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                              <span>
                                {m.casa} · {chaveUF(m)}
                              </span>
                              <span>{formatarDataCurta(m.data)}</span>
                            </div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">
                              {m.tema}
                            </p>
                            {status.texto !== 'Confirmado' && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                    status.tom === 'alerta'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {status.texto}
                                </span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {matches.length > LIMITE_PREVIA && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-400">
                          {expandido
                            ? `Exibindo todos os ${matches.length} eventos correspondentes.`
                            : `Exibindo ${visiveis.length} dos ${matches.length} eventos correspondentes.`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandidos((prev) => ({ ...prev, [alerta.id]: !expandido }))
                          }
                          aria-expanded={expandido}
                          aria-controls={`eventos-${alerta.id}`}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-md px-1"
                        >
                          {expandido
                            ? `Mostrar apenas os ${LIMITE_PREVIA} primeiros`
                            : `Mostrar todos os ${matches.length} eventos correspondentes`}
                        </button>
                      </div>
                    )}
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
