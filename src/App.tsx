import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  LayoutGrid,
  MinusCircle,
  Play,
  Search,
  Square,
  Table2,
  Upload,
} from 'lucide-react';
import { CnpjDetailDrawer } from './components/CnpjDetailDrawer';
import { DataSourcesView } from './components/DataSourcesView';
import { Header } from './components/Header';
import { HistoryView } from './components/HistoryView';
import type {
  ActiveTab,
  BatchSession,
  CnpjRecord,
  FilterStatus,
  ViewMode,
} from './types/cnpj';
import {
  SAMPLE_CNPJS,
  buildCsv,
  buildTsv,
  formatCnpj,
  lookupCnpj,
  parseCnpjInput,
} from './utils/cnpj';

const HISTORY_STORAGE_KEY = 'consulta_optantes_historico_v1';

interface NoticeState {
  type: 'info' | 'warning' | 'error';
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('consulta');
  const [rawInput, setRawInput] = useState<string>('');
  const [results, setResults] = useState<CnpjRecord[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentCnpj: string;
  } | null>(null);
  const [incluirExtras, setIncluirExtras] = useState<boolean>(true);
  const [delayMs, setDelayMs] = useState<number>(1300);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('tabela');
  const [copied, setCopied] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<CnpjRecord | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [history, setHistory] = useState<BatchSession[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as BatchSession[]) : [];
    } catch {
      return [];
    }
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const parsedInput = useMemo(() => parseCnpjInput(rawInput), [rawInput]);

  const stats = useMemo(() => {
    const total = results.length;
    const simples = results.filter((r) => r.sucesso && r.opcaoSimples === true).length;
    const simei = results.filter((r) => r.sucesso && r.opcaoMei === true).length;
    const erros = results.filter((r) => !r.sucesso).length;
    const naoOptantes = results.filter(
      (r) => r.sucesso && r.opcaoSimples !== true && r.opcaoMei !== true
    ).length;
    return { total, simples, simei, erros, naoOptantes };
  }, [results]);

  const filteredResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    return results.filter((item) => {
      if (filterStatus === 'simples' && !(item.sucesso && item.opcaoSimples === true)) {
        return false;
      }
      if (filterStatus === 'simei' && !(item.sucesso && item.opcaoMei === true)) {
        return false;
      }
      if (
        filterStatus === 'nao_optantes' &&
        !(item.sucesso && item.opcaoSimples !== true && item.opcaoMei !== true)
      ) {
        return false;
      }
      if (filterStatus === 'erros' && item.sucesso) {
        return false;
      }

      if (!q) return true;
      return (
        item.cnpjFormatado.toLowerCase().includes(q) ||
        (qDigits.length > 0 && item.cnpj.includes(qDigits)) ||
        item.razaoSocial.toLowerCase().includes(q) ||
        item.cnaeDescricao.toLowerCase().includes(q) ||
        item.cnaeCodigo.toLowerCase().includes(q)
      );
    });
  }, [results, filterStatus, searchQuery]);

  const waitWithAbort = (ms: number, signal: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });

  const handleStartBatch = async () => {
    const cnpjs = parsedInput.validos;
    if (cnpjs.length === 0) {
      setNotice({
        type: 'warning',
        message: 'Cole pelo menos um CNPJ válido com 14 dígitos antes de iniciar a consulta.',
      });
      return;
    }

    setNotice(null);
    setResults([]);
    setFilterStatus('todos');
    setSearchQuery('');
    setIsRunning(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const collected: CnpjRecord[] = [];
    let cancelled = false;

    try {
      for (let i = 0; i < cnpjs.length; i++) {
        if (controller.signal.aborted) {
          cancelled = true;
          break;
        }

        const cnpj = cnpjs[i];
        setProgress({
          current: i + 1,
          total: cnpjs.length,
          currentCnpj: formatCnpj(cnpj),
        });

        const record = await lookupCnpj(cnpj, controller.signal);
        collected.push(record);
        setResults([...collected]);

        if (i < cnpjs.length - 1 && delayMs > 0) {
          await waitWithAbort(delayMs, controller.signal);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        cancelled = true;
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;

      if (collected.length > 0) {
        const session: BatchSession = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          criadoEm: new Date().toISOString(),
          total: collected.length,
          optantesSimples: collected.filter((r) => r.sucesso && r.opcaoSimples === true).length,
          enquadradosSimei: collected.filter((r) => r.sucesso && r.opcaoMei === true).length,
          erros: collected.filter((r) => !r.sucesso).length,
          registros: collected,
        };
        setHistory((prev) => [session, ...prev].slice(0, 20));
      }

      if (cancelled) {
        setNotice({
          type: 'info',
          message: `Consulta interrompida pelo usuário. ${collected.length} de ${cnpjs.length} CNPJ(s) processado(s).`,
        });
      } else {
        setNotice({
          type: 'info',
          message: `Consulta concluída com sucesso: ${collected.length} CNPJ(s) processado(s).`,
        });
      }
      setProgress(null);
    }
  };

  const handleStopBatch = () => {
    abortControllerRef.current?.abort();
  };

  const handleLoadSample = () => {
    setRawInput(SAMPLE_CNPJS.join('\n'));
    setNotice(null);
  };

  const handleClear = () => {
    if (isRunning) {
      abortControllerRef.current?.abort();
    }
    setRawInput('');
    setResults([]);
    setProgress(null);
    setFilterStatus('todos');
    setSearchQuery('');
    setNotice(null);
  };

  const handleCopyResults = async () => {
    const target = filteredResults.length > 0 ? filteredResults : results;
    if (target.length === 0) {
      setNotice({
        type: 'warning',
        message: 'Nenhum resultado disponível para copiar.',
      });
      return;
    }

    const tsv = buildTsv(target, { incluirExtras });
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setNotice({
        type: 'error',
        message: 'Não foi possível acessar a área de transferência do navegador.',
      });
    }
  };

  const downloadCsvFromRecords = (records: CnpjRecord[], filename = 'consulta_simples_nacional.csv') => {
    if (records.length === 0) {
      setNotice({
        type: 'warning',
        message: 'Nenhum resultado disponível para exportar.',
      });
      return;
    }

    const csvContent = buildCsv(records, { incluirExtras });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const target = filteredResults.length > 0 ? filteredResults : results;
    downloadCsvFromRecords(target);
  };

  const handleFileImport = async (file: File) => {
    try {
      const content = await file.text();
      const parsed = parseCnpjInput(content);
      if (parsed.validos.length === 0) {
        setNotice({
          type: 'warning',
          message: `Nenhum CNPJ com 14 dígitos foi encontrado no arquivo "${file.name}".`,
        });
        return;
      }
      setRawInput(parsed.validos.map(formatCnpj).join('\n'));
      setNotice({
        type: 'info',
        message: `${parsed.validos.length} CNPJ(s) importado(s) do arquivo "${file.name}".`,
      });
    } catch {
      setNotice({
        type: 'error',
        message: 'Falha ao ler o arquivo selecionado.',
      });
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileImport(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileImport(file);
    }
  };

  const handleLoadHistorySession = (session: BatchSession) => {
    setResults(session.registros);
    setRawInput(session.registros.map((r) => r.cnpjFormatado).join('\n'));
    setFilterStatus('todos');
    setSearchQuery('');
    setActiveTab('consulta');
    setNotice({
      type: 'info',
      message: `Lote de ${new Date(session.criadoEm).toLocaleString('pt-BR')} reaberto (${session.total} registros).`,
    });
  };

  const progressPercent =
    progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#F7F9F8] text-slate-900">
      <Header
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        hasResults={results.length > 0}
        onExportCsv={handleExportCsv}
      />

      <main className="flex-1">
        {activeTab === 'historico' ? (
          <HistoryView
            sessions={history}
            onLoadSession={handleLoadHistorySession}
            onExportSession={(session) =>
              downloadCsvFromRecords(
                session.registros,
                `consulta_simples_${session.criadoEm.slice(0, 10)}.csv`
              )
            }
            onDeleteSession={(id) => setHistory((prev) => prev.filter((s) => s.id !== id))}
            onClearHistory={() => setHistory([])}
            onGoToConsulta={() => setActiveTab('consulta')}
          />
        ) : activeTab === 'fontes' ? (
          <DataSourcesView onGoToConsulta={() => setActiveTab('consulta')} />
        ) : (
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance sm:text-[28px]">
                  Consulta Optantes em Lote
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Verifique em lote a opção pelo Simples Nacional, enquadramento no SIMEI, situação cadastral e CNAE principal.
                </p>
              </div>
              {results.length > 0 && (
                <div className="flex items-center gap-2 sm:hidden">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 cursor-pointer"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Baixar Excel (CSV)</span>
                  </button>
                </div>
              )}
            </div>

            {notice && (
              <div
                role="status"
                className={`mb-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
                  notice.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-900'
                    : notice.type === 'warning'
                    ? 'border-amber-200 bg-amber-50 text-amber-900'
                    : 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {notice.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
                  ) : notice.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  )}
                  <span>{notice.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNotice(null)}
                  className="text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer shrink-0"
                >
                  Dispensar
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
              {/* Painel Esquerdo: Entrada de CNPJs */}
              <section
                aria-label="Entrada de CNPJs em lote"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDrop}
                className={`rounded-xl border bg-white p-5 transition-colors ${
                  isDraggingFile ? 'border-emerald-600 bg-emerald-50/30' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="campoCnpjs"
                    className="font-display text-sm font-semibold text-slate-900"
                  >
                    Lista de CNPJs
                  </label>
                  <div className="flex items-center gap-3 text-xs">
                    <button
                      type="button"
                      onClick={handleLoadSample}
                      disabled={isRunning}
                      className="font-medium text-emerald-800 hover:text-emerald-950 hover:underline disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      Carregar exemplo
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isRunning}
                      className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Importar CSV/TXT</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt,.tsv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  Cole um CNPJ por linha (ou separado por vírgula/ponto e vírgula) ou arraste um arquivo CSV/TXT.
                </p>

                <textarea
                  id="campoCnpjs"
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  disabled={isRunning}
                  placeholder={'53.284.974/0001-00\n15.354.448/0001-80\n00.000.000/0001-91'}
                  spellCheck={false}
                  className="mt-3 h-52 w-full resize-y rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/15 disabled:opacity-60"
                />

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums">
                    <span>
                      <strong className="font-semibold text-slate-900">
                        {parsedInput.validos.length}
                      </strong>{' '}
                      CNPJ(s) único(s)
                    </span>
                    {parsedInput.duplicatesRemoved > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{parsedInput.duplicatesRemoved} duplicado(s) ignorado(s)</span>
                      </>
                    )}
                    {parsedInput.ignoredLinesCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{parsedInput.ignoredLinesCount} linha(s) inválida(s)</span>
                      </>
                    )}
                  </div>
                </div>

                {parsedInput.invalidCheckDigits.length > 0 && (
                  <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
                    <div>
                      <span className="font-medium">
                        {parsedInput.invalidCheckDigits.length} CNPJ(s) com dígito verificador suspeito:
                      </span>{' '}
                      <span className="font-mono tabular-nums">
                        {parsedInput.invalidCheckDigits.slice(0, 3).join(', ')}
                        {parsedInput.invalidCheckDigits.length > 3 ? '…' : ''}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                  <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={incluirExtras}
                      onChange={(e) => setIncluirExtras(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                    />
                    <span>
                      Incluir <strong className="font-medium text-slate-900">Situação Cadastral</strong> e{' '}
                      <strong className="font-medium text-slate-900">CNAE Principal</strong> na tabela e na planilha CSV
                    </span>
                  </label>

                  <div className="flex items-center justify-between gap-3 text-xs text-slate-600">
                    <label htmlFor="intervalo-select">Intervalo entre requisições:</label>
                    <select
                      id="intervalo-select"
                      value={delayMs}
                      disabled={isRunning}
                      onChange={(e) => setDelayMs(Number(e.target.value))}
                      className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-emerald-700 focus:outline-none"
                    >
                      <option value={800}>0,8s (rápido)</option>
                      <option value={1300}>1,3s (padrão seguro)</option>
                      <option value={2000}>2,0s (lotes grandes)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2.5">
                  {!isRunning ? (
                    <button
                      type="button"
                      onClick={handleStartBatch}
                      disabled={parsedInput.validos.length === 0}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:bg-slate-200 disabled:text-slate-500 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Play className="h-4 w-4" aria-hidden="true" />
                      <span>Consultar {parsedInput.validos.length} CNPJ(s)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStopBatch}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      <span>Parar consulta</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Limpar
                  </button>
                </div>

                {isRunning && progress && (
                  <div className="mt-4 border-t border-slate-200 pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-emerald-900">
                        Consultando {progress.current} de {progress.total}
                      </span>
                      <span className="font-mono text-slate-600 tabular-nums">
                        {progressPercent}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-emerald-700 transition-all duration-200"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="mt-1.5 font-mono text-xs text-slate-500 tabular-nums">
                      Atual: {progress.currentCnpj}
                    </p>
                  </div>
                )}
              </section>

              {/* Painel Direito: Métricas e Resultados */}
              <section aria-label="Resultados da consulta" className="min-w-0 space-y-4">
                {/* Faixa de Resumo (4 colunas unidas por divisores, sem cards aninhados) */}
                <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                  <div className="px-4 py-3.5">
                    <p className="text-xs font-medium text-slate-500">Consultados</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                      {stats.total}
                    </p>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-xs font-medium text-slate-500">Optantes Simples</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-emerald-800 tabular-nums">
                      {stats.simples}
                    </p>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-xs font-medium text-slate-500">Enquadrados SIMEI</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-emerald-800 tabular-nums">
                      {stats.simei}
                    </p>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-xs font-medium text-slate-500">Não Optantes / Erros</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-slate-700 tabular-nums">
                      {stats.naoOptantes + stats.erros}
                    </p>
                  </div>
                </div>

                {/* Barra de Ferramentas dos Resultados */}
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                    {(
                      [
                        { id: 'todos', label: `Todos (${stats.total})` },
                        { id: 'simples', label: `Simples (${stats.simples})` },
                        { id: 'simei', label: `SIMEI (${stats.simei})` },
                        { id: 'nao_optantes', label: `Não Optantes (${stats.naoOptantes})` },
                        { id: 'erros', label: `Erros (${stats.erros})` },
                      ] as Array<{ id: FilterStatus; label: string }>
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilterStatus(tab.id)}
                        className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          filterStatus === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 sm:w-56 sm:flex-none">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filtrar CNPJ, razão ou CNAE..."
                        className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:outline-none"
                      />
                    </div>

                    <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('tabela')}
                        aria-label="Visualização em tabela"
                        title="Tabela"
                        className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                          viewMode === 'tabela'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Table2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('cartoes')}
                        aria-label="Visualização em cartões"
                        title="Cartões"
                        className={`rounded-md p-1.5 transition-colors cursor-pointer ${
                          viewMode === 'cartoes'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyResults}
                      disabled={results.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                          <span className="text-emerald-800">Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportCsv}
                      disabled={results.length === 0}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* Estado Vazio / Carregando / Tabela / Cartões */}
                {results.length === 0 && !isRunning ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
                      <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h2 className="mt-4 font-display text-base font-semibold text-slate-900">
                      Aguardando CNPJs para consulta
                    </h2>
                    <p className="mt-1.5 mx-auto max-w-md text-sm text-slate-600">
                      Cole os CNPJs na caixa à esquerda ou importe uma planilha CSV/TXT. Os resultados aparecerão em tempo real com opção de copiar ou baixar para Excel.
                    </p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={handleLoadSample}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Carregar CNPJs de exemplo
                      </button>
                    </div>
                  </div>
                ) : viewMode === 'tabela' ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b border-slate-200 bg-slate-50/90 text-xs font-semibold text-slate-600">
                          <tr>
                            <th className="px-4 py-3 whitespace-nowrap">CNPJ</th>
                            <th className="px-4 py-3">Razão Social</th>
                            <th className="px-4 py-3 whitespace-nowrap">Simples Nacional</th>
                            <th className="px-4 py-3 whitespace-nowrap">SIMEI</th>
                            {incluirExtras && (
                              <th className="px-4 py-3 whitespace-nowrap">Situação · CNAE</th>
                            )}
                            <th className="px-4 py-3 text-right whitespace-nowrap">Detalhes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredResults.map((item) => (
                            <tr
                              key={item.cnpj}
                              onClick={() => setSelectedRecord(item)}
                              className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                            >
                              <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 tabular-nums whitespace-nowrap">
                                {item.cnpjFormatado}
                              </td>
                              <td className="px-4 py-3 min-w-[200px] max-w-[260px]">
                                {item.sucesso ? (
                                  <div>
                                    <p className="truncate font-medium text-slate-900" title={item.razaoSocial}>
                                      {item.razaoSocial || 'Sem razão social'}
                                    </p>
                                    {(item.municipio || item.uf) && (
                                      <p className="text-xs text-slate-500 truncate">
                                        {item.municipio}
                                        {item.municipio && item.uf ? '/' : ''}
                                        {item.uf}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs font-medium text-red-700">
                                    {item.erro || 'Erro na consulta'}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                {!item.sucesso ? (
                                  <span className="inline-flex items-center gap-1.5 text-red-700 font-medium">
                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span>Erro</span>
                                  </span>
                                ) : item.opcaoSimples ? (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                                    <span>{item.textoSimples}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                                    <MinusCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <span>NÃO optante</span>
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap">
                                {!item.sucesso ? (
                                  <span className="text-slate-400">-</span>
                                ) : item.opcaoMei ? (
                                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-800">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden="true" />
                                    <span>{item.textoSimei}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-slate-600">
                                    <MinusCircle className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                                    <span>NÃO enquadrado</span>
                                  </span>
                                )}
                              </td>
                              {incluirExtras && (
                                <td className="px-4 py-3 text-xs max-w-[240px]">
                                  {item.sucesso ? (
                                    <div>
                                      <span
                                        className={`font-semibold ${
                                          item.situacaoCadastral.toUpperCase() === 'ATIVA'
                                            ? 'text-emerald-800'
                                            : 'text-amber-800'
                                        }`}
                                      >
                                        {item.situacaoCadastral}
                                      </span>
                                      {item.cnaeCodigo && (
                                        <p
                                          className="mt-0.5 truncate text-slate-500"
                                          title={`${item.cnaeCodigo} - ${item.cnaeDescricao}`}
                                        >
                                          <span className="font-mono text-slate-700 tabular-nums">
                                            {item.cnaeCodigo}
                                          </span>{' '}
                                          {item.cnaeDescricao}
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                              )}
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRecord(item);
                                  }}
                                  className="text-xs font-medium text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
                                >
                                  Ver ficha
                                </button>
                              </td>
                            </tr>
                          ))}

                          {isRunning && progress && (
                            <tr aria-label="Carregando próximo CNPJ">
                              <td className="px-4 py-3 font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
                                {progress.currentCnpj}
                              </td>
                              <td className="px-4 py-3">
                                <div className="h-3.5 w-44 animate-pulse rounded bg-slate-200" />
                              </td>
                              <td className="px-4 py-3">
                                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-200" />
                              </td>
                              <td className="px-4 py-3">
                                <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200" />
                              </td>
                              {incluirExtras && (
                                <td className="px-4 py-3">
                                  <div className="h-3.5 w-36 animate-pulse rounded bg-slate-200" />
                                </td>
                              )}
                              <td className="px-4 py-3 text-right">
                                <span className="text-xs text-slate-400">Consultando…</span>
                              </td>
                            </tr>
                          )}

                          {!isRunning && filteredResults.length === 0 && results.length > 0 && (
                            <tr>
                              <td
                                colSpan={incluirExtras ? 6 : 5}
                                className="px-4 py-10 text-center text-sm text-slate-500"
                              >
                                Nenhum registro corresponde ao filtro atual.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredResults.map((item) => (
                      <article
                        key={item.cnpj}
                        onClick={() => setSelectedRecord(item)}
                        className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition-colors cursor-pointer"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                            {item.cnpjFormatado}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-slate-600">
                            {item.razaoSocial && (
                              <span className="font-medium text-slate-800">{item.razaoSocial}</span>
                            )}
                            {item.sucesso && incluirExtras && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={
                                    item.situacaoCadastral.toUpperCase() === 'ATIVA'
                                      ? 'font-semibold text-emerald-800'
                                      : 'font-semibold text-amber-800'
                                  }
                                >
                                  {item.situacaoCadastral}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="px-4 py-3.5 text-sm space-y-1.5">
                          {!item.sucesso ? (
                            <p className="flex items-center gap-2 text-red-700 font-medium">
                              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span>{item.erro || 'Erro na consulta'}</span>
                            </p>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-slate-600">Situação no Simples Nacional:</span>
                                <span
                                  className={`inline-flex items-center gap-1.5 font-semibold ${
                                    item.opcaoSimples ? 'text-emerald-800' : 'text-slate-800'
                                  }`}
                                >
                                  {item.opcaoSimples ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
                                  ) : (
                                    <MinusCircle className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                                  )}
                                  <span>{item.textoSimples}</span>
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-slate-600">Situação no SIMEI:</span>
                                <span
                                  className={`inline-flex items-center gap-1.5 font-semibold ${
                                    item.opcaoMei ? 'text-emerald-800' : 'text-slate-800'
                                  }`}
                                >
                                  {item.opcaoMei ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
                                  ) : (
                                    <MinusCircle className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                                  )}
                                  <span>{item.textoSimei}</span>
                                </span>
                              </div>

                              {incluirExtras && item.cnaeCodigo && (
                                <p className="pt-1 text-xs text-slate-600">
                                  CNAE Principal:{' '}
                                  <span className="font-mono font-medium text-slate-800 tabular-nums">
                                    {item.cnaeCodigo}
                                  </span>{' '}
                                  {item.cnaeDescricao ? `— ${item.cnaeDescricao}` : ''}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </article>
                    ))}

                    {isRunning && progress && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-slate-600 tabular-nums">
                            {progress.currentCnpj}
                          </span>
                          <span className="text-xs text-slate-400">Consultando…</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-200" />
                          <div className="h-3.5 w-1/2 animate-pulse rounded bg-slate-200" />
                        </div>
                      </div>
                    )}

                    {!isRunning && filteredResults.length === 0 && results.length > 0 && (
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                        Nenhum cartão corresponde ao filtro atual.
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
          <p>
            Dados públicos da base de CNPJ da Receita Federal (via BrasilAPI e Minha Receita). Podem apresentar defasagem de alguns dias em relação ao portal oficial.
          </p>
          <button
            type="button"
            onClick={() => setActiveTab('fontes')}
            className="font-medium text-slate-700 hover:text-slate-900 hover:underline cursor-pointer whitespace-nowrap"
          >
            Detalhes técnicos e CSV
          </button>
        </div>
      </footer>

      <CnpjDetailDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
