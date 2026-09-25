'use strict';

const API = (() => {
  // O servidor (Google Apps Script) leva 1–4 s por chamada e, em alguns períodos,
  // 30–60 s — às vezes perdendo a resposta (404). Por isso:
  //  • as listas vêm todas juntas numa ÚNICA chamada ('carregarDados');
  //  • os dados ficam guardados no navegador: se o servidor demorar, a tela abre com
  //    o último dado conhecido e atualiza em segundo plano;
  //  • chamadas lentas NÃO são canceladas — o Google continua executando mesmo assim,
  //    e cancelar + repetir só aumentava a fila. Só se repete quando há erro;
  //  • gravações nunca são repetidas (poderiam duplicar registros).
  const FRESCO_MS          = 60 * 1000;               // até 1 min: usa o guardado sem consultar o servidor
  const RECENTE_MS         = 10 * 60 * 1000;          // até 10 min: mostra na hora e atualiza em segundo plano
  const ESPERA_MS          = 6 * 1000;                // mais antigo: espera o servidor por até 6 s
  const ESPERA_GRAVACAO_MS = 45 * 1000;               // após gravar: espera mais, para mostrar a alteração
  const GUARDAR_MS         = 7 * 24 * 60 * 60 * 1000; // dados guardados no navegador valem por até 7 dias
  const LIMITE_MS          = 90 * 1000;               // só para não esperar para sempre
  const TENTATIVAS         = 3;
  const CHAVE_LOCAL        = 'biomassa_cache_v1';

  // Listas que o servidor devolve juntas na ação 'carregarDados'
  const LISTAS = {
    listarContas:       'contas',
    listarFornecedores: 'fornecedores',
    listarCategorias:   'categorias',
    listarSolicitantes: 'solicitantes'
  };
  let _servidorSemCarregarDados = false; // Code.gs antigo: usa as consultas separadas

  const _cache       = new Map(); // url → { t, data, invalido }
  const _emAndamento = new Map(); // url → Promise (quem pedir junto compartilha a mesma busca)
  let _geracao = 0;               // muda a cada gravação; respostas anteriores não entram no cache
  let _avisoDadosNovos = null;    // chamado quando dados mais novos chegam em segundo plano
  let _ultimoAvisoAntigo = 0;

  // Monta URL com query string para requisições GET
  const _buildUrl = (action, params = {}) => {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    });
    return url.toString();
  };

  // Erro de infraestrutura do Google (não é resposta do nosso Code.gs) — vale tentar de novo
  class ErroPassageiro extends Error {}
  // Passou de LIMITE_MS sem resposta
  class ErroSemResposta extends Error {}

  // Trata a resposta padrão do Apps Script: { status: 'ok'|'erro', data, mensagem }
  const _tratarResposta = async (response) => {
    if (!response.ok) {
      const msg = `Erro HTTP ${response.status}: ${response.statusText}`;
      if (response.status === 404 || response.status >= 500) throw new ErroPassageiro(msg);
      throw new Error(msg);
    }
    let json;
    try {
      json = JSON.parse(await response.text());
    } catch {
      // O Google às vezes devolve uma página HTML de erro com status 200
      throw new ErroPassageiro('Resposta inválida do servidor.');
    }
    if (json.status === 'erro') {
      // O Google às vezes perde a resposta e redireciona o navegador de volta ao
      // /exec sem parâmetros — o doGet responde "ação desconhecida" com ação vazia
      if (/^Ação GET desconhecida: ""/.test(json.mensagem || '')) {
        throw new ErroPassageiro('Resposta perdida pelo servidor do Google.');
      }
      throw new Error(json.mensagem || 'Ocorreu um erro no servidor.');
    }
    return json.data !== undefined ? json.data : json;
  };

  const _ehPassageiro = (err) => err instanceof ErroPassageiro || err instanceof TypeError; // TypeError = falha de rede

  const _esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const _requisitar = async (url, opcoes) => {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), LIMITE_MS);
    try {
      const response = await fetch(url, { ...opcoes, redirect: 'follow', signal: controle.signal });
      return await _tratarResposta(response);
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new ErroSemResposta('O servidor do Google não respondeu. Tente novamente em alguns minutos.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  // Repete só em erro passageiro (404, página de erro, resposta perdida, falha de rede).
  // Uso exclusivo para chamadas que podem ser repetidas sem efeito colateral.
  const _comTentativas = async (url, opcoes) => {
    for (let i = 1; ; i++) {
      try {
        return await _requisitar(url, opcoes);
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
      _cache.forEach((v, url) => { obj[url] = v; });
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(obj));
    } catch { /* sem espaço ou armazenamento bloqueado: segue só com a memória */ }
  };

  const _lerDoNavegador = () => {
    try {
      const obj = JSON.parse(localStorage.getItem(CHAVE_LOCAL) || '{}');
      Object.entries(obj).forEach(([url, v]) => {
        if (v && typeof v.t === 'number' && Date.now() - v.t < GUARDAR_MS) {
          _cache.set(url, { t: v.t, data: v.data, invalido: Boolean(v.invalido) });
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

  // Busca no servidor e guarda o resultado
  const _buscar = (url) => {
    const existente = _emAndamento.get(url);
    if (existente) return existente;

    const geracao = _geracao;
    const promessa = _comTentativas(url, { method: 'GET' }).then((data) => {
      if (geracao === _geracao) {
        _cache.set(url, { t: Date.now(), data, invalido: false });
        _salvarNoNavegador();
      }
      return data;
    });

    _emAndamento.set(url, promessa);
    const limpar = () => { if (_emAndamento.get(url) === promessa) _emAndamento.delete(url); };
    promessa.then(limpar, limpar);
    return promessa;
  };

  // Atualiza em segundo plano; se vier diferente do que está na tela, avisa
  const _atualizarEmSegundoPlano = (url, mostrado) => {
    _buscar(url).then((novo) => {
      if (_avisoDadosNovos && JSON.stringify(novo) !== JSON.stringify(mostrado)) _avisoDadosNovos();
    }).catch(() => { /* tenta de novo na próxima vez que alguma tela pedir */ });
  };

  const ESGOTOU = Symbol('esgotou');

  const _obter = async (url) => {
    const salvo = _cache.get(url);
    const idade = salvo ? Date.now() - salvo.t : Infinity;

    if (salvo && !salvo.invalido && idade < FRESCO_MS) return salvo.data;

    if (salvo && !salvo.invalido && idade < RECENTE_MS) {
      _atualizarEmSegundoPlano(url, salvo.data);
      return salvo.data;
    }

    // Sem dado, dado antigo ou alterado por uma gravação: consulta o servidor
    UI.showLoading();
    try {
      const busca = _buscar(url);
      if (!salvo) return await busca;

      // Há um dado anterior: espera um tempo limitado e, se o servidor não responder,
      // mostra o anterior enquanto a busca continua
      const espera = salvo.invalido ? ESPERA_GRAVACAO_MS : ESPERA_MS;
      const r = await Promise.race([busca, _esperar(espera).then(() => ESGOTOU)]);
      if (r !== ESGOTOU) return r;
      _avisarDadoAntigo(salvo.t, 'O servidor do Google está lento.');
      _atualizarEmSegundoPlano(url, salvo.data);
      return salvo.data;
    } catch (err) {
      if (!salvo) throw err;
      // Servidor falhou: melhor mostrar o último dado conhecido do que uma tela vazia
      _avisarDadoAntigo(salvo.t, 'Não foi possível atualizar agora.');
      return salvo.data;
    } finally {
      UI.hideLoading();
    }
  };

  const get = async (action, params = {}) => {
    if (!CONFIG.API_URL) throw new Error('API_URL não configurada.');
    try {
      const lista = LISTAS[action];
      if (lista && !Object.keys(params).length && !_servidorSemCarregarDados) {
        try {
          const tudo = await _obter(_buildUrl('carregarDados'));
          return _copia(tudo[lista] || []);
        } catch (err) {
          if (!/Ação GET desconhecida: "carregarDados"/.test(err.message || '')) throw err;
          _servidorSemCarregarDados = true; // Code.gs ainda não atualizado: usa a consulta separada
        }
      }
      return _copia(await _obter(_buildUrl(action, params)));
    } catch (err) {
      CONFIG.debug && console.log('[API.get]', action, err);
      throw err;
    }
  };

  // Chamada quando chegam dados mais novos que os exibidos (a tela decide o que fazer)
  const aoReceberDadosNovos = (fn) => { _avisoDadosNovos = fn; };

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

  // Ações de POST que só leem dados e podem ser repetidas com segurança
  const POST_REPETIVEIS = ['login'];

  const post = async (action, payload = {}) => {
    if (!CONFIG.API_URL) throw new Error('API_URL não configurada.');
    UI.showLoading();
    const opcoes = {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script aceita texto simples
      body: JSON.stringify({ action, ...payload })
    };
    const repetivel = POST_REPETIVEIS.includes(action);
    try {
      if (repetivel) return await _comTentativas(CONFIG.API_URL, opcoes);

      // Gravações NÃO são repetidas: quando a resposta se perde, o Google
      // normalmente já executou a gravação, e repetir duplicaria o registro
      try {
        return await _requisitar(CONFIG.API_URL, opcoes);
      } catch (err) {
        if (!_ehPassageiro(err) && !(err instanceof ErroSemResposta)) throw err;
        throw new Error('O servidor do Google não confirmou a operação, mas ela pode ter sido gravada. ' +
                        'Abra a tela de novo e confira antes de repetir.');
      }
    } catch (err) {
      CONFIG.debug && console.log('[API.post]', action, err);
      throw err;
    } finally {
      // Mesmo em erro o registro pode ter sido gravado
      if (!repetivel) _invalidar();
      UI.hideLoading();
    }
  };

  return { get, post, preCarregar, limparCache, aoReceberDadosNovos };
})();
