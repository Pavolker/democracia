import React, { useState } from 'react';
import { UFS_BRASIL } from '../services/config';

interface BrazilMapProps {
  eventosCountPorUF: Record<string, number>;
  selectedUF: string;
  onSelectUF: (uf: string) => void;
}

// Approximate SVG paths and relative coordinates for Brazil States
// Designed for a crisp, responsive 650x650 viewport
const BRAZIL_STATES_GEO: Array<{
  uf: string;
  nome: string;
  d: string;
  labelX: number;
  labelY: number;
}> = [
  // NORTE
  {
    uf: 'RR',
    nome: 'Roraima',
    d: 'M 220 50 L 260 40 L 290 70 L 270 120 L 230 110 L 210 80 Z',
    labelX: 250,
    labelY: 80
  },
  {
    uf: 'AP',
    nome: 'Amapá',
    d: 'M 370 70 L 410 70 L 415 120 L 380 130 L 360 100 Z',
    labelX: 385,
    labelY: 100
  },
  {
    uf: 'AM',
    nome: 'Amazonas',
    d: 'M 90 100 L 220 100 L 250 130 L 260 210 L 190 230 L 140 220 L 90 170 Z',
    labelX: 175,
    labelY: 165
  },
  {
    uf: 'PA',
    nome: 'Pará',
    d: 'M 260 120 L 370 110 L 420 130 L 400 230 L 330 250 L 270 210 Z',
    labelX: 335,
    labelY: 175
  },
  {
    uf: 'AC',
    nome: 'Acre',
    d: 'M 40 200 L 100 190 L 130 220 L 100 240 L 45 220 Z',
    labelX: 85,
    labelY: 220
  },
  {
    uf: 'RO',
    nome: 'Rondônia',
    d: 'M 140 225 L 200 225 L 220 280 L 170 290 L 140 250 Z',
    labelX: 180,
    labelY: 260
  },
  {
    uf: 'TO',
    nome: 'Tocantins',
    d: 'M 350 225 L 390 220 L 400 310 L 360 330 L 340 270 Z',
    labelX: 370,
    labelY: 275
  },
  // NORDESTE
  {
    uf: 'MA',
    nome: 'Maranhão',
    d: 'M 410 130 L 470 130 L 460 210 L 410 220 L 395 170 Z',
    labelX: 435,
    labelY: 175
  },
  {
    uf: 'PI',
    nome: 'Piauí',
    d: 'M 465 150 L 505 160 L 490 240 L 450 240 L 455 190 Z',
    labelX: 475,
    labelY: 200
  },
  {
    uf: 'CE',
    nome: 'Ceará',
    d: 'M 505 140 L 550 145 L 545 190 L 505 180 Z',
    labelX: 525,
    labelY: 165
  },
  {
    uf: 'RN',
    nome: 'Rio Grande do Norte',
    d: 'M 550 150 L 585 155 L 580 180 L 545 175 Z',
    labelX: 565,
    labelY: 165
  },
  {
    uf: 'PB',
    nome: 'Paraíba',
    d: 'M 545 180 L 590 185 L 585 205 L 540 200 Z',
    labelX: 565,
    labelY: 195
  },
  {
    uf: 'PE',
    nome: 'Pernambuco',
    d: 'M 495 200 L 585 205 L 580 225 L 485 220 Z',
    labelX: 535,
    labelY: 215
  },
  {
    uf: 'AL',
    nome: 'Alagoas',
    d: 'M 550 225 L 580 230 L 570 250 L 545 240 Z',
    labelX: 562,
    labelY: 238
  },
  {
    uf: 'SE',
    nome: 'Sergipe',
    d: 'M 535 245 L 565 250 L 555 270 L 530 260 Z',
    labelX: 545,
    labelY: 258
  },
  {
    uf: 'BA',
    nome: 'Bahia',
    d: 'M 420 225 L 515 225 L 545 275 L 530 350 L 450 355 L 415 290 Z',
    labelX: 475,
    labelY: 290
  },
  // CENTRO-OESTE
  {
    uf: 'MT',
    nome: 'Mato Grosso',
    d: 'M 220 215 L 330 215 L 340 330 L 280 370 L 230 330 L 210 260 Z',
    labelX: 275,
    labelY: 290
  },
  {
    uf: 'GO',
    nome: 'Goiás',
    d: 'M 345 320 L 410 320 L 420 390 L 360 410 L 335 360 Z',
    labelX: 375,
    labelY: 360
  },
  {
    uf: 'DF',
    nome: 'Distrito Federal',
    d: 'M 395 350 L 415 350 L 415 370 L 395 370 Z',
    labelX: 405,
    labelY: 360
  },
  {
    uf: 'MS',
    nome: 'Mato Grosso do Sul',
    d: 'M 265 370 L 340 365 L 350 440 L 285 450 L 255 410 Z',
    labelX: 300,
    labelY: 410
  },
  // SUDESTE
  {
    uf: 'MG',
    nome: 'Minas Gerais',
    d: 'M 410 330 L 490 335 L 505 400 L 460 440 L 390 410 Z',
    labelX: 445,
    labelY: 385
  },
  {
    uf: 'ES',
    nome: 'Espírito Santo',
    d: 'M 495 385 L 525 390 L 515 435 L 485 425 Z',
    labelX: 505,
    labelY: 410
  },
  {
    uf: 'RJ',
    nome: 'Rio de Janeiro',
    d: 'M 455 435 L 505 435 L 480 465 L 440 455 Z',
    labelX: 470,
    labelY: 450
  },
  {
    uf: 'SP',
    nome: 'São Paulo',
    d: 'M 350 415 L 435 415 L 450 465 L 370 480 L 335 450 Z',
    labelX: 395,
    labelY: 450
  },
  // SUL
  {
    uf: 'PR',
    nome: 'Paraná',
    d: 'M 320 460 L 395 460 L 400 505 L 330 515 L 305 480 Z',
    labelX: 355,
    labelY: 488
  },
  {
    uf: 'SC',
    nome: 'Santa Catarina',
    d: 'M 325 515 L 395 510 L 385 550 L 320 545 Z',
    labelX: 355,
    labelY: 532
  },
  {
    uf: 'RS',
    nome: 'Rio Grande do Sul',
    d: 'M 305 545 L 380 545 L 370 615 L 290 605 L 285 570 Z',
    labelX: 335,
    labelY: 580
  }
];

