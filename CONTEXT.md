# Sistema Contas a Pagar — Biomassa Chaparini

## Visão Geral
Sistema financeiro independente de controle de Contas a Pagar da Biomassa Chaparini.
Desenvolvido para funcionar standalone agora, com arquitetura preparada para unificação
futura com o sistema de Gestão de Frotas (biomassa-chaparini).

---

## Identidade Visual (OBRIGATÓRIO — não inventar cores ou layouts)

| Elemento | Valor |
|---|---|
| Cor primária (títulos, sidebar, header) | `#085425` |
| Cor secundária (cabeçalhos de tabela, botões principais) | `#0D692C` |
| Cor de alerta/vencido | `#c0392b` |
| Cor de atenção/próximo do vencimento | `#e67e22` |
| Cor de pago/ok | `#27ae60` |
| Fundo geral | `#f4f6f8` |
| Fundo de cards | `#ffffff` |
| Texto principal | `#2c3e50` |
| Fonte | Inter, sans-serif (Google Fonts) |
| Border-radius padrão | `8px` |
| Sombra de card | `0 2px 8px rgba(0,0,0,0.08)` |

### CSS: usar variáveis CSS no :root de base.css
```css
:root {
  --cor-primaria: #085425;
  --cor-secundaria: #0D692C;
  --cor-vencido: #c0392b;
  --cor-atencao: #e67e22;
  --cor-pago: #27ae60;
  --fundo: #f4f6f8;
  --fundo-card: #ffffff;
  --texto: #2c3e50;
  --radius: 8px;
  --sombra: 0 2px 8px rgba(0,0,0,0.08);
}
```

### Padrão de tabela
- `<thead>` com `background: var(--cor-secundaria); color: white`
- Linhas alternadas: `#f9f9f9` / `#ffffff`
- Hover nas linhas: `background: #e8f5e9`
- Botões de ação: ícones Unicode (✏️ 🗑️) ou texto curto

### Padrão de PDF
- Título em `#085425`
- Cabeçalho de tabela em `#0D692C`
- Rodapé com nome do sistema + data/hora de geração
- Orientação: retrato para listas simples, paisagem para relatórios com muitas colunas

---

## Arquitetura Técnica

### Stack
- **Front:** HTML/CSS/JS puro (sem frameworks — React, Vue, Angular são proibidos)
- **Backend:** Google Apps Script (Code.gs) vinculado a Google Sheets
- **PDF:** jsPDF (CDN: https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js)
- **AutoTable:** jsPDF-AutoTable para tabelas em PDF
- **Deploy:** GitHub Pages (arquivo estático)
- **Ícones:** Unicode + emojis (sem biblioteca de ícones externa)

### Estrutura de Arquivos (FATORADA — seguir exatamente)
```
biomassa-contas-pagar/
├── index.html              ← shell: importa scripts, monta #app, zero lógica
├── config.js               ← CONFIG global: URLs, constantes, versão
├── css/
│   ├── base.css            ← variáveis CSS, reset, tipografia, utilitários
│   ├── layout.css          ← sidebar, header, área principal, responsivo
│   └── components.css      ← cards, tabelas, modais, botões, badges, toast
├── js/
│   ├── auth.js             ← login, logout, sessionStorage, isAdmin(), isPerfil()
│   ├── api.js              ← get(action, params) e post(action, payload) centralizados
│   ├── router.js           ← init(), navigate(modulo), destroy() do módulo atual
│   ├── ui.js               ← showToast(), openModal(), closeModal(), showLoading(), renderTable()
│   └── pdf.js              ← gerarPDF(titulo, colunas, dados, orientacao)
└── modules/
    ├── dashboard.js        ← cards de vencimentos: hoje / semana / mês / atrasados
    ├── fornecedores.js     ← CRUD de fornecedores
    ├── contas.js           ← lançamento e gestão de contas a pagar
    ├── categorias.js       ← CRUD de categorias de despesa
    ├── relatorio.js        ← relatórios filtráveis + PDF
    └── usuarios.js         ← gestão de usuários (só ADMIN)
```

### Regras de Arquitetura (CRÍTICAS)
1. **Nenhum módulo chama fetch diretamente** — sempre via `API.get()` ou `API.post()`
2. **Nenhum módulo duplica funções de UI** — sempre via `UI.showToast()`, `UI.openModal()`, etc.
3. **Nenhuma URL hardcoded fora do config.js**
4. **Cada módulo exporta `init()` e `destroy()`** — o router chama esses dois e nada mais
5. **CSS: zero inline style no JS** — classes CSS para estados (`.ativo`, `.vencido`, `.pago`)
6. **Sem `var`** — usar `const` e `let` sempre
7. **Sem `console.log` no código final** — usar `CONFIG.debug && console.log(...)` se necessário

---

