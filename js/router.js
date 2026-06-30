'use strict';

const ROUTER = (() => {
  // Todos os módulos do sistema mapeados pelo nome da rota
  const MODULOS = {
    dashboard:    () => typeof DASHBOARD    !== 'undefined' ? DASHBOARD    : null,
    fornecedores: () => typeof FORNECEDORES !== 'undefined' ? FORNECEDORES : null,
    contas:       () => typeof CONTAS       !== 'undefined' ? CONTAS       : null,
    categorias:   () => typeof CATEGORIAS   !== 'undefined' ? CATEGORIAS   : null,
    relatorio:    () => typeof RELATORIO    !== 'undefined' ? RELATORIO    : null,
    usuarios:     () => typeof USUARIOS     !== 'undefined' ? USUARIOS     : null,
    solicitantes: () => typeof SOLICITANTES !== 'undefined' ? SOLICITANTES : null
  };

  const TITULOS = {
    dashboard:    'Dashboard',
    fornecedores: 'Fornecedores',
    contas:       'Contas a Pagar',
    categorias:   'Categorias',
    relatorio:    'Relatórios',
    usuarios:     'Usuários',
    solicitantes: 'Solicitantes'
  };

  let _moduloAtual = null;
  let _nomeAtual   = null;
  let _navegando   = false; // guarda contra cliques duplos durante transição

  const navigate = (nomeModulo) => {
    if (nomeModulo === _nomeAtual || _navegando) return;

    const resolver = MODULOS[nomeModulo];
    if (!resolver) {
      UI.showToast(`Módulo "${nomeModulo}" não encontrado.`, 'erro');
      return;
    }

    const modulo = resolver();
    if (!modulo) {
      UI.showToast(`Módulo "${nomeModulo}" ainda não carregado.`, 'aviso');
      return;
    }

    _navegando = true;
    const mainContent = document.getElementById('main-content');

    // --- Fase 1: fade out ---
    mainContent.classList.add('modulo-saindo');

    setTimeout(() => {
      // Destroi módulo anterior
      if (_moduloAtual && typeof _moduloAtual.destroy === 'function') {
        try { _moduloAtual.destroy(); } catch { /* silencioso */ }
      }

      // Atualiza estado
      _moduloAtual = modulo;
      _nomeAtual   = nomeModulo;

      // Limpa conteúdo e remove classe de saída
      mainContent.innerHTML = '';
      mainContent.classList.remove('modulo-saindo');
      mainContent.classList.add('modulo-entrando');

      // Atualiza item de menu ativo
      document.querySelectorAll('.nav-item').forEach((el) => {
        el.classList.toggle('ativo', el.dataset.modulo === nomeModulo);
      });

      // Atualiza título do header e da aba do navegador
      const titulo = TITULOS[nomeModulo] || nomeModulo;
      const headerTitulo = document.getElementById('header-titulo');
      if (headerTitulo) headerTitulo.textContent = titulo;
      document.title = `${titulo} — ${CONFIG.sistema}`;

      // --- Fase 2: inicializa o novo módulo ---
      try {
        const resultado = modulo.init();
        // Suporta módulos com init() síncrono ou assíncrono
        if (resultado && typeof resultado.catch === 'function') {
          resultado.catch((err) => {
            UI.showToast('Erro ao carregar módulo.', 'erro');
            CONFIG.debug && console.log('[ROUTER.navigate]', err);
          });
        }
      } catch (err) {
        UI.showToast('Erro ao carregar módulo.', 'erro');
        CONFIG.debug && console.log('[ROUTER.navigate]', err);
      }

      // Remove classe de entrada após a animação
      setTimeout(() => {
        mainContent.classList.remove('modulo-entrando');
        _navegando = false;
      }, 250);

    }, 150); // duração do fade out
  };

  const init = () => {
    UI.init();

    // Listeners dos itens de menu
    document.querySelectorAll('.nav-item[data-modulo]').forEach((item) => {
      item.addEventListener('click', () => {
        navigate(item.dataset.modulo);
        _fecharSidebarMobile();
      });
    });

    // Botão de logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => AUTH.logout());

    // Toggle sidebar mobile
    const btnToggle = document.getElementById('btn-menu-toggle');
    const overlay   = document.getElementById('sidebar-overlay');
    if (btnToggle) btnToggle.addEventListener('click', _abrirSidebarMobile);
    if (overlay)   overlay.addEventListener('click', _fecharSidebarMobile);
  };

  const _abrirSidebarMobile = () => {
    document.getElementById('sidebar')?.classList.add('aberta');
    document.getElementById('sidebar-overlay')?.classList.add('visivel');
  };

  const _fecharSidebarMobile = () => {
    document.getElementById('sidebar')?.classList.remove('aberta');
    document.getElementById('sidebar-overlay')?.classList.remove('visivel');
  };

  return {
    init,
    navigate,
    get moduloAtual() { return _moduloAtual; }
  };
})();
