'use strict';

const API = (() => {
  // Servidor: Supabase (banco Postgres). As regras de acesso ficam no próprio banco
  // (supabase/schema.sql): cada gravação é uma função que confere o perfil de quem está logado.
  //  • as listas vêm todas juntas numa ÚNICA chamada (carregar_dados);
  //  • os dados ficam guardados no navegador: se a conexão falhar, a tela abre com o último
  //    dado conhecido e atualiza em segundo plano;
  //  • lançamentos levam uma chave de envio: se o mesmo envio chegar duas vezes, o banco não duplica.
  const FRESCO_MS          = 60 * 1000;               // até 1 min: usa o guardado sem consultar o servidor
  const RECENTE_MS         = 10 * 60 * 1000;          // até 10 min: mostra na hora e atualiza em segundo plano
  const ESPERA_MS          = 6 * 1000;                // mais antigo: espera o servidor por até 6 s
  const ESPERA_GRAVACAO_MS = 45 * 1000;               // após gravar: espera mais, para mostrar a alteração
  const GUARDAR_MS         = 7 * 24 * 60 * 60 * 1000; // dados guardados no navegador valem por até 7 dias
  const LIMITE_MS          = 30 * 1000;               // sem resposta nesse tempo, desiste
  const TENTATIVAS         = 3;
  const CHAVE_LOCAL        = 'biomassa_cache_v2';

  // Consultas do sistema → funções do banco
  const FUNCOES_LEITURA = {
    carregarDados:  'carregar_dados',
    listarUsuarios: 'listar_usuarios'
  };

  // Listas que o banco devolve juntas em carregar_dados
  const LISTAS = {
    listarContas:       'contas',
    listarFornecedores: 'fornecedores',
    listarCategorias:   'categorias',
    listarSolicitantes: 'solicitantes'
  };

  // Gravações do sistema → funções do banco
  const FUNCOES_GRAVACAO = {
    criarConta:           'criar_conta',
    criarContaParcelada:  'criar_conta_parcelada',
    atualizarConta:       'atualizar_conta',
    excluirConta:         'excluir_conta',
    registrarPagamento:   'registrar_pagamento',
    criarFornecedor:      'criar_fornecedor',
    atualizarFornecedor:  'atualizar_fornecedor',
    toggleFornecedor:     'toggle_fornecedor',
    criarCategoria:       'criar_categoria',
    atualizarCategoria:   'atualizar_categoria',
    toggleCategoria:      'toggle_categoria',
    criarSolicitante:     'criar_solicitante',
    atualizarSolicitante: 'atualizar_solicitante',
    toggleSolicitante:    'toggle_solicitante',
    atualizarUsuario:     'atualizar_usuario',
    toggleUsuario:        'toggle_usuario'
  };

  // Gravações que podem ser repetidas sem risco: definem valores (não somam nem criam),
  // ou trazem chave de envio (o banco reconhece a repetição)
  const _podeRepetir = (action, payload) =>
    /^(atualizar|toggle)/.test(action) || (/^criarConta/.test(action) && !!payload.chaveEnvio);

  // Sessão guardada só enquanto a aba estiver aberta (como antes: fechou a aba, saiu)
  const _cliente = (CONFIG.API_URL && window.supabase)
    ? window.supabase.createClient(CONFIG.API_URL, CONFIG.SUPABASE_KEY, {
        auth: { storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
      })
    : null;

  const _cache       = new Map(); // chave → { t, data, invalido }
  const _emAndamento = new Map(); // chave → Promise (quem pedir junto compartilha a mesma busca)
  let _geracao = 0;               // muda a cada gravação; respostas anteriores não entram no cache
  let _avisoDadosNovos = null;    // chamado quando dados mais novos chegam em segundo plano
  let _aoPerderSessao  = null;    // chamado quando o login expira
  let _ultimoAvisoAntigo = 0;

  // Falha de conexão ou do servidor (não é uma recusa do banco) — vale tentar de novo
  class ErroPassageiro extends Error {}
  class ErroSemResposta extends Error {}

  const _esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const _traduzirErro = (error, status) => {
    const msg = error.message || '';
    if (status === 401 || /JWT|permission denied|login novamente/i.test(msg)) {
      if (_aoPerderSessao) setTimeout(_aoPerderSessao, 0);
      return new Error('Sua sessão expirou. Entre novamente.');
    }
    if (/abort/i.test(msg)) return new ErroSemResposta('O servidor não respondeu. Verifique a internet e tente novamente.');
    // Sem código do banco = a requisição nem chegou (rede) ou o servidor falhou
    if (!error.code || status >= 500) return new ErroPassageiro('Falha de conexão com o servidor.');
    return new Error(msg); // recusa do banco (validação ou permissão): mensagem já vem em português
  };

  // Chama uma função do banco, com tempo limite
  const _chamar = async (funcao, params) => {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), LIMITE_MS);
    try {
      const { data, error, status } = await _cliente.rpc(funcao, params).abortSignal(controle.signal);
      if (error) throw _traduzirErro(error, status);
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  const _ehPassageiro = (err) => err instanceof ErroPassageiro;

  const _comTentativas = async (fn) => {
    for (let i = 1; ; i++) {
      try {
        return await fn();
      } catch (err) {
        if (!_ehPassageiro(err) || i === TENTATIVAS) throw err;
        await _esperar(1000 * i);
      }
    }
  };

  // ===== DADOS GUARDADOS NO NAVEGADOR =====

  const _salvarNoNavegador = () => {
    try {
      const obj = {};
      _cache.forEach((v, chave) => { obj[chave] = v; });
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(obj));
    } catch { /* sem espaço ou armazenamento bloqueado: segue só com a memória */ }
  };

  const _lerDoNavegador = () => {
    try {
      const obj = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '{}');
      Object.entries(obj).forEach(([chave, v]) => {
        if (v && typeof v.t === 'number' && Date.now() - v.t < GUARDAR_MS) {
          _cache.set(chave, { t: v.t, data: v.data, invalido: Boolean(v.invalido) });
        }
      });
    } catch { /* dado corrompido: ignora */ }
  };
  _lerDoNavegador();

  // Cópia para a tela poder ordenar/alterar os dados sem mexer no que está guardado
  const _copia = (data) => (data === undefined ? data : JSON.parse(JSON.stringify(data)));

  const _avisarDadoAntigo = (t, motivo) => {
    if (Date.now() - _ultimoAvisoAntigo < 5000) return; // uma tela pede várias listas de uma vez
    _ultimoAvisoAntigo = Date.now();
    const d = new Date(t);
    const hoje = new Date().toDateString() === d.toDateString();
    const quando = d.toLocaleString('pt-BR', hoje
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    UI.showToast(`${motivo} Exibindo os dados de ${quando}; a atualização continua em segundo plano.`, 'aviso');
  };

  // ===== CONSULTAS =====

  const _buscar = (chave) => {
    const existente = _emAndamento.get(chave);
    if (existente) return existente;

    const geracao = _geracao;
    const promessa = _comTentativas(() => _chamar(FUNCOES_LEITURA[chave])).then((data) => {
      if (geracao === _geracao) {
        _cache.set(chave, { t: Date.now(), data, invalido: false });
        _salvarNoNavegador();
      }
      return data;
    });

    _emAndamento.set(chave, promessa);
    const limpar = () => { if (_emAndamento.get(chave) === promessa) _emAndamento.delete(chave); };
    promessa.then(limpar, limpar);
    return promessa;
  };

  // Atualiza em segundo plano; se vier diferente do que está na tela, avisa
  const _atualizarEmSegundoPlano = (chave, mostrado) => {
    _buscar(chave).then((novo) => {
      if (_avisoDadosNovos && JSON.stringify(novo) !== JSON.stringify(mostrado)) _avisoDadosNovos();
    }).catch(() => { /* tenta de novo na próxima vez que alguma tela pedir */ });
  };

  const ESGOTOU = Symbol('esgotou');

  const _obter = async (chave) => {
    const salvo = _cache.get(chave);
    const idade = salvo ? Date.now() - salvo.t : Infinity;

    if (salvo && !salvo.invalido && idade < FRESCO_MS) return salvo.data;

    if (salvo && !salvo.invalido && idade < RECENTE_MS) {
      _atualizarEmSegundoPlano(chave, salvo.data);
      return salvo.data;
    }

    // Sem dado, dado antigo ou alterado por uma gravação: consulta o servidor
    UI.showLoading();
    try {
      const busca = _buscar(chave);
      if (!salvo) return await busca;

      // Há um dado anterior: espera um tempo limitado e, se o servidor não responder,
      // mostra o anterior enquanto a busca continua
      const espera = salvo.invalido ? ESPERA_GRAVACAO_MS : ESPERA_MS;
      const r = await Promise.race([busca, _esperar(espera).then(() => ESGOTOU)]);
      if (r !== ESGOTOU) return r;
      _avisarDadoAntigo(salvo.t, 'O servidor está demorando.');
      _atualizarEmSegundoPlano(chave, salvo.data);
      return salvo.data;
    } catch (err) {
      if (!salvo || !_ehPassageiro(err)) throw err;
      // Conexão falhou: melhor mostrar o último dado conhecido do que uma tela vazia
      _avisarDadoAntigo(salvo.t, 'Não foi possível atualizar agora.');
      return salvo.data;
    } finally {
      UI.hideLoading();
    }
  };

  const get = async (action) => {
    if (!_cliente) throw new Error('Servidor não configurado.');
    try {
      const lista = LISTAS[action];
      if (lista) {
        const tudo = await _obter('carregarDados');
        return _copia(tudo[lista] || []);
      }
      if (!FUNCOES_LEITURA[action]) throw new Error(`Consulta desconhecida: ${action}`);
      return _copia(await _obter(action));
    } catch (err) {
      CONFIG.debug && console.log('[API.get]', action, err);
      throw err;
    }
  };

  // Chamada quando chegam dados mais novos que os exibidos (a tela decide o que fazer)
  const aoReceberDadosNovos = (fn) => { _avisoDadosNovos = fn; };

  // Chamada quando o login expira ou é desativado (o auth.js volta para a tela de login)
  const aoPerderSessao = (fn) => { _aoPerderSessao = fn; };

  // Mantida só por compatibilidade com versões antigas de auth.js ainda em cache no navegador
  const preCarregar = () => {};

  // Depois de uma gravação, tudo o que está guardado pode estar desatualizado
  const _invalidar = () => {
    _geracao++;
    _emAndamento.clear();
    _cache.forEach((v) => { v.invalido = true; });
    _salvarNoNavegador();
  };

  // Logout: apaga tudo, inclusive o que ficou guardado no navegador
  const limparCache = () => {
    _geracao++;
    _emAndamento.clear();
    _cache.clear();
    try { localStorage.removeItem(CHAVE_LOCAL); } catch { /* armazenamento bloqueado */ }
  };

  // ===== GRAVAÇÕES =====

  const post = async (action, payload = {}) => {
    if (!_cliente) throw new Error('Servidor não configurado.');
    const funcao = FUNCOES_GRAVACAO[action];
    if (!funcao) throw new Error(`Operação desconhecida: ${action}`);

    UI.showLoading();
    try {
      const chamar = () => _chamar(funcao, { p: payload });
      if (_podeRepetir(action, payload)) return await _comTentativas(chamar);
      try {
        return await chamar();
      } catch (err) {
        if (!_ehPassageiro(err) && !(err instanceof ErroSemResposta)) throw err;
        throw new Error('Não foi possível confirmar a operação: ela pode ter sido gravada. ' +
                        'Abra a tela de novo e confira antes de repetir.');
      }
    } catch (err) {
      CONFIG.debug && console.log('[API.post]', action, err);
      throw err;
    } finally {
      _invalidar(); // mesmo em erro o registro pode ter sido gravado
      UI.hideLoading();
    }
  };

  // ===== LOGIN =====

  const entrar = async (email, senha) => {
    UI.showLoading();
    try {
      const { error } = await _cliente.auth.signInWithPassword({ email, password: senha });
      if (error) {
        if (/invalid login credentials/i.test(error.message)) throw new Error('E-mail ou senha incorretos.');
        if (/email not confirmed/i.test(error.message)) throw new Error('E-mail ainda não confirmado. Fale com o administrador.');
        if (!error.status || error.status >= 500) throw new Error('Não foi possível conectar ao servidor. Verifique a internet.');
        throw new Error(error.message);
      }
      const eu = await _chamar('meu_usuario');
      if (!eu || !eu.ativo || !eu.perfil) {
        await _cliente.auth.signOut();
        throw new Error('Seu acesso ainda não foi liberado. Fale com o administrador do sistema.');
      }
      return { id: eu.id, nome: eu.nome, login: eu.login, email: eu.email, perfil: eu.perfil };
    } finally {
      UI.hideLoading();
    }
  };

  const sair = async () => {
    limparCache();
    try { await _cliente?.auth.signOut(); } catch { /* já estava sem sessão */ }
  };

  // Existe login válido guardado nesta aba?
  const temSessao = async () => {
    if (!_cliente) return false;
    const { data } = await _cliente.auth.getSession();
    return !!data.session;
  };

  const alterarSenha = async (email, senhaAtual, novaSenha) => {
    UI.showLoading();
    try {
      const { error: errAtual } = await _cliente.auth.signInWithPassword({ email, password: senhaAtual });
      if (errAtual) {
        throw new Error(/invalid login credentials/i.test(errAtual.message) ? 'Senha atual incorreta.' : errAtual.message);
      }
      const { error } = await _cliente.auth.updateUser({ password: novaSenha });
      if (error) {
        if (/different|same/i.test(error.message)) throw new Error('A nova senha precisa ser diferente da atual.');
        if (/least|weak|characters/i.test(error.message)) throw new Error('Senha fraca: use no mínimo 6 caracteres.');
        throw new Error(error.message);
      }
    } finally {
      UI.hideLoading();
    }
  };

  return {
    get, post, preCarregar, limparCache, aoReceberDadosNovos, aoPerderSessao,
    entrar, sair, temSessao, alterarSenha
  };
})();
