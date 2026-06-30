/**
 * Code.gs — Google Apps Script
 * Biomassa Chaparini — Sistema de Contas a Pagar
 *
 * Backend do sistema financeiro. Publicar como Web App:
 *   Executar como: Eu mesmo
 *   Quem tem acesso: Qualquer pessoa (para que o frontend consiga chamar sem auth do Google)
 *
 * Após publicar, copiar a URL gerada para CONFIG.API_URL em config.js.
 *
 * CORS: gerenciado automaticamente pelo proxy do Google quando publicado como
 *       "Qualquer pessoa". Não é necessário setar headers manualmente.
 */

'use strict'; // Apps Script V8 runtime suporta strict mode

// ─────────────────────────────────────────────
// CONFIGURAÇÃO
// ─────────────────────────────────────────────

// Deixar vazio para usar a planilha vinculada ao projeto.
// Preencher com o ID da planilha (URL) caso o script seja standalone.
const PLANILHA_ID = '';

// Fuso horário para formatação de datas
const FUSO = 'America/Sao_Paulo';

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL — GET
// ─────────────────────────────────────────────

function doGet(e) {
  try {
    const action = (e.parameter.action || '').trim();
    const params = e.parameter;

    let data;
    switch (action) {
      case 'all':               data = _actionAll();                  break;
      case 'listarFornecedores':
      case 'fornecedores':      data = _actionListarFornecedores();   break;
      case 'listarCategorias':
      case 'categorias':        data = _actionListarCategorias();     break;
      case 'listarContas':
      case 'contas':            data = _actionListarContas(params);   break;
      case 'listarSolicitantes':
      case 'solicitantes':      data = _actionListarSolicitantes();   break;
      case 'listarUsuarios':    data = _actionListarUsuarios();       break;
      case 'listarDashboard':   data = _actionListarDashboard();      break;
      default:
        return _erro(`Ação GET desconhecida: "${action}"`);
    }

    return _ok(data);
  } catch (err) {
    return _erro(err.message || 'Erro interno no servidor.');
  }
}

// ─────────────────────────────────────────────
// HANDLER PRINCIPAL — POST
// ─────────────────────────────────────────────

function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = (body.action || '').trim();

    let data;
    switch (action) {
      // Autenticação
      case 'login':                                 data = _actionLogin(body);               break;

      // Fornecedores
      case 'criarFornecedor':
      case 'addFornecedor':                         data = _actionCriarFornecedor(body);     break;
      case 'atualizarFornecedor':
      case 'updateFornecedor':                      data = _actionAtualizarFornecedor(body); break;
      case 'toggleFornecedor':                      data = _actionToggleFornecedor(body);    break;

      // Categorias
      case 'criarCategoria':
      case 'addCategoria':                          data = _actionCriarCategoria(body);      break;
      case 'atualizarCategoria':
      case 'updateCategoria':                       data = _actionAtualizarCategoria(body);  break;
      case 'toggleCategoria':                       data = _actionToggleCategoria(body);     break;

      // Contas
      case 'criarConta':
      case 'addConta':                              data = _actionCriarConta(body);          break;
      case 'atualizarConta':
      case 'updateConta':                           data = _actionAtualizarConta(body);      break;
      case 'excluirConta':
      case 'deleteConta':                           data = _actionExcluirConta(body);        break;
      case 'registrarPagamento':                    data = _actionRegistrarPagamento(body);  break;
      case 'criarContaParcelada':                   data = _actionCriarContaParcelada(body); break;

      // Solicitantes
      case 'criarSolicitante':
      case 'addSolicitante':                        data = _actionCriarSolicitante(body);    break;
      case 'atualizarSolicitante':
      case 'updateSolicitante':                     data = _actionAtualizarSolicitante(body);break;
      case 'toggleSolicitante':                     data = _actionToggleSolicitante(body);   break;

      // Usuários
      case 'criarUsuario':
      case 'addUsuario':                            data = _actionCriarUsuario(body);        break;
      case 'atualizarUsuario':
      case 'updateUsuario':                         data = _actionAtualizarUsuario(body);    break;
      case 'redefinirSenha':                        data = _actionRedefinirSenha(body);      break;
      case 'toggleUsuario':                         data = _actionToggleUsuario(body);       break;

      default:
        return _erro(`Ação POST desconhecida: "${action}"`);
    }

    return _ok(data);
  } catch (err) {
    return _erro(err.message || 'Erro interno no servidor.');
  }
}

