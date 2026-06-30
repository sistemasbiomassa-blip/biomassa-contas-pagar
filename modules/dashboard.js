'use strict';

const DASHBOARD = (() => {
  // Registro de listeners para remoção no destroy()
  const _listeners = [];

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // Retorna diferença em dias entre hoje e a data de vencimento
  // Negativo = vencido, 0 = hoje, positivo = dias restantes
  const _diasParaVencer = (dataVencimento) => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(dataVencimento + 'T00:00:00');
    return Math.round((venc - hoje) / 86400000);
  };

  // Retorna HTML do badge de dias com a classe de cor correta
  const _formatarDias = (dataVencimento) => {
    const dias = _diasParaVencer(dataVencimento);
    if (dias < 0)  return `<span class="badge badge-vencido">${Math.abs(dias)}d atrasado</span>`;
    if (dias === 0) return `<span class="badge badge-atencao">Hoje</span>`;
    if (dias <= 7)  return `<span class="badge badge-semana">${dias}d</span>`;
    return `<span>${dias}d</span>`;
  };

  // Dados mockados para uso enquanto API_URL não está configurada
  const _mockData = () => {
    const hoje = new Date();
    const fmt  = (d) => d.toISOString().split('T')[0];
    const add  = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

    return {
      kpi: {
        vencidos: { count: 3, total: 4500.00 },
        hoje:     { count: 1, total: 850.00  },
        semana:   { count: 2, total: 2300.00 },
        pagosMes: { count: 5, total: 12750.00 }
      },
      proximasVencer: [
        { fornecedor: 'Mecânica Central',        descricao: 'Manutenção preventiva', categoria: 'Manutenção',    valor: 1800.00, vencimento: fmt(add(hoje, -5)) },
        { fornecedor: 'Escritório Contábil XYZ', descricao: 'Honorários contábeis',  categoria: 'Administrativo',valor: 1500.00, vencimento: fmt(add(hoje, -2)) },
        { fornecedor: 'Posto São João',          descricao: 'Abastecimento frota',   categoria: 'Combustível',   valor: 1200.00, vencimento: fmt(add(hoje, -1)) },
        { fornecedor: 'Posto São João',          descricao: 'Abastecimento frota',   categoria: 'Combustível',   valor: 850.00,  vencimento: fmt(hoje) },
        { fornecedor: 'Mecânica Central',        descricao: 'Troca de pneus',        categoria: 'Manutenção',    valor: 1100.00, vencimento: fmt(add(hoje,  3)) },
        { fornecedor: 'Escritório Contábil XYZ', descricao: 'DARF mensal',           categoria: 'Impostos',      valor: 1200.00, vencimento: fmt(add(hoje,  6)) }
      ],
      ultimasPagas: [
        { fornecedor: 'Posto São João',          descricao: 'Abastecimento',      valor: 980.00,  dataPagamento: fmt(add(hoje, -1)),  formaPagamento: 'PIX'           },
        { fornecedor: 'Mecânica Central',        descricao: 'Revisão 50.000 km', valor: 2200.00, dataPagamento: fmt(add(hoje, -3)),  formaPagamento: 'Transferência' },
        { fornecedor: 'Escritório Contábil XYZ', descricao: 'Honorários abril',  valor: 1500.00, dataPagamento: fmt(add(hoje, -5)),  formaPagamento: 'Transferência' },
        { fornecedor: 'Posto São João',          descricao: 'Abastecimento',      valor: 760.00,  dataPagamento: fmt(add(hoje, -8)),  formaPagamento: 'PIX'           },
        { fornecedor: 'Mecânica Central',        descricao: 'Troca de óleo',      valor: 310.00,  dataPagamento: fmt(add(hoje, -10)), formaPagamento: 'Dinheiro'      }
      ]
    };
  };

  // Injeta o esqueleto HTML no #main-content
  const _renderHtml = () => {
    document.getElementById('main-content').innerHTML = `
      <div class="grid grid-4 mb-6">
        <div class="card-indicador vencido" id="kpi-vencidos" role="button" tabindex="0" aria-label="Ver contas vencidas">
          <div class="indicador-label">🔴 Vencidos</div>
          <div class="indicador-valor" id="kpi-vencidos-count">—</div>
          <div class="text-sm" id="kpi-vencidos-total"></div>
        </div>

        <div class="card-indicador atencao" id="kpi-hoje" role="button" tabindex="0" aria-label="Ver contas que vencem hoje">
          <div class="indicador-label">⚠️ Vencem Hoje</div>
          <div class="indicador-valor" id="kpi-hoje-count">—</div>
          <div class="text-sm" id="kpi-hoje-total"></div>
        </div>

        <div class="card-indicador semana" id="kpi-semana" role="button" tabindex="0" aria-label="Ver contas que vencem essa semana">
          <div class="indicador-label">📅 Esta Semana</div>
          <div class="indicador-valor" id="kpi-semana-count">—</div>
          <div class="text-sm" id="kpi-semana-total"></div>
        </div>

        <div class="card-indicador pago" id="kpi-mes" role="button" tabindex="0" aria-label="Ver contas pagas no mês">
          <div class="indicador-label">✅ Pagas no Mês</div>
          <div class="indicador-valor" id="kpi-mes-count">—</div>
          <div class="text-sm" id="kpi-mes-total"></div>
        </div>
      </div>

      <div class="card mb-6">
        <div class="card-header">
          <h3>Próximas a Vencer</h3>
        </div>
        <div class="tabela-container">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th class="text-right">Valor</th>
                <th>Vencimento</th>
                <th class="text-center">Dias p/ Vencer</th>
              </tr>
            </thead>
            <tbody id="tbody-proximas"></tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Últimas Pagas</h3>
        </div>
        <div class="tabela-container">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Fornecedor</th>
                <th>Descrição</th>
                <th class="text-right">Valor</th>
                <th>Data Pagamento</th>
                <th>Forma Pagamento</th>
              </tr>
            </thead>
            <tbody id="tbody-pagas"></tbody>
          </table>
        </div>
      </div>
    `;
  };

  const _preencherKpis = (kpi) => {
    document.getElementById('kpi-vencidos-count').textContent = kpi.vencidos.count;
    document.getElementById('kpi-vencidos-total').textContent = UI.formatMoeda(kpi.vencidos.total);

    document.getElementById('kpi-hoje-count').textContent = kpi.hoje.count;
    document.getElementById('kpi-hoje-total').textContent = UI.formatMoeda(kpi.hoje.total);

    document.getElementById('kpi-semana-count').textContent = kpi.semana.count;
    document.getElementById('kpi-semana-total').textContent = UI.formatMoeda(kpi.semana.total);

    document.getElementById('kpi-mes-count').textContent = kpi.pagosMes.count;
    document.getElementById('kpi-mes-total').textContent = UI.formatMoeda(kpi.pagosMes.total);
  };

  // Vincula clique nos cards para navegar até Contas com filtro pré-aplicado.
  // contas.js lerá 'contas_filtro' do sessionStorage no seu init().
  const _bindKpiNavegacao = () => {
    const navegar = (filtro) => () => {
      sessionStorage.setItem('contas_filtro', JSON.stringify(filtro));
      ROUTER.navigate('contas');
    };

    _addListener(
      document.getElementById('kpi-vencidos'),
      'click',
      navegar({ status: CONFIG.statusConta.VENCIDO })
    );
    _addListener(
      document.getElementById('kpi-hoje'),
      'click',
      navegar({ vencimentoHoje: true })
    );
    _addListener(
      document.getElementById('kpi-semana'),
      'click',
      navegar({ vencimentoSemana: true })
    );
    _addListener(
      document.getElementById('kpi-mes'),
      'click',
      navegar({ status: CONFIG.statusConta.PAGO, mesPago: true })
    );

    // Suporte a teclado nos cards (Enter/Espaço)
    document.querySelectorAll('.card-indicador[role="button"]').forEach((card) => {
      _addListener(card, 'keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') card.click();
      });
    });
  };

  const _preencherTabelas = (proximasVencer, ultimasPagas) => {
    UI.renderTable('tbody-proximas', proximasVencer, [
      { key: 'fornecedor', label: 'Fornecedor' },
      { key: 'descricao',  label: 'Descrição' },
      { key: 'categoria',  label: 'Categoria' },
      {
        key: 'valor',
        label: 'Valor',
        classe: 'text-right',
        formato: (v) => UI.formatMoeda(v)
      },
      {
        key: 'vencimento',
        label: 'Vencimento',
        formato: (v) => UI.formatData(v)
      },
      {
        key: 'vencimento',
        label: 'Dias p/ Vencer',
        classe: 'text-center',
        formato: (v) => _formatarDias(v)
      }
    ]);

    UI.renderTable('tbody-pagas', ultimasPagas, [
      { key: 'fornecedor',     label: 'Fornecedor' },
      { key: 'descricao',      label: 'Descrição' },
      {
        key: 'valor',
        label: 'Valor',
        classe: 'text-right',
        formato: (v) => UI.formatMoeda(v)
      },
      {
        key: 'dataPagamento',
        label: 'Data Pagamento',
        formato: (v) => UI.formatData(v)
      },
      { key: 'formaPagamento', label: 'Forma Pagamento' }
    ]);
  };

  // ===== ALERTA DE VENCIMENTO =====

  const _mostrarAlertaVencimento = (dados) => {
    // Exibe apenas uma vez por sessão de login
    if (sessionStorage.getItem('alerta-vencimento-visto')) return;

    const vencidas = dados.proximasVencer.filter((c) => _diasParaVencer(c.vencimento) <  0);
    const hoje     = dados.proximasVencer.filter((c) => _diasParaVencer(c.vencimento) === 0);

    if (!vencidas.length && !hoje.length) return;

    // Monta o corpo do modal
    const _linhas = (lista, classe) => lista.map((c) => `
      <div class="alerta-linha ${classe}">
        <div class="alerta-linha-info">
          <span class="alerta-linha-fornecedor">${c.fornecedor}</span>
          <span class="alerta-linha-desc">${c.descricao}</span>
        </div>
        <span class="alerta-linha-valor">${UI.formatMoeda(c.valor)}</span>
      </div>
    `).join('');

    let html = '';

    if (vencidas.length) {
      html += `
        <div class="alerta-secao">
          <div class="alerta-secao-titulo">🔴 Vencidas (${vencidas.length})</div>
          ${_linhas(vencidas, 'alerta-linha--vencida')}
        </div>
      `;
    }

    if (hoje.length) {
      html += `
        <div class="alerta-secao">
          <div class="alerta-secao-titulo">🟠 Vencem Hoje (${hoje.length})</div>
          ${_linhas(hoje, 'alerta-linha--hoje')}
        </div>
      `;
    }

    const totalUrgente = [...vencidas, ...hoje].reduce((s, c) => s + c.valor, 0);
    html += `
      <div class="alerta-total">
        <span>Total urgente</span>
        <strong>${UI.formatMoeda(totalUrgente)}</strong>
      </div>
    `;

    const total = vencidas.length + hoje.length;
    document.getElementById('alerta-titulo').textContent =
      `${total} conta${total > 1 ? 's' : ''} ${total > 1 ? 'precisam' : 'precisa'} de atenção`;
    document.getElementById('alerta-subtitulo').textContent =
      `${vencidas.length} vencida${vencidas.length !== 1 ? 's' : ''} · ${hoje.length} vencem hoje`;
    document.getElementById('alerta-vencimento-body').innerHTML = html;

    // Abre o modal
    const overlay = document.getElementById('modal-alerta-vencimento');
    overlay.classList.remove('hidden');

    // Fechar
    const _fechar = () => {
      overlay.classList.add('hidden');
      sessionStorage.setItem('alerta-vencimento-visto', '1');
    };

    _addListener(document.getElementById('alerta-fechar'),    'click', _fechar);
    _addListener(document.getElementById('alerta-ver-contas'), 'click', () => {
      _fechar();
      ROUTER.navigate('contas');
    });
    _addListener(overlay, 'click', (e) => {
      if (e.target === overlay) _fechar();
    });
  };

  const _carregarDados = async () => {
    let dados;

    if (!CONFIG.API_URL) {
      // Desenvolvimento: sem API configurada, usa mock
      dados = _mockData();
      CONFIG.debug && console.log('[DASHBOARD] modo mock — defina CONFIG.API_URL para usar a API real');
    } else {
      try {
        dados = await API.get('listarDashboard');
      } catch (err) {
        UI.showToast('Erro ao carregar dados do dashboard.', 'erro');
        dados = _mockData();
      }
    }

    _preencherKpis(dados.kpi);
    _preencherTabelas(dados.proximasVencer, dados.ultimasPagas);
    _bindKpiNavegacao();
    _mostrarAlertaVencimento(dados);
  };

  const init = async () => {
    _renderHtml();
    await _carregarDados();
  };

  const destroy = () => {
    _listeners.forEach(({ el, tipo, fn }) => el.removeEventListener(tipo, fn));
    _listeners.length = 0;
  };

  return { init, destroy };
})();
