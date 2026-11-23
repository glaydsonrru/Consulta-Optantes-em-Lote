import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCircle2, Copy, MinusCircle, X } from 'lucide-react';
import type { CnpjRecord } from '../types/cnpj';
import { formatIsoDate } from '../utils/cnpj';

interface CnpjDetailDrawerProps {
  record: CnpjRecord | null;
  onClose: () => void;
}

export function CnpjDetailDrawer({ record, onClose }: CnpjDetailDrawerProps) {
  const [copiedCnpj, setCopiedCnpj] = useState(false);

  useEffect(() => {
    if (!record) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [record, onClose]);

  if (!record) return null;

  const handleCopyCnpj = async () => {
    try {
      await navigator.clipboard.writeText(record.cnpjFormatado);
      setCopiedCnpj(true);
      setTimeout(() => setCopiedCnpj(false), 1800);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white border-l border-slate-200 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span
                id="drawer-title"
                className="font-mono text-base font-semibold text-slate-900 tabular-nums"
              >
                {record.cnpjFormatado}
              </span>
              <button
                type="button"
                onClick={handleCopyCnpj}
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                title="Copiar CNPJ formatado"
              >
                {copiedCnpj ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    <span className="text-emerald-700">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
            <h2 className="mt-1 font-display text-lg font-semibold text-slate-900 leading-snug">
              {record.razaoSocial || 'Empresa não localizada'}
            </h2>
            {record.nomeFantasia && (
              <p className="mt-0.5 text-sm text-slate-500">
                Nome fantasia: {record.nomeFantasia}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {!record.sucesso ? (
            <div className="rounded-lg border border-red-200 bg-red-50/70 p-4 text-sm text-red-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-700 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Não foi possível consultar este CNPJ</p>
                <p className="mt-1 text-red-700">{record.erro}</p>
              </div>
            </div>
          ) : (
            <>
              <section aria-labelledby="sec-tributario">
                <h3
                  id="sec-tributario"
                  className="font-display text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Regime Tributário
                </h3>
                <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
                  <div className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Simples Nacional</p>
                      <p
                        className={`mt-1 text-sm font-semibold flex items-center gap-1.5 ${
                          record.opcaoSimples ? 'text-emerald-800' : 'text-slate-700'
                        }`}
                      >
                        {record.opcaoSimples ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
                        ) : (
                          <MinusCircle className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                        )}
                        <span>{record.textoSimples}</span>
                      </p>
                      {record.dataExclusaoSimples && (
                        <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                          Última exclusão registrada: {formatIsoDate(record.dataExclusaoSimples)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">SIMEI (MEI)</p>
                      <p
                        className={`mt-1 text-sm font-semibold flex items-center gap-1.5 ${
                          record.opcaoMei ? 'text-emerald-800' : 'text-slate-700'
                        }`}
                      >
                        {record.opcaoMei ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
                        ) : (
                          <MinusCircle className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                        )}
                        <span>{record.textoSimei}</span>
                      </p>
                      {record.dataExclusaoMei && (
                        <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
                          Última exclusão do SIMEI: {formatIsoDate(record.dataExclusaoMei)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section aria-labelledby="sec-cadastral">
                <h3
                  id="sec-cadastral"
                  className="font-display text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Dados Cadastrais
                </h3>
                <dl className="mt-3 grid grid-cols-1 gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">Situação Cadastral</dt>
                    <dd
                      className={`mt-0.5 text-sm font-semibold ${
                        record.situacaoCadastral.toUpperCase() === 'ATIVA'
                          ? 'text-emerald-800'
                          : 'text-amber-800'
                      }`}
                    >
                      {record.situacaoCadastral}
                      {record.dataSituacaoCadastral
                        ? ` · ${formatIsoDate(record.dataSituacaoCadastral)}`
                        : ''}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">Início de Atividade</dt>
                    <dd className="mt-0.5 font-mono text-sm text-slate-900 tabular-nums">
                      {formatIsoDate(record.dataInicioAtividade) || 'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">Porte da Empresa</dt>
                    <dd className="mt-0.5 text-sm text-slate-900">
                      {record.porte || 'Não informado'}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-xs text-slate-500">Natureza Jurídica</dt>
                    <dd className="mt-0.5 text-sm text-slate-900">
                      {record.naturezaJuridica || 'Não informada'}
                    </dd>
                  </div>

                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500">Endereço</dt>
                    <dd className="mt-0.5 text-sm text-slate-900">
                      {record.enderecoCompleto || 'Não informado'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="sec-cnae">
                <h3
                  id="sec-cnae"
                  className="font-display text-xs font-semibold uppercase tracking-wider text-slate-500"
                >
                  Atividades Econômicas (CNAE)
                </h3>
                <div className="mt-3 rounded-lg border border-slate-200 divide-y divide-slate-200">
                  <div className="p-4">
                    <p className="text-xs text-slate-500">CNAE Principal</p>
                    <p className="mt-1 text-sm text-slate-900">
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {record.cnaeCodigo || '-'}
                      </span>
                      {record.cnaeDescricao ? ` — ${record.cnaeDescricao}` : ''}
                    </p>
                  </div>

                  {record.cnaesSecundarios.length > 0 && (
                    <div className="p-4">
                      <p className="text-xs text-slate-500 mb-2">
                        CNAEs Secundários ({record.cnaesSecundarios.length})
                      </p>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {record.cnaesSecundarios.slice(0, 8).map((cnae, idx) => (
                          <li key={`${cnae.codigo}-${idx}`} className="leading-relaxed">
                            <span className="font-mono font-medium text-slate-900 tabular-nums">
                              {cnae.codigo}
                            </span>
                            {cnae.descricao ? ` — ${cnae.descricao}` : ''}
                          </li>
                        ))}
                        {record.cnaesSecundarios.length > 8 && (
                          <li className="text-slate-500 italic">
                            + {record.cnaesSecundarios.length - 8} atividade(s) secundária(s)
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Fonte: {record.fonte || 'Consulta pública'} ·{' '}
            <span className="font-mono tabular-nums">
              {new Date(record.consultadoEm).toLocaleString('pt-BR')}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-medium text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
