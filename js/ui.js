'use strict';

const UI = (() => {
  let _loadingAtivo = 0; // contador para chamadas aninhadas

  // ===== TOAST =====
  const showToast = (mensagem, tipo = 'sucesso') => {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;
    container.appendChild(toast);

    // Remove o elemento após a animação (4s)
    setTimeout(() => toast.remove(), 4000);
  };

  // ===== MODAL =====
  const openModal = (id) => {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('hidden');
    // Foca o primeiro campo editável
    setTimeout(() => {
      const primeiro = overlay.querySelector('input, select, textarea');
      if (primeiro) primeiro.focus();
    }, 50);
  };

  const closeModal = (id) => {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('hidden');
  };

  // Fecha modal ao clicar no overlay (fora do .modal)
  const initModalClickOutside = () => {
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.add('hidden');
      }
    });
  };

  // Modal de confirmação customizado (substitui window.confirm)
  const confirm = (mensagem) => {
    return new Promise((resolve) => {
      const overlay = document.getElementById('modal-confirmacao');
      const msgEl = document.getElementById('confirmacao-mensagem');
      const btnSim = document.getElementById('confirmacao-sim');
      const btnNao = document.getElementById('confirmacao-nao');

      if (!overlay || !btnSim || !btnNao) {
        // Fallback se o modal não estiver no HTML ainda
        resolve(window.confirm(mensagem));
        return;
      }

      if (msgEl) msgEl.textContent = mensagem;
      openModal('modal-confirmacao');

      const limpar = () => {
        btnSim.removeEventListener('click', onSim);
        btnNao.removeEventListener('click', onNao);
        closeModal('modal-confirmacao');
      };

      const onSim = () => { limpar(); resolve(true); };
      const onNao = () => { limpar(); resolve(false); };

      btnSim.addEventListener('click', onSim, { once: true });
      btnNao.addEventListener('click', onNao, { once: true });
    });
  };

  // ===== LOADING =====
  const showLoading = () => {
    _loadingAtivo++;
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('hidden');
  };

  const hideLoading = () => {
    _loadingAtivo = Math.max(0, _loadingAtivo - 1);
    if (_loadingAtivo === 0) {
      const overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.classList.add('hidden');
    }
  };

  // ===== RENDERIZAÇÃO DE TABELA =====
  // colunas: [{ key, label, formato }]  — formato é função opcional (valor, linha) => string/HTML
  const renderTable = (tbodyId, dados, colunas) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    if (!dados || dados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${colunas.length}" class="tabela-vazia">Nenhum registro encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = dados.map((linha) => {
      const cells = colunas.map((col) => {
        const val = linha[col.key] ?? '';
        const conteudo = col.formato ? col.formato(val, linha) : val;
        const classe = col.classe ? ` class="${col.classe}"` : '';
        return `<td${classe}>${conteudo}</td>`;
      }).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
  };

  // ===== FORMATADORES =====
  const formatMoeda = (valor) => {
    const num = parseFloat(valor);
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatData = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString + (isoString.length === 10 ? 'T00:00:00' : ''));
    if (isNaN(d)) return isoString;
    return d.toLocaleDateString('pt-BR');
  };

  const formatDataHora = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d)) return isoString;
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  // ===== INICIALIZAÇÃO =====
  const init = () => {
    initModalClickOutside();
  };

  return {
    showToast,
    openModal,
    closeModal,
    confirm,
    showLoading,
    hideLoading,
    renderTable,
    formatMoeda,
    formatData,
    formatDataHora,
    init
  };
})();