/**
 * Paleta única do mapa.
 *
 * A legenda e o preenchimento dos estados saem da MESMA lista: enquanto isso era
 * duplicado, a legenda mostrava tons de `teal-*` que a função de cor não
 * retornava (ela usava `#99f6e4`, `#2dd4bf`, `#14b8a6`, `#0d9488`).
 */
const COR_SEM_EVENTOS = '#cbd5e1'; // slate-300
const COR_SELECIONADO = '#059669'; // emerald-600

/** Faixas de intensidade, do menor para o maior. `acimaDe` é fração do máximo. */
const ESCALA_EVENTOS: Array<{ cor: string; acimaDe: number; rotulo: string }> = [
  { cor: '#99f6e4', acimaDe: 0, rotulo: 'até 20% do maior valor' },
  { cor: '#2dd4bf', acimaDe: 0.2, rotulo: 'entre 20% e 40%' },
  { cor: '#14b8a6', acimaDe: 0.4, rotulo: 'entre 40% e 70%' },
  { cor: '#0d9488', acimaDe: 0.7, rotulo: 'acima de 70%' }
];

function corPorIntensidade(ratio: number): string {
  let cor = ESCALA_EVENTOS[0].cor;
  for (const faixa of ESCALA_EVENTOS) {
    if (ratio > faixa.acimaDe) cor = faixa.cor;
  }
  return cor;
}

