import { ArrowUpRight, Download, Trash2 } from 'lucide-react';
import type { BatchSession } from '../types/cnpj';

interface HistoryViewProps {
  sessions: BatchSession[];
  onLoadSession: (session: BatchSession) => void;
  onExportSession: (session: BatchSession) => void;
  onDeleteSession: (id: string) => void;
  onClearHistory: () => void;
  onGoToConsulta: () => void;
}

export function HistoryView({
  sessions,
  onLoadSession,
  onExportSession,
  onDeleteSession,
  onClearHistory,
  onGoToConsulta,
}: HistoryViewProps) {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Histórico de Lotes Consultados
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Lotes salvos localmente no navegador para reabertura instantânea ou nova exportação em Excel (CSV).
          </p>
        </div>

        {sessions.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>Limpar histórico</span>
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-12 text-center">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Nenhum lote registrado ainda
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
            Assim que você executar uma consulta em lote, o resumo e os resultados ficarão disponíveis aqui para reconsulta sem gastar novas requisições.
          </p>
          <button
            type="button"
            onClick={onGoToConsulta}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 transition-colors cursor-pointer"
          >
            <span>Ir para Consulta em Lote</span>
          </button>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-4 py-3">Data e Hora</th>
                  <th className="px-4 py-3 text-right">CNPJs</th>
                  <th className="px-4 py-3 text-right">Simples Nacional</th>
                  <th className="px-4 py-3 text-right">SIMEI</th>
                  <th className="px-4 py-3 text-right">Erros</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {new Date(session.criadoEm).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                      {session.total}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-800 font-medium tabular-nums">
                      {session.optantesSimples}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-800 font-medium tabular-nums">
                      {session.enquadradosSimei}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 tabular-nums">
                      {session.erros}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onLoadSession(session)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <span>Abrir lote</span>
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportSession(session)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSession(session.id)}
                          aria-label="Excluir lote do histórico"
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
