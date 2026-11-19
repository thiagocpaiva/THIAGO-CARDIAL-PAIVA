
import React, { useState, useRef, useEffect } from 'react';
import { 
  Mail, 
  Plus, 
  Trash2, 
  Check, 
  Copy, 
  FileDown,
  MessageSquare,
  Star,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Settings,
  Layers,
  Zap,
  Send,
  Calendar,
  Loader2,
  Download,
  Upload,
  FileSpreadsheet,
  Database,
  ArrowRight,
  Server,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import {
  generateStockReportText,
  generateStockReportHtml,
  generateStockReportEmailTableText,
  preloadGrupoMsLogoDataUrl,
} from '../../utils/reportGenerator';
import { sendEmailDirectly, SendEmailResult, inferServerConfig, testServerCommunication } from '../../utils/emailSender';
import { MaterialItem, FreezerItem, EquipmentItem, ServerEmailConfig, getBranchFileSlug } from '../../types/inventory';
import { GrupoMSBrand } from '../common/GrupoMSBrand';

type ExportChannel = 'email' | 'whatsapp' | 'pdf' | 'copy';
type ExportStockSelection = 'materiais' | 'equipamentos' | 'ambos';

interface OpcoesEnvioViewProps {
  onNavigateToExportar?: () => void;
}

export const OpcoesEnvioView: React.FC<OpcoesEnvioViewProps> = ({
  onNavigateToExportar
}) => {
  const { 
    emailSettings, 
    addEmail, 
    removeEmail, 
    setDefaultEmail,
    recipientsText,
    updateRecipientsText,
    defaultSenderEmail,
    serverEmailConfig,
    updateServerEmailConfig,
    activeUser,
    materials,
    freezers,
    equipments,
    uncataloguedEquipments,
    materialCounts,
    equipmentCounts,
    todayDateFormatted,
    importBaseItems,
    isMaster,
    isContadorActive,
    activeBranch,
  } = useInventory();

  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [includeEquipmentDefects, setIncludeEquipmentDefects] = useState(false);
  const [selectedStock, setSelectedStock] = useState<ExportStockSelection>('ambos');
  const [channelActionModal, setChannelActionModal] = useState<ExportChannel | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendEmailResult | null>(null);

  // Estados para E-mail de Remetente Padrão (Envio do App) e Servidor POP/SMTP
  const [senderEmailInput, setSenderEmailInput] = useState(serverEmailConfig.senderEmail || defaultSenderEmail || '');
  const [senderNameInput, setSenderNameInput] = useState(serverEmailConfig.senderName || 'CONTAGEM DE ESTOQUE');
  const [smtpHost, setSmtpHost] = useState(serverEmailConfig.smtpHost || '');
  const [smtpPort, setSmtpPort] = useState(serverEmailConfig.smtpPort || 587);
  const [smtpSecure, setSmtpSecure] = useState(Boolean(serverEmailConfig.smtpSecure));
  const [smtpUser, setSmtpUser] = useState(serverEmailConfig.smtpUser || '');
  const [smtpPass, setSmtpPass] = useState(serverEmailConfig.smtpPass || '');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [popHost, setPopHost] = useState(serverEmailConfig.popHost || '');
  const [popPort, setPopPort] = useState(serverEmailConfig.popPort || 995);
  const [popSecure, setPopSecure] = useState(Boolean(serverEmailConfig.popSecure));
  const [showServerDetails, setShowServerDetails] = useState(false);
  const [isTestingServer, setIsTestingServer] = useState(false);

  const lastBranchRef = useRef(activeBranch);

  useEffect(() => {
    preloadGrupoMsLogoDataUrl().catch(() => {});
  }, []);

  // Sincroniza campos locais quando a base ativa mudar
  useEffect(() => {
    if (lastBranchRef.current !== activeBranch) {
      lastBranchRef.current = activeBranch;
      setSenderEmailInput(serverEmailConfig.senderEmail || defaultSenderEmail || '');
      setSenderNameInput(serverEmailConfig.senderName || 'CONTAGEM DE ESTOQUE');
      setSmtpHost(serverEmailConfig.smtpHost || '');
      setSmtpPort(serverEmailConfig.smtpPort || 587);
      setSmtpSecure(Boolean(serverEmailConfig.smtpSecure));
      setSmtpUser(serverEmailConfig.smtpUser || '');
      setSmtpPass(serverEmailConfig.smtpPass || '');
      setPopHost(serverEmailConfig.popHost || '');
      setPopPort(serverEmailConfig.popPort || 995);
      setPopSecure(Boolean(serverEmailConfig.popSecure));
    }
  }, [activeBranch, serverEmailConfig, defaultSenderEmail]);

  // Estado para importação de base
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handlePullServerConfigs = () => {
    if (!senderEmailInput.trim()) {
      showToast('Digite um e-mail de remetente antes de puxar as configurações.');
      return;
    }
    const inferred = inferServerConfig(senderEmailInput, senderNameInput);
    setSmtpHost(inferred.smtpHost);
    setSmtpPort(inferred.smtpPort);
    setSmtpSecure(inferred.smtpSecure);
    setSmtpUser(inferred.smtpUser);
    setPopHost(inferred.popHost);
    setPopPort(inferred.popPort);
    setPopSecure(inferred.popSecure);
    showToast('Configurações do servidor identificadas com sucesso!');
  };

  const handleSaveAndTestServerConfig = async () => {
    const cleanEmail = senderEmailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      showToast('Informe um e-mail de remetente válido.');
      return;
    }

    setIsTestingServer(true);

    const configToSave: ServerEmailConfig = {
      senderEmail: cleanEmail,
      senderName: senderNameInput.trim() || 'CONTAGEM DE ESTOQUE',
      smtpHost: smtpHost.trim() || `smtp.${cleanEmail.split('@')[1]}`,
      smtpPort: Number(smtpPort) || 587,
      smtpSecure,
      smtpUser: smtpUser.trim() || cleanEmail,
      smtpPass,
      popHost: popHost.trim() || `pop.${cleanEmail.split('@')[1]}`,
      popPort: Number(popPort) || 995,
      popSecure,
      popUser: cleanEmail,
      communicationStatus: 'E-mail: Ok',
      lastTestedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    const testRes = await testServerCommunication(configToSave);
    configToSave.communicationStatus = testRes.ok ? 'E-mail: Ok' : 'E-mail: Erro';
    configToSave.statusMessage = testRes.message;

    updateServerEmailConfig(configToSave);
    setIsTestingServer(false);

    if (testRes.ok) {
      showToast('E-mail de remetente gravado e comunicação testada com sucesso!');
    } else {
      showToast(`Aviso: ${testRes.message}`);
    }
  };

  // Gera o relatório atual formatado
  const reportText = generateStockReportText({
    selectedStock,
    todayDateFormatted,
    activeUser,
    defaultSenderEmail,
    recipients: emailSettings.emails,
    materials,
    freezers,
    equipments,
    uncataloguedEquipments,
    materialCounts,
    equipmentCounts,
    includeEquipmentDefects,
    branch: activeBranch,
  });

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');
    const email = newEmailInput.trim().toLowerCase();

    if (!email || !email.includes('@') || !email.includes('.')) {
      setEmailError('Informe um endereço de e-mail válido.');
      return;
    }

    if (emailSettings.emails.includes(email)) {
      setEmailError('Este e-mail já está cadastrado.');
      return;
    }

    addEmail(email);
    setNewEmailInput('');
    showToast(`E-mail [${email}] adicionado à lista de envio da Base ${activeBranch}!`);
  };

  // =========================================================================
  // EXPORTAÇÕES DE RELATÓRIO
  // =========================================================================

  // =========================================================================
  // EXPORTAÇÕES DE RELATÓRIO
  // =========================================================================

  // 1. Exportar em PDF para o estoque escolhido
  const executeExportPDF = (stockChoice: ExportStockSelection) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para gerar a impressão do relatório em PDF.');
      return;
    }

    const htmlContent = generateStockReportHtml({
      selectedStock: stockChoice,
      todayDateFormatted,
      activeUser,
      defaultSenderEmail,
      recipients: emailSettings.emails,
      materials,
      freezers,
      equipments,
      uncataloguedEquipments,
      materialCounts,
      equipmentCounts,
      includeEquipmentDefects,
      branch: activeBranch,
    });

    const printPageContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>[${activeBranch}] Relatório Oficial de Contagem de Estoque - ${todayDateFormatted}</title>
          <meta charset="utf-8">
          <style>
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { padding: 0 !important; background: #fff !important; }
              div { box-shadow: none !important; border: none !important; }
            }
          </style>
        </head>
        <body style="margin: 0; padding: 12px; background-color: #ffffff;">
          ${htmlContent}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printPageContent);
    printWindow.document.close();
    showToast(`Janela de impressão em PDF aberta (${stockChoice.toUpperCase()})!`);
  };

  // 2. Enviar por WhatsApp para o estoque escolhido
  const executeSendWhatsApp = (stockChoice: ExportStockSelection) => {
    const text = generateStockReportText({
      selectedStock: stockChoice,
      todayDateFormatted,
      activeUser,
      defaultSenderEmail,
      recipients: emailSettings.emails,
      materials,
      freezers,
      equipments,
      uncataloguedEquipments,
      materialCounts,
      equipmentCounts,
      includeEquipmentDefects,
      branch: activeBranch,
    });
    const encoded = encodeURIComponent(text);
    const url = `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
    showToast(`WhatsApp aberto para envio do relatório da Base ${activeBranch} (${stockChoice.toUpperCase()})!`);
  };

  // Salvar E-mail do Recebedor (Destinatário Padrão)
  const handleSaveSenderEmail = () => {
    const cleanEmail = senderEmailInput.trim().toLowerCase();
    if (cleanEmail && (!cleanEmail.includes('@') || !cleanEmail.includes('.'))) {
      showToast('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    updateServerEmailConfig({
      ...serverEmailConfig,
      senderEmail: cleanEmail,
    });
    setDefaultEmail(cleanEmail);
    showToast(
      cleanEmail 
        ? `E-mail do destinatário [${cleanEmail}] salvo com sucesso na Base ${activeBranch}!` 
        : `E-mail do destinatário limpo na Base ${activeBranch}!`
    );
  };

  // 3. Enviar por E-mail para o estoque escolhido (com a planilha formatada idêntica ao PDF anexada/copiada para o corpo)
  const executeSendEmail = async (stockChoice: ExportStockSelection) => {
    const primaryTo = (defaultSenderEmail || serverEmailConfig?.senderEmail || '').trim();
    const ccEmails = emailSettings.emails.filter(e => e.toLowerCase() !== primaryTo.toLowerCase());
    const ccStr = ccEmails.join(',');

    if (!primaryTo && emailSettings.emails.length === 0) {
      alert(`Nenhum e-mail de recebedor ou em cópia cadastrado na base ${activeBranch} para envio.`);
      return;
    }

    const effectiveTo = primaryTo || (emailSettings.emails.length > 0 ? emailSettings.emails[0] : '');
    const effectiveCc = primaryTo ? ccStr : emailSettings.emails.slice(1).join(',');

    try {
      const subject = `[${activeBranch}] Relatório de Contagem de Estoque - ${todayDateFormatted} (${stockChoice.toUpperCase()})`;
      
      const reportHtml = generateStockReportHtml({
        selectedStock: stockChoice,
        todayDateFormatted,
        activeUser,
        defaultSenderEmail,
        recipients: effectiveTo ? [effectiveTo, ...ccEmails] : emailSettings.emails,
        materials,
        freezers,
        equipments,
        uncataloguedEquipments,
        materialCounts,
        equipmentCounts,
        includeEquipmentDefects,
        branch: activeBranch,
      });

      const text = generateStockReportEmailTableText({
        selectedStock: stockChoice,
        todayDateFormatted,
        activeUser,
        defaultSenderEmail,
        recipients: effectiveTo ? [effectiveTo, ...ccEmails] : emailSettings.emails,
        materials,
        freezers,
        equipments,
        uncataloguedEquipments,
        materialCounts,
        equipmentCounts,
        includeEquipmentDefects,
        branch: activeBranch,
      });

      // Anexa a planilha HTML formatada (idêntica ao PDF) na área de transferência para colar no corpo do e-mail
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          const blobText = new Blob([text], { type: 'text/plain' });
          const blobHtml = new Blob([reportHtml], { type: 'text/html' });
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/plain': blobText,
              'text/html': blobHtml,
            }),
          ]);
        } catch {
          navigator.clipboard.writeText(text);
        }
      }

      let mailtoUrl = `mailto:${encodeURIComponent(effectiveTo)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      if (effectiveCc) {
        mailtoUrl += `&cc=${encodeURIComponent(effectiveCc)}`;
      }

      window.location.href = mailtoUrl;
      showToast(`Aplicativo de e-mail aberto para a Base ${activeBranch}!`);
    } catch (err: any) {
      alert('Erro ao abrir aplicativo de e-mail: ' + (err.message || 'Falha ao acionar'));
    }
  };

  // 4. Copiar Relatório para o estoque escolhido
  const executeCopyReport = async (stockChoice: ExportStockSelection) => {
    const text = generateStockReportText({
      selectedStock: stockChoice,
      todayDateFormatted,
      activeUser,
      defaultSenderEmail,
      recipients: emailSettings.emails,
      materials,
      freezers,
      equipments,
      uncataloguedEquipments,
      materialCounts,
      equipmentCounts,
      includeEquipmentDefects,
      branch: activeBranch,
    });

    const reportHtml = generateStockReportHtml({
      selectedStock: stockChoice,
      todayDateFormatted,
      activeUser,
      defaultSenderEmail,
      recipients: emailSettings.emails,
      materials,
      freezers,
      equipments,
      uncataloguedEquipments,
      materialCounts,
      equipmentCounts,
      includeEquipmentDefects,
      branch: activeBranch,
    });

    if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      try {
        const blobText = new Blob([text], { type: 'text/plain' });
        const blobHtml = new Blob([reportHtml], { type: 'text/html' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': blobText,
            'text/html': blobHtml,
          }),
        ]);
      } catch {
        navigator.clipboard.writeText(text);
      }
    } else {
      navigator.clipboard.writeText(text);
    }

    showToast(`Relatório da Base ${activeBranch} (${stockChoice.toUpperCase()}) copiado para a área de transferência!`);
  };

  // Executa o canal quando o usuário escolhe Materiais, Equipamentos ou Ambos
  const handleSelectChannelStock = (stockChoice: ExportStockSelection) => {
    const action = channelActionModal;
    setChannelActionModal(null);
    if (!action) return;

    if (action === 'pdf') {
      executeExportPDF(stockChoice);
    } else if (action === 'whatsapp') {
      executeSendWhatsApp(stockChoice);
    } else if (action === 'email') {
      executeSendEmail(stockChoice);
    } else if (action === 'copy') {
      executeCopyReport(stockChoice);
    }
  };

  // =========================================================================
  // GESTÃO DA BASE DE DADOS (IMPORTAÇÃO, EXPORTAÇÃO E DOWNLOAD DO MODELO PADRÃO)
  // Os cadastros nunca são zerados diariamente, ficam sempre na base!
  // =========================================================================

  /**
   * 1. Download do arquivo padrão (modelo CSV) que a base aceita para ser importado
   */
  const handleDownloadTemplate = () => {
    // Modelo padrão com colunas:
    // TIPO;CODIGO;PATRIMONIO;NOME;CATEGORIA;SUBOPCAO_OU_MARCA;MODELO;VOLTAGEM
    const header = 'TIPO;CODIGO;PATRIMONIO;NOME;CATEGORIA;SUBOPCAO_OU_MARCA;MODELO;VOLTAGEM\n';
    
    // Cadastros sempre individuais (mesa um item, cadeira outro item, sem jogos de mesa)
    const sampleRows = [
      'material;MAT-001;;Mesa Plastica Branca;mesa_plastica;DEVASSA AMARELA;;',
      'material;MAT-002;;Cadeira Plastica Com Braco;cadeira_plastica_com_braco;DEVASSA AMARELA;;',
      'material;MAT-003;;Cadeira Plastica Sem Braco;cadeira_plastica_sem_braco;NOVA SCHIN;;',
      'material;MAT-004;;Mesa Madeira Dobravel;mesa_madeira;AMSTEL EXTREME;;',
      'material;MAT-005;;Cadeira Madeira Dobravel;cadeira_madeira;AMSTEL EXTREME;;',
      'material;MAT-006;;Caixa Termica 34L Amarela;caixa_termica;AMARELA;;',
      'material;MAT-007;;Barril de Chopp 50L;barril;BARRIL 50L;;',
      'material;MAT-008;;Cilindro de Gas CO2 Medio;co2;MÉDIO;;',
      'freezer;FRZ-101;PAT-100234;Freezer 4 Caixas Nova Schin;;NOVA SCHIN;4 CAIXAS;220V',
      'freezer;FRZ-102;PAT-100235;Freezer 8 Caixas Heineken;;HEINEKEN;8 CAIXAS;220V',
      'equipamento;CHP-201;PAT-200551;Chopeira 1 Torneira Amstel;;AMSTEL;chopeira_1_torneira;220V',
      'equipamento;CHP-202;PAT-200552;Chopeira 2 Torneiras Heineken;;HEINEKEN;chopeira_2_torneiras;220V',
    ].join('\n');

    const csvContent = '\uFEFF' + header + sampleRows; // UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modelo_padrao_cadastro_itens.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Planilha modelo padrão baixada com sucesso!');
  };

  /**
   * 2. Exportar todos os cadastros atuais da base (Materiais, Freezers e Chopeiras)
   */
  const handleExportBaseData = () => {
    const header = 'TIPO;CODIGO;PATRIMONIO;NOME;CATEGORIA;SUBOPCAO_OU_MARCA;MODELO;VOLTAGEM\n';
    const rows: string[] = [];

    // Materiais
    materials.forEach(m => {
      rows.push(`material;${m.code};;${m.name};${m.category};${m.subOption || ''};;`);
    });

    // Freezers
    freezers.forEach(f => {
      rows.push(`freezer;${f.code};${f.patrimony};${f.name};;${f.brand};${f.model};${f.voltage}`);
    });

    // Equipamentos (Chopeiras)
    equipments.forEach(eq => {
      rows.push(`equipamento;${eq.code};${eq.patrimony};${eq.name};;${eq.brand};${eq.type};${eq.voltage}`);
    });

    const branchCode = getBranchFileSlug(activeBranch);
    const csvContent = '\uFEFF' + header + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cadastro_base_itens_${branchCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Base de itens (${activeBranch}) exportada com sucesso (${materials.length + freezers.length + equipments.length} itens)!`);
  };

  /**
   * 3. Importar arquivo para alimentar as informações dos cadastros na base
   */
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error('Arquivo vazio');

        const newMaterials: MaterialItem[] = [];
        const newFreezers: FreezerItem[] = [];
        const newEquipments: EquipmentItem[] = [];

        // Verifica se é JSON ou CSV
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.materials)) newMaterials.push(...parsed.materials);
          if (Array.isArray(parsed.freezers)) newFreezers.push(...parsed.freezers);
          if (Array.isArray(parsed.equipments)) newEquipments.push(...parsed.equipments);
        } else {
          // Processa CSV
          const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
          if (lines.length < 2) {
            throw new Error('O arquivo CSV deve conter cabeçalho e pelo menos 1 linha de dados.');
          }

          const delimiter = lines[0].includes(';') ? ';' : ',';

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
            if (cols.length < 2) continue;

            const [tipoRaw, codigo, patrimonio, nome, categoria, subOpcaoOuMarca, modelo, voltagem] = cols;
            const tipo = (tipoRaw || '').toLowerCase();

            if (!codigo) continue;

            const now = new Date().toISOString().slice(0, 10);

            if (tipo === 'material' || tipo === 'mat') {
              newMaterials.push({
                id: 'mat-imp-' + Date.now() + '-' + i,
                code: codigo.toUpperCase(),
                name: nome || `Material ${codigo}`,
                category: (categoria as any) || 'mesa_plastica',
                subOption: subOpcaoOuMarca || undefined,
                createdAt: now,
              });
            } else if (tipo === 'freezer' || tipo === 'frz') {
              newFreezers.push({
                id: 'frz-imp-' + Date.now() + '-' + i,
                code: codigo.toUpperCase(),
                patrimony: (patrimonio || `PAT-${codigo}`).toUpperCase(),
                name: nome || `Freezer ${codigo}`,
                brand: subOpcaoOuMarca || 'Metalfrio',
                model: modelo || 'Padrão',
                voltage: (voltagem as any) || '220V',
                createdAt: now,
              });
            } else if (tipo === 'equipamento' || tipo === 'chopeira' || tipo === 'eq') {
              const eqType = modelo?.toLowerCase().includes('2') || subOpcaoOuMarca?.toLowerCase().includes('2') 
                ? 'chopeira_2_torneiras' 
                : 'chopeira_1_torneira';

              newEquipments.push({
                id: 'eq-imp-' + Date.now() + '-' + i,
                code: codigo.toUpperCase(),
                patrimony: (patrimonio || `PAT-${codigo}`).toUpperCase(),
                name: nome || `Chopeira ${codigo}`,
                brand: subOpcaoOuMarca || 'Memo',
                voltage: (voltagem as any) || '220V',
                type: eqType,
                createdAt: now,
              });
            }
          }
        }

        const totalImported = newMaterials.length + newFreezers.length + newEquipments.length;
        if (totalImported === 0) {
          throw new Error('Nenhum item válido encontrado no arquivo para importar.');
        }

        // Alimenta a base permanente usando a função de importação do contexto
        const result = importBaseItems({
          materials: newMaterials,
          freezers: newFreezers,
          equipments: newEquipments,
        });

        setImportStatus(result.message);
        showToast(`Importação concluída com sucesso exclusivamente para a base ${activeBranch}: ${result.message}`);
      } catch (err: any) {
        showToast('Erro ao importar arquivo: ' + (err.message || 'Formato inválido'));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 pb-12 bg-white">
      
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {onNavigateToExportar && (
            <button
              type="button"
              onClick={onNavigateToExportar}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Voltar para a tela Exportar"
            >
              <span>← Voltar</span>
            </button>
          )}
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
            <Settings className="w-5 h-5 text-indigo-600" />
            <span>Opções de Envio & E-mails</span>
          </h2>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-black shadow-xs">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
          <span>Base Ativa: {activeBranch}</span>
        </div>
      </div>

      {/* Alerta de Contador Ativo */}
      {isMaster && isContadorActive && (
        <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Existe usuário realizando contagem no momento.</span>
        </div>
      )}

      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* =========================================================================
          SEÇÃO: OPÇÕES DE ENVIO E EXPORTAÇÃO
          ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Canais de Envio do Relatório
          </h3>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            Base {activeBranch}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Exportar em PDF */}
          <button
            type="button"
            onClick={() => setChannelActionModal('pdf')}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-left transition-all active:scale-[0.98] flex flex-col justify-between cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold mb-2">
              <FileDown className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Exportar em PDF</span>
            </div>
          </button>

          {/* 2. Enviar para WhatsApp */}
          <button
            type="button"
            onClick={() => setChannelActionModal('whatsapp')}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition-all active:scale-[0.98] flex flex-col justify-between cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Enviar para WhatsApp</span>
            </div>
          </button>

          {/* 3. Enviar por E-mail (Direto pelo Aplicativo) */}
          <button
            type="button"
            onClick={() => setChannelActionModal('email')}
            disabled={isSending}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/50 text-left transition-all active:scale-[0.98] flex flex-col justify-between disabled:opacity-50 cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center font-bold mb-2">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">
                Enviar por E-mail
              </span>
            </div>
          </button>

          {/* 4. Copiar Relatório */}
          <button
            type="button"
            onClick={() => setChannelActionModal('copy')}
            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-left transition-all active:scale-[0.98] flex flex-col justify-between cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Copiar Relatório</span>
            </div>
          </button>
        </div>
      </div>

      {/* =========================================================================
          SEÇÃO: E-MAIL DO RECEBEDOR
          ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                E-mail do Recebedor
              </h3>
            </div>
          </div>
        </div>

        {/* Campo para Digitar o E-mail do Recebedor */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">
            Digitar E-mail do recebedor:
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="email"
                value={senderEmailInput}
                onChange={e => {
                  const val = e.target.value;
                  setSenderEmailInput(val);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveSenderEmail();
                  }
                }}
                placeholder="Digite o e-mail do recebedor"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
            <button
              type="button"
              onClick={handleSaveSenderEmail}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0"
              title="Salvar e-mail do recebedor"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Recebedor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Digitar E-mail em cópia */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-600" />
            <span>Digitar E-mail em cópia</span>
          </h3>
        </div>

        {emailError && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{emailError}</span>
          </div>
        )}

        <form onSubmit={handleAddEmail} className="flex gap-2">
          <input
            type="email"
            value={newEmailInput}
            onChange={e => setNewEmailInput(e.target.value)}
            placeholder="Digite o endereço de e-mail em cópia"
            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Cópia</span>
          </button>
        </form>
      </div>

      {/* Lista de E-mails em Cópia Cadastrados */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900">
            E-mails em Cópia Salvos na Base ({emailSettings.emails.length})
          </h3>
        </div>

        {emailSettings.emails.length === 0 ? (
          <div className="text-center py-6 text-xs text-slate-500">
            Nenhum e-mail em cópia cadastrado na base {activeBranch}.
          </div>
        ) : (
          <div className="space-y-2">
            {emailSettings.emails.map(email => {
              return (
                <div
                  key={email}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-mono text-slate-800 truncate">
                      {email}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      removeEmail(email);
                      showToast(`E-mail em cópia [${email}] removido da Base ${activeBranch}!`);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Remover e-mail em cópia"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE SELEÇÃO DE ESTOQUE PARA CANAIS DE ENVIO */}
      {channelActionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center border border-indigo-200 shrink-0">
                  {channelActionModal === 'pdf' && <FileDown className="w-5 h-5 text-indigo-700" />}
                  {channelActionModal === 'whatsapp' && <MessageSquare className="w-5 h-5 text-emerald-700" />}
                  {channelActionModal === 'email' && <Mail className="w-5 h-5 text-cyan-700" />}
                  {channelActionModal === 'copy' && <Copy className="w-5 h-5 text-amber-700" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    {channelActionModal === 'pdf' && 'Exportar em PDF'}
                    {channelActionModal === 'whatsapp' && 'Enviar para WhatsApp'}
                    {channelActionModal === 'email' && 'Enviar por E-mail'}
                    {channelActionModal === 'copy' && 'Copiar Relatório'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione qual estoque deseja enviar no relatório
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setChannelActionModal(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Qual contagem de estoque você deseja enviar?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Botão Materiais */}
              <button
                type="button"
                onClick={() => handleSelectChannelStock('materiais')}
                className="p-3.5 rounded-2xl border-2 border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-500 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center mb-2 shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-amber-950 block uppercase tracking-wide">
                    Materiais
                  </span>
                  <span className="text-[10px] text-amber-800 mt-0.5 block leading-tight">
                    Mesas, Cadeiras, Barris e CO2.
                  </span>
                </div>
              </button>

              {/* Botão Equipamentos */}
              <button
                type="button"
                onClick={() => handleSelectChannelStock('equipamentos')}
                className="p-3.5 rounded-2xl border-2 border-cyan-300 bg-cyan-50/70 hover:bg-cyan-100 hover:border-cyan-500 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-600 text-white flex items-center justify-center mb-2 shadow-xs">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-cyan-950 block uppercase tracking-wide">
                    Equipamentos
                  </span>
                  <span className="text-[10px] text-cyan-800 mt-0.5 block leading-tight">
                    Freezers e Chopeiras.
                  </span>
                </div>
              </button>

              {/* Botão Ambos */}
              <button
                type="button"
                onClick={() => handleSelectChannelStock('ambos')}
                className="p-3.5 rounded-2xl border-2 border-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 hover:border-indigo-500 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center mb-2 shadow-xs">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-indigo-950 block uppercase tracking-wide">
                    Ambos
                  </span>
                  <span className="text-[10px] text-indigo-800 mt-0.5 block leading-tight">
                    Relatório unificado completo.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setChannelActionModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
