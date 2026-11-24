
import React, { useState } from 'react';
import { 
  X, 
  AlertTriangle, 
  Edit3, 
  Plus, 
  Trash2, 
  Snowflake, 
  Zap, 
  CheckCircle2, 
  Search,
  Filter,
  Check
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { FreezerItem, EquipmentItem, UncataloguedEquipment } from '../../types/inventory';

interface DefeitosModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EquipUnifiedItem = {
  id: string;
  kind: 'freezer' | 'chopeira' | 'uncat';
  code: string;
  patrimony: string;
  name: string;
  defect?: string;
  hasDefect: boolean;
  source: 'base' | 'contagem';
  rawItem: FreezerItem | EquipmentItem | UncataloguedEquipment;
};

export const DefeitosModal: React.FC<DefeitosModalProps> = ({ isOpen, onClose }) => {
  const { 
    freezers, 
    equipments, 
    uncataloguedEquipments,
    equipmentCounts,
    updateFreezer, 
    updateEquipment, 
    updateUncataloguedEquipment,
    updateEquipmentCount,
    frozenReportText,
    setFrozenReportText,
    isMaster, 
    isContadorActive 
  } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  // Filtro principal exigido: "Todo", "Com Defeito" e "Sem Defeito"
  const [defectFilter, setDefectFilter] = useState<'todo' | 'com_defeito' | 'sem_defeito'>('todo');
  // Filtro por tipo: Todos, Freezers, Chopeiras
  const [filterKind, setFilterKind] = useState<'all' | 'freezer' | 'chopeira'>('all');

  // Estados de edição / inclusão de defeito em item selecionado
  const [editingItem, setEditingItem] = useState<EquipUnifiedItem | null>(null);
  const [editDefectText, setEditDefectText] = useState('');
  
  // Estado para incluir defeito buscando patrimônio avulso
  const [isIncludeOpen, setIsIncludeOpen] = useState(false);
  const [includePatrimony, setIncludePatrimony] = useState('');
  const [includeDefectText, setIncludeDefectText] = useState('');
  const [includeError, setIncludeError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  // Estado para confirmação de exclusão do defeito
  const [confirmDeleteDefectItem, setConfirmDeleteDefectItem] = useState<EquipUnifiedItem | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  if (!isOpen) return null;

  // Montar lista completa unificada de equipamentos da base e da contagem
  const allEquipmentsList: EquipUnifiedItem[] = [];

  // 1. Freezers da base
  freezers.forEach(f => {
    const countEntry = equipmentCounts[f.id];
    const defect = f.defect?.trim() || countEntry?.damageDescription?.trim() || undefined;
    allEquipmentsList.push({
      id: f.id,
      kind: 'freezer',
      code: f.code || '0',
      patrimony: f.patrimony,
      name: f.name,
      defect,
      hasDefect: Boolean(defect && defect.length > 0),
      source: 'base',
      rawItem: f,
    });
  });

  // 2. Chopeiras da base
  equipments.forEach(eq => {
    const countEntry = equipmentCounts[eq.id];
    const defect = eq.defect?.trim() || countEntry?.damageDescription?.trim() || undefined;
    allEquipmentsList.push({
      id: eq.id,
      kind: 'chopeira',
      code: eq.code || '0',
      patrimony: eq.patrimony,
      name: eq.name,
      defect,
      hasDefect: Boolean(defect && defect.length > 0),
      source: 'base',
      rawItem: eq,
    });
  });

  // 3. Equipamentos encontrados na contagem (não cadastrados na base)
  uncataloguedEquipments.forEach(u => {
    // Evita duplicar se por acaso já estiver em freezers ou equipments
    const alreadyListed = allEquipmentsList.some(item => 
      item.patrimony.toUpperCase() === u.patrimony.toUpperCase()
    );
    if (!alreadyListed) {
      const defect = u.status === 'danificado' ? (u.damageDescription?.trim() || 'Avaria identificada na contagem') : undefined;
      allEquipmentsList.push({
        id: u.id,
        kind: 'uncat',
        code: 'NÃO-CAD',
        patrimony: u.patrimony,
        name: 'Equipamento Encontrado na Contagem',
        defect,
        hasDefect: Boolean(defect && defect.length > 0),
        source: 'contagem',
        rawItem: u,
      });
    }
  });

  // Totais para exibição nos botões de filtro
  const totalGeral = allEquipmentsList.length;
  const totalComDefeito = allEquipmentsList.filter(item => item.hasDefect).length;
  const totalSemDefeito = allEquipmentsList.filter(item => !item.hasDefect).length;

  // Filtragem
  const filteredItems = allEquipmentsList.filter(item => {
    // 1. Filtro de Defeito: Todo | Com Defeito | Sem Defeito
    if (defectFilter === 'com_defeito' && !item.hasDefect) return false;
    if (defectFilter === 'sem_defeito' && item.hasDefect) return false;

    // 2. Filtro de Tipo (se aplicável)
    if (filterKind === 'freezer' && item.kind !== 'freezer') return false;
    if (filterKind === 'chopeira' && item.kind !== 'chopeira') return false;

    // 3. Busca por texto
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.patrimony.toLowerCase().includes(term) ||
      item.code.toLowerCase().includes(term) ||
      item.name.toLowerCase().includes(term) ||
      (item.defect && item.defect.toLowerCase().includes(term))
    );
  }).sort((a, b) => {
    // EXIGÊNCIA: listar os mesmos nos filtros por ordem crescente de patrimônio
    return a.patrimony.localeCompare(b.patrimony, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Iniciar inserção ou edição de defeito em um item da lista
  const handleStartDefectAction = (item: EquipUnifiedItem) => {
    setEditingItem(item);
    setEditDefectText(item.defect || '');
  };

  // Salvar inserção ou edição de defeito
  const handleSaveDefect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (isMaster && isContadorActive) {
      showToast('Existe usuário realizando contagem no momento.');
      return;
    }

    const newDefect = editDefectText.trim();
    const actionLabel = editingItem.hasDefect ? 'atualizado' : 'inserido';

    if (editingItem.kind === 'freezer') {
      updateFreezer({
        ...(editingItem.rawItem as FreezerItem),
        defect: newDefect || undefined,
      });
      // Atualiza também na contagem ativa se houver
      if (equipmentCounts[editingItem.id]) {
        updateEquipmentCount(editingItem.id, {
          status: newDefect ? 'danificado' : 'disponivel',
          damageDescription: newDefect || undefined,
        });
      }
    } else if (editingItem.kind === 'chopeira') {
      updateEquipment({
        ...(editingItem.rawItem as EquipmentItem),
        defect: newDefect || undefined,
      });
      // Atualiza também na contagem ativa se houver
      if (equipmentCounts[editingItem.id]) {
        updateEquipmentCount(editingItem.id, {
          status: newDefect ? 'danificado' : 'disponivel',
          damageDescription: newDefect || undefined,
        });
      }
    } else {
      // Uncatalogued
      updateUncataloguedEquipment({
        ...(editingItem.rawItem as UncataloguedEquipment),
        status: newDefect ? 'danificado' : 'disponivel',
        damageDescription: newDefect || undefined,
      });
    }

    showToast(`Defeito do patrimônio ${editingItem.patrimony} ${actionLabel} com sucesso!`);
    setEditingItem(null);
    setEditDefectText('');
    setSearchTerm('');
  };

  // Excluir defeito (remover da base e modificar a situação do equipamento)
  // EXIGÊNCIA: ao pressionar o botão "Remover" da linha do item com defeito, será removido o defeito cadastrado na base e modificado a situação do equipamento.
  const handleDeleteDefect = (item: EquipUnifiedItem) => {
    if (isMaster && isContadorActive) {
      showToast('Existe usuário realizando contagem no momento.');
      return;
    }

    if (item.kind === 'freezer') {
      const updatedRaw = {
        ...(item.rawItem as FreezerItem),
        defect: '',
      };
      delete (updatedRaw as any).defect;
      updateFreezer(updatedRaw);

      // Modifica a situação do equipamento na contagem para disponível
      if (equipmentCounts[item.id]) {
        updateEquipmentCount(item.id, {
          status: 'disponivel',
          damageDescription: '',
        });
      }
    } else if (item.kind === 'chopeira') {
      const updatedRaw = {
        ...(item.rawItem as EquipmentItem),
        defect: '',
      };
      delete (updatedRaw as any).defect;
      updateEquipment(updatedRaw);

      // Modifica a situação do equipamento na contagem para disponível
      if (equipmentCounts[item.id]) {
        updateEquipmentCount(item.id, {
          status: 'disponivel',
          damageDescription: '',
        });
      }
    } else {
      updateUncataloguedEquipment({
        ...(item.rawItem as UncataloguedEquipment),
        status: 'disponivel',
        damageDescription: '',
      });
    }

    if (frozenReportText) {
      setFrozenReportText(null);
    }

    showToast(`Defeito do patrimônio ${item.patrimony} removido da base e situação atualizada para Disponível!`);
  };

  // Inclusão avulsa digitando o patrimônio
  const handleIncludeByPatrimony = (e: React.FormEvent) => {
    e.preventDefault();
    setIncludeError('');

    if (isMaster && isContadorActive) {
      setIncludeError('Existe usuário realizando contagem no momento.');
      return;
    }

    const cleanPat = includePatrimony.trim().toUpperCase();
    const cleanDefect = includeDefectText.trim();

    if (!cleanPat) {
      setIncludeError('Digite o patrimônio do equipamento.');
      return;
    }
    if (!cleanDefect) {
      setIncludeError('Digite a descrição do defeito.');
      return;
    }

    const foundFreezer = freezers.find(f => 
      f.patrimony.toUpperCase() === cleanPat || 
      f.patrimony.replace(/\D/g, '') === cleanPat.replace(/\D/g, '')
    );

    if (foundFreezer) {
      updateFreezer({
        ...foundFreezer,
        defect: cleanDefect,
      });
      if (equipmentCounts[foundFreezer.id]) {
        updateEquipmentCount(foundFreezer.id, {
          status: 'danificado',
          damageDescription: cleanDefect,
        });
      }
      showToast(`Defeito incluído com sucesso no Freezer [${foundFreezer.code}] Patrimônio: ${foundFreezer.patrimony}!`);
      setIsIncludeOpen(false);
      setIncludePatrimony('');
      setIncludeDefectText('');
      setSearchTerm('');
      return;
    }

    const foundChopeira = equipments.find(e => 
      e.patrimony.toUpperCase() === cleanPat || 
      e.patrimony.replace(/\D/g, '') === cleanPat.replace(/\D/g, '')
    );

    if (foundChopeira) {
      updateEquipment({
        ...foundChopeira,
        defect: cleanDefect,
      });
      if (equipmentCounts[foundChopeira.id]) {
        updateEquipmentCount(foundChopeira.id, {
          status: 'danificado',
          damageDescription: cleanDefect,
        });
      }
      showToast(`Defeito incluído com sucesso na Chopeira [${foundChopeira.code}] Patrimônio: ${foundChopeira.patrimony}!`);
      setIsIncludeOpen(false);
      setIncludePatrimony('');
      setIncludeDefectText('');
      setSearchTerm('');
      return;
    }

    setIncludeError(`Patrimônio "${cleanPat}" não encontrado na base de Freezers ou Chopeiras.`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">
        
        {/* Header do Modal */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200 shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                Gestão e Edição de Defeitos dos Equipamentos
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

        {/* Feedback Toast */}
        {successToast && (
          <div className="mx-4 mt-3 p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Barra de Filtros e Busca */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          
          {/* EXIGÊNCIA: FILTRO PARA "Todo", "Com Defeito" e "Sem Defeito" */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
              Filtrar por Situação de Defeito:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDefectFilter('todo')}
                className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  defectFilter === 'todo'
                    ? 'bg-slate-900 text-white border-slate-800 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Todo</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  defectFilter === 'todo' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {totalGeral}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDefectFilter('com_defeito')}
                className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  defectFilter === 'com_defeito'
                    ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                    : 'bg-rose-50/70 border-rose-200 text-rose-800 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Com Defeito</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  defectFilter === 'com_defeito' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900'
                }`}>
                  {totalComDefeito}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDefectFilter('sem_defeito')}
                className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  defectFilter === 'sem_defeito'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                <span>Sem Defeito</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  defectFilter === 'sem_defeito' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {totalSemDefeito}
                </span>
              </button>
            </div>
          </div>

          {/* Linha com Busca e Filtros de Tipo */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por patrimônio, código, nome ou defeito..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setFilterKind('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  filterKind === 'all'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Todos Tipos
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('freezer')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                  filterKind === 'freezer'
                    ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Snowflake className="w-3 h-3" />
                <span>Freezers</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterKind('chopeira')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1 cursor-pointer ${
                  filterKind === 'chopeira'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Chopeiras</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal / Formulário Inline de Inserção / Edição de Defeito para o Item Selecionado */}
        {editingItem && (
          <div className="p-4 bg-amber-50/80 border-b-2 border-amber-300 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-amber-700" />
                <span>
                  {editingItem.hasDefect ? 'Editar Defeito' : 'Inserir Defeito'} no Equipamento:
                  {' '}<strong className="text-slate-900 bg-white px-2 py-0.5 rounded border border-amber-300">{editingItem.patrimony}</strong> ({editingItem.name})
                </span>
              </span>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDefect} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Descrição do Defeito / Avaria *
                </label>
                <input
                  type="text"
                  value={editDefectText}
                  onChange={e => setEditDefectText(e.target.value)}
                  placeholder="Ex: Motor queimado, termostato desregulado, vazamento na serpentina, porta sem vedação..."
                  required
                  autoFocus
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 font-medium shadow-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Salvar Defeito</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal / Formulário de Inclusão por Busca Avulsa */}
        {isIncludeOpen && (
          <div className="p-4 bg-emerald-50/60 border-b border-emerald-200 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>Localizar Equipamento por Patrimônio e Inserir Defeito</span>
              </span>
              <button
                type="button"
                onClick={() => setIsIncludeOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {includeError && (
              <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium">
                {includeError}
              </div>
            )}

            <form onSubmit={handleIncludeByPatrimony} className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Patrimônio do Equipamento *
                  </label>
                  <input
                    type="text"
                    value={includePatrimony}
                    onChange={e => {
                      setIncludePatrimony(e.target.value.toUpperCase());
                      setIncludeError('');
                    }}
                    placeholder="Ex: PAT-10293 ou 10293"
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono uppercase focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Descrição do Defeito / Avaria *
                  </label>
                  <input
                    type="text"
                    value={includeDefectText}
                    onChange={e => {
                      setIncludeDefectText(e.target.value);
                      setIncludeError('');
                    }}
                    placeholder="Ex: Motor com barulho, borracha danificada, vazando gás..."
                    required
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsIncludeOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Salvar Defeito na Base</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Equipamentos de acordo com o filtro selecionado */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-1">
              <p className="text-xs font-bold text-slate-700">
                {defectFilter === 'com_defeito' 
                  ? 'Nenhum equipamento com defeito encontrado com os filtros aplicados.' 
                  : defectFilter === 'sem_defeito'
                    ? 'Nenhum equipamento sem defeito encontrado com os filtros aplicados.'
                    : 'Nenhum equipamento encontrado na contagem ou na base.'}
              </p>
              <p className="text-[11px] text-slate-400">
                Altere os filtros acima ou cadastre novos equipamentos na base de dados.
              </p>
            </div>
          ) : (
            filteredItems.map(item => (
              <div
                key={`${item.kind}-${item.id}`}
                className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 text-xs ${
                  item.hasDefect
                    ? 'bg-rose-50/40 hover:bg-rose-50/70 border-rose-200 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    item.kind === 'freezer'
                      ? 'bg-sky-100 text-sky-700 border-sky-200'
                      : item.kind === 'chopeira'
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {item.kind === 'freezer' ? <Snowflake className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        [{item.code}]
                      </span>
                      <span className="font-mono text-xs font-black text-slate-950 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                        Patrimônio: {item.patrimony}
                      </span>
                      <span className="text-slate-700 truncate font-semibold">
                        {item.name}
                      </span>
                      {item.source === 'contagem' && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                          Na contagem (Fora da Base)
                        </span>
                      )}
                    </div>

                    {/* Exibição do Defeito ou Status Sem Defeito */}
                    {item.hasDefect ? (
                      <div className="p-2 bg-rose-100/70 border border-rose-200 rounded-xl text-rose-950 text-xs font-medium flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="font-black text-rose-900">Defeito:</span>
                        <span className="font-semibold">{item.defect}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold pt-0.5">
                        <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                        <span>Equipamento sem defeito cadastrado</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões de Ação na Linha */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {item.hasDefect ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartDefectAction(item)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Editar defeito deste equipamento"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDefect(item)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Remover defeito deste equipamento"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Remover</span>
                      </button>
                    </>
                  ) : (
                    /* EXIGÊNCIA: os equipamentos sem defeitos poderão nessa tela ser inserido o defeito nos mesmos */
                    <button
                      type="button"
                      onClick={() => handleStartDefectAction(item)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                      title="Inserir defeito para este equipamento"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Inserir Defeito</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Exibindo <strong>{filteredItems.length}</strong> equipamentos de acordo com o filtro <strong>{defectFilter.replace('_', ' ').toUpperCase()}</strong>.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Modal de Confirmação: EXIGÊNCIA: perguntar "Deseja realmente excluir o defeito do equipamento?" */}
      {confirmDeleteDefectItem && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-rose-200 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Excluir Defeito
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Confirmação de Remoção
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl text-xs text-slate-800 space-y-1.5">
              <p className="font-bold text-rose-950 text-sm">
                Deseja realmente excluir o defeito do equipamento?
              </p>
              <p className="text-[11px] text-slate-600 font-mono">
                [{confirmDeleteDefectItem.code}] Patrimônio: {confirmDeleteDefectItem.patrimony} - {confirmDeleteDefectItem.name}
              </p>
              {confirmDeleteDefectItem.defect && (
                <p className="text-[11px] text-rose-800 font-semibold italic">
                  Defeito: "{confirmDeleteDefectItem.defect}"
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteDefectItem(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = confirmDeleteDefectItem;
                  setConfirmDeleteDefectItem(null);
                  handleDeleteDefect(it);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir Defeito</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
