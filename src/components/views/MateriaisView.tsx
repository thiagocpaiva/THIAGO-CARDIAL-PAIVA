
import React, { useState } from 'react';
import {
  Layers,
  Copy,
  Trash2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialCategory } from '../../types/inventory';
import { CATEGORIAS_MATERIAIS } from '../modals/CadastrarMaterialModal';
import { ModalClonarUltima } from '../modals/ModalClonarUltima';
import { AppBrandIcon } from '../AppBrandIcons';
import { MaterialCategoryFigure } from '../MaterialCategoryIcons';
import { MaterialCountingCard } from '../common/MaterialCountingCard';

export const MateriaisView: React.FC = () => {
  const {
    materials,
    materialCounts,
    updateMaterialCount,
    lastInsertedMaterialQty,
    recordLastInsertedMaterialQty,
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
    if (isAnyBaseCountInProgress) {
      setCloneToast('⚠️ Existe contagem em andamento.');
      setTimeout(() => setCloneToast(null), 3500);
      return;
    }
    // EXIGÊNCIA 2: ao precionar o botão "Zerar Contagens" e a contagem já tiver sido zerada, informar "Contagem já zerada"
    if (isCountAlreadyZero('materiais')) {
      setAlreadyZeroOpen(true);
      return;
    }
    setConfirmResetOpen(true);
  };

  const handleResetAllToday = () => {
    resetAllTodayCountsByMaster('materiais');
    setConfirmResetOpen(false);
    setCloneToast('🗑️ Contagem de materiais de hoje foi zerada!');
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
              onClick={() => {
                if (isAnyBaseCountInProgress) {
                  setCloneToast('⚠️ Existe contagem em andamento.');
                  setTimeout(() => setCloneToast(null), 3500);
                  return;
                }
                setIsCloneModalOpen(true);
              }}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Clonar última contagem por grupo ou estoque (Exclusivo Master)"
            >
              <Copy className="w-3.5 h-3.5 text-amber-600" />
              <span>Clonar Última</span>
            </button>
          )}

          {/* Botão Zerar Contagens (Apenas Usuário Master - zera somente Materiais) */}
          {isMaster && (
            <button
              onClick={handleResetButtonClick}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Zerar apenas a contagem de materiais de hoje"
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
            <span>Zerar contagem de materiais de hoje?</span>
          </div>
          <p className="text-slate-600 text-[11px]">
            Esta ação zerará <strong>apenas a contagem de Materiais</strong> da base atual. A última contagem fica salva no backup para clonagem.
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
              Sim, Zerar Materiais
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
                lastInsertedQty={lastInsertedMaterialQty[item.id]}
                onRecordLastInserted={recordLastInsertedMaterialQty}
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
