
import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Layers, 
  Snowflake, 
  Zap, 
  AlertTriangle,
  AlertCircle,
  Database,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  X,
  RefreshCw,
  Check,
  Send,
  MapPin
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MaterialItem, FreezerItem, EquipmentItem, UnitBranch, getSelectableBranches, getBranchFileSlug, toTestBranch } from '../../types/inventory';
import { CATEGORIAS_MATERIAIS } from '../modals/CadastrarMaterialModal';

interface GestaoCadastrosViewProps {
  onOpenCreateMaterial: () => void;
  onOpenCreateFreezer: () => void;
  onOpenCreateEquipment: () => void;
  onEditMaterial: (m: MaterialItem) => void;
  onEditFreezer: (f: FreezerItem) => void;
  onEditEquipment: (eq: EquipmentItem) => void;
  initialFilterType?: 'all' | 'materiais' | 'freezers' | 'equipamentos' | 'nao_cadastrados';
}

interface ParsedImportData {
  materials: MaterialItem[];
  freezers: FreezerItem[];
  equipments: EquipmentItem[];
}

interface FileValidationError {
  line: number;
  field: string;
  itemCode?: string;
  itemName?: string;
  message: string;
}

interface ImportConflict {
  id: string;
  itemType: 'material' | 'freezer' | 'equipamento';
  conflictReasons: string[];
  incomingItem: MaterialItem | FreezerItem | EquipmentItem;
  existingItem: MaterialItem | FreezerItem | EquipmentItem;
  resolution: 'replace' | 'keep';
}

