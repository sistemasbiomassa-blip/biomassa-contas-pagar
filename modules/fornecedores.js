'use strict';

const FORNECEDORES = (() => {
  const _listeners = [];
  let _dados       = [];
  let _categorias  = [];
  let _editandoId  = null; // null = novo registro, string = ID sendo editado

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // ===== MOCK DATA =====

  const _mockFornecedores = () => [
    {
      id: 'F001',
      nome: 'Posto São João',
      tipo: 'PJ',
      documento: '12.345.678/0001-90',
      telefone: '(67) 99123-4567',
      email: 'contato@postosaojao.com.br',
      categoriaPadrao: 'Combustível',
      observacao: 'Fornecedor principal de combustível da frota.',
      ativo: true
    },
    {
      id: 'F002',
      nome: 'Mecânica Central',
      tipo: 'PJ',
      documento: '98.765.432/0001-10',
      telefone: '(67) 3321-5678',
      email: 'mecanicacentral@email.com',
      categoriaPadrao: 'Manutenção',
      observacao: '',
      ativo: true
    },
    {
      id: 'F003',
      nome: 'Escritório Contábil XYZ',
      tipo: 'PJ',
      documento: '55.444.333/0001-22',
      telefone: '(67) 3345-6789',
      email: 'contato@contabilxyz.com.br',
      categoriaPadrao: 'Administrativo',
      observacao: 'Responsável pela contabilidade mensal e obrigações fiscais.',
      ativo: true
    },
    {
      id: 'F004',
      nome: 'Maria da Silva',
      tipo: 'PF',
      documento: '123.456.789-00',
      telefone: '(67) 98765-4321',
      email: 'maria.silva@email.com',
      categoriaPadrao: 'RH',
      observacao: 'Prestadora de serviços. Contrato encerrado em 03/2025.',
      ativo: false
    }
  ];

  const _mockCategorias = () => [
    { id: 'C001', nome: 'Combustível' },
    { id: 'C002', nome: 'Manutenção' },
    { id: 'C003', nome: 'Administrativo' },
    { id: 'C004', nome: 'Impostos' },
    { id: 'C005', nome: 'RH' },
    { id: 'C006', nome: 'Frota' },
    { id: 'C007', nome: 'Outro' }
  ];

  // ===== MÁSCARAS DE DOCUMENTO =====

  const _mascararCPF = (v) => {
    v = v.replace(/\D/g, '').slice(0, 11);
    return v
      .replace(/(\d{3})(\d)/,           '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/,  '$1.$2.$3')
      .replace(/\.(\d{3})\.(\d{3})(\d)/, (m, a, b, c) => `.${a}.${b}-${c}`);
  };

  const _mascararCNPJ = (v) => {
    v = v.replace(/\D/g, '').slice(0, 14);
    return v
      .replace(/^(\d{2})(\d)/,              '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/,     '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/,             '.$1/$2')
      .replace(/(\d{4})(\d)/,               '$1-$2');
  };

  const _aplicarMascara = (input, tipo) => {
    input.value = tipo === 'PF'
      ? _mascararCPF(input.value)
      : _mascararCNPJ(input.value);
  };

  // ===== ESTRUTURA HTML =====

  const _renderHtml = () => {
    const podeEditar = AUTH.isAdmin() || AUTH.isFinanceiro();

    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <span class="toolbar-titulo">Fornecedores</span>

        <input
          type="search"
          id="busca-fornecedores"
          class="form-input toolbar-busca"
          placeholder="Buscar por nome ou documento..."
          autocomplete="off"
        />

        ${podeEditar ? `
          <button class="btn btn-primario" id="btn-novo-fornecedor">+ Novo Fornecedor</button>
        ` : ''}
      </div>

      <div class="card">
        <div class="tabela-container">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Documento</th>
                <th>Telefone</th>
                <th>Categoria Padrão</th>
                <th class="text-center">Status</th>
                <th class="text-center">Ações</th>
              </tr>
            </thead>
            <tbody id="tbody-fornecedores"></tbody>
          </table>
        </div>
      </div>

      <!-- Modal: Novo / Editar Fornecedor -->
      <div id="modal-fornecedor" class="modal-overlay hidden">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 id="modal-fornecedor-titulo">Novo Fornecedor</h3>
            <button class="modal-fechar" data-fecha="modal-fornecedor">✕</button>
          </div>

          <div class="modal-body">
            <form id="form-fornecedor" novalidate>
              <input type="hidden" id="forn-id" />

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="forn-nome">
                    Nome <span class="obrigatorio">*</span>
                  </label>
                  <input
                    id="forn-nome"
                    type="text"
                    class="form-input"
                    placeholder="Nome do fornecedor"
                    maxlength="100"
                    autocomplete="off"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="forn-tipo">
                    Tipo <span class="obrigatorio">*</span>
                  </label>
                  <select id="forn-tipo" class="form-select">
                    <option value="">Selecione...</option>
                    <option value="PJ">PJ — Pessoa Jurídica</option>
                    <option value="PF">PF — Pessoa Física</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="forn-documento">CPF / CNPJ</label>
                  <input
                    id="forn-documento"
                    type="text"
                    class="form-input"
                    placeholder="Selecione o Tipo primeiro"
                    maxlength="18"
                    autocomplete="off"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label" for="forn-telefone">Telefone</label>
                  <input
                    id="forn-telefone"
                    type="text"
                    class="form-input"
                    placeholder="(00) 00000-0000"
                    maxlength="15"
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="forn-email">E-mail</label>
                <input
                  id="forn-email"
                  type="email"
                  class="form-input"
                  placeholder="email@dominio.com.br"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="forn-categoria">Categoria Padrão</label>
                <select id="forn-categoria" class="form-select">
                  <option value="">Nenhuma</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label" for="forn-observacao">Observação</label>
                <textarea
                  id="forn-observacao"
                  class="form-textarea"
                  placeholder="Informações adicionais sobre o fornecedor..."
                ></textarea>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-fornecedor">Cancelar</button>
            <button class="btn btn-primario" id="btn-salvar-fornecedor">Salvar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ===== RENDERIZAÇÃO DA TABELA =====

  const _renderTabela = (dados) => {
    const podeEditar = AUTH.isAdmin() || AUTH.isFinanceiro();
    const isAdmin    = AUTH.isAdmin();

    UI.renderTable('tbody-fornecedores', dados, [
      { key: 'nome',      label: 'Nome' },
      { key: 'tipo',      label: 'Tipo' },
      { key: 'documento', label: 'Documento', formato: (v) => v || '—' },
      { key: 'telefone',  label: 'Telefone',  formato: (v) => v || '—' },
      {
        key: 'categoriaPadrao',
        label: 'Categoria Padrão',
        formato: (v) => v || '—'
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
          const btnEditar = podeEditar
            ? `<button class="btn-icone" data-action="editar" data-id="${id}" title="Editar fornecedor">✏️</button>`
            : '';

          const labelToggle = linha.ativo ? 'Desativar' : 'Reativar';
          const iconeToggle = linha.ativo ? '🚫' : '✅';
          const btnToggle   = isAdmin
            ? `<button class="btn-icone" data-action="toggle" data-id="${id}" data-ativo="${linha.ativo}" title="${labelToggle}">${iconeToggle}</button>`
            : '';

          return `<span class="acoes">${btnEditar}${btnToggle}</span>`;
        }
      }
    ]);
  };

  // ===== FILTRO / BUSCA =====

  const _filtrar = () => {
    const termo = (document.getElementById('busca-fornecedores')?.value || '')
      .toLowerCase()
      .trim();

    const filtrados = termo
      ? _dados.filter((f) =>
          f.nome.toLowerCase().includes(termo) ||
          (f.documento || '').replace(/\D/g, '').includes(termo.replace(/\D/g, '')) ||
          (f.documento || '').toLowerCase().includes(termo)
        )
      : _dados;

    _renderTabela(filtrados);
  };

  // ===== MODAL HELPERS =====

  const _populaSelectCategorias = () => {
    const sel = document.getElementById('forn-categoria');
    if (!sel) return;
    sel.innerHTML = '<option value="">Nenhuma</option>';
    _categorias.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value       = cat.nome;
      opt.textContent = cat.nome;
      sel.appendChild(opt);
    });
  };

  const _limparModal = () => {
    ['forn-id', 'forn-nome', 'forn-documento', 'forn-telefone', 'forn-email', 'forn-observacao']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });

    const tipo = document.getElementById('forn-tipo');
    if (tipo) tipo.value = '';

    const cat = document.getElementById('forn-categoria');
    if (cat) cat.value = '';

    // Remove marcações de erro anteriores
    document.querySelectorAll('#form-fornecedor .erro')
      .forEach((el) => el.classList.remove('erro'));

    // Reseta placeholder do documento
    const docInput = document.getElementById('forn-documento');
    if (docInput) docInput.placeholder = 'Selecione o Tipo primeiro';
  };

  const _abrirModalNovo = () => {
    _editandoId = null;
    _limparModal();
    _populaSelectCategorias();
    document.getElementById('modal-fornecedor-titulo').textContent = 'Novo Fornecedor';
    UI.openModal('modal-fornecedor');
  };

  const _abrirModalEditar = (id) => {
    const registro = _dados.find((f) => f.id === id);
    if (!registro) return;

    _editandoId = id;
    _populaSelectCategorias();

    document.getElementById('forn-id').value          = registro.id;
    document.getElementById('forn-nome').value        = registro.nome;
    document.getElementById('forn-tipo').value        = registro.tipo;
    document.getElementById('forn-documento').value   = registro.documento  || '';
    document.getElementById('forn-telefone').value    = registro.telefone   || '';
    document.getElementById('forn-email').value       = registro.email      || '';
    document.getElementById('forn-categoria').value   = registro.categoriaPadrao || '';
    document.getElementById('forn-observacao').value  = registro.observacao || '';

    // Atualiza placeholder conforme tipo carregado
    const docInput = document.getElementById('forn-documento');
    if (docInput) {
      docInput.placeholder = registro.tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00';
    }

    document.getElementById('modal-fornecedor-titulo').textContent = 'Editar Fornecedor';
    UI.openModal('modal-fornecedor');
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

    checar('forn-nome', (v) => v.trim().length > 0);
    checar('forn-tipo', (v) => v !== '');

    return valido;
  };

  // ===== SALVAR =====

  const _salvarFornecedor = async () => {
    if (!_validar()) {
      UI.showToast('Preencha os campos obrigatórios.', 'aviso');
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-fornecedor');
    btnSalvar.disabled = true;

    const payload = {
      id:              document.getElementById('forn-id').value || null,
      nome:            document.getElementById('forn-nome').value.trim(),
      tipo:            document.getElementById('forn-tipo').value,
      documento:       document.getElementById('forn-documento').value,
      telefone:        document.getElementById('forn-telefone').value,
      email:           document.getElementById('forn-email').value.trim(),
      categoriaPadrao: document.getElementById('forn-categoria').value,
      observacao:      document.getElementById('forn-observacao').value.trim(),
      ativo:           true
    };

    try {
      if (_editandoId) {
        await API.post('atualizarFornecedor', payload);
        UI.showToast('Fornecedor atualizado com sucesso.', 'sucesso');
      } else {
        await API.post('criarFornecedor', payload);
        UI.showToast('Fornecedor cadastrado com sucesso.', 'sucesso');
      }
      UI.closeModal('modal-fornecedor');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao salvar fornecedor.', 'erro');
    } finally {
      btnSalvar.disabled = false;
    }
  };

  // ===== TOGGLE ATIVO/INATIVO =====

  const _toggleFornecedor = async (id, ativoStr) => {
    // data-ativo vem como string do dataset
    const estaAtivo = ativoStr === 'true';
    const acao = estaAtivo ? 'desativar' : 'reativar';

    const mensagem = estaAtivo
      ? 'Deseja desativar este fornecedor? Ele não aparecerá para seleção em novos lançamentos.'
      : 'Deseja reativar este fornecedor?';

    const confirmado = await UI.confirm(mensagem);
    if (!confirmado) return;

    try {
      await API.post('toggleFornecedor', { id, ativo: !estaAtivo });
      UI.showToast(
        `Fornecedor ${estaAtivo ? 'desativado' : 'reativado'} com sucesso.`,
        'sucesso'
      );
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao alterar status do fornecedor.', 'erro');
    }
  };

  // ===== CARREGAMENTO =====

  const _carregarDados = async () => {
    if (!CONFIG.API_URL) {
      _dados      = _mockFornecedores();
      _categorias = _mockCategorias();
      CONFIG.debug && console.log('[FORNECEDORES] modo mock');
    } else {
      try {
        // Carrega fornecedores e categorias em paralelo
        [_dados, _categorias] = await Promise.all([
          API.get('listarFornecedores'),
          API.get('listarCategorias')
        ]);
      } catch (err) {
        UI.showToast('Erro ao carregar fornecedores.', 'erro');
        _dados      = _mockFornecedores();
        _categorias = _mockCategorias();
      }
    }
    _filtrar();
  };

  // ===== BIND DE EVENTOS =====

  const _bindEventos = () => {
    // Busca em tempo real
    _addListener(
      document.getElementById('busca-fornecedores'),
      'input',
      _filtrar
    );

    // Botão "Novo Fornecedor"
    _addListener(
      document.getElementById('btn-novo-fornecedor'),
      'click',
      _abrirModalNovo
    );

    // Botão salvar no modal
    _addListener(
      document.getElementById('btn-salvar-fornecedor'),
      'click',
      _salvarFornecedor
    );

    // Submit via Enter dentro do formulário
    _addListener(
      document.getElementById('form-fornecedor'),
      'submit',
      (e) => { e.preventDefault(); _salvarFornecedor(); }
    );

    // Botões de fechar modal (data-fecha)
    document.querySelectorAll('[data-fecha="modal-fornecedor"]').forEach((btn) => {
      _addListener(btn, 'click', () => UI.closeModal('modal-fornecedor'));
    });

    // Mudança de Tipo → atualiza placeholder e limpa documento
    const tipoSel  = document.getElementById('forn-tipo');
    const docInput = document.getElementById('forn-documento');
    _addListener(tipoSel, 'change', () => {
      docInput.value       = '';
      docInput.placeholder = tipoSel.value === 'PF' ? '000.000.000-00' : '00.000.000/0000-00';
    });

    // Aplica máscara ao digitar no campo de documento
    _addListener(docInput, 'input', () => _aplicarMascara(docInput, tipoSel.value));

    // Delegação na tabela para editar / toggle (evita re-registro a cada render)
    const tbody = document.getElementById('tbody-fornecedores');
    _addListener(tbody, 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id, ativo } = btn.dataset;
      if (action === 'editar') _abrirModalEditar(id);
      if (action === 'toggle') _toggleFornecedor(id, ativo);
    });
  };

  // ===== PUBLIC API =====

  const init = async () => {
    // DIRETOR só visualiza; ADMIN e FINANCEIRO podem editar
    if (!AUTH.requerPerfil([CONFIG.perfis.ADMIN, CONFIG.perfis.DIRETOR, CONFIG.perfis.FINANCEIRO])) return;

    _renderHtml();
    _bindEventos();
    await _carregarDados();
  };

  const destroy = () => {
    _listeners.forEach(({ el, tipo, fn }) => el.removeEventListener(tipo, fn));
    _listeners.length = 0;
    _dados      = [];
    _categorias = [];
    _editandoId = null;
  };

  return { init, destroy };
})();
