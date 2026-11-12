
import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Mail, 
  CheckCircle2, 
  Layers, 
  Zap, 
  Check, 
  Calendar,
  AlertTriangle,
  Settings,
  RefreshCw,
  Info,
  X
} from 'lucide-react';
import { useInventory, getBranchStorageKey } from '../../context/InventoryContext';
import { generateStockReportText, generateStockReportHtml } from '../../utils/reportGenerator';
import { sendEmailDirectly } from '../../utils/emailSender';
import { GrupoMSBrand } from '../common/GrupoMSBrand';

type ExportStockSelection = 'materiais' | 'equipamentos' | 'ambos';

interface ExportarEstoqueViewProps {
  onNavigateToOpcoesEnvio?: () => void;
}

interface BaseItemSnapshot {
  id: string;
  type: 'material' | 'freezer' | 'equipamento';
  code: string;
  name: string;
  patrimony?: string;
  defect?: string;
}

export const ExportarEstoqueView: React.FC<ExportarEstoqueViewProps> = ({
  onNavigateToOpcoesEnvio
}) => {
  const { 
    materials, 
    freezers, 
    equipments, 
    materialCounts, 
    equipmentCounts, 
    uncataloguedEquipments,
    recipientsText,
    updateRecipientsText,
    defaultSenderEmail,
    emailSettings,
    serverEmailConfig,
    activeUser,
    isMaster,
    todayDateFormatted,
    isPhoneFrame,
    frozenReportText,
    setFrozenReportText,
    updateEquipmentCount,
    activeBranch,
    markCountAsSent,
    isReportSent,
  } = useInventory();
  
  const [includeEquipmentDefects, setIncludeEquipmentDefects] = useState(false);
  // EXIGÊNCIA 7: já exibido a tela com o botão "Ambos" selecionado
  const [selectedStock, setSelectedStock] = useState<ExportStockSelection>('ambos');
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);



  // Estados dos Modais da Atualização da Prévia (EXIGÊNCIA 8)
  const [isZeroedModalOpen, setIsZeroedModalOpen] = useState(false);
  const [isChangesModalOpen, setIsChangesModalOpen] = useState(false);
  const [isNoChangesModalOpen, setIsNoChangesModalOpen] = useState(false);
  const [detectedChangesList, setDetectedChangesList] = useState<{
    added: string[];
    modified: string[];
    removed: string[];
  }>({ added: [], modified: [], removed: [] });

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  // Monta snapshot atual da base
  const getCurrentSnapshot = (): BaseItemSnapshot[] => {
    const list: BaseItemSnapshot[] = [];
    materials.forEach(m => list.push({
      id: m.id,
      type: 'material',
      code: m.code,
      name: m.name,
    }));
    freezers.forEach(f => list.push({
      id: f.id,
      type: 'freezer',
      code: f.code,
      name: f.name,
      patrimony: f.patrimony,
      defect: f.defect || '',
    }));
    equipments.forEach(eq => list.push({
      id: eq.id,
      type: 'equipamento',
      code: eq.code,
      name: eq.name,
      patrimony: eq.patrimony,
      defect: eq.defect || '',
    }));
    return list;
  };

  // Inicializa o snapshot salvo da base se não existir
  useEffect(() => {
    const snapshotKey = getBranchStorageKey(activeBranch, 'last_report_base_snapshot');
    const saved = localStorage.getItem(snapshotKey);
    if (!saved && (materials.length > 0 || freezers.length > 0 || equipments.length > 0)) {
      localStorage.setItem(snapshotKey, JSON.stringify(getCurrentSnapshot()));
    }
  }, [materials.length, freezers.length, equipments.length, activeBranch]);

  // Lista de e-mails configurados na base (atualizada em tempo real conforme Opções de Envio & E-mails)
  const configuredRecipients = emailSettings.emails;

  // EXIGÊNCIA 9: Passar isMobile de acordo com o padrão de exibição celular (isPhoneFrame)
  const reportText = generateStockReportText({
    selectedStock,
    todayDateFormatted,
    activeUser,
    defaultSenderEmail,
    recipients: configuredRecipients,
    materials,
    freezers,
    equipments,
    uncataloguedEquipments,
    materialCounts,
    equipmentCounts,
    includeEquipmentDefects,
    branch: activeBranch,
    isMobile: isPhoneFrame,
  });

  const activeReportPreview = frozenReportText !== null ? frozenReportText : reportText;

  // Ao pressionar o botão "Enviar Estoque Selecionado por E-mail", abre o programa padrão de e-mail do dispositivo para envio do relatório de contagem
  const handleSendEmail = () => {
    setErrorMessage(null);

    const primaryTo = (defaultSenderEmail || '').trim();
    const ccEmails = configuredRecipients.filter(e => e.toLowerCase() !== primaryTo.toLowerCase());
    const ccStr = ccEmails.join(',');

    if (!primaryTo && configuredRecipients.length === 0) {
      setErrorMessage(`Nenhum destinatário configurado ou e-mail em cópia cadastrado na base ${activeBranch} para envio.`);
      return;
    }

    const effectiveTo = primaryTo || (configuredRecipients.length > 0 ? configuredRecipients[0] : '');
    const effectiveCc = primaryTo ? ccStr : configuredRecipients.slice(1).join(',');

    const subject = `[${activeBranch}] Relatório de Contagem de Estoque - ${todayDateFormatted} (${selectedStock.toUpperCase()})`;

    const reportHtml = generateStockReportHtml({
      selectedStock,
      todayDateFormatted,
      activeUser,
      defaultSenderEmail,
      recipients: effectiveTo ? [effectiveTo, ...ccEmails] : configuredRecipients,
      materials,
      freezers,
      equipments,
      uncataloguedEquipments,
      materialCounts,
      equipmentCounts,
      includeEquipmentDefects,
      branch: activeBranch,
    });

    // Copia silenciosamente o relatório para a área de transferência com formatação rica (HTML e texto)
    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const blobText = new Blob([activeReportPreview], { type: 'text/plain' });
        const blobHtml = new Blob([reportHtml], { type: 'text/html' });
        navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': blobText,
            'text/html': blobHtml,
          }),
        ]).catch(() => {});
      } catch {
        // Ignora silenciosamente
      }
    }

    // Tenta também envio direto com corpo HTML em segundo plano se houver servidor configurado
    sendEmailDirectly({
      fromEmail: serverEmailConfig?.senderEmail || defaultSenderEmail,
      senderName: serverEmailConfig?.senderName || 'CONTAGEM DE ESTOQUE',
      toEmails: effectiveTo ? [effectiveTo, ...ccEmails] : configuredRecipients,
      subject,
      bodyText: activeReportPreview,
      htmlBody: reportHtml,
      smtpConfig: serverEmailConfig,
    }).catch(() => {});

    // Registra que a contagem foi enviada por e-mail:
    // Conforme regra: somente após o envio do estoque por e-mail o acesso total das funcionalidades
    // é liberado para o usuário Master, e os demais contadores ficam impedidos de alterar a contagem
    markCountAsSent();

    // Abre o programa padrão de e-mail do dispositivo com destinatário no Para (To), copiados no Cc, assunto e relatório de contagem no corpo
    let mailtoUrl = `mailto:${encodeURIComponent(effectiveTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(activeReportPreview)}`;
    if (effectiveCc) {
      mailtoUrl += `&cc=${encodeURIComponent(effectiveCc)}`;
    }
    window.location.href = mailtoUrl;
  };

  /**
   * EXIGÊNCIA 8:
   * Botão para atualizar os dados do campo "Prévia do Relatório", logo abaixo do botão "Enviar Estoque Selecionado por e-mail":
   * 1. Caso a base tenha sido zerada ou limpa:
   *    aparecer mensagem informando antes da atualização e perguntar se deseja prosseguir,
   *    informando que todas as informações das contagens serão perdidas.
   * 2. Caso tenha atualizado alguma informação no cadastro da base:
   *    mostrar as mudanças e perguntar se deseja prosseguir,
   *    caso sim, atualizar os dados sem perder as informações da contagem de Materiais e Equipamentos.
   * 3. Caso não tenha nenhuma mudança:
   *    informar também.
   */
  const handleCheckAndRefreshReportPreview = () => {
    setErrorMessage(null);
    setSendResult(null);

    const isBaseEmpty = materials.length === 0 && freezers.length === 0 && equipments.length === 0;

    // Se a prévia estava congelada, restaura a prévia com os dados atuais
    if (frozenReportText === '__CLEARED__' || frozenReportText === '__CLEARED_COUNTS__') {
      setFrozenReportText(null);
      showToast('Prévia do relatório gerada com base nos dados atuais!');
      return;
    }

    // Caso 1: Base zerada ou limpa
    if (isBaseEmpty || !!frozenReportText) {
      setIsZeroedModalOpen(true);
      return;
    }

    // Caso 2 & 3: Comparar com snapshot
    const snapshotKey = getBranchStorageKey(activeBranch, 'last_report_base_snapshot');
    let lastSnapshot: BaseItemSnapshot[] = [];
    try {
      const saved = localStorage.getItem(snapshotKey);
      if (saved) {
        lastSnapshot = JSON.parse(saved);
      }
    } catch {
      lastSnapshot = [];
    }

    const currentSnapshot = getCurrentSnapshot();
    const currentMap = new Map(currentSnapshot.map(i => [i.id, i]));
    const lastMap = new Map(lastSnapshot.map(i => [i.id, i]));

    const added: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];

    // Detectar adicionados e modificados
    currentSnapshot.forEach(item => {
      const prev = lastMap.get(item.id);
      if (!prev) {
        added.push(`[${item.code || 'S/CÓD'}] ${item.name} (${item.type})`);
      } else {
        const changedFields: string[] = [];
        if (prev.code !== item.code) changedFields.push(`código alterado para ${item.code}`);
        if (prev.name !== item.name) changedFields.push(`nome alterado para ${item.name}`);
        if ((prev.defect || '') !== (item.defect || '')) {
          changedFields.push(item.defect ? `defeito: "${item.defect}"` : 'defeito removido');
        }
        if (changedFields.length > 0) {
          modified.push(`[${item.code}] ${item.name}: ${changedFields.join(', ')}`);
        }
      }
    });

    // Detectar removidos
    lastSnapshot.forEach(prev => {
      if (!currentMap.has(prev.id)) {
        removed.push(`[${prev.code || 'S/CÓD'}] ${prev.name} (${prev.type})`);
      }
    });

    if (added.length > 0 || modified.length > 0 || removed.length > 0) {
      // Caso 2: Tem mudanças
      setDetectedChangesList({ added, modified, removed });
      setIsChangesModalOpen(true);
    } else {
      // Caso 3: Nenhuma mudança
      setIsNoChangesModalOpen(true);
    }
  };

  // Confirmação Caso 1: Prosseguir com a atualização mesmo com a base zerada
  const handleConfirmZeroedRefresh = () => {
    const snapshotKey = getBranchStorageKey(activeBranch, 'last_report_base_snapshot');
    setFrozenReportText(null);
    localStorage.setItem(snapshotKey, JSON.stringify([]));
    setIsZeroedModalOpen(false);
    showToast('Prévia do relatório atualizada. Como a base está limpa, as contagens anteriores foram redefinidas.');
  };

  // Confirmação Caso 2: Atualizar prévia com as mudanças da base preservando as contagens
  const handleConfirmChangesRefresh = () => {
    // EXIGÊNCIA: caso seja editado o cadastro dos defeitos dos equipamentos, o patrimônio da lista de contagem, referente a edição será movido para a nova situação do mesmo, saindo ou entrando no campo "2 ITENS DANIFICADOS:".
    freezers.forEach(f => {
      if (equipmentCounts[f.id]) {
        updateEquipmentCount(f.id, {
          status: f.defect?.trim() ? 'danificado' : 'disponivel',
          damageDescription: f.defect?.trim() || undefined,
        });
      }
    });
    equipments.forEach(eq => {
      if (equipmentCounts[eq.id]) {
        updateEquipmentCount(eq.id, {
          status: eq.defect?.trim() ? 'danificado' : 'disponivel',
          damageDescription: eq.defect?.trim() || undefined,
        });
      }
    });

    const snapshotKey = getBranchStorageKey(activeBranch, 'last_report_base_snapshot');
    localStorage.setItem(snapshotKey, JSON.stringify(getCurrentSnapshot()));
    setFrozenReportText(null);
    setIsChangesModalOpen(false);
    showToast('Prévia do relatório atualizada com sucesso! As contagens de Materiais e Equipamentos foram preservadas.');
  };

  return (
    <div className="space-y-4 pb-12 bg-white">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
            <Mail className="w-5 h-5 text-emerald-600" />
            Exportar Contagem do Estoque
          </h2>
        </div>

        {/* Apresentar o botão de Opções de Envio & E-mails somente ao clicar no botão Exportar (Apenas Master) */}
        {isMaster && onNavigateToOpcoesEnvio && (
          <button
            type="button"
            onClick={onNavigateToOpcoesEnvio}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Acessar Opções de Envio & E-mails do Aplicativo"
          >
            <Settings className="w-3.5 h-3.5 text-indigo-600" />
            <span>Opções de Envio & E-mails</span>
          </button>
        )}
      </div>

      {/* Toast Feedback */}
      {feedbackToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Alerta de Sucesso na Abertura do E-mail */}
      {sendResult?.success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs flex items-center gap-2 font-bold animate-in fade-in duration-200 shadow-sm">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 stroke-[3]" />
          <span>{sendResult.message}</span>
        </div>
      )}

      {/* Alerta de Erro */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. CAMPOS: E-MAIL DO DESTINATÁRIO E E-MAIL EM CÓPIA POR BASE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
        {/* E-mail do destinatário */}
        <div className="space-y-1">
          <label className="text-slate-800 text-xs font-bold flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-indigo-600" />
            <span>E-mail do destinatário:</span>
          </label>
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono select-none">
            {defaultSenderEmail || `Nenhum e-mail de destinatário cadastrado na base ${activeBranch}.`}
          </div>
        </div>

        {/* E-mail em cópia */}
        <div className="space-y-1">
          <label className="text-slate-800 text-xs font-bold flex items-center gap-1.5">
            <Mail className="w-4 h-4 text-emerald-600" />
            <span>E-mail em cópia:</span>
          </label>
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono select-none space-y-1">
            {configuredRecipients.length > 0 ? (
              configuredRecipients.map((email, idx) => (
                <div key={idx} className="flex items-center gap-1.5 py-0.5 border-b border-slate-100 last:border-b-0">
                  <span className="text-emerald-600 text-xs select-none">•</span>
                  <span className="break-all">{email}</span>
                </div>
              ))
            ) : (
              <span className="text-slate-500">Nenhum e-mail em cópia cadastrado na base {activeBranch}.</span>
            )}
          </div>
        </div>
      </div>

      {/* 2. CAMPO: SELECIONE QUAL ESTOQUE DESEJA ENVIAR (EXIGÊNCIA 7: Padrão "Ambos" selecionado) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
        <label className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
          Selecione qual estoque deseja enviar:
        </label>
        
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSelectedStock('materiais')}
            className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
              selectedStock === 'materiais'
                ? 'bg-amber-500 text-slate-950 font-black border-amber-400 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-xs">Materiais</span>
            <span className="text-[10px] opacity-80">Mesas, Barris, CO2</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStock('equipamentos')}
            className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
              selectedStock === 'equipamentos'
                ? 'bg-cyan-600 text-white font-black border-cyan-500 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span className="text-xs">Equipamentos</span>
            <span className="text-[10px] opacity-80">Freezers & Chopeiras</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStock('ambos')}
            className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
              selectedStock === 'ambos'
                ? 'bg-emerald-600 text-white font-black border-emerald-500 shadow-sm'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Send className="w-4 h-4" />
            <span className="text-xs">Ambos</span>
            <span className="text-[10px] opacity-80">Estoque Completo</span>
          </button>
        </div>
      </div>

      {/* 3. CAMPO SELEÇÃO: ENVIAR NO RELATÓRIO OS DEFEITOS E OBSERVAÇÕES DOS EQUIPAMENTOS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
        <label className="flex items-center gap-2.5 p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer text-xs font-bold text-slate-800 transition-colors">
          <input
            type="checkbox"
            checked={includeEquipmentDefects}
            onChange={e => setIncludeEquipmentDefects(e.target.checked)}
            className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
          />
          <span>Incluir defeito(s) e observação(ões) do(s) equipamento(s) na PRÉVIA DO RELATÓRIO.</span>
        </label>

        {/* Botão para Enviar Estoque Selecionado por E-mail */}
        <button
          onClick={handleSendEmail}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4 stroke-[3]" />
          <span>Enviar Estoque Selecionado por E-mail</span>
        </button>

        {/* EXIGÊNCIA 8: Botão para atualizar os dados do campo "Prévia do Relatório", logo abaixo do botão "Enviar Estoque Selecionado por e-mail" */}
        <button
          type="button"
          onClick={handleCheckAndRefreshReportPreview}
          className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-950 font-extrabold text-xs sm:text-sm rounded-xl shadow-2xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          title="Verificar atualizações no cadastro da base e sincronizar a prévia"
        >
          <RefreshCw className="w-4 h-4 text-indigo-600" />
          <span>Atualizar dados do campo "Prévia do Relatório"</span>
        </button>
      </div>

      {/* Pré-visualização do Relatório Oficial (PRÉVIA DO RELATÓRIO) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
          {/* Canto superior esquerdo: Mesmo nome Grupo MS da tela inicial com MS centralizado embaixo de GRUPO */}
          <div className="flex items-center gap-3 flex-wrap">
            <GrupoMSBrand size="sm" align="center" />
            <div className="border-l border-slate-200 pl-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                PRÉVIA DO RELATÓRIO
              </span>
            </div>
          </div>
        </div>

        {/* EXIGÊNCIA 9: No padrão de exibição celular da tela, os tracejados se ajustam até o final da linha */}
        <div className={`p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-800 whitespace-pre leading-relaxed min-h-24 max-h-96 overflow-y-auto overflow-x-auto select-text shadow-inner ${
          isPhoneFrame ? 'w-full max-w-full' : ''
        }`}>
          {activeReportPreview}
        </div>
      </div>

      {/* MODAL CASO 1: BASE ZERADA OU LIMPA */}
      {isZeroedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-rose-300 w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Base Zerada ou Limpa</h3>
                <p className="text-xs text-rose-700 font-semibold">Aviso de Atualização da Prévia</p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-950 font-medium leading-relaxed space-y-2">
              <p>
                <strong>Atenção:</strong> A base de dados do aplicativo foi zerada ou limpa.
              </p>
              <p>
                Se você prosseguir com a atualização agora, <strong>todas as informações das contagens salvas serão perdidas</strong> e a prévia do relatório será esvaziada.
              </p>
              <p className="text-slate-600 text-xs">
                Deseja realmente prosseguir com a atualização?
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsZeroedModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmZeroedRefresh}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Sim, Prosseguir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CASO 2: ALTERAÇÕES NO CADASTRO IDENTIFICADAS */}
      {isChangesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-indigo-300 w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 text-indigo-700">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Alterações na Base Identificadas</h3>
                <p className="text-xs text-indigo-800 font-semibold">Atualização da Prévia do Relatório</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Foram identificadas as seguintes mudanças no cadastro oficial da base:
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-60 text-xs">
              {detectedChangesList.added.length > 0 && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="font-bold text-emerald-900 block mb-1">
                    Novos itens cadastrados ({detectedChangesList.added.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-emerald-800 font-mono text-[11px]">
                    {detectedChangesList.added.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {detectedChangesList.modified.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="font-bold text-amber-900 block mb-1">
                    Itens alterados ({detectedChangesList.modified.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800 font-mono text-[11px]">
                    {detectedChangesList.modified.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {detectedChangesList.removed.length > 0 && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="font-bold text-rose-900 block mb-1">
                    Itens excluídos da base ({detectedChangesList.removed.length}):
                  </span>
                  <ul className="list-disc list-inside space-y-0.5 text-rose-800 font-mono text-[11px]">
                    {detectedChangesList.removed.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-950 font-medium">
              💡 <strong>Garantia de integridade:</strong> Ao confirmar, os dados da prévia serão atualizados com as alterações acima <strong>sem perder as informações da contagem de Materiais e Equipamentos</strong>.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsChangesModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmChangesRefresh}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Sim, Prosseguir e Atualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CASO 3: NENHUMA MUDANÇA */}
      {isNoChangesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Nenhuma Mudança no Cadastro</h3>
                <p className="text-xs text-slate-500 font-medium">Sincronização da Base</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-700 leading-relaxed">
              Não houve mudanças nas informações entre contagem x cadastro.
              <br className="mb-1" />
              A <strong>Prévia do Relatório</strong> já se encontra totalmente atualizada com todos os dados mais recentes do cadastro e das contagens.
            </div>

            <div className="pt-2 flex items-center justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsNoChangesModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
