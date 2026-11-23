import type { CnpjApiPayload, CnpjRecord, ExportOptions, ParsedInput } from '../types/cnpj';

export const SAMPLE_CNPJS = [
  '53.284.974/0001-00',
  '15.354.448/0001-80',
  '00.000.000/0001-91',
  '33.000.167/0001-01',
];

export function formatCnpj(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatIsoDate(dataIso?: string | null): string {
  if (!dataIso) return '';
  const clean = String(dataIso).trim().split('T')[0];
  const partes = clean.split('-');
  if (partes.length === 3 && partes[0].length === 4) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return clean;
}

export function formatCnae(codigo?: number | string | null): string {
  if (codigo === null || codigo === undefined || codigo === '') return '';
  const digits = String(codigo).replace(/\D/g, '').padStart(7, '0');
  if (digits.length === 7) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 5)}/${digits.slice(5, 7)}`;
  }
  return String(codigo);
}

export function isValidCnpjCheckDigit(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += Number(base[i]) * weights[i];
    }
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), w1);
  if (d1 !== Number(digits[12])) return false;

  const d2 = calcDigit(digits.slice(0, 13), w2);
  return d2 === Number(digits[13]);
}

export function parseCnpjInput(texto: string): ParsedInput {
  const tokens = texto
    .split(/[\r\n,;|\t]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  const seen = new Set<string>();
  const validos: string[] = [];
  const invalidCheckDigits: string[] = [];
  let ignoredLinesCount = 0;
  let duplicatesRemoved = 0;

  for (const token of tokens) {
    const digits = token.replace(/\D/g, '');
    if (digits.length === 14) {
      if (seen.has(digits)) {
        duplicatesRemoved++;
      } else {
        seen.add(digits);
        validos.push(digits);
        if (!isValidCnpjCheckDigit(digits)) {
          invalidCheckDigits.push(formatCnpj(digits));
        }
      }
    } else {
      ignoredLinesCount++;
    }
  }

  return {
    validos,
    invalidCheckDigits,
    ignoredLinesCount,
    duplicatesRemoved,
  };
}

export function normalizeCnpjResponse(
  cnpj: string,
  dados: CnpjApiPayload,
  fonte: 'BrasilAPI' | 'Minha Receita'
): CnpjRecord {
  const cnpjFormatado = formatCnpj(cnpj);
  const razaoSocial = (dados.razao_social || '').trim();
  const nomeFantasia = (dados.nome_fantasia || '').trim();

  let textoSimples = 'NÃO optante pelo Simples Nacional';
  if (dados.opcao_pelo_simples === true) {
    const dataSimples = dados.data_opcao_pelo_simples
      ? ` desde ${formatIsoDate(dados.data_opcao_pelo_simples)}`
      : '';
    textoSimples = `Optante pelo Simples Nacional${dataSimples}`;
  }

  let textoSimei = 'NÃO enquadrado no SIMEI';
  if (dados.opcao_pelo_mei === true) {
    const dataMei = dados.data_opcao_pelo_mei
      ? ` desde ${formatIsoDate(dados.data_opcao_pelo_mei)}`
      : '';
    textoSimei = `Enquadrado no SIMEI${dataMei}`;
  }

  const cnaeCodigo = formatCnae(dados.cnae_fiscal);
  const cnaeDescricao = (dados.cnae_fiscal_descricao || '').trim();
  const cnaesSecundarios = Array.isArray(dados.cnaes_secundarios)
    ? dados.cnaes_secundarios
        .filter((item) => item && (item.codigo || item.descricao))
        .map((item) => ({
          codigo: formatCnae(item.codigo),
          descricao: (item.descricao || '').trim(),
        }))
    : [];

  const enderecoParts = [
    dados.logradouro,
    dados.numero,
    dados.bairro,
    dados.municipio && dados.uf ? `${dados.municipio}/${dados.uf}` : dados.municipio || dados.uf,
    dados.cep ? `CEP ${dados.cep}` : '',
  ].filter((part) => part && String(part).trim().length > 0);

  return {
    cnpj,
    cnpjFormatado,
    sucesso: true,
    fonte,
    razaoSocial,
    nomeFantasia,
    opcaoSimples: dados.opcao_pelo_simples ?? false,
    dataOpcaoSimples: dados.data_opcao_pelo_simples || null,
    dataExclusaoSimples: dados.data_exclusao_do_simples || null,
    textoSimples,
    opcaoMei: dados.opcao_pelo_mei ?? false,
    dataOpcaoMei: dados.data_opcao_pelo_mei || null,
    dataExclusaoMei: dados.data_exclusao_do_mei || null,
    textoSimei,
    situacaoCadastral: (dados.descricao_situacao_cadastral || 'NÃO INFORMADA').trim(),
    dataSituacaoCadastral: dados.data_situacao_cadastral || null,
    cnaeCodigo,
    cnaeDescricao,
    cnaesSecundarios,
    municipio: (dados.municipio || '').trim(),
    uf: (dados.uf || '').trim(),
    porte: (dados.porte || '').trim(),
    naturezaJuridica: (dados.natureza_juridica || '').trim(),
    enderecoCompleto: enderecoParts.join(', '),
    dataInicioAtividade: dados.data_inicio_atividade || null,
    consultadoEm: new Date().toISOString(),
  };
}

export function buildErrorRecord(cnpj: string, erro?: string): CnpjRecord {
  return {
    cnpj,
    cnpjFormatado: formatCnpj(cnpj),
    sucesso: false,
    erro: erro || 'CNPJ não encontrado ou limite temporário atingido.',
    razaoSocial: '',
    nomeFantasia: '',
    opcaoSimples: null,
    dataOpcaoSimples: null,
    dataExclusaoSimples: null,
    textoSimples: 'Erro na consulta',
    opcaoMei: null,
    dataOpcaoMei: null,
    dataExclusaoMei: null,
    textoSimei: 'Erro na consulta',
    situacaoCadastral: '-',
    dataSituacaoCadastral: null,
    cnaeCodigo: '',
    cnaeDescricao: '',
    cnaesSecundarios: [],
    municipio: '',
    uf: '',
    porte: '',
    naturezaJuridica: '',
    enderecoCompleto: '',
    dataInicioAtividade: null,
    consultadoEm: new Date().toISOString(),
  };
}

export async function lookupCnpj(cnpj: string, signal?: AbortSignal): Promise<CnpjRecord> {
  const clean = cnpj.replace(/\D/g, '');

  // 1. Primary path: local Express proxy (/api/cnpj/:cnpj) with BrasilAPI -> Minha Receita fallback
  try {
    const res = await fetch(`/api/cnpj/${clean}`, { signal });
    if (res.ok) {
      const json = (await res.json()) as {
        sucesso: boolean;
        fonte?: 'BrasilAPI' | 'Minha Receita';
        dados?: CnpjApiPayload;
        erro?: string;
      };
      if (json.sucesso && json.dados) {
        return normalizeCnpjResponse(clean, json.dados, json.fonte || 'BrasilAPI');
      }
      return buildErrorRecord(clean, json.erro);
    }
    if (res.status === 404 || res.status === 400) {
      const json = (await res.json().catch(() => ({}))) as { erro?: string };
      return buildErrorRecord(clean, json.erro);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
  }

  // 2. Client-side direct fallback if backend proxy is unavailable
  try {
    const res1 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`, { signal });
    if (res1.ok) {
      const dados = (await res1.json()) as CnpjApiPayload;
      return normalizeCnpjResponse(clean, dados, 'BrasilAPI');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
  }

  try {
    const res2 = await fetch(`https://minhareceita.org/${clean}`, { signal });
    if (res2.ok) {
      const dados = (await res2.json()) as CnpjApiPayload;
      return normalizeCnpjResponse(clean, dados, 'Minha Receita');
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
  }

  return buildErrorRecord(clean);
}

