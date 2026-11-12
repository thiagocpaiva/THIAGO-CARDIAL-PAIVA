
import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, 
  Layers, 
  Zap, 
  Search, 
  Check, 
  CheckSquare, 
  Square, 
  Send, 
  AlertCircle, 
  Eye, 
  Sliders, 
  Plus, 
  Minus, 
  AlertTriangle,
  ClipboardCheck,
  Info,
  X
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialItem, FreezerItem, EquipmentItem, MaterialDailyEntry, EquipmentDailyEntry } from '../../types/inventory';
import { generateStockReportText, generateStockReportHtml } from '../../utils/reportGenerator';
import { sendEmailDirectly } from '../../utils/emailSender';
import { GrupoMSBrand } from '../common/GrupoMSBrand';

export const RecontagemView: React.FC = () => {
  const {
    activeUser,
    isMaster,
    activeBranch,
    materials,
    freezers,
    equipments,
    materialCounts,
    equipmentCounts,
    recontagemSelectedIds,
    recontagemMaterialCounts,
    recontagemEquipmentCounts,
    toggleRecontagemItem,
    setRecontagemItem,
    selectAllRecontagem,
    clearAllRecontagem,
    updateRecontagemMaterialCount,
    updateRecontagemEquipmentCount,
    recontagemSelectedCount,
    todayDateFormatted,
    defaultSenderEmail,
    emailSettings,
    serverEmailConfig,
    isPhoneFrame,
  } = useInventory();

  // Filtro na tela do Master: 'materiais' ou 'equipamentos'
  const [masterFilter, setMasterFilter] = useState<'materiais' | 'equipamentos'>('materiais');
  const [searchQuery, setSearchQuery] = useState('');

  // No Master, permite alternar entre a tela de Seleção e a Prévia do Contador
  const [masterViewMode, setMasterViewMode] = useState<'selecao' | 'contador'>('selecao');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sendResultMsg, setSendResultMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Funções de verificação: item possui contagem inserida hoje na base ativa
  const isMaterialCountedToday = (mId: string, counts: Record<string, MaterialDailyEntry>) => {
    const m = counts[mId];
    if (!m) return false;
    return (
      (m.disponivel || 0) > 0 ||
      (m.danificado || 0) > 0 ||
      (m.barrilCheio || 0) > 0 ||
      (m.barrilVazio || 0) > 0 ||
      (m.barrilEmRota || 0) > 0 ||
      (m.co2Cheio || 0) > 0 ||
      (m.co2Mexido || 0) > 0 ||
      (m.co2Vazio || 0) > 0 ||
      (m.co2EmRota || 0) > 0
    );
  };

  const isEquipmentCountedToday = (eqId: string, counts: Record<string, EquipmentDailyEntry>) => {
    const entry = counts[eqId];
    return Boolean(entry && entry.status);
  };

  // EXIGÊNCIA: Na tela Recontagem, do usuário Master, os itens a ser selecionados para a recontagem,
  // são atualizados de acordo com as contagens inseridas nas telas Materiais e Equipamentos.
  // Caso não tenha contagem inserida, não aparecerá também nenhum item a ser selecionado.
  const countedMaterials = useMemo(() => {
    return materials.filter(m => isMaterialCountedToday(m.id, materialCounts));
  }, [materials, materialCounts]);

  const countedEquipmentsList = useMemo(() => {
    const list: Array<{ item: FreezerItem | EquipmentItem; kind: 'freezer' | 'chopeira' }> = [];
    freezers.forEach(f => {
      if (isEquipmentCountedToday(f.id, equipmentCounts)) {
        list.push({ item: f, kind: 'freezer' });
      }
    });
    equipments.forEach(eq => {
      if (isEquipmentCountedToday(eq.id, equipmentCounts)) {
        list.push({ item: eq, kind: 'chopeira' });
      }
    });
    return list.sort((a, b) => (a.item.patrimony || '').localeCompare(b.item.patrimony || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [freezers, equipments, equipmentCounts]);

  // Itens filtrados para a tela de Seleção do Master (ordenados alfabeticamente por descrição / patrimônio)
  const filteredMaterials = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = countedMaterials.filter(m => {
      if (!q) return true;
      return (
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.subOption && m.subOption.toLowerCase().includes(q))
      );
    });
    return list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }, [countedMaterials, searchQuery]);

  const filteredEquipments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = countedEquipmentsList.filter(({ item, kind }) => {
      if (!q) return true;
      const f = item as FreezerItem;
      const eq = item as EquipmentItem;
      return (
        item.code.toLowerCase().includes(q) ||
        item.patrimony.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (f.brand && f.brand.toLowerCase().includes(q)) ||
        (f.model && f.model.toLowerCase().includes(q)) ||
        (eq.brand && eq.brand.toLowerCase().includes(q)) ||
        (item.defect && item.defect.toLowerCase().includes(q))
      );
    });
    return list.slice().sort((a, b) => (a.item.patrimony || '').localeCompare(b.item.patrimony || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [countedEquipmentsList, searchQuery]);

  // Itens selecionados para a Recontagem efetiva (somente itens que possuam contagem hoje)
  const selectedMaterials = useMemo(() => {
    return materials
      .filter(m => Boolean(recontagemSelectedIds[m.id]) && isMaterialCountedToday(m.id, materialCounts))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }, [materials, recontagemSelectedIds, materialCounts]);

  const selectedFreezers = useMemo(() => {
    return freezers
      .filter(f => Boolean(recontagemSelectedIds[f.id]) && isEquipmentCountedToday(f.id, equipmentCounts))
      .sort((a, b) => (a.patrimony || '').localeCompare(b.patrimony || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [freezers, recontagemSelectedIds, equipmentCounts]);

  const selectedEquipments = useMemo(() => {
    return equipments
      .filter(eq => Boolean(recontagemSelectedIds[eq.id]) && isEquipmentCountedToday(eq.id, equipmentCounts))
      .sort((a, b) => (a.patrimony || '').localeCompare(b.patrimony || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [equipments, recontagemSelectedIds, equipmentCounts]);

  // Determina estoque selecionado para o gerador de relatório
  const recountStockType: 'materiais' | 'equipamentos' | 'ambos' = useMemo(() => {
    const hasMats = selectedMaterials.length > 0;
    const hasEqs = selectedFreezers.length > 0 || selectedEquipments.length > 0;
    if (hasMats && hasEqs) return 'ambos';
    if (hasEqs) return 'equipamentos';
    return 'materiais';
  }, [selectedMaterials.length, selectedFreezers.length, selectedEquipments.length]);

  // Texto da Prévia do Relatório da Recontagem
  const recountReportText = useMemo(() => {
    return generateStockReportText({
      selectedStock: recountStockType,
      todayDateFormatted,
      activeUser,
      defaultSenderEmail,
      recipients: emailSettings.emails,
      materials: selectedMaterials,
      freezers: selectedFreezers,
      equipments: selectedEquipments,
      uncataloguedEquipments: [],
      materialCounts: recontagemMaterialCounts,
      equipmentCounts: recontagemEquipmentCounts,
      includeEquipmentDefects: false,
      branch: activeBranch,
      isMobile: isPhoneFrame,
      isRecontagem: true,
    });
  }, [
    recountStockType,
    todayDateFormatted,
    activeUser,
    defaultSenderEmail,
    emailSettings.emails,
    selectedMaterials,
    selectedFreezers,
    selectedEquipments,
    recontagemMaterialCounts,
    recontagemEquipmentCounts,
    activeBranch,
    isPhoneFrame,
  ]);

  // Enviar E-mail da Recontagem (mesmo formato que o e-mail da contagem)
  const handleSendRecountEmail = async () => {
    setSendResultMsg(null);

    const primaryTo = (defaultSenderEmail || '').trim();
    const configuredRecipients = emailSettings.emails;
    const ccEmails = configuredRecipients.filter(e => e.toLowerCase() !== primaryTo.toLowerCase());
    const ccStr = ccEmails.join(',');

    if (!primaryTo && configuredRecipients.length === 0) {
      showToast(`Nenhum destinatário configurado para a base ${activeBranch}.`);
      return;
    }

    const effectiveTo = primaryTo || (configuredRecipients.length > 0 ? configuredRecipients[0] : '');
    const effectiveCc = primaryTo ? ccStr : configuredRecipients.slice(1).join(',');
    const subject = `[${activeBranch}] Relatório de Recontagem de Estoque - ${todayDateFormatted}`;

    const reportHtml = generateStockReportHtml({
      selectedStock: recountStockType,
      todayDateFormatted,
      activeUser,
      defaultSenderEmail,
      recipients: effectiveTo ? [effectiveTo, ...ccEmails] : configuredRecipients,
      materials: selectedMaterials,
      freezers: selectedFreezers,
      equipments: selectedEquipments,
      uncataloguedEquipments: [],
      materialCounts: recontagemMaterialCounts,
      equipmentCounts: recontagemEquipmentCounts,
      includeEquipmentDefects: false,
      branch: activeBranch,
      isRecontagem: true,
    });

    // Copia relatório para a área de transferência com HTML e texto
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const blobText = new Blob([recountReportText], { type: 'text/plain' });
        const blobHtml = new Blob([reportHtml], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': blobText,
            'text/html': blobHtml,
          }),
        ]);
      } catch {
        navigator.clipboard.writeText(recountReportText);
      }
    }

    // Tenta envio em segundo plano se houver servidor configurado
    sendEmailDirectly({
      fromEmail: serverEmailConfig?.senderEmail || defaultSenderEmail,
      senderName: serverEmailConfig?.senderName || 'RECONTAGEM DE ESTOQUE',
      toEmails: effectiveTo ? [effectiveTo, ...ccEmails] : configuredRecipients,
      subject,
      bodyText: recountReportText,
      htmlBody: reportHtml,
      smtpConfig: serverEmailConfig,
    }).catch(() => {});

    // Abre programa de e-mail padrão do dispositivo
    let mailtoUrl = `mailto:${encodeURIComponent(effectiveTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(recountReportText)}`;
    if (effectiveCc) {
      mailtoUrl += `&cc=${encodeURIComponent(effectiveCc)}`;
    }
    window.location.href = mailtoUrl;

    setSendResultMsg('Aplicativo de e-mail acionado e relatório copiado para a área de transferência!');
  };

  // =========================================================================
  // TELA DO USUÁRIO CONTADOR (OU PRÉVIA DO MASTER)
  // =========================================================================
  const renderContadorRecountView = () => {
    const hasItems = selectedMaterials.length > 0 || selectedFreezers.length > 0 || selectedEquipments.length > 0;

    return (
      <div className="space-y-4 pb-12 bg-white">
        {/* Banner do Contador */}
        <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-black text-rose-950 uppercase tracking-wide">
                Recontagem de Estoque Solicitada
              </h2>
              <p className="text-[11px] text-rose-800 font-medium">
                Item(ns) selecionado(s) para recontagem(ens).
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[10px] font-black shrink-0 shadow-2xs">
            {recontagemSelectedCount} {recontagemSelectedCount === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {/* Feedback Toasts */}
        {toastMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
        {sendResultMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{sendResultMsg}</span>
          </div>
        )}

        {!hasItems ? (
          <div className="p-8 bg-slate-50 border border-slate-200 rounded-3xl text-center space-y-2">
            <Info className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-xs font-bold text-slate-700">Nenhum item selecionado para recontagem</h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              O usuário Master ainda não marcou itens para serem recontados na base {activeBranch}.
            </p>
          </div>
        ) : (
          <>
            {/* SEÇÃO 1: MATERIAIS SELECIONADOS PARA RECONTAGEM */}
            {selectedMaterials.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Layers className="w-4 h-4 text-amber-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Materiais a Recontar ({selectedMaterials.length})
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {selectedMaterials.map(mat => {
                    const count = recontagemMaterialCounts[mat.id] || { itemId: mat.id, disponivel: 0, danificado: 0 };
                    const isBarril = mat.category === 'barril' || mat.name.toLowerCase().includes('barril');
                    const isCO2 = mat.category === 'co2' || mat.name.toLowerCase().includes('co2') || mat.name.toLowerCase().includes('cilindro');

                    return (
                      <div
                        key={mat.id}
                        className="bg-white border-2 border-amber-300 rounded-2xl p-3 space-y-2 shadow-xs hover:border-amber-400 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              [{mat.code}]
                            </span>
                            <h4 className="text-xs font-bold text-slate-900 mt-1 leading-tight">
                              {mat.name}
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-black uppercase rounded-full shrink-0">
                            Recontar
                          </span>
                        </div>

                        {/* Contadores específicos do tipo de material */}
                        {isBarril ? (
                          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                            {/* Cheio */}
                            <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200 text-center">
                              <span className="text-[10px] font-bold text-emerald-800 block mb-1">Cheio</span>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilCheio: Math.max(0, (count.barrilCheio || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center active:scale-90"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs min-w-[20px]">{count.barrilCheio || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilCheio: (count.barrilCheio || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Vazio */}
                            <div className="bg-amber-50/60 p-2 rounded-xl border border-amber-200 text-center">
                              <span className="text-[10px] font-bold text-amber-800 block mb-1">Vazio</span>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilVazio: Math.max(0, (count.barrilVazio || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-amber-200 text-amber-900 font-bold flex items-center justify-center active:scale-90"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs min-w-[20px]">{count.barrilVazio || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilVazio: (count.barrilVazio || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-amber-600 text-white font-bold flex items-center justify-center active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Em Rota */}
                            <div className="bg-cyan-50/60 p-2 rounded-xl border border-cyan-200 text-center">
                              <span className="text-[10px] font-bold text-cyan-800 block mb-1">Em Rota</span>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilEmRota: Math.max(0, (count.barrilEmRota || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-cyan-200 text-cyan-900 font-bold flex items-center justify-center active:scale-90"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs min-w-[20px]">{count.barrilEmRota || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilEmRota: (count.barrilEmRota || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-cyan-600 text-white font-bold flex items-center justify-center active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : isCO2 ? (
                          <div className="grid grid-cols-4 gap-1.5 pt-1 text-xs">
                            {/* Cheio */}
                            <div className="bg-emerald-50/60 p-1.5 rounded-xl border border-emerald-200 text-center">
                              <span className="text-[9px] font-bold text-emerald-800 block mb-0.5">Cheio</span>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Cheio: Math.max(0, (count.co2Cheio || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2Cheio || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Cheio: (count.co2Cheio || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-emerald-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Mexido */}
                            <div className="bg-indigo-50/60 p-1.5 rounded-xl border border-indigo-200 text-center">
                              <span className="text-[9px] font-bold text-indigo-800 block mb-0.5">Mexido</span>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Mexido: Math.max(0, (count.co2Mexido || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-indigo-200 text-indigo-900 font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2Mexido || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Mexido: (count.co2Mexido || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-indigo-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Vazio */}
                            <div className="bg-amber-50/60 p-1.5 rounded-xl border border-amber-200 text-center">
                              <span className="text-[9px] font-bold text-amber-800 block mb-0.5">Vazio</span>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Vazio: Math.max(0, (count.co2Vazio || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-amber-200 text-amber-900 font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2Vazio || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Vazio: (count.co2Vazio || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-amber-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Em Rota */}
                            <div className="bg-cyan-50/60 p-1.5 rounded-xl border border-cyan-200 text-center">
                              <span className="text-[9px] font-bold text-cyan-800 block mb-0.5">Em Rota</span>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2EmRota: Math.max(0, (count.co2EmRota || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-cyan-200 text-cyan-900 font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2EmRota || 0}</span>
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2EmRota: (count.co2EmRota || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-cyan-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Material Normal: Disponível e Danificado */
                          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                            {/* Disponível */}
                            <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-emerald-900">Disponível:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { disponivel: Math.max(0, (count.disponivel || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center active:scale-90"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={count.disponivel ?? 0}
                                  onChange={e => updateRecontagemMaterialCount(mat.id, { disponivel: Math.max(0, parseInt(e.target.value) || 0) })}
                                  className="w-12 text-center font-mono font-black bg-white border border-emerald-300 rounded py-0.5 text-xs text-emerald-950"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { disponivel: (count.disponivel || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Danificado */}
                            <div className="bg-rose-50/70 p-2 rounded-xl border border-rose-200 flex items-center justify-between">
                              <span className="text-[11px] font-bold text-rose-900">Danificado:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { danificado: Math.max(0, (count.danificado || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-rose-200 text-rose-900 font-bold flex items-center justify-center active:scale-90"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={count.danificado ?? 0}
                                  onChange={e => updateRecontagemMaterialCount(mat.id, { danificado: Math.max(0, parseInt(e.target.value) || 0) })}
                                  className="w-12 text-center font-mono font-black bg-white border border-rose-300 rounded py-0.5 text-xs text-rose-950"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { danificado: (count.danificado || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-rose-600 text-white font-bold flex items-center justify-center active:scale-90"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SEÇÃO 2: EQUIPAMENTOS SELECIONADOS PARA RECONTAGEM */}
            {(selectedFreezers.length > 0 || selectedEquipments.length > 0) && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <Zap className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Equipamentos a Recontar ({selectedFreezers.length + selectedEquipments.length})
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {/* Freezers */}
                  {selectedFreezers.map(f => {
                    const count = recontagemEquipmentCounts[f.id];
                    const status = count?.status;
                    const isEmEstoque = status === 'em_estoque';
                    const isNaoConsta = status === 'nao_consta';

                    return (
                      <div
                        key={f.id}
                        className="bg-white border-2 border-cyan-300 rounded-2xl p-3 space-y-2.5 shadow-xs hover:border-cyan-400 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                                [{f.code}]
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                Patr: {f.patrimony}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500">
                                {f.voltage} • {f.brand}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 mt-1 leading-tight">
                              {f.name}
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-black uppercase rounded-full shrink-0">
                            Recontar
                          </span>
                        </div>

                        {/* Status Toggle: Em Estoque / Não Consta em Estoque (permite desselecionar) */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEmEstoque) {
                                updateRecontagemEquipmentCount(f.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(f.id, { status: 'em_estoque', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isEmEstoque 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Em Estoque</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isNaoConsta) {
                                updateRecontagemEquipmentCount(f.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(f.id, { status: 'nao_consta', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isNaoConsta 
                                ? 'bg-rose-600 text-white shadow-xs' 
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Não Consta em Estoque</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Chopeiras */}
                  {selectedEquipments.map(eq => {
                    const count = recontagemEquipmentCounts[eq.id];
                    const status = count?.status;
                    const isEmEstoque = status === 'em_estoque';
                    const isNaoConsta = status === 'nao_consta';

                    return (
                      <div
                        key={eq.id}
                        className="bg-white border-2 border-indigo-300 rounded-2xl p-3 space-y-2.5 shadow-xs hover:border-indigo-400 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                [{eq.code}]
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                Patr: {eq.patrimony}
                              </span>
                              <span className="text-[9px] font-bold text-slate-500">
                                {eq.type === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras'} • {eq.voltage}
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 mt-1 leading-tight">
                              {eq.name}
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-black uppercase rounded-full shrink-0">
                            Recontar
                          </span>
                        </div>

                        {/* Status Toggle: Em Estoque / Não Consta em Estoque (permite desselecionar) */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isEmEstoque) {
                                updateRecontagemEquipmentCount(eq.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(eq.id, { status: 'em_estoque', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isEmEstoque 
                                ? 'bg-emerald-600 text-white shadow-xs' 
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Em Estoque</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (isNaoConsta) {
                                updateRecontagemEquipmentCount(eq.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(eq.id, { status: 'nao_consta', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              isNaoConsta 
                                ? 'bg-rose-600 text-white shadow-xs' 
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Não Consta em Estoque</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SEÇÃO: BOTÃO ENVIAR E-MAIL DA RECONTAGEM */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs">
              {/* Botão para enviar o e-mail da recontagem (mesmo formato que o e-mail da contagem) */}
              <button
                type="button"
                onClick={handleSendRecountEmail}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4 stroke-[3]" />
                <span>Enviar Relatório da Recontagem por E-mail</span>
              </button>
            </div>

            {/* SEÇÃO: PRÉVIA DO RELATÓRIO DA RECONTAGEM */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <GrupoMSBrand size="sm" align="center" />
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-xs font-black text-rose-900 uppercase tracking-wider block">
                      PRÉVIA DO RELATÓRIO DA RECONTAGEM
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Itens Recontados na Base {activeBranch}
                    </span>
                  </div>
                </div>
              </div>

              <div
                className={`p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre leading-relaxed min-h-24 max-h-96 overflow-y-auto overflow-x-auto select-text shadow-inner ${
                  isPhoneFrame ? 'w-full max-w-full' : ''
                }`}
              >
                {recountReportText}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // =========================================================================
  // TELA DO USUÁRIO MASTER (SELEÇÃO DOS ITENS A RECONTAR)
  // =========================================================================
  if (!isMaster) {
    // Para o Contador, exibe diretamente a tela de Recontagem com apenas os itens selecionados
    return renderContadorRecountView();
  }

  return (
    <div className="space-y-4 pb-12 bg-white">
      {/* Header Master */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
            <RotateCcw className="w-5 h-5 text-rose-600" />
            <span>Recontagem de Itens</span>
          </h2>
          <p className="text-xs text-slate-500">
            Selecione quais itens precisarão ser recontados pelo conferente
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300">
            Base {activeBranch}
          </span>
          {recontagemSelectedCount > 0 && (
            <button
              type="button"
              onClick={() => setMasterViewMode(prev => (prev === 'selecao' ? 'contador' : 'selecao'))}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                masterViewMode === 'contador'
                  ? 'bg-rose-600 text-white'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200'
              }`}
              title="Alternar entre a tela de seleção e a visualização do Contador"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{masterViewMode === 'contador' ? 'Voltar à Seleção' : 'Ver Tela do Contador'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modo de visualização do Contador acionado pelo Master */}
      {masterViewMode === 'contador' ? (
        renderContadorRecountView()
      ) : (
        <>
          {/* Card de Resumo da Seleção Atual */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-900">
                  Total selecionado para recontagem:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-extrabold text-xs">
                  {recontagemSelectedCount} {recontagemSelectedCount === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {recontagemSelectedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearAllRecontagem();
                    showToast(`Seleção de recontagem limpa para a base ${activeBranch}!`);
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                >
                  Limpar Seleção
                </button>
              )}
            </div>

            {recontagemSelectedCount > 0 ? (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 leading-relaxed font-bold">
                Tela de recontagem liberada para o contador.
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                Marque os itens abaixo para ativar a tela de recontagem para o usuário Contador nesta base.
              </p>
            )}
          </div>

          {/* DOIS FILTROS PRINCIPAIS: MATERIAIS E EQUIPAMENTOS */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMasterFilter('materiais')}
              className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                masterFilter === 'materiais'
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm font-black'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Materiais ({countedMaterials.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setMasterFilter('equipamentos')}
              className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-bold text-xs cursor-pointer ${
                masterFilter === 'equipamentos'
                  ? 'bg-cyan-600 text-white border-cyan-700 shadow-sm font-black'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Equipamentos ({countedEquipmentsList.length})</span>
            </button>
          </div>

          {/* Barra de Pesquisa e Ações Rápidas */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={masterFilter === 'materiais' ? 'Buscar materiais contados por código ou nome...' : 'Buscar equipamentos contados por código ou patrimônio...'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>

            <button
              type="button"
              onClick={() => selectAllRecontagem(masterFilter)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-xl cursor-pointer shrink-0"
              title="Marcar todos os itens contados desta categoria"
            >
              Marcar Todos
            </button>
          </div>

          {/* LISTA DOS ITENS CADASTRADOS COM O CAMPO AO FINAL PARA SELEÇÃO DE RECONTAGEM */}
          {masterFilter === 'materiais' ? (
            <div className="space-y-2">
              {filteredMaterials.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-700">
                    {countedMaterials.length === 0
                      ? `Nenhum material com contagem inserida hoje na Base ${activeBranch}.`
                      : `Nenhum material contado corresponde à busca "${searchQuery}".`}
                  </p>
                  {countedMaterials.length === 0 && (
                    <p className="text-[11px] text-slate-500">
                      As contagens inseridas na tela Materiais aparecerão aqui para seleção de recontagem.
                    </p>
                  )}
                </div>
              ) : (
                filteredMaterials.map(m => {
                  const isSelected = Boolean(recontagemSelectedIds[m.id]);

                  return (
                    <div
                      key={m.id}
                      onClick={() => toggleRecontagemItem(m.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-rose-50/70 border-rose-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            [{m.code}]
                          </span>
                          {m.subOption && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              {m.subOption}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1 truncate">
                          {m.name}
                        </h4>
                      </div>

                      {/* CAMPO AO FINAL DA DESCRIÇÃO PARA SER SELECIONADO O ITEM A RECONTAR */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRecontagemItem(m.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-rose-600 text-white shadow-xs scale-105'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckSquare className="w-4 h-4 stroke-[2.5]" />
                              <span>Recontar</span>
                            </>
                          ) : (
                            <>
                              <Square className="w-4 h-4 text-slate-400" />
                              <span>Recontar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEquipments.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-700">
                    {countedEquipmentsList.length === 0
                      ? `Nenhum equipamento com contagem inserida hoje na Base ${activeBranch}.`
                      : `Nenhum equipamento contado corresponde à busca "${searchQuery}".`}
                  </p>
                  {countedEquipmentsList.length === 0 && (
                    <p className="text-[11px] text-slate-500">
                      As contagens realizadas na tela Equipamentos aparecerão aqui para seleção de recontagem.
                    </p>
                  )}
                </div>
              ) : (
                filteredEquipments.map(({ item, kind }) => {
                  const isSelected = Boolean(recontagemSelectedIds[item.id]);
                  const f = item as FreezerItem;
                  const eq = item as EquipmentItem;

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleRecontagemItem(item.id)}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-rose-50/70 border-rose-400 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                            [{item.code}]
                          </span>
                          <span className="text-[10px] font-mono font-bold text-cyan-900 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                            Patr: {item.patrimony}
                          </span>
                          <span className="text-[9px] font-bold text-slate-500">
                            {kind === 'freezer' ? `${f.brand} • ${f.model}` : `${eq.type === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras'}`}
                          </span>
                          {item.defect && (
                            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                              Defeito: {item.defect}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1 truncate">
                          {item.name}
                        </h4>
                      </div>

                      {/* CAMPO AO FINAL DA DESCRIÇÃO PARA SER SELECIONADO O ITEM A RECONTAR */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRecontagemItem(item.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-rose-600 text-white shadow-xs scale-105'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <CheckSquare className="w-4 h-4 stroke-[2.5]" />
                              <span>Recontar</span>
                            </>
                          ) : (
                            <>
                              <Square className="w-4 h-4 text-slate-400" />
                              <span>Recontar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
