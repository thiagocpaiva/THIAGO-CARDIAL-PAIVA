
import React from 'react';
import { 
  X, 
  Copy, 
  Layers, 
  Zap, 
  Snowflake, 
  Beer, 
  Box, 
  CheckCircle2, 
  Package
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { CloneGroupTarget } from '../../types/inventory';
import { CATEGORIAS_MATERIAIS } from './CadastrarMaterialModal';

interface ModalClonarUltimaProps {
  isOpen: boolean;
  onClose: () => void;
  onCloned: (message: string) => void;
}

export const ModalClonarUltima: React.FC<ModalClonarUltimaProps> = ({
  isOpen,
  onClose,
  onCloned,
}) => {
  const { cloneSelectiveCount, lastCountBackup } = useInventory();

  if (!isOpen) return null;

  const handleExecuteClone = (target: CloneGroupTarget) => {
    const result = cloneSelectiveCount(target);
    onCloned(result.message);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Clonar Última Contagem
              </h3>
              <p className="text-[11px] text-slate-500">
                Selecione o grupo que deseja clonar para a contagem atual
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-slate-800">
          
          {/* Informação sobre última contagem disponível */}
          {lastCountBackup ? (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs flex items-center justify-between">
              <span className="text-amber-900">
                Última sessão salva: <strong>{lastCountBackup.date}</strong> às <strong>{lastCountBackup.savedAt}</strong>
              </span>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                Disponível
              </span>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-500">
              Nenhuma sessão anterior arquivada ainda.
            </div>
          )}

          {/* GRUPOS PRINCIPAIS SOLICITADOS */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Opções Globais de Clonagem:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              
              {/* 1. Clonar Todos os Estoques */}
              <button
                type="button"
                onClick={() => handleExecuteClone('todos')}
                className="p-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black border border-amber-400 text-left transition-all active:scale-[0.98] flex items-center gap-3 shadow-sm col-span-1 sm:col-span-2 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-950 text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
                  <Package className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-950">CLONAR TODOS OS ESTOQUES</div>
                  <div className="text-[11px] font-medium text-slate-900/80">Materiais + Freezers + Chopeiras completos</div>
                </div>
              </button>

              {/* 2. Clonar Todo o Estoque de Equipamentos */}
              <button
                type="button"
                onClick={() => handleExecuteClone('todos_equipamentos')}
                className="p-3 rounded-2xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-left transition-all active:scale-[0.98] flex items-center gap-3 shadow-xs cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-cyan-950">Todo Estoque de Equipamentos</div>
                  <div className="text-[10px] text-cyan-700">Freezers + Chopeiras</div>
                </div>
              </button>

              {/* 3. Clonar Todo o Estoque de Freezer */}
              <button
                type="button"
                onClick={() => handleExecuteClone('todos_freezers')}
                className="p-3 rounded-2xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-left transition-all active:scale-[0.98] flex items-center gap-3 shadow-xs cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                  <Snowflake className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-sky-950">Todo Estoque de Freezer</div>
                  <div className="text-[10px] text-sky-700">Apenas os Freezers da base</div>
                </div>
              </button>

              {/* 4. Clonar Todo o Estoque de Materiais */}
              <button
                type="button"
                onClick={() => handleExecuteClone('todos_materiais')}
                className="p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-left transition-all active:scale-[0.98] flex items-center gap-3 shadow-xs col-span-1 sm:col-span-2 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-indigo-950">Todo Estoque de Materiais</div>
                  <div className="text-[10px] text-indigo-700">Mesas, Caixas Térmicas, Barris e CO2</div>
                </div>
              </button>

            </div>
          </div>

          {/* SEPARAR POR TIPO DE EQUIPAMENTO */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Clonar por Tipo de Equipamento:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleExecuteClone('todas_chopeiras')}
                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Beer className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-purple-900 block truncate">Todas Chopeiras</span>
                  <span className="text-[9px] text-purple-700 block">1 e 2 Torneiras</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteClone('chopeira_1_torneira')}
                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Beer className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-purple-900 block truncate">1 Torneira</span>
                  <span className="text-[9px] text-purple-700 block">Chopeiras elétricas</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleExecuteClone('chopeira_2_torneiras')}
                className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-left transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Beer className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-purple-900 block truncate">2 Torneiras</span>
                  <span className="text-[9px] text-purple-700 block">Chopeiras elétricas</span>
                </div>
              </button>
            </div>
          </div>

          {/* SEPARAR POR TIPO ESPECÍFICO DE MATERIAL */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Ou Clonar por Tipo Específico de Material:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIAS_MATERIAIS.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleExecuteClone(cat.id)}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all active:scale-95 flex items-center gap-2"
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[11px] font-bold text-slate-800 truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
