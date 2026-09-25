'use strict';

const API = (() => {
  // Cada chamada ao Apps Script leva 2–3 s (às vezes muito mais), então as
  // consultas ficam guardadas por um tempo e são reaproveitadas entre as telas.
  // Qualquer gravação (POST) limpa o cache, para a tela nunca mostrar dado antigo
  // depois de o próprio usuário salvar algo.
  const CACHE_TTL_MS = 2 * 60 * 1000;
  const _cache     = new Map(); // url → { t, data }
  const _emAndamento = new Map(); // url → Promise (evita buscar a mesma coisa duas vezes)
  let _geracao = 0;             // incrementa a cada POST; respostas antigas não entram no cache

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
      throw new Error(json.mensagem || 'Ocorreu um erro no servidor.');
    }
    return json.data !== undefined ? json.data : json;
  };

  // Busca na API, repetindo em falhas passageiras do Google.
  // Só GET é repetido: repetir POST poderia gravar o registro em duplicidade.
  const _buscar = (url) => {
    if (_emAndamento.has(url)) return _emAndamento.get(url);

    const geracao = _geracao;
    const promessa = (async () => {
      const TENTATIVAS = 3;
      for (let i = 1; ; i++) {
        try {
          const response = await fetch(url, { method: 'GET', redirect: 'follow' });
          const data = await _tratarResposta(response);
          if (geracao === _geracao) _cache.set(url, { t: Date.now(), data });
          return data;
        } catch (err) {
          const passageiro = err instanceof ErroPassageiro || err instanceof TypeError; // TypeError = falha de rede
          if (!passageiro || i === TENTATIVAS) throw err;
          await new Promise((r) => setTimeout(r, 500 * i));
        }
      }
    })();

    _emAndamento.set(url, promessa);
    promessa.finally(() => _emAndamento.delete(url)).catch(() => {});
    return promessa;
  };

  // Cópia para a tela poder ordenar/alterar os dados sem mexer no cache
  const _copia = (data) => JSON.parse(JSON.stringify(data));

  const get = async (action, params = {}) => {
    if (!CONFIG.API_URL) throw new Error('API_URL não configurada.');
    const url = _buildUrl(action, params);

    const salvo = _cache.get(url);
    if (salvo && Date.now() - salvo.t < CACHE_TTL_MS) return _copia(salvo.data);

    UI.showLoading();
    try {
      return _copia(await _buscar(url));
    } catch (err) {
      CONFIG.debug && console.log('[API.get]', action, err);
      throw err;
    } finally {
      UI.hideLoading();
    }
  };

  // Dispara consultas em segundo plano (sem tela de carregamento) para que
  // as próximas telas abram na hora. Erros são ignorados aqui — a tela tenta de novo.
  const preCarregar = (actions = []) => {
    if (!CONFIG.API_URL) return;
    actions.forEach((action) => _buscar(_buildUrl(action)).catch(() => {}));
  };

  const limparCache = () => {
    _geracao++;
    _cache.clear();
  };

  const post = async (action, payload = {}) => {
    if (!CONFIG.API_URL) throw new Error('API_URL não configurada.');
    UI.showLoading();
    try {
      const response = await fetch(CONFIG.API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' }, // Apps Script aceita texto simples
        body: JSON.stringify({ action, ...payload })
      });
      return await _tratarResposta(response);
    } catch (err) {
      CONFIG.debug && console.log('[API.post]', action, err);
      throw err;
    } finally {
      // Mesmo em erro o registro pode ter sido gravado — descarta o cache por segurança
      if (action !== 'login') limparCache();
      UI.hideLoading();
    }
  };

  return { get, post, preCarregar, limparCache };
})();
