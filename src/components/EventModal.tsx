import React from 'react';
import { Evento } from '../types';
import { MECANISMOS_INFO } from '../services/config';
import { gerarArquivoICS, abrirGoogleCalendar } from '../services/calendarExport';
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
  CalendarCheck
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

export const EventModal: React.FC<EventModalProps> = ({
  evento,
  onClose,
  isFavorito,
  onToggleFavorito,
  onShare,
  todosEventos,
  onSelectRelacionado
}) => {
  if (!evento) return null;

  const infoMecanismo = MECANISMOS_INFO[evento.mecanismo] || MECANISMOS_INFO.audiencia_publica;

  // Find related events (same UF, same commission or similar keywords)
  const relacionados = todosEventos
    .filter(e => e.id !== evento.id && (
      e.uf === evento.uf ||
      (e.comissao && evento.comissao && e.comissao.toLowerCase() === evento.comissao.toLowerCase()) ||
      (e.mecanismo === evento.mecanismo && e.nivel === evento.nivel)
    ))
    .slice(0, 3);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with colored border / accent */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${infoMecanismo.badgeBg} ${infoMecanismo.badgeBorder}`}
              >
                <span>{infoMecanismo.emoji}</span>
                <span>{infoMecanismo.nome}</span>
              </span>

              <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {evento.nivel === 'federal' ? '🇧🇷 Nível Federal' : `${evento.uf} · Nível ${evento.nivel}`}
              </span>

              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                evento.status === 'confirmado'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}>
                {evento.status === 'confirmado' ? 'Confirmado' : evento.status}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              {evento.tema}
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Key metadata grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Data do Evento</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{evento.data}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Clock className="w-5 h-5" />
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
                {evento.tipo_reuniao === 'virtual' ? <Video className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Local / Formato</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  {evento.local || 'Local não especificado'} ({evento.tipo_reuniao})
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Casa / Órgão</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                  {evento.casa_nome}
                </p>
                {evento.comissao && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">{evento.comissao}</p>
                )}
              </div>
            </div>
          </div>

          {/* Prazo de Contribuição se aplicável */}
          {evento.prazo_contribuicao && (
            <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-2xl">
              <CalendarCheck className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                  Prazo Limite para Contribuições
                </p>
                <p className="text-sm text-orange-900 dark:text-orange-200">
                  Envie sua manifestação até <strong>{evento.prazo_contribuicao}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Explanation of mechanism */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Sobre este mecanismo: {infoMecanismo.nome}
            </p>
            <p className="text-slate-600 dark:text-slate-400">{infoMecanismo.descricao}</p>
          </div>

          {/* Related bills / propositions */}
          {evento.proposicoes_relacionadas && evento.proposicoes_relacionadas.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> Proposições em Pauta
              </h4>
              <div className="flex flex-wrap gap-2">
                {evento.proposicoes_relacionadas.map((prop, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-mono font-medium border border-slate-200 dark:border-slate-700"
                  >
                    {prop}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Inscrição e Transmissão Links */}
          <div className="space-y-2">
            {evento.inscricao && (
              <a
                href={evento.inscricao}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium text-sm">Inscrever-se para manifestação / tribuna / envio de parecer</span>
                </div>
                <ExternalLink className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </a>
            )}

            {evento.link_transmissao && (
              <a
                href={evento.link_transmissao}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800/60 hover:bg-red-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="font-medium text-sm">Acompanhar transmissão ao vivo</span>
                </div>
                <ExternalLink className="w-4 h-4 text-red-600 dark:text-red-400" />
              </a>
            )}
          </div>

          {/* Related Events Section */}
          {relacionados.length > 0 && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                Eventos Relacionados
              </h4>
              <div className="space-y-2">
                {relacionados.map(rel => (
                  <div
                    key={rel.id}
                    onClick={() => onSelectRelacionado(rel)}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                      <span>{rel.casa} · {rel.data}</span>
                      <span className="font-mono">{rel.uf}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2">
                      {rel.tema}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit / Extraction Info */}
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
            <span>ID: {evento.id}</span>
            <span>Fonte oficial: {evento.fonte}</span>
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorito(evento.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                isFavorito
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorito ? 'fill-white' : ''}`} />
              {isFavorito ? 'Salvo nos Favoritos' : 'Favoritar'}
            </button>

            <button
              onClick={() => onShare(evento)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Compartilhar
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => gerarArquivoICS(evento)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              Baixar .ICS
            </button>

            <button
              onClick={() => abrirGoogleCalendar(evento)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              Google Calendar
            </button>

            {evento.link_oficial && (
              <a
                href={evento.link_oficial}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
              >
                <span>Abrir link oficial</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