export const GestaoCadastrosView: React.FC<GestaoCadastrosViewProps> = ({
  onOpenCreateMaterial,
  onOpenCreateFreezer,
  onOpenCreateEquipment,
  onEditMaterial,
  onEditFreezer,
  onEditEquipment,
  initialFilterType,
}) => {
  const { 
    materials, 
    freezers, 
    equipments, 
    deleteMaterial, 
    deleteFreezer, 
    deleteEquipment,
    deleteUnregisteredItemEntireHistory,
    clearSelectedData,
    importBaseItems,
    isMaster,
    isCoringa,
    isContadorActive,
    isAnyBaseCountInProgress,
    activeBranch,
    syncMasterDataToFirebase,
    hasPendingMasterSync,
    lastFirebaseSyncAt,
  } = useInventory();

  const selectableBranches = getSelectableBranches(isCoringa);

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'materiais' | 'freezers' | 'equipamentos' | 'nao_cadastrados'>(initialFilterType || 'all');
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [clearStockTarget, setClearStockTarget] = useState<'materiais' | 'equipamentos' | 'ambos'>('ambos');
  const [clearBranchTarget, setClearBranchTarget] = useState<UnitBranch | 'AMBAS'>(activeBranch);

  useEffect(() => {
    if (initialFilterType) {
      setFilterType(initialFilterType);
    }
  }, [initialFilterType]);

  // Estados e refs para Importação / Exportação da Base
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados dos modais do fluxo de importação em massa
  const [pendingParsedData, setPendingParsedData] = useState<ParsedImportData | null>(null);
  const [detectedStockType, setDetectedStockType] = useState<'materiais' | 'equipamentos' | 'ambos'>('ambos');
  const [isDownloadChoiceModalOpen, setIsDownloadChoiceModalOpen] = useState(false);
  const [isImportChoiceModalOpen, setIsImportChoiceModalOpen] = useState(false);

  // EXIGÊNCIA: Na tela Cadastros, ao clicar no botão "Importar", aparecer tela com 2 botões perguntando para qual estoque deseja importar o arquivo.
  const [isImportStockModalOpen, setIsImportStockModalOpen] = useState(false);
  const [targetImportStock, setTargetImportStock] = useState<'materiais' | 'equipamentos'>('materiais');
  const [targetImportBranch, setTargetImportBranch] = useState<UnitBranch>(activeBranch);
  const [targetDownloadBranch, setTargetDownloadBranch] = useState<UnitBranch>(activeBranch);

  // Sincroniza as bases com a filial ativa do contexto
  useEffect(() => {
    setTargetImportBranch(activeBranch);
    setTargetDownloadBranch(activeBranch);
    setClearBranchTarget(activeBranch);
  }, [activeBranch]);

  // EXIGÊNCIA: Na tela Cadastro, ao clicar no botão "Exportar", aparecer tela perguntando de qual estoque deseja exportar, "Materiais", "Equipamentos", "Ambos".
  const [isExportStockModalOpen, setIsExportStockModalOpen] = useState(false);
  const [isNoDataExportModalOpen, setIsNoDataExportModalOpen] = useState(false);
  const [noDataExportMessage, setNoDataExportMessage] = useState('Cadastro sem informações a baixar.');

  const [isValidationErrorModalOpen, setIsValidationErrorModalOpen] = useState(false);
  const [validationErrorsList, setValidationErrorsList] = useState<FileValidationError[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [conflictsList, setConflictsList] = useState<ImportConflict[]>([]);
  const [nonConflictingData, setNonConflictingData] = useState<ParsedImportData>({
    materials: [],
    freezers: [],
    equipments: [],
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  /**
   * EXIGÊNCIA: No campo "GESTÃO DO CADASTRO EM MASSA DOS ITENS DA BASE", o arquivo baixado
   * tem que ter a coluna "BASE" para preencher para qual base será importada.
   */
  const handleDownloadMaterialsTemplate = (branchParam?: UnitBranch) => {
    const branchToUse = branchParam || targetDownloadBranch || activeBranch;
    const branchCode = getBranchFileSlug(branchToUse);
    const header = 'BASE;TIPO;CODIGO;NOME;CATEGORIA;SUBOPCAO;UNIDADE_MEDIDA\n';
    const sampleRows = [
      `${branchToUse};material;MAT-001;Mesa Plastica Branca;mesa_plastica;DEVASSA AMARELA;UN`,
      `${branchToUse};material;MAT-002;Cadeira Plastica Com Braco;cadeira_plastica_com_braco;DEVASSA AMARELA;UN`,
      `${branchToUse};material;MAT-003;Cadeira Plastica Sem Braco;cadeira_plastica_sem_braco;NOVA SCHIN;UN`,
      `${branchToUse};material;MAT-004;Mesa Madeira Dobravel;mesa_madeira;AMSTEL EXTREME;UN`,
      `${branchToUse};material;MAT-005;Cadeira Madeira Dobravel;cadeira_madeira;AMSTEL EXTREME;UN`,
      `${branchToUse};material;MAT-006;Caixa Termica 34L Amarela;caixa_termica;AMARELA;UN`,
      `${branchToUse};material;MAT-007;Barril de Chopp 50L;barril;BARRIL 50L;UN`,
      `${branchToUse};material;MAT-008;Cilindro de Gas CO2 Medio;co2;MÉDIO;UN`,
    ].join('\n');

    const csvContent = '\uFEFF' + header + sampleRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `modelo_padrao_materiais_${branchCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDownloadChoiceModalOpen(false);
    showToast(`Planilha padrão para Materiais (${branchToUse}) baixada com a coluna BASE incluída!`);
  };

  const handleDownloadEquipmentsTemplate = (branchParam?: UnitBranch) => {
    // EXIGÊNCIA: Coluna BASE incluída como primeira coluna para preenchimento da filial de destino
    // EXIGÊNCIA: Movimentar a coluna "TIPO", do arquivo exportado do estoque de equipamentos, e colocar após a coluna "MODELO"
    // EXIGÊNCIA: inserir tanto arquivo a baixar, quanto no arquivo a exportar do estoque de Equipamentos, a coluna "OBS"
    const branchToUse = branchParam || targetDownloadBranch || activeBranch;
    const branchCode = getBranchFileSlug(branchToUse);
    const header = 'BASE;CODIGO;PATRIMONIO;NOME;MARCA;MODELO;TIPO;IDT;VOLTAGEM;DEFEITOS_DOS_EQUIPAMENTOS;OBS\n';
    const sampleRows = [
      `${branchToUse};FRZ-101;PAT-100234;Freezer Horizontal 4 Caixas SLIM;NOVA SCHIN;4 CAIXAS;SLIM;PORTA CEGA;220V;Sem motor;Localizado no galpão B`,
      `${branchToUse};FRZ-102;PAT-100235;Freezer Horizontal 8 Caixas;HEINEKEN;8 CAIXAS;PADRÃO;PORTA VIDRO;220V;;Revisado recentemente`,
      `${branchToUse};CHP-201;PAT-200551;Chopeira Eletrica 1 Torneira;AMSTEL;1 TORNEIRA;CHOPEIRA;;220V;Vazamento na serpentina;Aguardando peça de reposição`,
      `${branchToUse};CHP-202;PAT-200552;Chopeira Eletrica 2 Torneiras;HEINEKEN;2 TORNEIRAS;CHOPEIRA;;220V;;`,
    ].join('\n');

    const csvContent = '\uFEFF' + header + sampleRows;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `modelo_padrao_equipamentos_${branchCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsDownloadChoiceModalOpen(false);
    showToast(`Planilha padrão para Equipamentos (${branchToUse}) baixada com a coluna BASE incluída!`);
  };

  // EXIGÊNCIA: Na tela Cadastros, ao clicar no botão "Baixar Arquivo", adicionar o botão "AMBOS", caso desejar baixar os 2 arquivos dos estoques de vez, em arquivos separados.
  const handleDownloadBothTemplates = (branchParam?: UnitBranch) => {
    const branchToUse = branchParam || targetDownloadBranch || activeBranch;
    handleDownloadMaterialsTemplate(branchToUse);
    setTimeout(() => {
      handleDownloadEquipmentsTemplate(branchToUse);
    }, 400);
    setIsDownloadChoiceModalOpen(false);
    showToast(`Baixando ambos os arquivos com a coluna BASE (${branchToUse}) em arquivos separados!`);
  };

  /**
   * Helper para disparar download de arquivo CSV
   */
  const triggerCsvDownload = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * 2. EXIGÊNCIA: Na tela Cadastro, ao clicar no botão "Exportar", aparecer tela perguntando de qual estoque deseja exportar, "Materiais", "Equipamentos", "Ambos".
   * EXIGÊNCIA: Ao pressionar o botão "Ambos", baixar os 2 estoques em arquivos separados.
   * EXIGÊNCIA: Movimentar a coluna "TIPO", do arquivo exportado do estoque de equipamentos, e colocar após a coluna "MODELO".
   * EXIGÊNCIA: inserir tanto arquivo a baixar, quanto no arquivo a exportar do estoque de Equipamentos, a coluna "OBS", para o preenchimento das observações dos itens.
   */
  const handleExportStockSelection = (stockChoice: 'materiais' | 'equipamentos' | 'ambos') => {
    setIsExportStockModalOpen(false);
    const todayStr = new Date().toISOString().slice(0, 10);
    const branchCode = getBranchFileSlug(activeBranch);

    // EXIGÊNCIA: caso os cadastros estejam zerados ou vazios, não baixar o arquivo e "Cadastro sem informações a baixar."
    if (stockChoice === 'materiais') {
      if (materials.length === 0) {
        setNoDataExportMessage(`Cadastro de Materiais da base ${activeBranch} sem informações a baixar.`);
        setIsNoDataExportModalOpen(true);
        return;
      }
      const header = 'BASE;TIPO;CODIGO;NOME;CATEGORIA;SUBOPCAO;UNIDADE_MEDIDA\n';
      const rows = materials.map(m => `${activeBranch};material;${m.code};${m.name};${m.category};${m.subOption || ''};UN`);
      triggerCsvDownload(`cadastro_base_materiais_${branchCode}_${todayStr}.csv`, '\uFEFF' + header + rows.join('\n'));
      showToast(`Base de Materiais (${activeBranch}) exportada com sucesso (${materials.length} itens)!`);
      return;
    }

    if (stockChoice === 'equipamentos') {
      if (freezers.length === 0 && equipments.length === 0) {
        setNoDataExportMessage(`Cadastro de Equipamentos da base ${activeBranch} sem informações a baixar.`);
        setIsNoDataExportModalOpen(true);
        return;
      }
      const header = 'BASE;CODIGO;PATRIMONIO;NOME;MARCA;MODELO;TIPO;IDT;VOLTAGEM;DEFEITOS_DOS_EQUIPAMENTOS;OBS\n';
      const rows: string[] = [];
      freezers.forEach(f => {
        const tipoSlim = f.isSlim || f.tipo?.toUpperCase() === 'SLIM' || f.name.toUpperCase().includes('SLIM') ? 'SLIM' : 'PADRÃO';
        const idt = (f.identity || '').replace(/[\r\n;]+/g, ' ').trim();
        const obs = (f.observations || '').replace(/[\r\n;]+/g, ' ').trim();
        rows.push(`${activeBranch};${f.code};${f.patrimony};${f.name};${f.brand};${f.model};${tipoSlim};${idt};${f.voltage};${f.defect || ''};${obs}`);
      });
      equipments.forEach(eq => {
        const modLabel = eq.type === 'chopeira_2_torneiras' ? '2 TORNEIRAS' : '1 TORNEIRA';
        const obs = (eq.observations || '').replace(/[\r\n;]+/g, ' ').trim();
        rows.push(`${activeBranch};${eq.code};${eq.patrimony};${eq.name};${eq.brand || 'Memo'};${modLabel};CHOPEIRA;;${eq.voltage};${eq.defect || ''};${obs}`);
      });
      triggerCsvDownload(`cadastro_base_equipamentos_${branchCode}_${todayStr}.csv`, '\uFEFF' + header + rows.join('\n'));
      showToast(`Base de Equipamentos (${activeBranch}) exportada com sucesso (${freezers.length + equipments.length} itens)!`);
      return;
    }

    // stockChoice === 'ambos' -> Baixar os 2 estoques em arquivos separados
    const hasMaterials = materials.length > 0;
    const hasEquipments = (freezers.length + equipments.length) > 0;

    if (!hasMaterials && !hasEquipments) {
      setNoDataExportMessage('Cadastro sem informações a baixar.');
      setIsNoDataExportModalOpen(true);
      return;
    }

    if (hasMaterials) {
      const headerMats = 'BASE;TIPO;CODIGO;NOME;CATEGORIA;SUBOPCAO;UNIDADE_MEDIDA\n';
      const rowsMats = materials.map(m => `${activeBranch};material;${m.code};${m.name};${m.category};${m.subOption || ''};UN`);
      const matCsv = '\uFEFF' + headerMats + rowsMats.join('\n');
      triggerCsvDownload(`cadastro_base_materiais_${branchCode}_${todayStr}.csv`, matCsv);
    }

    if (hasEquipments) {
      const headerEqs = 'BASE;CODIGO;PATRIMONIO;NOME;MARCA;MODELO;TIPO;IDT;VOLTAGEM;DEFEITOS_DOS_EQUIPAMENTOS;OBS\n';
      const rowsEqs: string[] = [];
      freezers.forEach(f => {
        const tipoSlim = f.isSlim || f.tipo?.toUpperCase() === 'SLIM' || f.name.toUpperCase().includes('SLIM') ? 'SLIM' : 'PADRÃO';
        const idt = (f.identity || '').replace(/[\r\n;]+/g, ' ').trim();
        const obs = (f.observations || '').replace(/[\r\n;]+/g, ' ').trim();
        rowsEqs.push(`${activeBranch};${f.code};${f.patrimony};${f.name};${f.brand};${f.model};${tipoSlim};${idt};${f.voltage};${f.defect || ''};${obs}`);
      });
      equipments.forEach(eq => {
        const modLabel = eq.type === 'chopeira_2_torneiras' ? '2 TORNEIRAS' : '1 TORNEIRA';
        const obs = (eq.observations || '').replace(/[\r\n;]+/g, ' ').trim();
        rowsEqs.push(`${activeBranch};${eq.code};${eq.patrimony};${eq.name};${eq.brand || 'Memo'};${modLabel};CHOPEIRA;;${eq.voltage};${eq.defect || ''};${obs}`);
      });
      const eqCsv = '\uFEFF' + headerEqs + rowsEqs.join('\n');

      setTimeout(() => {
        triggerCsvDownload(`cadastro_base_equipamentos_${branchCode}_${todayStr}.csv`, eqCsv);
      }, hasMaterials ? 400 : 0);
    }

    // EXIGÊNCIA: Na tela Cadastro, ao pressionar o botão "Exportar" e clicar no botão "Ambos", informar o cadastro da base que não foi exportado por estar zerado ou vazio.
    if (!hasMaterials && hasEquipments) {
      setNoDataExportMessage(`O cadastro da base de Materiais (${activeBranch}) não foi exportado por estar zerado ou vazio. A base de Equipamentos foi exportada com sucesso.`);
      setIsNoDataExportModalOpen(true);
    } else if (hasMaterials && !hasEquipments) {
      setNoDataExportMessage(`O cadastro da base de Equipamentos (${activeBranch}) não foi exportado por estar zerado ou vazio. A base de Materiais foi exportada com sucesso.`);
      setIsNoDataExportModalOpen(true);
    } else {
      showToast(`Exportação da base ${activeBranch} realizada (${materials.length} materiais e ${freezers.length + equipments.length} equipamentos)!`);
    }
  };

  /**
   * 3. Leitura e Validação Rigorosa do Arquivo Importado
   * EXIGÊNCIA 5: verificar primeiro se todos os campos estão com os dados corretos aceito pela base do app,
   * caso não, mostrar os campos que precisam de atenção e não importar o arquivo.
   * EXIGÊNCIA 6: caso a base do cadastro do app esteja limpa, não perguntar como deseja incorporar as informações,
   * ir direto verificar primeiro se todos os campos estão com os dados corretos aceito pela base do app,
   * caso não, mostrar os campos que precisam de atenção e não importar o arquivo.
   */
  /**
   * Processa o texto de arquivo importado (seja de upload local ou baixado do Google Drive)
   */
  const processImportedFileText = (text: string, fileName: string = 'arquivo.csv') => {
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.');
      return;
    }

    try {
      if (!text || !text.trim()) {
        throw new Error('O arquivo selecionado está vazio.');
      }

      const errors: FileValidationError[] = [];
      const newMaterials: MaterialItem[] = [];
      const newFreezers: FreezerItem[] = [];
      const newEquipments: EquipmentItem[] = [];

      const seenMaterialCodes = new Set<string>();
      const seenEquipPatrimonies = new Set<string>();

      if (fileName.endsWith('.json')) {
          let parsed: any;
          try {
            parsed = JSON.parse(text);
          } catch {
            errors.push({ line: 1, field: 'FORMATO', message: 'Estrutura JSON inválida no arquivo.' });
          }

          if (parsed) {
            const rootBase = (parsed.base || parsed.branch || '').toString().trim();
            const validateItemBase = (itemBaseRaw: string, lineNum: number, itemCode?: string) => {
              if (!itemBaseRaw) {
                errors.push({
                  line: lineNum,
                  field: 'BASE',
                  itemCode,
                  message: `A propriedade "BASE" é obrigatória e não foi preenchida. Preencha com "${targetImportBranch}".`
                });
                return;
              }
              const cleanBase = itemBaseRaw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, '');
              let itemBranch: UnitBranch | null = null;
              if (cleanBase.includes('PAULO') || cleanBase.includes('AFONSO')) itemBranch = isCoringa ? toTestBranch('PAULO AFONSO') : 'PAULO AFONSO';
              else if (cleanBase.includes('DELMIRO') || cleanBase.includes('GOUVEIA')) itemBranch = isCoringa ? toTestBranch('DELMIRO') : 'DELMIRO';

              if (!itemBranch || itemBranch !== targetImportBranch) {
                errors.push({
                  line: lineNum,
                  field: 'BASE',
                  itemCode,
                  message: `A base informada no arquivo ("${itemBaseRaw}") não coincide com a base selecionada para importação ("${targetImportBranch}"). O aplicativo só aceita arquivos com a base preenchida de acordo com a seleção da base no momento da importação.`
                });
              }
            };

            if (parsed.materials) {
              if (!Array.isArray(parsed.materials)) {
                errors.push({ line: 1, field: 'materials', message: 'O campo "materials" deve ser uma lista.' });
              } else {
                parsed.materials.forEach((m: any, idx: number) => {
                  const lineNum = idx + 1;
                  const itemBase = (m.base || m.branch || rootBase).toString().trim();
                  validateItemBase(itemBase, lineNum, m.code);
                  if (!m.code || typeof m.code !== 'string' || !m.code.trim()) {
                    errors.push({ line: lineNum, field: 'CODIGO', message: 'Código de material obrigatório não informado.' });
                  }
                  if (!m.name || typeof m.name !== 'string' || !m.name.trim()) {
                    errors.push({ line: lineNum, field: 'NOME', itemCode: m.code, message: 'Nome do material obrigatório não informado.' });
                  }
                  newMaterials.push(m);
                });
              }
            }

            if (parsed.freezers) {
              if (!Array.isArray(parsed.freezers)) {
                errors.push({ line: 1, field: 'freezers', message: 'O campo "freezers" deve ser uma lista.' });
              } else {
                parsed.freezers.forEach((f: any, idx: number) => {
                  const lineNum = idx + 1;
                  const itemBase = (f.base || f.branch || rootBase).toString().trim();
                  validateItemBase(itemBase, lineNum, f.code);
                  if (!f.code || !f.code.trim()) {
                    errors.push({ line: lineNum, field: 'CODIGO', message: 'Código do freezer obrigatório não informado.' });
                  }
                  if (!f.patrimony || !f.patrimony.trim()) {
                    errors.push({ line: lineNum, field: 'PATRIMONIO', itemCode: f.code, message: 'Patrimônio do freezer obrigatório não informado.' });
                  } else {
                    const p = f.patrimony.trim().toUpperCase();
                    if (seenEquipPatrimonies.has(p)) {
                      errors.push({ line: lineNum, field: 'PATRIMONIO', itemCode: f.code, message: `Patrimônio duplicado no arquivo: [${p}].` });
                    } else {
                      seenEquipPatrimonies.add(p);
                    }
                  }
                  if (!f.name || !f.name.trim()) {
                    errors.push({ line: lineNum, field: 'NOME', itemCode: f.code, message: 'Nome do freezer obrigatório não informado.' });
                  }
                  const cleanIdt = (f.identity || f.idt || '').toString().trim().toUpperCase() || undefined;
                  newFreezers.push({ ...f, identity: cleanIdt });
                });
              }
            }

            if (parsed.equipments) {
              if (!Array.isArray(parsed.equipments)) {
                errors.push({ line: 1, field: 'equipments', message: 'O campo "equipments" deve ser uma lista.' });
              } else {
                parsed.equipments.forEach((eq: any, idx: number) => {
                  const lineNum = idx + 1;
                  const itemBase = (eq.base || eq.branch || rootBase).toString().trim();
                  validateItemBase(itemBase, lineNum, eq.code);
                  if (!eq.code || !eq.code.trim()) {
                    errors.push({ line: lineNum, field: 'CODIGO', message: 'Código da chopeira obrigatório não informado.' });
                  }
                  if (!eq.patrimony || !eq.patrimony.trim()) {
                    errors.push({ line: lineNum, field: 'PATRIMONIO', itemCode: eq.code, message: 'Patrimônio da chopeira obrigatório não informado.' });
                  } else {
                    const p = eq.patrimony.trim().toUpperCase();
                    if (seenEquipPatrimonies.has(p)) {
                      errors.push({ line: lineNum, field: 'PATRIMONIO', itemCode: eq.code, message: `Patrimônio duplicado no arquivo: [${p}].` });
                    } else {
                      seenEquipPatrimonies.add(p);
                    }
                  }
                  if (!eq.name || !eq.name.trim()) {
                    errors.push({ line: lineNum, field: 'NOME', itemCode: eq.code, message: 'Nome da chopeira obrigatório não informado.' });
                  }
                  newEquipments.push(eq);
                });
              }
            }
          }
        } else {
          // CSV / TXT com delimitador ; ou ,
          const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          if (rawLines.length < 2) {
            errors.push({ line: 1, field: 'ARQUIVO', message: 'O arquivo CSV deve conter a linha de cabeçalho e pelo menos 1 linha de dados preenchida.' });
          } else {
            const delimiter = rawLines[0].includes(';') ? ';' : ',';
            const headers = rawLines[0].split(delimiter).map(h => h.trim().toUpperCase().replace(/^"|"$/g, ''));

            const colIndex = (keys: string[]) => {
              return headers.findIndex(h => keys.some(k => h.includes(k)));
            };

            const idxBase = colIndex(['BASE', 'FILIAL', 'UNIDADE', 'BRANCH']);
            const idxTipo = colIndex(['TIPO', 'TYPE']);
            const idxCodigo = colIndex(['CODIGO', 'CÓDIGO', 'CODE']);
            const idxPatrimonio = colIndex(['PATRIMONIO', 'PATRIMÔNIO', 'PAT']);
            const idxNome = colIndex(['NOME', 'DESCRICAO', 'DESCRIÇÃO', 'NAME']);
            const idxCategoria = colIndex(['CATEGORIA', 'CATEGORY']);
            const idxSubOpcao = colIndex(['SUBOPCAO', 'SUBOPÇÃO', 'MARCA', 'BRAND']);
            const idxModelo = colIndex(['MODELO', 'MODEL']);
            const idxIdt = colIndex(['IDT', 'IDENTIDADE', 'IDENTITY']);
            const idxVoltagem = colIndex(['VOLTAGEM', 'VOLTAGE', 'VOLTS']);
            const idxDefeito = colIndex(['DEFEITO', 'DEFEITOS', 'DEFEITOS_DOS_EQUIPAMENTOS', 'DAMAGE']);
            const idxObs = colIndex(['OBS', 'OBSERVACOES', 'OBSERVAÇÕES', 'OBSERVACAO', 'OBSERVAÇÃO', 'OBSERVATION', 'OBSERVATIONS']);

            // EXIGÊNCIA: O arquivo baixado tem que ter a coluna "base" para preencher para qual base será importada,
            // o app só aceitará o arquivo com a base preenchida de acordo com a seleção da base no momento da importação.
            if (idxBase === -1) {
              errors.push({
                line: 1,
                field: 'BASE',
                message: `Coluna "BASE" não encontrada no cabeçalho do arquivo. O arquivo só pode ser aceito com a coluna "BASE". Baixe o modelo padrão atualizado.`
              });
            }

            // Se o cabeçalho não tem TIPO, assume conforme o estoque escolhido na importação
            const defaultTipo = targetImportStock === 'materiais' ? 'material' : 'freezer';

            for (let i = 1; i < rawLines.length; i++) {
              const lineNum = i + 1;
              const cols = rawLines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
              if (cols.length < 2 && cols.join('').length === 0) continue;

              const getVal = (idx: number) => idx >= 0 && idx < cols.length ? cols[idx].trim() : '';

              const baseRaw = idxBase >= 0 ? getVal(idxBase) : '';
              const tipoRaw = idxTipo >= 0 ? getVal(idxTipo).toLowerCase() : (getVal(0).toLowerCase() || defaultTipo);
              const codigo = idxCodigo >= 0 ? getVal(idxCodigo) : (idxTipo >= 0 ? getVal(1) : getVal(0));
              const patrimonio = idxPatrimonio >= 0 ? getVal(idxPatrimonio) : '';
              const nome = idxNome >= 0 ? getVal(idxNome) : getVal(3) || getVal(2);
              const categoria = idxCategoria >= 0 ? getVal(idxCategoria) : '';
              const subOpcao = idxSubOpcao >= 0 ? getVal(idxSubOpcao) : '';
              const modelo = idxModelo >= 0 ? getVal(idxModelo) : '';
              const idtRaw = idxIdt >= 0 ? getVal(idxIdt) : '';
              const voltagem = idxVoltagem >= 0 ? getVal(idxVoltagem) : '';
              const defeito = idxDefeito >= 0 ? getVal(idxDefeito) : '';
              const observacao = idxObs >= 0 ? getVal(idxObs) : '';

              // 0. Validação da Coluna BASE: obrigatória e deve coincidir com a seleção da base no momento da importação
              if (!baseRaw || baseRaw.replace(/\s/g, '').length === 0) {
                errors.push({
                  line: lineNum,
                  field: 'BASE',
                  itemCode: codigo || undefined,
                  message: `Campo obrigatório "BASE" está em branco. Preencha com "${targetImportBranch}".`
                });
              } else {
                const cleanBase = baseRaw.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, '');
                let itemBranch: UnitBranch | null = null;
                if (cleanBase.includes('PAULO') || cleanBase.includes('AFONSO')) itemBranch = isCoringa ? toTestBranch('PAULO AFONSO') : 'PAULO AFONSO';
                else if (cleanBase.includes('DELMIRO') || cleanBase.includes('GOUVEIA')) itemBranch = isCoringa ? toTestBranch('DELMIRO') : 'DELMIRO';

                if (!itemBranch || itemBranch !== targetImportBranch) {
                  errors.push({
                    line: lineNum,
                    field: 'BASE',
                    itemCode: codigo || undefined,
                    message: `A base preenchida nesta linha ("${baseRaw}") não coincide com a base selecionada para importação ("${targetImportBranch}"). O app só aceita o arquivo com a base preenchida de acordo com a seleção no momento da importação.`
                  });
                }
              }

              let cleanTipo = tipoRaw.toLowerCase();
              if (cleanTipo === 'padrão' || cleanTipo === 'padrao' || cleanTipo === 'slim') {
                cleanTipo = 'freezer';
              }

              // 1. Validação de Compatibilidade com o Estoque Escolhido
              if (targetImportStock === 'materiais') {
                if (['freezer', 'frz', 'equipamento', 'chopeira', 'eq'].includes(cleanTipo)) {
                  errors.push({
                    line: lineNum,
                    field: 'TIPO',
                    itemCode: codigo || undefined,
                    message: `Você selecionou importar para o estoque de Materiais, mas este item é do tipo Equipamento ("${tipoRaw}").`
                  });
                } else if (!cleanTipo || !['material', 'mat'].includes(cleanTipo)) {
                  cleanTipo = 'material';
                }
              } else {
                // targetImportStock === 'equipamentos'
                if (['material', 'mat'].includes(cleanTipo)) {
                  errors.push({
                    line: lineNum,
                    field: 'TIPO',
                    itemCode: codigo || undefined,
                    message: `Você selecionou importar para o estoque de Equipamentos, mas este item é do tipo Material ("${tipoRaw}").`
                  });
                } else if (!cleanTipo || !['freezer', 'frz', 'equipamento', 'chopeira', 'eq'].includes(cleanTipo)) {
                  cleanTipo = 'freezer';
                }
              }

              // 2. Validação de Código
              if (!codigo || codigo === '?' || codigo.replace(/\s/g, '').length === 0) {
                errors.push({
                  line: lineNum,
                  field: 'CODIGO',
                  message: 'Campo obrigatório "CODIGO" não informado ou em branco.'
                });
              }

              // 3. Validação de Nome
              if (!nome || nome.replace(/\s/g, '').length === 0) {
                errors.push({
                  line: lineNum,
                  field: 'NOME',
                  itemCode: codigo || undefined,
                  message: 'Campo obrigatório "NOME" do item está em branco.'
                });
              }

              // 4. Validação de Patrimônio para Equipamentos
              const isEquip = ['freezer', 'frz', 'equipamento', 'chopeira', 'eq'].includes(cleanTipo) || targetImportStock === 'equipamentos';
              if (isEquip) {
                if (!patrimonio || patrimonio.replace(/\s/g, '').length === 0) {
                  errors.push({
                    line: lineNum,
                    field: 'PATRIMONIO',
                    itemCode: codigo || undefined,
                    itemName: nome || undefined,
                    message: 'Campo "PATRIMONIO" é obrigatório para equipamentos (Freezers e Chopeiras).'
                  });
                }
              }

              // 5. Verificação de Duplicidades Internas dentro do Arquivo
              // EXIGÊNCIA: Aceitar itens com códigos iguais (materiais e equipamentos). Não aceitar patrimônios iguais.
              if (isEquip && patrimonio && patrimonio !== '0') {
                const normP = patrimonio.toUpperCase().trim();
                if (seenEquipPatrimonies.has(normP)) {
                  errors.push({
                    line: lineNum,
                    field: 'PATRIMONIO',
                    itemCode: codigo,
                    message: `Patrimônio [${patrimonio}] duplicado no próprio arquivo.`
                  });
                } else {
                  seenEquipPatrimonies.add(normP);
                }
              }

              // Montagem dos itens válidos
              const now = new Date().toISOString().slice(0, 10);
              const cleanDefect = defeito && defeito.trim() ? defeito.trim() : undefined;
              const cleanObs = observacao && observacao.trim() ? observacao.trim() : undefined;

              if (cleanTipo === 'material' || cleanTipo === 'mat') {
                newMaterials.push({
                  id: 'mat-imp-' + Date.now() + '-' + i,
                  code: (codigo || '').toUpperCase().trim(),
                  name: nome || `Material ${codigo}`,
                  category: (categoria as any) || 'mesa_plastica',
                  subOption: subOpcao || undefined,
                  createdAt: now,
                });
              } else if (cleanTipo === 'freezer' || cleanTipo === 'frz') {
                const isSlimImported = tipoRaw.trim().toUpperCase() === 'SLIM' || nome.toUpperCase().includes('SLIM');
                const cleanIdt = idtRaw && idtRaw.trim() ? idtRaw.trim().toUpperCase() : undefined;
                newFreezers.push({
                  id: 'frz-imp-' + Date.now() + '-' + i,
                  code: (codigo || '').toUpperCase().trim(),
                  patrimony: (patrimonio || `PAT-${codigo}`).toUpperCase().trim(),
                  name: nome || `Freezer ${codigo || patrimonio}`,
                  brand: subOpcao || 'Metalfrio',
                  model: modelo || 'Padrão',
                  tipo: isSlimImported ? 'SLIM' : 'PADRÃO',
                  isSlim: isSlimImported,
                  identity: cleanIdt,
                  voltage: (voltagem as any) || '220V',
                  defect: cleanDefect,
                  observations: cleanObs,
                  createdAt: now,
                });
              } else if (cleanTipo === 'equipamento' || cleanTipo === 'chopeira' || cleanTipo === 'eq') {
                const eqType = modelo?.toLowerCase().includes('2') || subOpcao?.toLowerCase().includes('2') 
                  ? 'chopeira_2_torneiras' 
                  : 'chopeira_1_torneira';

                newEquipments.push({
                  id: 'eq-imp-' + Date.now() + '-' + i,
                  code: (codigo || '').toUpperCase().trim(),
                  patrimony: (patrimonio || `PAT-${codigo}`).toUpperCase().trim(),
                  name: nome || `Chopeira ${codigo || patrimonio}`,
                  brand: subOpcao || 'Memo',
                  voltage: (voltagem as any) || '220V',
                  type: eqType,
                  defect: cleanDefect,
                  observations: cleanObs,
                  createdAt: now,
                });
              }
            }
          }
        }

        // EXIGÊNCIA 5: caso não passe na verificação, mostrar os campos que precisam de atenção e não importar o arquivo
        if (errors.length > 0) {
          setValidationErrorsList(errors);
          setIsValidationErrorModalOpen(true);
          return;
        }

        const totalImported = newMaterials.length + newFreezers.length + newEquipments.length;
        if (totalImported === 0) {
          errors.push({ line: 1, field: 'DADOS', message: 'Nenhum item válido identificado no arquivo para importar.' });
          setValidationErrorsList(errors);
          setIsValidationErrorModalOpen(true);
          return;
        }

        const parsedData: ParsedImportData = {
          materials: newMaterials,
          freezers: newFreezers,
          equipments: newEquipments,
        };

        const stockType = targetImportStock;
        setDetectedStockType(stockType);

        // Caso a base do cadastro do tipo selecionado esteja limpa:
        // verificar antes da importação se todos os campos estão com os dados corretos (já validado acima, sem erros)
        // caso sim, importar as informações direto sem perguntar
        const isBaseClean = stockType === 'materiais' 
          ? materials.length === 0 
          : (freezers.length === 0 && equipments.length === 0);

        if (isBaseClean) {
          // Base limpa: importa direto com substituição limpa sem perguntar
          const result = importBaseItems(parsedData, 'replace', stockType, targetImportBranch);
          setImportStatus(result.message);
          showToast(`Base de ${stockType === 'materiais' ? 'Materiais' : 'Equipamentos'} (${targetImportBranch}) alimentada diretamente com sucesso (${totalImported} itens importados)!`);
          return;
        }

        // Base já possui itens cadastrados: perguntar "Substituir a Base" ou "Acrescentar a Base"
        setPendingParsedData(parsedData);
        setIsImportChoiceModalOpen(true);

    } catch (err: any) {
      setValidationErrorsList([{ line: 1, field: 'ARQUIVO', message: err.message || 'Erro ao processar o arquivo enviado.' }]);
      setIsValidationErrorModalOpen(true);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        processImportedFileText(text, file.name);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  /**
   * Escolha 1: Substituir a Base
   * caso seja selecionado o botão "Substituir a Base", toda o cadastro da base do tipo de estoque selecionado
   * será apagado e limpo da base, adicionando todas as informações novas do arquivo importado.
   */
  const handleExecuteReplaceBase = () => {
    if (!pendingParsedData) return;

    const labelStock = targetImportStock === 'materiais' 
      ? 'Materiais' 
      : 'Equipamentos (Freezers e Chopeiras)';

    if (!confirm(`Atenção: Todo o cadastro da base de ${labelStock} (${targetImportBranch}) será apagado e limpo da base, adicionando todas as novas informações do arquivo importado.\n\nDeseja prosseguir com a substituição da base?`)) {
      return;
    }

    const result = importBaseItems(pendingParsedData, 'replace', targetImportStock, targetImportBranch);
    setIsImportChoiceModalOpen(false);
    setPendingParsedData(null);
    setImportStatus(result.message);
    showToast(`Base de ${labelStock} substituída com sucesso!`);
  };

  /**
   * Escolha 2: Acrescentar a Base
   * EXIGÊNCIA: se a escolha for Acrescentar a Base, verificar todos os itens do arquivo antes da importação
   * para verificar se existe códigos ou patrimônio iguais com o que já está cadastro na base,
   * se tiver, aparecer janela para a gestão desses itens antes da importação.
   */
  const handleStartAppendProcess = () => {
    if (!pendingParsedData) return;

    const conflicts: ImportConflict[] = [];
    const nonConflictingMats: MaterialItem[] = [];
    const nonConflictingFrzs: FreezerItem[] = [];
    const nonConflictingEqs: EquipmentItem[] = [];

    // Helper para comparar códigos
    const norm = (val?: string) => val ? val.trim().toUpperCase() : '';
    const normDigits = (val?: string) => val ? val.replace(/\D/g, '') : '';

    // 1. Verificar Materiais (conflito apenas quando código E nome/subopção são idênticos)
    pendingParsedData.materials.forEach(inMat => {
      const existing = materials.find(m => 
        norm(m.code) === norm(inMat.code) && 
        norm(m.code) !== '0' && 
        norm(m.code) !== '' &&
        norm(m.name) === norm(inMat.name) &&
        norm(m.subOption) === norm(inMat.subOption)
      );
      if (existing) {
        conflicts.push({
          id: `conflict-mat-${inMat.id}`,
          itemType: 'material',
          conflictReasons: [`Material com mesmo código e modelo já cadastrado: [${inMat.code}] ${inMat.name}`],
          incomingItem: inMat,
          existingItem: existing,
          resolution: 'replace', // padrão: atualizar com os dados do arquivo
        });
      } else {
        nonConflictingMats.push(inMat);
      }
    });

    // 2. Verificar Freezers (conflito estritamente por patrimônio; aceitar códigos iguais)
    pendingParsedData.freezers.forEach(inFrz => {
      const patMatch = freezers.find(f => 
        norm(f.patrimony) === norm(inFrz.patrimony) || 
        (normDigits(inFrz.patrimony).length >= 3 && normDigits(f.patrimony) === normDigits(inFrz.patrimony))
      );

      if (patMatch) {
        conflicts.push({
          id: `conflict-frz-${inFrz.id}`,
          itemType: 'freezer',
          conflictReasons: [`Patrimônio de freezer já cadastrado: [${inFrz.patrimony}]`],
          incomingItem: inFrz,
          existingItem: patMatch,
          resolution: 'replace',
        });
      } else {
        nonConflictingFrzs.push(inFrz);
      }
    });

    // 3. Verificar Chopeiras (conflito estritamente por patrimônio; aceitar códigos iguais)
    pendingParsedData.equipments.forEach(inEq => {
      const patMatch = equipments.find(e => 
        norm(e.patrimony) === norm(inEq.patrimony) || 
        (normDigits(inEq.patrimony).length >= 3 && normDigits(e.patrimony) === normDigits(inEq.patrimony))
      );

      if (patMatch) {
        conflicts.push({
          id: `conflict-eq-${inEq.id}`,
          itemType: 'equipamento',
          conflictReasons: [`Patrimônio de chopeira já cadastrado: [${inEq.patrimony}]`],
          incomingItem: inEq,
          existingItem: patMatch,
          resolution: 'replace',
        });
      } else {
        nonConflictingEqs.push(inEq);
      }
    });

    setNonConflictingData({
      materials: nonConflictingMats,
      freezers: nonConflictingFrzs,
      equipments: nonConflictingEqs,
    });

    // Se houver conflitos, abre a janela dedicada de gestão antes de importar
    if (conflicts.length > 0) {
      setConflictsList(conflicts);
      setIsImportChoiceModalOpen(false);
      setIsConflictModalOpen(true);
    } else {
      // Se não houver conflitos, acrescenta diretamente à base
      const result = importBaseItems(pendingParsedData, 'append', detectedStockType, targetImportBranch);
      setIsImportChoiceModalOpen(false);
      setPendingParsedData(null);
      setImportStatus(result.message);
      showToast(`Itens acrescentados à base (${targetImportBranch}) com sucesso!`);
    }
  };

  /**
   * Resolução em massa de conflitos
   */
  const handleSetAllConflictResolution = (resolution: 'replace' | 'keep') => {
    setConflictsList(prev => prev.map(c => ({ ...c, resolution })));
  };

  /**
   * Resolução individual de conflito
   */
  const handleToggleConflictResolution = (conflictId: string, resolution: 'replace' | 'keep') => {
    setConflictsList(prev => prev.map(c => c.id === conflictId ? { ...c, resolution } : c));
  };

  /**
   * Confirmação final da importação com os conflitos gerenciados
   */
  const handleConfirmConflictImport = () => {
    // 1. Monta lista final de materiais
    const finalMats = [...materials];
    conflictsList.filter(c => c.itemType === 'material').forEach(c => {
      const inItem = c.incomingItem as MaterialItem;
      const exIndex = finalMats.findIndex(m => m.id === c.existingItem.id);
      if (c.resolution === 'replace' && exIndex >= 0) {
        finalMats[exIndex] = { ...inItem, id: c.existingItem.id };
      }
    });
    finalMats.push(...nonConflictingData.materials);

    // 2. Monta lista final de freezers
    const finalFrzs = [...freezers];
    conflictsList.filter(c => c.itemType === 'freezer').forEach(c => {
      const inItem = c.incomingItem as FreezerItem;
      const exIndex = finalFrzs.findIndex(f => f.id === c.existingItem.id);
      if (c.resolution === 'replace' && exIndex >= 0) {
        finalFrzs[exIndex] = { ...inItem, id: c.existingItem.id };
      }
    });
    finalFrzs.push(...nonConflictingData.freezers);

    // 3. Monta lista final de chopeiras
    const finalEqs = [...equipments];
    conflictsList.filter(c => c.itemType === 'equipamento').forEach(c => {
      const inItem = c.incomingItem as EquipmentItem;
      const exIndex = finalEqs.findIndex(e => e.id === c.existingItem.id);
      if (c.resolution === 'replace' && exIndex >= 0) {
        finalEqs[exIndex] = { ...inItem, id: c.existingItem.id };
      }
    });
    finalEqs.push(...nonConflictingData.equipments);

    // Salva na base substituindo pelo conjunto final mesclado e resolvido
    const result = importBaseItems({
      materials: finalMats,
      freezers: finalFrzs,
      equipments: finalEqs,
    }, 'replace', undefined, targetImportBranch);

    setIsConflictModalOpen(false);
    setPendingParsedData(null);
    setConflictsList([]);
    setImportStatus(result.message);
    showToast(`Importação concluída com sucesso na base (${targetImportBranch}) após a gestão de conflitos!`);
  };

  // Identificador de itens não cadastrados previamente (código provisório '0' ou vazio)
  const isUnregistered = (code?: string) => !code || code.trim() === '' || code.trim() === '0';

  const unregisteredMaterials = materials.filter(m => isUnregistered(m.code));
  const registeredMaterials = materials.filter(m => !isUnregistered(m.code));
  const unregisteredFreezers = freezers.filter(f => isUnregistered(f.code));
  const registeredFreezers = freezers.filter(f => !isUnregistered(f.code));
  const unregisteredEquipments = equipments.filter(eq => isUnregistered(eq.code));
  const registeredEquipments = equipments.filter(eq => !isUnregistered(eq.code));

  const totalNaoCadastrados = unregisteredMaterials.length + unregisteredFreezers.length + unregisteredEquipments.length;
  const totalCadastrosOficiais = registeredMaterials.length + registeredFreezers.length + registeredEquipments.length;

  // Lista unificada para gestão
  const allItems: Array<{
    id: string;
    itemType: 'material' | 'freezer' | 'equipamento';
    code: string;
    name: string;
    subDetails: string;
    defect?: string;
    isUnregistered: boolean;
    rawItem: any;
  }> = [
    ...materials.map(m => {
      const cat = CATEGORIAS_MATERIAIS.find(c => c.id === m.category);
      return {
        id: m.id,
        itemType: 'material' as const,
        code: m.code,
        name: m.name,
        subDetails: `${cat?.label || 'Material'} ${m.description ? `• ${m.description}` : ''}`,
        defect: undefined,
        isUnregistered: isUnregistered(m.code),
        rawItem: m
      };
    }),
    ...freezers.map(f => ({
      id: f.id,
      itemType: 'freezer' as const,
      code: f.code,
      name: f.name,
      subDetails: `Patrimônio: ${f.patrimony} • ${f.brand} • ${f.model}${f.identity ? ` • IDT: ${f.identity}` : ''} • ${f.voltage}`,
      defect: f.defect?.trim() || undefined,
      isUnregistered: isUnregistered(f.code),
      rawItem: f
    })),
    ...equipments.map(eq => ({
      id: eq.id,
      itemType: 'equipamento' as const,
      code: eq.code,
      name: eq.name,
      subDetails: `Patrimônio: ${eq.patrimony} • ${eq.type === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras'} • ${eq.voltage}`,
      defect: eq.defect?.trim() || undefined,
      isUnregistered: isUnregistered(eq.code),
      rawItem: eq
    })),
  ];

  // Itens não cadastrados correspondentes à busca
  const matchingUnregisteredItems = allItems.filter(item => {
    if (!item.isUnregistered) return false;
    const matchesSearch = 
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.defect && item.defect.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const matchingUnregisteredMaterials = matchingUnregisteredItems.filter(i => i.itemType === 'material');

  const filteredItems = allItems.filter(item => {
    const matchesSearch = 
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.defect && item.defect.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    // Filtro especial para não cadastrados
    if (filterType === 'nao_cadastrados') {
      // Materiais não cadastrados são exibidos no bloco de destaque separado acima
      return item.isUnregistered && item.itemType !== 'material';
    }

    // Na lista geral de itens registrados, oculta os não cadastrados
    if (item.isUnregistered) return false;

    if (filterType === 'materiais') return item.itemType === 'material';
    if (filterType === 'freezers') return item.itemType === 'freezer';
    if (filterType === 'equipamentos') return item.itemType === 'equipamento';
    return true;
  });

  // EXIGÊNCIA 7: Na tela Cadastro, exibir os itens Freezers e Chopeiras por ordem crescente de patrimônio,
  // já os materiais, exibir da mesma forma que o campo "PRÉVIA DO RELATÓRIO", da contagem de Materiais.
  const MATERIAL_TYPE_PRIORITY: Record<string, number> = {
    mesa_madeira: 1,
    cadeira_madeira: 2,
    mesa_plastica: 3,
    cadeira_plastica_com_braco: 4,
    cadeira_plastica_sem_braco: 5,
    caixa_termica: 6,
    barril: 7,
    co2: 8,
  };

  const getMaterialTypePriority = (m: MaterialItem): number => {
    if (m.category && MATERIAL_TYPE_PRIORITY[m.category] !== undefined) {
      return MATERIAL_TYPE_PRIORITY[m.category];
    }
    const upper = (m.name || '').toUpperCase();
    if (upper.includes('MESA') && upper.includes('MADEIRA')) return 1;
    if (upper.includes('CADEIRA') && upper.includes('MADEIRA')) return 2;
    if (upper.includes('MESA') && (upper.includes('PLÁSTICA') || upper.includes('PLASTICA'))) return 3;
    if (upper.includes('CADEIRA') && (upper.includes('PLÁSTICA') || upper.includes('PLASTICA')) && upper.includes('COM BRAÇO')) return 4;
    if (upper.includes('CADEIRA') && (upper.includes('PLÁSTICA') || upper.includes('PLASTICA')) && upper.includes('SEM BRAÇO')) return 5;
    if (upper.includes('CAIXA') && (upper.includes('TÉRMICA') || upper.includes('TERMICA'))) return 6;
    if (upper.includes('BARRIL')) return 7;
    if (upper.includes('CO2') || upper.includes('CILINDRO')) return 8;
    return 99;
  };

  const sortMaterialsLikeReport = (a: MaterialItem, b: MaterialItem): number => {
    const prioA = getMaterialTypePriority(a);
    const prioB = getMaterialTypePriority(b);
    if (prioA !== prioB) return prioA - prioB;
    const nameComp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    if (nameComp !== 0) return nameComp;
    return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
  };

  const sortedItems = [...filteredItems].sort((a, b) => {
    // 1. Materiais: mesma ordenação da Prévia do Relatório (Tipo por prioridade e alfabética crescente)
    if (a.itemType === 'material' && b.itemType === 'material') {
      return sortMaterialsLikeReport(a.rawItem as MaterialItem, b.rawItem as MaterialItem);
    }
    // 2. Freezers: ordem crescente de patrimônio
    if (a.itemType === 'freezer' && b.itemType === 'freezer') {
      const patA = (a.rawItem as FreezerItem)?.patrimony || '';
      const patB = (b.rawItem as FreezerItem)?.patrimony || '';
      return patA.localeCompare(patB, undefined, { numeric: true, sensitivity: 'base' });
    }
    // 3. Chopeiras: ordem crescente de patrimônio
    if (a.itemType === 'equipamento' && b.itemType === 'equipamento') {
      const patA = (a.rawItem as EquipmentItem)?.patrimony || '';
      const patB = (b.rawItem as EquipmentItem)?.patrimony || '';
      return patA.localeCompare(patB, undefined, { numeric: true, sensitivity: 'base' });
    }
    // Se for visualização mista ("all"): primeiro materiais, depois freezers, depois chopeiras
    const typeOrder = { material: 1, freezer: 2, equipamento: 3 };
    return typeOrder[a.itemType] - typeOrder[b.itemType];
  });

  const handleDelete = (item: typeof allItems[0]) => {
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.');
      return;
    }

    const itemLabel = `${item.itemType.toUpperCase()} [${item.code}] - ${item.name}`;
    if (!confirm(`Deseja realmente excluir permanentemente o item:\n\n${itemLabel} da base de cadastros?\n\nTodo o cadastro e histórico do mesmo serão eliminados permanentemente.`)) {
      return;
    }

    if (item.isUnregistered && item.itemType !== 'material') {
      deleteUnregisteredItemEntireHistory(item.rawItem?.patrimony || item.code, item.id);
    }

    if (item.itemType === 'material') {
      deleteMaterial(item.id);
    } else if (item.itemType === 'freezer') {
      deleteFreezer(item.id);
    } else {
      deleteEquipment(item.id);
    }

    showToast(`Item ${item.code} excluído da base e histórico limpo com sucesso!`);
  };

  const handleEditItem = (item: typeof allItems[0]) => {
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.');
      return;
    }

    if (item.itemType === 'material') {
      onEditMaterial(item.rawItem);
    } else if (item.itemType === 'freezer') {
      onEditFreezer(item.rawItem);
    } else {
      onEditEquipment(item.rawItem);
    }
  };

  const handleCreateMaterial = () => {
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.');
      return;
    }
    onOpenCreateMaterial();
  };

  const handleCreateFreezer = () => {
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.');
      return;
    }
    onOpenCreateFreezer();
  };

  const handleCreateEquipment = () => {
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.');
      return;
    }
    onOpenCreateEquipment();
  };

  return (
    <div className="space-y-4 select-none pb-12">
      
      {/* Toast Feedback */}
      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Alerta de Contagem em Andamento para Master */}
      {isMaster && isAnyBaseCountInProgress && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm text-slate-900 flex items-center gap-3 animate-in fade-in">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-xs">
            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-950 leading-tight">
              Existe contagem em andamento.
            </p>
            <p className="text-[11px] text-amber-900 mt-0.5">
              O cadastro de Materiais e Equipamentos está em modo somente leitura na base {activeBranch} até o envio do estoque por e-mail.
            </p>
          </div>
        </div>
      )}

      {/* Header Informativo */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center border border-purple-200">
            <Database className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Gestão de Cadastros da Base
            </h2>
            {isMaster && (
              <p className="text-[11px] font-semibold mt-0.5">
                {isCoringa ? (
                  <span className="text-indigo-700">
                    Modo Teste (CORINGA): alterações salvas somente localmente na base {activeBranch} (sem envio ao Firebase).
                  </span>
                ) : hasPendingMasterSync ? (
                  <span className="text-amber-700">
                    Alterações locais pendentes na base {activeBranch} — clique em &quot;Sincronizar Dados&quot; para enviar ao Firebase.
                  </span>
                ) : lastFirebaseSyncAt ? (
                  <span className="text-emerald-700">
                    Última sincronização com Firebase às {lastFirebaseSyncAt}.
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Sincronização manual da base {activeBranch} com o Firebase.
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Botões Master: Sincronizar Dados e Zerar Cadastros */}
        {isMaster && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={async () => {
                if (isSyncingFirebase) return;
                if (isAnyBaseCountInProgress || isContadorActive) {
                  showToast('Existe contagem em andamento.');
                  return;
                }
                setIsSyncingFirebase(true);
                try {
                  const res = await syncMasterDataToFirebase();
                  showToast(res.message);
                } finally {
                  setIsSyncingFirebase(false);
                }
              }}
              disabled={isSyncingFirebase || isAnyBaseCountInProgress || isContadorActive}
              className={`px-3.5 py-2 border rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-xs ${
                hasPendingMasterSync
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
              }`}
              title={`Sincronizar dados da base ${activeBranch} com o Firebase`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
              <span>{isSyncingFirebase ? 'Sincronizando...' : 'Sincronizar Dados'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAnyBaseCountInProgress || isContadorActive) {
                  showToast('Existe contagem em andamento.');
                  return;
                }
                setClearBranchTarget(activeBranch);
                setClearStockTarget('ambos');
                setConfirmClearOpen(true);
              }}
              disabled={isAnyBaseCountInProgress || isContadorActive}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
              title="Escolher e zerar cadastros da base"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Zerar Cadastros</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal de Seleção e Confirmação para Zerar Cadastros */}
      {confirmClearOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5 text-rose-600 font-extrabold text-sm sm:text-base">
                <div className="w-9 h-9 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <span className="block text-slate-900">Zerar Cadastros</span>
                  <span className="block text-[11px] font-semibold text-rose-700">
                    Escolha qual cadastro e qual base deseja zerar
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Seleção da Base */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-rose-600" />
                <span>Base de Destino:</span>
              </span>
              <div className="grid grid-cols-3 gap-2">
                {selectableBranches.map((branchOpt, idx) => (
                  <button
                    key={branchOpt}
                    type="button"
                    onClick={() => setClearBranchTarget(branchOpt)}
                    className={`p-2 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
                      clearBranchTarget === branchOpt
                        ? idx === 0
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-300'
                          : 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {branchOpt}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setClearBranchTarget('AMBAS')}
                  className={`p-2 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
                    clearBranchTarget === 'AMBAS'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-300'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  AMBAS AS BASES
                </button>
              </div>
            </div>

            {/* Escolha de qual cadastro deseja zerar */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                Qual cadastro deseja zerar?
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setClearStockTarget('materiais')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    clearStockTarget === 'materiais'
                      ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center mb-1.5">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block uppercase">Materiais</span>
                    <span className="text-[10px] text-slate-600 block leading-tight mt-0.5">
                      Zera apenas os materiais cadastrados.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setClearStockTarget('equipamentos')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    clearStockTarget === 'equipamentos'
                      ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-1.5">
                    <Snowflake className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block uppercase">Equipamentos</span>
                    <span className="text-[10px] text-slate-600 block leading-tight mt-0.5">
                      Zera apenas freezers e chopeiras cadastrados.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setClearStockTarget('ambos')}
                  className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                    clearStockTarget === 'ambos'
                      ? 'border-rose-500 bg-rose-50 ring-2 ring-rose-200 shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-1.5">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block uppercase">Ambos</span>
                    <span className="text-[10px] text-slate-600 block leading-tight mt-0.5">
                      Zera materiais e equipamentos juntos.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 leading-relaxed">
              Esta ação excluirá permanentemente o cadastro de{' '}
              <strong>
                {clearStockTarget === 'materiais'
                  ? 'Materiais'
                  : clearStockTarget === 'equipamentos'
                    ? 'Equipamentos (Freezers e Chopeiras)'
                    : 'Materiais e Equipamentos'}
              </strong>{' '}
              na base{' '}
              <strong>
                {clearBranchTarget === 'AMBAS' ? selectableBranches.join(' e ') : clearBranchTarget}
              </strong>
              {isCoringa ? (
                <> (somente nas bases de teste locais, sem alterar o Firebase).</>
              ) : (
                <>
                  . Após confirmar, clique em <strong>&quot;Sincronizar Dados&quot;</strong> para atualizar o Firebase.
                </>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearSelectedData(clearStockTarget, clearBranchTarget);
                  setConfirmClearOpen(false);
                  const stockText =
                    clearStockTarget === 'materiais'
                      ? 'de Materiais'
                      : clearStockTarget === 'equipamentos'
                        ? 'de Equipamentos'
                        : 'de Materiais e Equipamentos';
                  const branchText =
                    clearBranchTarget === 'AMBAS' ? selectableBranches.join(' e ') : clearBranchTarget;
                  showToast(`Cadastro ${stockText} zerado na base ${branchText}.`);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs"
              >
                Sim, Zerar Cadastro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CAMPO GESTÃO DO CADASTRO EM MASSA DOS ITENS DA BASE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider block">
                Gestão do Cadastro em Massa dos Itens da Base
              </span>
            </div>
          </div>
        </div>

        {/* Botões: Baixar Arquivo, Exportar, Importar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* 1. Baixar Arquivo */}
          <button
            type="button"
            onClick={() => setIsDownloadChoiceModalOpen(true)}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl text-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs font-bold shadow-2xs cursor-pointer"
            title="Baixar planilha modelo padrão (Materiais ou Equipamentos com Defeitos)"
          >
            <Download className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Baixar Arquivo</span>
          </button>

          {/* 2. Exportar */}
          <button
            type="button"
            onClick={() => setIsExportStockModalOpen(true)}
            className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 rounded-xl text-emerald-900 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs font-bold shadow-2xs cursor-pointer"
            title="Exportar todos os itens cadastrados atualmente na base"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Exportar</span>
          </button>

          {/* 3. Importar */}
          <button
            type="button"
            onClick={() => {
              if (isMaster && isContadorActive) {
                showToast('Existe usuário realizando contagem no momento.');
                return;
              }
              setIsImportStockModalOpen(true);
            }}
            disabled={isMaster && isContadorActive}
            className="p-3 bg-purple-50 hover:bg-purple-100 disabled:opacity-50 border border-purple-200 hover:border-purple-300 rounded-xl text-purple-900 transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-xs font-bold shadow-2xs cursor-pointer"
            title="Importar planilha de itens para a base"
          >
            <Upload className="w-4 h-4 text-purple-700 shrink-0" />
            <span>Importar</span>
          </button>
        </div>

        {/* Input file invisível */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImportFile} 
          accept=".csv,.txt,.json" 
          className="hidden" 
        />

        {importStatus && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{importStatus}</span>
          </div>
        )}
      </div>

      {/* EXIGÊNCIA 4: MODAL DE ESCOLHA DO TIPO DE ESTOQUE PARA BAIXAR PLANILHA PADRÃO */}
      {isDownloadChoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center border border-indigo-200 shrink-0">
                  <Download className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Baixar Planilha Modelo Padrão
                  </h3>
                  <p className="text-xs text-slate-500">
                    Arquivo com coluna obrigatória "BASE" para preenchimento
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsDownloadChoiceModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Seleção da Base de Referência para o Modelo */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Base de Referência no Arquivo:</span>
                </span>
                <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  Coluna BASE preenchida
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {selectableBranches.map((branchOpt, idx) => (
                  <button
                    key={branchOpt}
                    type="button"
                    onClick={() => setTargetDownloadBranch(branchOpt)}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      targetDownloadBranch === branchOpt
                        ? idx === 0
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-300'
                          : 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{branchOpt}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 leading-tight">
                O arquivo baixado conterá a coluna <strong>BASE</strong> preenchida com <strong>{targetDownloadBranch}</strong>. Ao importar, o app validará se a coluna BASE coincide com a seleção feita no momento da importação.
              </p>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Para qual tipo de estoque você deseja baixar a planilha com todos os campos completos padrões para alimentação da base?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Botão Materiais */}
              <button
                type="button"
                onClick={() => handleDownloadMaterialsTemplate(targetDownloadBranch)}
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
                    Campos: Base, Tipo, Código, Nome, Categoria, Subopção, Unidade.
                  </span>
                </div>
              </button>

              {/* Botão Equipamentos */}
              <button
                type="button"
                onClick={() => handleDownloadEquipmentsTemplate(targetDownloadBranch)}
                className="p-3.5 rounded-2xl border-2 border-sky-300 bg-sky-50/70 hover:bg-sky-100 hover:border-sky-500 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-2 shadow-xs">
                  <Snowflake className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-sky-950 block uppercase tracking-wide">
                    Equipamentos
                  </span>
                  <span className="text-[10px] text-sky-800 mt-0.5 block leading-tight">
                    Campos: Base, Código, Patrimônio, Nome, Marca, Modelo, Tipo, IDT, Voltagem, Defeitos, OBS.
                  </span>
                </div>
              </button>

              {/* EXIGÊNCIA: Botão AMBOS */}
              <button
                type="button"
                onClick={() => handleDownloadBothTemplates(targetDownloadBranch)}
                className="p-3.5 rounded-2xl border-2 border-purple-300 bg-purple-50/70 hover:bg-purple-100 hover:border-purple-500 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-2 shadow-xs">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-purple-950 block uppercase tracking-wide">
                    AMBOS
                  </span>
                  <span className="text-[10px] text-purple-800 mt-0.5 block leading-tight">
                    Baixar os 2 arquivos dos estoques de vez, em arquivos separados (com coluna BASE).
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDownloadChoiceModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIGÊNCIA 1: MODAL DE ESCOLHA DO ESTOQUE E BASE PARA IMPORTAÇÃO */}
      {isImportStockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center border border-purple-200 shrink-0">
                  <Upload className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Importar Arquivo para a Base
                  </h3>
                  <p className="text-xs text-slate-500">
                    Defina a base e o estoque para importação
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsImportStockModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SELEÇÃO DA BASE NO MOMENTO DA IMPORTAÇÃO */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-purple-700" />
                  <span>1. Seleção da Base para Importação:</span>
                </label>
                <span className="text-[10px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  Obrigatório
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {selectableBranches.map((branchOpt, idx) => (
                  <button
                    key={branchOpt}
                    type="button"
                    onClick={() => setTargetImportBranch(branchOpt)}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      targetImportBranch === branchOpt
                        ? idx === 0
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-300'
                          : 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{branchOpt}</span>
                  </button>
                ))}
              </div>

              <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-950 leading-snug font-medium flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  O app só aceitará o arquivo com a coluna <strong>BASE</strong> preenchida exatamente com <strong>"{targetImportBranch}"</strong> em todas as linhas.
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-800 block">
                2. Selecione o Tipo de Estoque:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setTargetImportStock('materiais');
                    setIsImportStockModalOpen(false);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
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
                      Mesas, Cadeiras, Barris, CO2 ({targetImportBranch}).
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetImportStock('equipamentos');
                    setIsImportStockModalOpen(false);
                    setTimeout(() => fileInputRef.current?.click(), 100);
                  }}
                  className="p-3.5 rounded-2xl border-2 border-sky-300 bg-sky-50/70 hover:bg-sky-100 hover:border-sky-500 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
                >
                  <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-2 shadow-xs">
                    <Snowflake className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-sky-950 block uppercase tracking-wide">
                      Equipamentos
                    </span>
                    <span className="text-[10px] text-sky-800 mt-0.5 block leading-tight">
                      Freezers e Chopeiras ({targetImportBranch}).
                    </span>
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsImportStockModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIGÊNCIA 4: MODAL DE ESCOLHA DO ESTOQUE PARA EXPORTAÇÃO (MATERIAIS, EQUIPAMENTOS, AMBOS) */}
      {isExportStockModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Exportar Cadastros da Base
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione de qual estoque deseja exportar os dados
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsExportStockModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              De qual estoque você deseja exportar a planilha com os cadastros atuais?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleExportStockSelection('materiais')}
                className="p-3.5 rounded-2xl border-2 border-amber-300 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-500 text-center transition-all active:scale-95 flex flex-col items-center justify-center group cursor-pointer shadow-xs gap-1.5"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-amber-950 block uppercase tracking-wide">
                  Materiais
                </span>
                <span className="text-[10px] text-amber-800 font-mono">
                  {materials.length} itens
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleExportStockSelection('equipamentos')}
                className="p-3.5 rounded-2xl border-2 border-sky-300 bg-sky-50/70 hover:bg-sky-100 hover:border-sky-500 text-center transition-all active:scale-95 flex flex-col items-center justify-center group cursor-pointer shadow-xs gap-1.5"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                  <Snowflake className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-sky-950 block uppercase tracking-wide">
                  Equipamentos
                </span>
                <span className="text-[10px] text-sky-800 font-mono">
                  {freezers.length + equipments.length} itens
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleExportStockSelection('ambos')}
                className="p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 hover:border-emerald-500 text-center transition-all active:scale-95 flex flex-col items-center justify-center group cursor-pointer shadow-xs gap-1.5"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Send className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-emerald-950 block uppercase tracking-wide">
                  Ambos
                </span>
                <span className="text-[10px] text-emerald-800 font-mono">
                  {materials.length + freezers.length + equipments.length} itens
                </span>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsExportStockModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Janela Modal: Cadastro sem informações a baixar */}
      {isNoDataExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Exportação da Base</h3>
                <p className="text-xs text-amber-700 font-semibold">Aviso do Sistema</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 font-bold leading-relaxed">
              {noDataExportMessage}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNoDataExportModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIGÊNCIA 5: MODAL DE ERROS DE VALIDAÇÃO (MOSTRAR CAMPOS QUE PRECISAM DE ATENÇÃO E NÃO IMPORTAR) */}
      {isValidationErrorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-rose-200 w-full max-w-2xl rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">
            
            <div className="p-4 border-b border-rose-100 bg-rose-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center border border-rose-300 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Arquivo Não Importado (Campos Incorretos Detectados)
                  </h3>
                  <p className="text-xs text-rose-800">
                    Foram identificados <strong>{validationErrorsList.length}</strong> campos com pendências ou dados incorretos no arquivo.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsValidationErrorModalOpen(false);
                  setValidationErrorsList([]);
                }}
                className="w-7 h-7 rounded-full bg-slate-200/70 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50/70 border-b border-amber-200 text-xs text-amber-950 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>O arquivo <strong>NÃO foi importado</strong> para garantir a integridade da base. Corrija os campos indicados abaixo na sua planilha e tente importar novamente.</span>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
              {validationErrorsList.map((err, idx) => (
                <div key={idx} className="p-3 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-3 shadow-2xs hover:border-rose-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Linha {err.line}
                      </span>
                      <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Campo: {err.field}
                      </span>
                      {err.itemCode && (
                        <span className="font-mono text-[11px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded">
                          Item: {err.itemCode}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 font-medium">
                      {err.message}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded shrink-0">
                    Atenção
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsValidationErrorModalOpen(false);
                  setValidationErrorsList([]);
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                Entendido / Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EXIGÊNCIA: MODAL DE ESCOLHA ENTRE "Substituir a Base" OU "Acrescentar a Base" */}
      {isImportChoiceModalOpen && pendingParsedData && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center border border-purple-200">
                  <Upload className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Importação de Itens para o APP
                  </h3>
                  <p className="text-xs text-slate-500">
                    Arquivo processado com sucesso: {pendingParsedData.materials.length} materiais, {pendingParsedData.freezers.length} freezers e {pendingParsedData.equipments.length} chopeiras
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsImportChoiceModalOpen(false);
                  setPendingParsedData(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              Como você deseja incorporar essas informações ao aplicativo? Escolha uma das opções abaixo:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Opção 1: Substituir a Base */}
              <button
                type="button"
                onClick={handleExecuteReplaceBase}
                className="p-4 rounded-2xl border-2 border-rose-200 bg-rose-50/70 hover:bg-rose-100 hover:border-rose-400 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center mb-3 shadow-xs">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-rose-950 block uppercase tracking-wide">
                    Substituir a Base
                  </span>
                  <span className="text-[11px] text-rose-800 mt-1 block leading-tight">
                    Toda a base atual será apagada e alimentada com as novas informações do arquivo.
                  </span>
                </div>
              </button>

              {/* Opção 2: Acrescentar a Base */}
              <button
                type="button"
                onClick={handleStartAppendProcess}
                className="p-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 hover:border-emerald-500 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-3 shadow-xs">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <span className="text-xs font-black text-emerald-950 block uppercase tracking-wide">
                    Acrescentar a Base
                  </span>
                  <span className="text-[11px] text-emerald-800 mt-1 block leading-tight">
                    Verifica códigos e patrimônios duplicados antes de importar, abrindo gestão de conflitos.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsImportChoiceModalOpen(false);
                  setPendingParsedData(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar Importação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXIGÊNCIA: JANELA PARA A GESTÃO DE ITENS COM CÓDIGOS OU PATRIMÔNIOS IGUAIS ANTES DA IMPORTAÇÃO */}
      {isConflictModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-3xl rounded-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">
            
            {/* Header do Modal de Conflitos */}
            <div className="p-4 border-b border-slate-100 bg-amber-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-300 shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Gestão de Itens Conflitantes (Acrescentar à Base)
                  </h3>
                  <p className="text-[11px] text-amber-900">
                    Foram identificados <strong>{conflictsList.length}</strong> itens no arquivo com códigos ou patrimônios já cadastrados na base.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsConflictModalOpen(false);
                  setConflictsList([]);
                  setPendingParsedData(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-200/70 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Ações em Massa para os Conflitos */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-slate-600 font-medium">
                Escolha o que fazer com os itens conflitantes:
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSetAllConflictResolution('replace')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl cursor-pointer shadow-xs transition-all active:scale-95"
                >
                  Atualizar Todos com Dados do Arquivo
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllConflictResolution('keep')}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-xl cursor-pointer shadow-xs transition-all active:scale-95"
                >
                  Manter Todos da Base (Ignorar do Arquivo)
                </button>
              </div>
            </div>

            {/* Lista dos Itens com Conflito */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {conflictsList.map((conflict, idx) => {
                const inItem: any = conflict.incomingItem;
                const exItem: any = conflict.existingItem;

                return (
                  <div 
                    key={conflict.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          conflict.itemType === 'material'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : conflict.itemType === 'freezer'
                              ? 'bg-sky-100 text-sky-900 border border-sky-300'
                              : 'bg-purple-100 text-purple-900 border border-purple-300'
                        }`}>
                          {conflict.itemType}
                        </span>
                        <div className="space-y-0.5">
                          {conflict.conflictReasons.map((r, rIdx) => (
                            <span key={rIdx} className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block mr-1">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Botões de Ação para este Conflito */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleConflictResolution(conflict.id, 'replace')}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            conflict.resolution === 'replace'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Substituir da Base
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleConflictResolution(conflict.id, 'keep')}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            conflict.resolution === 'keep'
                              ? 'bg-slate-900 text-white border-slate-800 font-black shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          Manter da Base
                        </button>
                      </div>
                    </div>

                    {/* Comparativo: No Arquivo vs Na Base Atual */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      {/* Dados no Arquivo Importado */}
                      <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-1">
                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">
                          📄 No Arquivo para Importar:
                        </span>
                        <p className="font-bold text-slate-900">
                          {inItem.name}
                        </p>
                        <p className="font-mono text-[11px] text-slate-600">
                          Código: <strong>{inItem.code}</strong> {inItem.patrimony ? `• Patrimônio: ${inItem.patrimony}` : ''}
                        </p>
                        {inItem.defect && (
                          <p className="text-[11px] text-rose-700 font-semibold">
                            Defeito: <strong>{inItem.defect}</strong>
                          </p>
                        )}
                      </div>

                      {/* Dados Atuais na Base */}
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
                          🏛️ Atualmente na Base:
                        </span>
                        <p className="font-bold text-slate-900">
                          {exItem.name}
                        </p>
                        <p className="font-mono text-[11px] text-slate-600">
                          Código: <strong>{exItem.code}</strong> {exItem.patrimony ? `• Patrimônio: ${exItem.patrimony}` : ''}
                        </p>
                        {exItem.defect && (
                          <p className="text-[11px] text-rose-700 font-semibold">
                            Defeito: <strong>{exItem.defect}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer do Modal de Conflitos */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-slate-500">
                Total de novos itens sem conflito: <strong>{nonConflictingData.materials.length + nonConflictingData.freezers.length + nonConflictingData.equipments.length}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsConflictModalOpen(false);
                    setConflictsList([]);
                    setPendingParsedData(null);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmConflictImport}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-md cursor-pointer active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar e Importar Itens</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Cards Rápidos de Novo Cadastro */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block">
            ➕ Cadastrar Novo Item no Catálogo
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleCreateMaterial}
            className="p-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-left transition-all active:scale-95 flex flex-col justify-between cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold mb-2">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">+ Material</span>
              <span className="text-[10px] text-slate-500">Mesas, caixas, barris, CO2</span>
            </div>
          </button>

          <button
            onClick={handleCreateFreezer}
            className="p-3 rounded-xl bg-sky-50 border border-sky-200 hover:bg-sky-100 text-left transition-all active:scale-95 flex flex-col justify-between cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold mb-2">
              <Snowflake className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">+ Freezer</span>
              <span className="text-[10px] text-slate-500">Horizontais e verticais</span>
            </div>
          </button>

          <button
            onClick={handleCreateEquipment}
            className="p-3 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 text-left transition-all active:scale-95 flex flex-col justify-between cursor-pointer"
          >
            <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold mb-2">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">+ Chopeiras</span>
              <span className="text-[10px] text-slate-500">Chopeiras 1 e 2 torneiras</span>
            </div>
          </button>
        </div>
      </div>

      {/* Lista com botões de filtro dos materiais, freezer e chopeiras cadastrados na base */}
      <div className="space-y-2.5">
        
        {/* Type Filter Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
          <button
            onClick={() => setFilterType('all')}
            className={`py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            Todos ({totalCadastrosOficiais})
          </button>
          <button
            onClick={() => setFilterType('materiais')}
            className={`py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              filterType === 'materiais'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                : 'bg-white border-slate-200 text-amber-700 hover:bg-slate-50'
            }`}
          >
            Materiais ({registeredMaterials.length})
          </button>
          <button
            onClick={() => setFilterType('freezers')}
            className={`py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              filterType === 'freezers'
                ? 'bg-sky-600 text-white border-sky-500 shadow-xs'
                : 'bg-white border-slate-200 text-sky-700 hover:bg-slate-50'
            }`}
          >
            Freezers ({registeredFreezers.length})
          </button>
          <button
            onClick={() => setFilterType('equipamentos')}
            className={`py-1.5 rounded-xl border font-bold transition-all cursor-pointer ${
              filterType === 'equipamentos'
                ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                : 'bg-white border-slate-200 text-purple-700 hover:bg-slate-50'
            }`}
          >
            Chopeiras ({registeredEquipments.length})
          </button>
          <button
            onClick={() => setFilterType('nao_cadastrados')}
            className={`py-1.5 rounded-xl border font-bold transition-all cursor-pointer col-span-2 sm:col-span-1 ${
              filterType === 'nao_cadastrados'
                ? 'bg-amber-600 text-white border-amber-500 shadow-xs ring-2 ring-amber-300'
                : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
            }`}
          >
            Não Cadastrados ({totalNaoCadastrados})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por código, patrimônio, nome ou defeito..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>

        {/* BLOCO SEPARADO: MATERIAIS ENCONTRADOS NA CONTAGEM NÃO CADASTRADOS PREVIAMENTE */}
        {(filterType === 'all' || filterType === 'materiais' || filterType === 'nao_cadastrados') && matchingUnregisteredMaterials.length > 0 && (
          <div className="bg-amber-50/80 border-2 border-amber-300 rounded-2xl p-3.5 space-y-2.5 shadow-xs animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-amber-900 font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>MATERIAIS ENCONTRADOS NA CONTAGEM (NÃO CADASTRADOS NA BASE):</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-mono font-bold text-xs">
                {matchingUnregisteredMaterials.length} un
              </span>
            </div>
            <p className="text-[11px] text-amber-800">
              Esses materiais foram adicionados na contagem sem código cadastrado. Utilize o botão <strong>Editar</strong> para inserir o código do material manualmente.
            </p>

            <div className="space-y-2">
              {matchingUnregisteredMaterials.map(item => (
                <div 
                  key={`uncat-${item.id}`}
                  className="bg-white border border-amber-200 rounded-xl p-3 hover:border-amber-400 transition-all flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                          [NÃO-CAD] Código Provisório: 0
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.subDetails}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleEditItem(item)}
                      className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                      title="Editar para inserir código do material manualmente"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-950" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="space-y-2">
          {sortedItems.length === 0 ? (
            filterType === 'nao_cadastrados' && matchingUnregisteredMaterials.length > 0 ? null : (
              <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="text-xs text-slate-500">
                  {filterType === 'nao_cadastrados'
                    ? 'Nenhum material ou equipamento não cadastrado foi encontrado na contagem.'
                    : 'Nenhum item cadastrado encontrado.'}
                </p>
              </div>
            )
          ) : (
            sortedItems.map(item => (
              <div 
                key={`${item.itemType}-${item.id}`}
                className="bg-white border border-slate-200 rounded-2xl p-3 hover:border-slate-300 transition-all flex items-start justify-between gap-2 shadow-xs"
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    item.itemType === 'material' 
                      ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                      : item.itemType === 'freezer'
                        ? 'bg-sky-100 text-sky-800 border border-sky-300'
                        : 'bg-purple-100 text-purple-800 border border-purple-300'
                  }`}>
                    {item.itemType === 'material' ? <Layers className="w-4 h-4" /> : item.itemType === 'freezer' ? <Snowflake className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        {item.code}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900">{item.name}</h4>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{item.subDetails}</p>

                    {/* EXIGÊNCIA: Na tela Cadastros, mostrar nos itens os defeitos dos mesmos também */}
                    {item.defect && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200 w-fit">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Defeito: <span className="font-semibold text-rose-950">{item.defect}</span></span>
                      </div>
                    )}
                    {item.rawItem?.observations && (
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-sky-900 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200 w-fit">
                        <span>OBS: <span className="font-semibold text-sky-950">{item.rawItem.observations}</span></span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Botão Editar ao lado */}
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <button
                    onClick={() => handleEditItem(item)}
                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 transition-all"
                    title="Editar Cadastro"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                    <span>Editar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

    </div>
  );
};