## config.js — Estrutura Esperada
```javascript
const CONFIG = {
  versao: '1.0.0',
  sistema: 'Biomassa Chaparini — Contas a Pagar',
  API_URL: 'COLE_AQUI_URL_DO_APPS_SCRIPT',
  FROTA_API_URL: '', // reservado para integração futura com sistema de frota
  debug: false,
  perfis: {
    ADMIN: 'ADMIN',
    DIRETOR: 'DIRETOR',
    FINANCEIRO: 'FINANCEIRO'
  },
  statusConta: {
    PENDENTE: 'Pendente',
    PAGO: 'Pago',
    VENCIDO: 'Vencido',
    CANCELADO: 'Cancelado'
  }
};
```

---

## Perfis de Usuário e Permissões

| Ação | ADMIN | DIRETOR | FINANCEIRO |
|---|---|---|---|
| Ver dashboard | ✅ | ✅ | ✅ |
| Lançar conta | ✅ | ❌ | ✅ |
| Editar conta própria | ✅ | ❌ | ✅ |
| Excluir conta | ✅ | ❌ | ❌ |
| Marcar como pago | ✅ | ❌ | ✅ |
| CRUD Fornecedores | ✅ | ❌ | ✅ |
| CRUD Categorias | ✅ | ❌ | ❌ |
| Ver Relatório | ✅ | ✅ | ✅ |
| Gestão de Usuários | ✅ | ❌ | ❌ |

---

## Módulos — Especificação

### Dashboard
- Cards com contadores: **Vencidos** (vermelho) / **Vencem Hoje** (laranja) / **Vencem essa Semana** (amarelo) / **Pagas esse Mês** (verde)
- Tabela das próximas 10 contas a vencer
- Tabela das últimas 5 contas pagas
- Clique no card navega para Contas com filtro pré-aplicado

### Fornecedores
- Campos: ID, Nome*, Tipo (PF/PJ)*, CPF/CNPJ, Telefone, Email, Categoria Padrão, Observação, Ativo
- Listar com busca por nome/CNPJ
- Editar inline ou modal
- Desativar (não excluir fisicamente) — só ADMIN

### Contas a Pagar
- Campos: ID, Fornecedor*, Categoria*, Descrição*, Valor*, Vencimento*, Competência (mês/ano), Status (calculado), Data Pagamento, Forma Pagamento, Nº Documento, Observação, Usuário, Data Registro
- Status calculado automaticamente: se Data Pagamento preenchida → Pago; se Vencimento < hoje e não pago → Vencido; senão → Pendente
- Filtros: Período / Fornecedor / Categoria / Status
- Ação "Registrar Pagamento" abre modal com data + forma de pagamento
- PDF da lista filtrada

### Categorias
- Campos: ID, Nome*, Tipo (Operacional/Administrativo/Frota/RH/Outro)*, flag `frota` (boolean — para integração futura), Observação, Ativo
- A flag `frota: true` marca categorias que serão cruzadas com o sistema de frota no futuro

### Relatório
- Matriz: Categoria × Mês (valores totais pagos)
- Filtros: período, fornecedor, categoria, status
- Totalizadores por coluna e linha
- PDF paisagem
- Exportar CSV (botão simples)

### Usuários
- Campos: Nome, Login, Senha (hash simples), Perfil, Ativo
- Só ADMIN acessa
- Mesmo padrão do sistema de frota para facilitar SSO futuro

---

## Google Sheets — Abas Esperadas
```
USUARIOS        → ID, NOME, LOGIN, SENHA, PERFIL, ATIVO
FORNECEDORES    → ID, NOME, TIPO, DOCUMENTO, TELEFONE, EMAIL, CATEGORIA_PADRAO, OBSERVACAO, ATIVO
CATEGORIAS      → ID, NOME, TIPO, FROTA, OBSERVACAO, ATIVO
CONTAS          → ID, FORNECEDOR, CATEGORIA, DESCRICAO, VALOR, VENCIMENTO, COMPETENCIA,
                   STATUS, DATA_PAGAMENTO, FORMA_PAGAMENTO, NUM_DOCUMENTO,
                   OBSERVACAO, USUARIO, DATA_REGISTRO
```

---

## Integração Futura com Sistema de Frota

### O que está preparado desde agora:
1. `CONFIG.FROTA_API_URL` — campo reservado para apontar para o Apps Script da frota
2. Categorias com flag `frota: true` — serão cruzadas com despesas de manutenção/combustível
3. Perfis de usuário com os mesmos nomes (ADMIN/DIRETOR) — login unificado via USUARIOS compartilhado
4. `api.js` aceita URL customizada por chamada — módulos de integração poderão chamar a API da frota

### O que NÃO fazer agora (evitar acoplamento prematuro):
- Não criar dependência de código da frota
- Não compartilhar Sheets ainda (cada sistema tem sua planilha)
- Não implementar SSO agora — só preparar a estrutura

---

## Padrão de Commit
```
feat: adiciona módulo de Fornecedores
fix: corrige cálculo de status Vencido
style: ajusta cores do Dashboard
refactor: centraliza chamadas de API em api.js
```

---

## Observações Finais
- Sempre testar no navegador antes de subir
- Nunca editar arquivos gerados — editar a fonte e regenerar
- Manter este CONTEXT.md atualizado a cada onda de desenvolvimento
- A fonte de verdade é sempre o último arquivo entregue no chat, não este documento
