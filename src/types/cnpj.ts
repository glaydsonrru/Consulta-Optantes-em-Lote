export interface CnaeItem {
  codigo: string;
  descricao: string;
}

export interface CnpjApiPayload {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  opcao_pelo_simples?: boolean | null;
  data_opcao_pelo_simples?: string | null;
  data_exclusao_do_simples?: string | null;
  opcao_pelo_mei?: boolean | null;
  data_opcao_pelo_mei?: string | null;
  data_exclusao_do_mei?: string | null;
  descricao_situacao_cadastral?: string | null;
  data_situacao_cadastral?: string | null;
  cnae_fiscal?: number | string | null;
  cnae_fiscal_descricao?: string | null;
  cnaes_secundarios?: Array<{ codigo?: number | string; descricao?: string }>;
  porte?: string | null;
  natureza_juridica?: string | null;
  municipio?: string | null;
  uf?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
  data_inicio_atividade?: string | null;
}

export interface CnpjRecord {
  cnpj: string;
  cnpjFormatado: string;
  sucesso: boolean;
  fonte?: 'BrasilAPI' | 'Minha Receita';
  erro?: string;
  razaoSocial: string;
  nomeFantasia: string;
  opcaoSimples: boolean | null;
  dataOpcaoSimples: string | null;
  dataExclusaoSimples: string | null;
  textoSimples: string;
  opcaoMei: boolean | null;
  dataOpcaoMei: string | null;
  dataExclusaoMei: string | null;
  textoSimei: string;
  situacaoCadastral: string;
  dataSituacaoCadastral: string | null;
  cnaeCodigo: string;
  cnaeDescricao: string;
  cnaesSecundarios: CnaeItem[];
  municipio: string;
  uf: string;
  porte: string;
  naturezaJuridica: string;
  enderecoCompleto: string;
  dataInicioAtividade: string | null;
  consultadoEm: string;
}

export interface ParsedInput {
  validos: string[];
  invalidCheckDigits: string[];
  ignoredLinesCount: number;
  duplicatesRemoved: number;
}

export interface ExportOptions {
  incluirExtras: boolean;
}

export interface BatchSession {
  id: string;
  criadoEm: string;
  total: number;
  optantesSimples: number;
  enquadradosSimei: number;
  erros: number;
  registros: CnpjRecord[];
}

export type FilterStatus = 'todos' | 'simples' | 'simei' | 'nao_optantes' | 'erros';
export type ViewMode = 'tabela' | 'cartoes';
export type ActiveTab = 'consulta' | 'historico' | 'fontes';
