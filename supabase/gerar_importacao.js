// Gera o SQL que copia os dados da planilha (via Apps Script) para o Supabase.
//
// Uso:  node supabase/gerar_importacao.js <arquivo-de-saida.sql> [arquivo-de-conferencia.txt]
//
// O arquivo de conferência (opcional) recebe uma "impressão digital" (md5) das contas copiadas,
// para comparar com o banco depois da importação sem precisar exibir nenhum dado.
//
// O arquivo gerado contém dados financeiros: NÃO coloque no repositório (ele é público).
// O SQL apaga e recarrega contas, fornecedores, categorias e solicitantes, mantendo os IDs
// da planilha — serve para a migração, antes de o sistema passar a usar o Supabase.
'use strict';

const fs = require('fs');
const crypto = require('crypto');

const API_URL = 'https://script.google.com/macros/s/AKfycbyeebCYs5_rm6kG-zL3QajLskAd3e3RI9RCKIXjNCgOp3rkY8bZjKccgWonFPlkdPMxvg/exec';

const baixar = async () => {
  for (let i = 1; i <= 6; i++) {
    try {
      const r = await fetch(`${API_URL}?action=carregarDados`, { signal: AbortSignal.timeout(90000) });
      const j = JSON.parse(await r.text());
      if (j.status === 'ok') return j.data;
    } catch { /* o Apps Script falha de vez em quando: tenta de novo */ }
    console.error(`tentativa ${i} de baixar os dados falhou; tentando de novo`);
  }
  throw new Error('Não foi possível baixar os dados do Apps Script.');
};

const texto = (v) => `'${String(v ?? '').trim().replace(/'/g, "''")}'`;
const numero = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Número inválido: ${v}`);
  return n.toFixed(2);
};
const data = (v) => {
  if (!v) return 'null';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`Data inválida: ${v}`);
  return `'${v}'`;
};
const logico = (v) => (v ? 'true' : 'false');
const competencia = (v) => (/^\d{4}-\d{2}/.test(String(v || '')) ? texto(String(v).slice(0, 7)) : "''");

const inserir = (tabela, colunas, linhas) => {
  if (!linhas.length) return '';
  return `insert into public.${tabela} (${colunas.join(', ')}) values\n` +
    linhas.map((l) => `  (${l.join(', ')})`).join(',\n') + ';\n';
};

(async () => {
  const saida = process.argv[2];
  if (!saida) throw new Error('Informe o arquivo de saída: node supabase/gerar_importacao.js dados.sql');

  const d = await baixar();
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const sql = [
    `-- Cópia dos dados da planilha para o Supabase — gerada em ${agora}`,
    `-- ${d.contas.length} contas, ${d.fornecedores.length} fornecedores, ${d.categorias.length} categorias, ${d.solicitantes.length} solicitantes`,
    '-- ATENÇÃO: apaga e recarrega estas tabelas. Usar só na migração.',
    'begin;',
    'truncate public.contas, public.fornecedores, public.categorias, public.solicitantes restart identity;',
    '',
    inserir('fornecedores', ['id', 'nome', 'tipo', 'documento', 'telefone', 'email', 'categoria_padrao', 'observacao', 'ativo'],
      d.fornecedores.map((f) => [f.id, texto(f.nome), texto(f.tipo), texto(f.documento), texto(f.telefone),
        texto(f.email), texto(f.categoriaPadrao), texto(f.observacao), logico(f.ativo)])),
    inserir('categorias', ['id', 'nome', 'tipo', 'frota', 'observacao', 'ativo'],
      d.categorias.map((c) => [c.id, texto(c.nome), texto(c.tipo), logico(c.frota), texto(c.observacao), logico(c.ativo)])),
    inserir('solicitantes', ['id', 'nome', 'departamento', 'cargo', 'email', 'telefone', 'ativo'],
      d.solicitantes.map((s) => [s.id, texto(s.nome), texto(s.departamento), texto(s.cargo), texto(s.email),
        texto(s.telefone), logico(s.ativo)])),
    inserir('contas', ['id', 'fornecedor', 'categoria', 'solicitante', 'descricao', 'valor', 'vencimento', 'competencia',
      'data_pagamento', 'forma_pagamento', 'juros_multa', 'num_documento', 'observacao', 'usuario', 'data_registro'],
      d.contas.map((c) => [c.id, texto(c.fornecedor), texto(c.categoria), texto(c.solicitante), texto(c.descricao),
        numero(c.valor), data(c.vencimento), competencia(c.competencia), data(c.dataPagamento),
        texto(c.formaPagamento), numero(c.jurosMulta || 0), texto(c.numDocumento), texto(c.observacao),
        texto(c.usuario), data(c.dataRegistro)])),
    // Próximos IDs continuam depois dos da planilha
    ...['contas', 'fornecedores', 'categorias', 'solicitantes'].map((t) =>
      `select setval(pg_get_serial_sequence('public.${t}', 'id'), (select coalesce(max(id), 0) + 1 from public.${t}), false);`),
    '',
    `select (select count(*) from public.contas) as contas, (select count(*) from public.fornecedores) as fornecedores,`,
    `       (select count(*) from public.categorias) as categorias, (select count(*) from public.solicitantes) as solicitantes;`,
    'commit;',
    ''
  ].join('\n');

  fs.writeFileSync(saida, sql);

  // Mesma expressão usada na conferência dentro do banco (ver .github/workflows/migracao.yml)
  const conferencia = process.argv[3];
  if (conferencia) {
    const texto = [...d.contas].sort((a, b) => Number(a.id) - Number(b.id))
      .map((c) => `${c.id}|${numero(c.valor)}|${c.vencimento}|${c.dataPagamento || ''}`).join(',');
    fs.writeFileSync(conferencia, crypto.createHash('md5').update(texto, 'utf8').digest('hex') + '\n');
  }
  console.log(`Gerado ${saida}: ${d.contas.length} contas, ${d.fornecedores.length} fornecedores, ` +
              `${d.categorias.length} categorias, ${d.solicitantes.length} solicitantes (${(sql.length / 1024).toFixed(0)} KB)`);
})().catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
