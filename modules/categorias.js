'use strict';

const CATEGORIAS = (() => {
  const _listeners = [];
  let _dados      = [];
  let _editandoId = null;

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // Mapeamento de tipo → classe CSS do badge
  const _BADGE_TIPO = {
    Operacional:    'badge-tipo-operacional',
    Administrativo: 'badge-tipo-administrativo',
    Frota:          'badge-tipo-frota',
    RH:             'badge-tipo-rh',
    Outro:          'badge-tipo-outro'
  };

  // ===== MOCK DATA =====

  const _mockCategorias = () => [
    {
      id: 'C001',
      nome: 'Combustível',
      tipo: 'Operacional',
      /*
       * Flag `frota`: marca esta categoria como relacionada ao sistema de gestão
       * de frotas (biomassa-chaparini). Quando a integração futura for ativada,
       * os lançamentos nessa categoria serão cruzados com o módulo de
       * abastecimento da frota para evitar duplicidade e permitir análise
       * consolidada de custo por veículo. Por ora funciona apenas como marcador.
       */
      frota: true,
      observacao: 'Abastecimento de veículos e máquinas da operação.',
      ativo: true
    },
    {
      id: 'C002',
      nome: 'Manutenção de Frota',
      tipo: 'Frota',
      frota: true,
      observacao: 'Manutenções preventivas e corretivas dos veículos.',
      ativo: true
    },
    {
      id: 'C003',
      nome: 'Aluguel de Equipamentos',
      tipo: 'Frota',
      frota: true,
      observacao: 'Locação de máquinas e veículos para operação.',
      ativo: true
    },
    {
      id: 'C004',
      nome: 'Honorários Contábeis',
      tipo: 'Administrativo',
      frota: false,
      observacao: 'Serviços do escritório contábil e obrigações fiscais.',
      ativo: true
    },
    {
      id: 'C005',
      nome: 'Salários e Encargos',
      tipo: 'RH',
      frota: false,
      observacao: 'Folha de pagamento, FGTS, INSS e demais encargos trabalhistas.',
      ativo: true
    },
    {
      id: 'C006',
      nome: 'Material de Escritório',
      tipo: 'Outro',
      frota: false,
      observacao: '',
      ativo: false
    }
  ];

  // ===== ESTRUTURA HTML PRINCIPAL =====

  const _renderHtml = () => {
    const podeEditar = AUTH.isAdmin() || AUTH.isFinanceiro();

    document.getElementById('main-content').innerHTML = `
      <div class="toolbar">
        <span class="toolbar-titulo">Categorias</span>
        ${podeEditar ? `<button class="btn btn-primario" id="btn-nova-categoria">+ Nova Categoria</button>` : ''}
      </div>

      <div class="categorias-grid" id="grid-categorias">
        <!-- Cards injetados por _renderCards() -->
      </div>

      <!-- Modal: Nova / Editar Categoria -->
      <div id="modal-categoria" class="modal-overlay hidden">
        <div class="modal modal-md">
          <div class="modal-header">
            <h3 id="modal-categoria-titulo">Nova Categoria</h3>
            <button class="modal-fechar" data-fecha="modal-categoria">✕</button>
          </div>

          <div class="modal-body">
            <form id="form-categoria" novalidate>
              <input type="hidden" id="cat-id" />

              <div class="form-group">
                <label class="form-label" for="cat-nome">
                  Nome <span class="obrigatorio">*</span>
                </label>
                <input
                  id="cat-nome"
                  type="text"
                  class="form-input"
                  placeholder="Nome da categoria"
                  maxlength="60"
                  autocomplete="off"
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="cat-tipo">
                  Tipo <span class="obrigatorio">*</span>
                </label>
                <select id="cat-tipo" class="form-select">
                  <option value="">Selecione...</option>
                  <option value="Operacional">Operacional</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Frota">Frota</option>
                  <option value="RH">RH</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label frota-label">
                  <input type="checkbox" id="cat-frota" />
                  🚛 Relacionada à Frota
                </label>
                <p class="text-xs" style="color:#6c757d; margin-top:4px">
                  Marque se esta categoria será cruzada futuramente com o
                  sistema de gestão de frotas.
                </p>
              </div>

              <div class="form-group">
                <label class="form-label" for="cat-observacao">Observação</label>
                <textarea
                  id="cat-observacao"
                  class="form-textarea"
                  placeholder="Descrição ou contexto desta categoria..."
                ></textarea>
              </div>
            </form>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-categoria">Cancelar</button>
            <button class="btn btn-primario" id="btn-salvar-categoria">Salvar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ===== RENDERIZAÇÃO DOS CARDS =====

  const _renderCards = (dados) => {
    const grid = document.getElementById('grid-categorias');
    if (!grid) return;

    const podeEditar = AUTH.isAdmin() || AUTH.isFinanceiro();
    const podeToggle  = AUTH.isAdmin();

    if (!dados.length) {
      grid.innerHTML = '<p class="text-center" style="grid-column:1/-1;color:#6c757d;padding:2rem">Nenhuma categoria cadastrada.</p>';
      return;
    }

    grid.innerHTML = dados.map((cat) => {
      const badgeClasse = _BADGE_TIPO[cat.tipo] || 'badge-tipo-outro';
      const frotaTag    = cat.frota
        ? '<span class="frota-tag">🚛 Frota</span>'
        : '';
      const statusBadge = cat.ativo
        ? '<span class="badge badge-pago">Ativa</span>'
        : '<span class="badge badge-cancelado">Inativa</span>';
      const obs = cat.observacao
        ? `<p class="categoria-card-obs">${cat.observacao}</p>`
        : '';

      const labelToggle = cat.ativo ? 'Desativar' : 'Reativar';
      const iconeToggle = cat.ativo ? '🚫' : '✅';

      const btnEditar = podeEditar
        ? `<button class="btn-icone" data-action="editar" data-id="${cat.id}" title="Editar categoria">✏️</button>`
        : '';
      const btnToggle = podeToggle
        ? `<button class="btn-icone" data-action="toggle" data-id="${cat.id}" data-ativo="${cat.ativo}" title="${labelToggle}">${iconeToggle}</button>`
        : '';

      return `
        <div class="categoria-card${cat.ativo ? '' : ' inativa'}" data-id="${cat.id}">
          <div class="categoria-card-topo">
            <span class="badge badge-tipo ${badgeClasse}">${cat.tipo}</span>
            ${frotaTag}
          </div>

          <div class="categoria-card-nome">${cat.nome}</div>
          ${obs}

          <div class="categoria-card-rodape">
            ${statusBadge}
            <span class="acoes">${btnEditar}${btnToggle}</span>
          </div>
        </div>
      `;
    }).join('');
  };

  // ===== MODAL HELPERS =====

  const _limparModal = () => {
    document.getElementById('cat-id').value         = '';
    document.getElementById('cat-nome').value       = '';
    document.getElementById('cat-tipo').value       = '';
    document.getElementById('cat-frota').checked    = false;
    document.getElementById('cat-observacao').value = '';

    document.querySelectorAll('#form-categoria .erro')
      .forEach((el) => el.classList.remove('erro'));
  };

  const _abrirModalNovo = () => {
    _editandoId = null;
    _limparModal();
    document.getElementById('modal-categoria-titulo').textContent = 'Nova Categoria';
    UI.openModal('modal-categoria');
  };

  const _abrirModalEditar = (id) => {
    const registro = _dados.find((c) => c.id === id);
    if (!registro) return;

    _editandoId = id;

    document.getElementById('cat-id').value         = registro.id;
    document.getElementById('cat-nome').value       = registro.nome;
    document.getElementById('cat-tipo').value       = registro.tipo;
    document.getElementById('cat-frota').checked    = registro.frota;
    document.getElementById('cat-observacao').value = registro.observacao || '';

    document.getElementById('modal-categoria-titulo').textContent = 'Editar Categoria';
    UI.openModal('modal-categoria');
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

    checar('cat-nome', (v) => v.trim().length > 0);
    checar('cat-tipo', (v) => v !== '');

    return valido;
  };

  // ===== SALVAR =====

  const _salvarCategoria = async () => {
    if (!_validar()) {
      UI.showToast('Preencha os campos obrigatórios.', 'aviso');
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-categoria');
    btnSalvar.disabled = true;

    const payload = {
      id:         document.getElementById('cat-id').value || null,
      nome:       document.getElementById('cat-nome').value.trim(),
      tipo:       document.getElementById('cat-tipo').value,
      frota:      document.getElementById('cat-frota').checked,
      observacao: document.getElementById('cat-observacao').value.trim(),
      ativo:      true
    };

    try {
      if (_editandoId) {
        await API.post('atualizarCategoria', payload);
        UI.showToast('Categoria atualizada com sucesso.', 'sucesso');
      } else {
        await API.post('criarCategoria', payload);
        UI.showToast('Categoria criada com sucesso.', 'sucesso');
      }
      UI.closeModal('modal-categoria');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao salvar categoria.', 'erro');
    } finally {
      btnSalvar.disabled = false;
    }
  };

  // ===== TOGGLE ATIVO/INATIVO =====

  const _toggleCategoria = async (id, ativoStr) => {
    const estaAtiva = ativoStr === 'true';
    const mensagem  = estaAtiva
      ? 'Deseja desativar esta categoria? Ela não aparecerá para novos lançamentos.'
      : 'Deseja reativar esta categoria?';

    const confirmado = await UI.confirm(mensagem);
    if (!confirmado) return;

    try {
      await API.post('toggleCategoria', { id, ativo: !estaAtiva });
      UI.showToast(
        `Categoria ${estaAtiva ? 'desativada' : 'reativada'} com sucesso.`,
        'sucesso'
      );
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao alterar status da categoria.', 'erro');
    }
  };

  // ===== CARREGAMENTO =====

  const _carregarDados = async () => {
    if (!CONFIG.API_URL) {
      _dados = _mockCategorias();
      CONFIG.debug && console.log('[CATEGORIAS] modo mock');
    } else {
      try {
        _dados = await API.get('listarCategorias');
      } catch (err) {
        UI.showToast('Erro ao carregar categorias.', 'erro');
        _dados = _mockCategorias();
      }
    }
    _renderCards(_dados);
  };

  // ===== BIND DE EVENTOS =====

  const _bindEventos = () => {
    // Botão nova categoria
    _addListener(
      document.getElementById('btn-nova-categoria'),
      'click',
      _abrirModalNovo
    );

    // Botão salvar no modal
    _addListener(
      document.getElementById('btn-salvar-categoria'),
      'click',
      _salvarCategoria
    );

    // Submit via Enter no form
    _addListener(
      document.getElementById('form-categoria'),
      'submit',
      (e) => { e.preventDefault(); _salvarCategoria(); }
    );

    // Botões fechar modal
    document.querySelectorAll('[data-fecha="modal-categoria"]').forEach((btn) => {
      _addListener(btn, 'click', () => UI.closeModal('modal-categoria'));
    });

    // Delegação na grid para editar / toggle (único listener, não duplica no re-render)
    const grid = document.getElementById('grid-categorias');
    _addListener(grid, 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id, ativo } = btn.dataset;
      if (action === 'editar') _abrirModalEditar(id);
      if (action === 'toggle') _toggleCategoria(id, ativo);
    });
  };

  // ===== PUBLIC API =====

  const init = async () => {
    // ADMIN e FINANCEIRO podem gerenciar categorias; desativação é restrita ao ADMIN
    if (!AUTH.requerPerfil([CONFIG.perfis.ADMIN, CONFIG.perfis.FINANCEIRO])) return;

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
