
import React, { useState, useEffect } from 'react';
import { X, Check, Zap, AlertCircle, PlusCircle, ArrowLeft, Trash2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { EquipmentItem, EquipmentType } from '../../types/inventory';

interface CadastrarEquipamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  isFromCount?: boolean;
  equipmentToEdit?: EquipmentItem | null;
  initialPatrimony?: string;
  onSuccessCreated?: (newItem: EquipmentItem) => void;
}

const MODELOS_CHOPEIRA = ['AMSTEL', 'HEINEKEN', 'DEVASSA'] as const;
const VOLTAGENS = ['110V', '220V', 'Bivolt'] as const;

export const CadastrarEquipamentoModal: React.FC<CadastrarEquipamentoModalProps> = ({
  isOpen,
  onClose,
  onBack,
  isFromCount = false,
  equipmentToEdit,
  initialPatrimony,
  onSuccessCreated,
}) => {
  const { equipments, freezers, materials, addEquipment, updateEquipment, deleteEquipment } = useInventory();

  const [code, setCode] = useState('');
  const [patrimony, setPatrimony] = useState('');
  const [type, setType] = useState<EquipmentType>('chopeira_2_torneiras');
  const [model, setModel] = useState<typeof MODELOS_CHOPEIRA[number]>('AMSTEL');
  const [voltage, setVoltage] = useState<'110V' | '220V' | 'Bivolt'>('220V');
  const [identification, setIdentification] = useState('');
  const [defect, setDefect] = useState('');
  const [observations, setObservations] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    if (equipmentToEdit) {
      setCode(equipmentToEdit.code);
      setPatrimony(equipmentToEdit.patrimony || '');
      setType(equipmentToEdit.type);
      setModel((equipmentToEdit.model as any) || 'AMSTEL');
      setVoltage(equipmentToEdit.voltage);
      setIdentification(equipmentToEdit.name || '');
      setDefect(equipmentToEdit.defect || '');
      setObservations(equipmentToEdit.observations || '');
      setCodeError('');
    } else {
      setCode('');
      setPatrimony(initialPatrimony ? initialPatrimony.replace(/\D/g, '') : '');
      setType('chopeira_2_torneiras');
      setModel('AMSTEL');
      setVoltage('220V');
      setIdentification('');
      setDefect('');
      setObservations('');
      setCodeError('');
    }
  }, [equipmentToEdit, isOpen, initialPatrimony]);

  if (!isOpen) return null;

  // Função para acrescentar/substituir as informações selecionadas acima
  const handleAppendSelectedInfo = () => {
    const tipoNome = type === 'chopeira_1_torneira' ? 'Chopeira 1 Torneira' : 'Chopeira 2 Torneiras';
    const infoToAdd = `${tipoNome} ${model} ${voltage}`;
    setIdentification(infoToAdd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');

    const formattedCode = isFromCount ? '0' : code.trim();
    const formattedPatrimony = patrimony.trim();

    if (!isFromCount && !formattedCode) {
      setCodeError('Informe o código da chopeira (apenas números)');
      return;
    }

    if (!formattedPatrimony) {
      setCodeError('Informe a plaqueta de patrimônio (apenas números)');
      return;
    }

    // EXIGÊNCIA: Na tela Cadastros, aceitar o cadastro de equipamentos com códigos iguais na base, não aceitar patrimônios iguais.

    // Validação de unicidade do patrimônio em chopeiras e freezers
    const existsPatInEquipments = equipments.some(
      eq => eq.patrimony.toUpperCase() === formattedPatrimony && eq.id !== equipmentToEdit?.id
    );
    const existsPatInFreezers = freezers.some(
      f => f.patrimony.toUpperCase() === formattedPatrimony
    );

    if (existsPatInEquipments || existsPatInFreezers) {
      setCodeError(`Patrimônio "${formattedPatrimony}" já está cadastrado no sistema. Não são permitidos patrimônios repetidos.`);
      return;
    }

    const tipoNome = type === 'chopeira_1_torneira' ? 'Chopeira 1 Torneira' : 'Chopeira 2 Torneiras';
    const finalName = identification.trim() || `${tipoNome} ${model} ${voltage}`;
    const cleanDefect = defect.trim() || undefined;
    const cleanObs = observations.trim() || undefined;

    if (equipmentToEdit) {
      updateEquipment({
        ...equipmentToEdit,
        code: formattedCode,
        patrimony: formattedPatrimony,
        name: finalName,
        type,
        model,
        voltage,
        defect: cleanDefect,
        observations: cleanObs,
      });
    } else {
      const newEquipData = {
        code: formattedCode,
        patrimony: formattedPatrimony,
        name: finalName,
        type,
        brand: model,
        model,
        voltage,
        defect: cleanDefect,
        observations: cleanObs,
      };
      const created = addEquipment(newEquipData);
      onSuccessCreated?.(created || {
        ...newEquipData,
        id: 'eq-' + Date.now(),
        createdAt: new Date().toLocaleDateString('pt-BR'),
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">
        
        {/* Header com fundo branco */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                title="Voltar para a escolha da categoria"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {equipmentToEdit ? 'Editar Chopeira Elétrica' : 'Cadastrar Nova Chopeira Elétrica'}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-200/70 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body com fundo branco */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          
          {codeError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{codeError}</span>
            </div>
          )}

          {/* Código e Patrimônio aceitando apenas números */}
          {isFromCount ? (
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Plaqueta de Patrimônio *
              </label>
              <input 
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={patrimony}
                onChange={e => {
                  setPatrimony(e.target.value.replace(/\D/g, ''));
                  setCodeError('');
                }}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500 focus:bg-white"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Código do Equipamento *
                </label>
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={e => {
                    setCode(e.target.value.replace(/\D/g, ''));
                    setCodeError('');
                  }}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Plaqueta de Patrimônio *
                </label>
                <input 
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={patrimony}
                  onChange={e => {
                    setPatrimony(e.target.value.replace(/\D/g, ''));
                    setCodeError('');
                  }}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* Tipo de Chopeira */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Tipo de Chopeira Elétrica *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('chopeira_1_torneira')}
                className={`py-2 px-3 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  type === 'chopeira_1_torneira'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-xs font-black'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                1 Torneira
              </button>
              <button
                type="button"
                onClick={() => setType('chopeira_2_torneiras')}
                className={`py-2 px-3 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  type === 'chopeira_2_torneiras'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-xs font-black'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                2 Torneiras
              </button>
            </div>
          </div>

          {/* Modelo */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Marca / Modelo *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {MODELOS_CHOPEIRA.map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setModel(m)}
                  className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    model === m
                      ? 'bg-purple-600 text-white border-purple-500 shadow-xs font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Voltagem */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Voltagem *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {VOLTAGENS.map(v => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setVoltage(v)}
                  className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    voltage === v
                      ? 'bg-purple-600 text-white border-purple-500 shadow-xs font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Defeito do Equipamento (Salvo na base junto com o equipamento) */}
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-1">
            <label className="text-xs font-bold text-amber-950 block">
              Defeito do Equipamento:
            </label>
            <input
              type="text"
              value={defect}
              onChange={e => setDefect(e.target.value)}
              className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Identificação / Nomenclatura */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Nome / Identificação no Catálogo
              </label>
              <button
                type="button"
                onClick={handleAppendSelectedInfo}
                className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg"
                title="Substitui com o tipo, modelo e voltagem selecionados acima"
              >
                <PlusCircle className="w-3.5 h-3.5 text-purple-600" />
                <span>Acrescentar Seleções Acima</span>
              </button>
            </div>
            
            <input
              type="text"
              value={identification}
              onChange={e => setIdentification(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Campo Observações */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Observações
            </label>
            <textarea
              rows={2}
              value={observations}
              onChange={e => setObservations(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white resize-none"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            {onBack ? (
              <button
                type="button"
                onClick={onBack}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
            ) : equipmentToEdit ? (
              <button
                type="button"
                onClick={() => {
                  deleteEquipment(equipmentToEdit.id);
                  onClose();
                }}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                title="Excluir item da base"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir da Base</span>
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{equipmentToEdit ? 'Salvar Alterações' : 'Cadastrar Chopeira'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