export function buildTsv(records: CnpjRecord[], options: ExportOptions): string {
  const baseHeader = [
    'CNPJ',
    'Razão Social',
    'Situação no Simples Nacional',
    'Situação no SIMEI',
  ];
  const header = options.incluirExtras
    ? [...baseHeader, 'Situação Cadastral', 'CNAE Principal', 'Município/UF']
    : baseHeader;

  const rows = records.map((item) => {
    const sanitize = (val: string) => val.replace(/[\t\r\n]+/g, ' ').trim();
    const baseCols = [
      item.cnpjFormatado,
      sanitize(item.razaoSocial),
      sanitize(item.textoSimples),
      sanitize(item.textoSimei),
    ];
    if (!options.incluirExtras) {
      return baseCols.join('\t');
    }
    const cnaeText = item.cnaeCodigo
      ? `${item.cnaeCodigo}${item.cnaeDescricao ? ` - ${item.cnaeDescricao}` : ''}`
      : '';
    const localText =
      item.municipio && item.uf ? `${item.municipio}/${item.uf}` : item.municipio || item.uf || '';
    return [
      ...baseCols,
      sanitize(item.situacaoCadastral),
      sanitize(cnaeText),
      sanitize(localText),
    ].join('\t');
  });

  return [header.join('\t'), ...rows].join('\n');
}

function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""').replace(/[\r\n]+/g, ' ').trim();
  return `"${escaped}"`;
}

export function buildCsv(records: CnpjRecord[], options: ExportOptions): string {
  const baseHeader = [
    'CNPJ',
    'Razão Social',
    'Situação no Simples Nacional',
    'Situação no SIMEI',
  ];
  const header = options.incluirExtras
    ? [...baseHeader, 'Situação Cadastral', 'CNAE Principal', 'Município/UF']
    : baseHeader;

  const lines = records.map((item) => {
    const baseCols = [
      csvCell(item.cnpjFormatado),
      csvCell(item.razaoSocial),
      csvCell(item.textoSimples),
      csvCell(item.textoSimei),
    ];
    if (!options.incluirExtras) {
      return baseCols.join(';');
    }
    const cnaeText = item.cnaeCodigo
      ? `${item.cnaeCodigo}${item.cnaeDescricao ? ` - ${item.cnaeDescricao}` : ''}`
      : '';
    const localText =
      item.municipio && item.uf ? `${item.municipio}/${item.uf}` : item.municipio || item.uf || '';
    return [
      ...baseCols,
      csvCell(item.situacaoCadastral),
      csvCell(cnaeText),
      csvCell(localText),
    ].join(';');
  });

  return '\uFEFF' + [header.join(';'), ...lines].join('\n');
}
