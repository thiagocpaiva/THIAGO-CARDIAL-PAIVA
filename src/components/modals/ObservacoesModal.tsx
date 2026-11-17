import React, { useState } from 'react';
import {
  X,
  MessageSquareText,
  Edit3,
  Plus,
  Trash2,
  Snowflake,
  Zap,
  CheckCircle2,
  Search,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { FreezerItem, EquipmentItem, UncataloguedEquipment } from '../../types/inventory';

interface ObservacoesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EquipObsUnifiedItem = {
  id: string;
  kind: 'freezer' | 'chopeira' | 'uncat';
  code: string;
  patrimony: string;
  name: string;
  identity?: string;
  observations?: string;
  hasObs: boolean;
  source: 'base' | 'contagem';
  rawItem: FreezerItem | EquipmentItem | UncataloguedEquipment;
};

export const ObservacoesModal: React.FC<ObservacoesModalProps> = ({ isOpen, onClose }) => {
  const {
    freezers,
    equipments,
    uncataloguedEquipments,
    updateFreezer,
    updateEquipment,
    updateUncataloguedEquipment,
    frozenReportText,
    setFrozenReportText,
    isMaster,
    isContadorActive,
    isAnyBaseCountInProgress,
  } = useInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [obsFilter, setObsFilter] = useState<'todo' | 'com_obs' | 'sem_obs'>('todo');
  const [filterKind, setFilterKind] = useState<'all' | 'freezer' | 'chopeira'>('all');

  const [editingItem, setEditingItem] = useState<EquipObsUnifiedItem | null>(null);
  const [editObsText, setEditObsText] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [confirmDeleteObsItem, setConfirmDeleteObsItem] = useState<EquipObsUnifiedItem | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  if (!isOpen) return null;

  const isLockedForMaster = isMaster && (isContadorActive || isAnyBaseCountInProgress);

  const allEquipmentsList: EquipObsUnifiedItem[] = [];

  freezers.forEach(f => {
    const obs = f.observations?.trim() || undefined;
    allEquipmentsList.push({
      id: f.id,
      kind: 'freezer',
      code: f.code || '0',
      patrimony: f.patrimony,
      name: f.name,
      identity: f.identity,
      observations: obs,
      hasObs: Boolean(obs && obs.length > 0),
      source: 'base',
      rawItem: f,
    });
  });

  equipments.forEach(eq => {
    const obs = eq.observations?.trim() || undefined;
    allEquipmentsList.push({
      id: eq.id,
      kind: 'chopeira',
      code: eq.code || '0',
      patrimony: eq.patrimony,
      name: eq.name,
      observations: obs,
      hasObs: Boolean(obs && obs.length > 0),
      source: 'base',
      rawItem: eq,
    });
  });

  uncataloguedEquipments.forEach(u => {
    const alreadyListed = allEquipmentsList.some(
      item => item.patrimony.toUpperCase() === u.patrimony.toUpperCase()
    );
    if (!alreadyListed) {
      const obs = u.observations?.trim() || undefined;
      allEquipmentsList.push({
        id: u.id,
        kind: 'uncat',
        code: 'NÃO-CAD',
        patrimony: u.patrimony,
        name: 'Equipamento Encontrado na Contagem',
        observations: obs,
        hasObs: Boolean(obs && obs.length > 0),
        source: 'contagem',
        rawItem: u,
      });
    }
  });

  const totalGeral = allEquipmentsList.length;
  const totalComObs = allEquipmentsList.filter(item => item.hasObs).length;
  const totalSemObs = allEquipmentsList.filter(item => !item.hasObs).length;

  const filteredItems = allEquipmentsList
    .filter(item => {
      if (obsFilter === 'com_obs' && !item.hasObs) return false;
      if (obsFilter === 'sem_obs' && item.hasObs) return false;

      if (filterKind === 'freezer' && item.kind !== 'freezer') return false;
      if (filterKind === 'chopeira' && item.kind !== 'chopeira') return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.patrimony.toLowerCase().includes(term) ||
        item.code.toLowerCase().includes(term) ||
        item.name.toLowerCase().includes(term) ||
        (item.identity && item.identity.toLowerCase().includes(term)) ||
        (item.observations && item.observations.toLowerCase().includes(term))
      );
    })
    .sort((a, b) =>
      a.patrimony.localeCompare(b.patrimony, undefined, { numeric: true, sensitivity: 'base' })
    );

  const handleStartObsAction = (item: EquipObsUnifiedItem) => {
    setEditingItem(item);
    setEditObsText(item.observations || '');
  };

  const handleSaveObs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (isLockedForMaster) {
      showToast('Existe contagem em andamento.');
      return;
    }

    const newObs = editObsText.trim();
    const actionLabel = editingItem.hasObs ? 'atualizada' : 'inserida';

    if (editingItem.kind === 'freezer') {
      const updatedRaw: FreezerItem = {
        ...(editingItem.rawItem as FreezerItem),
      };
      if (newObs) {
        updatedRaw.observations = newObs;
      } else {
        delete updatedRaw.observations;
      }
      updateFreezer(updatedRaw);
    } else if (editingItem.kind === 'chopeira') {
      const updatedRaw: EquipmentItem = {
        ...(editingItem.rawItem as EquipmentItem),
      };
      if (newObs) {
        updatedRaw.observations = newObs;
      } else {
        delete updatedRaw.observations;
      }
      updateEquipment(updatedRaw);
    } else {
      updateUncataloguedEquipment({
        ...(editingItem.rawItem as UncataloguedEquipment),
        observations: newObs,
      });
    }

    showToast(`Observação (OBS) do patrimônio ${editingItem.patrimony} ${actionLabel} com sucesso!`);
    setEditingItem(null);
    setEditObsText('');
    setSearchTerm('');
  };

  const handleDeleteObs = (item: EquipObsUnifiedItem) => {
    if (isLockedForMaster) {
      showToast('Existe contagem em andamento.');
      return;
    }

    if (item.kind === 'freezer') {
      const updatedRaw = {
        ...(item.rawItem as FreezerItem),
      };
      delete (updatedRaw as any).observations;
      updateFreezer(updatedRaw);
    } else if (item.kind === 'chopeira') {
      const updatedRaw = {
        ...(item.rawItem as EquipmentItem),
      };
      delete (updatedRaw as any).observations;
      updateEquipment(updatedRaw);
    } else {
      updateUncataloguedEquipment({
        ...(item.rawItem as UncataloguedEquipment),
        observations: '',
      });
    }

    if (frozenReportText) {
      setFrozenReportText(null);
      try {
        localStorage.removeItem('frozen_report_text');
      } catch {}
    }

    showToast(`Observação (OBS) do patrimônio ${item.patrimony} removida da base com sucesso!`);
    setSearchTerm('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">

        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center border border-sky-200 shrink-0">
              <MessageSquareText className="w-5 h-5 text-sky-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                Gestão e Edição de Observações (OBS) dos Equipamentos
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

        {/* Filtros e Busca */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
              Filtrar por Situação do Campo OBS:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setObsFilter('todo')}
                className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  obsFilter === 'todo'
                    ? 'bg-slate-900 text-white border-slate-800 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>Todo</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  obsFilter === 'todo' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {totalGeral}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setObsFilter('com_obs')}
                className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  obsFilter === 'com_obs'
                    ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                    : 'bg-sky-50/70 border-sky-200 text-sky-900 hover:bg-sky-100'
                }`}
              >
                <MessageSquareText className="w-3.5 h-3.5 shrink-0" />
                <span>Com Observação</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  obsFilter === 'com_obs' ? 'bg-sky-800 text-white' : 'bg-sky-200 text-sky-900'
                }`}>
                  {totalComObs}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setObsFilter('sem_obs')}
                className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  obsFilter === 'sem_obs'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />
                <span>Sem Observação</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  obsFilter === 'sem_obs' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'
                }`}>
                  {totalSemObs}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-1">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por patrimônio, código, nome ou observação (OBS)..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setFilterKind('all')}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  filterKind === 'all'
                    ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
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

        {/* Formulário Inline de Inserção / Edição de Observação (OBS) */}
        {editingItem && (
          <div className="p-4 bg-sky-50/80 border-b-2 border-sky-300 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-sky-950 flex items-center gap-1.5">
                <Edit3 className="w-4 h-4 text-sky-700" />
                <span>
                  {editingItem.hasObs ? 'Editar Observação (OBS)' : 'Inserir Observação (OBS)'} no Equipamento:
                  {' '}<strong className="text-slate-900 bg-white px-2 py-0.5 rounded border border-sky-300">{editingItem.patrimony}</strong> ({editingItem.name})
                </span>
              </span>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveObs} className="space-y-2.5">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Observação (OBS) do Equipamento *
                </label>
                <textarea
                  rows={2}
                  value={editObsText}
                  onChange={e => setEditObsText(e.target.value)}
                  placeholder="Ex: Localizado no galpão B, revisado recentemente, aguardando adesivo..."
                  required
                  autoFocus
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 font-medium shadow-xs resize-none"
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
                  className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Salvar OBS</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de Equipamentos */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-500 space-y-1">
              <p className="text-xs font-bold text-slate-700">
                {obsFilter === 'com_obs'
                  ? 'Nenhum equipamento com observação (OBS) encontrado com os filtros aplicados.'
                  : obsFilter === 'sem_obs'
                    ? 'Nenhum equipamento sem observação (OBS) encontrado com os filtros aplicados.'
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
                  item.hasObs
                    ? 'bg-sky-50/40 hover:bg-sky-50/70 border-sky-200 shadow-2xs'
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
                      {item.identity && (
                        <span className="text-[10px] font-bold text-sky-900 bg-sky-100 px-1.5 py-0.2 rounded border border-sky-200">
                          IDT: {item.identity}
                        </span>
                      )}
                      {item.source === 'contagem' && (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                          Na contagem (Fora da Base)
                        </span>
                      )}
                    </div>

                    {item.hasObs ? (
                      <div className="p-2 bg-sky-100/70 border border-sky-200 rounded-xl text-sky-950 text-xs font-medium flex items-start gap-2">
                        <MessageSquareText className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-black text-sky-900">OBS:</strong>{' '}
                          <span className="font-semibold">{item.observations}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold pt-0.5">
                        <span>Equipamento sem observação (OBS) cadastrada</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  {item.hasObs ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartObsAction(item)}
                        className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Editar observação deste equipamento"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-sky-700" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setConfirmDeleteObsItem(item)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-xs"
                        title="Remover observação deste equipamento"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                        <span>Remover</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartObsAction(item)}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs"
                      title="Inserir observação para este equipamento"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Inserir OBS</span>
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
            Exibindo <strong>{filteredItems.length}</strong> equipamentos de acordo com o filtro <strong>{obsFilter.replace('_', ' ').toUpperCase()}</strong>.
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

      {/* Modal de Confirmação de Remoção de OBS */}
      {confirmDeleteObsItem && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-rose-200 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">
                  Excluir Observação (OBS)
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Confirmação de Remoção
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/60 border border-rose-100 rounded-2xl text-xs text-slate-800 space-y-1.5">
              <p className="font-bold text-rose-950 text-sm">
                Deseja realmente excluir a observação (OBS) do equipamento?
              </p>
              <p className="text-[11px] text-slate-600 font-mono">
                [{confirmDeleteObsItem.code}] Patrimônio: {confirmDeleteObsItem.patrimony} - {confirmDeleteObsItem.name}
              </p>
              {confirmDeleteObsItem.observations && (
                <p className="text-[11px] text-rose-800 font-semibold italic">
                  OBS: "{confirmDeleteObsItem.observations}"
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmDeleteObsItem(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = confirmDeleteObsItem;
                  setConfirmDeleteObsItem(null);
                  handleDeleteObs(it);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Excluir OBS</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
