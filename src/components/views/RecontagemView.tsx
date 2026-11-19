
import React, { useState, useMemo, useEffect } from 'react';
import { 
  RotateCcw, 
  Layers, 
  Zap, 
  Search, 
  Check, 
  CheckSquare, 
  Square, 
  Send, 
  Eye, 
  Info,
  X,
  Unlock,
  Lock,
  PlusCircle,
  RefreshCw,
  UserCheck,
  Users
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialItem, FreezerItem, EquipmentItem, MaterialDailyEntry, EquipmentDailyEntry, isCoringaUser } from '../../types/inventory';
import { generateStockReportText, generateStockReportEmailTableText, generateStockReportHtml } from '../../utils/reportGenerator';
import { sendEmailDirectly } from '../../utils/emailSender';
import { GrupoMSBrand } from '../common/GrupoMSBrand';

export const RecontagemView: React.FC = () => {
  const {
    activeUser,
    users,
    isMaster,
    isCoringa,
    activeBranch,
    materials,
    freezers,
    equipments,
    materialCounts,
    equipmentCounts,
    uncataloguedEquipments,
    countStartedBy,
    recontagemTargetContador,
    recontagemUnlocked,
    isAnyBaseCountInProgress,
    canActiveUserRecount,
    releaseRecontagemForContador,
    markRecountAsSent,
    cancelRecontagemByContador,
    recontagemSelectedIds,
    recontagemMaterialCounts,
    recontagemEquipmentCounts,
    toggleRecontagemItem,
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
  const [uncountedSearchQuery, setUncountedSearchQuery] = useState('');
  const [isReleasingRecount, setIsReleasingRecount] = useState(false);
  const [isSendingRecountEmail, setIsSendingRecountEmail] = useState(false);
  const [isCancellingRecount, setIsCancellingRecount] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [selectedTargetContadorId, setSelectedTargetContadorId] = useState<string>('');

  // No Master, permite alternar entre a tela de Seleção e a Prévia do Contador
  const [masterViewMode, setMasterViewMode] = useState<'selecao' | 'contador'>('selecao');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sendResultMsg, setSendResultMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Lista de usuários contadores ativos pertencentes à base atualmente logada (nunca inclui CORINGA)
  const branchContadores = useMemo(() => {
    return users
      .filter(u => u.roleLevel === 'contador' && !isCoringaUser(u) && u.status === 'ativo' && u.branch === activeBranch)
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }, [users, activeBranch]);

  useEffect(() => {
    if (recontagemTargetContador && branchContadores.some(u => u.id === recontagemTargetContador.userId)) {
      setSelectedTargetContadorId(recontagemTargetContador.userId);
    } else {
      setSelectedTargetContadorId('');
    }
  }, [activeBranch, recontagemTargetContador?.userId]);

  useEffect(() => {
    if (recontagemSelectedCount === 0 && !recontagemUnlocked && !recontagemTargetContador) {
      setSelectedTargetContadorId('');
    }
  }, [recontagemSelectedCount, recontagemUnlocked, recontagemTargetContador]);

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

  // Demais Materiais e Equipamentos que NÃO foram contados inicialmente
  const uncountedMaterials = useMemo(() => {
    return materials.filter(m => !isMaterialCountedToday(m.id, materialCounts));
  }, [materials, materialCounts]);

  const uncountedEquipmentsList = useMemo(() => {
    const list: Array<{ item: FreezerItem | EquipmentItem; kind: 'freezer' | 'chopeira' }> = [];
    freezers.forEach(f => {
      if (!isEquipmentCountedToday(f.id, equipmentCounts)) {
        list.push({ item: f, kind: 'freezer' });
      }
    });
    equipments.forEach(eq => {
      if (!isEquipmentCountedToday(eq.id, equipmentCounts)) {
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
    const list = countedEquipmentsList.filter(({ item }) => {
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

  // Itens não contados inicialmente filtrados pela busca do campo específico do Master
  const filteredUncountedMaterials = useMemo(() => {
    const q = uncountedSearchQuery.trim().toLowerCase();
    const list = uncountedMaterials.filter(m => {
      if (!q) return true;
      return (
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        (m.subOption && m.subOption.toLowerCase().includes(q))
      );
    });
    return list.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }, [uncountedMaterials, uncountedSearchQuery]);

  const filteredUncountedEquipments = useMemo(() => {
    const q = uncountedSearchQuery.trim().toLowerCase();
    const list = uncountedEquipmentsList.filter(({ item }) => {
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
  }, [uncountedEquipmentsList, uncountedSearchQuery]);

  // Itens selecionados para a Recontagem efetiva (inclui tanto contados inicialmente quanto os não contados selecionados pelo Master)
  const selectedMaterials = useMemo(() => {
    return materials
      .filter(m => Boolean(recontagemSelectedIds[m.id]))
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));
  }, [materials, recontagemSelectedIds]);

  const selectedFreezers = useMemo(() => {
    return freezers
      .filter(f => Boolean(recontagemSelectedIds[f.id]))
      .sort((a, b) => (a.patrimony || '').localeCompare(b.patrimony || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [freezers, recontagemSelectedIds]);

  const selectedEquipments = useMemo(() => {
    return equipments
      .filter(eq => Boolean(recontagemSelectedIds[eq.id]))
      .sort((a, b) => (a.patrimony || '').localeCompare(b.patrimony || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
  }, [equipments, recontagemSelectedIds]);

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

  // Enviar E-mail da Recontagem (mesmo formato em tabela e sincroniza com o Firebase)
  const handleSendRecountEmail = async () => {
    if (isSendingRecountEmail) return;
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

    const emailTableBody = generateStockReportEmailTableText({
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
      isMobile: isPhoneFrame,
      isRecontagem: true,
    });

    // Copia relatório em formato tabela (HTML e texto) para a área de transferência
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const blobText = new Blob([emailTableBody], { type: 'text/plain' });
        const blobHtml = new Blob([reportHtml], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': blobText,
            'text/html': blobHtml,
          }),
        ]);
      } catch {
        navigator.clipboard.writeText(emailTableBody).catch(() => {});
      }
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(emailTableBody).catch(() => {});
    }

    // Tenta envio em segundo plano se houver servidor configurado
    sendEmailDirectly({
      fromEmail: serverEmailConfig?.senderEmail || defaultSenderEmail,
      senderName: serverEmailConfig?.senderName || 'RECONTAGEM DE ESTOQUE',
      toEmails: effectiveTo ? [effectiveTo, ...ccEmails] : configuredRecipients,
      subject,
      bodyText: emailTableBody,
      htmlBody: reportHtml,
      smtpConfig: serverEmailConfig,
    }).catch(() => {});

    // Sincroniza os dados da recontagem com o Firebase e conclui a liberação
    if (!isMaster) {
      setIsSendingRecountEmail(true);
      try {
        const syncRes = await markRecountAsSent();
        if (!syncRes.synced && syncRes.message) {
          showToast(syncRes.message);
        }
      } finally {
        setIsSendingRecountEmail(false);
      }
    }

    // Abre programa de e-mail padrão do dispositivo
    let mailtoUrl = `mailto:${encodeURIComponent(effectiveTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailTableBody)}`;
    if (effectiveCc) {
      mailtoUrl += `&cc=${encodeURIComponent(effectiveCc)}`;
    }
    window.location.href = mailtoUrl;

    setSendResultMsg('Recontagem sincronizada, aplicativo de e-mail acionado e relatório copiado para a área de transferência!');
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

        {/* Botão Cancelar Recontagem (apenas para Contador com recontagem ativa) */}
        {!isMaster && recontagemUnlocked && canActiveUserRecount && (
          <div className="p-3 bg-white border border-rose-200 rounded-2xl flex items-center justify-between gap-2.5 shadow-xs">
            <p className="text-[11px] text-slate-600 font-medium leading-snug">
              Se precisar cancelar esta recontagem, ela será excluída e o acesso do usuário Master será liberado novamente.
            </p>
            <button
              type="button"
              disabled={isCancellingRecount}
              onClick={() => setIsCancelConfirmOpen(true)}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isCancellingRecount ? 'Cancelando...' : 'Cancelar Recontagem'}</span>
            </button>
          </div>
        )}

        {/* Modal de confirmação de cancelamento da recontagem */}
        {isCancelConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
            <div className="bg-white border-2 border-rose-300 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl text-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
                  <X className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm uppercase">Cancelar Recontagem</h3>
                  <p className="text-[11px] text-rose-700 font-bold">Base {activeBranch}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Deseja excluir esta recontagem ativa? Os itens selecionados para recontagem serão removidos e o acesso ao usuário Master será liberado novamente.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isCancellingRecount}
                  onClick={() => setIsCancelConfirmOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  disabled={isCancellingRecount}
                  onClick={async () => {
                    setIsCancellingRecount(true);
                    try {
                      const res = await cancelRecontagemByContador();
                      setIsCancelConfirmOpen(false);
                      showToast(res.message);
                    } finally {
                      setIsCancellingRecount(false);
                    }
                  }}
                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isCancellingRecount ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                [{mat.code}]
                              </span>
                              {!isMaterialCountedToday(mat.id, materialCounts) && (
                                <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  Não contado inicialmente
                                </span>
                              )}
                            </div>
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilCheio: Math.max(0, (count.barrilCheio || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs min-w-[20px]">{count.barrilCheio || 0}</span>
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilCheio: (count.barrilCheio || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilVazio: Math.max(0, (count.barrilVazio || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-amber-200 text-amber-900 font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs min-w-[20px]">{count.barrilVazio || 0}</span>
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilVazio: (count.barrilVazio || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-amber-600 text-white font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilEmRota: Math.max(0, (count.barrilEmRota || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-cyan-200 text-cyan-900 font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-xs min-w-[20px]">{count.barrilEmRota || 0}</span>
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { barrilEmRota: (count.barrilEmRota || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-cyan-600 text-white font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Cheio: Math.max(0, (count.co2Cheio || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2Cheio || 0}</span>
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Cheio: (count.co2Cheio || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-emerald-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Mexido: Math.max(0, (count.co2Mexido || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-indigo-200 text-indigo-900 font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2Mexido || 0}</span>
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Mexido: (count.co2Mexido || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-indigo-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Vazio: Math.max(0, (count.co2Vazio || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-amber-200 text-amber-900 font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2Vazio || 0}</span>
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2Vazio: (count.co2Vazio || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-amber-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2EmRota: Math.max(0, (count.co2EmRota || 0) - 1) })}
                                  className="w-5 h-5 rounded bg-cyan-200 text-cyan-900 font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <span className="font-mono font-black text-[11px]">{count.co2EmRota || 0}</span>
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { co2EmRota: (count.co2EmRota || 0) + 1 })}
                                  className="w-5 h-5 rounded bg-cyan-600 text-white font-bold flex items-center justify-center active:scale-90 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { disponivel: Math.max(0, (count.disponivel || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  disabled={!canActiveUserRecount}
                                  value={count.disponivel ?? 0}
                                  onChange={e => updateRecontagemMaterialCount(mat.id, { disponivel: Math.max(0, parseInt(e.target.value) || 0) })}
                                  className="w-12 text-center font-mono font-black bg-white border border-emerald-300 rounded py-0.5 text-xs text-emerald-950 disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { disponivel: (count.disponivel || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { danificado: Math.max(0, (count.danificado || 0) - 1) })}
                                  className="w-6 h-6 rounded bg-rose-200 text-rose-900 font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  disabled={!canActiveUserRecount}
                                  value={count.danificado ?? 0}
                                  onChange={e => updateRecontagemMaterialCount(mat.id, { danificado: Math.max(0, parseInt(e.target.value) || 0) })}
                                  className="w-12 text-center font-mono font-black bg-white border border-rose-300 rounded py-0.5 text-xs text-rose-950 disabled:opacity-60 disabled:cursor-not-allowed"
                                />
                                <button
                                  type="button"
                                  disabled={!canActiveUserRecount}
                                  onClick={() => updateRecontagemMaterialCount(mat.id, { danificado: (count.danificado || 0) + 1 })}
                                  className="w-6 h-6 rounded bg-rose-600 text-white font-bold flex items-center justify-center active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
                              {!isEquipmentCountedToday(f.id, equipmentCounts) && (
                                <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  Não contado inicialmente
                                </span>
                              )}
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
                            disabled={!canActiveUserRecount}
                            onClick={() => {
                              if (isEmEstoque) {
                                updateRecontagemEquipmentCount(f.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(f.id, { status: 'em_estoque', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
                            disabled={!canActiveUserRecount}
                            onClick={() => {
                              if (isNaoConsta) {
                                updateRecontagemEquipmentCount(f.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(f.id, { status: 'nao_consta', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
                              {!isEquipmentCountedToday(eq.id, equipmentCounts) && (
                                <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  Não contado inicialmente
                                </span>
                              )}
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
                            disabled={!canActiveUserRecount}
                            onClick={() => {
                              if (isEmEstoque) {
                                updateRecontagemEquipmentCount(eq.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(eq.id, { status: 'em_estoque', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
                            disabled={!canActiveUserRecount}
                            onClick={() => {
                              if (isNaoConsta) {
                                updateRecontagemEquipmentCount(eq.id, { status: undefined });
                              } else {
                                updateRecontagemEquipmentCount(eq.id, { status: 'nao_consta', damageDescription: undefined });
                              }
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
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
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-2">
              {!isMaster && !recontagemUnlocked && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 text-[11px] font-bold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Recontagem já enviada. As telas permanecem bloqueadas até o usuário Master zerar a contagem.</span>
                </div>
              )}
              <button
                type="button"
                disabled={isSendingRecountEmail || (!isMaster && !canActiveUserRecount)}
                onClick={handleSendRecountEmail}
                className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4 stroke-[3]" />
                <span>{isSendingRecountEmail ? 'Sincronizando e abrindo e-mail...' : 'Enviar Relatório da Recontagem por E-mail'}</span>
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

  // Verifica se há contagem recebida (tanto nas telas Materiais/Equipamentos como na tela Recontagem)
  const hasCountReceived = useMemo(() => {
    const hasInitial =
      countedMaterials.length > 0 ||
      countedEquipmentsList.length > 0 ||
      uncataloguedEquipments.length > 0;
    const hasRecMats = Object.values(recontagemMaterialCounts).some(m =>
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
    const hasRecEqs = Object.keys(recontagemEquipmentCounts).some(id => Boolean(recontagemEquipmentCounts[id]?.status));
    return hasInitial || hasRecMats || hasRecEqs;
  }, [countedMaterials.length, countedEquipmentsList.length, uncataloguedEquipments.length, recontagemMaterialCounts, recontagemEquipmentCounts]);

  const selectedTargetContador = useMemo(() => {
    return branchContadores.find(u => u.id === selectedTargetContadorId) || null;
  }, [branchContadores, selectedTargetContadorId]);

  const isMasterSelectionLocked = recontagemUnlocked || isAnyBaseCountInProgress;

  // Sem contagem inicial recebida, exibe lista selecionável de contadores da base ao selecionar >= 1 item
  const showTargetContadorSelector =
    !isMasterSelectionLocked &&
    recontagemSelectedCount > 0 &&
    (!hasCountReceived || (!countStartedBy && !recontagemTargetContador));

  // Campo com o botão "Liberar Recontagem para o Contador Inicial":
  // Só aparece se houver contagem recebida (ou já estiver liberada) OU se Master selecionou item(ns) e escolheu um contador da base
  const showReleasePanel =
    recontagemUnlocked ||
    hasCountReceived ||
    (recontagemSelectedCount > 0 && Boolean(selectedTargetContador));

  const effectiveReleaseContador =
    (hasCountReceived ? (countStartedBy || recontagemTargetContador) : null) ||
    (selectedTargetContador
      ? {
          userId: selectedTargetContador.id,
          userName: selectedTargetContador.name,
          registration: selectedTargetContador.registration,
          startedAt: Date.now(),
        }
      : recontagemTargetContador || countStartedBy);

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
            Selecione quais itens precisarão ser contados ou recontados pelo conferente
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
          {/* Card de Resumo da Seleção Atual e Liberação da Recontagem */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
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

              {recontagemSelectedCount > 0 && !isMasterSelectionLocked && (
                <button
                  type="button"
                  onClick={() => {
                    clearAllRecontagem();
                    setSelectedTargetContadorId('');
                    showToast(`Seleção de recontagem limpa para a base ${activeBranch}!`);
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                >
                  Limpar Seleção
                </button>
              )}
            </div>

            {isMasterSelectionLocked ? (
              <div className="p-2.5 bg-amber-50 border-2 border-amber-300 rounded-xl text-xs text-amber-950 leading-relaxed font-bold flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Existe contagem/recontagem em andamento na base. Demais contadores e Master não podem alterar dados até o envio do relatório pelo contador selecionado.
                </span>
              </div>
            ) : recontagemSelectedCount > 0 ? (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-950 leading-relaxed font-bold">
                {hasCountReceived
                  ? isCoringa
                    ? `${recontagemSelectedCount} item(ns) marcado(s) na base teste ${activeBranch}. Clique em "Liberar Recontagem para o Contador Inicial" abaixo para testar localmente (sem Firebase).`
                    : `${recontagemSelectedCount} item(ns) marcado(s) na base ${activeBranch}. Clique em "Liberar Recontagem para o Contador Inicial" abaixo para enviar a seleção ao Firebase e liberar o acesso ao contador.`
                  : `${recontagemSelectedCount} item(ns) selecionado(s) sem contagem inicial na base ${activeBranch}. Selecione o usuário contador abaixo para habilitar a liberação.`}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500">
                {hasCountReceived
                  ? 'Marque os itens abaixo (contados ou não contados inicialmente) e clique no botão de liberação para permitir que o contador inicial acesse o app novamente.'
                  : 'Não há contagem inicial recebida no momento. Caso precise contar item(ns) específico(s), selecione os itens abaixo na seção "Demais Materiais/Equipamentos Não Contados Inicialmente" e escolha o contador da base.'}
              </p>
            )}

            {/* Lista Selecionável de Contadores da Base Ativa (quando não há contagem iniciada / contador inicial definido) */}
            {showTargetContadorSelector && (
              <div className="p-3 bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-700 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-indigo-950 block">
                      Selecionar Contador da Base {activeBranch}:
                    </span>
                    <span className="text-[10px] text-indigo-800 font-medium">
                      Escolha qual usuário contador realizará a contagem dos item(ns) selecionado(s).
                    </span>
                  </div>
                </div>

                {branchContadores.length === 0 ? (
                  <div className="p-2.5 bg-white border border-indigo-200 rounded-xl text-[11px] font-bold text-rose-700">
                    Nenhum usuário contador ativo cadastrado na base {activeBranch}.
                  </div>
                ) : (
                  <select
                    value={selectedTargetContadorId}
                    onChange={e => setSelectedTargetContadorId(e.target.value)}
                    className="w-full bg-white border-2 border-indigo-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Selecione o usuário contador da base {activeBranch} --</option>
                    {branchContadores.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} (Matrícula: {u.registration})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Painel de Liberação para o Contador Inicial / Selecionado (oculto quando não há contagem recebida nem seleção + contador) */}
            {showReleasePanel && (
              <div className={`p-3 rounded-2xl border-2 space-y-2.5 ${
                recontagemUnlocked
                  ? 'bg-emerald-50/70 border-emerald-400'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <UserCheck className={`w-4 h-4 ${recontagemUnlocked ? 'text-emerald-700' : 'text-slate-600'}`} />
                    <div className="text-[11px]">
                      <span className="font-bold text-slate-700 block">
                        Contador autorizado na base {activeBranch}:{' '}
                        <strong className="text-slate-900">
                          {effectiveReleaseContador
                            ? `${effectiveReleaseContador.userName} (Matrícula: ${effectiveReleaseContador.registration})`
                            : 'Selecione um contador'}
                        </strong>
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    recontagemUnlocked
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}>
                    {recontagemUnlocked ? 'Recontagem Liberada' : 'Pronto para Liberar'}
                  </span>
                </div>

                {!recontagemUnlocked && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isReleasingRecount || recontagemSelectedCount === 0 || isMasterSelectionLocked || !effectiveReleaseContador}
                      onClick={async () => {
                        if (isReleasingRecount) return;
                        setIsReleasingRecount(true);
                        try {
                          const res = await releaseRecontagemForContador(
                            hasCountReceived && countStartedBy ? undefined : selectedTargetContador
                          );
                          showToast(res.message);
                        } finally {
                          setIsReleasingRecount(false);
                        }
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50 bg-rose-600 hover:bg-rose-500 text-white"
                    >
                      {isReleasingRecount ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                      <span>
                        {isReleasingRecount
                          ? 'Liberando e sincronizando...'
                          : 'Liberar Recontagem para o Contador Inicial'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
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
              disabled={isMasterSelectionLocked}
              onClick={() => selectAllRecontagem(masterFilter)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-[11px] rounded-xl cursor-pointer shrink-0"
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
                      onClick={() => { if (!isMasterSelectionLocked) toggleRecontagemItem(m.id); }}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                        isMasterSelectionLocked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                      } ${
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
                          disabled={isMasterSelectionLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRecontagemItem(m.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
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
                      onClick={() => { if (!isMasterSelectionLocked) toggleRecontagemItem(item.id); }}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                        isMasterSelectionLocked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                      } ${
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
                          disabled={isMasterSelectionLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRecontagemItem(item.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 ${
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

          {/* CAMPO ESPECÍFICO PARA SELECIONAR OS DEMAIS MATERIAIS E EQUIPAMENTOS NÃO CONTADOS INICIALMENTE */}
          <div className="bg-white border-2 border-purple-200 rounded-2xl p-3.5 space-y-3 shadow-xs mt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b border-purple-100 pb-2.5">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-purple-700 shrink-0" />
                <div>
                  <h3 className="text-xs font-black text-purple-950 uppercase tracking-wide">
                    {masterFilter === 'materiais'
                      ? `Demais Materiais Não Contados Inicialmente (${uncountedMaterials.length})`
                      : `Demais Equipamentos Não Contados Inicialmente (${uncountedEquipmentsList.length})`}
                  </h3>
                  <p className="text-[10px] text-purple-800 font-medium">
                    Caso precise, selecione aqui itens que não tiveram contagem inicial para aparecerem na recontagem do contador inicial ({activeBranch}).
                  </p>
                </div>
              </div>
            </div>

            <div className="relative">
              <input
                type="text"
                value={uncountedSearchQuery}
                onChange={e => setUncountedSearchQuery(e.target.value)}
                placeholder={
                  masterFilter === 'materiais'
                    ? 'Selecionar ou buscar materiais não contados por código ou nome...'
                    : 'Selecionar ou buscar equipamentos não contados por código ou patrimônio...'
                }
                className="w-full bg-purple-50/50 border border-purple-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white"
              />
              <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
            </div>

            {masterFilter === 'materiais' ? (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                {filteredUncountedMaterials.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    {uncountedMaterials.length === 0
                      ? `Todos os materiais cadastrados na base ${activeBranch} já possuem contagem inicial.`
                      : `Nenhum material não contado corresponde à busca "${uncountedSearchQuery}".`}
                  </div>
                ) : (
                  filteredUncountedMaterials.map(m => {
                    const isSelected = Boolean(recontagemSelectedIds[m.id]);

                    return (
                      <div
                        key={m.id}
                        onClick={() => { if (!isMasterSelectionLocked) toggleRecontagemItem(m.id); }}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 select-none ${
                          isMasterSelectionLocked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? 'bg-rose-50/70 border-rose-400 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
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
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200">
                              Não contado
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mt-1 truncate">
                            {m.name}
                          </h4>
                        </div>

                        <button
                          type="button"
                          disabled={isMasterSelectionLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRecontagemItem(m.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-60 ${
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
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-0.5">
                {filteredUncountedEquipments.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                    {uncountedEquipmentsList.length === 0
                      ? `Todos os equipamentos cadastrados na base ${activeBranch} já possuem contagem inicial.`
                      : `Nenhum equipamento não contado corresponde à busca "${uncountedSearchQuery}".`}
                  </div>
                ) : (
                  filteredUncountedEquipments.map(({ item, kind }) => {
                    const isSelected = Boolean(recontagemSelectedIds[item.id]);
                    const f = item as FreezerItem;
                    const eq = item as EquipmentItem;

                    return (
                      <div
                        key={item.id}
                        onClick={() => { if (!isMasterSelectionLocked) toggleRecontagemItem(item.id); }}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 select-none ${
                          isMasterSelectionLocked ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? 'bg-rose-50/70 border-rose-400 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
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
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-800 border border-purple-200">
                              Não contado
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mt-1 truncate">
                            {item.name}
                          </h4>
                        </div>

                        <button
                          type="button"
                          disabled={isMasterSelectionLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRecontagemItem(item.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 disabled:opacity-60 ${
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
                    );
                  })
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
