import React from 'react';
import { Evento } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { formatarDataCurta, rotuloStatus, prazoAberto } from '../services/datas';
import { gerarArquivoICS } from '../services/calendarExport';
import {
  Calendar,
  Clock,
  MapPin,
  ExternalLink,
  Star,
  Share2,
  CalendarPlus,
  Video,
  Sparkles,
  Users,
  FlaskConical,
  Ban,
  CheckCircle2
} from 'lucide-react';

interface EventCardProps {
  evento: Evento;
  isFavorito: boolean;
  onToggleFavorito: (id: string) => void;
  onOpenDetalhes: (evento: Evento) => void;
  onShare: (evento: Evento) => void;
}

/**
 * Cartão de evento.
 *
 * O que mudou:
 *  - o status passou a ser exibido. Antes `evento.status` não era lido em lugar
 *    nenhum do cartão, então um evento CANCELADO aparecia idêntico a um
 *    confirmado. Eventos já realizados também ficam visualmente atenuados;
 *  - registros do modo de demonstração recebem o selo "Exemplo";
 *  - o título virou um botão de verdade (era um `<h4 onClick>`, inalcançável
 *    por teclado e invisível para leitor de tela como controle);
 *  - os botões de ícone ganharam `aria-label` (só tinham `title`).
 */
export const EventCard: React.FC<EventCardProps> = ({
  evento,
  isFavorito,
  onToggleFavorito,
  onOpenDetalhes,
  onShare
}) => {
  const infoMecanismo = MECANISMOS_INFO[evento.mecanismo] || MECANISMOS_INFO.audiencia_publica;
  const status = rotuloStatus(evento);
  const encerrado = status.texto === 'Já realizado';
  const indisponivel = evento.status === 'cancelado' || evento.status === 'adiado';

  const escopo =
    evento.nivel === 'federal'
      ? '🇧🇷 Congresso Nacional'
      : `${evento.uf} · ${evento.casa}`;

  const coresStatus = () => {
    if (evento.status === 'cancelado') return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300';
    if (evento.status === 'adiado') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    if (encerrado) return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
  };

  return (
    <article
      className={`group relative flex flex-col bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 ${
        indisponivel
          ? 'border-red-200 dark:border-red-900/60'
          : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/40'
      } ${encerrado ? 'opacity-75' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${infoMecanismo.badgeBg} ${infoMecanismo.badgeBorder}`}
          >
            <span aria-hidden="true">{infoMecanismo.emoji}</span>
            <span>{infoMecanismo.nome}</span>
          </span>

          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {escopo}
          </span>

          {/* Situação real do evento */}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${coresStatus()}`}
          >
            {evento.status === 'cancelado' || evento.status === 'adiado' ? (
              <Ban className="w-3 h-3" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            )}
            {status.texto}
          </span>

          {evento.isNew && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
              <Sparkles className="w-3 h-3" aria-hidden="true" /> Novo
            </span>
          )}

          {evento.origem === 'demonstracao' && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500 text-white"
              title="Registro ilustrativo do modo de demonstração: não é dado oficial e não entra em exportações."
            >
              <FlaskConical className="w-3 h-3" aria-hidden="true" /> Exemplo
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onToggleFavorito(evento.id)}
          aria-label={isFavorito ? `Remover "${evento.tema}" dos favoritos` : `Salvar "${evento.tema}" nos favoritos`}
          aria-pressed={isFavorito}
          className={`p-2 rounded-xl transition-colors shrink-0 ${
            isFavorito
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'
              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorito ? 'fill-amber-500' : ''}`} aria-hidden="true" />
        </button>
      </div>

      <h3 className="text-base leading-snug mb-3">
        <button
          type="button"
          onClick={() => onOpenDetalhes(evento)}
          className="font-semibold text-left text-slate-900 dark:text-white line-clamp-3 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          {evento.tema}
        </button>
      </h3>

      <div className="mb-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
          <span aria-hidden="true">🏛️</span> {evento.casa_nome}
        </p>
        {evento.comissao && (
          <p className="line-clamp-1 text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>{evento.comissao}</span>
          </p>
        )}
      </div>

      <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {formatarDataCurta(evento.data)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
          <span>
            {evento.hora}
            {evento.hora_fim ? ` às ${evento.hora_fim}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1.5 col-span-2 line-clamp-1">
          {evento.tipo_reuniao === 'virtual' ? (
            <Video className="w-3.5 h-3.5 text-sky-500 shrink-0" aria-hidden="true" />
          ) : (
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{evento.local || 'Local a definir'}</span>
        </div>
      </div>

      {evento.prazo_contribuicao && (
        <p
          className={`text-[11px] mb-3 font-medium ${
            prazoAberto(evento)
              ? 'text-orange-700 dark:text-orange-300'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {prazoAberto(evento)
            ? `Contribuições abertas até ${evento.prazo_contribuicao}`
            : `Prazo de contribuição encerrado em ${evento.prazo_contribuicao}`}
        </p>
      )}

      {evento.proposicoes_relacionadas && evento.proposicoes_relacionadas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {evento.proposicoes_relacionadas.map((prop) => (
            <span
              key={prop}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
            >
              {prop}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onOpenDetalhes(evento)}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          Ver detalhes <span aria-hidden="true">→</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => gerarArquivoICS(evento)}
            title="Baixar arquivo .ics"
            aria-label={`Baixar arquivo de calendário (.ics) para "${evento.tema}"`}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <CalendarPlus className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => onShare(evento)}
            title="Compartilhar evento"
            aria-label={`Compartilhar "${evento.tema}"`}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
          </button>

          {evento.link_oficial && (
            <a
              href={evento.link_oficial}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no portal oficial"
              aria-label={`Abrir a página oficial de "${evento.tema}" em nova aba`}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
};
