import { jsPDF } from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import {
  MaterialItem,
  FreezerItem,
  EquipmentItem,
  UncataloguedEquipment,
  MaterialDailyEntry,
  EquipmentDailyEntry,
  StockUser,
  UnitBranch,
  getBranchFileSlug,
} from '../types/inventory';
import { GRUPO_MS_LOGO_PATH } from '../components/common/GrupoMSBrand';

let cachedGrupoMsLogoDataUrl: string | null = null;
let logoPreloadPromise: Promise<string | null> | null = null;

/**
 * Pré-carrega a logomarca oficial "GRUPO MS" da tela de login em Base64
 * para garantir exibição fiel no relatório exportado em PDF e no corpo do e-mail.
 */
export function preloadGrupoMsLogoDataUrl(): Promise<string | null> {
  if (cachedGrupoMsLogoDataUrl) return Promise.resolve(cachedGrupoMsLogoDataUrl);
  if (logoPreloadPromise) return logoPreloadPromise;
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return Promise.resolve(null);
  }

  const candidates = [GRUPO_MS_LOGO_PATH, '/logo-grupo-ms.png'];
  logoPreloadPromise = (async () => {
    for (const path of candidates) {
      try {
        const res = await fetch(path);
        if (!res.ok) continue;
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(String(reader.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        if (dataUrl.startsWith('data:image')) {
          cachedGrupoMsLogoDataUrl = dataUrl;
          return dataUrl;
        }
      } catch {
        // tenta próximo caminho
      }
    }
    return null;
  })();

  return logoPreloadPromise;
}

if (typeof window !== 'undefined') {
  preloadGrupoMsLogoDataUrl().catch(() => {});
}

export interface GenerateReportParams {
  selectedStock: 'materiais' | 'equipamentos' | 'ambos';
  todayDateFormatted: string;
  activeUser: StockUser | null;
  defaultSenderEmail: string;
  recipients?: string[];
  materials: MaterialItem[];
  freezers: FreezerItem[];
  equipments: EquipmentItem[];
  uncataloguedEquipments: UncataloguedEquipment[];
  materialCounts: Record<string, MaterialDailyEntry>;
  equipmentCounts: Record<string, EquipmentDailyEntry>;
  includeEquipmentDefects?: boolean;
  branch?: string;
  isMobile?: boolean;
  clearCountsOnly?: boolean;
  isRecontagem?: boolean;
}

interface ConsolidadoRow {
  code: string;
  name: string;
  quantity: number;
}

interface DetailedMaterialRow {
  code: string;
  name: string;
  quantity: number;
}

interface VazioRotaMaterialRow {
  code: string;
  name: string;
  situation: string;
  quantity: number;
}

interface DetailedEquipRow {
  code: string;
  patrimony: string;
  name: string;
  fullNameWithSpecs: string;
  categoryKind: 'Freezer' | 'Chopeira';
  status: 'disponivel' | 'danificado' | 'em_estoque' | 'nao_consta';
  damageDescription?: string;
  observations?: string;
}

interface StructuredReportData {
  stockLabel: string;
  consolidadoMatRows: ConsolidadoRow[];
  totalGeralMateriais: number;
  dispMatRows: DetailedMaterialRow[];
  subtotalMatDisp: number;
  danifMatRows: DetailedMaterialRow[];
  subtotalMatDanif: number;
  vazioRotaRows: VazioRotaMaterialRow[];
  subtotalMatVazioRota: number;
  consolidadoEquipRows: ConsolidadoRow[];
  totalEquipamentosGeral: number;
  emEstoqueEquips: DetailedEquipRow[];
  naoConstaEquips: DetailedEquipRow[];
  dispEquips: DetailedEquipRow[];
  danifEquips: DetailedEquipRow[];
  uncatEquips: DetailedEquipRow[];
}

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

function getMaterialTypePriority(m: MaterialItem): number {
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
}

function cleanBasicName(name: string): string {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name.trim();
}

function getFreezerFullNameWithSpecs(f: FreezerItem): string {
  const specParts: string[] = [];
  if (f.brand) specParts.push(f.brand);
  if (f.model) specParts.push(f.model);
  const tipoLabel = f.tipo || (f.isSlim ? 'SLIM' : '');
  if (tipoLabel) specParts.push(tipoLabel);
  if (f.voltage) specParts.push(f.voltage);

  const specsStr = specParts.join(' • ');
  const baseName = (f.name || 'Freezer').trim();
  return specsStr ? `${baseName} (${specsStr})` : baseName;
}

function getChopeiraFullNameWithSpecs(eq: EquipmentItem): string {
  const specParts: string[] = [];
  specParts.push(eq.type === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras');
  if (eq.model || eq.brand) specParts.push(eq.model || eq.brand!);
  if (eq.voltage) specParts.push(eq.voltage);

  const specsStr = specParts.join(' • ');
  const baseName = (eq.name || 'Chopeira').trim();
  return specsStr ? `${baseName} (${specsStr})` : baseName;
}

function sortByPatrimonyAsc(a: { patrimony: string }, b: { patrimony: string }): number {
  return a.patrimony.localeCompare(b.patrimony, undefined, { numeric: true, sensitivity: 'base' });
}

function sortByCodeAsc(a: { code: string }, b: { code: string }): number {
  return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
}

function buildStructuredReportData(params: GenerateReportParams): StructuredReportData {
  const {
    selectedStock,
    materials,
    freezers,
    equipments,
    clearCountsOnly = false,
    isRecontagem = false,
  } = params;

  const materialCounts = clearCountsOnly ? {} : (params.materialCounts || {});
  const equipmentCounts = clearCountsOnly ? {} : (params.equipmentCounts || {});
  const uncataloguedEquipments = clearCountsOnly ? [] : (params.uncataloguedEquipments || []);

  const stockLabel =
    selectedStock === 'materiais'
      ? 'MATERIAIS'
      : selectedStock === 'equipamentos'
        ? 'EQUIPAMENTOS'
        : 'MATERIAIS E EQUIPAMENTOS (CONSOLIDADO)';

  // ---------------------------------------------------
  // MATERIAIS
  // ---------------------------------------------------
  const sortedMaterials = [...materials].sort((a, b) => {
    const prioA = getMaterialTypePriority(a);
    const prioB = getMaterialTypePriority(b);
    if (prioA !== prioB) return prioA - prioB;
    const nameComp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    if (nameComp !== 0) return nameComp;
    return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
  });

  const dispMatRows: DetailedMaterialRow[] = [];
  let subtotalMatDisp = 0;

  sortedMaterials.forEach(m => {
    const entry = materialCounts[m.id];
    if (m.category === 'barril') {
      const cheio = entry?.barrilCheio || 0;
      if (cheio > 0) {
        dispMatRows.push({ code: m.code, name: `${m.name} (Cheio)`, quantity: cheio });
        subtotalMatDisp += cheio;
      }
    } else if (m.category === 'co2') {
      const cheio = entry?.co2Cheio || 0;
      const mexido = entry?.co2Mexido || 0;
      if (cheio > 0) {
        dispMatRows.push({ code: m.code, name: `${m.name} (Cheio)`, quantity: cheio });
        subtotalMatDisp += cheio;
      }
      if (mexido > 0) {
        dispMatRows.push({ code: m.code, name: `${m.name} (Mexido)`, quantity: mexido });
        subtotalMatDisp += mexido;
      }
    } else {
      const disp = entry?.disponivel || 0;
      if (disp > 0) {
        dispMatRows.push({ code: m.code, name: m.name, quantity: disp });
        subtotalMatDisp += disp;
      }
    }
  });

  const danifMatRows: DetailedMaterialRow[] = [];
  let subtotalMatDanif = 0;

  sortedMaterials.forEach(m => {
    if (m.category !== 'barril' && m.category !== 'co2') {
      const entry = materialCounts[m.id];
      const danif = entry?.danificado || 0;
      if (danif > 0) {
        danifMatRows.push({ code: m.code, name: m.name, quantity: danif });
        subtotalMatDanif += danif;
      }
    }
  });

  const vazioRotaRows: VazioRotaMaterialRow[] = [];
  let subtotalMatVazioRota = 0;
  let totalCo2EmRota = 0;

  sortedMaterials.forEach(m => {
    if (m.category === 'co2') {
      const entry = materialCounts[m.id];
      totalCo2EmRota += entry?.co2EmRota || 0;
    }
  });

  sortedMaterials.forEach(m => {
    if (m.category === 'barril') {
      const entry = materialCounts[m.id];
      const vazio = entry?.barrilVazio || 0;
      const rota = entry?.barrilEmRota || 0;
      if (vazio > 0) {
        vazioRotaRows.push({ code: m.code, name: m.name, situation: 'Vazio', quantity: vazio });
        subtotalMatVazioRota += vazio;
      }
      if (rota > 0) {
        vazioRotaRows.push({ code: m.code, name: m.name, situation: 'Em Rota', quantity: rota });
        subtotalMatVazioRota += rota;
      }
    }
  });

  sortedMaterials.forEach(m => {
    if (m.category === 'co2') {
      const entry = materialCounts[m.id];
      const vazio = entry?.co2Vazio || 0;
      if (vazio > 0) {
        vazioRotaRows.push({ code: m.code, name: m.name, situation: 'Vazio', quantity: vazio });
        subtotalMatVazioRota += vazio;
      }
    }
  });

  if (totalCo2EmRota > 0) {
    const co2Item = sortedMaterials.find(m => m.category === 'co2');
    const co2Code = co2Item?.code || '49782';
    vazioRotaRows.push({ code: co2Code, name: 'Cilindro CO2', situation: 'Em Rota', quantity: totalCo2EmRota });
    subtotalMatVazioRota += totalCo2EmRota;
  }

  const consolidadoMatRows: ConsolidadoRow[] = [];
  let totalGeralMateriais = 0;
  let totalCo2Consolidado = 0;
  let co2ItemCode = '49782';

  sortedMaterials.forEach(m => {
    const entry = materialCounts[m.id];
    let itemTotal = 0;

    if (m.category === 'barril') {
      itemTotal = (entry?.barrilCheio || 0) + (entry?.barrilVazio || 0) + (entry?.barrilEmRota || 0);
    } else if (m.category === 'co2' || m.code.includes('49782') || m.name.toUpperCase().includes('CILINDRO CO2')) {
      itemTotal =
        (entry?.co2Cheio || 0) +
        (entry?.co2Mexido || 0) +
        (entry?.co2Vazio || 0) +
        (entry?.co2EmRota || 0) +
        (entry?.disponivel || 0) +
        (entry?.danificado || 0);
      if (m.code && m.code !== '0') co2ItemCode = m.code;
      totalCo2Consolidado += itemTotal;
      totalGeralMateriais += itemTotal;
      return;
    } else {
      itemTotal = (entry?.disponivel || 0) + (entry?.danificado || 0);
    }

    if (itemTotal > 0) {
      consolidadoMatRows.push({ code: m.code, name: m.name, quantity: itemTotal });
      totalGeralMateriais += itemTotal;
    }
  });

  if (totalCo2Consolidado > 0) {
    consolidadoMatRows.push({ code: co2ItemCode || '49782', name: 'CILINDRO CO2', quantity: totalCo2Consolidado });
  }

  // ---------------------------------------------------
  // EQUIPAMENTOS
  // ---------------------------------------------------
  const registeredEquips: DetailedEquipRow[] = clearCountsOnly
    ? []
    : [
        ...freezers
          .filter(f => (isRecontagem ? !!equipmentCounts[f.id]?.status : !!equipmentCounts[f.id]))
          .map(f => {
            const count = equipmentCounts[f.id];
            if (isRecontagem) {
              const status: 'em_estoque' | 'nao_consta' = count?.status === 'nao_consta' ? 'nao_consta' : 'em_estoque';
              return {
                code: f.code,
                patrimony: f.patrimony,
                name: f.name,
                fullNameWithSpecs: getFreezerFullNameWithSpecs(f),
                categoryKind: 'Freezer' as const,
                status,
                damageDescription: undefined,
                observations: undefined,
              };
            }
            const hasBaseDefect = Boolean(f.defect && f.defect.trim());
            const status: 'disponivel' | 'danificado' = hasBaseDefect
              ? 'danificado'
              : count?.status === 'danificado' && count?.damageDescription
                ? 'danificado'
                : 'disponivel';
            const damageDescription = hasBaseDefect ? f.defect : status === 'danificado' ? count?.damageDescription : undefined;
            return {
              code: f.code,
              patrimony: f.patrimony,
              name: f.name,
              fullNameWithSpecs: getFreezerFullNameWithSpecs(f),
              categoryKind: 'Freezer' as const,
              status,
              damageDescription,
              observations: f.observations,
            };
          }),
        ...equipments
          .filter(e => (isRecontagem ? !!equipmentCounts[e.id]?.status : !!equipmentCounts[e.id]))
          .map(e => {
            const count = equipmentCounts[e.id];
            if (isRecontagem) {
              const status: 'em_estoque' | 'nao_consta' = count?.status === 'nao_consta' ? 'nao_consta' : 'em_estoque';
              return {
                code: e.code,
                patrimony: e.patrimony,
                name: e.name,
                fullNameWithSpecs: getChopeiraFullNameWithSpecs(e),
                categoryKind: 'Chopeira' as const,
                status,
                damageDescription: undefined,
                observations: undefined,
              };
            }
            const hasBaseDefect = Boolean(e.defect && e.defect.trim());
            const status: 'disponivel' | 'danificado' = hasBaseDefect
              ? 'danificado'
              : count?.status === 'danificado' && count?.damageDescription
                ? 'danificado'
                : 'disponivel';
            const damageDescription = hasBaseDefect ? e.defect : status === 'danificado' ? count?.damageDescription : undefined;
            return {
              code: e.code,
              patrimony: e.patrimony,
              name: e.name,
              fullNameWithSpecs: getChopeiraFullNameWithSpecs(e),
              categoryKind: 'Chopeira' as const,
              status,
              damageDescription,
              observations: e.observations,
            };
          }),
      ];

  const emEstoqueFreezers = registeredEquips
    .filter(e => e.categoryKind === 'Freezer' && e.status === 'em_estoque' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const emEstoqueChopeiras = registeredEquips
    .filter(e => e.categoryKind === 'Chopeira' && e.status === 'em_estoque' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const emEstoqueEquips = [...emEstoqueFreezers, ...emEstoqueChopeiras];

  const naoConstaFreezers = registeredEquips
    .filter(e => e.categoryKind === 'Freezer' && e.status === 'nao_consta' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const naoConstaChopeiras = registeredEquips
    .filter(e => e.categoryKind === 'Chopeira' && e.status === 'nao_consta' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const naoConstaEquips = [...naoConstaFreezers, ...naoConstaChopeiras];

  const dispFreezers = registeredEquips
    .filter(e => e.categoryKind === 'Freezer' && e.status === 'disponivel' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const dispChopeiras = registeredEquips
    .filter(e => e.categoryKind === 'Chopeira' && e.status === 'disponivel' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const dispEquips = [...dispFreezers, ...dispChopeiras];

  const danifFreezers = registeredEquips
    .filter(e => e.categoryKind === 'Freezer' && e.status === 'danificado' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const danifChopeiras = registeredEquips
    .filter(e => e.categoryKind === 'Chopeira' && e.status === 'danificado' && e.code && e.code !== '0')
    .sort(sortByPatrimonyAsc);
  const danifEquips = [...danifFreezers, ...danifChopeiras];

  const allUnregisteredRaw: DetailedEquipRow[] = [
    ...registeredEquips.filter(e => !e.code || e.code === '0'),
    ...uncataloguedEquipments.map(u => {
      const isChopeira = (u.observations || '').toLowerCase().includes('chopeira');
      return {
        code: 'NÃO-CAD',
        patrimony: u.patrimony,
        name: isChopeira ? 'Chopeira Não Cadastrada' : 'Equipamento Encontrado Fora da Base',
        fullNameWithSpecs: 'Equipamento Encontrado Fora da Base',
        categoryKind: (isChopeira ? 'Chopeira' : 'Freezer') as 'Freezer' | 'Chopeira',
        status: (u.status || 'disponivel') as DetailedEquipRow['status'],
        damageDescription: u.damageDescription,
        observations: u.observations,
      };
    }),
  ];

  const uncatFreezers = allUnregisteredRaw
    .filter(u => u.categoryKind !== 'Chopeira' && !u.name.toLowerCase().includes('chopeira') && !(u.observations || '').toLowerCase().includes('chopeira'))
    .sort(sortByPatrimonyAsc);

  const uncatChopeiras = allUnregisteredRaw
    .filter(u => u.categoryKind === 'Chopeira' || u.name.toLowerCase().includes('chopeira') || (u.observations || '').toLowerCase().includes('chopeira'))
    .sort(sortByPatrimonyAsc);

  const uncatEquips = [...uncatFreezers, ...uncatChopeiras];

  // Consolidado de Equipamentos: apenas código, nome básico e quantidade consolidada dos códigos contados (mesmo formato de Materiais)
  const consolidadoEquipRows: ConsolidadoRow[] = [];

  const freezerCodeMap = new Map<string, ConsolidadoRow>();
  registeredEquips
    .filter(e => e.categoryKind === 'Freezer' && (isRecontagem ? e.status === 'em_estoque' : true) && e.code && e.code !== '0')
    .forEach(e => {
      const existing = freezerCodeMap.get(e.code);
      if (existing) {
        existing.quantity += 1;
      } else {
        freezerCodeMap.set(e.code, {
          code: e.code,
          name: cleanBasicName(e.name) || 'Freezer',
          quantity: 1,
        });
      }
    });
  consolidadoEquipRows.push(...Array.from(freezerCodeMap.values()).sort(sortByCodeAsc));

  if (!isRecontagem && uncatFreezers.length > 0) {
    const uncatFreezerMap = new Map<string, ConsolidadoRow>();
    uncatFreezers.forEach(u => {
      const code = u.code && u.code !== '0' ? u.code : 'NÃO-CAD';
      const name = cleanBasicName(u.name) || 'Freezer Não Cadastrado';
      const key = `${code}::${name}`;
      const existing = uncatFreezerMap.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        uncatFreezerMap.set(key, { code, name, quantity: 1 });
      }
    });
    consolidadoEquipRows.push(...Array.from(uncatFreezerMap.values()));
  }

  const chopeiraCodeMap = new Map<string, ConsolidadoRow>();
  registeredEquips
    .filter(e => e.categoryKind === 'Chopeira' && (isRecontagem ? e.status === 'em_estoque' : true) && e.code && e.code !== '0')
    .forEach(e => {
      const existing = chopeiraCodeMap.get(e.code);
      if (existing) {
        existing.quantity += 1;
      } else {
        chopeiraCodeMap.set(e.code, {
          code: e.code,
          name: cleanBasicName(e.name) || 'Chopeira',
          quantity: 1,
        });
      }
    });
  consolidadoEquipRows.push(...Array.from(chopeiraCodeMap.values()).sort(sortByCodeAsc));

  if (!isRecontagem && uncatChopeiras.length > 0) {
    const uncatChopeiraMap = new Map<string, ConsolidadoRow>();
    uncatChopeiras.forEach(u => {
      const code = u.code && u.code !== '0' ? u.code : 'NÃO-CAD';
      const name = cleanBasicName(u.name) || 'Chopeira Não Cadastrada';
      const key = `${code}::${name}`;
      const existing = uncatChopeiraMap.get(key);
      if (existing) {
        existing.quantity += 1;
      } else {
        uncatChopeiraMap.set(key, { code, name, quantity: 1 });
      }
    });
    consolidadoEquipRows.push(...Array.from(uncatChopeiraMap.values()));
  }

  const totalEquipamentosGeral = isRecontagem
    ? emEstoqueEquips.length
    : registeredEquips.length + uncataloguedEquipments.length;

  return {
    stockLabel,
    consolidadoMatRows,
    totalGeralMateriais,
    dispMatRows,
    subtotalMatDisp,
    danifMatRows,
    subtotalMatDanif,
    vazioRotaRows,
    subtotalMatVazioRota,
    consolidadoEquipRows,
    totalEquipamentosGeral,
    emEstoqueEquips,
    naoConstaEquips,
    dispEquips,
    danifEquips,
    uncatEquips,
  };
}

/**
 * Gera o relatório textual padrão (usado na Prévia do Relatório e WhatsApp),
 * com o ESTOQUE CONSOLIDADO movido para a primeira informação do relatório
 * e o consolidado de equipamentos seguindo o mesmo padrão conciso do de materiais.
 */
export function generateStockReportText(params: GenerateReportParams): string {
  const {
    selectedStock,
    todayDateFormatted,
    activeUser,
    includeEquipmentDefects = true,
    isMobile = false,
    isRecontagem = false,
  } = params;

  const data = buildStructuredReportData(params);
  const lines: string[] = [];

  const lineWidth = isMobile ? 42 : 80;
  const DIVIDER_DOUBLE = '='.repeat(lineWidth);
  const DIVIDER_SINGLE = '-'.repeat(lineWidth);

  const center = (text: string) => {
    if (text.length >= lineWidth) return text;
    const pad = Math.floor((lineWidth - text.length) / 2);
    return ' '.repeat(pad) + text;
  };

  lines.push(DIVIDER_DOUBLE);
  lines.push(center('GRUPO'));
  lines.push(center('MS'));
  lines.push(center(isRecontagem ? 'RELATÓRIO DE RECONTAGEM DE ESTOQUE' : 'CONTAGEM DE ESTOQUE'));
  lines.push(center('Gestão de Materiais & Equipamentos'));
  lines.push(DIVIDER_DOUBLE);
  lines.push(`DATA DA ${isRecontagem ? 'RECONTAGEM' : 'CONTAGEM'}: ${todayDateFormatted}`);
  if (params.branch) {
    lines.push(`BASE / UNIDADE: ${params.branch}`);
  }
  if (activeUser) {
    lines.push(`CONFERENTE RESPONSÁVEL: ${activeUser.name}`);
  }
  lines.push(`ESTOQUE SELECIONADO: ${data.stockLabel}`);
  lines.push(`SITUAÇÃO: ${isRecontagem ? 'Relatório Oficial de Recontagem' : 'Relatório da Contagem'}`);
  lines.push(`${DIVIDER_DOUBLE}\n`);

  // =========================================================
  // 1ª INFORMAÇÃO DO RELATÓRIO: ESTOQUE CONSOLIDADO
  // =========================================================
  lines.push(DIVIDER_SINGLE);
  lines.push(`ESTOQUE CONSOLIDADO`);
  lines.push(`${DIVIDER_SINGLE}\n`);

  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    lines.push(`ESTOQUE CONSOLIDADO - MATERIAIS:`);
    if (data.consolidadoMatRows.length > 0) {
      data.consolidadoMatRows.forEach(r => {
        lines.push(`   • [${r.code}] ${r.name}: ${r.quantity} un`);
      });
      lines.push(`   >> TOTAL GERAL DE MATERIAIS: ${data.totalGeralMateriais} un`);
    } else {
      lines.push(`   • Nenhum material contado até o momento.`);
    }
    lines.push(``);
  }

  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    lines.push(`ESTOQUE CONSOLIDADO - EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}:`);
    if (data.consolidadoEquipRows.length > 0) {
      data.consolidadoEquipRows.forEach(r => {
        lines.push(`   • [${r.code}] ${r.name}: ${r.quantity} un`);
      });
      lines.push(`   >> TOTAL GERAL DE EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}: ${data.totalEquipamentosGeral} un`);
    } else {
      lines.push(`   • Nenhum equipamento contado até o momento.`);
    }
    lines.push(``);
  }

  // =========================================================
  // DETALHAMENTO: ESTOQUE DE MATERIAIS
  // =========================================================
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    lines.push(DIVIDER_SINGLE);
    lines.push(`ESTOQUE DE MATERIAIS`);
    lines.push(`${DIVIDER_SINGLE}\n`);

    lines.push(`1 ITENS DISPONÍVEIS:`);
    if (data.dispMatRows.length > 0) {
      data.dispMatRows.forEach(r => {
        lines.push(`   • [${r.code}] ${r.name}: ${r.quantity} un`);
      });
      lines.push(`   >> Subtotal Disponíveis: ${data.subtotalMatDisp} un`);
    }
    lines.push(``);
    lines.push(DIVIDER_SINGLE);

    lines.push(`2 ITENS DANIFICADOS:`);
    if (data.danifMatRows.length > 0) {
      data.danifMatRows.forEach(r => {
        lines.push(`   • [${r.code}] ${r.name}: ${r.quantity} un`);
      });
      lines.push(`   >> Subtotal Danificados: ${data.subtotalMatDanif} un`);
    }
    lines.push(``);
    lines.push(DIVIDER_SINGLE);

    lines.push(`3 ITENS VAZIO E EM ROTA:`);
    if (data.vazioRotaRows.length > 0) {
      data.vazioRotaRows.forEach(r => {
        lines.push(`   • [${r.code}] ${r.name} (${r.situation}): ${r.quantity} un`);
      });
      lines.push(`   >> Subtotal Vazio e Em Rota: ${data.subtotalMatVazioRota} un`);
    }
    lines.push(``);
  }

  // =========================================================
  // DETALHAMENTO: ESTOQUE DE EQUIPAMENTOS
  // =========================================================
  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    lines.push(DIVIDER_SINGLE);
    lines.push(`ESTOQUE DE EQUIPAMENTOS`);
    lines.push(`${DIVIDER_SINGLE}\n`);

    if (isRecontagem) {
      lines.push(`1 EQUIPAMENTOS EM ESTOQUE:`);
      if (data.emEstoqueEquips.length > 0) {
        data.emEstoqueEquips.forEach(eq => {
          const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
          lines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
        });
        lines.push(`   >> Subtotal Em Estoque: ${data.emEstoqueEquips.length} un`);
      } else {
        lines.push(`   • Nenhum equipamento confirmado em estoque`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);

      lines.push(`2 EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE:`);
      if (data.naoConstaEquips.length > 0) {
        data.naoConstaEquips.forEach(eq => {
          const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
          lines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
        });
        lines.push(`   >> Subtotal Não Constam em Estoque: ${data.naoConstaEquips.length} un`);
      } else {
        lines.push(`   • Nenhum equipamento apontado como não consta em estoque`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);
    } else {
      lines.push(`1 ITENS DISPONÍVEIS:`);
      if (data.dispEquips.length > 0) {
        data.dispEquips.forEach(eq => {
          const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
          lines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
          if (includeEquipmentDefects && eq.observations?.trim()) {
            lines.push(`     Observações: ${eq.observations.trim()}`);
          }
        });
        lines.push(`   >> Subtotal Disponíveis: ${data.dispEquips.length} un`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);

      lines.push(`2 ITENS DANIFICADOS:`);
      if (data.danifEquips.length > 0) {
        data.danifEquips.forEach(eq => {
          const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
          lines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
          if (includeEquipmentDefects && eq.damageDescription) {
            lines.push(`     Defeito: ${eq.damageDescription}`);
          }
          if (includeEquipmentDefects && eq.observations?.trim()) {
            lines.push(`     Observações: ${eq.observations.trim()}`);
          }
        });
        lines.push(`   >> Subtotal Danificados: ${data.danifEquips.length} un`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);

      lines.push(`3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM):`);
    }

    if (data.uncatEquips.length > 0) {
      data.uncatEquips.forEach(u => {
        const codePrefix = u.code && u.code !== '0' ? `[${u.code}] ` : '[NÃO-CAD] ';
        lines.push(`   • ${codePrefix}Patrimônio: ${u.patrimony} - ${u.fullNameWithSpecs}`);
        if (includeEquipmentDefects && u.damageDescription) {
          lines.push(`     Defeito: ${u.damageDescription}`);
        }
        if (includeEquipmentDefects && u.observations?.trim()) {
          lines.push(`     Observações: ${u.observations.trim()}`);
        }
      });
      lines.push(`   >> Subtotal Não Cadastrados: ${data.uncatEquips.length} un`);
    }
    lines.push(``);
  }

  lines.push(DIVIDER_DOUBLE);
  if (isMobile) {
    lines.push(`Relatório gerado pelo App CONTAGEM DE`);
    lines.push(`MATERIAIS & EQUIPAMENTOS do Grupo MS.`);
  } else {
    lines.push(`Relatório gerado pelo App CONTAGEM DE MATERIAIS & EQUIPAMENTOS do Grupo MS.`);
  }
  lines.push(DIVIDER_DOUBLE);

  return lines.join('\n');
}

interface TableColumnSpec {
  header: string;
  width: number;
  align?: 'left' | 'right';
}

function wrapTextToWidth(text: string, width: number): string[] {
  const clean = (text || '').replace(/\r?\n/g, ' ').trim();
  if (!clean) return [''];
  if (clean.length <= width) return [clean];

  const words = clean.split(/\s+/);
  const result: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      if (word.length <= width) {
        current = word;
      } else {
        let rest = word;
        while (rest.length > width) {
          result.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
      }
    } else if (current.length + 1 + word.length <= width) {
      current = `${current} ${word}`;
    } else {
      result.push(current);
      if (word.length <= width) {
        current = word;
      } else {
        let rest = word;
        while (rest.length > width) {
          result.push(rest.slice(0, width));
          rest = rest.slice(width);
        }
        current = rest;
      }
    }
  }
  if (current) result.push(current);
  return result.length > 0 ? result : [''];
}

function formatCell(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const truncated = text.length > width ? text.slice(0, width) : text;
  return align === 'right' ? truncated.padStart(width, ' ') : truncated.padEnd(width, ' ');
}

function renderAsciiTable(
  columns: TableColumnSpec[],
  rows: string[][],
  footerRow?: string[]
): string[] {
  const border = `+${columns.map(c => '-'.repeat(c.width + 2)).join('+')}+`;
  const lines: string[] = [];

  lines.push(border);
  lines.push(
    `|${columns.map(c => ` ${formatCell(c.header, c.width, c.align)} `).join('|')}|`
  );
  lines.push(border);

  if (rows.length === 0) {
    const totalInner = columns.reduce((acc, c) => acc + c.width + 2, 0) + (columns.length - 1);
    const emptyMsg = formatCell('Nenhum item registrado nesta seção.', totalInner - 2, 'left');
    lines.push(`| ${emptyMsg} |`);
  } else {
    rows.forEach(row => {
      const wrappedCols = columns.map((col, idx) => wrapTextToWidth(row[idx] ?? '', col.width));
      const maxHeight = Math.max(...wrappedCols.map(w => w.length));
      for (let lineIdx = 0; lineIdx < maxHeight; lineIdx++) {
        const renderedCells = columns.map((col, colIdx) => {
          const text = wrappedCols[colIdx][lineIdx] ?? '';
          return ` ${formatCell(text, col.width, col.align)} `;
        });
        lines.push(`|${renderedCells.join('|')}|`);
      }
    });
  }

  lines.push(border);

  if (footerRow && footerRow.length === columns.length) {
    const renderedFooter = columns.map((col, idx) => ` ${formatCell(footerRow[idx] ?? '', col.width, col.align)} `);
    lines.push(`|${renderedFooter.join('|')}|`);
    lines.push(border);
  }

  return lines;
}

/**
 * Gera a versão do relatório em tabelas no mesmo formato, ordem, cabeçalhos e colunas
 * da exportação em PDF (generateStockReportHtml), pronta para envio no corpo do e-mail.
 */
export function generateStockReportEmailTableText(params: GenerateReportParams): string {
  const {
    selectedStock,
    todayDateFormatted,
    activeUser,
    includeEquipmentDefects = true,
    isMobile = false,
    isRecontagem = false,
  } = params;

  const data = buildStructuredReportData(params);
  const lines: string[] = [];

  // Larguras adaptadas para leitura limpa no corpo do e-mail em desktop e celular
  const wCode = isMobile ? 8 : 10;
  const wQty = isMobile ? 8 : 11;
  const wDesc3 = isMobile ? 28 : 42;

  lines.push('GRUPO MS');
  lines.push(isRecontagem ? 'RELATÓRIO DE RECONTAGEM DE ESTOQUE' : 'CONTAGEM DE ESTOQUE');
  lines.push('Gestão de Materiais & Equipamentos');
  lines.push(`Data da ${isRecontagem ? 'Recontagem' : 'Contagem'}: ${todayDateFormatted}`);
  if (params.branch) {
    lines.push(`Base / Unidade: ${params.branch}`);
  }
  if (activeUser) {
    lines.push(`Conferente: ${activeUser.name}`);
  }
  lines.push(`Estoque: ${data.stockLabel}`);
  lines.push('');

  // =========================================================
  // 1ª INFORMAÇÃO DO RELATÓRIO: ESTOQUE CONSOLIDADO (IDÊNTICO AO PDF)
  // =========================================================
  lines.push('ESTOQUE CONSOLIDADO');

  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    if (data.consolidadoMatRows.length > 0) {
      lines.push('ESTOQUE CONSOLIDADO: MATERIAIS');
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'Código', width: wCode, align: 'left' },
            { header: 'Descrição do Item', width: wDesc3, align: 'left' },
            { header: 'Quantidade', width: wQty, align: 'right' },
          ],
          data.consolidadoMatRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
          ['TOTAL', 'TOTAL GERAL DE MATERIAIS:', `${data.totalGeralMateriais} un`]
        )
      );
    } else {
      lines.push('ESTOQUE CONSOLIDADO (MATERIAIS): Nenhum material contado até o momento.');
    }
    lines.push('');
  }

  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    if (data.totalEquipamentosGeral > 0) {
      lines.push(`ESTOQUE CONSOLIDADO: EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}`);
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'Código', width: wCode, align: 'left' },
            { header: 'Descrição do Equipamento', width: wDesc3, align: 'left' },
            { header: 'Quantidade', width: wQty, align: 'right' },
          ],
          data.consolidadoEquipRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
          ['TOTAL', `TOTAL GERAL DE EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}:`, `${data.totalEquipamentosGeral} un`]
        )
      );
    } else {
      lines.push('ESTOQUE CONSOLIDADO (EQUIPAMENTOS): Nenhum equipamento contado até o momento.');
    }
    lines.push('');
  }

  // =========================================================
  // DETALHAMENTO: ESTOQUE DE MATERIAIS (DETALHADO) (IDÊNTICO AO PDF)
  // =========================================================
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    lines.push('ESTOQUE DE MATERIAIS (DETALHADO)');

    if (data.dispMatRows.length > 0) {
      lines.push('1 ITENS DISPONÍVEIS');
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'Código', width: wCode, align: 'left' },
            { header: 'Descrição do Material', width: wDesc3, align: 'left' },
            { header: 'Quantidade', width: wQty, align: 'right' },
          ],
          data.dispMatRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
          ['SUBTOTAL', 'Subtotal Disponíveis:', `${data.subtotalMatDisp} un`]
        )
      );
      lines.push('');
    }

    if (data.danifMatRows.length > 0) {
      lines.push('2 ITENS DANIFICADOS');
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'Código', width: wCode, align: 'left' },
            { header: 'Descrição do Material', width: wDesc3, align: 'left' },
            { header: 'Quantidade', width: wQty, align: 'right' },
          ],
          data.danifMatRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
          ['SUBTOTAL', 'Subtotal Danificados:', `${data.subtotalMatDanif} un`]
        )
      );
      lines.push('');
    }

    if (data.vazioRotaRows.length > 0) {
      lines.push('3 ITENS VAZIO E EM ROTA');
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'Código', width: wCode, align: 'left' },
            { header: 'Descrição do Material', width: isMobile ? 19 : 30, align: 'left' },
            { header: 'Situação', width: isMobile ? 9 : 11, align: 'left' },
            { header: 'Quantidade', width: wQty, align: 'right' },
          ],
          data.vazioRotaRows.map(r => [`[${r.code}]`, r.name, r.situation, `${r.quantity} un`]),
          ['SUBTOTAL', 'Subtotal Vazio e Em Rota:', '', `${data.subtotalMatVazioRota} un`]
        )
      );
      lines.push('');
    }
  }

  // =========================================================
  // DETALHAMENTO: ESTOQUE DE EQUIPAMENTOS (DETALHADO) (IDÊNTICO AO PDF)
  // =========================================================
  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    if (isRecontagem) {
      lines.push('ESTOQUE DE EQUIPAMENTOS (RECONTAGEM - DETALHADO)');

      if (data.emEstoqueEquips.length > 0) {
        lines.push('1 EQUIPAMENTOS EM ESTOQUE');
        lines.push(
          ...renderAsciiTable(
            [
              { header: 'Código', width: wCode, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 10 : 12, align: 'left' },
              { header: 'Descrição / Especificações', width: isMobile ? 26 : 41, align: 'left' },
            ],
            data.emEstoqueEquips.map(eq => [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs]),
            ['SUBTOTAL', 'Subtotal Em Estoque:', `${data.emEstoqueEquips.length} un`]
          )
        );
        lines.push('');
      }

      if (data.naoConstaEquips.length > 0) {
        lines.push('2 EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE');
        lines.push(
          ...renderAsciiTable(
            [
              { header: 'Código', width: wCode, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 10 : 12, align: 'left' },
              { header: 'Descrição / Especificações', width: isMobile ? 26 : 41, align: 'left' },
            ],
            data.naoConstaEquips.map(eq => [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs]),
            ['SUBTOTAL', 'Subtotal Não Constam em Estoque:', `${data.naoConstaEquips.length} un`]
          )
        );
        lines.push('');
      }
    } else {
      lines.push('ESTOQUE DE EQUIPAMENTOS (DETALHADO)');

      if (data.dispEquips.length > 0) {
        lines.push('1 ITENS DISPONÍVEIS');
        const dispCols: TableColumnSpec[] = includeEquipmentDefects
          ? [
              { header: 'Código', width: isMobile ? 8 : 9, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 9 : 11, align: 'left' },
              { header: 'Descrição / Especificações', width: isMobile ? 18 : 28, align: 'left' },
              { header: 'Observações', width: isMobile ? 13 : 18, align: 'left' },
            ]
          : [
              { header: 'Código', width: wCode, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 10 : 12, align: 'left' },
              { header: 'Descrição / Especificações', width: isMobile ? 26 : 41, align: 'left' },
            ];
        const dispRows = data.dispEquips.map(eq =>
          includeEquipmentDefects
            ? [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs, eq.observations?.trim() || '-']
            : [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs]
        );
        const dispFooter = includeEquipmentDefects
          ? ['SUBTOTAL', 'Subtotal Disponíveis:', '', `${data.dispEquips.length} un`]
          : ['SUBTOTAL', 'Subtotal Disponíveis:', `${data.dispEquips.length} un`];
        lines.push(...renderAsciiTable(dispCols, dispRows, dispFooter));
        lines.push('');
      }

      if (data.danifEquips.length > 0) {
        lines.push('2 ITENS DANIFICADOS');
        const danifCols: TableColumnSpec[] = includeEquipmentDefects
          ? [
              { header: 'Código', width: isMobile ? 8 : 9, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 9 : 11, align: 'left' },
              { header: 'Descrição / Especificações', width: isMobile ? 15 : 22, align: 'left' },
              { header: 'Defeito', width: isMobile ? 11 : 15, align: 'left' },
              { header: 'Observações', width: isMobile ? 10 : 14, align: 'left' },
            ]
          : [
              { header: 'Código', width: wCode, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 10 : 12, align: 'left' },
              { header: 'Descrição / Especificações', width: isMobile ? 26 : 41, align: 'left' },
            ];
        const danifRows = data.danifEquips.map(eq => {
          if (!includeEquipmentDefects) {
            return [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs];
          }
          return [
            eq.code ? `[${eq.code}]` : '-',
            eq.patrimony,
            eq.fullNameWithSpecs,
            eq.damageDescription || '-',
            eq.observations?.trim() || '-',
          ];
        });
        const danifFooter = includeEquipmentDefects
          ? ['SUBTOTAL', 'Subtotal Danificados:', '', '', `${data.danifEquips.length} un`]
          : ['SUBTOTAL', 'Subtotal Danificados:', `${data.danifEquips.length} un`];
        lines.push(...renderAsciiTable(danifCols, danifRows, danifFooter));
        lines.push('');
      }

      if (data.uncatEquips.length > 0) {
        lines.push('3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM)');
        const uncatCols: TableColumnSpec[] = includeEquipmentDefects
          ? [
              { header: 'Código', width: isMobile ? 9 : 10, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 9 : 11, align: 'left' },
              { header: 'Descrição / Identificação', width: isMobile ? 15 : 22, align: 'left' },
              { header: 'Defeito', width: isMobile ? 11 : 15, align: 'left' },
              { header: 'Observações', width: isMobile ? 10 : 14, align: 'left' },
            ]
          : [
              { header: 'Código', width: wCode, align: 'left' },
              { header: 'Patrimônio', width: isMobile ? 10 : 12, align: 'left' },
              { header: 'Descrição / Identificação', width: isMobile ? 26 : 41, align: 'left' },
            ];
        const uncatRows = data.uncatEquips.map(u => {
          const codeStr = u.code && u.code !== '0' ? `[${u.code}]` : '[NÃO-CAD]';
          if (!includeEquipmentDefects) {
            return [codeStr, u.patrimony, u.fullNameWithSpecs];
          }
          return [
            codeStr,
            u.patrimony,
            u.fullNameWithSpecs,
            u.damageDescription || '-',
            u.observations?.trim() || '-',
          ];
        });
        const uncatFooter = includeEquipmentDefects
          ? ['SUBTOTAL', 'Subtotal Não Cadastrados:', '', '', `${data.uncatEquips.length} un`]
          : ['SUBTOTAL', 'Subtotal Não Cadastrados:', `${data.uncatEquips.length} un`];
        lines.push(...renderAsciiTable(uncatCols, uncatRows, uncatFooter));
        lines.push('');
      }
    }
  }

  lines.push('Relatório Oficial de Contagem emitido pelo aplicativo CONTAGEM DE MATERIAIS & EQUIPAMENTOS do Grupo MS.');
  return lines.join('\n');
}

