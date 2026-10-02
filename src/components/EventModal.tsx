import React, { useEffect, useRef } from 'react';
import { Evento } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { gerarArquivoICS, abrirGoogleCalendar } from '../services/calendarExport';
import { formatarDataBR, prazoAberto, rotuloStatus } from '../services/datas';
import {
  X,
  ExternalLink,
  Calendar,
  Clock,
  MapPin,
  Users,
  Video,
  FileText,
  Star,
  Share2,
  CalendarPlus,
  Send,
  Info,
  CalendarCheck,
  Ban,
  AlertTriangle
} from 'lucide-react';

interface EventModalProps {
  evento: Evento | null;
  onClose: () => void;
  isFavorito: boolean;
  onToggleFavorito: (id: string) => void;
  onShare: (evento: Evento) => void;
  todosEventos: Evento[];
  onSelectRelacionado: (evento: Evento) => void;
}

const ROTULOS_MODALIDADE: Record<Evento['tipo_reuniao'], string> = {
  presencial: 'Presencial',
  virtual: 'Virtual (online)',
  hibrida: 'Híbrida (presencial e online)'
};

/** Extrai só o domínio, para o cidadão saber para onde o link leva antes de clicar. */
function dominio(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Detalhe do evento.
 *
 * O que mudou:
 *  - o diálogo agora tem semântica (`role="dialog"`, `aria-modal`,
 *    `aria-labelledby`), fecha com Esc (tratado no App) e com clique no fundo,
 *    e prende o foco enquanto está aberto — antes, Esc e clique no backdrop não
 *    faziam nada e o `stopPropagation` do painel não protegia coisa alguma,
 *    porque o fundo não tinha handler;
 *  - o CTA de inscrição só aparece quando a casa realmente publicou um canal,
 *    o rótulo diz o que o link é, e o domínio de destino fica visível;
 *  - o rodapé não expõe mais o ID interno como se fosse identificador oficial;
 *  - data em formato brasileiro, modalidade traduzida, prazo com estado real.
 */
export const EventModal: React.FC<EventModalProps> = ({
  evento,
  onClose,
  isFavorito,
  onToggleFavorito,
  onShare,
  todosEventos,
  onSelectRelacionado
}) => {
  const painelRef = useRef<HTMLDivElement>(null);
  const botaoFecharRef = useRef<HTMLButtonElement>(null);
  const focoAnteriorRef = useRef<HTMLElement | null>(null);

  // Foco inicial no diálogo e devolução do foco ao fechar.
  useEffect(() => {
    if (!evento) return;
    focoAnteriorRef.current = document.activeElement as HTMLElement | null;
    botaoFecharRef.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflowAnterior;
      focoAnteriorRef.current?.focus?.();
    };
  }, [evento]);

  // Prende o foco dentro do diálogo enquanto ele estiver aberto.
  useEffect(() => {
    if (!evento) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const painel = painelRef.current;
      if (!painel) return;
      const focaveis = Array.from(
        painel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focaveis.length === 0) return;

      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [evento]);

  if (!evento) return null;

  const infoMecanismo = MECANISMOS_INFO[evento.mecanismo] || MECANISMOS_INFO.audiencia_publica;
  const status = rotuloStatus(evento);
  const encerrado = status.texto === 'Já realizado';
  const cancelado = evento.status === 'cancelado';
  const adiado = evento.status === 'adiado';
  // Um canal de participação só é oferecido enquanto ele pode existir.
  const podeParticipar = !encerrado && !cancelado && !adiado;

  const relacionados = todosEventos
    .filter(
      (e) =>
        e.id !== evento.id &&
        (e.uf === evento.uf ||
          (e.comissao && evento.comissao && e.comissao === evento.comissao) ||
          (e.mecanismo === evento.mecanismo && e.nivel === evento.nivel))
    )
    .slice(0, 3);

  const rotuloInscricao = () => {
    switch (evento.mecanismo) {
      case 'consulta_publica':
        return 'Enviar contribuição pelo canal oficial';
      case 'sugestao_legislativa':
        return 'Apoiar esta sugestão no canal oficial';
      case 'audiencia_publica':
        return 'Participar da audiência pelo canal oficial';
      case 'dialogo_social_plenaria':
        return 'Inscrever-se para o diálogo pelo canal oficial';
      default:
        return 'Acessar o canal de participação oficial';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in"
      // Backdrop: antes não fechava nada.
      onClick={onClose}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-evento-modal"
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${infoMecanismo.badgeBg} ${infoMecanismo.badgeBorder}`}
              >
                <span aria-hidden="true">{infoMecanismo.emoji}</span>
                <span>{infoMecanismo.nome}</span>
              </span>

              <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {evento.nivel === 'federal'
                  ? '🇧🇷 Congresso Nacional'
                  : `${evento.uf} · ${evento.casa}`}
              </span>

              <span
                className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                  cancelado
                    ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                    : adiado || encerrado
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                }`}
              >
                {cancelado || adiado ? (
                  <Ban className="w-3 h-3" aria-hidden="true" />
                ) : null}
                {status.texto}
              </span>
            </div>

            <h2
              id="titulo-evento-modal"
              className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight"
            >
              {evento.tema}
            </h2>
          </div>

          <button
            ref={botaoFecharRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes do evento"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Avisos que mudam a decisão do cidadão */}
          {cancelado && (
            <div
              role="alert"
              className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl"
            >
              <Ban className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
              <p className="text-sm text-red-900 dark:text-red-200">
                A fonte oficial informa este evento como <strong>cancelado</strong>.
              </p>
            </div>
          )}

          {adiado && (
            <div
              role="alert"
              className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <p className="text-sm text-amber-900 dark:text-amber-200">
                A fonte oficial informa este evento como <strong>adiado ou não realizado</strong>. Confirme a nova
                data no portal da casa antes de se deslocar.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Calendar className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Data</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatarDataBR(evento.data)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Clock className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Horário</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">
                  {evento.hora} {evento.hora_fim ? `até ${evento.hora_fim}` : ''}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                {evento.tipo_reuniao === 'virtual' ? (
                  <Video className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <MapPin className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Local e formato</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  {evento.local || 'Local não informado pela casa'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {ROTULOS_MODALIDADE[evento.tipo_reuniao]}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Users className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Casa e órgão</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{evento.casa_nome}</p>
                {evento.comissao && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{evento.comissao}</p>
                )}
              </div>
            </div>
          </div>

          {evento.prazo_contribuicao && (
            <div
              className={`flex items-center gap-3 p-4 rounded-2xl border ${
                prazoAberto(evento)
                  ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
              }`}
            >
              <CalendarCheck
                className={`w-5 h-5 shrink-0 ${
                  prazoAberto(evento) ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'
                }`}
                aria-hidden="true"
              />
              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {prazoAberto(evento) ? 'Prazo de contribuição aberto' : 'Prazo de contribuição encerrado'}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Data limite informada: <strong>{formatarDataBR(evento.prazo_contribuicao)}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Sobre este mecanismo: {infoMecanismo.nome}
            </p>
            <p className="text-slate-600 dark:text-slate-400">{infoMecanismo.descricao}</p>
          </div>

          {evento.proposicoes_relacionadas && evento.proposicoes_relacionadas.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4" aria-hidden="true" /> Proposições em pauta
              </h3>
              <div className="flex flex-wrap gap-2">
                {evento.proposicoes_relacionadas.map((prop) => (
                  <span
                    key={prop}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-mono font-medium border border-slate-200 dark:border-slate-700"
                  >
                    {prop}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            {podeParticipar && evento.inscricao && (
              <a
                href={evento.inscricao}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="font-medium text-sm block">{rotuloInscricao()}</span>
                    <span className="text-[11px] opacity-80 block truncate">
                      Link publicado pela casa · {dominio(evento.inscricao)}
                    </span>
                  </span>
                </span>
                <ExternalLink className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              </a>
            )}

            {!podeParticipar && (
              <p className="text-xs text-slate-500 dark:text-slate-400 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                Nenhum canal de participação é oferecido para este evento porque ele está{' '}
                {cancelado ? 'cancelado' : adiado ? 'adiado' : 'encerrado'}. Consulte o portal da casa para a
                situação atual.
              </p>
            )}

            {podeParticipar && !evento.inscricao && (
              <p className="text-xs text-slate-500 dark:text-slate-400 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                A casa não publicou um link de inscrição para este evento. Use o link oficial abaixo para confirmar
                como participar.
              </p>
            )}

            {evento.link_transmissao && (
              <a
                href={evento.link_transmissao}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/60 hover:bg-red-100 transition-colors"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Video className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="font-medium text-sm block">Abrir gravação ou transmissão</span>
                    <span className="text-[11px] opacity-80 block truncate">{dominio(evento.link_transmissao)}</span>
                  </span>
                </span>
                <ExternalLink className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
              </a>
            )}
          </div>

          {relacionados.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Eventos relacionados</h3>
              <div className="space-y-2">
                {relacionados.map((rel) => (
                  <button
                    key={rel.id}
                    type="button"
                    onClick={() => onSelectRelacionado(rel)}
                    className="w-full text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                  >
                    <span className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>
                        {rel.casa} · {formatarDataBR(rel.data)} · {rotuloStatus(rel).texto}
                      </span>
                      <span className="font-mono">{rel.nivel === 'federal' ? 'FEDERAL' : rel.uf}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 block">
                      {rel.tema}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Procedência */}
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span>
              Procedência:{' '}
              <strong className="text-slate-700 dark:text-slate-300">
                fonte oficial
              </strong>
            </span>
            {evento.fonte && (
              <span className="truncate">Consultado em {dominio(evento.fonte)}</span>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorito(evento.id)}
              aria-pressed={isFavorito}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                isFavorito
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorito ? 'fill-white' : ''}`} aria-hidden="true" />
              {isFavorito ? 'Salvo nos favoritos' : 'Favoritar'}
            </button>

            <button
              type="button"
              onClick={() => onShare(evento)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
              Compartilhar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => gerarArquivoICS(evento)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Baixar .ics
            </button>

            <button
              type="button"
              onClick={() => abrirGoogleCalendar(evento)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500" aria-hidden="true" />
              Google Calendar
            </button>

            {evento.link_oficial && (
              <a
                href={evento.link_oficial}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
              >
                <span>Abrir página oficial</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
