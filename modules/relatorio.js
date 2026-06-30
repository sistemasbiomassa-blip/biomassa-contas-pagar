'use strict';

const RELATORIO = (() => {
  const _listeners  = [];
  let _dados        = [];  // todos os registros (contas)
  let _filtrados    = [];  // subconjunto após filtros
  let _categorias   = [];  // para lookup da flag frota
  let _fornecedores = [];  // para popular select de filtro

  const _addListener = (el, tipo, fn) => {
    if (!el) return;
    el.addEventListener(tipo, fn);
    _listeners.push({ el, tipo, fn });
  };

  // ===== STATUS (mesmo cálculo do módulo contas.js) =====

  const _calcularStatus = (conta) => {
    if (conta.dataPagamento) return CONFIG.statusConta.PAGO;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(conta.vencimento + 'T00:00:00');

    if (venc < hoje)                      return CONFIG.statusConta.VENCIDO;
    if (venc.getTime() === hoje.getTime()) return 'Vence Hoje';
    return CONFIG.statusConta.PENDENTE;
  };

  // ===== HELPERS =====

  const _NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // "YYYY-MM" → "Jan/25"
  const _rotuloMes = (yyyyMM) => {
    if (!yyyyMM || yyyyMM.length < 7) return yyyyMM;
    const m = parseInt(yyyyMM.slice(5, 7), 10) - 1;
    return `${_NOMES_MES[m]}/${yyyyMM.slice(2, 4)}`;
  };

  // Formata "YYYY-MM-DD" para "DD/MM/YYYY"
  const _formatData = (yyyyMMdd) => {
    if (!yyyyMMdd || yyyyMMdd.length < 10) return yyyyMMdd || '';
    return `${yyyyMMdd.slice(8, 10)}/${yyyyMMdd.slice(5, 7)}/${yyyyMMdd.slice(0, 4)}`;
  };

  // Formata "YYYY-MM" para "MM/YYYY" (mantido para competência no CSV)
  const _formatMes = (yyyyMM) => {
    if (!yyyyMM || yyyyMM.length < 7) return yyyyMM || '';
    return `${yyyyMM.slice(5, 7)}/${yyyyMM.slice(0, 4)}`;
  };

  const _isCategoriaFrota = (nomeCategoria) =>
    !!_categorias.find((c) => c.nome === nomeCategoria)?.frota;

  // ===== MOCK DATA =====

  const _mockContas = () => {
    const hoje = new Date();
    const fmt  = (d) => d.toISOString().split('T')[0];
    const add  = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
    const mes  = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    return [
      { id: 'CT001', fornecedor: 'Mecânica Central',        categoria: 'Manutenção',    descricao: 'Troca de pneus dianteiros', valor: 1100.00, vencimento: fmt(add(hoje, -8)),  competencia: mes(add(hoje, -8)),  dataPagamento: '',              formaPagamento: '', usuario: 'admin',      dataRegistro: fmt(add(hoje, -15)) },
      { id: 'CT002', fornecedor: 'Escritório Contábil XYZ', categoria: 'Administrativo',descricao: 'Honorários contábeis',       valor: 1500.00, vencimento: fmt(add(hoje, -3)),  competencia: mes(add(hoje, -3)),  dataPagamento: '',              formaPagamento: '', usuario: 'financeiro', dataRegistro: fmt(add(hoje, -10)) },
      { id: 'CT003', fornecedor: 'Posto São João',          categoria: 'Combustível',   descricao: 'Abastecimento frota sem. 23',valor: 850.00,  vencimento: fmt(hoje),           competencia: mes(hoje),           dataPagamento: '',              formaPagamento: '', usuario: 'financeiro', dataRegistro: fmt(add(hoje, -7))  },
      { id: 'CT004', fornecedor: 'Posto São João',          categoria: 'Combustível',   descricao: 'Abastecimento frota sem. 24',valor: 920.00,  vencimento: fmt(add(hoje, 5)),   competencia: mes(hoje),           dataPagamento: '',              formaPagamento: '', usuario: 'financeiro', dataRegistro: fmt(add(hoje, -2))  },
      { id: 'CT005', fornecedor: 'Mecânica Central',        categoria: 'Manutenção',    descricao: 'Revisão 50.000 km cam. 03', valor: 2200.00, vencimento: fmt(add(hoje, 10)),  competencia: mes(hoje),           dataPagamento: '',              formaPagamento: '', usuario: 'admin',      dataRegistro: fmt(add(hoje, -1))  },
      { id: 'CT006', fornecedor: 'Escritório Contábil XYZ', categoria: 'Administrativo',descricao: 'DARF IRPJ 2º trimestre',    valor: 3800.00, vencimento: fmt(add(hoje, 18)),  competencia: mes(hoje),           dataPagamento: '',              formaPagamento: '', usuario: 'admin',      dataRegistro: fmt(hoje)           },
      { id: 'CT007', fornecedor: 'Posto São João',          categoria: 'Combustível',   descricao: 'Abastecimento frota sem. 22',valor: 780.00, vencimento: fmt(add(hoje, -12)), competencia: mes(add(hoje, -12)), dataPagamento: fmt(add(hoje, -12)), formaPagamento: 'PIX',           usuario: 'financeiro', dataRegistro: fmt(add(hoje, -18)) },
      { id: 'CT008', fornecedor: 'Mecânica Central',        categoria: 'Manutenção',    descricao: 'Manutenção preventiva frota',valor: 1800.00, vencimento: fmt(add(hoje, -10)), competencia: mes(add(hoje, -10)), dataPagamento: fmt(add(hoje, -10)), formaPagamento: 'Transferência', usuario: 'admin',      dataRegistro: fmt(add(hoje, -20)) },
      { id: 'CT009', fornecedor: 'Escritório Contábil XYZ', categoria: 'Administrativo',descricao: 'Honorários 2 meses atrás',  valor: 1500.00, vencimento: fmt(add(hoje, -35)), competencia: mes(add(hoje, -35)), dataPagamento: fmt(add(hoje, -35)), formaPagamento: 'Transferência', usuario: 'financeiro', dataRegistro: fmt(add(hoje, -42)) },
      { id: 'CT010', fornecedor: 'Posto São João',          categoria: 'Combustível',   descricao: 'Abastecimento frota sem. 20',valor: 650.00, vencimento: fmt(add(hoje, -25)), competencia: mes(add(hoje, -25)), dataPagamento: fmt(add(hoje, -24)), formaPagamento: 'PIX',           usuario: 'financeiro', dataRegistro: fmt(add(hoje, -30)) }
    ];
  };

  const _mockCategorias = () => [
    { nome: 'Combustível',    frota: true  },
    { nome: 'Manutenção',     frota: true  },
    { nome: 'Administrativo', frota: false },
    { nome: 'Impostos',       frota: false },
    { nome: 'RH',             frota: false }
  ];

  const _mockFornecedores = () => [
    { nome: 'Posto São João'          },
    { nome: 'Mecânica Central'        },
    { nome: 'Escritório Contábil XYZ' }
  ];

  // ===== RESUMO POR CATEGORIA =====

  const _resumoPorCategoria = (dados) => {
    const grupos = {};

    dados.forEach((c) => {
      if (!grupos[c.categoria]) {
        grupos[c.categoria] = {
          categoria:     c.categoria,
          frota:         _isCategoriaFrota(c.categoria),
          qtd:           0,
          totalPendente: 0,  // em aberto (Pendente + Vence Hoje + Vencido)
          totalPago:     0
        };
      }
      grupos[c.categoria].qtd++;
      if (c.dataPagamento) {
        grupos[c.categoria].totalPago     += c.valor;
      } else {
        grupos[c.categoria].totalPendente += c.valor;
      }
    });

    return Object.values(grupos)
      .sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR'))
      .map((g) => ({ ...g, totalGeral: g.totalPendente + g.totalPago }));
  };

  // ===== EVOLUÇÃO MENSAL =====

  // Agrupa dados por mês do vencimento e retorna array ordenado cronologicamente
  const _evolucaoMensal = (dados) => {
    const meses = {};
    dados.forEach((c) => {
      const mes = c.vencimento.substring(0, 7); // YYYY-MM
      if (!meses[mes]) meses[mes] = { mes, total: 0, pago: 0, aberto: 0 };
      meses[mes].total += c.valor;
      if (c.dataPagamento) meses[mes].pago  += c.valor;
      else                 meses[mes].aberto += c.valor;
    });
    return Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes));
  };

  // ===== RESUMO DE STATUS =====

  // Totaliza valores por status para o gráfico donut
  const _resumoStatus = (dados) => {
    let pago = 0, pendente = 0, vencido = 0;
    dados.forEach((c) => {
      const st = _calcularStatus(c);
      if      (st === CONFIG.statusConta.PAGO)    pago     += c.valor;
      else if (st === CONFIG.statusConta.VENCIDO) vencido  += c.valor;
      else                                         pendente += c.valor; // Pendente + Vence Hoje
    });
    return { pago, pendente, vencido, total: pago + pendente + vencido };
  };

  // ===== HTML =====

  const _renderHtml = () => {
    document.getElementById('main-content').innerHTML = `
      <!-- Filtros -->
      <div class="filtros-form" id="painel-filtros-rel">
        <div class="form-group">
          <label class="form-label">Vencimento de</label>
          <input type="date" id="filtro-data-inicio" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">até</label>
          <input type="date" id="filtro-data-fim" class="form-input" />
        </div>
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select id="filtro-rel-categoria" class="form-select">
            <option value="">Todas</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Fornecedor</label>
          <select id="filtro-rel-fornecedor" class="form-select">
            <option value="">Todos</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select id="filtro-rel-status" class="form-select">
            <option value="">Todos</option>
            <option value="Pendente">Pendente</option>
            <option value="Vence Hoje">Vence Hoje</option>
            <option value="Vencido">Vencido</option>
            <option value="Pago">Pago</option>
          </select>
        </div>
        <div class="form-group" style="justify-content:flex-end">
          <label class="form-label">&nbsp;</label>
          <button class="btn btn-secundario" id="btn-limpar-rel">Limpar</button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <span class="toolbar-titulo" id="rel-subtitulo"></span>
        <button class="btn btn-secundario" id="btn-csv-rel">⬇️ CSV</button>
        <button class="btn btn-primario"   id="btn-pdf-rel">⬇️ PDF</button>
      </div>

      <!-- Tabela de resumo por categoria -->
      <div class="card mb-6">
        <div class="card-header">
          <h3>Resumo por Categoria</h3>
        </div>
        <div class="tabela-container">
          <table class="tabela-padrao">
            <thead>
              <tr>
                <th>Categoria</th>
                <th class="text-right">Qtd. Contas</th>
                <th class="text-right">Total em Aberto</th>
                <th class="text-right">Total Pago</th>
                <th class="text-right">Total Geral</th>
              </tr>
            </thead>
            <tbody id="tbody-resumo"></tbody>
            <tfoot id="tfoot-resumo"></tfoot>
          </table>
        </div>
      </div>

      <!-- Evolução mensal + Donut de status (lado a lado) -->
      <div class="graficos-duo">

        <div class="grafico-card">
          <div class="grafico-card-titulo">Evolução Mensal</div>
          <div class="grafico-area" id="grafico-mensal">
            <span class="grafico-vazio">Carregando...</span>
          </div>
        </div>

        <div class="grafico-card">
          <div class="grafico-card-titulo">Proporção por Status</div>
          <div id="grafico-status">
            <span class="grafico-vazio">Carregando...</span>
          </div>
        </div>

      </div>

      <!-- Gráfico de barras por categoria -->
      <div class="grafico-card mb-6">
        <div class="grafico-card-titulo">Total Geral por Categoria</div>
        <div class="grafico-area" id="grafico-barras">
          <span class="grafico-vazio">Carregando...</span>
        </div>
      </div>
    `;
  };

  // ===== RENDERIZAÇÃO DA TABELA DE RESUMO =====

  const _renderTabela = (resumo) => {
    const tbody = document.getElementById('tbody-resumo');
    const tfoot = document.getElementById('tfoot-resumo');

    if (!resumo.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="tabela-vazia">Nenhum dado para o período selecionado.</td></tr>`;
      tfoot.innerHTML = '';
      return;
    }

    tbody.innerHTML = resumo.map((r) => {
      const iconeFreota = r.frota ? ' <span title="Relacionada à Frota">🚛</span>' : '';
      return `
        <tr>
          <td>${r.categoria}${iconeFreota}</td>
          <td class="text-right">${r.qtd}</td>
          <td class="text-right">${UI.formatMoeda(r.totalPendente)}</td>
          <td class="text-right">${UI.formatMoeda(r.totalPago)}</td>
          <td class="text-right"><strong>${UI.formatMoeda(r.totalGeral)}</strong></td>
        </tr>
      `;
    }).join('');

    // Linha de totais
    const totQtd       = resumo.reduce((s, r) => s + r.qtd, 0);
    const totPendente  = resumo.reduce((s, r) => s + r.totalPendente, 0);
    const totPago      = resumo.reduce((s, r) => s + r.totalPago, 0);
    const totGeral     = resumo.reduce((s, r) => s + r.totalGeral, 0);

    tfoot.innerHTML = `
      <tr>
        <td><strong>TOTAL</strong></td>
        <td class="text-right"><strong>${totQtd}</strong></td>
        <td class="text-right"><strong>${UI.formatMoeda(totPendente)}</strong></td>
        <td class="text-right"><strong>${UI.formatMoeda(totPago)}</strong></td>
        <td class="text-right"><strong>${UI.formatMoeda(totGeral)}</strong></td>
      </tr>
    `;

    // Atualiza subtítulo
    const sub = document.getElementById('rel-subtitulo');
    if (sub) sub.textContent = `${_filtrados.length} registro${_filtrados.length !== 1 ? 's' : ''} — ${UI.formatMoeda(totGeral)}`;
  };

  // ===== GRÁFICO DE BARRAS (CSS puro) =====

  const _renderGrafico = (resumo) => {
    const area = document.getElementById('grafico-barras');
    if (!area) return;

    if (!resumo.length) {
      area.innerHTML = '<span class="grafico-vazio">Nenhum dado para exibir.</span>';
      return;
    }

    const maxValor = Math.max(...resumo.map((r) => r.totalGeral), 0.01);

    area.innerHTML = resumo.map((r) => {
      // Percentual da altura em relação ao maior valor (máx 95% para deixar espaço ao valor)
      const pct    = Math.round((r.totalGeral / maxValor) * 95);
      const rotulo = r.frota ? `${r.categoria} 🚛` : r.categoria;
      // --h é uma CSS custom property injetada como único mecanismo de passar
      // valores numéricos dinâmicos para o CSS do gráfico (exceção justificada).
      return `
        <div class="barra-grupo">
          <span class="barra-valor">${UI.formatMoeda(r.totalGeral)}</span>
          <div class="barra" style="--h: ${pct}%"></div>
          <span class="barra-rotulo">${rotulo}</span>
        </div>
      `;
    }).join('');
  };

  // ===== GRÁFICO EVOLUÇÃO MENSAL =====

  const _renderGraficoMensal = (dados) => {
    const area = document.getElementById('grafico-mensal');
    if (!area) return;

    const meses = _evolucaoMensal(dados);

    if (!meses.length) {
      area.innerHTML = '<span class="grafico-vazio">Nenhum dado para exibir.</span>';
      return;
    }

    const maxValor = Math.max(...meses.map((m) => m.total), 0.01);

    area.innerHTML = meses.map((m) => {
      const pct = Math.round((m.total / maxValor) * 95);
      return `
        <div class="barra-grupo">
          <span class="barra-valor">${UI.formatMoeda(m.total)}</span>
          <div class="barra barra--mensal" style="--h: ${pct}%"></div>
          <span class="barra-rotulo">${_rotuloMes(m.mes)}</span>
        </div>
      `;
    }).join('');
  };

  // ===== GRÁFICO DONUT DE STATUS =====

  const _renderGraficoStatus = (dados) => {
    const area = document.getElementById('grafico-status');
    if (!area) return;

    const { pago, pendente, vencido, total } = _resumoStatus(dados);

    if (!total) {
      area.innerHTML = '<span class="grafico-vazio" style="padding:2rem 0;display:flex">Nenhum dado para exibir.</span>';
      return;
    }

    // Converte valores em graus (0–360) para o conic-gradient
    const degPago     = Math.round((pago     / total) * 360);
    const degVencido  = Math.round((vencido  / total) * 360);
    const degPendente = 360 - degPago - degVencido; // absorve arredondamento

    const pctPago     = Math.round((pago     / total) * 100);
    const pctVencido  = Math.round((vencido  / total) * 100);
    const pctPendente = 100 - pctPago - pctVencido;

    // conic-gradient: começa às 12h (from -90deg), sentido horário
    const gradiente = `conic-gradient(
      from -90deg,
      #0D692C 0deg ${degPago}deg,
      #fd7e14 ${degPago}deg ${degPago + degPendente}deg,
      #dc3545 ${degPago + degPendente}deg 360deg
    )`;

    const _itemLegenda = (cor, label, valor, pct) => `
      <div class="donut-item">
        <span class="donut-cor" style="background:${cor}"></span>
        <div class="donut-item-texto">
          <span class="donut-item-label">${label} <small>(${pct}%)</small></span>
          <span class="donut-item-valor">${UI.formatMoeda(valor)}</span>
        </div>
      </div>
    `;

    area.innerHTML = `
      <div class="donut-wrap">
        <div class="donut-circulo" style="background: ${gradiente}">
          <div class="donut-centro">
            <span class="donut-total">${UI.formatMoeda(total)}</span>
            <span class="donut-centro-label">total</span>
          </div>
        </div>
        <div class="donut-legenda">
          ${_itemLegenda('#0D692C', 'Pago',     pago,     pctPago)}
          ${_itemLegenda('#fd7e14', 'Pendente', pendente, pctPendente)}
          ${_itemLegenda('#dc3545', 'Vencido',  vencido,  pctVencido)}
        </div>
      </div>
    `;
  };

  // ===== FILTROS =====

  const _populaSelectsFiltros = () => {
    const catSel  = document.getElementById('filtro-rel-categoria');
    const fornSel = document.getElementById('filtro-rel-fornecedor');

    const cats  = [...new Set(_dados.map((c) => c.categoria))].sort();
    const forns = [...new Set(_dados.map((c) => c.fornecedor))].sort();

    if (catSel) {
      catSel.innerHTML = '<option value="">Todas</option>' +
        cats.map((n) => `<option value="${n}">${n}</option>`).join('');
    }
    if (fornSel) {
      fornSel.innerHTML = '<option value="">Todos</option>' +
        forns.map((n) => `<option value="${n}">${n}</option>`).join('');
    }
  };

  const _filtrar = () => {
    const dataInicio = document.getElementById('filtro-data-inicio')?.value || '';
    const dataFim    = document.getElementById('filtro-data-fim')?.value    || '';
    const categoria  = document.getElementById('filtro-rel-categoria')?.value || '';
    const fornecedor = document.getElementById('filtro-rel-fornecedor')?.value || '';
    const status     = document.getElementById('filtro-rel-status')?.value  || '';

    _filtrados = _dados.filter((c) => {
      // Período: compara YYYY-MM-DD do vencimento diretamente (strings ISO são ordenáveis)
      if (dataInicio && c.vencimento < dataInicio) return false;
      if (dataFim    && c.vencimento > dataFim)    return false;
      if (categoria  && c.categoria  !== categoria)    return false;
      if (fornecedor && c.fornecedor !== fornecedor)   return false;
      if (status     && _calcularStatus(c) !== status) return false;
      return true;
    });

    const resumo = _resumoPorCategoria(_filtrados);
    _renderTabela(resumo);
    _renderGraficoMensal(_filtrados);
    _renderGraficoStatus(_filtrados);
    _renderGrafico(resumo);
  };

  const _limparFiltros = () => {
    ['filtro-data-inicio', 'filtro-data-fim'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['filtro-rel-categoria', 'filtro-rel-fornecedor', 'filtro-rel-status'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    _filtrar();
  };

  // ===== PDF (paisagem) =====

  const _tituloPdf = () => {
    const inicio = document.getElementById('filtro-data-inicio')?.value;
    const fim    = document.getElementById('filtro-data-fim')?.value;
    if (inicio && fim) return `Relatório Financeiro — ${_formatData(inicio)} a ${_formatData(fim)}`;
    if (inicio)        return `Relatório Financeiro — a partir de ${_formatData(inicio)}`;
    if (fim)           return `Relatório Financeiro — até ${_formatData(fim)}`;
    return 'Relatório Financeiro por Categoria';
  };

  const _gerarPdf = () => {
    const resumo = _resumoPorCategoria(_filtrados);
    if (!resumo.length) {
      UI.showToast('Nenhum dado para exportar.', 'aviso');
      return;
    }

    const totGeral    = resumo.reduce((s, r) => s + r.totalGeral, 0);
    const totPendente = resumo.reduce((s, r) => s + r.totalPendente, 0);
    const totPago     = resumo.reduce((s, r) => s + r.totalPago, 0);
    const totQtd      = resumo.reduce((s, r) => s + r.qtd, 0);

    const colunas = [
      { header: 'Categoria',       dataKey: 'categoria'     },
      { header: 'Qtd.',            dataKey: 'qtd'           },
      { header: 'Total em Aberto', dataKey: 'totalPendente' },
      { header: 'Total Pago',      dataKey: 'totalPago'     },
      { header: 'Total Geral',     dataKey: 'totalGeral'    }
    ];

    const dadosPdf = resumo.map((r) => ({
      categoria:     r.frota ? `${r.categoria} 🚛` : r.categoria,
      qtd:           r.qtd,
      totalPendente: UI.formatMoeda(r.totalPendente),
      totalPago:     UI.formatMoeda(r.totalPago),
      totalGeral:    UI.formatMoeda(r.totalGeral)
    }));

    const rodapeTexto = `${totQtd} registros | Em aberto: ${UI.formatMoeda(totPendente)} | Pago: ${UI.formatMoeda(totPago)} | Total: ${UI.formatMoeda(totGeral)}`;

    PDF.gerar(_tituloPdf(), colunas, dadosPdf, 'l', { rodapeTexto });
  };

  // ===== EXPORTAR CSV (registros individuais filtrados) =====

  const _exportarCSV = () => {
    if (!_filtrados.length) {
      UI.showToast('Nenhum dado para exportar.', 'aviso');
      return;
    }

    const cabecalho = [
      'ID', 'Fornecedor', 'Categoria', 'Descrição', 'Valor',
      'Vencimento', 'Competência', 'Status',
      'Data Pagamento', 'Forma Pagamento', 'Nº Documento',
      'Usuário', 'Data Registro'
    ];

    const linhas = _filtrados.map((c) => [
      c.id,
      c.fornecedor,
      c.categoria,
      c.descricao,
      c.valor.toFixed(2).replace('.', ','),
      c.vencimento,
      _formatMes(c.competencia),
      _calcularStatus(c),
      c.dataPagamento  || '',
      c.formaPagamento || '',
      c.numDocumento   || '',
      c.usuario,
      c.dataRegistro
    ]);

    // Escapa campos com ponto-e-vírgula ou aspas; separador BR-padrão é ";"
    const escapar = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const conteudo = [cabecalho, ...linhas]
      .map((row) => row.map(escapar).join(';'))
      .join('\r\n');

    // BOM UTF-8 para abrir corretamente no Excel sem configuração de codificação
    const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `relatorio-contas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    UI.showToast('CSV exportado com sucesso.', 'sucesso');
  };

  // ===== CARREGAMENTO =====

  const _carregarDados = async () => {
    if (!CONFIG.API_URL) {
      _dados        = _mockContas();
      _categorias   = _mockCategorias();
      _fornecedores = _mockFornecedores();
      CONFIG.debug && console.log('[RELATORIO] modo mock');
    } else {
      try {
        [_dados, _categorias, _fornecedores] = await Promise.all([
          API.get('listarContas'),
          API.get('listarCategorias'),
          API.get('listarFornecedores')
        ]);
      } catch (err) {
        UI.showToast('Erro ao carregar dados do relatório.', 'erro');
        _dados        = _mockContas();
        _categorias   = _mockCategorias();
        _fornecedores = _mockFornecedores();
      }
    }

    _populaSelectsFiltros();
    _filtrar();
  };

  // ===== BIND DE EVENTOS =====

  const _bindEventos = () => {
    // Filtros — reativos a qualquer mudança
    ['filtro-data-inicio', 'filtro-data-fim',
     'filtro-rel-categoria', 'filtro-rel-fornecedor', 'filtro-rel-status']
      .forEach((id) => _addListener(document.getElementById(id), 'change', _filtrar));

    _addListener(document.getElementById('btn-limpar-rel'), 'click', _limparFiltros);
    _addListener(document.getElementById('btn-pdf-rel'),    'click', _gerarPdf);
    _addListener(document.getElementById('btn-csv-rel'),    'click', _exportarCSV);
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
    _dados        = [];
    _filtrados    = [];
    _categorias   = [];
    _fornecedores = [];
  };

  return { init, destroy };
})();
