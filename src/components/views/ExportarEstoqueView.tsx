
import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Mail, 
  CheckCircle2, 
  Layers, 
  Zap, 
  Check, 
  AlertTriangle,
  Settings,
  FileDown,
  Share2
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import {
  generateStockReportText,
  generateStockReportHtml,
  generateStockReportEmailTableText,
  generateStockReportPdfBlob,
  GeneratedPdfReport,
  preloadGrupoMsLogoDataUrl,
} from '../../utils/reportGenerator';
import { sendEmailDirectly } from '../../utils/emailSender';
import { GrupoMSBrand } from '../common/GrupoMSBrand';

type ExportStockSelection = 'materiais' | 'equipamentos' | 'ambos';

interface ExportarEstoqueViewProps {
  onNavigateToOpcoesEnvio?: () => void;
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
    defaultSenderEmail,
    emailSettings,
    serverEmailConfig,
    activeUser,
    isMaster,
    todayDateFormatted,
    isPhoneFrame,
    activeBranch,
    markCountAsSent,
  } = useInventory();
  
  const [includeEquipmentDefects, setIncludeEquipmentDefects] = useState(false);
  // EXIGÊNCIA 7: já exibido a tela com o botão "Ambos" selecionado
  const [selectedStock, setSelectedStock] = useState<ExportStockSelection>('ambos');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [lastGeneratedPdf, setLastGeneratedPdf] = useState<{
    pdf: GeneratedPdfReport;
    subject: string;
    shareText: string;
    mailtoUrl: string;
  } | null>(null);

  useEffect(() => {
    preloadGrupoMsLogoDataUrl().catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 6000);
  };

  const triggerPdfDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

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

  // Ao pressionar o botão "Enviar Estoque Selecionado por E-mail", gera o PDF no mesmo formato de Opções de Envio & E-mails,
  // sincroniza com o Firebase e anexa/envia pelo aplicativo de e-mail do dispositivo.
  const handleSendEmail = async () => {
    if (isSendingEmail) return;
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
    const allRecipients = effectiveTo ? [effectiveTo, ...ccEmails] : configuredRecipients;

    const subject = `[${activeBranch}] Relatório de Contagem de Estoque - ${todayDateFormatted} (${selectedStock.toUpperCase()})`;

    setIsSendingEmail(true);
    try {
      const reportParams = {
        selectedStock,
        todayDateFormatted,
        activeUser,
        defaultSenderEmail,
        recipients: allRecipients,
        materials,
        freezers,
        equipments,
        uncataloguedEquipments,
        materialCounts,
        equipmentCounts,
        includeEquipmentDefects,
        branch: activeBranch,
      };

      const [pdfReport, reportHtml, emailTableBody] = await Promise.all([
        generateStockReportPdfBlob(reportParams),
        Promise.resolve(generateStockReportHtml(reportParams)),
        Promise.resolve(
          generateStockReportEmailTableText({
            ...reportParams,
            isMobile: isPhoneFrame,
          })
        ),
      ]);

      let mailtoUrl = `mailto:${encodeURIComponent(effectiveTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailTableBody)}`;
      if (effectiveCc) {
        mailtoUrl += `&cc=${encodeURIComponent(effectiveCc)}`;
      }

      const shareText = [
        `Para: ${effectiveTo}`,
        effectiveCc ? `Cc: ${effectiveCc}` : '',
        '',
        `Segue em anexo o relatório em PDF (${pdfReport.fileName}) da base ${activeBranch}.`,
        '',
        emailTableBody,
      ]
        .filter(Boolean)
        .join('\n');

      setLastGeneratedPdf({
        pdf: pdfReport,
        subject,
        shareText,
        mailtoUrl,
      });

      // Copia o relatório em formato de tabela (HTML rico e tabela em texto) para a área de transferência
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

      // Tenta também envio direto com PDF anexado em segundo plano se houver servidor configurado
      sendEmailDirectly({
        fromEmail: serverEmailConfig?.senderEmail || defaultSenderEmail,
        senderName: serverEmailConfig?.senderName || 'CONTAGEM DE ESTOQUE',
        toEmails: allRecipients,
        subject,
        bodyText: emailTableBody,
        htmlBody: reportHtml,
        attachments: [
          {
            filename: pdfReport.fileName,
            contentBase64: pdfReport.base64,
            contentType: 'application/pdf',
          },
        ],
        smtpConfig: serverEmailConfig,
      }).catch(() => {});

      // Registra e aguarda a sincronização completa com o Firebase antes de acionar o aplicativo de e-mail:
      // Conforme regra: somente após o envio do estoque por e-mail todos os dados do contador são sincronizados com o Firebase
      // e o acesso total das funcionalidades é liberado para o usuário Master.
      const syncRes = await markCountAsSent();

      const canShareFiles =
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [pdfReport.file] }));

      let attachedDirectlyViaShare = false;
      let userCancelledShare = false;

      if (canShareFiles) {
        try {
          await navigator.share({
            title: subject,
            text: shareText,
            files: [pdfReport.file],
          });
          attachedDirectlyViaShare = true;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            userCancelledShare = true;
          }
        }
      }

      if (attachedDirectlyViaShare) {
        if (!syncRes.synced && syncRes.message) {
          showToast(syncRes.message);
        } else {
          showToast(`Contagem sincronizada e PDF (${pdfReport.fileName}) anexado ao compartilhamento de e-mail!`);
        }
        return;
      }

      if (userCancelledShare) {
        showToast('Envio por compartilhamento cancelado. Você pode anexar ou baixar o PDF gerado abaixo.');
        return;
      }

      // Fallback universal (Desktop ou navegadores sem Web Share de arquivos / após delay assíncrono):
      // Faz o download automático do arquivo PDF formatado e abre o aplicativo de e-mail padrão do dispositivo.
      triggerPdfDownload(pdfReport.blob, pdfReport.fileName);
      window.location.href = mailtoUrl;

      if (!syncRes.synced && syncRes.message) {
        showToast(`${syncRes.message} PDF (${pdfReport.fileName}) baixado para anexo no e-mail.`);
      } else {
        showToast(`PDF (${pdfReport.fileName}) gerado e baixado! Aplicativo de e-mail aberto — anexe o arquivo PDF baixado se não estiver anexado automaticamente.`);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao gerar o PDF do relatório para envio por e-mail.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleShareGeneratedPdf = async () => {
    if (!lastGeneratedPdf) return;
    const { pdf, subject, shareText, mailtoUrl } = lastGeneratedPdf;
    const canShareFiles =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (!navigator.canShare || navigator.canShare({ files: [pdf.file] }));

    if (canShareFiles) {
      try {
        await navigator.share({
          title: subject,
          text: shareText,
          files: [pdf.file],
        });
        showToast(`PDF (${pdf.fileName}) anexado ao aplicativo selecionado!`);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    triggerPdfDownload(pdf.blob, pdf.fileName);
    window.location.href = mailtoUrl;
    showToast(`PDF (${pdf.fileName}) baixado e e-mail aberto!`);
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
          disabled={isSendingEmail}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Send className="w-4 h-4 stroke-[3]" />
          <span>{isSendingEmail ? 'Gerando PDF, sincronizando e abrindo e-mail...' : 'Enviar Estoque Selecionado por E-mail'}</span>
        </button>

        {lastGeneratedPdf && (
          <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 flex-wrap">
            <div className="text-[11px] font-bold text-emerald-950 truncate flex-1 min-w-0">
              PDF gerado: <span className="font-mono">{lastGeneratedPdf.pdf.fileName}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleShareGeneratedPdf}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Anexar / Compartilhar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => triggerPdfDownload(lastGeneratedPdf.pdf.blob, lastGeneratedPdf.pdf.fileName)}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-bold rounded-lg flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Baixar PDF</span>
              </button>
            </div>
          </div>
        )}
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
          {reportText}
        </div>
      </div>

    </div>
  );
};
