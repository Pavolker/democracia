import { AlertaCidadao, Evento } from '../types';
import { normalizar } from './texto';

const STORAGE_KEYS = {
  FAVORITOS: 'legis_participa_favoritos',
  HISTORICO_VISUALIZADOS: 'legis_participa_visualizados',
  HISTORICO_BUSCAS: 'legis_participa_buscas',
  ALERTAS: 'legis_participa_alertas',
  CACHE_EVENTOS: 'legis_participa_cache_eventos',
  CACHE_VERSAO: 'legis_participa_cache_versao',
  ULTIMA_ATUALIZACAO: 'legis_participa_ultima_atualizacao',
  TEMA: 'legis_participa_tema',
  AUTO_UPDATE: 'legis_participa_auto_update'
} as const;

/**
 * Versão do formato do cache.
 * Bump para v3 descarta caches antigos garantindo 100% de dados oficiais.
 */
const CACHE_VERSAO_ATUAL = 3;

const MAX_VISUALIZADOS = 30;
const MAX_BUSCAS = 15;

function lerJSON<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravarJSON(chave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (erro) {
    console.warn(`Não foi possível gravar "${chave}" (cota do localStorage?):`, erro);
    return false;
  }
}

export const storage = {
  // ---------------------------------------------------------------- Favoritos
  getFavoritos(): string[] {
    const lista = lerJSON<string[]>(STORAGE_KEYS.FAVORITOS, []);
    return Array.isArray(lista) ? lista : [];
  },

  toggleFavorito(id: string): boolean {
    const favoritos = this.getFavoritos();
    const indice = favoritos.indexOf(id);
    const adicionado = indice === -1;
    if (adicionado) {
      favoritos.unshift(id);
    } else {
      favoritos.splice(indice, 1);
    }
    gravarJSON(STORAGE_KEYS.FAVORITOS, favoritos);
    return adicionado;
  },

  // ------------------------------------------------- Visualizados recentemente
  getVisualizados(): Evento[] {
    const lista = lerJSON<Evento[]>(STORAGE_KEYS.HISTORICO_VISUALIZADOS, []);
    return Array.isArray(lista) ? lista : [];
  },

  addVisualizado(evento: Evento): void {
    const lista = this.getVisualizados().filter((e) => e.id !== evento.id);
    lista.unshift(evento);
    gravarJSON(STORAGE_KEYS.HISTORICO_VISUALIZADOS, lista.slice(0, MAX_VISUALIZADOS));
  },

  clearVisualizados(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORICO_VISUALIZADOS);
    } catch {
      /* ignora */
    }
  },

  limiteVisualizados: MAX_VISUALIZADOS,

  // ------------------------------------------------------ Histórico de buscas
  getBuscas(): string[] {
    const lista = lerJSON<string[]>(STORAGE_KEYS.HISTORICO_BUSCAS, []);
    return Array.isArray(lista) ? lista : [];
  },

  /**
   * Registra um termo de busca.
   *
   * Antes cada mudança em `filtros.busca` era gravada, então digitar
   * "audiencia" devagar gerava ["audiencia","audienci","audienc","audien",...]
   * e consumia o histórico inteiro. Agora termos que são prefixo de um termo
   * já conhecido (ou que o contêm) são substituídos pelo mais completo, e
   * duplicatas normalizadas são descartadas.
   */
  addBusca(termo: string): void {
    const limpo = (termo || '').trim();
    if (limpo.length < 3) return;

    const chaveNova = normalizar(limpo);
    const existentes = this.getBuscas();
    const filtrados = existentes.filter((b) => {
      const chave = normalizar(b);
      if (chave === chaveNova) return false;
      // Descarta prefixos parciais do termo novo e vice-versa.
      if (chaveNova.startsWith(chave) || chave.startsWith(chaveNova)) return false;
      return true;
    });

    const atualizados = [limpo, ...filtrados].slice(0, MAX_BUSCAS);
    gravarJSON(STORAGE_KEYS.HISTORICO_BUSCAS, atualizados);
  },

  removeBusca(termo: string): void {
    const chave = normalizar(termo);
    gravarJSON(
      STORAGE_KEYS.HISTORICO_BUSCAS,
      this.getBuscas().filter((b) => normalizar(b) !== chave)
    );
  },

  clearBuscas(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORICO_BUSCAS);
    } catch {
      /* ignora */
    }
  },

  // ------------------------------------------------------------------ Alertas
  /**
   * Alertas salvos.
   * A versão anterior criava e persistia DOIS alertas fictícios
   * ("Reforma Tributária", "Educação") que o usuário nunca pediu, inflando o
   * badge do cabeçalho. Agora a lista começa vazia, de verdade.
   */
  getAlertas(): AlertaCidadao[] {
    const lista = lerJSON<AlertaCidadao[]>(STORAGE_KEYS.ALERTAS, []);
    return Array.isArray(lista) ? lista : [];
  },

  saveAlertas(alertas: AlertaCidadao[]): void {
    gravarJSON(STORAGE_KEYS.ALERTAS, alertas);
  },

  addAlerta(
    alerta: Omit<AlertaCidadao, 'id' | 'data_criacao'>
  ): AlertaCidadao | { erro: string } {
    const alertas = this.getAlertas();
    const tema = alerta.tema.trim();
    const duplicado = alertas.some(
      (a) =>
        normalizar(a.tema) === normalizar(tema) &&
        a.uf === alerta.uf &&
        (a.mecanismo || 'todos') === (alerta.mecanismo || 'todos')
    );
    if (duplicado) {
      return { erro: 'Já existe um filtro salvo com este tema, esta UF e este mecanismo.' };
    }

    const novo: AlertaCidadao = {
      ...alerta,
      tema,
      id: `alerta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      data_criacao: new Date().toISOString()
    };
    alertas.unshift(novo);
    this.saveAlertas(alertas);
    return novo;
  },

  removeAlerta(id: string): void {
    this.saveAlertas(this.getAlertas().filter((a) => a.id !== id));
  },

  toggleAlertaAtivo(id: string): boolean {
    const alertas = this.getAlertas();
    const alvo = alertas.find((a) => a.id === id);
    if (!alvo) return false;
    alvo.ativo = !alvo.ativo;
    this.saveAlertas(alertas);
    return alvo.ativo;
  },

  // ------------------------------------------------------------ Cache da agenda
  /**
   * Cache de eventos, descartado quando o formato muda.
   * Um cache de versão anterior (sem `origem`) é ignorado de propósito:
   * ver comentário em CACHE_VERSAO_ATUAL.
   */
  getCachedEventos(): Evento[] | null {
    try {
      const versao = Number(localStorage.getItem(STORAGE_KEYS.CACHE_VERSAO) || '0');
      if (versao !== CACHE_VERSAO_ATUAL) return null;

      const lista = lerJSON<Evento[] | null>(STORAGE_KEYS.CACHE_EVENTOS, null);
      if (!Array.isArray(lista) || lista.length === 0) return null;
      // Garante que todo registro em cache veio exclusivamente de fontes oficiais ao vivo
      if (lista.some((e) => e?.origem !== 'ao_vivo')) {
        return null;
      }
      return lista;
    } catch {
      return null;
    }
  },

  /** Grava o cache. Devolve false quando a cota estoura. */
  setCachedEventos(eventos: Evento[]): boolean {
    const ok = gravarJSON(STORAGE_KEYS.CACHE_EVENTOS, eventos);
    if (ok) {
      try {
        localStorage.setItem(STORAGE_KEYS.CACHE_VERSAO, String(CACHE_VERSAO_ATUAL));
        localStorage.setItem(STORAGE_KEYS.ULTIMA_ATUALIZACAO, new Date().toISOString());
      } catch {
        /* ignora */
      }
    }
    return ok;
  },

  limparCache(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.CACHE_EVENTOS);
      localStorage.removeItem(STORAGE_KEYS.CACHE_VERSAO);
      localStorage.removeItem(STORAGE_KEYS.ULTIMA_ATUALIZACAO);
    } catch {
      /* ignora */
    }
  },

  getUltimaAtualizacao(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ULTIMA_ATUALIZACAO);
    } catch {
      return null;
    }
  },

  // --------------------------------------------------------------------- Tema
  getTema(): 'dark' | 'light' | 'system' {
    const valor = lerJSON<'dark' | 'light' | 'system' | null>(STORAGE_KEYS.TEMA, null);
    return valor === 'dark' || valor === 'light' || valor === 'system' ? valor : 'system';
  },

  setTema(tema: 'dark' | 'light' | 'system'): void {
    gravarJSON(STORAGE_KEYS.TEMA, tema);
  },

  // --------------------------------------------------- Atualização automática
  getAutoUpdate(): boolean {
    return lerJSON<boolean>(STORAGE_KEYS.AUTO_UPDATE, true);
  },

  setAutoUpdate(ativo: boolean): void {
    gravarJSON(STORAGE_KEYS.AUTO_UPDATE, ativo);
  }
};

export { STORAGE_KEYS, CACHE_VERSAO_ATUAL };