// ─────────────────────────────────────────────
// RESPOSTAS PADRONIZADAS
// Formato esperado pelo api.js do frontend:
//   Sucesso: { status: 'ok',   data: ... }
//   Erro:    { status: 'erro', mensagem: '...' }
// ─────────────────────────────────────────────

function _ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _erro(mensagem) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'erro', mensagem: mensagem }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
// HELPERS DE PLANILHA
// ─────────────────────────────────────────────

// Retorna a planilha ativa ou pelo ID configurado
function _planilha() {
  return PLANILHA_ID
    ? SpreadsheetApp.openById(PLANILHA_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

// Retorna a aba pelo nome; lança erro se não existir
function _aba(nome) {
  const aba = _planilha().getSheetByName(nome);
  if (!aba) throw new Error(`Aba "${nome}" não encontrada. Execute setupPlanilha() primeiro.`);
  return aba;
}

// Normaliza valores lidos da planilha:
//   - Date → string ISO 'YYYY-MM-DD'
//   - números seriais de data do Sheets → string ISO
//   - demais valores → sem alteração
function _formatarValor(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, FUSO, 'yyyy-MM-dd');
  }
  // Sheets pode retornar um número serial para células de data
  // Intervalo típico de datas 2000–2099 em serial: ~36526–73050
  if (typeof v === 'number' && v > 36526 && v < 73050 && v === Math.floor(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    return Utilities.formatDate(d, FUSO, 'yyyy-MM-dd');
  }
  return v;
}

// Retorna todos os dados de uma aba como array de objetos com chaves MAIÚSCULAS
function _getAbaDados(nomeAba) {
  const aba    = _aba(nomeAba);
  const todos  = aba.getDataRange().getValues();
  if (todos.length <= 1) return []; // apenas cabeçalho, sem registros

  const cabecalho = todos[0].map(String);
  return todos.slice(1).map(linha => {
    const obj = {};
    cabecalho.forEach((col, i) => { obj[col] = _formatarValor(linha[i]); });
    return obj;
  });
}

// Retorna o array de colunas (cabeçalho) de uma aba
function _getCabecalho(nomeAba) {
  const aba = _aba(nomeAba);
  return aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map(String);
}

// Próximo ID inteiro = maior ID existente + 1 (ou 1 se vazio)
function _proximoId(nomeAba) {
  const dados = _getAbaDados(nomeAba);
  if (!dados.length) return 1;
  const ids = dados.map(r => parseInt(r.ID, 10)).filter(n => Number.isFinite(n));
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// Adiciona uma linha com ID automático; retorna o ID gerado
function _appendComId(nomeAba, campos) {
  const aba       = _aba(nomeAba);
  const cabecalho = _getCabecalho(nomeAba);
  const id        = _proximoId(nomeAba);
  const dados     = Object.assign({ ID: id }, campos);

  const linha = cabecalho.map(col => (dados[col] !== undefined ? dados[col] : ''));
  aba.appendRow(linha);
  return id;
}

// Atualiza campos de uma linha identificada pelo ID.
// Mantém valores existentes para colunas não informadas em `novoCampos`.
// Retorna true se o registro foi encontrado, false caso contrário.
function _updateById(nomeAba, id, novoCampos) {
  const aba       = _aba(nomeAba);
  const valores   = aba.getDataRange().getValues();
  const cabecalho = valores[0].map(String);
  const idIdx     = cabecalho.indexOf('ID');

  if (idIdx === -1) throw new Error(`Coluna "ID" não encontrada em "${nomeAba}".`);

  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][idIdx]) === String(id)) {
      const novaLinha = cabecalho.map((col, j) =>
        novoCampos[col] !== undefined ? novoCampos[col] : valores[i][j]
      );
      aba.getRange(i + 1, 1, 1, novaLinha.length).setValues([novaLinha]);
      return true;
    }
  }
  return false;
}

