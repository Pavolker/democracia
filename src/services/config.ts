import { FonteConfig, MecanismoParticipacao } from '../types';

export const MECANISMOS_INFO: Record<MecanismoParticipacao, {
  nome: string;
  descricao: string;
  corHex: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  emoji: string;
}> = {
  audiencia_publica: {
    nome: 'Audiência Pública',
    descricao: 'Debate aberto e transparente sobre proposições de lei e temas de relevância coletiva',
    corHex: '#ef4444',
    badgeBg: 'bg-red-500/10 text-red-600 dark:text-red-400',
    badgeText: 'text-red-700 dark:text-red-300',
    badgeBorder: 'border-red-500/30',
    dotColor: 'bg-red-500',
    emoji: '🔴'
  },
  consulta_publica: {
    nome: 'Consulta Pública',
    descricao: 'Recebimento formal de contribuições e pareceres escritos de cidadãos e entidades',
    corHex: '#f97316',
    badgeBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    badgeText: 'text-orange-700 dark:text-orange-300',
    badgeBorder: 'border-orange-500/30',
    dotColor: 'bg-orange-500',
    emoji: '🟠'
  },
  sugestao_legislativa: {
    nome: 'Sugestão Legislativa',
    descricao: 'Iniciativas populares e propostas de lei formuladas por cidadãos em coleta de apoios',
    corHex: '#eab308',
    badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    badgeText: 'text-amber-800 dark:text-amber-300',
    badgeBorder: 'border-amber-500/30',
    dotColor: 'bg-amber-500',
    emoji: '🟡'
  },
  dialogo_social_plenaria: {
    nome: 'Diálogo Social / Plenária',
    descricao: 'Reuniões ampliadas com movimentos sociais, conselhos e entidades da sociedade civil',
    corHex: '#10b981',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    dotColor: 'bg-emerald-500',
    emoji: '🟢'
  },
  ordem_dia_tribuna_livre: {
    nome: 'Ordem do Dia / Tribuna Livre',
    descricao: 'Espaço regimental com fala facultada a representantes da comunidade no plenário',
    corHex: '#3b82f6',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeBorder: 'border-blue-500/30',
    dotColor: 'bg-blue-500',
    emoji: '🔵'
  }
};

