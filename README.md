# Biomassa Chaparini — Sistema de Contas a Pagar

Sistema web standalone para gerenciamento de contas a pagar, desenvolvido com HTML/CSS/JS puro e Google Apps Script como backend. Projetado para ser hospedado no GitHub Pages sem custo de infraestrutura.

---

## Sumário

1. [Descrição do sistema](#1-descrição-do-sistema)
2. [Estrutura de arquivos](#2-estrutura-de-arquivos)
3. [Configuração inicial](#3-configuração-inicial)
4. [Deploy no GitHub Pages](#4-deploy-no-github-pages)
5. [Configurando o Google Apps Script](#5-configurando-o-google-apps-script)
6. [Perfis de usuário e permissões](#6-perfis-de-usuário-e-permissões)
7. [Como adicionar um novo módulo](#7-como-adicionar-um-novo-módulo)
8. [Roadmap de integração com o Sistema de Frota](#8-roadmap-de-integração-com-o-sistema-de-frota)
9. [Convenções de código](#9-convenções-de-código)

---

## 1. Descrição do sistema

O sistema permite que a equipe financeira da Biomassa Chaparini:

- Cadastre e gerencie **fornecedores** e **categorias** de despesa
- Lance **contas a pagar** com vencimento, valor, competência e documentos
- **Registre pagamentos** com forma e data de quitação
- Visualize um **dashboard** com indicadores de contas vencidas, a vencer e pagas no mês
- Gere **relatórios** por período com gráfico de barras por categoria e exportação em PDF e CSV

### Por que sem framework?

A escolha de HTML/CSS/JS puro foi deliberada. Frameworks como React e Vue exigem um processo de build (Node.js, Webpack, Vite), o que torna o deploy mais complexo e o código-fonte menos legível para quem está aprendendo. Com JS puro:

- O código-fonte **é** o que roda no navegador — sem transpilação
- O deploy é simplesmente subir arquivos estáticos para o GitHub Pages
- Qualquer editor de texto serve para fazer alterações
- É possível inspecionar e depurar diretamente no DevTools do navegador

### Por que Google Sheets como banco de dados?

Para volumes pequenos e médios (até algumas centenas de registros mensais), o Google Sheets é uma solução pragmática:

- Não requer servidor, banco de dados ou VPS
- Custo zero
- A equipe pode visualizar e até corrigir dados diretamente na planilha em emergências
- O Google Apps Script é JavaScript com acesso direto à API do Sheets

---

## 2. Estrutura de arquivos

```
biomassa-contas-pagar/
│
├── index.html                 # Única página HTML do sistema (SPA)
├── config.js                  # Configurações globais (URL da API, perfis, versão)
├── Code.gs                    # Backend Google Apps Script (não vai para o GitHub Pages)
│
├── css/
│   ├── base.css               # Variáveis CSS, reset, utilitários, badges de status
│   ├── layout.css             # Sidebar, header, grid responsivo, tela de login
│   └── components.css         # Cards, tabelas, modais, toasts, formulários, gráfico
│
├── js/
│   ├── api.js                 # Camada de comunicação HTTP (ÚNICO ponto de fetch)
│   ├── auth.js                # Login, logout, sessão, controle de menu por perfil
│   ├── ui.js                  # Componentes reutilizáveis: toast, modal, tabela, loading
│   ├── pdf.js                 # Geração de PDFs com jsPDF + AutoTable
│   └── router.js              # Navegação entre módulos com transição animada
│
└── modules/
    ├── dashboard.js           # KPIs, próximas a vencer, últimas pagas
    ├── fornecedores.js        # CRUD de fornecedores (PF e PJ)
    ├── categorias.js          # CRUD de categorias com tipo e flag de frota
    ├── contas.js              # Módulo principal: lançamento e pagamento de contas
    ├── relatorio.js           # Relatório por período com gráfico e exportações
    └── usuarios.js            # CRUD de usuários (exclusivo ADMIN)
```

### Explicação detalhada por arquivo

#### `index.html` — A casca do sistema

Contém apenas a estrutura estática: overlay de inicialização, tela de login, sidebar, header e a div `#main-content` que os módulos preenchem dinamicamente. Não há lógica aqui — apenas HTML semântico e referências aos scripts na ordem correta:

```
config.js → api.js → ui.js → auth.js → pdf.js → router.js → módulos
```

Essa ordem importa porque cada script pode depender do anterior. `auth.js`, por exemplo, usa `API.post()` e `UI.showToast()`, então `api.js` e `ui.js` precisam ter sido carregados antes.

#### `config.js` — Central de configuração

Expõe o objeto global `CONFIG` com todas as constantes do sistema. A variável mais importante é `CONFIG.API_URL`: quando está vazia, o sistema entra em **modo demo** usando credenciais mockadas sem nenhuma chamada real à API. Isso permite desenvolver e testar o frontend sem precisar do backend configurado.

```javascript
const CONFIG = {
  API_URL: '',  // Vazio = modo demo. Preencher com a URL do Apps Script em produção.
  // ...
};
```

#### `js/api.js` — A única porta de saída

**Regra de ouro do projeto: nenhum módulo faz `fetch()` diretamente.** Toda comunicação HTTP passa por `API.get()` ou `API.post()`. Por quê?

- Se a URL da API mudar, muda em um único lugar
- O loading automático (contador interno) funciona para todas as chamadas sem código extra nos módulos
- O tratamento de erros é consistente — todos os erros da API chegam ao módulo como exceções JavaScript normais
- Em modo demo, é trivial interceptar as chamadas e retornar dados mockados

#### `js/auth.js` — Sessão e identidade

Gerencia o ciclo de vida da sessão usando `sessionStorage` (não `localStorage`). A escolha do `sessionStorage` é intencional: a sessão expira quando o usuário fecha a aba, o que é mais seguro para um sistema financeiro.

Após o login, `auth.js` armazena o objeto de sessão e chama `ROUTER.init()`, que inicializa o sistema e navega automaticamente para o dashboard.

Em **modo demo** (sem `CONFIG.API_URL`), as credenciais são validadas contra um array local sem nenhuma requisição HTTP.

#### `js/ui.js` — Componentes compartilhados

Fornece funções que qualquer módulo pode usar sem reescrever:

- `UI.showToast(mensagem, tipo)` — notificação temporária no canto da tela
- `UI.openModal(id)` / `UI.closeModal(id)` — controle de modais
- `UI.confirm(mensagem)` — caixa de confirmação customizada que retorna uma Promise
- `UI.renderTable(tbodyId, dados, colunas)` — renderiza tabelas declarativamente
- `UI.formatMoeda(valor)` / `UI.formatData(data)` — formatação consistente

#### `js/router.js` — O roteador

Responsável por navegar entre módulos. Quando o usuário clica em um item do menu:

1. Chama `modulo.destroy()` no módulo anterior para limpar event listeners
2. Limpa o `#main-content`
3. Atualiza o item de menu ativo e o título do header
4. Chama `modulo.init()` no novo módulo

A transição tem duas fases: fade out (150ms) → limpa → fade in (200ms). Um guard `_navegando` previne cliques duplos durante a transição.

#### `js/pdf.js` — Exportação de PDFs

Encapsula o jsPDF + AutoTable em uma única função `PDF.gerar(titulo, colunas, dados, orientacao, opcoesExtra)`. Os módulos não precisam saber nada sobre jsPDF — apenas chamam essa função com os dados e recebem o download automático.

#### `modules/*.js` — Os módulos de funcionalidade

Cada módulo segue o mesmo contrato: exporta apenas `{ init, destroy }`. O `init()` renderiza o HTML do módulo em `#main-content` e registra os event listeners. O `destroy()` remove os listeners e limpa o estado interno para evitar vazamentos de memória.

```javascript
const MEUMODULO = (() => {
  // estado privado...

  const init = async () => {
    document.getElementById('main-content').innerHTML = `...HTML...`;
    _registrarEventos();
    await _carregarDados();
  };

  const destroy = () => {
    // remove listeners, cancela timers, etc.
  };

  return { init, destroy };
})();
```

#### `Code.gs` — O backend

Roda no Google Apps Script, não no GitHub Pages. Expõe duas funções HTTP: `doGet(e)` para leituras e `doPost(e)` para escritas. Cada ação é um `case` nos switches dessas funções. O Apps Script usa o runtime V8, então sintaxe moderna (arrow functions, template literals, `const`/`let`) funciona normalmente.

---

## 3. Configuração inicial

### Passo 1 — Clonar ou baixar o repositório

```bash
git clone https://github.com/seu-usuario/biomassa-contas-pagar.git
cd biomassa-contas-pagar
```

### Passo 2 — Testar em modo demo

Abra `index.html` diretamente no navegador (ou use uma extensão como Live Server no VS Code). Como `CONFIG.API_URL` está vazio, o sistema funciona sem backend com as seguintes credenciais:

| Usuário       | Senha      | Perfil     |
|---------------|------------|------------|
| `admin`       | `admin123` | ADMIN      |
| `cdiretor`    | `dir123`   | DIRETOR    |
| `afinanceiro` | `fin123`   | FINANCEIRO |

### Passo 3 — Conectar ao backend real

Após configurar o Apps Script (ver seção 5), cole a URL de deployment em `config.js`:

```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/SEU_ID_AQUI/exec',
  // ...
};
```

---

## 4. Deploy no GitHub Pages

O GitHub Pages serve arquivos estáticos diretamente de um repositório — é exatamente o que precisamos.

### Passo a passo

1. Crie um repositório no GitHub (pode ser privado ou público)
2. Faça push de todos os arquivos **exceto `Code.gs`** (que fica no Apps Script, não no servidor web):

```bash
git add .
git reset HEAD Code.gs   # não sobe o backend junto
git commit -m "deploy inicial"
git push origin main
```

3. No GitHub, vá em **Settings → Pages**
4. Em **Source**, selecione **Deploy from a branch**
5. Selecione a branch `main` e a pasta `/ (root)`
6. Clique em **Save**

Após alguns minutos, o sistema estará disponível em:
```
https://seu-usuario.github.io/biomassa-contas-pagar/
```

### Sobre CORS

Quando o frontend no GitHub Pages faz requisições para o Apps Script, o navegador aplica a política de CORS. O Google gerencia isso automaticamente quando o web app é publicado com **Acesso: Qualquer pessoa** — não é necessário configurar headers manualmente.

---

## 5. Configurando o Google Apps Script

### Passo 1 — Criar a planilha

1. Acesse [sheets.google.com](https://sheets.google.com) e crie uma nova planilha
2. Dê um nome descritivo, ex: `Biomassa Chaparini — Base de Dados`
3. Copie o ID da planilha da URL (o trecho entre `/d/` e `/edit`):
   ```
   https://docs.google.com/spreadsheets/d/ESTE_É_O_ID/edit
   ```

### Passo 2 — Criar o projeto Apps Script

**Opção A — Vinculado à planilha (recomendado):**
Na planilha, vá em **Extensões → Apps Script**. O script terá acesso automático à planilha ativa, sem precisar do `PLANILHA_ID`.

**Opção B — Projeto independente:**
Acesse [script.google.com](https://script.google.com), crie um novo projeto e preencha a constante:
```javascript
const PLANILHA_ID = 'SEU_ID_AQUI';
```

### Passo 3 — Colar o código

Cole o conteúdo completo do arquivo `Code.gs` no editor do Apps Script. Salve com **Ctrl+S**.

### Passo 4 — Criar as abas

No editor do Apps Script, selecione a função `setupPlanilha` no menu dropdown e clique em **▶ Executar**. Isso vai:

- Criar as 4 abas: `USUARIOS`, `FORNECEDORES`, `CATEGORIAS`, `CONTAS`
- Formatar os cabeçalhos (verde `#0D692C`, texto branco, negrito)
- Congelar a linha de cabeçalho
- Criar o usuário administrador inicial:
  - Login: `admin`
  - Senha: `admin123` (armazenada como hash SHA-256)

**Importante:** Troque a senha do admin após o primeiro acesso em produção.

### Passo 5 — Publicar como Web App

1. Clique em **Implantar → Nova implantação**
2. Clique no ícone de engrenagem e selecione **Aplicativo da Web**
3. Configure:
   - **Descrição:** `v1 — Contas a Pagar`
   - **Executar como:** `Eu mesmo`
   - **Quem tem acesso:** `Qualquer pessoa`
4. Clique em **Implantar** e autorize as permissões solicitadas
5. Copie a **URL do aplicativo da web** gerada

### Passo 6 — Conectar o frontend

Cole a URL em `config.js`:

```javascript
API_URL: 'https://script.google.com/macros/s/SEU_ID/exec',
```

### Atenção: Re-implantação após mudanças

Toda vez que modificar o `Code.gs`, é necessário criar uma **nova implantação** (não editar a existente) para que as mudanças entrem em vigor. O Apps Script mantém versões imutáveis — cada implantação aponta para uma versão específica do código.

---

## 6. Perfis de usuário e permissões

O sistema tem três perfis com permissões distintas:

### ADMIN
- Acesso total ao sistema
- Cria, edita e exclui qualquer conta
- Gerencia fornecedores, categorias e usuários
- Vê todos os módulos do menu, incluindo Categorias e Usuários

### DIRETOR
- Acesso somente leitura
- Visualiza dashboard, contas, fornecedores e relatórios
- Não pode criar, editar ou excluir nenhum registro
- Não vê Categorias nem Usuários no menu

### FINANCEIRO
- Cria novas contas e registra pagamentos
- Edita apenas as contas que ele mesmo criou
- Não pode excluir contas nem gerenciar usuários ou categorias

### Como as permissões funcionam tecnicamente

O perfil é armazenado no `sessionStorage` após o login e verificado em dois momentos:

1. **No menu lateral** — `auth.js` oculta os itens de navegação que o perfil não tem acesso
2. **No módulo de contas** — os botões de ação (editar, pagar, excluir) são renderizados ou omitidos com base no perfil da sessão atual

Isso significa que as permissões são aplicadas no frontend. Para um sistema de alta segurança, seria necessário validar o perfil também no backend (Apps Script). Para o escopo atual, a validação no frontend é suficiente.

---

## 7. Como adicionar um novo módulo

Este é o caminho completo para criar um novo módulo, por exemplo, um módulo de **Orçamentos**.

### Passo 1 — Criar o arquivo do módulo

Crie `modules/orcamentos.js` seguindo o padrão IIFE:

```javascript
'use strict';

const ORCAMENTOS = (() => {
  // Estado privado do módulo
  let _dados = [];

  // Template HTML — retorna string com o conteúdo completo do módulo
  const _html = () => `
    <div class="modulo-header">
      <h2>Orçamentos</h2>
      <button class="btn btn-primario" id="btn-novo-orcamento">+ Novo</button>
    </div>
    <div class="card">
      <table class="tabela-padrao">
        <thead>
          <tr>
            <th>Fornecedor</th>
            <th>Valor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="tbody-orcamentos"></tbody>
      </table>
    </div>
  `;

  // Registra todos os event listeners do módulo
  const _registrarEventos = () => {
    document.getElementById('btn-novo-orcamento')
      .addEventListener('click', _abrirModalNovo);

    // Use event delegation para elementos dinâmicos (linhas da tabela)
    document.getElementById('tbody-orcamentos')
      .addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, id } = btn.dataset;
        if (action === 'editar') _editar(id);
      });
  };

  // Carrega dados da API e renderiza a tabela
  const _carregarDados = async () => {
    _dados = await API.get('listarOrcamentos');
    UI.renderTable('tbody-orcamentos', _dados, [
      { chave: 'fornecedor', titulo: 'Fornecedor' },
      { chave: 'valor',      titulo: 'Valor', formato: UI.formatMoeda },
    ]);
  };

  // Inicialização — chamada pelo router quando o módulo é ativado
  const init = async () => {
    document.getElementById('main-content').innerHTML = _html();
    _registrarEventos();
    await _carregarDados();
  };

  // Limpeza — chamada pelo router antes de trocar de módulo
  const destroy = () => {
    _dados = [];
    // Se tiver timers ou listeners em elementos fora do #main-content, remova aqui
  };

  return { init, destroy };
})();
```

### Passo 2 — Registrar no router

Em `js/router.js`, adicione o módulo nos dois objetos:

```javascript
const MODULOS = {
  // ...módulos existentes...
  orcamentos: () => typeof ORCAMENTOS !== 'undefined' ? ORCAMENTOS : null,
};

const TITULOS = {
  // ...títulos existentes...
  orcamentos: 'Orçamentos',
};
```

### Passo 3 — Adicionar ao menu

Em `index.html`, dentro de `<nav id="nav-menu">`:

```html
<div class="nav-item" data-modulo="orcamentos" data-titulo="Orçamentos">
  <span class="nav-icon">📋</span> Orçamentos
</div>
```

### Passo 4 — Carregar o script

Em `index.html`, após os outros módulos:

```html
<script src="modules/orcamentos.js"></script>
```

### Passo 5 — Adicionar a ação no backend

Em `Code.gs`, dentro do `doGet()`:

```javascript
case 'listarOrcamentos': data = _actionListarOrcamentos(); break;
```

E implemente a função:

```javascript
function _actionListarOrcamentos() {
  return _getAbaDados('ORCAMENTOS').map(r => ({
    id: String(r.ID || ''),
    fornecedor: String(r.FORNECEDOR || ''),
    valor: parseFloat(r.VALOR) || 0,
  }));
}
```

### Passo 6 — Criar a aba no Sheets

Adicione a definição da nova aba em `setupPlanilha()` no `Code.gs`:

```javascript
ORCAMENTOS: ['ID', 'FORNECEDOR', 'VALOR', 'STATUS', 'DATA_REGISTRO'],
```

Execute `setupPlanilha()` novamente (ela é idempotente — não apaga abas existentes).

---

## 8. Roadmap de integração com o Sistema de Frota

O sistema foi projetado desde o início para se integrar futuramente com um sistema de controle de frota. Os pontos de integração planejados são:

### 8.1 Categorias marcadas como frota

O cadastro de categorias tem um campo `frota` (booleano). Categorias de frota representam despesas relacionadas a veículos: combustível, manutenção, seguro, IPVA, etc.

**Uso futuro:** Ao lançar uma conta em uma categoria de frota, o sistema poderá exibir um campo adicional para vincular a despesa a um veículo específico da frota.

### 8.2 Campo `FROTA_API_URL` em `config.js`

```javascript
const CONFIG = {
  FROTA_API_URL: '',  // URL do Apps Script do sistema de frota
  // ...
};
```

Quando preenchido, os módulos poderão buscar dados do sistema de frota (lista de veículos, motoristas, etc.) usando `API.get()` com a URL alternativa ou uma segunda instância do client de API.

### 8.3 Relatórios cruzados

Com a integração ativa, o módulo de relatórios poderá:
- Mostrar custo por veículo no período
- Comparar despesas de frota vs. despesas operacionais
- Exportar relatórios de frota para prestação de contas

### 8.4 O que precisará ser desenvolvido

| Item | Descrição |
|------|-----------|
| Campo `veículo` em `contas.js` | Seletor de veículo habilitado apenas para categorias de frota |
| Coluna `VEICULO` no Sheets | Nova coluna na aba CONTAS |
| Ação `listarVeiculos` | Nova ação no `doGet()` que chama o sistema de frota |
| Filtro por veículo em `relatorio.js` | Novo filtro no módulo de relatórios |
| `_actionListarContas` com filtro de veículo | Filtro adicional no backend |

---

## 9. Convenções de código

### JavaScript

**Sem `var`** — use sempre `const` para valores que não mudam e `let` para variáveis que serão reatribuídas. `var` tem escopo de função e é içado (hoisted), o que cria bugs sutis.

**Modo estrito** — todos os arquivos começam com `'use strict'`. Isso proíbe variáveis não declaradas, `this` implícito e outras armadilhas do JavaScript legado.

**IIFE para módulos** — cada módulo usa o padrão Immediately Invoked Function Expression para criar escopo privado sem poluir o escopo global:
```javascript
const MEUMODULO = (() => {
  // tudo aqui é privado
  return { init, destroy }; // apenas isso é público
})();
```

**Funções privadas com prefixo `_`** — dentro dos módulos, funções que não devem ser chamadas externamente começam com `_`. É uma convenção visual, não uma proteção técnica (já que o escopo do IIFE já garante o encapsulamento).

**Event delegation** — em vez de adicionar um listener por linha da tabela (o que vaza memória quando o módulo é destruído), adiciona-se um único listener no `<tbody>` estável e verifica-se o elemento clicado:
```javascript
tbody.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  // processa btn.dataset.action e btn.dataset.id
});
```

### CSS

**Variáveis CSS para todas as cores** — nenhuma cor é escrita "na mão" nos arquivos de componentes. Todas as cores vêm de variáveis definidas em `:root` no `base.css`. Isso garante que mudar a identidade visual do sistema seja uma edição de 10 linhas.

**Sem estilos inline no JavaScript** — a única exceção documentada é o gráfico de barras, onde `style="--h: 75%"` define uma variável CSS customizada (não um estilo direto). A regra `height: var(--h)` fica no CSS. Isso mantém a separação entre lógica e apresentação.

**Ordem das folhas de estilo: base → layout → components** — cada camada pode sobrescrever a anterior. `base.css` define o vocabulário (variáveis, reset), `layout.css` define a estrutura (posicionamento, grid), `components.css` define os elementos reutilizáveis (cards, botões, modais).

### Nomenclatura

| Contexto | Convenção | Exemplo |
|----------|-----------|---------|
| Constantes globais | `MAIÚSCULAS` | `CONFIG`, `ROUTER`, `AUTH` |
| Funções privadas de módulo | `_camelCase` com prefixo `_` | `_carregarDados()` |
| IDs no HTML | `kebab-case` | `#btn-nova-conta` |
| Classes CSS | `kebab-case` | `.card-indicador` |
| Chaves de objeto retornadas pela API | `camelCase` | `dataPagamento` |
| Colunas no Google Sheets | `MAIÚSCULAS_COM_UNDERSCORE` | `DATA_PAGAMENTO` |

### Comunicação com a API

**GET** — para leituras: `API.get('listarContas', { dataInicio: '2025-01-01' })`

**POST** — para escritas: `API.post('criarConta', { fornecedor: 'X', valor: 150.00, ... })`

Os módulos nunca sabem a URL da API — apenas chamam `API.get()` e `API.post()` e recebem os dados diretamente. Erros de API chegam como exceções JavaScript e podem ser capturados com `try/catch`.

### Status de contas — calculado, nunca armazenado

O status de uma conta (`Pendente`, `Vencido`, `Vence Hoje`, `Pago`) é sempre calculado em tempo real com base em dois campos: `vencimento` e `dataPagamento`. Nunca é salvo na planilha. Isso garante que uma conta que estava `Pendente` ontem apareça automaticamente como `Vencida` hoje, sem nenhuma rotina de atualização noturna.

```
dataPagamento preenchida → Pago
vencimento < hoje        → Vencido
vencimento = hoje        → Vence Hoje
caso contrário           → Pendente
```

Essa lógica existe em dois lugares (propositalmente): em `modules/contas.js` para a exibição no frontend, e em `Code.gs` (`_calcularStatus`) para os filtros server-side.

---

*Desenvolvido para Biomassa Chaparini — v1.0.0*
