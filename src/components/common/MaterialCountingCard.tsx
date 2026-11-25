import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { MaterialCategory, MaterialItem, MaterialDailyEntry } from '../../types/inventory';
import { MaterialCategoryFigure } from '../MaterialCategoryIcons';

export interface MaterialCountingCardProps {
  item: MaterialItem;
  catConfig?: { id: MaterialCategory; label: string; icon: string };
  countEntry: MaterialDailyEntry;
  onUpdate: (id: string, updates: Partial<MaterialDailyEntry>) => void;
  disabled?: boolean;
  lastInsertedQty?: number | null;
  onRecordLastInserted?: (id: string, qty: number) => void;
  isRecontagem?: boolean;
  wasCountedInitially?: boolean;
}

export const MaterialCountingCard: React.FC<MaterialCountingCardProps> = ({
  item,
  catConfig,
  countEntry,
  onUpdate,
  disabled = false,
  lastInsertedQty,
  onRecordLastInserted,
  isRecontagem = false,
  wasCountedInitially = true,
}) => {
  const isBarril =
    item.category === 'barril' ||
    (isRecontagem && item.name.toLowerCase().includes('barril'));
  const isCO2 =
    item.category === 'co2' ||
    (isRecontagem &&
      (item.name.toLowerCase().includes('co2') ||
        item.name.toLowerCase().includes('cilindro')));

  // Lote digitado para a próxima contagem (zera após somar ao consolidado)
  const [batch, setBatch] = useState({
    disponivel: 0,
    danificado: 0,
    barrilCheio: 0,
    barrilVazio: 0,
    barrilEmRota: 0,
    co2Cheio: 0,
    co2Mexido: 0,
    co2Vazio: 0,
    co2EmRota: 0,
  });

  const totalBatch = isBarril
    ? (batch.barrilCheio || 0) + (batch.barrilVazio || 0) + (batch.barrilEmRota || 0)
    : isCO2
      ? (batch.co2Cheio || 0) +
        (batch.co2Mexido || 0) +
        (batch.co2Vazio || 0) +
        (batch.co2EmRota || 0)
      : (batch.disponivel || 0) + (batch.danificado || 0);

  // Quantidade total acumulada no campo consolidado
  const totalConsolidado = isBarril
    ? (countEntry.barrilCheio || 0) +
      (countEntry.barrilVazio || 0) +
      (countEntry.barrilEmRota || 0)
    : isCO2
      ? (countEntry.co2Cheio || 0) +
        (countEntry.co2Mexido || 0) +
        (countEntry.co2Vazio || 0) +
        (countEntry.co2EmRota || 0)
      : (countEntry.disponivel || 0) + (countEntry.danificado || 0);

  // Ao inserir a contagem esse campo irá somar com as quantidades já contadas e os campos abaixo irão zerar
  const handleCommitBatch = () => {
    if (totalBatch === 0 || disabled) return;

    if (isBarril) {
      onUpdate(item.id, {
        barrilCheio: (countEntry.barrilCheio || 0) + (batch.barrilCheio || 0),
        barrilVazio: (countEntry.barrilVazio || 0) + (batch.barrilVazio || 0),
        barrilEmRota: (countEntry.barrilEmRota || 0) + (batch.barrilEmRota || 0),
      });
      setBatch(prev => ({
        ...prev,
        barrilCheio: 0,
        barrilVazio: 0,
        barrilEmRota: 0,
      }));
    } else if (isCO2) {
      onUpdate(item.id, {
        co2Cheio: (countEntry.co2Cheio || 0) + (batch.co2Cheio || 0),
        co2Mexido: (countEntry.co2Mexido || 0) + (batch.co2Mexido || 0),
        co2Vazio: (countEntry.co2Vazio || 0) + (batch.co2Vazio || 0),
        co2EmRota: (countEntry.co2EmRota || 0) + (batch.co2EmRota || 0),
      });
      setBatch(prev => ({
        ...prev,
        co2Cheio: 0,
        co2Mexido: 0,
        co2Vazio: 0,
        co2EmRota: 0,
      }));
    } else {
      onUpdate(item.id, {
        disponivel: (countEntry.disponivel || 0) + (batch.disponivel || 0),
        danificado: (countEntry.danificado || 0) + (batch.danificado || 0),
      });
      setBatch(prev => ({ ...prev, disponivel: 0, danificado: 0 }));
    }

    onRecordLastInserted?.(item.id, totalBatch);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitBatch();
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl p-3.5 space-y-3 shadow-xs transition-all ${
        isRecontagem
          ? 'border-2 border-amber-300 hover:border-amber-400'
          : 'border border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* 1. CABEÇALHO COM NOME DO MATERIAL, TOTAL CONSOLIDADO E ÚLTIMA QTD. INSERIDA */}
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
            <MaterialCategoryFigure category={item.category} size="md" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-xs font-black text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                {isRecontagem ? `[${item.code}]` : item.code}
              </span>
              {isRecontagem && (
                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-black uppercase rounded-full shrink-0">
                  Recontar
                </span>
              )}
              {isRecontagem && !wasCountedInitially && (
                <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                  Não contado inicialmente
                </span>
              )}
              <h4 className="font-bold text-slate-900 text-sm leading-tight">{item.name}</h4>
            </div>
            {(catConfig?.label || item.description) && (
              <p className="text-[11px] text-slate-500 mt-0.5">
                {catConfig?.label} {item.description && `• ${item.description}`}
              </p>
            )}
          </div>
        </div>

        {/* Total Consolidado + Última Qtd. Inserida (lado direito do Total Consolidado) */}
        <div className="flex items-start gap-2 shrink-0 ml-auto">
          <div className="text-right shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Consolidado
            </span>
            <span className="font-mono font-black text-xs sm:text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 inline-block">
              {totalConsolidado} un
            </span>
          </div>

          <div
            className="text-right shrink-0"
            title="Última quantidade inserida na contagem deste material"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
              Última Inserida
            </span>
            <span className="font-mono font-black text-xs sm:text-sm text-amber-950 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 inline-block min-w-[54px] text-center">
              {lastInsertedQty !== undefined && lastInsertedQty !== null
                ? `${lastInsertedQty} un`
                : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. CAMPO CONSOLIDADO (ENTRE O NOME E OS BOTÕES DE INSERÇÃO) */}
      <div className="bg-slate-50/90 border-2 border-indigo-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950">
              {isRecontagem
                ? 'Recontagem Consolidada (Editável pelo Contador)'
                : 'Contagem Consolidada (Editável pelo Contador)'}
            </span>
          </div>
          <span className="text-[10px] text-indigo-700 font-medium">Acumulado</span>
        </div>

        {isBarril ? (
          /* BARRIL CONSOLIDADO */
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-emerald-300 rounded-lg p-2 text-center shadow-2xs">
              <label className="text-[10px] font-black text-emerald-900 uppercase block mb-1">
                Cheio
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.barrilCheio || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    barrilCheio: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-base font-black text-emerald-950 focus:outline-none focus:bg-emerald-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar quantidade consolidada de barris cheios"
              />
            </div>
            <div className="bg-white border border-orange-300 rounded-lg p-2 text-center shadow-2xs">
              <label className="text-[10px] font-black text-orange-900 uppercase block mb-1">
                Vazio
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.barrilVazio || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    barrilVazio: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-base font-black text-orange-950 focus:outline-none focus:bg-orange-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar quantidade consolidada de barris vazios"
              />
            </div>
            <div className="bg-white border border-sky-300 rounded-lg p-2 text-center shadow-2xs">
              <label className="text-[10px] font-black text-sky-900 uppercase block mb-1">
                Em Rota
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.barrilEmRota || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    barrilEmRota: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-base font-black text-sky-950 focus:outline-none focus:bg-sky-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar quantidade consolidada de barris em rota"
              />
            </div>
          </div>
        ) : isCO2 ? (
          /* CO2 CONSOLIDADO */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white border border-emerald-300 rounded-lg p-1.5 text-center shadow-2xs">
              <label className="text-[10px] font-black text-emerald-900 uppercase block mb-1">
                Cheio
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.co2Cheio || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    co2Cheio: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-sm font-black text-emerald-950 focus:outline-none focus:bg-emerald-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar consolidado CO2 cheio"
              />
            </div>
            <div className="bg-white border border-amber-300 rounded-lg p-1.5 text-center shadow-2xs">
              <label className="text-[10px] font-black text-amber-900 uppercase block mb-1">
                Mexido
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.co2Mexido || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    co2Mexido: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-sm font-black text-amber-950 focus:outline-none focus:bg-amber-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar consolidado CO2 mexido"
              />
            </div>
            <div className="bg-white border border-orange-300 rounded-lg p-1.5 text-center shadow-2xs">
              <label className="text-[10px] font-black text-orange-900 uppercase block mb-1">
                Vazio
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.co2Vazio || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    co2Vazio: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-sm font-black text-orange-950 focus:outline-none focus:bg-orange-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar consolidado CO2 vazio"
              />
            </div>
            <div className="bg-white border border-sky-300 rounded-lg p-1.5 text-center shadow-2xs">
              <label className="text-[10px] font-black text-sky-900 uppercase block mb-1">
                Em Rota
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.co2EmRota || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    co2EmRota: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-sm font-black text-sky-950 focus:outline-none focus:bg-sky-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar consolidado CO2 em rota"
              />
            </div>
          </div>
        ) : (
          /* CONVENCIONAIS CONSOLIDADOS (Mesas, Cadeiras, Caixas Térmicas) */
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white border border-emerald-300 rounded-lg p-2 text-center shadow-2xs">
              <label className="text-[11px] font-black text-emerald-900 uppercase block mb-1">
                Disponível
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.disponivel || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    disponivel: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-base font-black text-emerald-950 focus:outline-none focus:bg-emerald-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar quantidade consolidada disponível"
              />
            </div>
            <div className="bg-white border border-rose-300 rounded-lg p-2 text-center shadow-2xs">
              <label className="text-[11px] font-black text-rose-900 uppercase block mb-1">
                Danificado
              </label>
              <input
                type="number"
                min="0"
                disabled={disabled}
                value={countEntry.danificado || 0}
                onChange={e =>
                  onUpdate(item.id, {
                    danificado: Math.max(0, parseInt(e.target.value) || 0),
                  })
                }
                className="w-full text-center bg-transparent font-mono text-base font-black text-rose-950 focus:outline-none focus:bg-rose-50 rounded disabled:opacity-60 disabled:cursor-not-allowed"
                title="Editar quantidade consolidada danificada"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTÕES DE INSERÇÃO DE CONTAGEM (LOTE QUE ZERA APÓS SOMAR) */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            {isRecontagem
              ? 'Inserir Recontagem (Zera após somar):'
              : 'Inserir Contagem (Zera após somar):'}
          </span>
          {totalBatch > 0 && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Aguardando inserção (+{totalBatch} un)
            </span>
          )}
        </div>

        {isBarril ? (
          /* BARRIS INSERÇÃO */
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-2 text-center space-y-1">
              <span className="text-[10px] font-black text-emerald-900 uppercase block">
                + Cheio
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      barrilCheio: Math.max(0, prev.barrilCheio - 1),
                    }))
                  }
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.barrilCheio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      barrilCheio: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-10 text-center bg-transparent font-mono text-sm font-black text-emerald-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, barrilCheio: prev.barrilCheio + 1 }))
                  }
                  className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-orange-50/70 border border-orange-300 rounded-xl p-2 text-center space-y-1">
              <span className="text-[10px] font-black text-orange-900 uppercase block">
                + Vazio
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      barrilVazio: Math.max(0, prev.barrilVazio - 1),
                    }))
                  }
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.barrilVazio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      barrilVazio: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-10 text-center bg-transparent font-mono text-sm font-black text-orange-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, barrilVazio: prev.barrilVazio + 1 }))
                  }
                  className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-sky-50/70 border border-sky-300 rounded-xl p-2 text-center space-y-1">
              <span className="text-[10px] font-black text-sky-900 uppercase block">
                + Em Rota
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      barrilEmRota: Math.max(0, prev.barrilEmRota - 1),
                    }))
                  }
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.barrilEmRota || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      barrilEmRota: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-10 text-center bg-transparent font-mono text-sm font-black text-sky-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, barrilEmRota: prev.barrilEmRota + 1 }))
                  }
                  className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : isCO2 ? (
          /* CO2 INSERÇÃO */
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-1.5 text-center space-y-1">
              <span className="text-[10px] font-black text-emerald-900 uppercase block">
                + Cheio
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      co2Cheio: Math.max(0, prev.co2Cheio - 1),
                    }))
                  }
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.co2Cheio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      co2Cheio: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-emerald-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, co2Cheio: prev.co2Cheio + 1 }))
                  }
                  className="w-5 h-5 rounded bg-emerald-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-1.5 text-center space-y-1">
              <span className="text-[10px] font-black text-amber-900 uppercase block">
                + Mexido
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      co2Mexido: Math.max(0, prev.co2Mexido - 1),
                    }))
                  }
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.co2Mexido || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      co2Mexido: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-amber-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, co2Mexido: prev.co2Mexido + 1 }))
                  }
                  className="w-5 h-5 rounded bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-orange-50/70 border border-orange-300 rounded-xl p-1.5 text-center space-y-1">
              <span className="text-[10px] font-black text-orange-900 uppercase block">
                + Vazio
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      co2Vazio: Math.max(0, prev.co2Vazio - 1),
                    }))
                  }
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.co2Vazio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      co2Vazio: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-orange-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, co2Vazio: prev.co2Vazio + 1 }))
                  }
                  className="w-5 h-5 rounded bg-orange-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-sky-50/70 border border-sky-300 rounded-xl p-1.5 text-center space-y-1">
              <span className="text-[10px] font-black text-sky-900 uppercase block">
                + Em Rota
              </span>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      co2EmRota: Math.max(0, prev.co2EmRota - 1),
                    }))
                  }
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.co2EmRota || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      co2EmRota: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-sky-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, co2EmRota: prev.co2EmRota + 1 }))
                  }
                  className="w-5 h-5 rounded bg-sky-600 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* CONVENCIONAIS INSERÇÃO */
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-2 text-center space-y-1">
              <span className="text-xs font-black text-emerald-900 uppercase block">
                + Disponível
              </span>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      disponivel: Math.max(0, prev.disponivel - 1),
                    }))
                  }
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.disponivel || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      disponivel: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-14 text-center bg-transparent font-mono text-base font-black text-emerald-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, disponivel: prev.disponivel + 1 }))
                  }
                  className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-300 rounded-xl p-2 text-center space-y-1">
              <span className="text-xs font-black text-rose-900 uppercase block">
                + Danificado
              </span>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({
                      ...prev,
                      danificado: Math.max(0, prev.danificado - 1),
                    }))
                  }
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  disabled={disabled}
                  value={batch.danificado || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e =>
                    setBatch(prev => ({
                      ...prev,
                      danificado: Math.max(0, parseInt(e.target.value) || 0),
                    }))
                  }
                  className="w-14 text-center bg-transparent font-mono text-base font-black text-rose-950 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setBatch(prev => ({ ...prev, danificado: prev.danificado + 1 }))
                  }
                  className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Botão de Inserir / Somar Contagem: soma ao consolidado e zera os campos abaixo */}
        <button
          type="button"
          onClick={handleCommitBatch}
          disabled={totalBatch === 0 || disabled}
          className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
            disabled
              ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
              : totalBatch > 0
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300 cursor-pointer active:scale-[0.98]'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
          }`}
          title={
            disabled
              ? 'Contagem bloqueada'
              : 'Somar as quantidades digitadas ao campo consolidado acima e zerar para a próxima contagem'
          }
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>
            {disabled
              ? 'Contagem Bloqueada'
              : totalBatch > 0
                ? isRecontagem
                  ? `Inserir Recontagem (+${totalBatch} un) e Zerar Campos`
                  : `Inserir Contagem (+${totalBatch} un) e Zerar Campos`
                : isRecontagem
                  ? 'Inserir Recontagem (Digite a quantidade acima para somar)'
                  : 'Inserir Contagem (Digite a quantidade acima para somar)'}
          </span>
        </button>
      </div>
    </div>
  );
};
