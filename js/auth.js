'use strict';

const AUTH = (() => {
  const CHAVE_SESSAO = 'biomassa_sessao';

  // Retorna objeto {id, nome, login, perfil} ou null
  const getSessao = () => {
    const dado = sessionStorage.getItem(CHAVE_SESSAO);
    if (!dado) return null;
    try { return JSON.parse(dado); } catch { return null; }
  };

  const setSessao = (dados) => {
    sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(dados));
  };

  const limparSessao = () => {
    sessionStorage.clear();
  };

  // ===== MOCK LOGIN (usado quando CONFIG.API_URL está vazio) =====
  // Credenciais de demonstração — nunca enviar para produção
  const _MOCK_USUARIOS = [
    { id: 'U001', nome: 'Administrador',  login: 'admin',       senha: 'admin123', perfil: 'ADMIN'      },
    { id: 'U002', nome: 'Carlos Diretor', login: 'cdiretor',    senha: 'dir123',   perfil: 'DIRETOR'    },
    { id: 'U003', nome: 'Ana Financeiro', login: 'afinanceiro', senha: 'fin123',   perfil: 'FINANCEIRO' }
  ];

  const _mockLogin = (loginStr, senha) => {
    const u = _MOCK_USUARIOS.find((x) => x.login === loginStr && x.senha === senha);
    if (!u) throw new Error('Login ou senha incorretos.');
    // Retorna dados de sessão sem a senha
    return { id: u.id, nome: u.nome, login: u.login, perfil: u.perfil };
  };

  // ===== LOGIN / LOGOUT =====

  const login = async (loginStr, senha) => {
    let sessao;
    if (!CONFIG.API_URL) {
      // Modo desenvolvimento — usa mock local
      sessao = _mockLogin(loginStr, senha);
    } else {
      const dados = await API.post('login', { login: loginStr, senha });
      if (!dados || !dados.perfil) throw new Error('Resposta inválida do servidor.');
      sessao = dados;
    }
    setSessao(sessao);
    return sessao;
  };

  const logout = () => {
    limparSessao();
    _mostrarLogin();
  };

  // ===== VERIFICADORES DE PERFIL =====

  const isAdmin = () => getSessao()?.perfil === CONFIG.perfis.ADMIN;
  const isDiretor = () => getSessao()?.perfil === CONFIG.perfis.DIRETOR;
  const isFinanceiro = () => getSessao()?.perfil === CONFIG.perfis.FINANCEIRO;

  // Redireciona para login se o perfil não estiver na lista permitida
  const requerPerfil = (perfis = []) => {
    const s = getSessao();
    if (!s || !perfis.includes(s.perfil)) {
      logout();
      return false;
    }
    return true;
  };

  // ===== VISIBILIDADE DE INTERFACE =====

  const _mostrarLogin = () => {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    // Limpa mensagem de erro anterior
    const erroEl = document.getElementById('login-erro');
    if (erroEl) erroEl.classList.add('hidden');
  };

  const _mostrarApp = () => {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  };

  // Mostra/oculta itens de menu conforme o perfil
  const _configurarMenuPorPerfil = (sessao) => {
    // Itens restritos a ADMIN
    const itensAdmin = ['nav-usuarios', 'nav-sep-admin'];
    itensAdmin.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('hidden', sessao.perfil !== CONFIG.perfis.ADMIN);
    });

    // Categorias: ADMIN e FINANCEIRO podem gerenciar
    const navCategorias = document.getElementById('nav-categorias');
    if (navCategorias) {
      const podeVer = sessao.perfil === CONFIG.perfis.ADMIN || sessao.perfil === CONFIG.perfis.FINANCEIRO;
      navCategorias.classList.toggle('hidden', !podeVer);
    }
  };

  // Preenche nome/perfil na sidebar e no header
  const _preencherIdentidade = (sessao) => {
    const sNome   = document.getElementById('sidebar-usuario-nome');
    const sPerfil = document.getElementById('sidebar-usuario-perfil');
    if (sNome)   sNome.textContent   = sessao.nome;
    if (sPerfil) sPerfil.textContent = sessao.perfil;

    const hNome   = document.getElementById('header-usuario-nome');
    const hPerfil = document.getElementById('header-usuario-perfil');
    if (hNome)   hNome.textContent   = sessao.nome;
    if (hPerfil) hPerfil.textContent = sessao.perfil;
  };

  // ===== ALTERAR MINHA SENHA (self-service) =====

  const _limparModalMinhaSenha = () => {
    ['ms-senha-atual', 'ms-nova-senha', 'ms-confirmar-senha'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const aviso = document.getElementById('ms-aviso');
    if (aviso) aviso.textContent = '';
    document.querySelectorAll('#form-minha-senha .erro').forEach((el) => el.classList.remove('erro'));
  };

  const _validarMinhaSenha = () => {
    let valido = true;
    const checar = (id, condicao) => {
      const el = document.getElementById(id);
      if (!el) return;
      const passou = condicao(el.value);
      el.classList.toggle('erro', !passou);
      if (!passou) valido = false;
    };

    checar('ms-senha-atual', (v) => v.length > 0);
    checar('ms-nova-senha',  (v) => v.length >= 6);
    checar('ms-confirmar-senha', (v) => v === document.getElementById('ms-nova-senha').value);

    return valido;
  };

  const _salvarMinhaSenha = async () => {
    if (!_validarMinhaSenha()) {
      const aviso = document.getElementById('ms-aviso');
      if (aviso) aviso.textContent = 'Verifique os campos: senha atual obrigatória, nova senha com mínimo 6 caracteres e confirmação igual.';
      return;
    }

    const sessao = getSessao();
    if (!sessao) return;

    const btnConfirmar = document.getElementById('btn-confirmar-minha-senha');
    btnConfirmar.disabled = true;

    try {
      await API.post('alterarMinhaSenha', {
        login:      sessao.login,
        senhaAtual: document.getElementById('ms-senha-atual').value,
        novaSenha:  document.getElementById('ms-nova-senha').value
      });
      UI.showToast('Senha alterada com sucesso.', 'sucesso');
      UI.closeModal('modal-minha-senha');
    } catch (err) {
      UI.showToast(err.message || 'Erro ao alterar senha.', 'erro');
    } finally {
      btnConfirmar.disabled = false;
    }
  };

  const _initBotaoMinhaSenha = () => {
    const btnAbrir = document.getElementById('btn-minha-senha');
    if (btnAbrir && !btnAbrir.dataset.bind) {
      btnAbrir.dataset.bind = '1';
      btnAbrir.addEventListener('click', () => {
        _limparModalMinhaSenha();
        UI.openModal('modal-minha-senha');
      });
    }

    const btnConfirmar = document.getElementById('btn-confirmar-minha-senha');
    if (btnConfirmar && !btnConfirmar.dataset.bind) {
      btnConfirmar.dataset.bind = '1';
      btnConfirmar.addEventListener('click', _salvarMinhaSenha);
    }

    const form = document.getElementById('form-minha-senha');
    if (form && !form.dataset.bind) {
      form.dataset.bind = '1';
      form.addEventListener('submit', (e) => { e.preventDefault(); _salvarMinhaSenha(); });
    }

    document.querySelectorAll('[data-fecha="modal-minha-senha"]').forEach((btn) => {
      if (btn.dataset.bind) return;
      btn.dataset.bind = '1';
      btn.addEventListener('click', () => UI.closeModal('modal-minha-senha'));
    });
  };

  // ===== SPINNER INICIAL =====

  const _esconderSpinnerInicial = () => {
    const overlay = document.getElementById('init-overlay');
    if (!overlay) return;
    // Pequeno delay para evitar flash de conteúdo
    setTimeout(() => overlay.classList.add('hidden'), 150);
  };

  // ===== FORM DE LOGIN =====

  const _mostrarErroLogin = (msg) => {
    const erroEl = document.getElementById('login-erro');
    if (!erroEl) return;
    erroEl.textContent = msg;
    erroEl.classList.remove('hidden');
  };

  const _initFormLogin = () => {
    const form = document.getElementById('form-login');
    if (!form) return;

    // Exibe dica de credenciais demo quando sem API
    if (!CONFIG.API_URL) {
      const dica = document.getElementById('login-dica-demo');
      if (dica) dica.classList.remove('hidden');
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const loginVal  = document.getElementById('input-login').value.trim();
      const senhaVal  = document.getElementById('input-senha').value;
      const btnSubmit = form.querySelector('button[type="submit"]');
      const erroEl    = document.getElementById('login-erro');

      if (erroEl) erroEl.classList.add('hidden');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Entrando...';

      try {
        const sessao = await AUTH.login(loginVal, senhaVal);
        _preencherIdentidade(sessao);
        _configurarMenuPorPerfil(sessao);
        _mostrarApp();
        _initBotaoMinhaSenha();
        ROUTER.init();
        ROUTER.navigate('dashboard');
      } catch (err) {
        _mostrarErroLogin(err.message || 'Erro ao fazer login. Tente novamente.');
        document.getElementById('input-senha').value = '';
        document.getElementById('input-senha').focus();
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Entrar';
      }
    });
  };

  // ===== INICIALIZAÇÃO =====

  const inicializar = () => {
    _initFormLogin();

    const sessao = getSessao();
    if (sessao) {
      _preencherIdentidade(sessao);
      _configurarMenuPorPerfil(sessao);
      _mostrarApp();
      _initBotaoMinhaSenha();
      ROUTER.init();
      ROUTER.navigate('dashboard');
    } else {
      _mostrarLogin();
    }

    _esconderSpinnerInicial();
  };

  return {
    login,
    logout,
    getSessao,
    isAdmin,
    isDiretor,
    isFinanceiro,
    requerPerfil,
    inicializar
  };
})();
