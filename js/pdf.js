'use strict';

const PDF = (() => {
  const COR_PRIMARIA_RGB = [13, 105, 44]; // #0D692C

  // Cabeçalho clean: linha verde + nome da empresa + título do relatório
  const _cabecalhoEmpresa = (doc, titulo) => {
    const largura = doc.internal.pageSize.getWidth();

    // Barra verde fina no topo
    doc.setFillColor(...COR_PRIMARIA_RGB);
    doc.rect(0, 0, largura, 6, 'F');

    // Nome da empresa
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COR_PRIMARIA_RGB);
    doc.text(CONFIG.empresa || 'Biomassa Chaparini', 14, 14);

    // Título do relatório alinhado à direita
    if (titulo) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(titulo, largura - 14, 14, { align: 'right' });
    }

    // Data de emissão abaixo do título
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Emitido em: ${dataAtual}`, largura - 14, 19, { align: 'right' });

    // Linha separadora
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(14, 22, largura - 14, 22);

    return 28; // Y de início do conteúdo
  };

  // Rodapé padrão em todas as páginas
  const rodape = (doc) => {
    const totalPaginas = doc.internal.getNumberOfPages();
    const dataHora     = new Date().toLocaleString('pt-BR');

    for (let i = 1; i <= totalPaginas; i++) {
      doc.setPage(i);
      const largura = doc.internal.pageSize.getWidth();
      const altura  = doc.internal.pageSize.getHeight();

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(14, altura - 13, largura - 14, altura - 13);

      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(CONFIG.sistema, 14, altura - 8);
      doc.text(`Pág. ${i} / ${totalPaginas}`, largura - 14, altura - 8, { align: 'right' });
      doc.text(`Gerado em: ${dataHora}`, largura / 2, altura - 8, { align: 'center' });
    }
  };

  // gerar(titulo, colunas, dados, orientacao, opcoesExtra)
  // opcoesExtra: { rodapeTexto } — texto abaixo da tabela (totalizador)
  const gerar = (titulo, colunas, dados, orientacao = 'p', opcoesExtra = {}) => {
    const { jsPDF } = window.jspdf;
    const doc     = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4' });
    const largura = doc.internal.pageSize.getWidth();
    const inicioY = _cabecalhoEmpresa(doc, titulo);

    doc.autoTable({
      startY: inicioY,
      columns: colunas,
      body: dados,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        textColor: [44, 62, 80]
      },
      headStyles: {
        fillColor: COR_PRIMARIA_RGB,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [249, 249, 249]
      },
      margin: { top: inicioY, left: 14, right: 14, bottom: 20 },
      didDrawPage: (data) => {
        if (data.pageNumber > 1) _cabecalhoEmpresa(doc, titulo);
      }
    });

    if (opcoesExtra.rodapeTexto) {
      const finalY = (doc.lastAutoTable?.finalY || inicioY) + 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(44, 62, 80);
      doc.text(opcoesExtra.rodapeTexto, largura - 14, finalY, { align: 'right' });
    }

    rodape(doc);

    const nomeArquivo = titulo
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') + '.pdf';

    doc.save(nomeArquivo);
  };

  return { gerar, rodape };
})();
