
import React, { useState, useEffect } from 'react';
import { X, Check, Layers, AlertCircle, PlusCircle, Trash2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialCategory, MaterialItem } from '../../types/inventory';
import { MaterialCategoryFigure } from '../MaterialCategoryIcons';


export const CATEGORIAS_MATERIAIS: Array<{ id: MaterialCategory; label: string; icon: string }> = [
  { id: 'mesa_plastica', label: 'Mesa Plástica', icon: '🪑' },
  { id: 'mesa_madeira', label: 'Mesa Madeira', icon: '🪵' },
  { id: 'cadeira_plastica_com_braco', label: 'Cadeira Plástica C/Braço', icon: '💺' },
  { id: 'cadeira_plastica_sem_braco', label: 'Cadeira Plástica S/Braço', icon: '💺' },
  { id: 'cadeira_madeira', label: 'Cadeira Madeira', icon: '🪑' },
  { id: 'caixa_termica', label: 'Caixa Térmica', icon: '🧊' },
  { id: 'barril', label: 'Barril', icon: '🍺' },
  { id: 'co2', label: 'CO2', icon: '💨' },
];

// Divisões e subopções de acordo com a solicitação do usuário
export const SUBOPCOES_MATERIAIS: Record<MaterialCategory, string[]> = {
  mesa_plastica: ['DEVASSA AMARELA', 'DEVASSA VERMELHA', 'AMSTEL VERMELHA', 'NOVA SCHIN'],
  mesa_madeira: ['AMSTEL EXTREME', 'DEVASSA', 'DEVASSA TROPICAL', 'NOVA SCHIN', 'AMSTEL', 'EISENBAHN', 'HEINEKEN EXTREME'],
  cadeira_plastica_com_braco: ['DEVASSA AMARELA', 'DEVASSA VERMELHA', 'NOVA SCHIN', 'AMSTEL VERMELHA'],
  cadeira_plastica_sem_braco: ['DEVASSA AMARELA', 'NOVA SCHIN'],
  cadeira_madeira: ['AMSTEL EXTREME', 'DEVASSA', 'DEVASSA TROPICAL', 'NOVA SCHIN', 'AMSTEL', 'EISENBAHN', 'HEINEKEN EXTREME'],
  barril: ['BARRIL 30L', 'BARRIL 50L'],
  caixa_termica: ['AMARELA', 'DEVASSA', 'HEINEKEN', 'NOVA SCHIN'],
  co2: ['PEQUENO', 'MÉDIO', 'GRANDE'],
};

export interface CadastrarMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  materialToEdit?: MaterialItem | null;
  defaultCategory?: MaterialCategory;
  isFromCount?: boolean;
  onSuccessCreated?: (item: MaterialItem) => void;
}