// Remove fisicamente a linha com o ID informado.
// Retorna true se encontrado, false caso contrário.
function _deleteById(nomeAba, id) {
  const aba     = _aba(nomeAba);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0].map(String);
  const idIdx   = cabecalho.indexOf('ID');

  for (let i = 1; i < valores.length; i++) {
    if (String(valores[i][idIdx]) === String(id)) {
      aba.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// Busca e retorna um único registro pelo ID (objeto com chaves maiúsculas), ou null
function _findById(nomeAba, id) {
  return _getAbaDados(nomeAba).find(r => String(r.ID) === String(id)) || null;
}

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────

// Data de hoje no formato YYYY-MM-DD, no fuso configurado
function _hojeISO() {
  return Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd');
}

// Normaliza valores booleanos vindos da planilha ou do body do request
function _toBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number')  return v !== 0;
  const s = String(v).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes' || s === 'sim';
}

// SHA-256 da senha — jamais armazena senha em texto claro na planilha
function _hashSenha(senha) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    senha,
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

// Lança erro descritivo se algum campo obrigatório estiver ausente/vazio
function _requerCampos(obj, campos) {
  const faltando = campos.filter(c => obj[c] === undefined || obj[c] === null || obj[c] === '');
  if (faltando.length) {
    throw new Error(`Campos obrigatórios ausentes: ${faltando.join(', ')}.`);
  }
}

// Calcula o status de uma conta (replicado do frontend para filtros server-side)
function _calcularStatus(conta) {
  if (conta.DATA_PAGAMENTO) return 'Pago';

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date((conta.VENCIMENTO || '') + 'T00:00:00');

  if (venc < hoje)                       return 'Vencido';
  if (venc.getTime() === hoje.getTime()) return 'Vence Hoje';
  return 'Pendente';
}

// ─────────────────────────────────────────────
// SERIALIZERS: Sheets (MAIÚSCULAS) → Frontend (camelCase)
// Nunca inclui senha em nenhum serializer.
// ─────────────────────────────────────────────

function _serFornecedor(r) {
  return {
    id:              String(r.ID             || ''),
    nome:            String(r.NOME           || ''),
    tipo:            String(r.TIPO           || ''),
    documento:       String(r.DOCUMENTO      || ''),
    telefone:        String(r.TELEFONE       || ''),
    email:           String(r.EMAIL          || ''),
    categoriaPadrao: String(r.CATEGORIA_PADRAO || ''),
    observacao:      String(r.OBSERVACAO     || ''),
    ativo:           _toBoolean(r.ATIVO)
  };
}

function _serCategoria(r) {
  return {
    id:         String(r.ID         || ''),
    nome:       String(r.NOME       || ''),
    tipo:       String(r.TIPO       || ''),
    frota:      _toBoolean(r.FROTA),
    observacao: String(r.OBSERVACAO || ''),
    ativo:      _toBoolean(r.ATIVO)
  };
}

function _serConta(r) {
  return {
    id:             String(r.ID              || ''),
    fornecedor:     String(r.FORNECEDOR      || ''),
    categoria:      String(r.CATEGORIA       || ''),
    solicitante:    String(r.SOLICITANTE     || ''),
    descricao:      String(r.DESCRICAO       || ''),
    valor:          parseFloat(r.VALOR)      || 0,
    vencimento:     String(r.VENCIMENTO      || ''),
    competencia:    String(r.COMPETENCIA     || ''),
    dataPagamento:  String(r.DATA_PAGAMENTO  || ''),
    formaPagamento: String(r.FORMA_PAGAMENTO || ''),
    numDocumento:   String(r.NUM_DOCUMENTO   || ''),
    observacao:     String(r.OBSERVACAO      || ''),
    usuario:        String(r.USUARIO         || ''),
    dataRegistro:   String(r.DATA_REGISTRO   || '')
  };
}

function _serSolicitante(r) {
  return {
    id:          String(r.ID          || ''),
    nome:        String(r.NOME        || ''),
    departamento:String(r.DEPARTAMENTO|| ''),
    cargo:       String(r.CARGO       || ''),
    email:       String(r.EMAIL       || ''),
    telefone:    String(r.TELEFONE    || ''),
    ativo:       _toBoolean(r.ATIVO)
  };
}

function _serUsuario(r) {
  // SENHA nunca é incluída na resposta
  return {
    id:     String(r.ID     || ''),
    nome:   String(r.NOME   || ''),
    login:  String(r.LOGIN  || ''),
    perfil: String(r.PERFIL || ''),
    ativo:  _toBoolean(r.ATIVO)
  };
}

// ─────────────────────────────────────────────
// ACTIONS — GET
// ─────────────────────────────────────────────

// Retorna todos os dados em uma única chamada (útil para pré-cache no frontend)
function _actionAll() {
  return {
    fornecedores: _getAbaDados('FORNECEDORES').map(_serFornecedor),
    categorias:   _getAbaDados('CATEGORIAS').map(_serCategoria),
    contas:       _getAbaDados('CONTAS').map(_serConta),
    usuarios:     _getAbaDados('USUARIOS').map(_serUsuario)
  };
}

function _actionListarFornecedores() {
  return _getAbaDados('FORNECEDORES').map(_serFornecedor);
}

function _actionListarSolicitantes() {
  return _getAbaDados('SOLICITANTES').map(_serSolicitante);
}

function _actionListarCategorias() {
  return _getAbaDados('CATEGORIAS').map(_serCategoria);
}

// Retorna contas com filtros opcionais passados como query string
function _actionListarContas(params) {
  let contas = _getAbaDados('CONTAS');

  // Período por data de vencimento (YYYY-MM-DD)
  if (params.dataInicio) contas = contas.filter(c => (c.VENCIMENTO || '') >= params.dataInicio);
  if (params.dataFim)    contas = contas.filter(c => (c.VENCIMENTO || '') <= params.dataFim);

  // Período por competência (YYYY-MM)
  if (params.mesInicio) {
    contas = contas.filter(c => (c.COMPETENCIA || '').substring(0, 7) >= params.mesInicio);
  }
  if (params.mesFim) {
    contas = contas.filter(c => (c.COMPETENCIA || '').substring(0, 7) <= params.mesFim);
  }

  // Filtros de texto (correspondência exata)
  if (params.fornecedor)  contas = contas.filter(c => c.FORNECEDOR  === params.fornecedor);
  if (params.categoria)   contas = contas.filter(c => c.CATEGORIA   === params.categoria);
  if (params.solicitante) contas = contas.filter(c => c.SOLICITANTE === params.solicitante);

  // Status calculado server-side (evita retornar todos os registros para filtrar no cliente)
  if (params.status) contas = contas.filter(c => _calcularStatus(c) === params.status);

  return contas.map(_serConta);
}

function _actionListarUsuarios() {
  return _getAbaDados('USUARIOS').map(_serUsuario);
}

// Retorna KPIs e listas do dashboard em uma única chamada
function _actionListarDashboard() {
  const contas = _getAbaDados('CONTAS');

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Janela "essa semana": amanhã até +7 dias a partir de hoje
  const fimSemana   = new Date(hoje);
  fimSemana.setDate(hoje.getDate() + 7);

  // Janela "este mês" para contas pagas
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const kpi = {
    vencidos: { count: 0, total: 0 },
    hoje:     { count: 0, total: 0 },
    semana:   { count: 0, total: 0 },
    pagosMes: { count: 0, total: 0 }
  };

  const naoPagas = []; // lista para "próximas a vencer"
  const pagas    = []; // lista para "últimas pagas"

  contas.forEach(c => {
    const valor = parseFloat(c.VALOR) || 0;
    const venc  = new Date((c.VENCIMENTO || '') + 'T00:00:00');

    if (c.DATA_PAGAMENTO) {
      // Conta paga
      const dtPago = new Date((c.DATA_PAGAMENTO || '') + 'T00:00:00');
      if (dtPago >= inicioMes && dtPago <= fimMes) {
        kpi.pagosMes.count++;
        kpi.pagosMes.total += valor;
      }
      pagas.push(c);
    } else {
      // Conta em aberto — classifica nos KPIs
      if      (venc < hoje)                       { kpi.vencidos.count++; kpi.vencidos.total += valor; }
      else if (venc.getTime() === hoje.getTime()) { kpi.hoje.count++;     kpi.hoje.total     += valor; }
      else if (venc <= fimSemana)                 { kpi.semana.count++;   kpi.semana.total   += valor; }
      naoPagas.push(c);
    }
  });

  // Próximas a vencer: ordena por vencimento crescente (mais urgentes primeiro)
  naoPagas.sort((a, b) => (a.VENCIMENTO || '').localeCompare(b.VENCIMENTO || ''));

  // Últimas pagas: ordena por data de pagamento decrescente
  pagas.sort((a, b) => (b.DATA_PAGAMENTO || '').localeCompare(a.DATA_PAGAMENTO || ''));

  return {
    kpi,
    proximasVencer: naoPagas.slice(0, 10).map(c => ({
      fornecedor: String(c.FORNECEDOR || ''),
      descricao:  String(c.DESCRICAO  || ''),
      categoria:  String(c.CATEGORIA  || ''),
      valor:      parseFloat(c.VALOR) || 0,
      vencimento: String(c.VENCIMENTO || '')
    })),
    ultimasPagas: pagas.slice(0, 5).map(c => ({
      fornecedor:     String(c.FORNECEDOR      || ''),
      descricao:      String(c.DESCRICAO       || ''),
      valor:          parseFloat(c.VALOR)      || 0,
      dataPagamento:  String(c.DATA_PAGAMENTO  || ''),
      formaPagamento: String(c.FORMA_PAGAMENTO || '')
    }))
  };
}

// ─────────────────────────────────────────────
// ACTIONS — POST — AUTENTICAÇÃO
// ─────────────────────────────────────────────

function _actionLogin(body) {
  _requerCampos(body, ['login', 'senha']);

  const usuarios  = _getAbaDados('USUARIOS');
  const hashSenha = _hashSenha(body.senha);

  const u = usuarios.find(r =>
    String(r.LOGIN).toLowerCase() === String(body.login).toLowerCase() &&
    String(r.SENHA) === hashSenha &&
    _toBoolean(r.ATIVO)
  );

  if (!u) throw new Error('Login ou senha incorretos, ou usuário inativo.');

  // Sessão retornada — NUNCA inclui hash de senha
  return { id: String(u.ID), nome: String(u.NOME), login: String(u.LOGIN), perfil: String(u.PERFIL) };
}

// ─────────────────────────────────────────────
// ACTIONS — POST — FORNECEDORES
// ─────────────────────────────────────────────

function _actionCriarFornecedor(body) {
  _requerCampos(body, ['nome', 'tipo']);

  const id = _appendComId('FORNECEDORES', {
    NOME:             body.nome,
    TIPO:             body.tipo,
    DOCUMENTO:        body.documento       || '',
    TELEFONE:         body.telefone        || '',
    EMAIL:            body.email           || '',
    CATEGORIA_PADRAO: body.categoriaPadrao || '',
    OBSERVACAO:       body.observacao      || '',
    ATIVO:            true
  });

  return { id: String(id) };
}

function _actionAtualizarFornecedor(body) {
  _requerCampos(body, ['id', 'nome', 'tipo']);

  const ok = _updateById('FORNECEDORES', body.id, {
    NOME:             body.nome,
    TIPO:             body.tipo,
    DOCUMENTO:        body.documento       || '',
    TELEFONE:         body.telefone        || '',
    EMAIL:            body.email           || '',
    CATEGORIA_PADRAO: body.categoriaPadrao || '',
    OBSERVACAO:       body.observacao      || ''
  });

  if (!ok) throw new Error('Fornecedor não encontrado.');
  return { atualizado: true };
}

function _actionToggleFornecedor(body) {
  _requerCampos(body, ['id']);
  if (body.ativo === undefined) throw new Error('Campo "ativo" é obrigatório.');

  const ativo = _toBoolean(body.ativo);
  const ok    = _updateById('FORNECEDORES', body.id, { ATIVO: ativo });
  if (!ok) throw new Error('Fornecedor não encontrado.');
  return { ativo };
}

// ─────────────────────────────────────────────
// ACTIONS — POST — CATEGORIAS
// ─────────────────────────────────────────────

function _actionCriarCategoria(body) {
  _requerCampos(body, ['nome', 'tipo']);

  const id = _appendComId('CATEGORIAS', {
    NOME:       body.nome,
    TIPO:       body.tipo,
    FROTA:      _toBoolean(body.frota),
    OBSERVACAO: body.observacao || '',
    ATIVO:      true
  });

  return { id: String(id) };
}

function _actionAtualizarCategoria(body) {
  _requerCampos(body, ['id', 'nome', 'tipo']);

  const ok = _updateById('CATEGORIAS', body.id, {
    NOME:       body.nome,
    TIPO:       body.tipo,
    FROTA:      _toBoolean(body.frota),
    OBSERVACAO: body.observacao || ''
  });

  if (!ok) throw new Error('Categoria não encontrada.');
  return { atualizado: true };
}

function _actionToggleCategoria(body) {
  _requerCampos(body, ['id']);
  if (body.ativo === undefined) throw new Error('Campo "ativo" é obrigatório.');

  const ativo = _toBoolean(body.ativo);
  const ok    = _updateById('CATEGORIAS', body.id, { ATIVO: ativo });
  if (!ok) throw new Error('Categoria não encontrada.');
  return { ativo };
}

// ─────────────────────────────────────────────
// ACTIONS — POST — CONTAS
// ─────────────────────────────────────────────

function _actionCriarConta(body) {
  _requerCampos(body, ['fornecedor', 'categoria', 'descricao', 'valor', 'vencimento']);

  const id = _appendComId('CONTAS', {
    FORNECEDOR:      body.fornecedor,
    CATEGORIA:       body.categoria,
    SOLICITANTE:     body.solicitante     || '',
    DESCRICAO:       body.descricao,
    VALOR:           parseFloat(body.valor) || 0,
    VENCIMENTO:      body.vencimento,
    COMPETENCIA:     body.competencia     || '',
    DATA_PAGAMENTO:  '',
    FORMA_PAGAMENTO: '',
    NUM_DOCUMENTO:   body.numDocumento    || '',
    OBSERVACAO:      body.observacao      || '',
    USUARIO:         body.usuario         || '',
    DATA_REGISTRO:   _hojeISO()
  });

  return { id: String(id) };
}

// Cria N parcelas como registros independentes em CONTAS
function _actionCriarContaParcelada(body) {
  _requerCampos(body, ['fornecedor', 'categoria', 'descricao', 'parcelas']);

  if (!Array.isArray(body.parcelas) || body.parcelas.length < 2) {
    throw new Error('É necessário informar ao menos 2 parcelas.');
  }

  const ids = [];
  body.parcelas.forEach((parcela) => {
    if (!parcela.valor || !parcela.vencimento) {
      throw new Error('Cada parcela deve ter valor e vencimento.');
    }
    const id = _appendComId('CONTAS', {
      FORNECEDOR:      body.fornecedor,
      CATEGORIA:       body.categoria,
      SOLICITANTE:     body.solicitante     || '',
      DESCRICAO:       parcela.descricao    || body.descricao,
      VALOR:           parseFloat(parcela.valor) || 0,
      VENCIMENTO:      parcela.vencimento,
      COMPETENCIA:     body.competencia     || '',
      DATA_PAGAMENTO:  '',
      FORMA_PAGAMENTO: '',
      NUM_DOCUMENTO:   body.numDocumento    || '',
      OBSERVACAO:      body.observacao      || '',
      USUARIO:         body.usuario         || '',
      DATA_REGISTRO:   _hojeISO()
    });
    ids.push(String(id));
  });

  return { ids, total: ids.length };
}

function _actionAtualizarConta(body) {
  _requerCampos(body, ['id', 'fornecedor', 'categoria', 'descricao', 'valor', 'vencimento']);

  // DATA_PAGAMENTO e FORMA_PAGAMENTO são preservados — edição de conta
  // não deve sobrescrever um pagamento já registrado
  const ok = _updateById('CONTAS', body.id, {
    FORNECEDOR:    body.fornecedor,
    CATEGORIA:     body.categoria,
    SOLICITANTE:   body.solicitante || '',
    DESCRICAO:     body.descricao,
    VALOR:         parseFloat(body.valor) || 0,
    VENCIMENTO:    body.vencimento,
    COMPETENCIA:   body.competencia  || '',
    NUM_DOCUMENTO: body.numDocumento || '',
    OBSERVACAO:    body.observacao   || ''
  });

  if (!ok) throw new Error('Conta não encontrada.');
  return { atualizado: true };
}

function _actionExcluirConta(body) {
  _requerCampos(body, ['id']);

  const ok = _deleteById('CONTAS', body.id);
  if (!ok) throw new Error('Conta não encontrada.');
  return { excluido: true };
}

function _actionRegistrarPagamento(body) {
  _requerCampos(body, ['id', 'dataPagamento', 'formaPagamento']);

  const conta = _findById('CONTAS', body.id);
  if (!conta) throw new Error('Conta não encontrada.');

  // Impede sobrescrever um pagamento já lançado
  if (conta.DATA_PAGAMENTO) {
    throw new Error('Esta conta já possui pagamento registrado. Para corrigir, edite os campos diretamente na planilha.');
  }

  const ok = _updateById('CONTAS', body.id, {
    DATA_PAGAMENTO:  body.dataPagamento,
    FORMA_PAGAMENTO: body.formaPagamento
  });

  if (!ok) throw new Error('Falha ao registrar pagamento.');
  return { registrado: true };
}

// ─────────────────────────────────────────────
// ACTIONS — POST — SOLICITANTES
// ─────────────────────────────────────────────

function _actionCriarSolicitante(body) {
  _requerCampos(body, ['nome']);

  const id = _appendComId('SOLICITANTES', {
    NOME:         body.nome,
    DEPARTAMENTO: body.departamento || '',
    CARGO:        body.cargo        || '',
    EMAIL:        body.email        || '',
    TELEFONE:     body.telefone     || '',
    ATIVO:        true
  });

  return { id: String(id) };
}

function _actionAtualizarSolicitante(body) {
  _requerCampos(body, ['id', 'nome']);

  const ok = _updateById('SOLICITANTES', body.id, {
    NOME:         body.nome,
    DEPARTAMENTO: body.departamento || '',
    CARGO:        body.cargo        || '',
    EMAIL:        body.email        || '',
    TELEFONE:     body.telefone     || ''
  });

  if (!ok) throw new Error('Solicitante não encontrado.');
  return { atualizado: true };
}

function _actionToggleSolicitante(body) {
  _requerCampos(body, ['id']);
  if (body.ativo === undefined) throw new Error('Campo "ativo" é obrigatório.');

  const ativo = _toBoolean(body.ativo);
  const ok    = _updateById('SOLICITANTES', body.id, { ATIVO: ativo });
  if (!ok) throw new Error('Solicitante não encontrado.');
  return { ativo };
}

// ─────────────────────────────────────────────
// ACTIONS — POST — USUÁRIOS
// ─────────────────────────────────────────────

function _actionCriarUsuario(body) {
  _requerCampos(body, ['nome', 'login', 'senha', 'perfil']);

  if (body.senha.length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }

  // Garante unicidade de login (case-insensitive)
  const loginNorm = String(body.login).toLowerCase().trim();
  const existe    = _getAbaDados('USUARIOS').find(
    u => String(u.LOGIN).toLowerCase() === loginNorm
  );
  if (existe) throw new Error(`Login "${loginNorm}" já está em uso.`);

  const id = _appendComId('USUARIOS', {
    NOME:   body.nome,
    LOGIN:  loginNorm,
    SENHA:  _hashSenha(body.senha), // nunca armazena em texto claro
    PERFIL: body.perfil,
    ATIVO:  true
  });

  return { id: String(id) };
}

function _actionAtualizarUsuario(body) {
  _requerCampos(body, ['id', 'nome', 'login', 'perfil']);

  const loginNorm  = String(body.login).toLowerCase().trim();
  const duplicado  = _getAbaDados('USUARIOS').find(
    u => String(u.LOGIN).toLowerCase() === loginNorm && String(u.ID) !== String(body.id)
  );
  if (duplicado) throw new Error(`Login "${loginNorm}" já está em uso por outro usuário.`);

  // Senha NÃO é alterada aqui — use redefinirSenha para isso
  const ok = _updateById('USUARIOS', body.id, {
    NOME:   body.nome,
    LOGIN:  loginNorm,
    PERFIL: body.perfil
  });

  if (!ok) throw new Error('Usuário não encontrado.');
  return { atualizado: true };
}

function _actionRedefinirSenha(body) {
  _requerCampos(body, ['id', 'senha']);

  if (String(body.senha).length < 6) {
    throw new Error('A senha deve ter no mínimo 6 caracteres.');
  }

  const ok = _updateById('USUARIOS', body.id, {
    SENHA: _hashSenha(body.senha)
  });

  if (!ok) throw new Error('Usuário não encontrado.');
  return { redefinido: true };
}

function _actionToggleUsuario(body) {
  _requerCampos(body, ['id']);
  if (body.ativo === undefined) throw new Error('Campo "ativo" é obrigatório.');

  const ativo = _toBoolean(body.ativo);
  const ok    = _updateById('USUARIOS', body.id, { ATIVO: ativo });
  if (!ok) throw new Error('Usuário não encontrado.');
  return { ativo };
}

// ─────────────────────────────────────────────
// SETUP INICIAL
// Execute esta função UMA VEZ no editor do Apps Script
// (menu Executar → setupPlanilha) antes de publicar o Web App.
// Cria as abas, formata cabeçalhos e insere o usuário admin inicial.
// ─────────────────────────────────────────────

function setupPlanilha() {
  const ss = _planilha();

  const definicaoAbas = {
    USUARIOS:     ['ID', 'NOME', 'LOGIN', 'SENHA', 'PERFIL', 'ATIVO'],
    FORNECEDORES: ['ID', 'NOME', 'TIPO', 'DOCUMENTO', 'TELEFONE', 'EMAIL',
                   'CATEGORIA_PADRAO', 'OBSERVACAO', 'ATIVO'],
    CATEGORIAS:   ['ID', 'NOME', 'TIPO', 'FROTA', 'OBSERVACAO', 'ATIVO'],
    SOLICITANTES: ['ID', 'NOME', 'DEPARTAMENTO', 'CARGO', 'EMAIL', 'TELEFONE', 'ATIVO'],
    CONTAS:       ['ID', 'FORNECEDOR', 'CATEGORIA', 'SOLICITANTE', 'DESCRICAO', 'VALOR',
                   'VENCIMENTO', 'COMPETENCIA', 'DATA_PAGAMENTO', 'FORMA_PAGAMENTO',
                   'NUM_DOCUMENTO', 'OBSERVACAO', 'USUARIO', 'DATA_REGISTRO']
  };

  Object.entries(definicaoAbas).forEach(([nome, colunas]) => {
    let aba = ss.getSheetByName(nome);
    if (!aba) {
      aba = ss.insertSheet(nome);
      Logger.log(`✅ Aba criada: ${nome}`);
    }

    // Garante que o cabeçalho está correto
    aba.getRange(1, 1, 1, colunas.length).setValues([colunas]);

    // Formata cabeçalho com a cor padrão do sistema
    const headerRange = aba.getRange(1, 1, 1, colunas.length);
    headerRange.setBackground('#0D692C');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');

    // Congela a linha de cabeçalho
    aba.setFrozenRows(1);

    Logger.log(`✅ Cabeçalho configurado: ${nome} (${colunas.length} colunas)`);
  });

  // Cria o usuário admin inicial somente se a aba USUARIOS estiver vazia
  const abaUsuarios = ss.getSheetByName('USUARIOS');
  const dadosUsuarios = abaUsuarios.getDataRange().getValues();
  if (dadosUsuarios.length <= 1) {
    abaUsuarios.appendRow([
      1,              // ID
      'Administrador', // NOME
      'admin',        // LOGIN
      _hashSenha('admin123'), // SENHA (hash SHA-256)
      'ADMIN',        // PERFIL
      true            // ATIVO
    ]);
    Logger.log('✅ Usuário admin criado → login: admin | senha: admin123');
    Logger.log('⚠️  IMPORTANTE: troque a senha do admin imediatamente após o primeiro login!');
  } else {
    Logger.log('ℹ️  Aba USUARIOS já possui dados — admin não foi recriado.');
  }

  Logger.log('');
  Logger.log('🚀 Setup concluído! Publique o script como Web App e copie a URL para CONFIG.API_URL em config.js.');
}

// ─────────────────────────────────────────────
// FUNÇÃO DE TESTE (opcional — use no editor para depurar)
// ─────────────────────────────────────────────

function testarDashboard() {
  const resultado = _actionListarDashboard();
  Logger.log(JSON.stringify(resultado, null, 2));
}

function testarListarContas() {
  const resultado = _actionListarContas({});
  Logger.log(JSON.stringify(resultado, null, 2));
}
