import { Download } from 'lucide-react';
import type { ActiveTab } from '../types/cnpj';

interface HeaderProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  hasResults: boolean;
  onExportCsv: () => void;
}

export function Header({ activeTab, onChangeTab, hasResults, onExportCsv }: HeaderProps) {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'consulta', label: 'Consulta em Lote' },
    { id: 'historico', label: 'Histórico' },
    { id: 'fontes', label: 'Fontes de Dados' },
  ];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onChangeTab('consulta');
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
        >
          Consulta Simples
        </a>

        <nav aria-label="Navegação principal" className="flex items-center gap-6 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700 ${
                  isActive
                    ? 'text-emerald-800'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-emerald-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden sm:flex items-center shrink-0">
          <button
            type="button"
            onClick={onExportCsv}
            disabled={!hasResults}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              hasResults
                ? 'bg-emerald-800 text-white hover:bg-emerald-900 cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Baixar Excel (CSV)</span>
          </button>
        </div>
      </div>
    </header>
  );
}
