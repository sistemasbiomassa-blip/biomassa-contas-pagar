'use strict';

const API = (() => {
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

  // Trata a resposta padrão do Apps Script: { status: 'ok'|'erro', data, mensagem }
  const _tratarResposta = async (response) => {
    if (!response.ok) {
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
    const json = await response.json();
    if (json.status === 'erro') {
      throw new Error(json.mensagem || 'Ocorreu um erro no servidor.');
    }
    return json.data !== undefined ? json.data : json;
  };

  const get = async (action, params = {}) => {
    if (!CONFIG.API_URL) throw new Error('API_URL não configurada.');
    UI.showLoading();
    try {
      // O Apps Script às vezes devolve 404/5xx passageiros — tenta de novo.
      // Só GET é repetido: repetir POST poderia gravar o registro em duplicidade.
      const TENTATIVAS = 3;
      let response;
      for (let i = 1; i <= TENTATIVAS; i++) {
        response = await fetch(_buildUrl(action, params), {
          method: 'GET',
          redirect: 'follow'
        });
        const passageiro = response.status === 404 || response.status >= 500;
        if (!passageiro || i === TENTATIVAS) break;
        await new Promise((r) => setTimeout(r, 500 * i));
      }
      return await _tratarResposta(response);
    } catch (err) {
      CONFIG.debug && console.log('[API.get]', action, err);
      throw err;
    } finally {
      UI.hideLoading();
    }
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
      UI.hideLoading();
    }
  };

  return { get, post };
})();
