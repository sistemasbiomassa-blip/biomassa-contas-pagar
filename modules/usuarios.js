'use strict';

const USUARIOS = (() => {
  const _listeners = [];
  let _dados       = [];
  let _editandoId  = null; // null = novo, string = editando

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // ===== MOCK DATA =====
  // Senhas nunca são armazenadas em mock — apenas metadados do usuário
  const _mockUsuarios = () => [
    { id: 'U001', nome: 'Administrador',  login: 'admin',       perfil: 'ADMIN',      ativo: true  },
    { id: 'U002', nome: 'Carlos Diretor', login: 'cdiretor',    perfil: 'DIRETOR',    ativo: true  },
    { id: 'U003', nome: 'Ana Financeiro', login: 'afinanceiro', perfil: 'FINANCEIRO', ativo: false }
  ];

  // ===== BADGE DE PERFIL =====
  const _BADGE_PERFIL = {
    ADMIN:      'badge-perfil-admin',
    DIRETOR:    'badge-perfil-diretor',
    FINANCEIRO: 'badge-perfil-financeiro'
  };

  const _badgePerfil = (perfil) =>
    `<span class="badge ${_BADGE_PERFIL[perfil] || ''}">${perfil}</span>`;

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

      <!-- Modal: Novo / Editar Usuário -->
      <div id="modal-usuario" class="modal-overlay hidden">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3 id="modal-usuario-titulo">Novo Usuário</h3>
            <button class="modal-fechar" data-fecha="modal-usuario">✕</button>
          </div>

          <div class="modal-body">
            <form id="form-usuario" novalidate autocomplete="off">
              <input type="hidden" id="usr-id" />

              <div class="form-group">
                <label class="form-label" for="usr-nome">
                  Nome <span class="obrigatorio">*</span>
                </label>
                <input
                  id="usr-nome"
                  type="text"
                  class="form-input"
                  placeholder="Nome completo"
                  maxlength="80"
                  autocomplete="name"
                />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="usr-login">
                    Login <span class="obrigatorio">*</span>
                  </label>
                  <input
                    id="usr-login"
                    type="text"
                    class="form-input"
                    placeholder="nome.sobrenome"
                    maxlength="40"
                    autocomplete="username"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="usr-perfil">
                    Perfil <span class="obrigatorio">*</span>
                  </label>
                  <select id="usr-perfil" class="form-select">
                    <option value="">Selecione...</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="DIRETOR">DIRETOR</option>
                    <option value="FINANCEIRO">FINANCEIRO</option>
                  </select>
                </div>
              </div>

              <!-- Bloco de senha — visível só na criação -->
              <div id="bloco-senha">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="usr-senha">
                      Senha <span class="obrigatorio">*</span>
                    </label>
                    <input
                      id="usr-senha"
                      type="password"
                      class="form-input"
                      placeholder="Mínimo 6 caracteres"
                      autocomplete="new-password"
                    />
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="usr-confirmar-senha">
                      Confirmar Senha <span class="obrigatorio">*</span>
                    </label>
                    <input
                      id="usr-confirmar-senha"
                      type="password"
                      class="form-input"
                      placeholder="Repita a senha"
                      autocomplete="new-password"
                    />
                  </div>
                </div>

                <p class="text-xs mb-4" id="usr-aviso-senha" style="color:#6c757d"></p>
              </div>

              <!-- Aviso exibido no modo edição (senha oculta) -->
              <p id="usr-aviso-edicao" class="text-sm hidden" style="color:#6c757d">
                🔑 Para alterar a senha use o botão de redefinição na listagem.
              </p>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-usuario">Cancelar</button>
            <button class="btn btn-primario" id="btn-salvar-usuario">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Modal: Redefinir Senha -->
      <div id="modal-senha" class="modal-overlay hidden">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3>Redefinir Senha</h3>
            <button class="modal-fechar" data-fecha="modal-senha">✕</button>
          </div>

          <div class="modal-body">
            <form id="form-senha" novalidate autocomplete="off">
              <input type="hidden" id="rs-id" />

              <p class="text-sm mb-4">
                Usuário: <strong id="rs-nome-usuario">—</strong>
              </p>

              <div class="form-group">
                <label class="form-label" for="rs-nova-senha">
                  Nova Senha <span class="obrigatorio">*</span>
                </label>
                <input
                  id="rs-nova-senha"
                  type="password"
                  class="form-input"
                  placeholder="Mínimo 6 caracteres"
                  autocomplete="new-password"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="rs-confirmar-senha">
                  Confirmar Nova Senha <span class="obrigatorio">*</span>
                </label>
                <input
                  id="rs-confirmar-senha"
                  type="password"
                  class="form-input"
                  placeholder="Repita a nova senha"
                  autocomplete="new-password"
                />
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-senha">Cancelar</button>
            <button class="btn btn-primario" id="btn-confirmar-senha">Redefinir</button>
          </div>
        </div>
      </div>
    `;
  };

  // ===== TABELA =====

  const _renderTabela = (dados) => {
    UI.renderTable('tbody-usuarios', dados, [
      { key: 'nome',  label: 'Nome'  },
      { key: 'login', label: 'Login' },
      {
        key: 'perfil',
        label: 'Perfil',
        classe: 'text-center',
        formato: (v) => _badgePerfil(v)
      },
      {
        key: 'ativo',
        label: 'Status',
        classe: 'text-center',
        formato: (v) => v
          ? '<span class="badge badge-pago">Ativo</span>'
          : '<span class="badge badge-cancelado">Inativo</span>'
      },
      {
        key: 'id',
        label: 'Ações',
        classe: 'text-center',
        formato: (id, linha) => {
          const labelToggle = linha.ativo ? 'Desativar' : 'Reativar';
          const iconeToggle = linha.ativo ? '🚫' : '✅';
          return `
            <span class="acoes">
              <button class="btn-icone" data-action="editar"  data-id="${id}" title="Editar usuário">✏️</button>
              <button class="btn-icone" data-action="senha"   data-id="${id}" title="Redefinir senha">🔑</button>
              <button class="btn-icone" data-action="toggle"  data-id="${id}" data-ativo="${linha.ativo}" title="${labelToggle}">${iconeToggle}</button>
            </span>
          `;
        }
      }
    ]);
  };

  // ===== MODAL USUÁRIO =====

  const _limparModalUsuario = () => {
    ['usr-id', 'usr-nome', 'usr-login', 'usr-senha', 'usr-confirmar-senha']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });

    const perfil = document.getElementById('usr-perfil');
    if (perfil) perfil.value = '';

    document.querySelectorAll('#form-usuario .erro')
      .forEach((el) => el.classList.remove('erro'));

    const aviso = document.getElementById('usr-aviso-senha');
    if (aviso) aviso.textContent = '';
  };

  const _abrirModalNovo = () => {
    _editandoId = null;
    _limparModalUsuario();

    // Exibe bloco de senha; oculta aviso de edição
    document.getElementById('bloco-senha').classList.remove('hidden');
    document.getElementById('usr-aviso-edicao').classList.add('hidden');

    document.getElementById('modal-usuario-titulo').textContent = 'Novo Usuário';
    UI.openModal('modal-usuario');
  };

  const _abrirModalEditar = (id) => {
    const usuario = _dados.find((u) => u.id === id);
    if (!usuario) return;

    _editandoId = id;
    _limparModalUsuario();

    document.getElementById('usr-id').value    = usuario.id;
    document.getElementById('usr-nome').value  = usuario.nome;
    document.getElementById('usr-login').value = usuario.login;
    document.getElementById('usr-perfil').value = usuario.perfil;

    // Oculta campos de senha no modo edição
    document.getElementById('bloco-senha').classList.add('hidden');
    document.getElementById('usr-aviso-edicao').classList.remove('hidden');

    document.getElementById('modal-usuario-titulo').textContent = 'Editar Usuário';
    UI.openModal('modal-usuario');
  };

  // ===== VALIDAÇÕES =====

  const _validarSenhas = (senhaId, confirmarId, avisoId) => {
    const senhaEl     = document.getElementById(senhaId);
    const confirmarEl = document.getElementById(confirmarId);
    const avisoEl     = avisoId ? document.getElementById(avisoId) : null;

    let valido = true;

    senhaEl.classList.remove('erro');
    confirmarEl.classList.remove('erro');
    if (avisoEl) avisoEl.textContent = '';

    const senha     = senhaEl.value;
    const confirmar = confirmarEl.value;

    if (senha.length < 6) {
      senhaEl.classList.add('erro');
      if (avisoEl) avisoEl.textContent = 'A senha deve ter no mínimo 6 caracteres.';
      valido = false;
    } else if (senha !== confirmar) {
      confirmarEl.classList.add('erro');
      if (avisoEl) avisoEl.textContent = 'As senhas não conferem.';
      valido = false;
    }

    return valido;
  };

  const _validarFormUsuario = () => {
    let valido = true;

    const checar = (id, condicao) => {
      const el = document.getElementById(id);
      if (!el) return;
      const passou = condicao(el.value);
      el.classList.toggle('erro', !passou);
      if (!passou) valido = false;
    };

    checar('usr-nome',  (v) => v.trim().length > 0);
    checar('usr-login', (v) => v.trim().length > 0);
    checar('usr-perfil', (v) => v !== '');

    // Valida senha apenas na criação
    if (!_editandoId) {
      const senhasOk = _validarSenhas('usr-senha', 'usr-confirmar-senha', 'usr-aviso-senha');
      if (!senhasOk) valido = false;
    }

    return valido;
  };

  // ===== SALVAR USUÁRIO =====

  const _salvarUsuario = async () => {
    if (!_validarFormUsuario()) {
      UI.showToast('Corrija os campos em destaque.', 'aviso');
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-usuario');
    btnSalvar.disabled = true;

    const payload = {
      id:     document.getElementById('usr-id').value || null,
      nome:   document.getElementById('usr-nome').value.trim(),
      login:  document.getElementById('usr-login').value.trim().toLowerCase(),
      perfil: document.getElementById('usr-perfil').value,
      ativo:  true
    };

    // Senha só enviada na criação (hash gerado pelo backend)
    if (!_editandoId) {
      payload.senha = document.getElementById('usr-senha').value;
    }

    try {
      if (_editandoId) {
        await API.post('atualizarUsuario', payload);
        UI.showToast('Usuário atualizado com sucesso.', 'sucesso');
      } else {
        await API.post('criarUsuario', payload);
        UI.showToast('Usuário criado com sucesso.', 'sucesso');
      }
      UI.closeModal('modal-usuario');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao salvar usuário.', 'erro');
    } finally {
      btnSalvar.disabled = false;
    }
  };

  // ===== REDEFINIR SENHA =====

  const _abrirModalSenha = (id) => {
    const usuario = _dados.find((u) => u.id === id);
    if (!usuario) return;

    document.getElementById('rs-id').value             = id;
    document.getElementById('rs-nova-senha').value     = '';
    document.getElementById('rs-confirmar-senha').value = '';
    document.getElementById('rs-nome-usuario').textContent = usuario.nome;

    document.querySelectorAll('#form-senha .erro')
      .forEach((el) => el.classList.remove('erro'));

    UI.openModal('modal-senha');
  };

  const _salvarSenha = async () => {
    const senhasOk = _validarSenhas('rs-nova-senha', 'rs-confirmar-senha', null);
    if (!senhasOk) {
      UI.showToast('Verifique a nova senha: mínimo 6 caracteres e os campos devem ser iguais.', 'aviso');
      return;
    }

    const id    = document.getElementById('rs-id').value;
    const senha = document.getElementById('rs-nova-senha').value;

    const btnConfirmar = document.getElementById('btn-confirmar-senha');
    btnConfirmar.disabled = true;

    try {
      await API.post('redefinirSenha', { id, senha });
      UI.showToast('Senha redefinida com sucesso.', 'sucesso');
      UI.closeModal('modal-senha');
    } catch (err) {
      UI.showToast(err.message || 'Erro ao redefinir senha.', 'erro');
    } finally {
      btnConfirmar.disabled = false;
    }
  };

  // ===== TOGGLE ATIVO/INATIVO =====

  const _toggleUsuario = async (id, ativoStr) => {
    const estaAtivo = ativoStr === 'true';

    // Impede que o admin desative a própria conta
    const sessao = AUTH.getSessao();
    const usuario = _dados.find((u) => u.id === id);
    if (usuario && sessao && usuario.login === sessao.login && estaAtivo) {
      UI.showToast('Você não pode desativar sua própria conta.', 'aviso');
      return;
    }

    const mensagem = estaAtivo
      ? 'Deseja desativar este usuário? Ele não conseguirá mais fazer login.'
      : 'Deseja reativar este usuário?';

    const confirmado = await UI.confirm(mensagem);
    if (!confirmado) return;

    try {
      await API.post('toggleUsuario', { id, ativo: !estaAtivo });
      UI.showToast(
        `Usuário ${estaAtivo ? 'desativado' : 'reativado'} com sucesso.`,
        'sucesso'
      );
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao alterar status do usuário.', 'erro');
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
        UI.showToast('Erro ao carregar usuários.', 'erro');
        _dados = _mockUsuarios();
      }
    }
    _renderTabela(_dados);
  };

  // ===== BIND DE EVENTOS =====

  const _bindEventos = () => {
    // Botão novo
    _addListener(document.getElementById('btn-novo-usuario'), 'click', _abrirModalNovo);

    // Salvar usuário
    _addListener(document.getElementById('btn-salvar-usuario'), 'click', _salvarUsuario);
    _addListener(
      document.getElementById('form-usuario'),
      'submit',
      (e) => { e.preventDefault(); _salvarUsuario(); }
    );

    // Confirmar nova senha
    _addListener(document.getElementById('btn-confirmar-senha'), 'click', _salvarSenha);
    _addListener(
      document.getElementById('form-senha'),
      'submit',
      (e) => { e.preventDefault(); _salvarSenha(); }
    );

    // Fechar modais
    document.querySelectorAll('[data-fecha="modal-usuario"], [data-fecha="modal-senha"]')
      .forEach((btn) => {
        _addListener(btn, 'click', () => UI.closeModal(btn.dataset.fecha));
      });

    // Feedback em tempo real ao digitar confirmação de senha (modal novo)
    _addListener(document.getElementById('usr-confirmar-senha'), 'input', () => {
      const senha     = document.getElementById('usr-senha').value;
      const confirmar = document.getElementById('usr-confirmar-senha').value;
      const aviso     = document.getElementById('usr-aviso-senha');
      if (!aviso || !confirmar) return;
      aviso.textContent = confirmar && senha !== confirmar ? '⚠️ As senhas não conferem.' : '';
    });

    // Delegação na tabela — editar / senha / toggle
    const tbody = document.getElementById('tbody-usuarios');
    _addListener(tbody, 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id, ativo } = btn.dataset;
      if (action === 'editar') _abrirModalEditar(id);
      if (action === 'senha')  _abrirModalSenha(id);
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
    _dados      = [];
    _editandoId = null;
  };

  return { init, destroy };
})();