export const BrazilMap: React.FC<BrazilMapProps> = ({
  eventosCountPorUF,
  selectedUF,
  onSelectUF
}) => {
  // Estado destacado (hover OU foco de teclado) — os dois abrem o tooltip.
  const [ufDestacada, setUfDestacada] = useState<string | null>(null);

  // Calculate maximum events for dynamic color scaling
  const maxCount = Math.max(...Object.values(eventosCountPorUF), 5);

  const getColor = (uf: string) => {
    const count = eventosCountPorUF[uf] ?? 0;

    if (selectedUF === uf) {
      return COR_SELECIONADO;
    }
    if (count === 0) {
      return COR_SEM_EVENTOS;
    }

    // Gradient based on intensity
    return corPorIntensidade(count / maxCount);
  };

  /** Alterna o filtro da UF (clique, Enter ou Espaço). */
  const alternarUF = (uf: string) => {
    const jaSelecionada = selectedUF === uf;
    onSelectUF(jaSelecionada ? 'TODAS' : uf);
  };

  const destacadaInfo = ufDestacada
    ? {
        uf: ufDestacada,
        nome: UFS_BRASIL.find(u => u.sigla === ufDestacada)?.nome || ufDestacada,
        total: eventosCountPorUF[ufDestacada] ?? 0
      }
    : null;

  // Escopo nacional (Congresso) e DF (CLDF) são contadores distintos:
  // 'FEDERAL' agrega Câmara e Senado e não existe fallback para o DF.
  const totalFederal = eventosCountPorUF['FEDERAL'] ?? 0;
  const totalDF = eventosCountPorUF['DF'] ?? 0;

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center select-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
      <div className="w-full flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <span aria-hidden="true">🗺️</span> Mapa da Participação Legislativa
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Clique em qualquer estado, no Distrito Federal ou no contador federal para filtrar os
            eventos — a seleção abre a aba da agenda com o filtro aplicado.
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Desenho esquemático: as áreas não estão em escala cartográfica precisa e servem apenas
            para localizar cada casa legislativa.
          </p>
        </div>

        {selectedUF !== 'TODAS' && (
          <button
            type="button"
            onClick={() => onSelectUF('TODAS')}
            className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Limpar filtro ({selectedUF}) ✕
          </button>
        )}
      </div>

      {/* SVG Map Canvas */}
      <div className="relative w-full aspect-square max-w-[540px]">
        <svg
          viewBox="0 0 650 650"
          className="w-full h-full drop-shadow-md"
          role="group"
          aria-labelledby="mapa-titulo mapa-descricao"
        >
          {/*
            O svg não usa role="img": cada estado é um botão operável por
            teclado, e role="img" esconderia todo o conteúdo interno da árvore
            de acessibilidade.
          */}
          <title id="mapa-titulo">Mapa da participação legislativa por unidade federativa</title>
          <desc id="mapa-descricao">
            Mapa esquemático do Brasil, sem escala cartográfica precisa. Cada unidade federativa é
            um botão que informa o nome do estado e a quantidade de eventos na agenda e aplica o
            filtro de localidade ao ser acionado. Use Tab para percorrer os estados e Enter ou
            Espaço para selecionar.
          </desc>

          {/* Background subtle border */}
          <rect width="650" height="650" fill="transparent" aria-hidden="true" />

          {/* State Polygons */}
          {BRAZIL_STATES_GEO.map(state => {
            const isSelected = selectedUF === state.uf;
            const isDestacada = ufDestacada === state.uf;
            const count = eventosCountPorUF[state.uf] ?? 0;

            return (
              <g
                key={state.uf}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${state.nome} (${state.uf}): ${count} ${
                  count === 1 ? 'evento' : 'eventos'
                } na agenda. ${
                  isSelected ? 'Filtro ativo; acione para limpar' : 'Acione para filtrar a agenda'
                }`}
                className="cursor-pointer transition-all duration-200 group focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
                onClick={() => alternarUF(state.uf)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    alternarUF(state.uf);
                  }
                }}
                onMouseEnter={() => setUfDestacada(state.uf)}
                onMouseLeave={() => setUfDestacada(null)}
                onFocus={() => setUfDestacada(state.uf)}
                onBlur={() => setUfDestacada(null)}
              >
                <path
                  d={state.d}
                  fill={getColor(state.uf)}
                  stroke={isSelected ? '#064e3b' : isDestacada ? '#065f46' : '#334155'}
                  strokeWidth={isSelected ? '3' : isDestacada ? '2' : '1.2'}
                  strokeLinejoin="round"
                  className="transition-all duration-150 filter hover:brightness-110 active:scale-[0.99] origin-center"
                />

                {/* State Code Label (decorativo: a sigla já vai no aria-label) */}
                <text
                  x={state.labelX}
                  y={state.labelY}
                  fontSize={state.uf === 'DF' || state.uf === 'SE' ? '10' : '12'}
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isSelected || count > 2 ? '#ffffff' : '#0f172a'}
                  className="pointer-events-none drop-shadow-sm font-mono tracking-tight"
                  aria-hidden="true"
                  focusable="false"
                >
                  {state.uf}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip (hover de mouse ou foco de teclado) */}
        {destacadaInfo && (
          <div
            aria-hidden="true"
            className="absolute bottom-4 left-4 bg-slate-900/90 text-white backdrop-blur-sm px-3 py-2 rounded-xl text-xs shadow-lg pointer-events-none border border-slate-700"
          >
            <p className="font-bold text-emerald-400">{destacadaInfo.nome} ({destacadaInfo.uf})</p>
            <p className="text-slate-200">
              {destacadaInfo.total} {destacadaInfo.total === 1 ? 'evento' : 'eventos'} na agenda
            </p>
          </div>
        )}
      </div>

      {/* Heatmap Legend — derivada da mesma paleta usada para pintar os estados */}
      <div className="w-full mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span>Menos eventos</span>
            <div className="flex items-center gap-1" aria-hidden="true">
              <span
                className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-slate-600"
                style={{ backgroundColor: COR_SEM_EVENTOS }}
                title="Sem eventos na agenda"
              />
              {ESCALA_EVENTOS.map(faixa => (
                <span
                  key={faixa.cor}
                  className="w-3.5 h-3.5 rounded"
                  style={{ backgroundColor: faixa.cor }}
                  title={faixa.rotulo}
                />
              ))}
            </div>
            <span>Mais eventos</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: COR_SELECIONADO }}
                aria-hidden="true"
              />
              Selecionado
            </span>
            <span className="text-slate-400" aria-hidden="true">|</span>
            <span className="inline-flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block border border-slate-300 dark:border-slate-600"
                style={{ backgroundColor: COR_SEM_EVENTOS }}
                aria-hidden="true"
              />
              Sem eventos
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          A cor de cada estado é proporcional ao número de eventos da UF em relação à UF com mais
          eventos nesta base.
        </p>

        {/* Contadores nacionais: federal (Congresso) e DF (CLDF) são coisas distintas */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => onSelectUF(selectedUF === 'FEDERAL' ? 'TODAS' : 'FEDERAL')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
              selectedUF === 'FEDERAL'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="font-mono font-bold">FEDERAL</span>
            <span>Congresso Nacional (federal): {totalFederal} eventos</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectUF(selectedUF === 'DF' ? 'TODAS' : 'DF')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
              selectedUF === 'DF'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300'
            }`}
          >
            <span className="font-mono font-bold">DF</span>
            <span>Distrito Federal (CLDF): {totalDF} eventos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
