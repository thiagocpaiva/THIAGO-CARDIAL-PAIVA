
import React, { useState, useEffect } from 'react';
import { X, Check, Snowflake, AlertCircle, PlusCircle, ArrowLeft, Trash2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { FreezerItem } from '../../types/inventory';

interface CadastrarFreezerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  isFromCount?: boolean;
  freezerToEdit?: FreezerItem | null;
  initialPatrimony?: string;
  onSuccessCreated?: (newItem: FreezerItem) => void;
}

const MARCAS_FREEZER = ['NOVA SCHIN', 'AMSTEL', 'HEINEKEN', 'DEVASSA', 'VIVA'] as const;
const MODELOS_FREEZER = ['4 CAIXAS', '8 CAIXAS'] as const;
const VOLTAGENS = ['110V', '220V', 'Bivolt'] as const;

export const CadastrarFreezerModal: React.FC<CadastrarFreezerModalProps> = ({
  isOpen,
  onClose,
  onBack,
  isFromCount = false,
  freezerToEdit,
  initialPatrimony,
  onSuccessCreated,
}) => {
  const { freezers, materials, equipments, addFreezer, updateFreezer, deleteFreezer } = useInventory();

  const [code, setCode] = useState('');
  const [patrimony, setPatrimony] = useState('');
  const [brand, setBrand] = useState<typeof MARCAS_FREEZER[number]>('NOVA SCHIN');
  const [model, setModel] = useState<typeof MODELOS_FREEZER[number]>('4 CAIXAS');
  const [isSlim, setIsSlim] = useState(false);
  const [voltage, setVoltage] = useState<'110V' | '220V' | 'Bivolt'>('220V');
  const [identification, setIdentification] = useState('');
  const [defect, setDefect] = useState('');
  const [observations, setObservations] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    if (freezerToEdit) {
      setCode(freezerToEdit.code);
      setPatrimony(freezerToEdit.patrimony || '');
      setBrand((freezerToEdit.brand as any) || 'NOVA SCHIN');
      setModel((freezerToEdit.model as any) || '4 CAIXAS');
      setIsSlim(freezerToEdit.isSlim || freezerToEdit.tipo?.toUpperCase() === 'SLIM' || freezerToEdit.name?.toUpperCase().includes('SLIM') || false);
      setVoltage(freezerToEdit.voltage);
      setIdentification(freezerToEdit.name || '');
      setDefect(freezerToEdit.defect || '');
      setObservations(freezerToEdit.observations || '');
      setCodeError('');
    } else {
      setCode('');
      setPatrimony(initialPatrimony ? initialPatrimony.replace(/\D/g, '') : '');
      setBrand('NOVA SCHIN');
      setModel('4 CAIXAS');
      setIsSlim(false);
      setVoltage('220V');
      setIdentification('');
      setDefect('');
      setObservations('');
      setCodeError('');
    }
  }, [freezerToEdit, isOpen, initialPatrimony]);

  if (!isOpen) return null;

  // Função para acrescentar/substituir as informações selecionadas acima
  const handleAppendSelectedInfo = () => {
    const slimSuffix = isSlim ? ' SLIM' : '';
    const infoToAdd = `Freezer ${brand} ${model}${slimSuffix} ${voltage}`;
    setIdentification(infoToAdd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');

    const formattedCode = isFromCount ? '0' : code.trim();
    const formattedPatrimony = patrimony.trim();

    if (!isFromCount && !formattedCode) {
      setCodeError('Informe o código do freezer (apenas números)');
      return;
    }

    if (!formattedPatrimony) {
      setCodeError('Informe a plaqueta de patrimônio (apenas números)');
      return;
    }

    // EXIGÊNCIA: Na tela Cadastros, aceitar o cadastro de equipamentos com códigos iguais na base, não aceitar patrimônios iguais.
    // Validação de unicidade do patrimônio em freezers e chopeiras (não permitir patrimônios repetidos)
    const existsPatInFreezers = freezers.some(
      f => f.patrimony.toUpperCase() === formattedPatrimony && f.id !== freezerToEdit?.id
    );
    const existsPatInEquipments = equipments.some(
      eq => eq.patrimony.toUpperCase() === formattedPatrimony
    );

    if (existsPatInFreezers || existsPatInEquipments) {
      setCodeError(`Patrimônio "${formattedPatrimony}" já está cadastrado no sistema. Não são permitidos patrimônios repetidos.`);
      return;
    }

    const slimSuffix = isSlim ? ' SLIM' : '';
    const finalName = identification.trim() || `Freezer ${brand} ${model}${slimSuffix} ${voltage}`;
    const cleanDefect = defect.trim() || undefined;
    const cleanObs = observations.trim() || undefined;

    if (freezerToEdit) {
      updateFreezer({
        ...freezerToEdit,
        code: formattedCode,
        patrimony: formattedPatrimony,
        name: finalName,
        brand,
        model,
        tipo: isSlim ? 'SLIM' : 'PADRÃO',
        isSlim,
        voltage,
        defect: cleanDefect,
        observations: cleanObs,
      });
    } else {
      const newFreezerData = {
        code: formattedCode,
        patrimony: formattedPatrimony,
        name: finalName,
        brand,
        model,
        tipo: isSlim ? 'SLIM' : 'PADRÃO',
        isSlim,
        voltage,
        defect: cleanDefect,
        observations: cleanObs,
      };
      const created = addFreezer(newFreezerData);
      onSuccessCreated?.(created || {
        ...newFreezerData,
        id: 'frz-' + Date.now(),
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
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center border border-sky-200">
              <Snowflake className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {freezerToEdit ? 'Editar Freezer' : 'Cadastrar Novo Freezer'}
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
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Código do Freezer *
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-sky-500 focus:bg-white"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>
            </div>
          )}

          {/* Marca do Freezer */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Marca do Freezer *
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {MARCAS_FREEZER.map(b => (
                <button
                  type="button"
                  key={b}
                  onClick={() => setBrand(b)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    brand === b
                      ? 'bg-sky-500 text-white border-sky-400 shadow-xs font-black'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Modelo e Botões PADRÃO / SLIM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Modelo do Freezer *
              </label>
              {/* Botões para informar se o modelo é PADRÃO ou SLIM */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsSlim(false)}
                  className={`px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                    !isSlim
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm ring-2 ring-amber-400/40'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                  title="Modelo PADRÃO"
                >
                  <span>PADRÃO</span>
                  {!isSlim && <Check className="w-3.5 h-3.5 stroke-[3] text-slate-950" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSlim(true)}
                  className={`px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1 shadow-2xs ${
                    isSlim
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm ring-2 ring-amber-400/40'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                  }`}
                  title="Modelo SLIM"
                >
                  <span>SLIM</span>
                  {isSlim && <Check className="w-3.5 h-3.5 stroke-[3] text-slate-950" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {MODELOS_FREEZER.map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => setModel(m)}
                  className={`py-2 px-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    model === m
                      ? 'bg-sky-500 text-white border-sky-400 shadow-xs font-black'
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
                      ? 'bg-sky-500 text-white border-sky-400 shadow-xs font-black'
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

          {/* Identificação / Nomenclatura com botão para preencher automático */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">
                Nome / Identificação no Catálogo
              </label>
              <button
                type="button"
                onClick={handleAppendSelectedInfo}
                className="text-[11px] text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg"
                title="Substitui com a marca, modelo e voltagem selecionados acima"
              >
                <PlusCircle className="w-3.5 h-3.5 text-sky-600" />
                <span>Acrescentar Seleção Acima</span>
              </button>
            </div>
            
            <input
              type="text"
              value={identification}
              onChange={e => setIdentification(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-medium"
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
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 focus:bg-white resize-none"
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
            ) : freezerToEdit ? (
              <button
                type="button"
                onClick={() => {
                  deleteFreezer(freezerToEdit.id);
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
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{freezerToEdit ? 'Salvar Alterações' : 'Cadastrar Freezer'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