/**
 * Função auxiliar para escapar caracteres HTML com segurança
 */
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Gera a versão HTML oficial do relatório para envio por e-mail / PDF,
 * formatado como PLANILHA com bordas, linhas e cabeçalhos.
 * Estoque consolidado movido para a primeira informação do relatório.
 */
export function generateStockReportHtml(params: GenerateReportParams): string {
  const {
    selectedStock,
    todayDateFormatted,
    activeUser,
    includeEquipmentDefects = true,
    isRecontagem = false,
  } = params;

  const data = buildStructuredReportData(params);
  let tablesHtml = '';

  // -------------------------------------------------------------
  // 1ª INFORMAÇÃO DO RELATÓRIO: ESTOQUE CONSOLIDADO
  // -------------------------------------------------------------
  tablesHtml += `
    <div style="margin-bottom: 24px;">
      <div style="background-color: #065f46; color: #ffffff; padding: 10px 14px; font-size: 13.5px; font-weight: 900; letter-spacing: 0.5px; border-radius: 6px 6px 0 0; text-transform: uppercase;">
        ESTOQUE CONSOLIDADO
      </div>
  `;

  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    tablesHtml += data.consolidadoMatRows.length > 0
      ? `
        <table width="100%" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 2.5px solid #059669; font-family: Arial, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <thead>
            <tr style="background-color: #065f46; color: #ffffff;">
              <th colspan="3" style="padding: 10px 14px; text-align: left; font-size: 14px; font-weight: 900; text-transform: uppercase; border: 1px solid #065f46;">
                ESTOQUE CONSOLIDADO: MATERIAIS
              </th>
            </tr>
            <tr style="background-color: #d1fae5; color: #064e3b; font-size: 12.5px; font-weight: 800; text-transform: uppercase;">
              <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left; width: 20%;">Código</th>
              <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left;">Descrição do Item</th>
              <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: right; width: 25%;">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${data.consolidadoMatRows.map(r => `
              <tr style="background-color: #ffffff;">
                <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(r.code)}]</td>
                <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14px; font-weight: 800; color: #0f172a;">${escapeHtml(r.name)}</td>
                <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 900; color: #047857; text-align: right;">${r.quantity} un</td>
              </tr>
            `).join('')}
            <tr style="background-color: #059669; color: #ffffff;">
              <td colspan="2" style="padding: 11px 14px; border: 1.5px solid #047857; font-size: 15px; font-weight: 900; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">
                TOTAL GERAL DE MATERIAIS:
              </td>
              <td style="padding: 11px 14px; border: 1.5px solid #047857; font-size: 16px; font-weight: 900; text-align: right;">
                ${data.totalGeralMateriais} un
              </td>
            </tr>
          </tbody>
        </table>
      `
      : `
        <table width="100%" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1.5px solid #a7f3d0; font-family: Arial, sans-serif;">
          <tr><td style="padding: 10px 12px; font-size: 12.5px; color: #475569; font-weight: 600;">ESTOQUE CONSOLIDADO (MATERIAIS): Nenhum material contado até o momento.</td></tr>
        </table>
      `;
  }

  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    tablesHtml += data.totalEquipamentosGeral > 0
      ? `
        <table width="100%" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 2.5px solid #059669; font-family: Arial, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <thead>
            <tr style="background-color: #065f46; color: #ffffff;">
              <th colspan="3" style="padding: 10px 14px; text-align: left; font-size: 14px; font-weight: 900; text-transform: uppercase; border: 1px solid #065f46;">
                ESTOQUE CONSOLIDADO: EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}
              </th>
            </tr>
            <tr style="background-color: #d1fae5; color: #064e3b; font-size: 12.5px; font-weight: 800; text-transform: uppercase;">
              <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left; width: 20%;">Código</th>
              <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left;">Descrição do Equipamento</th>
              <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: right; width: 25%;">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            ${data.consolidadoEquipRows.map(g => `
              <tr style="background-color: #ffffff;">
                <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(g.code)}]</td>
                <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14px; font-weight: 800; color: #0f172a;">${escapeHtml(g.name)}</td>
                <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 900; color: #047857; text-align: right;">${g.quantity} un</td>
              </tr>
            `).join('')}
            <tr style="background-color: #059669; color: #ffffff;">
              <td colspan="2" style="padding: 11px 14px; border: 1.5px solid #047857; font-size: 15px; font-weight: 900; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">
                TOTAL GERAL DE EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}:
              </td>
              <td style="padding: 11px 14px; border: 1.5px solid #047857; font-size: 16px; font-weight: 900; text-align: right;">
                ${data.totalEquipamentosGeral} un
              </td>
            </tr>
          </tbody>
        </table>
      `
      : `
        <table width="100%" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 14px; border: 1.5px solid #a7f3d0; font-family: Arial, sans-serif;">
          <tr><td style="padding: 10px 12px; font-size: 12.5px; color: #475569; font-weight: 600;">ESTOQUE CONSOLIDADO (EQUIPAMENTOS): Nenhum equipamento contado até o momento.</td></tr>
        </table>
      `;
  }

  tablesHtml += `</div>`;

  // -------------------------------------------------------------
  // DETALHAMENTO: ESTOQUE DE MATERIAIS EM PLANILHA
  // -------------------------------------------------------------
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    tablesHtml += `
      <div style="margin-bottom: 24px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 6px 6px 0 0; text-transform: uppercase;">
          ESTOQUE DE MATERIAIS (DETALHADO)
        </div>

        ${data.dispMatRows.length > 0 ? `
          <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
            <thead>
              <tr style="background-color: #f1f5f9; color: #1e293b;">
                <th colspan="3" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #cbd5e1; background-color: #e2e8f0;">
                  1 ITENS DISPONÍVEIS
                </th>
              </tr>
              <tr style="background-color: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left; width: 18%;">Código</th>
                <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left;">Descrição do Material</th>
                <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; width: 20%;">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${data.dispMatRows.map(r => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11.5px;">[${escapeHtml(r.code)}]</td>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${r.quantity} un</td>
                </tr>
              `).join('')}
              <tr style="background-color: #f1f5f9; font-weight: bold;">
                <td colspan="2" style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right;">Subtotal Disponíveis:</td>
                <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; color: #047857;">${data.subtotalMatDisp} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        ${data.danifMatRows.length > 0 ? `
          <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
            <thead>
              <tr style="background-color: #fee2e2; color: #991b1b;">
                <th colspan="3" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #fca5a5;">
                  2 ITENS DANIFICADOS
                </th>
              </tr>
              <tr style="background-color: #fff5f5; color: #7f1d1d; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left; width: 18%;">Código</th>
                <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left;">Descrição do Material</th>
                <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: right; width: 20%;">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${data.danifMatRows.map(r => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #fecaca; font-family: monospace; font-size: 11.5px;">[${escapeHtml(r.code)}]</td>
                  <td style="padding: 6px 10px; border: 1px solid #fecaca;">${escapeHtml(r.name)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #fecaca; text-align: right; font-weight: 600; color: #b91c1c;">${r.quantity} un</td>
                </tr>
              `).join('')}
              <tr style="background-color: #fee2e2; font-weight: bold;">
                <td colspan="2" style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right;">Subtotal Danificados:</td>
                <td style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right; color: #b91c1c;">${data.subtotalMatDanif} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        ${data.vazioRotaRows.length > 0 ? `
          <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
            <thead>
              <tr style="background-color: #fef3c7; color: #92400e;">
                <th colspan="4" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #fcd34d;">
                  3 ITENS VAZIO E EM ROTA
                </th>
              </tr>
              <tr style="background-color: #fffbeb; color: #78350f; font-size: 11px; text-transform: uppercase;">
                <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left; width: 18%;">Código</th>
                <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left;">Descrição do Material</th>
                <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left; width: 18%;">Situação</th>
                <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: right; width: 18%;">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              ${data.vazioRotaRows.map(r => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; font-family: monospace; font-size: 11.5px;">[${escapeHtml(r.code)}]</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a;">${escapeHtml(r.name)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; font-weight: 600; color: #92400e;">${escapeHtml(r.situation)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; text-align: right; font-weight: 600;">${r.quantity} un</td>
                </tr>
              `).join('')}
              <tr style="background-color: #fef3c7; font-weight: bold;">
                <td colspan="3" style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right;">Subtotal Vazio e Em Rota:</td>
                <td style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right; color: #92400e;">${data.subtotalMatVazioRota} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }

  // -------------------------------------------------------------
  // DETALHAMENTO: ESTOQUE DE EQUIPAMENTOS EM PLANILHA
  // -------------------------------------------------------------
  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    if (isRecontagem) {
      tablesHtml += `
        <div style="margin-bottom: 24px;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 6px 6px 0 0; text-transform: uppercase;">
            ESTOQUE DE EQUIPAMENTOS (RECONTAGEM - DETALHADO)
          </div>

          ${data.emEstoqueEquips.length > 0 ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
              <thead>
                <tr style="background-color: #d1fae5; color: #065f46;">
                  <th colspan="3" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #6ee7b7; background-color: #a7f3d0;">
                    1 EQUIPAMENTOS EM ESTOQUE
                  </th>
                </tr>
                <tr style="background-color: #f0fdf4; color: #166534; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 6px 10px; border: 1px solid #6ee7b7; text-align: left; width: 14%;">Código</th>
                  <th style="padding: 6px 10px; border: 1px solid #6ee7b7; text-align: left; width: 18%;">Patrimônio</th>
                  <th style="padding: 6px 10px; border: 1px solid #6ee7b7; text-align: left;">Descrição / Especificações</th>
                </tr>
              </thead>
              <tbody>
                ${data.emEstoqueEquips.map(eq => `
                  <tr>
                    <td style="padding: 6px 10px; border: 1px solid #a7f3d0; font-family: monospace; font-size: 11.5px;">${eq.code ? `[${escapeHtml(eq.code)}]` : '-'}</td>
                    <td style="padding: 6px 10px; border: 1px solid #a7f3d0; font-weight: 700; color: #047857;">${escapeHtml(eq.patrimony)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #a7f3d0;">${escapeHtml(eq.fullNameWithSpecs)}</td>
                  </tr>
                `).join('')}
                <tr style="background-color: #d1fae5; font-weight: bold;">
                  <td colspan="2" style="padding: 7px 10px; border: 1px solid #6ee7b7; text-align: right;">Subtotal Em Estoque:</td>
                  <td style="padding: 7px 10px; border: 1px solid #6ee7b7; text-align: right; color: #047857;">${data.emEstoqueEquips.length} un</td>
                </tr>
              </tbody>
            </table>
          ` : ''}

          ${data.naoConstaEquips.length > 0 ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
              <thead>
                <tr style="background-color: #fee2e2; color: #991b1b;">
                  <th colspan="3" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #fca5a5; background-color: #fecaca;">
                    2 EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE
                  </th>
                </tr>
                <tr style="background-color: #fff5f5; color: #7f1d1d; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left; width: 14%;">Código</th>
                  <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left; width: 18%;">Patrimônio</th>
                  <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left;">Descrição / Especificações</th>
                </tr>
              </thead>
              <tbody>
                ${data.naoConstaEquips.map(eq => `
                  <tr>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca; font-family: monospace; font-size: 11.5px;">${eq.code ? `[${escapeHtml(eq.code)}]` : '-'}</td>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca; font-weight: 700; color: #b91c1c;">${escapeHtml(eq.patrimony)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca;">${escapeHtml(eq.fullNameWithSpecs)}</td>
                  </tr>
                `).join('')}
                <tr style="background-color: #fee2e2; font-weight: bold;">
                  <td colspan="2" style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right;">Subtotal Não Constam em Estoque:</td>
                  <td style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right; color: #b91c1c;">${data.naoConstaEquips.length} un</td>
                </tr>
              </tbody>
            </table>
          ` : ''}
        </div>
      `;
    } else {
      tablesHtml += `
        <div style="margin-bottom: 24px;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 6px 6px 0 0; text-transform: uppercase;">
            ESTOQUE DE EQUIPAMENTOS (DETALHADO)
          </div>

          ${data.dispEquips.length > 0 ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
              <thead>
                <tr style="background-color: #f1f5f9; color: #1e293b;">
                  <th colspan="${includeEquipmentDefects ? '4' : '3'}" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #cbd5e1; background-color: #e2e8f0;">
                    1 ITENS DISPONÍVEIS
                  </th>
                </tr>
                <tr style="background-color: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left; width: 14%;">Código</th>
                  <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left; width: 18%;">Patrimônio</th>
                  <th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left;">Descrição / Especificações</th>
                  ${includeEquipmentDefects ? '<th style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: left; width: 25%;">Observações</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${data.dispEquips.map(eq => `
                  <tr>
                    <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11.5px;">${eq.code ? `[${escapeHtml(eq.code)}]` : '-'}</td>
                    <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">${escapeHtml(eq.patrimony)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${escapeHtml(eq.fullNameWithSpecs)}</td>
                    ${includeEquipmentDefects ? `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${escapeHtml(eq.observations || '-')}</td>` : ''}
                  </tr>
                `).join('')}
                <tr style="background-color: #f1f5f9; font-weight: bold;">
                  <td colspan="${includeEquipmentDefects ? '3' : '2'}" style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right;">Subtotal Disponíveis:</td>
                  <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; color: #047857;">${data.dispEquips.length} un</td>
                </tr>
              </tbody>
            </table>
          ` : ''}

          ${data.danifEquips.length > 0 ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
              <thead>
                <tr style="background-color: #fee2e2; color: #991b1b;">
                  <th colspan="${includeEquipmentDefects ? '5' : '3'}" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #fca5a5;">
                    2 ITENS DANIFICADOS
                  </th>
                </tr>
                <tr style="background-color: #fff5f5; color: #7f1d1d; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left; width: 14%;">Código</th>
                  <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left; width: 18%;">Patrimônio</th>
                  <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left;">Descrição / Especificações</th>
                  ${includeEquipmentDefects ? `
                    <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left; width: 22%;">Defeito</th>
                    <th style="padding: 6px 10px; border: 1px solid #fca5a5; text-align: left; width: 20%;">Observações</th>
                  ` : ''}
                </tr>
              </thead>
              <tbody>
                ${data.danifEquips.map(eq => `
                  <tr>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca; font-family: monospace; font-size: 11.5px;">${eq.code ? `[${escapeHtml(eq.code)}]` : '-'}</td>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca; font-weight: 700; color: #b91c1c;">${escapeHtml(eq.patrimony)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca;">${escapeHtml(eq.fullNameWithSpecs)}</td>
                    ${includeEquipmentDefects ? `
                      <td style="padding: 6px 10px; border: 1px solid #fecaca; font-weight: 600; color: #b91c1c;">${escapeHtml(eq.damageDescription || '-')}</td>
                      <td style="padding: 6px 10px; border: 1px solid #fecaca; font-size: 11px; color: #475569;">${escapeHtml(eq.observations || '-')}</td>
                    ` : ''}
                  </tr>
                `).join('')}
                <tr style="background-color: #fee2e2; font-weight: bold;">
                  <td colspan="${includeEquipmentDefects ? '4' : '2'}" style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right;">Subtotal Danificados:</td>
                  <td style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right; color: #b91c1c;">${data.danifEquips.length} un</td>
                </tr>
              </tbody>
            </table>
          ` : ''}

          ${data.uncatEquips.length > 0 ? `
            <table width="100%" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #cbd5e1; font-size: 12px; font-family: Arial, sans-serif;">
              <thead>
                <tr style="background-color: #fef3c7; color: #92400e;">
                  <th colspan="${includeEquipmentDefects ? '5' : '3'}" style="padding: 7px 10px; text-align: left; font-size: 11.5px; font-weight: 800; border: 1px solid #fcd34d;">
                    3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM)
                  </th>
                </tr>
                <tr style="background-color: #fffbeb; color: #78350f; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left; width: 14%;">Código</th>
                  <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left; width: 18%;">Patrimônio</th>
                  <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left;">Descrição / Identificação</th>
                  ${includeEquipmentDefects ? `
                    <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left; width: 22%;">Defeito</th>
                    <th style="padding: 6px 10px; border: 1px solid #fcd34d; text-align: left; width: 20%;">Observações</th>
                  ` : ''}
                </tr>
              </thead>
              <tbody>
                ${data.uncatEquips.map(u => {
                  const codeStr = u.code && u.code !== '0' ? u.code : 'NÃO-CAD';
                  return `
                    <tr>
                      <td style="padding: 6px 10px; border: 1px solid #fde68a; font-family: monospace; font-size: 11.5px; font-weight: 700;">[${escapeHtml(codeStr)}]</td>
                      <td style="padding: 6px 10px; border: 1px solid #fde68a; font-weight: 700; color: #92400e;">${escapeHtml(u.patrimony)}</td>
                      <td style="padding: 6px 10px; border: 1px solid #fde68a;">${escapeHtml(u.fullNameWithSpecs)}</td>
                      ${includeEquipmentDefects ? `
                        <td style="padding: 6px 10px; border: 1px solid #fde68a; font-weight: 600; color: #b91c1c;">${escapeHtml(u.damageDescription || '-')}</td>
                        <td style="padding: 6px 10px; border: 1px solid #fde68a; font-size: 11px; color: #475569;">${escapeHtml(u.observations || '-')}</td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
                <tr style="background-color: #fef3c7; font-weight: bold;">
                  <td colspan="${includeEquipmentDefects ? '4' : '2'}" style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right;">Subtotal Não Cadastrados:</td>
                  <td style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right; color: #92400e;">${data.uncatEquips.length} un</td>
                </tr>
              </tbody>
            </table>
          ` : ''}
        </div>
      `;
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const primaryLogoSrc = cachedGrupoMsLogoDataUrl || `${origin}${GRUPO_MS_LOGO_PATH}`;
  const fallbackLogoSrc = `${origin}/logo-grupo-ms.png`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Contagem - Grupo MS</title>
</head>
<body style="margin: 0; padding: 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 860px; margin: 0 auto; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- CABEÇALHO COM LOGO GRUPO MS DA TELA DE LOGIN AO LADO ESQUERDO -->
    <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-bottom: 3px solid #059669; padding-bottom: 16px;">
      <tr>
        <td align="left" valign="middle" style="padding-bottom: 16px; width: 45%;">
          <img src="${primaryLogoSrc}" onerror="if(this.src!=='${fallbackLogoSrc}'){this.src='${fallbackLogoSrc}';}" alt="GRUPO MS" style="display: block; max-height: 90px; max-width: 200px; width: auto; height: auto; border: 0;" />
        </td>
        <td align="right" valign="middle" style="padding-bottom: 16px; width: 55%; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${isRecontagem ? 'RELATÓRIO DE RECONTAGEM DE ESTOQUE' : 'CONTAGEM DE ESTOQUE'}</div>
          <div style="font-size: 13px; color: #475569; margin-top: 3px;">Gestão de Materiais &amp; Equipamentos</div>
          <div style="font-size: 13px; color: #059669; font-weight: 700; margin-top: 6px;">Data da ${isRecontagem ? 'Recontagem' : 'Contagem'}: ${escapeHtml(todayDateFormatted)}</div>
          ${params.branch ? `<div style="font-size: 12px; color: #b45309; font-weight: 800; margin-top: 2px;">Base / Unidade: <strong>${escapeHtml(params.branch)}</strong></div>` : ''}
          ${activeUser ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Conferente: <strong>${escapeHtml(activeUser.name)}</strong></div>` : ''}
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Estoque: <strong>${escapeHtml(data.stockLabel)}</strong></div>
        </td>
      </tr>
    </table>

    <!-- CORPO COM AS TABELAS DE PLANILHA -->
    ${tablesHtml}

    <!-- RODAPÉ -->
    <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">
      Relatório Oficial de Contagem emitido pelo aplicativo <strong>CONTAGEM DE MATERIAIS &amp; EQUIPAMENTOS</strong> do <strong>Grupo MS</strong>.
    </div>
  </div>
</body>
</html>
  `.trim();
}

export interface GeneratedPdfReport {
  blob: Blob;
  file: File;
  fileName: string;
  base64: string;
}

interface NormalizedLogoAsset {
  dataUrl: string;
  width: number;
  height: number;
}

async function normalizeLogoToPngDataUrl(rawDataUrl: string | null): Promise<NormalizedLogoAsset | null> {
  if (!rawDataUrl || typeof window === 'undefined' || typeof Image === 'undefined') {
    return null;
  }

  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width || 240;
        const h = img.naturalHeight || img.height || 100;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const pngDataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl: pngDataUrl, width: w, height: h });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = rawDataUrl;
  });
}

function resolveBranchSlug(branch?: string): string {
  if (!branch) return 'GERAL';
  if (
    branch === 'PAULO AFONSO' ||
    branch === 'DELMIRO' ||
    branch === 'PAULO AFONSO (TESTE)' ||
    branch === 'DELMIRO (TESTE)'
  ) {
    return getBranchFileSlug(branch as UnitBranch);
  }
  return branch.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase() || 'GERAL';
}

function getLastAutoTableY(doc: jsPDF, fallbackY: number): number {
  const internalDoc = doc as unknown as { lastAutoTable?: { finalY?: number } };
  return internalDoc.lastAutoTable?.finalY ?? fallbackY;
}

/**
 * Gera o arquivo PDF oficial do relatório em memória (Blob / File) com a mesma formatação,
 * cores, logomarca Grupo MS, ordem de seções e colunas do PDF exportado em Opções de Envio & E-mails.
 */
export async function generateStockReportPdfBlob(
  params: GenerateReportParams
): Promise<GeneratedPdfReport> {
  const {
    selectedStock,
    todayDateFormatted,
    activeUser,
    includeEquipmentDefects = true,
    isRecontagem = false,
  } = params;

  const data = buildStructuredReportData(params);
  const rawLogo = await preloadGrupoMsLogoDataUrl().catch(() => null);
  const logoAsset = await normalizeLogoToPngDataUrl(rawLogo);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;

  const ensureSpace = (currentY: number, neededHeight: number): number => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      return 14;
    }
    return currentY;
  };

  const drawSectionBanner = (
    currentY: number,
    title: string,
    fillColor: [number, number, number]
  ): number => {
    const startY = ensureSpace(currentY, 16);
    doc.setFillColor(...fillColor);
    doc.roundedRect(margin, startY, contentWidth, 8.5, 1.5, 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(title.toUpperCase(), margin + 3.5, startY + 5.7);
    return startY + 11;
  };

  const drawEmptyBox = (
    currentY: number,
    text: string,
    borderColor: [number, number, number]
  ): number => {
    const startY = ensureSpace(currentY, 12);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.35);
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, startY, contentWidth, 9, 'FD');
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(text, margin + 3, startY + 5.8);
    return startY + 12;
  };

  // -------------------------------------------------------------
  // CABEÇALHO COM LOGO GRUPO MS DA TELA DE LOGIN AO LADO ESQUERDO
  // -------------------------------------------------------------
  const headerTopY = 12;
  let rightY = headerTopY + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(
    isRecontagem ? 'RELATÓRIO DE RECONTAGEM DE ESTOQUE' : 'CONTAGEM DE ESTOQUE',
    pageWidth - margin,
    rightY,
    { align: 'right' }
  );
  rightY += 4.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Gestão de Materiais & Equipamentos', pageWidth - margin, rightY, { align: 'right' });
  rightY += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text(
    `Data da ${isRecontagem ? 'Recontagem' : 'Contagem'}: ${todayDateFormatted}`,
    pageWidth - margin,
    rightY,
    { align: 'right' }
  );
  rightY += 4.5;

  if (params.branch) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(180, 83, 9);
    doc.text(`Base / Unidade: ${params.branch}`, pageWidth - margin, rightY, { align: 'right' });
    rightY += 4.3;
  }

  if (activeUser) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Conferente: ${activeUser.name}`, pageWidth - margin, rightY, { align: 'right' });
    rightY += 4.3;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Estoque: ${data.stockLabel}`, pageWidth - margin, rightY, { align: 'right' });

  const headerBottomMetaY = rightY + 3;
  let logoBottomY = headerTopY + 18;

  if (logoAsset) {
    const maxW = 48;
    const maxH = 22;
    const scale = Math.min(maxW / logoAsset.width, maxH / logoAsset.height);
    const drawW = logoAsset.width * scale;
    const drawH = logoAsset.height * scale;
    const logoCenterY = headerTopY + Math.max(0, (headerBottomMetaY - headerTopY - drawH) / 2);
    doc.addImage(logoAsset.dataUrl, 'PNG', margin, logoCenterY, drawW, drawH);
    logoBottomY = logoCenterY + drawH;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('GRUPO MS', margin, headerTopY + 10);
  }

  let y = Math.max(headerBottomMetaY, logoBottomY) + 3;
  doc.setDrawColor(5, 150, 105);
  doc.setLineWidth(0.9);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // -------------------------------------------------------------
  // 1ª INFORMAÇÃO DO RELATÓRIO: ESTOQUE CONSOLIDADO
  // -------------------------------------------------------------
  y = drawSectionBanner(y, 'ESTOQUE CONSOLIDADO', [6, 95, 70]);

  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    if (data.consolidadoMatRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        showHead: 'everyPage',
        showFoot: 'lastPage',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: 2.3,
          lineColor: [167, 243, 208],
          lineWidth: 0.35,
          textColor: [15, 23, 42],
          valign: 'middle',
        },
        head: [
          [
            {
              content: 'ESTOQUE CONSOLIDADO: MATERIAIS',
              colSpan: 3,
              styles: {
                fillColor: [6, 95, 70],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'left',
              },
            },
          ],
          [
            { content: 'CÓDIGO', styles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontStyle: 'bold' } },
            { content: 'DESCRIÇÃO DO ITEM', styles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontStyle: 'bold' } },
            { content: 'QUANTIDADE', styles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        body: data.consolidadoMatRows.map(r => [
          { content: `[${r.code}]`, styles: { font: 'courier', fontStyle: 'bold', textColor: [6, 95, 70] } },
          { content: r.name, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
          { content: `${r.quantity} un`, styles: { fontStyle: 'bold', textColor: [4, 120, 87], halign: 'right' } },
        ]) as RowInput[],
        foot: [
          [
            {
              content: 'TOTAL GERAL DE MATERIAIS:',
              colSpan: 2,
              styles: {
                fillColor: [5, 150, 105],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9.5,
                halign: 'right',
              },
            },
            {
              content: `${data.totalGeralMateriais} un`,
              styles: {
                fillColor: [5, 150, 105],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10,
                halign: 'right',
              },
            },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 34 },
          2: { cellWidth: 36, halign: 'right' },
        },
      });
      y = getLastAutoTableY(doc, y) + 4.5;
    } else {
      y = drawEmptyBox(
        y,
        'ESTOQUE CONSOLIDADO (MATERIAIS): Nenhum material contado até o momento.',
        [167, 243, 208]
      );
    }
  }

  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    if (data.totalEquipamentosGeral > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        showHead: 'everyPage',
        showFoot: 'lastPage',
        styles: {
          font: 'helvetica',
          fontSize: 8.5,
          cellPadding: 2.3,
          lineColor: [167, 243, 208],
          lineWidth: 0.35,
          textColor: [15, 23, 42],
          valign: 'middle',
        },
        head: [
          [
            {
              content: `ESTOQUE CONSOLIDADO: EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}`,
              colSpan: 3,
              styles: {
                fillColor: [6, 95, 70],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9,
                halign: 'left',
              },
            },
          ],
          [
            { content: 'CÓDIGO', styles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontStyle: 'bold' } },
            { content: 'DESCRIÇÃO DO EQUIPAMENTO', styles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontStyle: 'bold' } },
            { content: 'QUANTIDADE', styles: { fillColor: [209, 250, 229], textColor: [6, 78, 59], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        body: data.consolidadoEquipRows.map(g => [
          { content: `[${g.code}]`, styles: { font: 'courier', fontStyle: 'bold', textColor: [6, 95, 70] } },
          { content: g.name, styles: { fontStyle: 'bold', textColor: [15, 23, 42] } },
          { content: `${g.quantity} un`, styles: { fontStyle: 'bold', textColor: [4, 120, 87], halign: 'right' } },
        ]) as RowInput[],
        foot: [
          [
            {
              content: `TOTAL GERAL DE EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}:`,
              colSpan: 2,
              styles: {
                fillColor: [5, 150, 105],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 9.5,
                halign: 'right',
              },
            },
            {
              content: `${data.totalEquipamentosGeral} un`,
              styles: {
                fillColor: [5, 150, 105],
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: 10,
                halign: 'right',
              },
            },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 34 },
          2: { cellWidth: 36, halign: 'right' },
        },
      });
      y = getLastAutoTableY(doc, y) + 5;
    } else {
      y = drawEmptyBox(
        y,
        'ESTOQUE CONSOLIDADO (EQUIPAMENTOS): Nenhum equipamento contado até o momento.',
        [167, 243, 208]
      );
    }
  }

  // -------------------------------------------------------------
  // DETALHAMENTO: ESTOQUE DE MATERIAIS (DETALHADO)
  // -------------------------------------------------------------
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    y = drawSectionBanner(y + 1, 'ESTOQUE DE MATERIAIS (DETALHADO)', [15, 23, 42]);

    if (data.dispMatRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        showHead: 'everyPage',
        showFoot: 'lastPage',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2,
          lineColor: [203, 213, 225],
          lineWidth: 0.25,
          textColor: [30, 41, 59],
          valign: 'middle',
        },
        head: [
          [
            {
              content: '1 ITENS DISPONÍVEIS',
              colSpan: 3,
              styles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8.5 },
            },
          ],
          [
            { content: 'CÓDIGO', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' } },
            { content: 'DESCRIÇÃO DO MATERIAL', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' } },
            { content: 'QUANTIDADE', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        body: data.dispMatRows.map(r => [
          { content: `[${r.code}]`, styles: { font: 'courier' } },
          r.name,
          { content: `${r.quantity} un`, styles: { fontStyle: 'bold', halign: 'right' } },
        ]) as RowInput[],
        foot: [
          [
            { content: 'Subtotal Disponíveis:', colSpan: 2, styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' } },
            { content: `${data.subtotalMatDisp} un`, styles: { fillColor: [241, 245, 249], textColor: [4, 120, 87], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          2: { cellWidth: 32, halign: 'right' },
        },
      });
      y = getLastAutoTableY(doc, y) + 4;
    }

    if (data.danifMatRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        showHead: 'everyPage',
        showFoot: 'lastPage',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2,
          lineColor: [252, 165, 165],
          lineWidth: 0.25,
          textColor: [30, 41, 59],
          valign: 'middle',
        },
        head: [
          [
            {
              content: '2 ITENS DANIFICADOS',
              colSpan: 3,
              styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 8.5 },
            },
          ],
          [
            { content: 'CÓDIGO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' } },
            { content: 'DESCRIÇÃO DO MATERIAL', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' } },
            { content: 'QUANTIDADE', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        body: data.danifMatRows.map(r => [
          { content: `[${r.code}]`, styles: { font: 'courier' } },
          r.name,
          { content: `${r.quantity} un`, styles: { fontStyle: 'bold', textColor: [185, 28, 28], halign: 'right' } },
        ]) as RowInput[],
        foot: [
          [
            { content: 'Subtotal Danificados:', colSpan: 2, styles: { fillColor: [254, 226, 226], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' } },
            { content: `${data.subtotalMatDanif} un`, styles: { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          2: { cellWidth: 32, halign: 'right' },
        },
      });
      y = getLastAutoTableY(doc, y) + 4;
    }

    if (data.vazioRotaRows.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: 'grid',
        showHead: 'everyPage',
        showFoot: 'lastPage',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: 2,
          lineColor: [252, 211, 77],
          lineWidth: 0.25,
          textColor: [30, 41, 59],
          valign: 'middle',
        },
        head: [
          [
            {
              content: '3 ITENS VAZIO E EM ROTA',
              colSpan: 4,
              styles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: 'bold', fontSize: 8.5 },
            },
          ],
          [
            { content: 'CÓDIGO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' } },
            { content: 'DESCRIÇÃO DO MATERIAL', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' } },
            { content: 'SITUAÇÃO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' } },
            { content: 'QUANTIDADE', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        body: data.vazioRotaRows.map(r => [
          { content: `[${r.code}]`, styles: { font: 'courier' } },
          r.name,
          { content: r.situation, styles: { fontStyle: 'bold', textColor: [146, 64, 14] } },
          { content: `${r.quantity} un`, styles: { fontStyle: 'bold', halign: 'right' } },
        ]) as RowInput[],
        foot: [
          [
            { content: 'Subtotal Vazio e Em Rota:', colSpan: 3, styles: { fillColor: [254, 243, 199], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' } },
            { content: `${data.subtotalMatVazioRota} un`, styles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: 'bold', halign: 'right' } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 30 },
          2: { cellWidth: 32 },
          3: { cellWidth: 30, halign: 'right' },
        },
      });
      y = getLastAutoTableY(doc, y) + 5;
    }
  }

  // -------------------------------------------------------------
  // DETALHAMENTO: ESTOQUE DE EQUIPAMENTOS (DETALHADO)
  // -------------------------------------------------------------
  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    y = drawSectionBanner(
      y + 1,
      isRecontagem
        ? 'ESTOQUE DE EQUIPAMENTOS (RECONTAGEM - DETALHADO)'
        : 'ESTOQUE DE EQUIPAMENTOS (DETALHADO)',
      [15, 23, 42]
    );

    if (isRecontagem) {
      if (data.emEstoqueEquips.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          theme: 'grid',
          showHead: 'everyPage',
          showFoot: 'lastPage',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2,
            lineColor: [110, 231, 183],
            lineWidth: 0.25,
            textColor: [30, 41, 59],
            valign: 'middle',
          },
          head: [
            [
              {
                content: '1 EQUIPAMENTOS EM ESTOQUE',
                colSpan: 3,
                styles: { fillColor: [167, 243, 208], textColor: [6, 95, 70], fontStyle: 'bold', fontSize: 8.5 },
              },
            ],
            [
              { content: 'CÓDIGO', styles: { fillColor: [240, 253, 244], textColor: [22, 101, 52], fontStyle: 'bold' } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [240, 253, 244], textColor: [22, 101, 52], fontStyle: 'bold' } },
              { content: 'DESCRIÇÃO / ESPECIFICAÇÕES', styles: { fillColor: [240, 253, 244], textColor: [22, 101, 52], fontStyle: 'bold' } },
            ],
          ],
          body: data.emEstoqueEquips.map(eq => [
            { content: eq.code ? `[${eq.code}]` : '-', styles: { font: 'courier' } },
            { content: eq.patrimony, styles: { fontStyle: 'bold', textColor: [4, 120, 87] } },
            eq.fullNameWithSpecs,
          ]) as RowInput[],
          foot: [
            [
              { content: 'Subtotal Em Estoque:', colSpan: 2, styles: { fillColor: [209, 250, 229], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' } },
              { content: `${data.emEstoqueEquips.length} un`, styles: { fillColor: [209, 250, 229], textColor: [4, 120, 87], fontStyle: 'bold', halign: 'right' } },
            ],
          ],
          columnStyles: {
            0: { cellWidth: 26 },
            1: { cellWidth: 32 },
          },
        });
        y = getLastAutoTableY(doc, y) + 4;
      }

      if (data.naoConstaEquips.length > 0) {
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          theme: 'grid',
          showHead: 'everyPage',
          showFoot: 'lastPage',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2,
            lineColor: [252, 165, 165],
            lineWidth: 0.25,
            textColor: [30, 41, 59],
            valign: 'middle',
          },
          head: [
            [
              {
                content: '2 EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE',
                colSpan: 3,
                styles: { fillColor: [254, 202, 202], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 8.5 },
              },
            ],
            [
              { content: 'CÓDIGO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' } },
              { content: 'DESCRIÇÃO / ESPECIFICAÇÕES', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' } },
            ],
          ],
          body: data.naoConstaEquips.map(eq => [
            { content: eq.code ? `[${eq.code}]` : '-', styles: { font: 'courier' } },
            { content: eq.patrimony, styles: { fontStyle: 'bold', textColor: [185, 28, 28] } },
            eq.fullNameWithSpecs,
          ]) as RowInput[],
          foot: [
            [
              { content: 'Subtotal Não Constam em Estoque:', colSpan: 2, styles: { fillColor: [254, 226, 226], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' } },
              { content: `${data.naoConstaEquips.length} un`, styles: { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: 'bold', halign: 'right' } },
            ],
          ],
          columnStyles: {
            0: { cellWidth: 26 },
            1: { cellWidth: 32 },
          },
        });
        y = getLastAutoTableY(doc, y) + 4;
      }
    } else {
      if (data.dispEquips.length > 0) {
        const dispColCount = includeEquipmentDefects ? 4 : 3;
        const dispHeaders: RowInput = includeEquipmentDefects
          ? [
              { content: 'CÓDIGO', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' as const } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' as const } },
              { content: 'DESCRIÇÃO / ESPECIFICAÇÕES', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' as const } },
              { content: 'OBSERVAÇÕES', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' as const } },
            ]
          : [
              { content: 'CÓDIGO', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' as const } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' as const } },
              { content: 'DESCRIÇÃO / ESPECIFICAÇÕES', styles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold' as const } },
            ];
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          theme: 'grid',
          showHead: 'everyPage',
          showFoot: 'lastPage',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2,
            lineColor: [203, 213, 225],
            lineWidth: 0.25,
            textColor: [30, 41, 59],
            valign: 'middle',
          },
          head: [
            [
              {
                content: '1 ITENS DISPONÍVEIS',
                colSpan: dispColCount,
                styles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8.5 },
              },
            ],
            dispHeaders,
          ],
          body: data.dispEquips.map(eq => {
            const base = [
              { content: eq.code ? `[${eq.code}]` : '-', styles: { font: 'courier' as const } },
              { content: eq.patrimony, styles: { fontStyle: 'bold' as const, textColor: [4, 120, 87] as [number, number, number] } },
              eq.fullNameWithSpecs,
            ];
            if (includeEquipmentDefects) {
              base.push({ content: eq.observations?.trim() || '-', styles: { fontSize: 7.5, textColor: [71, 85, 105] } } as never);
            }
            return base;
          }) as RowInput[],
          foot: [
            [
              {
                content: 'Subtotal Disponíveis:',
                colSpan: dispColCount - 1,
                styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' },
              },
              {
                content: `${data.dispEquips.length} un`,
                styles: { fillColor: [241, 245, 249], textColor: [4, 120, 87], fontStyle: 'bold', halign: 'right' },
              },
            ],
          ],
          columnStyles: includeEquipmentDefects
            ? { 0: { cellWidth: 24 }, 1: { cellWidth: 30 }, 3: { cellWidth: 44 } }
            : { 0: { cellWidth: 26 }, 1: { cellWidth: 32 } },
        });
        y = getLastAutoTableY(doc, y) + 4;
      }

      if (data.danifEquips.length > 0) {
        const danifColCount = includeEquipmentDefects ? 5 : 3;
        const danifHeaders: RowInput = includeEquipmentDefects
          ? [
              { content: 'CÓDIGO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
              { content: 'DESCRIÇÃO / ESPECIFICAÇÕES', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
              { content: 'DEFEITO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
              { content: 'OBSERVAÇÕES', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
            ]
          : [
              { content: 'CÓDIGO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
              { content: 'DESCRIÇÃO / ESPECIFICAÇÕES', styles: { fillColor: [255, 245, 245], textColor: [127, 29, 29], fontStyle: 'bold' as const } },
            ];
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          theme: 'grid',
          showHead: 'everyPage',
          showFoot: 'lastPage',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2,
            lineColor: [252, 165, 165],
            lineWidth: 0.25,
            textColor: [30, 41, 59],
            valign: 'middle',
          },
          head: [
            [
              {
                content: '2 ITENS DANIFICADOS',
                colSpan: danifColCount,
                styles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold', fontSize: 8.5 },
              },
            ],
            danifHeaders,
          ],
          body: data.danifEquips.map(eq => {
            const base = [
              { content: eq.code ? `[${eq.code}]` : '-', styles: { font: 'courier' as const } },
              { content: eq.patrimony, styles: { fontStyle: 'bold' as const, textColor: [185, 28, 28] as [number, number, number] } },
              eq.fullNameWithSpecs,
            ];
            if (includeEquipmentDefects) {
              base.push(
                { content: eq.damageDescription || '-', styles: { fontStyle: 'bold', textColor: [185, 28, 28] } } as never,
                { content: eq.observations?.trim() || '-', styles: { fontSize: 7.5, textColor: [71, 85, 105] } } as never
              );
            }
            return base;
          }) as RowInput[],
          foot: [
            [
              {
                content: 'Subtotal Danificados:',
                colSpan: danifColCount - 1,
                styles: { fillColor: [254, 226, 226], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' },
              },
              {
                content: `${data.danifEquips.length} un`,
                styles: { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontStyle: 'bold', halign: 'right' },
              },
            ],
          ],
          columnStyles: includeEquipmentDefects
            ? { 0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 3: { cellWidth: 36 }, 4: { cellWidth: 34 } }
            : { 0: { cellWidth: 26 }, 1: { cellWidth: 32 } },
        });
        y = getLastAutoTableY(doc, y) + 4;
      }

      if (data.uncatEquips.length > 0) {
        const uncatColCount = includeEquipmentDefects ? 5 : 3;
        const uncatHeaders: RowInput = includeEquipmentDefects
          ? [
              { content: 'CÓDIGO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
              { content: 'DESCRIÇÃO / IDENTIFICAÇÃO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
              { content: 'DEFEITO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
              { content: 'OBSERVAÇÕES', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
            ]
          : [
              { content: 'CÓDIGO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
              { content: 'PATRIMÔNIO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
              { content: 'DESCRIÇÃO / IDENTIFICAÇÃO', styles: { fillColor: [255, 251, 235], textColor: [120, 53, 15], fontStyle: 'bold' as const } },
            ];
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          theme: 'grid',
          showHead: 'everyPage',
          showFoot: 'lastPage',
          styles: {
            font: 'helvetica',
            fontSize: 8,
            cellPadding: 2,
            lineColor: [252, 211, 77],
            lineWidth: 0.25,
            textColor: [30, 41, 59],
            valign: 'middle',
          },
          head: [
            [
              {
                content: '3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM)',
                colSpan: uncatColCount,
                styles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: 'bold', fontSize: 8.5 },
              },
            ],
            uncatHeaders,
          ],
          body: data.uncatEquips.map(u => {
            const codeStr = u.code && u.code !== '0' ? u.code : 'NÃO-CAD';
            const base = [
              { content: `[${codeStr}]`, styles: { font: 'courier' as const, fontStyle: 'bold' as const } },
              { content: u.patrimony, styles: { fontStyle: 'bold' as const, textColor: [146, 64, 14] as [number, number, number] } },
              u.fullNameWithSpecs,
            ];
            if (includeEquipmentDefects) {
              base.push(
                { content: u.damageDescription || '-', styles: { fontStyle: 'bold', textColor: [185, 28, 28] } } as never,
                { content: u.observations?.trim() || '-', styles: { fontSize: 7.5, textColor: [71, 85, 105] } } as never
              );
            }
            return base;
          }) as RowInput[],
          foot: [
            [
              {
                content: 'Subtotal Não Cadastrados:',
                colSpan: uncatColCount - 1,
                styles: { fillColor: [254, 243, 199], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' },
              },
              {
                content: `${data.uncatEquips.length} un`,
                styles: { fillColor: [254, 243, 199], textColor: [146, 64, 14], fontStyle: 'bold', halign: 'right' },
              },
            ],
          ],
          columnStyles: includeEquipmentDefects
            ? { 0: { cellWidth: 24 }, 1: { cellWidth: 28 }, 3: { cellWidth: 34 }, 4: { cellWidth: 34 } }
            : { 0: { cellWidth: 26 }, 1: { cellWidth: 32 } },
        });
        y = getLastAutoTableY(doc, y) + 4;
      }
    }
  }

  // -------------------------------------------------------------
  // RODAPÉ
  // -------------------------------------------------------------
  const footerY = ensureSpace(y + 4, 12);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.35);
  doc.line(margin, footerY, pageWidth - margin, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Relatório Oficial de Contagem emitido pelo aplicativo CONTAGEM DE MATERIAIS & EQUIPAMENTOS do Grupo MS.',
    pageWidth / 2,
    footerY + 5,
    { align: 'center' }
  );

  const safeDate = (todayDateFormatted || new Date().toLocaleDateString('pt-BR'))
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const branchSlug = resolveBranchSlug(params.branch);
  const stockSlug = selectedStock.toUpperCase();
  const fileName = `Relatorio_Estoque_${branchSlug}_${safeDate}_${stockSlug}.pdf`;

  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : '';

  return {
    blob,
    file,
    fileName,
    base64,
  };
}

