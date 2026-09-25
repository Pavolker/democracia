import { AlertaCidadao, Evento } from '../types';

const STORAGE_KEYS = {
  FAVORITOS: 'legis_participa_favoritos',
  HISTORICO_VISUALIZADOS: 'legis_participa_visualizados',
  HISTORICO_BUSCAS: 'legis_participa_buscas',
  ALERTAS: 'legis_participa_alertas',
  CACHE_EVENTOS: 'legis_participa_cache_eventos',
  ULTIMA_ATUALIZACAO: 'legis_participa_ultima_atualizacao',
  TEMA: 'legis_participa_tema',
  AUTO_UPDATE: 'legis_participa_auto_update',
};

export const storage = {
  // Favoritos
  getFavoritos(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITOS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  toggleFavorito(id: string): boolean {
    const favs = this.getFavoritos();
    const index = favs.indexOf(id);
    let novoEstado = false;
    if (index > -1) {
      favs.splice(index, 1);
      novoEstado = false;
    } else {
      favs.unshift(id);
      novoEstado = true;
    }
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITOS, JSON.stringify(favs));
    } catch (e) {
      console.error('Erro ao salvar favorito:', e);
    }
    return novoEstado;
  },

  isFavorito(id: string): boolean {
    return this.getFavoritos().includes(id);
  },

  // Visualizados recentemente
  getVisualizados(): Evento[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORICO_VISUALIZADOS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addVisualizado(evento: Evento) {
    try {
      const list = this.getVisualizados().filter(e => e.id !== evento.id);
      list.unshift(evento);
      // Keep last 30
      const trimmed = list.slice(0, 30);
      localStorage.setItem(STORAGE_KEYS.HISTORICO_VISUALIZADOS, JSON.stringify(trimmed));
    } catch (e) {
      console.error('Erro ao salvar visualização:', e);
    }
  },

  // Histórico de Buscas
  getBuscas(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORICO_BUSCAS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  addBusca(termo: string) {
    if (!termo || termo.trim().length < 2) return;
    const clean = termo.trim();
    const buscas = this.getBuscas().filter(b => b.toLowerCase() !== clean.toLowerCase());
    buscas.unshift(clean);
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORICO_BUSCAS, JSON.stringify(buscas.slice(0, 15)));
    } catch (e) {
      console.error('Erro ao salvar busca:', e);
    }
  },

  clearBuscas() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORICO_BUSCAS);
    } catch {}
  },

  // Alertas
  getAlertas(): AlertaCidadao[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ALERTAS);
      if (data) return JSON.parse(data);
      // Default initial alert example
      const defaultAlerts: AlertaCidadao[] = [
        {
          id: 'alerta-default-1',
          tema: 'Reforma Tributária',
          uf: 'TODAS',
          mecanismo: 'audiencia_publica',
          ativo: true,
          data_criacao: new Date().toISOString()
        },
        {
          id: 'alerta-default-2',
          tema: 'Educação',
          uf: 'TODAS',
          mecanismo: 'todos',
          ativo: true,
          data_criacao: new Date().toISOString()
        }
      ];
      this.saveAlertas(defaultAlerts);
      return defaultAlerts;
    } catch {
      return [];
    }
  },

  saveAlertas(alertas: AlertaCidadao[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ALERTAS, JSON.stringify(alertas));
    } catch (e) {
      console.error('Erro ao salvar alertas:', e);
    }
  },

  addAlerta(alerta: Omit<AlertaCidadao, 'id' | 'data_criacao'>): AlertaCidadao {
    const alertas = this.getAlertas();
    const novo: AlertaCidadao = {
      ...alerta,
      id: 'alerta-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      data_criacao: new Date().toISOString()
    };
    alertas.unshift(novo);
    this.saveAlertas(alertas);
    return novo;
  },

  removeAlerta(id: string) {
    const alertas = this.getAlertas().filter(a => a.id !== id);
    this.saveAlertas(alertas);
  },

  toggleAlertaAtivo(id: string): boolean {
    const alertas = this.getAlertas();
    const target = alertas.find(a => a.id === id);
    if (target) {
      target.ativo = !target.ativo;
      this.saveAlertas(alertas);
      return target.ativo;
    }
    return false;
  },

  // Cache de Eventos
  getCachedEventos(): Evento[] | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CACHE_EVENTOS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCachedEventos(eventos: Evento[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.CACHE_EVENTOS, JSON.stringify(eventos));
      localStorage.setItem(STORAGE_KEYS.ULTIMA_ATUALIZACAO, new Date().toISOString());
    } catch (e) {
      console.warn('Não foi possível armazenar cache completo no localStorage (tamanho):', e);
    }
  },

  getUltimaAtualizacao(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ULTIMA_ATUALIZACAO);
    } catch {
      return null;
    }
  },

  // Tema
  getTema(): 'dark' | 'light' | 'system' {
    try {
      return (localStorage.getItem(STORAGE_KEYS.TEMA) as any) || 'system';
    } catch {
      return 'system';
    }
  },

  setTema(tema: 'dark' | 'light' | 'system') {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMA, tema);
    } catch {}
  },

  // Auto update
  getAutoUpdate(): boolean {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.AUTO_UPDATE);
      return val !== null ? JSON.parse(val) : true;
    } catch {
      return true;
    }
  },

  setAutoUpdate(enabled: boolean) {
    try {
      localStorage.setItem(STORAGE_KEYS.AUTO_UPDATE, JSON.stringify(enabled));
    } catch {}
  }
};
