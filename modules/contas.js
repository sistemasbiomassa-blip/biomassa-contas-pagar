'use strict';

const CONTAS = (() => {
  const _listeners   = [];
  let _dados         = [];
  let _filtrados     = [];
  let _fornecedores  = [];
  let _categorias    = [];
  let _solicitantes  = [];
  let _editandoId    = null;

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // ===== STATUS =====

  const _calcularStatus = (conta) => {
    if (conta.dataPagamento) return CONFIG.statusConta.PAGO;
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const venc = new Date(conta.vencimento + 'T00:00:00');
    if (venc < hoje)                      return CONFIG.statusConta.VENCIDO;
    if (venc.getTime() === hoje.getTime()) return 'Vence Hoje';
    return CONFIG.statusConta.PENDENTE;
  };

  const _badgeStatus = (status) => {
    const mapa = {
      [CONFIG.statusConta.PAGO]:    'badge-pago',
      [CONFIG.statusConta.VENCIDO]: 'badge-vencido',
      'Vence Hoje':                  'badge-atencao',
      [CONFIG.statusConta.PENDENTE]: 'badge-pendente'
    };
    return `<span class="badge ${mapa[status] || 'badge-pendente'}">${status}</span>`;
  };

  // ===== MOCK DATA =====

  const _mockContas = () => {
    const hoje = new Date();
    const fmt  = (d) => d.toISOString().split('T')[0];
    const add  = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const mes  = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return [
      { id: 'CT001', fornecedor: 'Mecânica Central',        categoria: 'Manutenção',     solicitante: 'Carlos Eduardo',   descricao: 'Troca de pneus dianteiros — cam. 02', valor: 1100.00, vencimento: fmt(add(hoje,-8)),  competencia: mes(add(hoje,-8)),  dataPagamento: '',              formaPagamento: '', numDocumento: 'NF-1234', observacao: '',                         usuario: 'admin',      dataRegistro: fmt(add(hoje,-15)) },
      { id: 'CT002', fornecedor: 'Escritório Contábil XYZ', categoria: 'Administrativo', solicitante: 'Ana Paula Santos', descricao: 'Honorários contábeis — mês anterior',  valor: 1500.00, vencimento: fmt(add(hoje,-3)),  competencia: mes(add(hoje,-3)),  dataPagamento: '',              formaPagamento: '', numDocumento: '',        observacao: '',                         usuario: 'financeiro', dataRegistro: fmt(add(hoje,-10)) },
      { id: 'CT003', fornecedor: 'Posto São João',          categoria: 'Combustível',    solicitante: 'Carlos Eduardo',   descricao: 'Abastecimento frota — semana 23',      valor: 850.00,  vencimento: fmt(hoje),          competencia: mes(hoje),          dataPagamento: '',              formaPagamento: '', numDocumento: 'NF-5678', observacao: '',                         usuario: 'financeiro', dataRegistro: fmt(add(hoje,-7))  },
      { id: 'CT004', fornecedor: 'Posto São João',          categoria: 'Combustível',    solicitante: 'Carlos Eduardo',   descricao: 'Abastecimento frota — semana 24',      valor: 920.00,  vencimento: fmt(add(hoje,5)),   competencia: mes(hoje),          dataPagamento: '',              formaPagamento: '', numDocumento: '',        observacao: '',                         usuario: 'financeiro', dataRegistro: fmt(add(hoje,-2))  },
      { id: 'CT005', fornecedor: 'Mecânica Central',        categoria: 'Manutenção',     solicitante: 'Ana Paula Santos', descricao: 'Revisão 50.000 km — cam. 03',          valor: 2200.00, vencimento: fmt(add(hoje,10)),  competencia: mes(hoje),          dataPagamento: '',              formaPagamento: '', numDocumento: 'OS-0891', observacao: 'Incluir troca de filtros', usuario: 'admin',      dataRegistro: fmt(add(hoje,-1))  },
      { id: 'CT006', fornecedor: 'Escritório Contábil XYZ', categoria: 'Administrativo', solicitante: 'Beatriz Rocha',    descricao: 'DARF IRPJ — 2º trimestre',             valor: 3800.00, vencimento: fmt(add(hoje,18)),  competencia: mes(hoje),          dataPagamento: '',              formaPagamento: '', numDocumento: '',        observacao: '',                         usuario: 'admin',      dataRegistro: fmt(hoje)          },
      { id: 'CT007', fornecedor: 'Posto São João',          categoria: 'Combustível',    solicitante: 'Carlos Eduardo',   descricao: 'Abastecimento frota — semana 22',      valor: 780.00,  vencimento: fmt(add(hoje,-12)), competencia: mes(add(hoje,-12)), dataPagamento: fmt(add(hoje,-12)), formaPagamento: 'PIX',           numDocumento: '', observacao: '', usuario: 'financeiro', dataRegistro: fmt(add(hoje,-18)) },
      { id: 'CT008', fornecedor: 'Mecânica Central',        categoria: 'Manutenção',     solicitante: 'Ana Paula Santos', descricao: 'Manutenção preventiva — frota',        valor: 1800.00, vencimento: fmt(add(hoje,-10)), competencia: mes(add(hoje,-10)), dataPagamento: fmt(add(hoje,-10)), formaPagamento: 'Transferência', numDocumento: 'NF-1105', observacao: '', usuario: 'admin', dataRegistro: fmt(add(hoje,-20)) },
      { id: 'CT009', fornecedor: 'Escritório Contábil XYZ', categoria: 'Administrativo', solicitante: 'Beatriz Rocha',    descricao: 'Honorários contábeis — 2 meses atrás', valor: 1500.00, vencimento: fmt(add(hoje,-35)), competencia: mes(add(hoje,-35)), dataPagamento: fmt(add(hoje,-35)), formaPagamento: 'Transferência', numDocumento: '', observacao: '', usuario: 'financeiro', dataRegistro: fmt(add(hoje,-42)) },
      { id: 'CT010', fornecedor: 'Posto São João',          categoria: 'Combustível',    solicitante: 'Carlos Eduardo',   descricao: 'Abastecimento frota — semana 20',      valor: 650.00,  vencimento: fmt(add(hoje,-25)), competencia: mes(add(hoje,-25)), dataPagamento: fmt(add(hoje,-24)), formaPagamento: 'PIX',           numDocumento: '', observacao: '', usuario: 'financeiro', dataRegistro: fmt(add(hoje,-30)) }
    ];
  };

  const _mockFornecedores  = () => [
    { id: 'F001', nome: 'Posto São João',          ativo: true },
    { id: 'F002', nome: 'Mecânica Central',        ativo: true },
    { id: 'F003', nome: 'Escritório Contábil XYZ', ativo: true }
  ];

  const _mockCategorias = () => [
    { id: 'C001', nome: 'Combustível',    ativo: true },
    { id: 'C002', nome: 'Manutenção',     ativo: true },
    { id: 'C003', nome: 'Administrativo', ativo: true },
    { id: 'C004', nome: 'Impostos',       ativo: true },
    { id: 'C005', nome: 'RH',             ativo: true }
  ];

  const _mockSolicitantes = () => [
    { id: 'SL001', nome: 'Ana Paula Santos', ativo: true },
    { id: 'SL002', nome: 'Carlos Eduardo',   ativo: true },
    { id: 'SL003', nome: 'Beatriz Rocha',    ativo: true }
  ];

  // ===== MÁSCARA MONETÁRIA =====

  const _mascaraMoeda = (input) => {
    let v = input.value.replace(/\D/g, '');
    if (!v) { input.value = ''; return; }
    const num = parseInt(v, 10) / 100;
    input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const _parseMoeda = (str) =>
    parseFloat((str || '0').replace(/\./g, '').replace(',', '.')) || 0;

  // ===== HTML =====

  const _renderHtml = () => {
    const podeNovo = AUTH.isAdmin() || AUTH.isFinanceiro();

    document.getElementById('main-content').innerHTML = `
      <!-- Filtros -->
      <div class="filtros-form" id="painel-filtros">
        <div class="form-group">
          <label class="form-label">Vencimento de</label>
          <input type="date" id="filtro-data-inicio" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">até</label>
          <input type="date" id="filtro-data-fim" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Fornecedor</label>
          <select id="filtro-fornecedor" class="form-select">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select id="filtro-categoria" class="form-select">
            <option value="">Todas</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Solicitante</label>
          <select id="filtro-solicitante" class="form-select">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select id="filtro-status" class="form-select">
            <option value="">Todos</option>
            <option value="Pendente">Pendente</option>
            <option value="Vence Hoje">Vence Hoje</option>
            <option value="Vencido">Vencido</option>
            <option value="Pago">Pago</option>
          </select>
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-secundario" id="btn-limpar-filtros">Limpar</button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <span class="toolbar-titulo" id="contas-subtitulo"></span>
        <button class="btn btn-secundario" id="btn-pdf-contas">⬇️ PDF</button>
        ${podeNovo ? `<button class="btn btn-primario" id="btn-nova-conta">+ Nova Conta</button>` : ''}
      </div>

      <!-- Tabela -->
      <div class="card">
        <div class="tabela-container">
          <table class="tabela-padrao" id="tabela-contas">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Categoria</th>
                <th>Solicitante</th>
                <th>Descrição</th>
                <th class="text-right">Valor</th>
                <th>Vencimento</th>
                <th class="text-center">Status</th>
                <th class="text-center">Ações</th>
              </tr>
            </thead>
            <tbody id="tbody-contas"></tbody>
            <tfoot id="tfoot-contas"></tfoot>
          </table>
        </div>
      </div>

      <!-- Modal: Nova / Editar Conta -->
      <div id="modal-conta" class="modal-overlay hidden">
        <div class="modal modal-lg">
          <div class="modal-header">
            <h3 id="modal-conta-titulo">Nova Conta</h3>
            <button class="modal-fechar" data-fecha="modal-conta">✕</button>
          </div>
          <div class="modal-body">
            <form id="form-conta" novalidate>
              <input type="hidden" id="ct-id" />

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="ct-fornecedor">Fornecedor <span class="obrigatorio">*</span></label>
                  <select id="ct-fornecedor" class="form-select"><option value="">Selecione...</option></select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="ct-categoria">Categoria <span class="obrigatorio">*</span></label>
                  <select id="ct-categoria" class="form-select"><option value="">Selecione...</option></select>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="ct-solicitante">Solicitante</label>
                <select id="ct-solicitante" class="form-select"><option value="">— Selecione —</option></select>
              </div>

              <div class="form-group">
                <label class="form-label" for="ct-descricao">Descrição <span class="obrigatorio">*</span></label>
                <input id="ct-descricao" type="text" class="form-input" placeholder="Descrição da despesa" maxlength="120" autocomplete="off" />
              </div>

              <!-- Tipo de pagamento — oculto ao editar -->
              <div class="form-group" id="bloco-tipo-pag">
                <label class="form-label">Tipo de Pagamento</label>
                <div class="tipo-pag-toggle">
                  <label class="tipo-pag-opcao">
                    <input type="radio" name="ct-tipo" value="avista" checked /> À Vista
                  </label>
                  <label class="tipo-pag-opcao">
                    <input type="radio" name="ct-tipo" value="parcelada" /> Parcelada
                  </label>
                </div>
              </div>

              <!-- Bloco À Vista -->
              <div id="bloco-avista">
                <div class="form-row-3">
                  <div class="form-group">
                    <label class="form-label" for="ct-valor">Valor (R$) <span class="obrigatorio">*</span></label>
                    <input id="ct-valor" type="text" class="form-input" placeholder="0,00" inputmode="numeric" autocomplete="off" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="ct-vencimento">Vencimento <span class="obrigatorio">*</span></label>
                    <input id="ct-vencimento" type="date" class="form-input" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="ct-competencia">Competência</label>
                    <input id="ct-competencia" type="month" class="form-input" />
                  </div>
                </div>
              </div>

              <!-- Bloco Parcelada -->
              <div id="bloco-parcelamento" class="bloco-parcelamento hidden">
                <div class="form-row-3">
                  <div class="form-group">
                    <label class="form-label" for="ct-valor-total">Valor Total (R$) <span class="obrigatorio">*</span></label>
                    <input id="ct-valor-total" type="text" class="form-input" placeholder="0,00" inputmode="numeric" autocomplete="off" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="ct-num-parcelas">Nº de Parcelas <span class="obrigatorio">*</span></label>
                    <input id="ct-num-parcelas" type="number" min="2" max="48" class="form-input" placeholder="Ex: 3" />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="ct-primeiro-venc">1º Vencimento <span class="obrigatorio">*</span></label>
                    <input id="ct-primeiro-venc" type="date" class="form-input" />
                  </div>
                </div>
                <button type="button" class="btn btn-secundario" id="btn-gerar-parcelas">Gerar Parcelas</button>
                <div id="tabela-parcelas-wrap" class="hidden">
                  <table class="tabela-parcelas">
                    <thead><tr><th>Parcela</th><th>Valor (R$)</th><th>Vencimento</th></tr></thead>
                    <tbody id="tbody-parcelas"></tbody>
                  </table>
                </div>
                <div class="form-row mt-2">
                  <div class="form-group">
                    <label class="form-label" for="ct-competencia-parc">Competência</label>
                    <input id="ct-competencia-parc" type="month" class="form-input" />
                  </div>
                </div>
              </div>

              <div class="form-row mt-2">
                <div class="form-group">
                  <label class="form-label" for="ct-num-documento">Nº Documento</label>
                  <input id="ct-num-documento" type="text" class="form-input" placeholder="NF, OS, Boleto..." maxlength="40" />
                </div>
                <div class="form-group"><!-- espaço reservado --></div>
              </div>

              <div class="form-group">
                <label class="form-label" for="ct-observacao">Observação</label>
                <textarea id="ct-observacao" class="form-textarea" placeholder="Informações adicionais..."></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-conta">Cancelar</button>
            <button class="btn btn-primario" id="btn-salvar-conta">Salvar</button>
          </div>
        </div>
      </div>

      <!-- Modal: Registrar Pagamento -->
      <div id="modal-pagamento" class="modal-overlay hidden">
        <div class="modal modal-sm">
          <div class="modal-header">
            <h3>Registrar Pagamento</h3>
            <button class="modal-fechar" data-fecha="modal-pagamento">✕</button>
          </div>
          <div class="modal-body">
            <form id="form-pagamento" novalidate>
              <input type="hidden" id="pg-id" />
              <div class="form-group">
                <label class="form-label" for="pg-data">Data do Pagamento <span class="obrigatorio">*</span></label>
                <input id="pg-data" type="date" class="form-input" />
              </div>
              <div class="form-group">
                <label class="form-label" for="pg-forma">Forma de Pagamento <span class="obrigatorio">*</span></label>
                <select id="pg-forma" class="form-select">
                  <option value="">Selecione...</option>
                  <option>PIX</option>
                  <option>Boleto</option>
                  <option>Transferência</option>
                  <option>Cartão</option>
                  <option>Dinheiro</option>
                  <option>Cheque</option>
                </select>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secundario" data-fecha="modal-pagamento">Cancelar</button>
            <button class="btn btn-sucesso" id="btn-confirmar-pagamento">💰 Confirmar</button>
          </div>
        </div>
      </div>
    `;
  };

  // ===== TABELA =====

  const _renderTabela = (dados) => {
    const tbody     = document.getElementById('tbody-contas');
    const tfoot     = document.getElementById('tfoot-contas');
    const subtitulo = document.getElementById('contas-subtitulo');
    const sessao    = AUTH.getSessao();

    if (!dados.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="tabela-vazia">Nenhuma conta encontrada com os filtros aplicados.</td></tr>`;
      tfoot.innerHTML = '';
      if (subtitulo) subtitulo.textContent = '0 contas';
      return;
    }

    let total = 0;

    tbody.innerHTML = dados.map((conta) => {
      const status    = _calcularStatus(conta);
      const classeRow = status === CONFIG.statusConta.VENCIDO ? 'linha-vencida'
                      : status === 'Vence Hoje'               ? 'linha-vence-hoje'
                      : '';
      total += conta.valor;

      const podeEditar  = AUTH.isAdmin() || (AUTH.isFinanceiro() && conta.usuario === sessao?.login);
      const podePagar   = (AUTH.isAdmin() || AUTH.isFinanceiro()) && status !== CONFIG.statusConta.PAGO;
      const podeExcluir = AUTH.isAdmin();

      const btnEditar  = podeEditar  ? `<button class="btn-icone" data-action="editar"  data-id="${conta.id}" title="Editar">✏️</button>` : '';
      const btnPagar   = podePagar   ? `<button class="btn-icone" data-action="pagar"   data-id="${conta.id}" title="Registrar Pagamento">💰</button>` : '';
      const btnExcluir = podeExcluir ? `<button class="btn-icone" data-action="excluir" data-id="${conta.id}" title="Excluir">🗑️</button>` : '';

      return `
        <tr class="${classeRow}">
          <td>${conta.fornecedor}</td>
          <td>${conta.categoria}</td>
          <td>${conta.solicitante || '—'}</td>
          <td>${conta.descricao}</td>
          <td class="text-right">${UI.formatMoeda(conta.valor)}</td>
          <td>${UI.formatData(conta.vencimento)}</td>
          <td class="text-center">${_badgeStatus(status)}</td>
          <td class="text-center"><span class="acoes">${btnEditar}${btnPagar}${btnExcluir}</span></td>
        </tr>
      `;
    }).join('');

    const count = dados.length;
    tfoot.innerHTML = `
      <tr>
        <td colspan="4"><strong>${count} conta${count !== 1 ? 's' : ''}</strong></td>
        <td class="text-right"><strong>${UI.formatMoeda(total)}</strong></td>
        <td colspan="3"></td>
      </tr>
    `;
    if (subtitulo) subtitulo.textContent = `${count} conta${count !== 1 ? 's' : ''} — ${UI.formatMoeda(total)}`;
  };

  // ===== FILTROS =====

  const _populaSelectsFiltros = () => {
    const fsSel   = document.getElementById('filtro-fornecedor');
    const catSel  = document.getElementById('filtro-categoria');
    const solSel  = document.getElementById('filtro-solicitante');

    const fAtual  = fsSel?.value;
    const cAtual  = catSel?.value;
    const sAtual  = solSel?.value;

    const fornUnicos = [...new Set(_dados.map((c) => c.fornecedor))].sort();
    if (fsSel) {
      fsSel.innerHTML = '<option value="">Todos</option>' +
        fornUnicos.map((n) => `<option value="${n}">${n}</option>`).join('');
      fsSel.value = fAtual || '';
    }

    const catUnicas = [...new Set(_dados.map((c) => c.categoria))].sort();
    if (catSel) {
      catSel.innerHTML = '<option value="">Todas</option>' +
        catUnicas.map((n) => `<option value="${n}">${n}</option>`).join('');
      catSel.value = cAtual || '';
    }

    const solUnicos = [...new Set(_dados.map((c) => c.solicitante).filter(Boolean))].sort();
    if (solSel) {
      solSel.innerHTML = '<option value="">Todos</option>' +
        solUnicos.map((n) => `<option value="${n}">${n}</option>`).join('');
      solSel.value = sAtual || '';
    }
  };

  const _filtrar = () => {
    const dataInicio   = document.getElementById('filtro-data-inicio')?.value   || '';
    const dataFim      = document.getElementById('filtro-data-fim')?.value      || '';
    const fornecedor   = document.getElementById('filtro-fornecedor')?.value    || '';
    const categoria    = document.getElementById('filtro-categoria')?.value     || '';
    const solicitante  = document.getElementById('filtro-solicitante')?.value   || '';
    const statusFiltro = document.getElementById('filtro-status')?.value        || '';

    _filtrados = _dados.filter((c) => {
      if (dataInicio   && c.vencimento  < dataInicio)             return false;
      if (dataFim      && c.vencimento  > dataFim)                return false;
      if (fornecedor   && c.fornecedor  !== fornecedor)            return false;
      if (categoria    && c.categoria   !== categoria)             return false;
      if (solicitante  && (c.solicitante || '') !== solicitante)   return false;
      if (statusFiltro && _calcularStatus(c) !== statusFiltro)    return false;
      return true;
    });

    _renderTabela(_filtrados);
  };

  const _limparFiltros = () => {
    ['filtro-data-inicio', 'filtro-data-fim'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['filtro-fornecedor', 'filtro-categoria', 'filtro-solicitante', 'filtro-status'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    _filtrar();
  };

  const _aplicarFiltroSalvo = () => {
    const salvo = sessionStorage.getItem('contas_filtro');
    if (!salvo) return;
    sessionStorage.removeItem('contas_filtro');
    try {
      const f = JSON.parse(salvo);
      if (f.status) {
        const sel = document.getElementById('filtro-status');
        if (sel) sel.value = f.status;
      }
      if (f.vencimentoHoje) {
        const sel = document.getElementById('filtro-status');
        if (sel) sel.value = 'Vence Hoje';
      }
      if (f.vencimentoSemana) {
        const hoje = new Date(); const fim = new Date(hoje); fim.setDate(hoje.getDate() + 7);
        const toISO = (d) => d.toISOString().split('T')[0];
        const elI = document.getElementById('filtro-data-inicio');
        const elF = document.getElementById('filtro-data-fim');
        if (elI) elI.value = toISO(hoje); if (elF) elF.value = toISO(fim);
      }
      if (f.mesPago) {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
        const toISO = (d) => d.toISOString().split('T')[0];
        const elI  = document.getElementById('filtro-data-inicio');
        const elF  = document.getElementById('filtro-data-fim');
        const elSt = document.getElementById('filtro-status');
        if (elI) elI.value = toISO(inicioMes); if (elF) elF.value = toISO(fimMes);
        if (elSt) elSt.value = CONFIG.statusConta.PAGO;
      }
    } catch { /* filtro malformado */ }
  };

  // ===== SELECTS DO FORMULÁRIO =====

  const _populaSelectsForm = () => {
    const fsSel  = document.getElementById('ct-fornecedor');
    const catSel = document.getElementById('ct-categoria');
    const solSel = document.getElementById('ct-solicitante');

    if (fsSel) {
      fsSel.innerHTML = '<option value="">Selecione...</option>' +
        _fornecedores.filter((f) => f.ativo)
          .map((f) => `<option value="${f.nome}">${f.nome}</option>`).join('');
    }
    if (catSel) {
      catSel.innerHTML = '<option value="">Selecione...</option>' +
        _categorias.filter((c) => c.ativo)
          .map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
    }
    if (solSel) {
      solSel.innerHTML = '<option value="">— Selecione —</option>' +
        _solicitantes.filter((s) => s.ativo)
          .map((s) => `<option value="${s.nome}">${s.nome}</option>`).join('');
    }
  };

  // ===== PARCELAMENTO =====

  // Calcula próximo vencimento adicionando N meses, mantendo o dia
  const _addMeses = (yyyyMMdd, n) => {
    const d = new Date(yyyyMMdd + 'T00:00:00');
    d.setMonth(d.getMonth() + n);
    return d.toISOString().split('T')[0];
  };

  const _gerarParcelas = () => {
    const valorTotalStr = document.getElementById('ct-valor-total')?.value;
    const numParc       = parseInt(document.getElementById('ct-num-parcelas')?.value, 10);
    const primeiroVenc  = document.getElementById('ct-primeiro-venc')?.value;

    if (!valorTotalStr || !numParc || numParc < 2 || !primeiroVenc) {
      UI.showToast('Preencha valor total, número de parcelas e 1º vencimento.', 'aviso');
      return;
    }

    const totalCents  = Math.round(_parseMoeda(valorTotalStr) * 100);
    const parcelaCents = Math.floor(totalCents / numParc);
    const restoCents  = totalCents - parcelaCents * numParc;

    const tbody = document.getElementById('tbody-parcelas');
    tbody.innerHTML = Array.from({ length: numParc }, (_, i) => {
      const cents  = i === numParc - 1 ? parcelaCents + restoCents : parcelaCents;
      const valor  = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
      const venc   = _addMeses(primeiroVenc, i);
      return `
        <tr>
          <td><span class="parcela-label">${i + 1} / ${numParc}</span></td>
          <td><input class="parcela-valor" type="text" value="${valor}" inputmode="numeric" /></td>
          <td><input class="parcela-venc"  type="date" value="${venc}" /></td>
        </tr>
      `;
    }).join('');

    // Máscara nos campos de valor gerados
    tbody.querySelectorAll('.parcela-valor').forEach((input) => {
      input.addEventListener('input', () => _mascaraMoeda(input));
    });

    document.getElementById('tabela-parcelas-wrap').classList.remove('hidden');
  };

  // ===== MODAL CONTA =====

  const _limparModalConta = () => {
    ['ct-id','ct-descricao','ct-valor','ct-num-documento','ct-observacao',
     'ct-valor-total','ct-num-parcelas','ct-primeiro-venc']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['ct-fornecedor','ct-categoria','ct-solicitante','ct-vencimento',
     'ct-competencia','ct-competencia-parc']
      .forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });

    document.querySelectorAll('#form-conta .erro').forEach((el) => el.classList.remove('erro'));

    // Reset parcelamento
    const radio = document.querySelector('input[name="ct-tipo"][value="avista"]');
    if (radio) radio.checked = true;
    document.getElementById('bloco-avista')?.classList.remove('hidden');
    document.getElementById('bloco-parcelamento')?.classList.add('hidden');
    document.getElementById('tabela-parcelas-wrap')?.classList.add('hidden');
    const tbodyParc = document.getElementById('tbody-parcelas');
    if (tbodyParc) tbodyParc.innerHTML = '';
  };

  const _abrirModalNovo = () => {
    _editandoId = null;
    _limparModalConta();
    _populaSelectsForm();
    document.getElementById('ct-vencimento').value = new Date().toISOString().split('T')[0];
    document.getElementById('bloco-tipo-pag').classList.remove('hidden');
    document.getElementById('modal-conta-titulo').textContent = 'Nova Conta';
    UI.openModal('modal-conta');
  };

  const _abrirModalEditar = (id) => {
    const conta = _dados.find((c) => c.id === id);
    if (!conta) return;

    _editandoId = id;
    _limparModalConta();
    _populaSelectsForm();

    document.getElementById('ct-id').value            = conta.id;
    document.getElementById('ct-fornecedor').value    = conta.fornecedor;
    document.getElementById('ct-categoria').value     = conta.categoria;
    document.getElementById('ct-solicitante').value   = conta.solicitante || '';
    document.getElementById('ct-descricao').value     = conta.descricao;
    document.getElementById('ct-valor').value         = conta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('ct-vencimento').value    = conta.vencimento;
    document.getElementById('ct-competencia').value   = conta.competencia || '';
    document.getElementById('ct-num-documento').value = conta.numDocumento || '';
    document.getElementById('ct-observacao').value    = conta.observacao || '';

    // Edição não permite alterar para parcelada
    document.getElementById('bloco-tipo-pag').classList.add('hidden');
    document.getElementById('modal-conta-titulo').textContent = 'Editar Conta';
    UI.openModal('modal-conta');
  };

  // ===== VALIDAÇÃO =====

  const _validarConta = () => {
    let valido = true;
    const checar = (id, condicao) => {
      const el = document.getElementById(id); if (!el) return;
      const passou = condicao(el.value);
      el.classList.toggle('erro', !passou);
      if (!passou) valido = false;
    };

    checar('ct-fornecedor', (v) => v !== '');
    checar('ct-categoria',  (v) => v !== '');
    checar('ct-descricao',  (v) => v.trim().length > 0);

    const tipo = document.querySelector('input[name="ct-tipo"]:checked')?.value || 'avista';

    if (tipo === 'parcelada' && !_editandoId) {
      checar('ct-valor-total',   (v) => _parseMoeda(v) > 0);
      checar('ct-num-parcelas',  (v) => parseInt(v, 10) >= 2);
      checar('ct-primeiro-venc', (v) => v !== '');
      // Verifica se parcelas foram geradas
      const tbodyParc = document.getElementById('tbody-parcelas');
      if (!tbodyParc || !tbodyParc.rows.length) {
        UI.showToast('Clique em "Gerar Parcelas" antes de salvar.', 'aviso');
        valido = false;
      }
    } else {
      checar('ct-valor',     (v) => _parseMoeda(v) > 0);
      checar('ct-vencimento',(v) => v !== '');
    }

    return valido;
  };

  // ===== SALVAR =====

  const _salvarConta = async () => {
    if (!_validarConta()) {
      UI.showToast('Preencha os campos obrigatórios.', 'aviso');
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-conta');
    btnSalvar.disabled = true;

    const sessao    = AUTH.getSessao();
    const tipo      = document.querySelector('input[name="ct-tipo"]:checked')?.value || 'avista';
    const basePayload = {
      fornecedor:   document.getElementById('ct-fornecedor').value,
      categoria:    document.getElementById('ct-categoria').value,
      solicitante:  document.getElementById('ct-solicitante').value,
      descricao:    document.getElementById('ct-descricao').value.trim(),
      numDocumento: document.getElementById('ct-num-documento').value,
      observacao:   document.getElementById('ct-observacao').value.trim(),
      usuario:      sessao?.login || '',
    };

    try {
      if (tipo === 'parcelada' && !_editandoId) {
        // Coleta parcelas da tabela
        const parcelas = [];
        const total    = document.getElementById('tbody-parcelas').rows.length;
        document.querySelectorAll('#tbody-parcelas tr').forEach((tr, i) => {
          const v = _parseMoeda(tr.querySelector('.parcela-valor')?.value);
          const d = tr.querySelector('.parcela-venc')?.value;
          if (!v || !d) return;
          parcelas.push({
            descricao:  `${basePayload.descricao} (${i + 1}/${total})`,
            valor:      v,
            vencimento: d
          });
        });

        if (parcelas.length < 2) {
          UI.showToast('Verifique as parcelas — valores ou datas inválidos.', 'aviso');
          btnSalvar.disabled = false;
          return;
        }

        await API.post('criarContaParcelada', {
          ...basePayload,
          competencia: document.getElementById('ct-competencia-parc').value,
          parcelas
        });
        UI.showToast(`${parcelas.length} parcelas lançadas com sucesso.`, 'sucesso');

      } else {
        const payload = {
          ...basePayload,
          id:          document.getElementById('ct-id').value || null,
          valor:       _parseMoeda(document.getElementById('ct-valor').value),
          vencimento:  document.getElementById('ct-vencimento').value,
          competencia: document.getElementById('ct-competencia').value,
        };

        if (_editandoId) {
          await API.post('atualizarConta', payload);
          UI.showToast('Conta atualizada com sucesso.', 'sucesso');
        } else {
          await API.post('criarConta', payload);
          UI.showToast('Conta lançada com sucesso.', 'sucesso');
        }
      }

      UI.closeModal('modal-conta');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao salvar conta.', 'erro');
    } finally {
      btnSalvar.disabled = false;
    }
  };

  // ===== PAGAMENTO =====

  const _abrirModalPagamento = (id) => {
    document.getElementById('pg-id').value    = id;
    document.getElementById('pg-data').value  = new Date().toISOString().split('T')[0];
    document.getElementById('pg-forma').value = '';
    document.querySelectorAll('#form-pagamento .erro').forEach((el) => el.classList.remove('erro'));
    UI.openModal('modal-pagamento');
  };

  const _salvarPagamento = async () => {
    const id    = document.getElementById('pg-id').value;
    const data  = document.getElementById('pg-data').value;
    const forma = document.getElementById('pg-forma').value;

    document.getElementById('pg-data').classList.toggle('erro', !data);
    document.getElementById('pg-forma').classList.toggle('erro', !forma);
    if (!data || !forma) { UI.showToast('Informe data e forma de pagamento.', 'aviso'); return; }

    const btnConfirmar = document.getElementById('btn-confirmar-pagamento');
    btnConfirmar.disabled = true;

    try {
      await API.post('registrarPagamento', { id, dataPagamento: data, formaPagamento: forma });
      UI.showToast('Pagamento registrado com sucesso.', 'sucesso');
      UI.closeModal('modal-pagamento');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao registrar pagamento.', 'erro');
    } finally {
      btnConfirmar.disabled = false;
    }
  };

  // ===== EXCLUIR =====

  const _excluirConta = async (id) => {
    const confirmado = await UI.confirm('Deseja excluir esta conta? Esta ação não pode ser desfeita.');
    if (!confirmado) return;
    try {
      await API.post('excluirConta', { id });
      UI.showToast('Conta excluída com sucesso.', 'sucesso');
      await _carregarDados();
    } catch (err) {
      UI.showToast(err.message || 'Erro ao excluir conta.', 'erro');
    }
  };

  // ===== PDF =====

  const _tituloPdf = () => {
    const inicio = document.getElementById('filtro-data-inicio')?.value;
    const fim    = document.getElementById('filtro-data-fim')?.value;
    if (inicio && fim) return `Contas a Pagar — ${UI.formatData(inicio)} a ${UI.formatData(fim)}`;
    if (inicio)        return `Contas a Pagar — a partir de ${UI.formatData(inicio)}`;
    if (fim)           return `Contas a Pagar — até ${UI.formatData(fim)}`;
    return 'Contas a Pagar';
  };

  const _gerarPdf = () => {
    if (!_filtrados.length) { UI.showToast('Nenhuma conta para exportar.', 'aviso'); return; }

    let total = 0;
    const dadosPdf = _filtrados.map((c) => {
      total += c.valor;
      return {
        fornecedor:  c.fornecedor,
        solicitante: c.solicitante || '—',
        descricao:   c.descricao,
        vencimento:  UI.formatData(c.vencimento),
        valor:       UI.formatMoeda(c.valor),
        status:      _calcularStatus(c)
      };
    });

    const colunas = [
      { header: 'Fornecedor',  dataKey: 'fornecedor'  },
      { header: 'Solicitante', dataKey: 'solicitante' },
      { header: 'Descrição',   dataKey: 'descricao'   },
      { header: 'Vencimento',  dataKey: 'vencimento'  },
      { header: 'Valor',       dataKey: 'valor'       },
      { header: 'Status',      dataKey: 'status'      }
    ];

    PDF.gerar(_tituloPdf(), colunas, dadosPdf, 'l', {
      rodapeTexto: `${_filtrados.length} conta${_filtrados.length !== 1 ? 's' : ''} | Total: ${UI.formatMoeda(total)}`
    });
  };

  // ===== CARREGAMENTO =====

  const _carregarDados = async () => {
    if (!CONFIG.API_URL) {
      _dados        = _mockContas();
      _fornecedores = _mockFornecedores();
      _categorias   = _mockCategorias();
      _solicitantes = _mockSolicitantes();
    } else {
      try {
        [_dados, _fornecedores, _categorias, _solicitantes] = await Promise.all([
          API.get('listarContas'),
          API.get('listarFornecedores'),
          API.get('listarCategorias'),
          API.get('listarSolicitantes')
        ]);
      } catch (err) {
        UI.showToast('Erro ao carregar contas.', 'erro');
        _dados        = _mockContas();
        _fornecedores = _mockFornecedores();
        _categorias   = _mockCategorias();
        _solicitantes = _mockSolicitantes();
      }
    }

    _populaSelectsFiltros();
    _filtrar();
  };

  // ===== BIND EVENTOS =====

  const _bindEventos = () => {
    ['filtro-data-inicio','filtro-data-fim','filtro-fornecedor',
     'filtro-categoria','filtro-solicitante','filtro-status']
      .forEach((id) => _addListener(document.getElementById(id), 'change', _filtrar));

    _addListener(document.getElementById('btn-limpar-filtros'), 'click', _limparFiltros);
    _addListener(document.getElementById('btn-nova-conta'),     'click', _abrirModalNovo);
    _addListener(document.getElementById('btn-pdf-contas'),     'click', _gerarPdf);
    _addListener(document.getElementById('btn-salvar-conta'),   'click', _salvarConta);
    _addListener(document.getElementById('form-conta'),         'submit', (e) => { e.preventDefault(); _salvarConta(); });
    _addListener(document.getElementById('btn-confirmar-pagamento'), 'click', _salvarPagamento);
    _addListener(document.getElementById('form-pagamento'),     'submit', (e) => { e.preventDefault(); _salvarPagamento(); });

    // Máscara no campo valor (à vista)
    _addListener(document.getElementById('ct-valor'), 'input', () =>
      _mascaraMoeda(document.getElementById('ct-valor'))
    );

    // Máscara no campo valor total (parcelada)
    _addListener(document.getElementById('ct-valor-total'), 'input', () =>
      _mascaraMoeda(document.getElementById('ct-valor-total'))
    );

    // Toggle À Vista / Parcelada
    document.querySelectorAll('input[name="ct-tipo"]').forEach((radio) => {
      _addListener(radio, 'change', () => {
        const parcelada = radio.value === 'parcelada' && radio.checked;
        document.getElementById('bloco-avista').classList.toggle('hidden', parcelada);
        document.getElementById('bloco-parcelamento').classList.toggle('hidden', !parcelada);
        if (!parcelada) {
          document.getElementById('tabela-parcelas-wrap').classList.add('hidden');
          document.getElementById('tbody-parcelas').innerHTML = '';
        }
      });
    });

    // Gerar parcelas
    _addListener(document.getElementById('btn-gerar-parcelas'), 'click', _gerarParcelas);

    // Fechar modais
    document.querySelectorAll('[data-fecha="modal-conta"], [data-fecha="modal-pagamento"]')
      .forEach((btn) => _addListener(btn, 'click', () => UI.closeModal(btn.dataset.fecha)));

    // Delegação na tabela
    const tbody = document.getElementById('tbody-contas');
    _addListener(tbody, 'click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'editar')  _abrirModalEditar(id);
      if (action === 'pagar')   _abrirModalPagamento(id);
      if (action === 'excluir') _excluirConta(id);
    });
  };

  // ===== PUBLIC API =====

  const init = async () => {
    if (!AUTH.requerPerfil([CONFIG.perfis.ADMIN, CONFIG.perfis.DIRETOR, CONFIG.perfis.FINANCEIRO])) return;
    _renderHtml();
    _bindEventos();
    _aplicarFiltroSalvo();
    await _carregarDados();
    _filtrar();
  };

  const destroy = () => {
    _listeners.forEach(({ el, tipo, fn }) => el.removeEventListener(tipo, fn));
    _listeners.length = 0;
    _dados        = [];
    _filtrados    = [];
    _fornecedores = [];
    _categorias   = [];
    _solicitantes = [];
    _editandoId   = null;
  };

  return { init, destroy };
})();
