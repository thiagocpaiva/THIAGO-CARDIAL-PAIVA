
import React, { useState } from 'react';
import { 
  X, 
  Tag, 
  Trash2, 
  Edit3, 
  Check, 
  Share2,
  Snowflake,
  Zap,
  Layers
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialItem, FreezerItem, EquipmentItem } from '../../types/inventory';
import { CATEGORIAS_MATERIAIS } from './CadastrarMaterialModal';

interface DetalhesItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  material?: MaterialItem | null;
  freezer?: FreezerItem | null;
  equipment?: EquipmentItem | null;
  onOpenEditMaterial: (item: MaterialItem) => void;
  onOpenEditFreezer: (item: FreezerItem) => void;
  onOpenEditEquipment: (item: EquipmentItem) => void;
}

export const DetalhesItemModal: React.FC<DetalhesItemModalProps> = ({
  isOpen,
  onClose,
  material,
  freezer,
  equipment,
  onOpenEditMaterial,
  onOpenEditFreezer,
  onOpenEditEquipment,
}) => {
  const { 
    deleteMaterial, 
    deleteFreezer, 
    deleteEquipment,
    isMaster 
  } = useInventory();

  const [copied, setCopied] = useState(false);

  if (!isOpen || (!material && !freezer && !equipment)) return null;

  const currentItem = material || freezer || equipment!;
  const itemType = material ? 'material' : freezer ? 'freezer' : 'equipamento';
  const itemCode = currentItem.code;
  const itemName = currentItem.name;

  const handleDelete = () => {
    if (confirm(`Tem certeza que deseja excluir o cadastro de [${itemCode}] ${itemName}?`)) {
      if (material) deleteMaterial(material.id);
      else if (freezer) deleteFreezer(freezer.id);
      else if (equipment) deleteEquipment(equipment.id);
      onClose();
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(itemCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`px-3 py-1 rounded-xl bg-slate-900 border flex items-center gap-2 ${
              itemType === 'material' ? 'border-amber-500/40 text-amber-300' : itemType === 'freezer' ? 'border-blue-500/40 text-blue-300' : 'border-cyan-500/40 text-cyan-300'
            }`}>
              <Tag className="w-4 h-4" />
              <span className="font-mono font-bold text-sm tracking-wider">
                {itemCode}
              </span>
            </div>

            <button
              onClick={copyCode}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {isMaster && (
              <>
                <button
                  onClick={() => {
                    if (material) onOpenEditMaterial(material);
                    else if (freezer) onOpenEditFreezer(freezer);
                    else if (equipment) onOpenEditEquipment(equipment);
                    onClose();
                  }}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center"
                  title="Editar"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDelete}
                  className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-rose-400 flex items-center justify-center"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Main Info Card */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                {itemType === 'material' ? <Layers className="w-3.5 h-3.5 text-amber-400" /> : itemType === 'freezer' ? <Snowflake className="w-3.5 h-3.5 text-blue-400" /> : <Zap className="w-3.5 h-3.5 text-cyan-400" />}
                {itemType === 'material' ? 'Material de Estoque' : itemType === 'freezer' ? 'Freezer' : 'Chopeira Elétrica'}
              </span>
              <h2 className="text-base font-bold text-white mt-1">{itemName}</h2>
            </div>

            {/* Sub specs for Material */}
            {material && (
              <div className="pt-2 border-t border-slate-700/60 text-xs space-y-1">
                <div>
                  <span className="text-slate-400">Categoria: </span>
                  <span className="font-bold text-amber-300">
                    {CATEGORIAS_MATERIAIS.find(c => c.id === material.category)?.label}
                  </span>
                </div>
                {material.description && (
                  <p className="text-slate-300 mt-1">{material.description}</p>
                )}
              </div>
            )}

            {/* Sub specs for Freezer */}
            {freezer && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/60 text-xs">
                <div className="bg-slate-900/80 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Plaqueta de Patrimônio:</span>
                  <span className="font-mono font-bold text-white">{freezer.patrimony}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Voltagem:</span>
                  <span className="font-mono font-bold text-blue-300">{freezer.voltage}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Marca:</span>
                  <span className="font-bold text-white">{freezer.brand}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Modelo:</span>
                  <span className="font-medium text-cyan-300 font-bold">{freezer.model}</span>
                </div>
              </div>
            )}

            {/* Sub specs for Equipment (Chopeiras) */}
            {equipment && (
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/60 text-xs">
                <div className="bg-slate-900/80 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Plaqueta de Patrimônio:</span>
                  <span className="font-mono font-bold text-white">{equipment.patrimony}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl">
                  <span className="text-[10px] text-slate-400 block">Voltagem:</span>
                  <span className="font-mono font-bold text-cyan-300">{equipment.voltage}</span>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-xl col-span-2">
                  <span className="text-[10px] text-slate-400 block">Tipo:</span>
                  <span className="font-bold text-white">
                    {equipment.type === 'chopeira_1_torneira' ? 'Chopeira de 1 Torneira' : 'Chopeira de 2 Torneiras'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-center text-xs text-slate-400">
            A situação e quantidade deste item são preenchidas diariamente na tela de contagem do estoque.
          </div>

        </div>
      </div>
    </div>
  );
};
