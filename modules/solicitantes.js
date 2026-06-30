'use strict';

const SOLICITANTES = (() => {
  const _listeners = [];
  let _dados      = [];
  let _editandoId = null; // null = novo registro, string = ID sendo editado

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // ===== MOCK DATA =====

  const _mockSolicitantes = () => [
    {
      id: 'SL001',
      nome: 'Ana Paula Santos',
      departamento: 'Operações',
      cargo: 'Gerente Operacional',
      email: 'ana@biomassa.com',
      telefone: '(66) 99901-0001',
      ativo: true
    },
    {
      id: 'SL002',
      nome: 'Carlos Eduardo',
      departamento: 'Manutenção',
      cargo: 'Supervisor',
      email: 'carlos@biomassa.com',
      telefone: '(66) 99901-0002',
      ativo: true
    },
    {
      id: 'SL003',
      nome: 'Beatriz Rocha',
      departamento: 'Administrativo',
      cargo: 'Analista Financeiro',
      email: 'beatriz@biomassa.com',
      telefone: '',
      ativo: true
    }
  ];

  // ===== ESTRUTURA HTML =====

  const _renderHtml = () => {
    const podeEditar = AUTH.isAdmin() || AUTH.isFinanceiro();

    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <span class="toolbar-titulo">Solicitantes</span>

        <input
          type="search"
          id="busca-solicitantes"
          class="form-input toolbar-busca"
          placeholder="Buscar por nome, departamento ou cargo..."
          autocomplete="off"
        />

        <span id="sol-count" class="toolbar-count"></span>

        ${podeEditar ? `
          <button class="btn btn-primario" id="btn-novo-solicitante">+ Novo Solicitante</button>
        ` : ''}
      </div>

      <div class="card">
        <div class="tabela-container">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Departamento</th>
                <th>Cargo</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th class="text-center">Status</th>
                <th class="text-center">Ações</th>
              </tr>
            </thead>
            <tbody id="tbody-solicitantes"></tbody>
          </table>
        </div>
      </div>

      <!-- Modal: Novo / Editar Solicitante -->
      <div id="modal-solicitante" class="modal-overlay hidden">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 id="modal-solicitante-titulo">Novo Solicitante</h3>
            <button class="modal-fechar" data-fecha="modal-solicitante">✕</button>
          </div>

          <div class="modal-body">
            <form id="form-solicitante" novalidate>
              <input type="hidden" id="sol-id" />

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="sol-nome">
                    Nome <span class="obrigatorio">*</span>
                  </label>
                  <input
                    id="sol-nome"
                    type="text"
                    class="form-input"
                    placeholder="Nome do solicitante"
                    maxlength="100"
                    autocomplete="off"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="sol-departamento">Departamento</label>
                  <input
                    id="sol-departamento"
                    type="text"
                    class="form-input"
                    placeholder="Ex.: Operações"
                    maxlength="80"
                    autocomplete="off"
                  />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="sol-cargo">Cargo</label>
                  <input
                    id="sol-cargo"
                    type="text"
                    class="form-input"
                    placeholder="Ex.: Supervisor"
                    maxlength="80"
                    autocomplete="off"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="sol-telefone">Telefone</label>
                  <input
                    id="sol-telefone"
                    type="text"
                    class="form-input"
                    placeholder="(00) 00000-0000"
                    maxlength="15"
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="sol-email">E-mail</label>
                <input
                  id="sol-email"
                  type="email"
                  class="form-input"
                  placeholder="email@biomassa.com"
                />
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-solicitante">Cancelar</button>
            <button class="btn btn-primario" id="btn-salvar-solicitante">Salvar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ===== RENDERIZAÇÃO DA TABELA =====

  const _renderTabela = (dados) => {
    const podeEditar = AUTH.isAdmin() || AUTH.isFinanceiro();
    const podeToggle  = AUTH.isAdmin();

    const countEl = document.getElementById('sol-count');
    if (countEl) {
      countEl.textContent = dados.length === 1
        ? '1 solicitante'
        : `${dados.length} solicitantes`;
    }

    UI.renderTable('tbody-solicitantes', dados, [
      { key: 'nome',         label: 'Nome' },
      { key: 'departamento', label: 'Departamento', formato: (v) => v || '—' },
      { key: 'cargo',        label: 'Cargo',        formato: (v) => v || '—' },
      { key: 'email',        label: 'E-mail',       formato: (v) => v || '—' },
      { key: 'telefone',     label: 'Telefone',     formato: (v) => v || '—' },
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
          const btnEditar = podeEditar
            ? `<button class="btn-icone" data-action="editar" data-id="${id}" title="Editar solicitante">✏️</button>`
            : '';

          const labelToggle = linha.ativo ? 'Desativar' : 'Reativar';
          const iconeToggle = linha.ativo ? '🚫' : '✅';
          const btnToggle   = podeToggle
            ? `<button class="btn-icone" data-action="toggle" data-id="${id}" data-ativo="${linha.ativo}" title="${labelToggle}">${iconeToggle}</button>`
            : '';

          return `<span class="acoes">${btnEditar}${btnToggle}</span>`;
        }
      }
    ]);
  };

  // ===== FILTRO / BUSCA =====

  const _filtrar = () => {
    const termo = (document.getElementById('busca-solicitantes')?.value || '')
      .toLowerCase()
      .trim();

    const filtrados = termo
      ? _dados.filter((s) =>
          s.nome.toLowerCase().includes(termo) ||
          (s.departamento || '').toLowerCase().includes(termo) ||
          (s.cargo || '').toLowerCase().includes(termo)
        )
      : _dados;

    _renderTabela(filtrados);
  };

  // ===== MODAL HELPERS =====

  const _limparModal = () => {
    ['sol-id', 'sol-nome', 'sol-departamento', 'sol-cargo', 'sol-email', 'sol-telefone']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });

    document.querySelectorAll('#form-solicitante .erro')
      .forEach((el) => el.classList.remove('erro'));
  };

  const _abrirModalNovo = () => {
    _editandoId = null;
    _limparModal();
    document.getElementById('modal-solicitante-titulo').textContent = 'Novo Solicitante';
    UI.openModal('modal-solicitante');
  };

  const _abrirModalEditar = (id) => {
    const registro = _dados.find((s) => s.id === id);
    if (!registro) return;

    _editandoId = id;

    document.getElementById('sol-id').value            = registro.id;
    document.getElementById('sol-nome').value          = registro.nome;
    document.getElementById('sol-departamento').value  = registro.departamento || '';
    document.getElementById('sol-cargo').value         = registro.cargo        || '';
    document.getElementById('sol-email').value         = registro.email        || '';
    document.getElementById('sol-telefone').value      = registro.telefone     || '';

    document.getElementById('modal-solicitante-titulo').textContent = 'Editar Solicitante';
    UI.openModal('modal-solicitante');
  };

  // ===== VALIDAÇÃO =====

  const _validar = () => {
    let valido = true;

    const checar = (id, condicao) => {
      const el = document.getElementById(id);
      if (!el) return;
      const passou = condicao(el.value);
      el.classList.toggle('erro', !passou);
      if (!passou) valido = false;
    };

    checar('sol-nome', (v) => v.trim().length > 0);

    return valido;
  };

  // ===== SALVAR =====

  const _salvarSolicitante = async () => {
    if (!_validar()) {
      UI.showToast('Preencha os campos obrigatórios.', 'aviso');
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-solicitante');
    btnSalvar.disabled = true;

    const payload = {
      id:           document.getElementById('sol-id').value || null,
      nome:         document.getElementById('sol-nome').value.trim(),
      departamento: document.getElementById('sol-departamento').value.trim(),
      cargo:        document.getElementById('sol-cargo').value.trim(),
      email:        document.getElementById('sol-email').value.trim(),
      telefone:     document.getElementById('sol-telefone').value,
      ativo:        true
    };

    try {
      if (_editandoId) {
        await API.post('atualizarSolicitante', payload);
        UI.showToast('Solicitante atualizado com sucesso.', 'sucesso');
      } else {
        await API.post('criarSolicitante', payload);
        UI.showToast('Solicitante criado com sucesso.', 'sucesso');
      }
      UI.closeModal('modal-solicitante');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao salvar solicitante.', 'erro');
    } finally {
      btnSalvar.disabled = false;
    }
  };

  // ===== TOGGLE ATIVO/INATIVO =====

  const _toggleSolicitante = async (id, ativoStr) => {
    // data-ativo vem como string do dataset
    const estaAtivo = ativoStr === 'true';

    const mensagem = estaAtivo
      ? 'Deseja desativar este solicitante?'
      : 'Deseja reativar este solicitante?';

    const confirmado = await UI.confirm(mensagem);
    if (!confirmado) return;

    try {
      await API.post('toggleSolicitante', { id, ativo: !estaAtivo });
      UI.showToast('Status atualizado.', 'sucesso');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao alterar status do solicitante.', 'erro');
    }
  };

  // ===== CARREGAMENTO =====

  const _carregarDados = async () => {
    if (!CONFIG.API_URL) {
      _dados = _mockSolicitantes();
      CONFIG.debug && console.log('[SOLICITANTES] modo mock');
    } else {
      try {
        _dados = await API.get('listarSolicitantes');
      } catch (err) {
        UI.showToast('Erro ao carregar solicitantes.', 'erro');
        _dados = _mockSolicitantes();
      }
    }
    _filtrar();
  };

  // ===== BIND DE EVENTOS =====

  const _bindEventos = () => {
    _addListener(
      document.getElementById('busca-solicitantes'),
      'input',
      _filtrar
    );

    _addListener(
      document.getElementById('btn-novo-solicitante'),
      'click',
      _abrirModalNovo
    );

    _addListener(
      document.getElementById('btn-salvar-solicitante'),
      'click',
      _salvarSolicitante
    );

    _addListener(
      document.getElementById('form-solicitante'),
      'submit',
      (e) => { e.preventDefault(); _salvarSolicitante(); }
    );

    document.querySelectorAll('[data-fecha="modal-solicitante"]').forEach((btn) => {
      _addListener(btn, 'click', () => UI.closeModal('modal-solicitante'));
    });

    // Delegação na tabela para editar / toggle (evita re-registro a cada render)
    const tbody = document.getElementById('tbody-solicitantes');
    _addListener(tbody, 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id, ativo } = btn.dataset;
      if (action === 'editar') _abrirModalEditar(id);
      if (action === 'toggle') _toggleSolicitante(id, ativo);
    });
  };

  // ===== PUBLIC API =====

  const init = async () => {
    if (!AUTH.requerPerfil([CONFIG.perfis.ADMIN, CONFIG.perfis.DIRETOR, CONFIG.perfis.FINANCEIRO])) return;

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
