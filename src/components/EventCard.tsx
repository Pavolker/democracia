import React from 'react';
import { Evento } from '../types';
import { MECANISMOS_INFO } from '../services/config';
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
  Users
} from 'lucide-react';

interface EventCardProps {
  evento: Evento;
  isFavorito: boolean;
  onToggleFavorito: (id: string) => void;
  onOpenDetalhes: (evento: Evento) => void;
  onShare: (evento: Evento) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  evento,
  isFavorito,
  onToggleFavorito,
  onOpenDetalhes,
  onShare
}) => {
  const infoMecanismo = MECANISMOS_INFO[evento.mecanismo] || MECANISMOS_INFO.audiencia_publica;

  // Format date display (e.g. "15 jul 2025" or "15/07/2025")
  const formatarData = (dataStr: string) => {
    try {
      const [ano, mes, dia] = dataStr.split('-');
      const mesesAbbr = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
      const mesIndex = parseInt(mes, 10) - 1;
      return `${dia} ${mesesAbbr[mesIndex] || mes} ${ano}`;
    } catch {
      return dataStr;
    }
  };

  return (
    <div className="group relative flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200">
      {/* Top Header: Badge Mechanism, UF and Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Mechanism Badge */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${infoMecanismo.badgeBg} ${infoMecanismo.badgeBorder}`}
          >
            <span className="text-xs">{infoMecanismo.emoji}</span>
            <span>{infoMecanismo.nome}</span>
          </span>

          {/* Scope / UF Tag */}
          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {evento.nivel === 'federal' ? '🇧🇷 DF/Federal' : `${evento.uf} · ${evento.casa}`}
          </span>

          {/* New indicator */}
          {evento.isNew && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
              <Sparkles className="w-3 h-3" /> Novo
            </span>
          )}
        </div>

        {/* Favorite Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorito(evento.id);
          }}
          aria-label={isFavorito ? 'Remover dos favoritos' : 'Favoritar evento'}
          className={`p-2 rounded-xl transition-colors ${
            isFavorito
              ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100'
              : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Star className={`w-4 h-4 ${isFavorito ? 'fill-amber-500' : ''}`} />
        </button>
      </div>

      {/* Main Title / Theme */}
      <h4
        onClick={() => onOpenDetalhes(evento)}
        className="font-semibold text-slate-900 dark:text-white text-base leading-snug line-clamp-3 cursor-pointer group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-3"
      >
        {evento.tema}
      </h4>

      {/* Legislative House & Committee */}
      <div className="mb-4 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-700 dark:text-slate-300 line-clamp-1">
          🏛️ {evento.casa_nome}
        </p>
        {evento.comissao && (
          <p className="line-clamp-1 text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            <span>{evento.comissao}</span>
          </p>
        )}
      </div>

      {/* Date, Time & Modality Grid */}
      <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {formatarData(evento.data)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{evento.hora} {evento.hora_fim ? `às ${evento.hora_fim}` : ''}</span>
        </div>

        <div className="flex items-center gap-1.5 col-span-2 line-clamp-1">
          {evento.tipo_reuniao === 'virtual' ? (
            <Video className="w-3.5 h-3.5 text-sky-500 shrink-0" />
          ) : (
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className="truncate">{evento.local || 'Local a definir'}</span>
        </div>
      </div>

      {/* Related propositions tag cloud */}
      {evento.proposicoes_relacionadas && evento.proposicoes_relacionadas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {evento.proposicoes_relacionadas.map((prop, idx) => (
            <span
              key={idx}
              className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono"
            >
              {prop}
            </span>
          ))}
        </div>
      )}

      {/* Card Action Footer */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => onOpenDetalhes(evento)}
          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          Ver detalhes →
        </button>

        <div className="flex items-center gap-1">
          <button
            onClick={() => gerarArquivoICS(evento)}
            title="Adicionar ao calendário (.ics)"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
          </button>

          <button
            onClick={() => onShare(evento)}
            title="Compartilhar evento"
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {evento.link_oficial && (
            <a
              href={evento.link_oficial}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no portal oficial"
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
