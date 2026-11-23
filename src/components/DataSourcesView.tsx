export function DataSourcesView({ onGoToConsulta }: { onGoToConsulta: () => void }) {
  return (
    <section className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Fontes de Dados e Regras de Exportação
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Entenda como os dados públicos do Simples Nacional, SIMEI e Cadastro Nacional de Pessoa Jurídica são consultados e formatados.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Bases Públicas Consultadas
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Cada CNPJ é consultado primeiramente na <strong className="font-semibold text-slate-900">BrasilAPI</strong> e, caso haja indisponibilidade ou limite temporário, o sistema recorre automaticamente à API <strong className="font-semibold text-slate-900">Minha Receita</strong>.
          </p>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            As duas bases utilizam os dados abertos publicados mensalmente pela Receita Federal do Brasil. Alterações cadastrais ou opções pelo Simples Nacional/SIMEI realizadas nos últimos dias podem levar alguns dias para refletir nas bases públicas.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            02. Controle de Taxa e Validação
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            Para evitar bloqueios por excesso de requisições (HTTP 429), as consultas em lote respeitam um intervalo entre chamadas (padrão de <span className="font-mono text-slate-800">1,3s</span>) e mantêm cache temporário no servidor para CNPJs repetidos.
          </p>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed">
            Antes de enviar, o sistema remove pontuações, elimina duplicidades e verifica os dígitos verificadores (Módulo 11) para alertar sobre possíveis erros de digitação.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 md:col-span-2">
          <h2 className="font-display text-base font-semibold text-slate-900">
            03. Compatibilidade com Excel em Português (CSV)
          </h2>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">
            O botão <strong className="font-semibold text-slate-900">Baixar Excel (CSV)</strong> gera o arquivo <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-800">consulta_simples_nacional.csv</span> com separador ponto e vírgula (<span className="font-mono">;</span>) e assinatura <span className="font-mono">UTF-8 BOM</span>, garantindo que acentos como <em>Razão Social</em>, <em>Situação</em> e <em>NÃO</em> abram perfeitamente no Microsoft Excel em português sem precisar importar manualmente.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={onGoToConsulta}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 transition-colors cursor-pointer"
            >
              Voltar para Consulta em Lote
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