export const CadastrarMaterialModal: React.FC<CadastrarMaterialModalProps> = ({
  isOpen,
  onClose,
  materialToEdit,
  defaultCategory = 'mesa_plastica',
  isFromCount = false,
  onSuccessCreated,
}) => {
  const { materials, freezers, equipments, addMaterial, updateMaterial, deleteMaterial } = useInventory();

  const [category, setCategory] = useState<MaterialCategory>(defaultCategory);
  const [selectedSubOption, setSelectedSubOption] = useState<string>('');
  const [code, setCode] = useState('');
  const [identification, setIdentification] = useState('');
  const [description, setDescription] = useState('');
  const [codeError, setCodeError] = useState('');

  useEffect(() => {
    if (materialToEdit) {
      setCategory(materialToEdit.category);
      setCode(materialToEdit.code === '0' ? '' : materialToEdit.code);
      setSelectedSubOption(materialToEdit.subOption || SUBOPCOES_MATERIAIS[materialToEdit.category]?.[0] || '');
      setIdentification(materialToEdit.name || '');
      setDescription(materialToEdit.description || '');
      setCodeError('');
    } else {
      setCategory(defaultCategory);
      setCode('');
      const defaultSub = SUBOPCOES_MATERIAIS[defaultCategory]?.[0] || '';
      setSelectedSubOption(defaultSub);
      setIdentification('');
      setDescription('');
      setCodeError('');
    }
  }, [materialToEdit, defaultCategory, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (newCat: MaterialCategory) => {
    setCategory(newCat);
    const firstSub = SUBOPCOES_MATERIAIS[newCat]?.[0] || '';
    setSelectedSubOption(firstSub);
  };

  // Botão para acrescentar seleções acima (substitui toda a informação com as novas selecionadas)
  const handleAppendSelectedInfo = () => {
    const catConfig = CATEGORIAS_MATERIAIS.find(c => c.id === category);
    const infoToAdd = `${catConfig?.label || 'Material'} ${selectedSubOption}`.trim();
    setIdentification(infoToAdd);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError('');

    const formattedCode = isFromCount ? '0' : code.trim();
    if (!isFromCount && (!formattedCode || formattedCode === '0')) {
      setCodeError('Informe o código do material (apenas números)');
      return;
    }

    if (!selectedSubOption) {
      setCodeError('Selecione uma das opções do tipo de material');
      return;
    }

    // EXIGÊNCIA: Na tela Cadastros, aceitar o cadastro de materiais com códigos iguais na base.

    const catConfig = CATEGORIAS_MATERIAIS.find(c => c.id === category);
    // Se a identificação estiver vazia, gera automaticamente a partir das seleções
    const finalName = identification.trim() || `${catConfig?.label || 'Material'} ${selectedSubOption}`.trim();

    // EXIGÊNCIA: Ao cadastrar o CO2, o código digitado para esse material, será o mesmo código para todos os modelos PEQUENO, MÉDIO, GRANDE, VAZIO, CHEIO
    if (category === 'co2' && !isFromCount) {
      const co2Models = ['PEQUENO', 'MÉDIO', 'GRANDE'];
      co2Models.forEach(sub => {
        const existing = materials.find(m => m.category === 'co2' && m.subOption === sub);
        if (existing) {
          updateMaterial({
            ...existing,
            code: formattedCode,
            name: `CILINDRO CO2 ${sub}`,
            subOption: sub,
          });
        } else {
          addMaterial({
            code: formattedCode,
            name: `CILINDRO CO2 ${sub}`,
            category: 'co2',
            subOption: sub,
            description: `Cilindro de CO2 ${sub}`,
          });
        }
      });

      // Atualiza também quaisquer outros registros de CO2 na base para garantir uniformidade absoluta de código
      materials
        .filter(m => m.category === 'co2' && !co2Models.includes(m.subOption || ''))
        .forEach(otherCo2 => {
          updateMaterial({
            ...otherCo2,
            code: formattedCode,
          });
        });

      onClose();
      return;
    }

    if (materialToEdit) {
      updateMaterial({
        ...materialToEdit,
        code: formattedCode,
        name: finalName,
        category,
        subOption: selectedSubOption,
        description: description.trim() || undefined,
      });
    } else {
      const newMatData = {
        code: formattedCode,
        name: finalName,
        category,
        subOption: selectedSubOption,
        description: description.trim() || undefined,
      };
      addMaterial(newMatData);
      onSuccessCreated?.({
        ...newMatData,
        id: 'mat-' + Date.now(),
        createdAt: new Date().toLocaleDateString('pt-BR'),
      });
    }

    onClose();
  };

  const currentSubOptions = SUBOPCOES_MATERIAIS[category] || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">
        
        {/* Header com fundo branco */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {materialToEdit ? 'Editar Material' : 'Cadastrar Novo Material'}
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

          {/* Código do Material no topo */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Código do Material *
            </label>
            <input 
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onKeyDown={e => {
                // Bloqueia qualquer caractere que não seja número ou tecla de navegação/controle
                if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onChange={e => {
                const onlyNums = e.target.value.replace(/\D/g, '');
                setCode(onlyNums);
                setCodeError('');
              }}
              required={!isFromCount}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 focus:bg-white font-bold"
            />
          </div>

          {/* Tipo de Material */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Tipo de Material *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIAS_MATERIAIS.map(cat => (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2 text-xs transition-all cursor-pointer ${
                    category === cat.id
                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-black shadow-xs ring-2 ring-amber-300/40'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <MaterialCategoryFigure category={cat.id} size="sm" />
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Botões de Subopções que aparecem logo abaixo do tipo clicado */}
          <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3 space-y-2">
            <label className="text-xs font-bold text-amber-900 block">
              Selecione o Modelo / Marca do Material: *
            </label>
            <div className="flex flex-wrap gap-1.5">
              {currentSubOptions.map(sub => (
                <button
                  type="button"
                  key={sub}
                  onClick={() => setSelectedSubOption(sub)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    selectedSubOption === sub
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs font-black scale-102'
                      : 'bg-white border-amber-200 text-slate-800 hover:bg-amber-100/60'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Identificação / Nome com botão para acrescentar seleções acima */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Identificação do Material:
              </label>
              <button
                type="button"
                onClick={handleAppendSelectedInfo}
                className="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg"
                title="Substitui com o tipo e modelo selecionados acima"
              >
                <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Acrescentar Seleções Acima</span>
              </button>
            </div>
            
            <input
              type="text"
              value={identification}
              onChange={e => setIdentification(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white transition-all font-medium"
            />
          </div>

          {/* Descrição / Detalhes Opcionais */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Observações / Detalhes Adicionais
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
            {materialToEdit ? (
              <button
                type="button"
                onClick={() => {
                  deleteMaterial(materialToEdit.id);
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
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{materialToEdit ? 'Salvar Alterações' : 'Cadastrar Material'}</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};
