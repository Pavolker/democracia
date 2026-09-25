# 🏛️ LegisParticipa - Calendário de Participação Cidadã

> **Agrupador nacional dos 5 mecanismos de participação cidadã do Poder Legislativo Brasileiro** (Federal e 27 Casas Legislativas Estaduais).

[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.2-646cff?logo=vite)](https://vitejs.dev)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4.0-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-57534e?logo=pwa)](https://web.dev/progressive-web-apps/)

---

## 🎯 Sobre o Projeto

O **LegisParticipa** é uma plataforma cívica de transparência ativa que monitora, consolida e disponibiliza em tempo real as oportunidades de participação popular no processo legislativo brasileiro.

O sistema integra dados oficiais da **Câmara dos Deputados**, **Senado Federal (e-Cidadania)** e de todas as **27 Assembleias Legislativas estaduais e distrital**.

---

## 📌 Os 5 Mecanismos Monitorados

| Mecanismo | Descrição |
| :--- | :--- |
| 🔴 **Audiência Pública** | Debates abertos e transparentes sobre projetos de lei e matérias de relevância coletiva. |
| 🟠 **Consulta Pública** | Recebimento formal de contribuições, pareceres e votações sobre proposições. |
| 🟡 **Sugestão Legislativa** | Iniciativas populares e propostas de lei criadas por cidadãos em fase de coleta de apoios. |
| 🟢 **Diálogo Social / Plenária** | Reuniões ampliadas com movimentos sociais, conselhos e sociedade civil. |
| 🔵 **Ordem do Dia / Tribuna Livre** | Espaço regimental com fala facultada a representantes da comunidade em plenário. |

---

## ✨ Principais Recursos

- 🗺️ **Mapa Interativo do Brasil**: Visualização geográfica da distribuição de eventos por estado.
- 📅 **Heatmap de Atividades**: Calendário térmico (estilo GitHub) indicando densidade de agendas.
- 🔍 **Filtros Avançados**: Busca textual instantânea, filtros por UF, mecanismo, período e casa legislativa.
- 🔔 **Alertas Cidadãos**: Criação de alertas customizados por palavras-chave e estados de interesse.
- 📆 **Integração com Calendários**:
  - Exportação direta para **Google Calendar**.
  - Download de arquivos `.ics` compatíveis com Outlook, Apple Calendar e Thunderbird.
  - Exportação dos dados consolidados em **CSV** e **JSON**.
- 🛠️ **Painel de Diagnóstico de Fontes**: Monitoramento em tempo real do status de conectividade das 29 fontes oficiais.
- 🌓 **Tema Dinâmico**: Suporte a Modo Escuro, Claro e sincronização com o sistema.
- 📱 **Progressive Web App (PWA)**: Funcionamento offline e suporte a instalação no celular e desktop.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- npm ou yarn/pnpm

### Passo a Passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Pavolker/democracia.git
   cd democracia
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```
   Acesse a aplicação em: `http://localhost:3000`

4. **Gerar build de produção:**
   ```bash
   npm run build
   ```

---

## 🏗️ Estrutura do Código

```text
src/
├── components/          # Componentes visuais (Mapa, Heatmap, Cards, Filtros, Modais)
├── services/            # Serviços (Scrapers, Persistência Local, Exportação de Calendários, Configurações)
├── types/               # Definições de tipos TypeScript
├── App.tsx              # Componente principal e orquestrador de estado
├── index.css            # Estilos globais e tokens Tailwind CSS v4
└── main.tsx             # Ponto de entrada React 19
```

---

## ⚖️ Licença

Distribuído sob licença aberta com fins cívicos e de transparência pública.
