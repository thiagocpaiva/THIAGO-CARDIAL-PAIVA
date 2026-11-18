import {
  MaterialItem,
  FreezerItem,
  EquipmentItem,
  UncataloguedEquipment,
  MaterialDailyEntry,
  EquipmentDailyEntry,
  StockUser,
} from '../types/inventory';

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
 * Gera a versão do relatório integralmente formatada como TABELAS em texto estruturado
 * para inserção limpa no corpo do e-mail (mailto:?body=... e fallback plain-text),
 * mantendo o ESTOQUE CONSOLIDADO como primeira informação do relatório.
 */
export function generateStockReportEmailTableText(params: GenerateReportParams): string {
  const {
    selectedStock,
    todayDateFormatted,
    activeUser,
    includeEquipmentDefects = true,
    isRecontagem = false,
  } = params;

  const data = buildStructuredReportData(params);
  const lines: string[] = [];

  lines.push(`GRUPO MS - ${isRecontagem ? 'RELATÓRIO DE RECONTAGEM DE ESTOQUE' : 'CONTAGEM DE ESTOQUE'}`);
  lines.push('Gestão de Materiais & Equipamentos');
  lines.push('');

  const metaRows: string[][] = [
    [`DATA DA ${isRecontagem ? 'RECONTAGEM' : 'CONTAGEM'}`, todayDateFormatted],
  ];
  if (params.branch) {
    metaRows.push(['BASE / UNIDADE', params.branch]);
  }
  if (activeUser) {
    metaRows.push(['CONFERENTE RESPONSÁVEL', activeUser.name]);
  }
  metaRows.push(['ESTOQUE SELECIONADO', data.stockLabel]);
  metaRows.push(['SITUAÇÃO', isRecontagem ? 'Relatório Oficial de Recontagem' : 'Relatório da Contagem']);

  lines.push(
    ...renderAsciiTable(
      [
        { header: 'INFORMAÇÃO', width: 24, align: 'left' },
        { header: 'DADOS DA CONTAGEM', width: 42, align: 'left' },
      ],
      metaRows
    )
  );
  lines.push('');

  // =========================================================
  // 1ª INFORMAÇÃO: TABELAS DE ESTOQUE CONSOLIDADO
  // =========================================================
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    lines.push('ESTOQUE CONSOLIDADO - MATERIAIS');
    lines.push(
      ...renderAsciiTable(
        [
          { header: 'CÓDIGO', width: 10, align: 'left' },
          { header: 'DESCRIÇÃO DO MATERIAL', width: 40, align: 'left' },
          { header: 'SALDO', width: 10, align: 'right' },
        ],
        data.consolidadoMatRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
        ['TOTAL', 'TOTAL GERAL DE MATERIAIS', `${data.totalGeralMateriais} un`]
      )
    );
    lines.push('');
  }

  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    lines.push(`ESTOQUE CONSOLIDADO - EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}`);
    lines.push(
      ...renderAsciiTable(
        [
          { header: 'CÓDIGO', width: 10, align: 'left' },
          { header: 'DESCRIÇÃO DO EQUIPAMENTO', width: 40, align: 'left' },
          { header: 'QTD', width: 10, align: 'right' },
        ],
        data.consolidadoEquipRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
        ['TOTAL', `TOTAL GERAL DE EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}`, `${data.totalEquipamentosGeral} un`]
      )
    );
    lines.push('');
  }

  // =========================================================
  // DETALHAMENTO EM TABELAS: MATERIAIS
  // =========================================================
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    lines.push('DETALHAMENTO - ESTOQUE DE MATERIAIS');
    lines.push('');

    lines.push('1 ITENS DISPONÍVEIS');
    lines.push(
      ...renderAsciiTable(
        [
          { header: 'CÓDIGO', width: 10, align: 'left' },
          { header: 'DESCRIÇÃO DO MATERIAL', width: 40, align: 'left' },
          { header: 'QTD', width: 10, align: 'right' },
        ],
        data.dispMatRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
        ['SUBTOTAL', 'Subtotal Disponíveis', `${data.subtotalMatDisp} un`]
      )
    );
    lines.push('');

    if (data.danifMatRows.length > 0) {
      lines.push('2 ITENS DANIFICADOS');
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'CÓDIGO', width: 10, align: 'left' },
            { header: 'DESCRIÇÃO DO MATERIAL', width: 40, align: 'left' },
            { header: 'QTD', width: 10, align: 'right' },
          ],
          data.danifMatRows.map(r => [`[${r.code}]`, r.name, `${r.quantity} un`]),
          ['SUBTOTAL', 'Subtotal Danificados', `${data.subtotalMatDanif} un`]
        )
      );
      lines.push('');
    }

    if (data.vazioRotaRows.length > 0) {
      lines.push('3 ITENS VAZIO E EM ROTA');
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'CÓDIGO', width: 10, align: 'left' },
            { header: 'DESCRIÇÃO', width: 28, align: 'left' },
            { header: 'SITUAÇÃO', width: 10, align: 'left' },
            { header: 'QTD', width: 8, align: 'right' },
          ],
          data.vazioRotaRows.map(r => [`[${r.code}]`, r.name, r.situation, `${r.quantity} un`]),
          ['SUBTOTAL', 'Subtotal Vazio/Rota', '', `${data.subtotalMatVazioRota} un`]
        )
      );
      lines.push('');
    }
  }

  // =========================================================
  // DETALHAMENTO EM TABELAS: EQUIPAMENTOS
  // =========================================================
  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    lines.push('DETALHAMENTO - ESTOQUE DE EQUIPAMENTOS');
    lines.push('');

    if (isRecontagem) {
      lines.push('1 EQUIPAMENTOS EM ESTOQUE');
      lines.push(
        ...renderAsciiTable(
          [
            { header: 'CÓDIGO', width: 10, align: 'left' },
            { header: 'PATRIMÔNIO', width: 12, align: 'left' },
            { header: 'DESCRIÇÃO / ESPECIFICAÇÕES', width: 38, align: 'left' },
          ],
          data.emEstoqueEquips.map(eq => [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs]),
          ['SUBTOTAL', 'Em Estoque', `${data.emEstoqueEquips.length} un`]
        )
      );
      lines.push('');

      if (data.naoConstaEquips.length > 0) {
        lines.push('2 EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE');
        lines.push(
          ...renderAsciiTable(
            [
              { header: 'CÓDIGO', width: 10, align: 'left' },
              { header: 'PATRIMÔNIO', width: 12, align: 'left' },
              { header: 'DESCRIÇÃO / ESPECIFICAÇÕES', width: 38, align: 'left' },
            ],
            data.naoConstaEquips.map(eq => [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs]),
            ['SUBTOTAL', 'Não Constam', `${data.naoConstaEquips.length} un`]
          )
        );
        lines.push('');
      }
    } else {
      lines.push('1 ITENS DISPONÍVEIS');
      const dispCols: TableColumnSpec[] = includeEquipmentDefects
        ? [
            { header: 'CÓDIGO', width: 9, align: 'left' },
            { header: 'PATRIM.', width: 10, align: 'left' },
            { header: 'DESCRIÇÃO / ESPECIFICAÇÕES', width: 25, align: 'left' },
            { header: 'OBS', width: 15, align: 'left' },
          ]
        : [
            { header: 'CÓDIGO', width: 10, align: 'left' },
            { header: 'PATRIMÔNIO', width: 12, align: 'left' },
            { header: 'DESCRIÇÃO / ESPECIFICAÇÕES', width: 38, align: 'left' },
          ];
      const dispRows = data.dispEquips.map(eq =>
        includeEquipmentDefects
          ? [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs, eq.observations?.trim() || '-']
          : [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs]
      );
      const dispFooter = includeEquipmentDefects
        ? ['SUBTOTAL', 'Disponíveis', '', `${data.dispEquips.length} un`]
        : ['SUBTOTAL', 'Disponíveis', `${data.dispEquips.length} un`];
      lines.push(...renderAsciiTable(dispCols, dispRows, dispFooter));
      lines.push('');

      if (data.danifEquips.length > 0) {
        lines.push('2 ITENS DANIFICADOS');
        const danifCols: TableColumnSpec[] = includeEquipmentDefects
          ? [
              { header: 'CÓDIGO', width: 9, align: 'left' },
              { header: 'PATRIM.', width: 10, align: 'left' },
              { header: 'DESCRIÇÃO', width: 21, align: 'left' },
              { header: 'DEFEITO / OBS', width: 19, align: 'left' },
            ]
          : [
              { header: 'CÓDIGO', width: 10, align: 'left' },
              { header: 'PATRIMÔNIO', width: 12, align: 'left' },
              { header: 'DESCRIÇÃO / ESPECIFICAÇÕES', width: 38, align: 'left' },
            ];
        const danifRows = data.danifEquips.map(eq => {
          if (!includeEquipmentDefects) {
            return [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs];
          }
          const notes = [
            eq.damageDescription ? `Def: ${eq.damageDescription}` : '',
            eq.observations?.trim() ? `Obs: ${eq.observations.trim()}` : '',
          ]
            .filter(Boolean)
            .join(' | ') || '-';
          return [eq.code ? `[${eq.code}]` : '-', eq.patrimony, eq.fullNameWithSpecs, notes];
        });
        const danifFooter = includeEquipmentDefects
          ? ['SUBTOTAL', 'Danificados', '', `${data.danifEquips.length} un`]
          : ['SUBTOTAL', 'Danificados', `${data.danifEquips.length} un`];
        lines.push(...renderAsciiTable(danifCols, danifRows, danifFooter));
        lines.push('');
      }
    }

    if (data.uncatEquips.length > 0) {
      lines.push('3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM)');
      const uncatCols: TableColumnSpec[] = includeEquipmentDefects
        ? [
            { header: 'CÓDIGO', width: 10, align: 'left' },
            { header: 'PATRIM.', width: 10, align: 'left' },
            { header: 'IDENTIFICAÇÃO', width: 21, align: 'left' },
            { header: 'DEFEITO / OBS', width: 18, align: 'left' },
          ]
        : [
            { header: 'CÓDIGO', width: 10, align: 'left' },
            { header: 'PATRIMÔNIO', width: 12, align: 'left' },
            { header: 'DESCRIÇÃO / IDENTIFICAÇÃO', width: 38, align: 'left' },
          ];
      const uncatRows = data.uncatEquips.map(u => {
        const codeStr = u.code && u.code !== '0' ? `[${u.code}]` : '[NÃO-CAD]';
        if (!includeEquipmentDefects) {
          return [codeStr, u.patrimony, u.fullNameWithSpecs];
        }
        const notes = [
          u.damageDescription ? `Def: ${u.damageDescription}` : '',
          u.observations?.trim() ? `Obs: ${u.observations.trim()}` : '',
        ]
          .filter(Boolean)
          .join(' | ') || '-';
        return [codeStr, u.patrimony, u.fullNameWithSpecs, notes];
      });
      const uncatFooter = includeEquipmentDefects
        ? ['SUBTOTAL', 'Não Cad.', '', `${data.uncatEquips.length} un`]
        : ['SUBTOTAL', 'Não Cad.', `${data.uncatEquips.length} un`];
      lines.push(...renderAsciiTable(uncatCols, uncatRows, uncatFooter));
      lines.push('');
    }
  }

  lines.push('Relatório gerado pelo App CONTAGEM DE MATERIAIS & EQUIPAMENTOS do Grupo MS.');
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
    
    <!-- CABEÇALHO COM LOGO GRUPO MS AO LADO ESQUERDO -->
    <table width="100%" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-bottom: 24px; border-bottom: 3px solid #059669; padding-bottom: 16px;">
      <tr>
        <td align="left" valign="middle" style="padding-bottom: 16px; width: 45%;">
          <img src="https://grupoms.com/wp-content/uploads/2023/12/logo-grupo-ms-1.png" alt="GRUPO MS" width="180" style="display: block; max-width: 180px; width: 180px; height: auto; border: 0;" />
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
