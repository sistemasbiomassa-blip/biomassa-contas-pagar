'use strict';

const USUARIOS = (() => {
  const _listeners = [];
  let _dados       = [];

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // Nomes e e-mails vêm do banco: nunca entram na página como HTML
  const _esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ===== MOCK DATA =====
  const _mockUsuarios = () => [
    { id: 'U001', nome: 'Administrador',  email: 'admin@exemplo.com',      login: 'admin',       perfil: 'ADMIN',      ativo: true  },
    { id: 'U002', nome: 'Carlos Diretor', email: 'diretor@exemplo.com',    login: 'cdiretor',    perfil: 'DIRETOR',    ativo: true  },
    { id: 'U003', nome: 'novo.usuario',   email: 'novo@exemplo.com',       login: '',            perfil: '',           ativo: false }
  ];

  // ===== BADGES =====
  const _BADGE_PERFIL = {
    ADMIN:      'badge-perfil-admin',
    DIRETOR:    'badge-perfil-diretor',
    FINANCEIRO: 'badge-perfil-financeiro'
  };

  const _badgePerfil = (perfil) => (perfil
    ? `<span class="badge ${_BADGE_PERFIL[perfil] || ''}">${_esc(perfil)}</span>`
    : '—');

  const _badgeStatus = (u) => {
    if (u.ativo)   return '<span class="badge badge-pago">Ativo</span>';
    if (!u.perfil) return '<span class="badge badge-atencao">Aguardando liberação</span>';
    return '<span class="badge badge-cancelado">Inativo</span>';
  };

  // ===== HTML =====

  const _renderHtml = () => {
    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <span class="toolbar-titulo">Usuários</span>
        <button class="btn btn-primario" id="btn-novo-usuario">+ Novo Usuário</button>
      </div>

      <div class="card">
        <div class="tabela-container">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Login</th>
                <th class="text-center">Perfil</th>
                <th class="text-center">Status</th>
                <th class="text-center">Ações</th>
              </tr>
            </thead>
            <tbody id="tbody-usuarios"></tbody>
          </table>
        </div>
      </div>

      <!-- Modal: Editar Usuário -->
      <div id="modal-usuario" class="modal-overlay hidden">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3>Editar Usuário</h3>
            <button class="modal-fechar" data-fecha="modal-usuario">✕</button>
          </div>

          <div class="modal-body">
            <form id="form-usuario" novalidate autocomplete="off">
              <input type="hidden" id="usr-id" />

              <p class="text-sm mb-4">E-mail de acesso: <strong id="usr-email">—</strong></p>

              <div class="form-group">
                <label class="form-label" for="usr-nome">Nome <span class="obrigatorio">*</span></label>
                <input id="usr-nome" type="text" class="form-input" placeholder="Nome completo" maxlength="80" />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="usr-login">Login curto <span class="obrigatorio">*</span></label>
                  <input id="usr-login" type="text" class="form-input" placeholder="nome.sobrenome" maxlength="40" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="usr-perfil">Perfil <span class="obrigatorio">*</span></label>
                  <select id="usr-perfil" class="form-select">
                    <option value="">Selecione...</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="DIRETOR">DIRETOR</option>
                    <option value="FINANCEIRO">FINANCEIRO</option>
                  </select>
                </div>
              </div>

              <p class="text-xs" style="color:#6c757d">
                O login curto aparece como "lançado por" nas contas. Para quem já usava o sistema,
                mantenha o mesmo login de antes.
              </p>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-usuario">Cancelar</button>
            <button class="btn btn-primario" id="btn-salvar-usuario">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Modal: como cadastrar um usuário / trocar a senha de quem esqueceu -->
      <div id="modal-como-cadastrar" class="modal-overlay hidden">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3>Cadastrar usuário ou trocar senha esquecida</h3>
            <button class="modal-fechar" data-fecha="modal-como-cadastrar">✕</button>
          </div>

          <div class="modal-body">
            <p class="text-sm mb-2"><strong>Novo usuário</strong></p>
            <ol class="text-sm mb-4">
              <li>Abra o <a id="link-painel-usuarios" target="_blank" rel="noopener">painel de usuários do Supabase</a>.</li>
              <li>Clique em <strong>Add user → Create new user</strong>, informe o e-mail e a senha
                  e deixe marcado <strong>Auto Confirm User</strong>.</li>
              <li>Volte aqui e recarregue: o usuário aparece como <strong>Aguardando liberação</strong>.</li>
              <li>Clique em ✏️ para definir nome, login curto e perfil, e depois em ✅ para liberar o acesso.</li>
            </ol>

            <p class="text-sm mb-2"><strong>Alguém esqueceu a senha</strong></p>
            <ol class="text-sm">
              <li>No mesmo painel, apague o login da pessoa e crie de novo com o <strong>mesmo e-mail</strong> e uma senha nova.</li>
              <li>Aqui, defina de novo nome, perfil e o <strong>mesmo login curto</strong> de antes, e libere o acesso.</li>
              <li>Depois de entrar, a pessoa pode trocar a senha em <strong>Alterar Senha</strong>.</li>
            </ol>
          </div>

          <div class="modal-footer">
            <button class="btn btn-primario" data-fecha="modal-como-cadastrar">Entendi</button>
          </div>
        </div>
      </div>
    `;
    const link = document.getElementById('link-painel-usuarios');
    if (link) link.href = CONFIG.SUPABASE_PAINEL_USUARIOS || '#';
  };

  // ===== TABELA =====

  const _renderTabela = (dados) => {
    UI.renderTable('tbody-usuarios', dados, [
      { key: 'nome',   label: 'Nome',   formato: (v) => _esc(v) },
      { key: 'email',  label: 'E-mail', formato: (v) => _esc(v) },
      { key: 'login',  label: 'Login',  formato: (v) => _esc(v) || '—' },
      { key: 'perfil', label: 'Perfil', classe: 'text-center', formato: (v) => _badgePerfil(v) },
      { key: 'ativo',  label: 'Status', classe: 'text-center', formato: (v, linha) => _badgeStatus(linha) },
      {
        key: 'id',
        label: 'Ações',
        classe: 'text-center',
        formato: (id, linha) => {
          const labelToggle = linha.ativo ? 'Desativar' : 'Liberar acesso';
          const iconeToggle = linha.ativo ? '🚫' : '✅';
          return `
            <span class="acoes">
              <button class="btn-icone" data-action="editar" data-id="${_esc(id)}" title="Editar usuário">✏️</button>
              <button class="btn-icone" data-action="toggle" data-id="${_esc(id)}" data-ativo="${linha.ativo}" title="${labelToggle}">${iconeToggle}</button>
            </span>
          `;
        }
      }
    ]);
  };

  // ===== MODAL EDITAR =====

  const _abrirModalEditar = (id) => {
    const usuario = _dados.find((u) => u.id === id);
    if (!usuario) return;

    document.querySelectorAll('#form-usuario .erro').forEach((el) => el.classList.remove('erro'));
    document.getElementById('usr-id').value        = usuario.id;
    document.getElementById('usr-email').textContent = usuario.email || '—';
    document.getElementById('usr-nome').value      = usuario.nome || '';
    document.getElementById('usr-login').value     = usuario.login || '';
    document.getElementById('usr-perfil').value    = usuario.perfil || '';
    UI.openModal('modal-usuario');
  };

  const _validarFormUsuario = () => {
    let valido = true;
    const checar = (id, condicao) => {
      const el = document.getElementById(id);
      const passou = condicao(el.value);
      el.classList.toggle('erro', !passou);
      if (!passou) valido = false;
    };
    checar('usr-nome',   (v) => v.trim().length > 0);
    checar('usr-login',  (v) => /^[a-z0-9._-]+$/i.test(v.trim()));
    checar('usr-perfil', (v) => v !== '');
    return valido;
  };

  const _salvarUsuario = async () => {
    if (!_validarFormUsuario()) {
      UI.showToast('Preencha nome, login (sem espaços) e perfil.', 'aviso');
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-usuario');
    btnSalvar.disabled = true;

    try {
      await API.post('atualizarUsuario', {
        id:     document.getElementById('usr-id').value,
        nome:   document.getElementById('usr-nome').value.trim(),
        login:  document.getElementById('usr-login').value.trim().toLowerCase(),
        perfil: document.getElementById('usr-perfil').value
      });
      UI.showToast('Usuário atualizado com sucesso.', 'sucesso');
      UI.closeModal('modal-usuario');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao salvar usuário.', 'erro');
    } finally {
      btnSalvar.disabled = false;
    }
  };

  // ===== LIBERAR / DESATIVAR =====

  const _toggleUsuario = async (id, ativoStr) => {
    const estaAtivo = ativoStr === 'true';
    const usuario   = _dados.find((u) => u.id === id);
    const sessao    = AUTH.getSessao();

    if (estaAtivo && sessao && id === sessao.id) {
      UI.showToast('Você não pode desativar sua própria conta.', 'aviso');
      return;
    }
    if (!estaAtivo && usuario && !usuario.perfil) {
      UI.showToast('Defina o perfil do usuário (✏️) antes de liberar o acesso.', 'aviso');
      return;
    }

    const confirmado = await UI.confirm(estaAtivo
      ? 'Deseja desativar este usuário? Ele não conseguirá mais entrar no sistema.'
      : 'Deseja liberar o acesso deste usuário?');
    if (!confirmado) return;

    try {
      await API.post('toggleUsuario', { id, ativo: !estaAtivo });
      UI.showToast(`Usuário ${estaAtivo ? 'desativado' : 'liberado'} com sucesso.`, 'sucesso');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao alterar o acesso do usuário.', 'erro');
    }
  };

  // ===== CARREGAMENTO =====

  const _carregarDados = async () => {
    if (!CONFIG.API_URL) {
      _dados = _mockUsuarios();
      CONFIG.debug && console.log('[USUARIOS] modo mock');
    } else {
      try {
        _dados = await API.get('listarUsuarios');
      } catch (err) {
        UI.showToast(err.message || 'Erro ao carregar usuários.', 'erro');
        _dados = [];
      }
    }
    _renderTabela(_dados);
  };

  // ===== BIND DE EVENTOS =====

  const _bindEventos = () => {
    _addListener(document.getElementById('btn-novo-usuario'), 'click', () => UI.openModal('modal-como-cadastrar'));
    _addListener(document.getElementById('btn-salvar-usuario'), 'click', _salvarUsuario);
    _addListener(document.getElementById('form-usuario'), 'submit', (e) => { e.preventDefault(); _salvarUsuario(); });

    document.querySelectorAll('[data-fecha="modal-usuario"], [data-fecha="modal-como-cadastrar"]')
      .forEach((btn) => _addListener(btn, 'click', () => UI.closeModal(btn.dataset.fecha)));

    const tbody = document.getElementById('tbody-usuarios');
    _addListener(tbody, 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id, ativo } = btn.dataset;
      if (action === 'editar') _abrirModalEditar(id);
      if (action === 'toggle') _toggleUsuario(id, ativo);
    });
  };

  // ===== PUBLIC API =====

  const init = async () => {
    // Gestão de usuários: exclusivo para ADMIN
    if (!AUTH.requerPerfil([CONFIG.perfis.ADMIN])) return;

    _renderHtml();
    _bindEventos();
    await _carregarDados();
  };

  const destroy = () => {
    _listeners.forEach(({ el, tipo, fn }) => el.removeEventListener(tipo, fn));
    _listeners.length = 0;
    _dados = [];
  };

  return { init, destroy };
})();
