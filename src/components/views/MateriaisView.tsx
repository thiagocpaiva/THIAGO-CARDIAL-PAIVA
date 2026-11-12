
import React, { useState } from 'react';
import {
  Layers,
  Copy,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  Box,
  Truck,
  AlertCircle
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialCategory, MaterialItem, MaterialDailyEntry } from '../../types/inventory';
import { CATEGORIAS_MATERIAIS } from '../modals/CadastrarMaterialModal';
import { ModalClonarUltima } from '../modals/ModalClonarUltima';
import { AppBrandIcon } from '../AppBrandIcons';
import { MaterialCategoryFigure } from '../MaterialCategoryIcons';

interface MaterialCountingCardProps {
  item: MaterialItem;
  catConfig?: { id: MaterialCategory; label: string; icon: string };
  countEntry: MaterialDailyEntry;
  onUpdate: (id: string, updates: Partial<MaterialDailyEntry>) => void;
  disabled?: boolean;
}

const MaterialCountingCard: React.FC<MaterialCountingCardProps> = ({
  item,
  catConfig,
  countEntry,
  onUpdate,
  disabled = false,
}) => {
  const isBarril = item.category === 'barril';
  const isCO2 = item.category === 'co2';

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
    ? ((batch.barrilCheio || 0) + (batch.barrilVazio || 0) + (batch.barrilEmRota || 0))
    : isCO2
      ? ((batch.co2Cheio || 0) + (batch.co2Mexido || 0) + (batch.co2Vazio || 0) + (batch.co2EmRota || 0))
      : ((batch.disponivel || 0) + (batch.danificado || 0));

  // Quantidade total acumulada no campo consolidado
  const totalConsolidado = isBarril
    ? ((countEntry.barrilCheio || 0) + (countEntry.barrilVazio || 0) + (countEntry.barrilEmRota || 0))
    : isCO2
      ? ((countEntry.co2Cheio || 0) + (countEntry.co2Mexido || 0) + (countEntry.co2Vazio || 0) + (countEntry.co2EmRota || 0))
      : ((countEntry.disponivel || 0) + (countEntry.danificado || 0));

  // Ao inserir a contagem esse campo irá somar com as quantidades já contadas e os botões abaixo irão zerar
  const handleCommitBatch = () => {
    if (totalBatch === 0 || disabled) return;

    if (isBarril) {
      onUpdate(item.id, {
        barrilCheio: (countEntry.barrilCheio || 0) + (batch.barrilCheio || 0),
        barrilVazio: (countEntry.barrilVazio || 0) + (batch.barrilVazio || 0),
        barrilEmRota: (countEntry.barrilEmRota || 0) + (batch.barrilEmRota || 0),
      });
      setBatch(prev => ({ ...prev, barrilCheio: 0, barrilVazio: 0, barrilEmRota: 0 }));
    } else if (isCO2) {
      onUpdate(item.id, {
        co2Cheio: (countEntry.co2Cheio || 0) + (batch.co2Cheio || 0),
        co2Mexido: (countEntry.co2Mexido || 0) + (batch.co2Mexido || 0),
        co2Vazio: (countEntry.co2Vazio || 0) + (batch.co2Vazio || 0),
        co2EmRota: (countEntry.co2EmRota || 0) + (batch.co2EmRota || 0),
      });
      setBatch(prev => ({ ...prev, co2Cheio: 0, co2Mexido: 0, co2Vazio: 0, co2EmRota: 0 }));
    } else {
      onUpdate(item.id, {
        disponivel: (countEntry.disponivel || 0) + (batch.disponivel || 0),
        danificado: (countEntry.danificado || 0) + (batch.danificado || 0),
      });
      setBatch(prev => ({ ...prev, disponivel: 0, danificado: 0 }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitBatch();
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs hover:border-slate-300 transition-all">
      {/* 1. CABEÇALHO COM NOME DO MATERIAL */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
            <MaterialCategoryFigure category={item.category} size="md" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-black text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                {item.code}
              </span>
              <h4 className="font-bold text-slate-900 text-sm">{item.name}</h4>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {catConfig?.label} {item.description && `• ${item.description}`}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Consolidado
          </span>
          <span className="font-mono font-black text-xs sm:text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 inline-block">
            {totalConsolidado} un
          </span>
        </div>
      </div>

      {/* 2. CAMPO CONSOLIDADO (ENTRE O NOME E OS BOTÕES DE INSERÇÃO) */}
      {/* "inserir campo para ir consolidando as contagens inseridas de cada material, entre o nome e os botões de inserção, as quantidades desse campo poderá ser editado pelo contador" */}
      <div className="bg-slate-50/90 border-2 border-indigo-200 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950">
              Contagem Consolidada (Editável pelo Contador)
            </span>
          </div>
          <span className="text-[10px] text-indigo-700 font-medium">
            Acumulado
          </span>
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
                value={countEntry.barrilCheio || 0}
                onChange={e => onUpdate(item.id, { barrilCheio: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-base font-black text-emerald-950 focus:outline-none focus:bg-emerald-50 rounded"
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
                value={countEntry.barrilVazio || 0}
                onChange={e => onUpdate(item.id, { barrilVazio: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-base font-black text-orange-950 focus:outline-none focus:bg-orange-50 rounded"
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
                value={countEntry.barrilEmRota || 0}
                onChange={e => onUpdate(item.id, { barrilEmRota: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-base font-black text-sky-950 focus:outline-none focus:bg-sky-50 rounded"
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
                value={countEntry.co2Cheio || 0}
                onChange={e => onUpdate(item.id, { co2Cheio: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-sm font-black text-emerald-950 focus:outline-none focus:bg-emerald-50 rounded"
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
                value={countEntry.co2Mexido || 0}
                onChange={e => onUpdate(item.id, { co2Mexido: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-sm font-black text-amber-950 focus:outline-none focus:bg-amber-50 rounded"
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
                value={countEntry.co2Vazio || 0}
                onChange={e => onUpdate(item.id, { co2Vazio: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-sm font-black text-orange-950 focus:outline-none focus:bg-orange-50 rounded"
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
                value={countEntry.co2EmRota || 0}
                onChange={e => onUpdate(item.id, { co2EmRota: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-sm font-black text-sky-950 focus:outline-none focus:bg-sky-50 rounded"
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
                value={countEntry.disponivel || 0}
                onChange={e => onUpdate(item.id, { disponivel: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-base font-black text-emerald-950 focus:outline-none focus:bg-emerald-50 rounded"
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
                value={countEntry.danificado || 0}
                onChange={e => onUpdate(item.id, { danificado: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full text-center bg-transparent font-mono text-base font-black text-rose-950 focus:outline-none focus:bg-rose-50 rounded"
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
            Inserir Contagem (Zera após somar):
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
                  onClick={() => setBatch(prev => ({ ...prev, barrilCheio: Math.max(0, prev.barrilCheio - 1) }))}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.barrilCheio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, barrilCheio: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-10 text-center bg-transparent font-mono text-sm font-black text-emerald-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, barrilCheio: prev.barrilCheio + 1 }))}
                  className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs"
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
                  onClick={() => setBatch(prev => ({ ...prev, barrilVazio: Math.max(0, prev.barrilVazio - 1) }))}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.barrilVazio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, barrilVazio: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-10 text-center bg-transparent font-mono text-sm font-black text-orange-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, barrilVazio: prev.barrilVazio + 1 }))}
                  className="w-6 h-6 rounded-lg bg-orange-600 text-white flex items-center justify-center font-bold text-xs"
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
                  onClick={() => setBatch(prev => ({ ...prev, barrilEmRota: Math.max(0, prev.barrilEmRota - 1) }))}
                  className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.barrilEmRota || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, barrilEmRota: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-10 text-center bg-transparent font-mono text-sm font-black text-sky-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, barrilEmRota: prev.barrilEmRota + 1 }))}
                  className="w-6 h-6 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs"
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
                  onClick={() => setBatch(prev => ({ ...prev, co2Cheio: Math.max(0, prev.co2Cheio - 1) }))}
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.co2Cheio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, co2Cheio: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-emerald-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, co2Cheio: prev.co2Cheio + 1 }))}
                  className="w-5 h-5 rounded bg-emerald-600 text-white text-xs font-bold"
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
                  onClick={() => setBatch(prev => ({ ...prev, co2Mexido: Math.max(0, prev.co2Mexido - 1) }))}
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.co2Mexido || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, co2Mexido: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-amber-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, co2Mexido: prev.co2Mexido + 1 }))}
                  className="w-5 h-5 rounded bg-amber-500 text-slate-950 text-xs font-bold"
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
                  onClick={() => setBatch(prev => ({ ...prev, co2Vazio: Math.max(0, prev.co2Vazio - 1) }))}
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.co2Vazio || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, co2Vazio: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-orange-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, co2Vazio: prev.co2Vazio + 1 }))}
                  className="w-5 h-5 rounded bg-orange-600 text-white text-xs font-bold"
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
                  onClick={() => setBatch(prev => ({ ...prev, co2EmRota: Math.max(0, prev.co2EmRota - 1) }))}
                  className="w-5 h-5 rounded bg-white border text-slate-700 text-xs font-bold"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.co2EmRota || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, co2EmRota: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-8 text-center bg-transparent font-mono text-xs font-black text-sky-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, co2EmRota: prev.co2EmRota + 1 }))}
                  className="w-5 h-5 rounded bg-sky-600 text-white text-xs font-bold"
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
                  onClick={() => setBatch(prev => ({ ...prev, disponivel: Math.max(0, prev.disponivel - 1) }))}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.disponivel || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, disponivel: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-14 text-center bg-transparent font-mono text-base font-black text-emerald-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, disponivel: prev.disponivel + 1 }))}
                  className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs"
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
                  onClick={() => setBatch(prev => ({ ...prev, danificado: Math.max(0, prev.danificado - 1) }))}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={batch.danificado || ''}
                  placeholder="0"
                  onKeyDown={handleKeyDown}
                  onChange={e => setBatch(prev => ({ ...prev, danificado: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-14 text-center bg-transparent font-mono text-base font-black text-rose-950 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setBatch(prev => ({ ...prev, danificado: prev.danificado + 1 }))}
                  className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs"
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
          title={disabled ? 'Contagem bloqueada' : "Somar as quantidades digitadas ao campo consolidado acima e zerar para a próxima contagem"}
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>
            {disabled
              ? 'Contagem Bloqueada'
              : totalBatch > 0
                ? `Inserir Contagem (+${totalBatch} un) e Zerar Campos`
                : 'Inserir Contagem (Digite a quantidade acima para somar)'}
          </span>
        </button>
      </div>
    </div>
  );
};

export const MateriaisView: React.FC = () => {
  const {
    materials,
    materialCounts,
    updateMaterialCount,
    resetAllTodayCountsByMaster,
    isCountAlreadyZero,
    todayDateFormatted,
    activeUser,
    isMaster,
    isContadorActive,
    canActiveUserCount,
    cantCountReason,
    isAnyBaseCountInProgress,
  } = useInventory();

  const [categoryFilter, setCategoryFilter] = useState<'all' | MaterialCategory>('all');
  const [cloneToast, setCloneToast] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [alreadyZeroOpen, setAlreadyZeroOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  const handleResetButtonClick = () => {
    // EXIGÊNCIA 2: ao precionar o botão "Zerar Contagens" e a contagem já tiver sido zerada, informar "Contagem já zerada"
    if (isCountAlreadyZero()) {
      setAlreadyZeroOpen(true);
      return;
    }
    setConfirmResetOpen(true);
  };

  const handleResetAllToday = () => {
    resetAllTodayCountsByMaster();
    setConfirmResetOpen(false);
    setCloneToast('🗑️ Base da contagem de hoje foi zerada para todos os usuários!');
    setTimeout(() => setCloneToast(null), 3500);
  };

  const filteredMaterials = materials.filter(m => {
    if (categoryFilter === 'all') return true;
    return m.category === categoryFilter;
  });

  // TOTAIS SEPARADOS DA CONTAGEM:
  // 1. Disponíveis (Cheios/Prontos)
  // 2. Danificados (Itens com avaria/defeito)
  // 3. Vazios (Barris e CO2 sem carga)
  // 4. Em Rota (Barris e CO2 em clientes/trânsito)
  // 5. Consolidado (Total geral de materiais contados)
  let totalDisponiveis = 0;
  let totalDanificados = 0;
  let totalVazios = 0;
  let totalEmRota = 0;
  let totalGeral = 0;

  // Totais separados por tipo de material
  const totalsByCat: Record<string, { disponivel: number; danificado: number; vazio: number; emRota: number; total: number }> = {};

  CATEGORIAS_MATERIAIS.forEach(c => {
    totalsByCat[c.id] = { disponivel: 0, danificado: 0, vazio: 0, emRota: 0, total: 0 };
  });

  materials.forEach(m => {
    const entry = materialCounts[m.id];
    const catStats = totalsByCat[m.category] || { disponivel: 0, danificado: 0, vazio: 0, emRota: 0, total: 0 };

    if (m.category === 'barril') {
      const cheio = entry?.barrilCheio || 0;
      const vazio = entry?.barrilVazio || 0;
      const rota = entry?.barrilEmRota || 0;
      totalDisponiveis += cheio;
      totalVazios += vazio;
      totalEmRota += rota;
      totalGeral += (cheio + vazio + rota);

      catStats.disponivel += cheio;
      catStats.vazio += vazio;
      catStats.emRota += rota;
      catStats.total += (cheio + vazio + rota);
    } else if (m.category === 'co2') {
      const cheio = entry?.co2Cheio || 0;
      const mexido = entry?.co2Mexido || 0;
      const vazio = entry?.co2Vazio || 0;
      const rota = entry?.co2EmRota || 0;
      totalDisponiveis += (cheio + mexido);
      totalVazios += vazio;
      totalEmRota += rota;
      totalGeral += (cheio + mexido + vazio + rota);

      catStats.disponivel += (cheio + mexido);
      catStats.vazio += vazio;
      catStats.emRota += rota;
      catStats.total += (cheio + mexido + vazio + rota);
    } else {
      const disp = entry?.disponivel || 0;
      const danif = entry?.danificado || 0;
      totalDisponiveis += disp;
      totalDanificados += danif;
      totalGeral += (disp + danif);

      catStats.disponivel += disp;
      catStats.danificado += danif;
      catStats.total += (disp + danif);
    }

    totalsByCat[m.category] = catStats;
  });

  return (
    <div className="space-y-3.5 pb-12 bg-white">

      {/* Header com a imagem do item referente ao estoque selecionado */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <AppBrandIcon type="materiais" size="sm" className="border border-amber-200 shadow-xs" />
            <span>Contagem de Materiais</span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botão Clonar Última (Apenas Usuário Master) */}
          {isMaster && (
            <button
              onClick={() => setIsCloneModalOpen(true)}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Clonar última contagem por grupo ou estoque (Exclusivo Master)"
            >
              <Copy className="w-3.5 h-3.5 text-amber-600" />
              <span>Clonar Última</span>
            </button>
          )}

          {/* Botão Zerar Contagens (Apenas Usuário Master) */}
          {isMaster && (
            <button
              onClick={handleResetButtonClick}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Zerar base de contagem para todos os usuários"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Zerar Contagens</span>
            </button>
          )}
        </div>
      </div>

      {/* Modal quando a contagem já se encontra zerada */}
      {alreadyZeroOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Aviso</h3>
              <p className="text-xs text-slate-600 mt-1 font-bold">
                Contagem já zerada.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAlreadyZeroOpen(false)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-md"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Zerar Contagens */}
      {confirmResetOpen && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2 animate-in fade-in duration-150 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-rose-900">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>Zerar contagem de materiais e equipamentos de hoje?</span>
          </div>
          <p className="text-slate-600 text-[11px]">
            Esta ação zerará a contagem para <strong>todos os usuários</strong>. A última contagem fica salva no backup para clonagem.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setConfirmResetOpen(false)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-semibold text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleResetAllToday}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer"
            >
              Sim, Zerar Toda a Contagem
            </button>
          </div>
        </div>
      )}

      {/* Toast Informativo */}
      {cloneToast && (
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center gap-2 shadow-xs">
          <span>{cloneToast}</span>
        </div>
      )}

      {/* Banner de bloqueio de contagem */}
      {!canActiveUserCount && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center gap-2.5 text-xs text-amber-950 font-bold shadow-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{cantCountReason || 'Existe contagem em andamento.'}</span>
        </div>
      )}

      {/* Indicador de Salvamento Automático - sem a mensagem "Contagem diária oficial" */}
      <div className="flex items-center justify-start text-xs text-slate-600 bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs">
        <span className="flex items-center gap-2 text-emerald-700 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Contagem salva automaticamente ao digitar.</span>
        </span>
      </div>

      {/* CONTADORES SEPARADOS DE TODOS OS BOTÕES REFERENTES POR TIPO DE MATERIAL - FONTES E BOTÕES AUMENTADOS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider block">
            Filtrar e Conferir por Tipo de Material:
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar text-sm">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-4 py-2.5 rounded-xl font-black whitespace-nowrap transition-all border shadow-sm cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-black ring-2 ring-amber-300/40'
                : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span className="text-sm">Todos ({materials.length})</span>
            <span className="ml-2 px-2 py-0.5 rounded-md bg-white/80 text-xs font-mono font-bold text-slate-900">
              Total: {totalGeral} un
            </span>
          </button>

          {/* EXIGÊNCIA: Botões do campo "Filtrar e Conferir por Tipo de Material:" ativos de acordo com os itens cadastrados na base. Caso a base esteja zerada, mostrará apenas "Todos (0) Total: 0 un". */}
          {materials.length > 0 && CATEGORIAS_MATERIAIS.filter(cat => materials.some(m => m.category === cat.id)).map(cat => {
            const count = materials.filter(m => m.category === cat.id).length;
            const stats = totalsByCat[cat.id] || { disponivel: 0, danificado: 0, vazio: 0, emRota: 0, total: 0 };
            const isActive = categoryFilter === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all border flex items-center gap-2.5 shadow-sm cursor-pointer ${
                  isActive
                    ? 'bg-amber-50 text-amber-950 border-amber-400 font-bold ring-2 ring-amber-300/50'
                    : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {/* Figura fiel ao nome do item */}
                <div className="shrink-0">
                  <MaterialCategoryFigure category={cat.id} size="md" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm">{cat.label}</span>
                    <span className="text-xs font-mono font-bold text-slate-500">({count})</span>
                  </div>
                  {/* Contadores separados do botão */}
                  <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5 mt-0.5">
                    {cat.id === 'barril' || cat.id === 'co2' ? (
                      <>
                        <span className="text-emerald-700 font-bold">Cheio: {stats.disponivel}</span>
                        <span>•</span>
                        <span className="text-orange-700 font-bold">Vazio: {stats.vazio}</span>
                        <span>•</span>
                        <span className="text-sky-700 font-bold">Rota: {stats.emRota}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-emerald-700 font-bold">Disp: {stats.disponivel}</span>
                        <span>•</span>
                        <span className="text-rose-700 font-bold">Danif: {stats.danificado}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de Materiais para Contagem com Fundo Branco */}
      {filteredMaterials.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white border border-slate-200 rounded-3xl space-y-2 shadow-xs">
          <Layers className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">Nenhum material cadastrado nesta categoria</h3>
          {isMaster && (
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Cadastre novos materiais acessando a aba "Cadastros" na barra inferior.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMaterials.map(item => {
            const catConfig = CATEGORIAS_MATERIAIS.find(c => c.id === item.category);
            const countEntry = materialCounts[item.id] || {
              itemId: item.id,
              disponivel: 0,
              danificado: 0,
              barrilCheio: 0,
              barrilVazio: 0,
              barrilEmRota: 0,
              co2Cheio: 0,
              co2Mexido: 0,
              co2Vazio: 0,
              co2EmRota: 0,
            };

            return (
              <MaterialCountingCard
                key={item.id}
                item={item}
                catConfig={catConfig}
                countEntry={countEntry}
                onUpdate={updateMaterialCount}
                disabled={!canActiveUserCount}
              />
            );
          })}
        </div>
      )}

      {/* Modal de Clonagem Seletiva */}
      <ModalClonarUltima
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        onCloned={(msg) => {
          setCloneToast(`✅ ${msg}`);
          setTimeout(() => setCloneToast(null), 4000);
        }}
      />

    </div>
  );
};