export const UFS_BRASIL: Array<{ sigla: string; nome: string; regiao: string }> = [
  { sigla: 'AC', nome: 'Acre', regiao: 'Norte' },
  { sigla: 'AL', nome: 'Alagoas', regiao: 'Nordeste' },
  { sigla: 'AP', nome: 'Amapá', regiao: 'Norte' },
  { sigla: 'AM', nome: 'Amazonas', regiao: 'Norte' },
  { sigla: 'BA', nome: 'Bahia', regiao: 'Nordeste' },
  { sigla: 'CE', nome: 'Ceará', regiao: 'Nordeste' },
  { sigla: 'DF', nome: 'Distrito Federal', regiao: 'Centro-Oeste' },
  { sigla: 'ES', nome: 'Espírito Santo', regiao: 'Sudeste' },
  { sigla: 'GO', nome: 'Goiás', regiao: 'Centro-Oeste' },
  { sigla: 'MA', nome: 'Maranhão', regiao: 'Nordeste' },
  { sigla: 'MT', nome: 'Mato Grosso', regiao: 'Centro-Oeste' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul', regiao: 'Centro-Oeste' },
  { sigla: 'MG', nome: 'Minas Gerais', regiao: 'Sudeste' },
  { sigla: 'PA', nome: 'Pará', regiao: 'Norte' },
  { sigla: 'PB', nome: 'Paraíba', regiao: 'Nordeste' },
  { sigla: 'PR', nome: 'Paraná', regiao: 'Sul' },
  { sigla: 'PE', nome: 'Pernambuco', regiao: 'Nordeste' },
  { sigla: 'PI', nome: 'Piauí', regiao: 'Nordeste' },
  { sigla: 'RJ', nome: 'Rio de Janeiro', regiao: 'Sudeste' },
  { sigla: 'RN', nome: 'Rio Grande do Norte', regiao: 'Nordeste' },
  { sigla: 'RS', nome: 'Rio Grande do Sul', regiao: 'Sul' },
  { sigla: 'RO', nome: 'Rondônia', regiao: 'Norte' },
  { sigla: 'RR', nome: 'Roraima', regiao: 'Norte' },
  { sigla: 'SC', nome: 'Santa Catarina', regiao: 'Sul' },
  { sigla: 'SP', nome: 'São Paulo', regiao: 'Sudeste' },
  { sigla: 'SE', nome: 'Sergipe', regiao: 'Nordeste' },
  { sigla: 'TO', nome: 'Tocantins', regiao: 'Norte' }
];

export const FONTES_OFICIAIS: FonteConfig[] = [
  // Federais
  {
    uf: 'FEDERAL',
    sigla: 'Câmara',
    nome: 'Câmara dos Deputados (Dados Abertos)',
    urlBase: 'https://www.camara.leg.br',
    urlAgenda: 'https://dadosabertos.camara.leg.br/api/v2/eventos',
    tipo: 'api',
    ativo: true,
    descricao: 'API REST oficial da Câmara dos Deputados em tempo real'
  },
  {
    uf: 'FEDERAL',
    sigla: 'Senado',
    nome: 'Senado Federal (e-Cidadania)',
    urlBase: 'https://www.senado.leg.br',
    urlAgenda: 'https://www12.senado.leg.br/ecidadania/principalaudienciainterativa',
    tipo: 'api',
    ativo: true,
    descricao: 'Portal e-Cidadania e Dados Abertos do Senado Federal'
  },
  // 27 Assembleias Estaduais
  { uf: 'AC', sigla: 'ALEAC', nome: 'Assembleia Legislativa do Acre', urlBase: 'https://www.al.ac.leg.br', urlAgenda: 'https://www.al.ac.leg.br/comissoes', tipo: 'html', ativo: true },
  { uf: 'AL', sigla: 'ALEAL', nome: 'Assembleia Legislativa de Alagoas', urlBase: 'https://www.al.al.leg.br', urlAgenda: 'https://www.al.al.leg.br/comissoes', tipo: 'html', ativo: true },
  { uf: 'AM', sigla: 'ALEAM', nome: 'Assembleia Legislativa do Amazonas', urlBase: 'https://www.aleam.gov.br', urlAgenda: 'https://www.aleam.gov.br/comissoes', tipo: 'html', ativo: true },
  { uf: 'AP', sigla: 'ALEAP', nome: 'Assembleia Legislativa do Amapá', urlBase: 'https://www.al.ap.leg.br', urlAgenda: 'https://www.al.ap.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'BA', sigla: 'ALBA', nome: 'Assembleia Legislativa da Bahia', urlBase: 'https://www.al.ba.gov.br', urlAgenda: 'https://www.al.ba.gov.br/comissoes/agenda', tipo: 'html', ativo: true },
  { uf: 'CE', sigla: 'ALECE', nome: 'Assembleia Legislativa do Ceará', urlBase: 'https://www.al.ce.gov.br', urlAgenda: 'https://www.al.ce.gov.br/comissoes', tipo: 'html', ativo: true },
  { uf: 'DF', sigla: 'CLDF', nome: 'Câmara Legislativa do Distrito Federal', urlBase: 'https://www.cl.df.gov.br', urlAgenda: 'https://www.cl.df.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'ES', sigla: 'ALES', nome: 'Assembleia Legislativa do Espírito Santo', urlBase: 'https://www.al.es.gov.br', urlAgenda: 'https://www.al.es.gov.br/comissoes', tipo: 'html', ativo: true },
  { uf: 'GO', sigla: 'ALEGO', nome: 'Assembleia Legislativa de Goiás', urlBase: 'https://portal.al.go.leg.br', urlAgenda: 'https://portal.al.go.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'MA', sigla: 'ALEMA', nome: 'Assembleia Legislativa do Maranhão', urlBase: 'https://www.al.ma.gov.br', urlAgenda: 'https://www.al.ma.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'MG', sigla: 'ALMG', nome: 'Assembleia Legislativa de Minas Gerais', urlBase: 'https://www.almg.gov.br', urlAgenda: 'https://www.almg.gov.br/atividade-parlamentar/agenda', tipo: 'html', ativo: true },
  { uf: 'MS', sigla: 'ALEMS', nome: 'Assembleia Legislativa de Mato Grosso do Sul', urlBase: 'https://www.al.ms.gov.br', urlAgenda: 'https://www.al.ms.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'MT', sigla: 'ALMT', nome: 'Assembleia Legislativa de Mato Grosso', urlBase: 'https://www.al.mt.gov.br', urlAgenda: 'https://www.al.mt.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'PA', sigla: 'ALEPA', nome: 'Assembleia Legislativa do Pará', urlBase: 'https://www.alepa.pa.gov.br', urlAgenda: 'https://www.alepa.pa.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'PB', sigla: 'ALPB', nome: 'Assembleia Legislativa da Paraíba', urlBase: 'https://www.al.pb.leg.br', urlAgenda: 'https://www.al.pb.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'PE', sigla: 'ALEPE', nome: 'Assembleia Legislativa de Pernambuco', urlBase: 'https://www.alepe.pe.gov.br', urlAgenda: 'https://www.alepe.pe.gov.br/comissoes', tipo: 'html', ativo: true },
  { uf: 'PI', sigla: 'ALEPI', nome: 'Assembleia Legislativa do Piauí', urlBase: 'https://www.al.pi.leg.br', urlAgenda: 'https://www.al.pi.leg.br/comissoes', tipo: 'html', ativo: true },
  { uf: 'PR', sigla: 'ALEP', nome: 'Assembleia Legislativa do Paraná', urlBase: 'https://www.assembleia.pr.leg.br', urlAgenda: 'https://www.assembleia.pr.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'RJ', sigla: 'ALERJ', nome: 'Assembleia Legislativa do Rio de Janeiro', urlBase: 'https://www.alerj.rj.gov.br', urlAgenda: 'https://www.alerj.rj.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'RN', sigla: 'ALRN', nome: 'Assembleia Legislativa do Rio Grande do Norte', urlBase: 'https://www.al.rn.leg.br', urlAgenda: 'https://www.al.rn.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'RO', sigla: 'ALERO', nome: 'Assembleia Legislativa de Rondônia', urlBase: 'https://www.al.ro.leg.br', urlAgenda: 'https://www.al.ro.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'RR', sigla: 'ALERR', nome: 'Assembleia Legislativa de Roraima', urlBase: 'https://al.rr.leg.br', urlAgenda: 'https://al.rr.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'RS', sigla: 'ALRS', nome: 'Assembleia Legislativa do Rio Grande do Sul', urlBase: 'https://www.al.rs.gov.br', urlAgenda: 'https://www.al.rs.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'SC', sigla: 'ALESC', nome: 'Assembleia Legislativa de Santa Catarina', urlBase: 'https://www.alesc.sc.gov.br', urlAgenda: 'https://www.alesc.sc.gov.br/agenda', tipo: 'html', ativo: true },
  { uf: 'SE', sigla: 'ALESE', nome: 'Assembleia Legislativa de Sergipe', urlBase: 'https://www.al.se.leg.br', urlAgenda: 'https://www.al.se.leg.br/agenda', tipo: 'html', ativo: true },
  { uf: 'SP', sigla: 'ALESP', nome: 'Assembleia Legislativa de São Paulo', urlBase: 'https://www.al.sp.gov.br', urlAgenda: 'https://www.al.sp.gov.br/comissoes/reunioes', tipo: 'html', ativo: true },
  { uf: 'TO', sigla: 'ALETO', nome: 'Assembleia Legislativa do Tocantins', urlBase: 'https://www.al.to.leg.br', urlAgenda: 'https://www.al.to.leg.br/agenda', tipo: 'html', ativo: true }
];
