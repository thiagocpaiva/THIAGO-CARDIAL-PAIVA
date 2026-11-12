
import { 
  MaterialItem, 
  FreezerItem, 
  EquipmentItem, 
  UncataloguedEquipment,
  MaterialDailyEntry,
  EquipmentDailyEntry,
  StockUser
} from '../types/inventory';
import { CATEGORIAS_MATERIAIS } from '../components/modals/CadastrarMaterialModal';

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

export function generateStockReportText(params: GenerateReportParams): string {
  const {
    selectedStock,
    todayDateFormatted,
    activeUser,
    defaultSenderEmail,
    recipients,
    materials,
    freezers,
    equipments,
    includeEquipmentDefects = true,
    isMobile = false,
    clearCountsOnly = false,
    isRecontagem = false,
  } = params;

  const materialCounts = clearCountsOnly ? {} : (params.materialCounts || {});
  const equipmentCounts = clearCountsOnly ? {} : (params.equipmentCounts || {});
  const uncataloguedEquipments = clearCountsOnly ? [] : (params.uncataloguedEquipments || []);

  const lines: string[] = [];

  const stockLabel = 
    selectedStock === 'materiais' 
      ? 'MATERIAIS' 
      : selectedStock === 'equipamentos' 
        ? 'EQUIPAMENTOS' 
        : 'MATERIAIS E EQUIPAMENTOS (CONSOLIDADO)';

  // EXIGÊNCIA 9: no padrão de exibição celular, os tracejados se ajustam até o final da linha
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
  lines.push(`ESTOQUE SELECIONADO: ${stockLabel}`);
  lines.push(`SITUAÇÃO: ${isRecontagem ? 'Relatório Oficial de Recontagem' : 'Relatório da Contagem'}`);
  lines.push(`${DIVIDER_DOUBLE}\n`);

  // =========================================
  // 1. ESTOQUE DE MATERIAIS
  // =========================================
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    lines.push(DIVIDER_SINGLE);
    lines.push(`ESTOQUE DE MATERIAIS`);
    lines.push(`${DIVIDER_SINGLE}\n`);

    // EXIGÊNCIA: Na tela Exportar, no campo "PRÉVIA DO RELATÓRIO", exibir a relação dos itens da contagem de Materiais por tipo, em ordem crescente alfabética, dentro de cada tópico, primeiro as Mesas Madeira, Cadeiras Madeira, Mesas Plásticas, Cadeiras Plásticas Com Braço, Cadeiras Plásticas Sem Braço, Caixas Térmicas, Barris, CO2.
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

    const sortedMaterials = [...materials].sort((a, b) => {
      const prioA = getMaterialTypePriority(a);
      const prioB = getMaterialTypePriority(b);
      if (prioA !== prioB) {
        return prioA - prioB;
      }
      // Ordem crescente alfabética dentro do tipo (pelo nome do item)
      const nameComp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      if (nameComp !== 0) {
        return nameComp;
      }
      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    });

    // --- 1 ITENS DISPONÍVEIS ---
    lines.push(`1 ITENS DISPONÍVEIS:`);
    const dispLines: string[] = [];
    let subtotalDisp = 0;

    sortedMaterials.forEach(m => {
      const entry = materialCounts[m.id];
      if (m.category === 'barril') {
        const cheio = entry?.barrilCheio || 0;
        if (cheio > 0) {
          dispLines.push(`   • [${m.code}] ${m.name} (Cheio): ${cheio} un`);
          subtotalDisp += cheio;
        }
      } else if (m.category === 'co2') {
        const cheio = entry?.co2Cheio || 0;
        const mexido = entry?.co2Mexido || 0;
        if (cheio > 0) {
          dispLines.push(`   • [${m.code}] ${m.name} (Cheio): ${cheio} un`);
          subtotalDisp += cheio;
        }
        if (mexido > 0) {
          dispLines.push(`   • [${m.code}] ${m.name} (Mexido): ${mexido} un`);
          subtotalDisp += mexido;
        }
      } else {
        const disp = entry?.disponivel || 0;
        if (disp > 0) {
          dispLines.push(`   • [${m.code}] ${m.name}: ${disp} un`);
          subtotalDisp += disp;
        }
      }
    });

    if (dispLines.length > 0) {
      lines.push(...dispLines);
      lines.push(`   >> Subtotal Disponíveis: ${subtotalDisp} un`);
    }
    lines.push(``);
    lines.push(DIVIDER_SINGLE);

    // --- 2 ITENS DANIFICADOS ---
    lines.push(`2 ITENS DANIFICADOS:`);
    const danifLines: string[] = [];
    let subtotalDanif = 0;

    sortedMaterials.forEach(m => {
      // Não mostrar vazio e em rota nessa linha!
      if (m.category !== 'barril' && m.category !== 'co2') {
        const entry = materialCounts[m.id];
        const danif = entry?.danificado || 0;
        if (danif > 0) {
          danifLines.push(`   • [${m.code}] ${m.name}: ${danif} un`);
          subtotalDanif += danif;
        }
      }
    });

    if (danifLines.length > 0) {
      lines.push(...danifLines);
      lines.push(`   >> Subtotal Danificados: ${subtotalDanif} un`);
    }
    lines.push(``);
    lines.push(DIVIDER_SINGLE);

    // --- 3 ITENS VAZIO E EM ROTA ---
    lines.push(`3 ITENS VAZIO E EM ROTA:`);
    const vazioRotaLines: string[] = [];
    let subtotalVazioRota = 0;

    let totalCo2EmRota = 0;

    // Calcular total de CO2 em rota consolidado
    sortedMaterials.forEach(m => {
      if (m.category === 'co2') {
        const entry = materialCounts[m.id];
        totalCo2EmRota += (entry?.co2EmRota || 0);
      }
    });

    // 1. Barris Vazios e em Rota
    sortedMaterials.forEach(m => {
      if (m.category === 'barril') {
        const entry = materialCounts[m.id];
        const vazio = entry?.barrilVazio || 0;
        const rota = entry?.barrilEmRota || 0;
        if (vazio > 0) {
          vazioRotaLines.push(`   • [${m.code}] ${m.name} (Vazio): ${vazio} un`);
          subtotalVazioRota += vazio;
        }
        if (rota > 0) {
          vazioRotaLines.push(`   • [${m.code}] ${m.name} (Em Rota): ${rota} un`);
          subtotalVazioRota += rota;
        }
      }
    });

    // 2. CO2 Vazios por tamanho
    sortedMaterials.forEach(m => {
      if (m.category === 'co2') {
        const entry = materialCounts[m.id];
        const vazio = entry?.co2Vazio || 0;
        if (vazio > 0) {
          vazioRotaLines.push(`   • [${m.code}] ${m.name} (Vazio): ${vazio} un`);
          subtotalVazioRota += vazio;
        }
      }
    });

    // 3. Os CO2 em rota NÃO exibir por tamanho, mostrar consolidado em rota com o código cadastrado
    if (totalCo2EmRota > 0) {
      const co2Item = sortedMaterials.find(m => m.category === 'co2');
      const co2Code = co2Item?.code || '49782';
      vazioRotaLines.push(`   • [${co2Code}] Cilindro CO2 (Em Rota): ${totalCo2EmRota} un`);
      subtotalVazioRota += totalCo2EmRota;
    }

    if (vazioRotaLines.length > 0) {
      lines.push(...vazioRotaLines);
      lines.push(`   >> Subtotal Vazio e Em Rota: ${subtotalVazioRota} un`);
    }
    lines.push(``);
    lines.push(DIVIDER_SINGLE);

    // --- 4 ESTOQUE CONSOLIDADO ---
    lines.push(`4 ESTOQUE CONSOLIDADO:`);
    const consolidadoLines: string[] = [];
    let totalGeralMateriais = 0;

    // EXIGÊNCIA: o material 49782 Cilindro CO2 aparecerá na contagem separados, mas no relatório,
    // no campo consolidado, eles serão consolidados e aparecerá como item único, sem tamanho.
    let totalCo2Consolidado = 0;
    let co2ItemCode = '49782';
    let hasCo2InCount = false;

    sortedMaterials.forEach(m => {
      const entry = materialCounts[m.id];
      let itemTotal = 0;

      if (m.category === 'barril') {
        itemTotal = (entry?.barrilCheio || 0) + (entry?.barrilVazio || 0) + (entry?.barrilEmRota || 0);
      } else if (m.category === 'co2' || m.code.includes('49782') || m.name.toUpperCase().includes('CILINDRO CO2')) {
        itemTotal = (entry?.co2Cheio || 0) + (entry?.co2Mexido || 0) + (entry?.co2Vazio || 0) + (entry?.co2EmRota || 0) + (entry?.disponivel || 0) + (entry?.danificado || 0);
        if (m.code && m.code !== '0') co2ItemCode = m.code;
        totalCo2Consolidado += itemTotal;
        if (itemTotal > 0) hasCo2InCount = true;
        totalGeralMateriais += itemTotal;
        return; // Consolidação especial em linha única sem tamanho
      } else {
        itemTotal = (entry?.disponivel || 0) + (entry?.danificado || 0);
      }

      if (itemTotal > 0) {
        consolidadoLines.push(`   • [${m.code}] ${m.name}: ${itemTotal} un`);
        totalGeralMateriais += itemTotal;
      }
    });

    if (totalCo2Consolidado > 0) {
      consolidadoLines.push(`   • [${co2ItemCode || '49782'}] CILINDRO CO2: ${totalCo2Consolidado} un`);
    }

    if (consolidadoLines.length > 0) {
      lines.push(...consolidadoLines);
      lines.push(`   >> TOTAL GERAL DE MATERIAIS: ${totalGeralMateriais} un`);
    }
    lines.push(``);
  }

  // =========================================
  // 2. ESTOQUE DE EQUIPAMENTOS
  // =========================================
  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    lines.push(DIVIDER_SINGLE);
    lines.push(`ESTOQUE DE EQUIPAMENTOS`);
    lines.push(`${DIVIDER_SINGLE}\n`);

    // Funções auxiliares para formatar todas as informações do cadastro de cada equipamento
    const getFreezerFullNameWithSpecs = (f: FreezerItem): string => {
      const specParts: string[] = [];
      if (f.brand) specParts.push(f.brand);
      if (f.model) specParts.push(f.model);
      const tipoLabel = f.tipo || (f.isSlim ? 'SLIM' : '');
      if (tipoLabel) specParts.push(tipoLabel);
      if (f.voltage) specParts.push(f.voltage);

      const specsStr = specParts.join(' • ');
      const baseName = (f.name || 'Freezer').trim();
      if (!specsStr) return baseName;
      return `${baseName} (${specsStr})`;
    };

    const getChopeiraFullNameWithSpecs = (eq: EquipmentItem): string => {
      const specParts: string[] = [];
      const tipoChopeira = eq.type === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras';
      specParts.push(tipoChopeira);
      if (eq.model || eq.brand) specParts.push(eq.model || eq.brand!);
      if (eq.voltage) specParts.push(eq.voltage);

      const specsStr = specParts.join(' • ');
      const baseName = (eq.name || 'Chopeira').trim();
      if (!specsStr) return baseName;
      return `${baseName} (${specsStr})`;
    };

    // Equipamentos cadastrados na base (Freezers e Chopeiras)
    type RegisteredEquipEntry = {
      code: string;
      patrimony: string;
      name: string;
      fullNameWithSpecs: string;
      categoryKind: 'Freezer' | 'Chopeira';
      status: 'disponivel' | 'danificado' | 'em_estoque' | 'nao_consta';
      damageDescription?: string;
      observations?: string;
    };

    // EXIGÊNCIA: Alimentar o relatório APENAS com os Materiais e Equipamentos que foram contados pelo usuário
    const registeredEquips: RegisteredEquipEntry[] = clearCountsOnly ? [] : [
      ...freezers
        .filter(f => isRecontagem ? !!equipmentCounts[f.id]?.status : !!equipmentCounts[f.id])
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
            : (count?.status === 'danificado' && count?.damageDescription ? 'danificado' : 'disponivel');
          const damageDescription = hasBaseDefect ? f.defect : (status === 'danificado' ? count?.damageDescription : undefined);
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
        .filter(e => isRecontagem ? !!equipmentCounts[e.id]?.status : !!equipmentCounts[e.id])
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
            : (count?.status === 'danificado' && count?.damageDescription ? 'danificado' : 'disponivel');
          const damageDescription = hasBaseDefect ? e.defect : (status === 'danificado' ? count?.damageDescription : undefined);
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

    const sortByPatrimonyAsc = (a: { patrimony: string }, b: { patrimony: string }) =>
      a.patrimony.localeCompare(b.patrimony, undefined, { numeric: true, sensitivity: 'base' });

    if (isRecontagem) {
      // --- 1 EQUIPAMENTOS EM ESTOQUE (RECONTAGEM) ---
      const emEstoqueFreezers = registeredEquips
        .filter(e => e.categoryKind === 'Freezer' && e.status === 'em_estoque' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);
      const emEstoqueChopeiras = registeredEquips
        .filter(e => e.categoryKind === 'Chopeira' && e.status === 'em_estoque' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);
      const emEstoqueCadastrados = [...emEstoqueFreezers, ...emEstoqueChopeiras];

      lines.push(`1 EQUIPAMENTOS EM ESTOQUE:`);
      if (emEstoqueCadastrados.length > 0) {
        emEstoqueCadastrados.forEach(eq => {
          const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
          lines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
        });
        lines.push(`   >> Subtotal Em Estoque: ${emEstoqueCadastrados.length} un`);
      } else {
        lines.push(`   • Nenhum equipamento confirmado em estoque`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);

      // --- 2 EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE (RECONTAGEM) ---
      const naoConstaFreezers = registeredEquips
        .filter(e => e.categoryKind === 'Freezer' && e.status === 'nao_consta' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);
      const naoConstaChopeiras = registeredEquips
        .filter(e => e.categoryKind === 'Chopeira' && e.status === 'nao_consta' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);
      const naoConstaCadastrados = [...naoConstaFreezers, ...naoConstaChopeiras];

      lines.push(`2 EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE:`);
      if (naoConstaCadastrados.length > 0) {
        naoConstaCadastrados.forEach(eq => {
          const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
          lines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
        });
        lines.push(`   >> Subtotal Não Constam em Estoque: ${naoConstaCadastrados.length} un`);
      } else {
        lines.push(`   • Nenhum equipamento apontado como não consta em estoque`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);
    } else {
      // --- 1 ITENS DISPONÍVEIS ---
      const dispFreezers = registeredEquips
        .filter(e => e.categoryKind === 'Freezer' && e.status === 'disponivel' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);

      const dispChopeiras = registeredEquips
        .filter(e => e.categoryKind === 'Chopeira' && e.status === 'disponivel' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);

      const dispCadastrados = [...dispFreezers, ...dispChopeiras];
      const dispEquipLines: string[] = [];

      lines.push(`1 ITENS DISPONÍVEIS:`);

      dispCadastrados.forEach(eq => {
        const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
        dispEquipLines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
        if (includeEquipmentDefects && eq.observations?.trim()) {
          dispEquipLines.push(`     Observações: ${eq.observations.trim()}`);
        }
      });

      if (dispEquipLines.length > 0) {
        lines.push(...dispEquipLines);
        lines.push(`   >> Subtotal Disponíveis: ${dispCadastrados.length} un`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);

      // --- 2 ITENS DANIFICADOS ---
      const danifFreezers = registeredEquips
        .filter(e => e.categoryKind === 'Freezer' && e.status === 'danificado' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);

      const danifChopeiras = registeredEquips
        .filter(e => e.categoryKind === 'Chopeira' && e.status === 'danificado' && e.code && e.code !== '0')
        .sort(sortByPatrimonyAsc);

      const danifCadastrados = [...danifFreezers, ...danifChopeiras];
      const danifEquipLines: string[] = [];

      lines.push(`2 ITENS DANIFICADOS:`);

      danifCadastrados.forEach(eq => {
        const codePrefix = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
        danifEquipLines.push(`   • ${codePrefix}Patrimônio: ${eq.patrimony} - ${eq.fullNameWithSpecs}`);
        if (includeEquipmentDefects && eq.damageDescription) {
          danifEquipLines.push(`     Defeito: ${eq.damageDescription}`);
        }
        if (includeEquipmentDefects && eq.observations?.trim()) {
          danifEquipLines.push(`     Observações: ${eq.observations.trim()}`);
        }
      });

      if (danifEquipLines.length > 0) {
        lines.push(...danifEquipLines);
        lines.push(`   >> Subtotal Danificados: ${danifCadastrados.length} un`);
      }
      lines.push(``);
      lines.push(DIVIDER_SINGLE);

      // --- 3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM) ---
      lines.push(`3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM):`);
    }
    
    type UnregisteredRow = {
      code?: string;
      patrimony: string;
      name: string;
      fullNameWithSpecs: string;
      categoryKind: 'Freezer' | 'Chopeira';
      status?: 'disponivel' | 'danificado' | 'em_estoque' | 'nao_consta';
      damageDescription?: string;
      observations?: string;
    };

    const allUnregisteredRowsRaw: UnregisteredRow[] = [
      ...registeredEquips
        .filter(e => !e.code || e.code === '0')
        .map(e => ({
          code: e.code,
          patrimony: e.patrimony,
          name: e.name,
          fullNameWithSpecs: e.fullNameWithSpecs,
          categoryKind: e.categoryKind,
          status: e.status,
          damageDescription: e.damageDescription,
          observations: e.observations,
        })),
      ...uncataloguedEquipments.map(u => ({
        code: 'NÃO-CAD',
        patrimony: u.patrimony,
        name: 'Equipamento Encontrado Fora da Base',
        fullNameWithSpecs: 'Equipamento Encontrado Fora da Base',
        categoryKind: (u.observations?.toLowerCase().includes('chopeira') ? 'Chopeira' : 'Freezer') as 'Freezer' | 'Chopeira',
        status: u.status,
        damageDescription: u.damageDescription,
        observations: u.observations,
      }))
    ];

    const uncatFreezers = allUnregisteredRowsRaw
      .filter(u => u.categoryKind !== 'Chopeira' && !u.name.toLowerCase().includes('chopeira') && !(u.observations || '').toLowerCase().includes('chopeira'))
      .sort(sortByPatrimonyAsc);

    const uncatChopeiras = allUnregisteredRowsRaw
      .filter(u => u.categoryKind === 'Chopeira' || u.name.toLowerCase().includes('chopeira') || (u.observations || '').toLowerCase().includes('chopeira'))
      .sort(sortByPatrimonyAsc);

    const allUnregisteredRows = [...uncatFreezers, ...uncatChopeiras];

    if (allUnregisteredRows.length > 0) {
      allUnregisteredRows.forEach(u => {
        const codePrefix = u.code && u.code !== '0' ? `[${u.code}] ` : '[NÃO-CAD] ';
        // EXIGÊNCIA: remover "(Disponível)" e "(Danificado)" ao final de cada equipamento listado da contagem
        lines.push(`   • ${codePrefix}Patrimônio: ${u.patrimony} - ${u.fullNameWithSpecs}`);
        // EXIGÊNCIA: defeito e observações na linha abaixo da informação do item
        if (includeEquipmentDefects && u.damageDescription) {
          lines.push(`     Defeito: ${u.damageDescription}`);
        }
        if (includeEquipmentDefects && u.observations?.trim()) {
          lines.push(`     Observações: ${u.observations.trim()}`);
        }
      });
      lines.push(`   >> Subtotal Não Cadastrados: ${allUnregisteredRows.length} un`);
    }
    lines.push(``);
    lines.push(DIVIDER_SINGLE);

    // --- 4 ESTOQUE CONSOLIDADO ---
    // EXIGÊNCIA 6: Substituir a listagem por patrimônio pelo consolidado das somas dos itens
    // por código cadastrado, na ordem crescente, mostrando apenas as informações básicas da descrição cadastrada.
    lines.push(`4 ESTOQUE CONSOLIDADO:`);
    const consolidadoEquipLines: string[] = [];

    const cleanBasicName = (name: string): string => {
      if (!name) return '';
      // Remove especificações entre parênteses caso existam, mantendo apenas a descrição básica cadastrada
      return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name.trim();
    };

    const sortByCodeAsc = (a: { code: string }, b: { code: string }) =>
      a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });

    // 1. Freezers oficiais agrupados por código cadastrado (soma das quantidades)
    const freezerCodeMap = new Map<string, { code: string; name: string; count: number }>();
    registeredEquips
      .filter(e => e.categoryKind === 'Freezer' && (isRecontagem ? e.status === 'em_estoque' : true) && e.code && e.code !== '0')
      .forEach(e => {
        const existing = freezerCodeMap.get(e.code);
        if (existing) {
          existing.count += 1;
        } else {
          freezerCodeMap.set(e.code, {
            code: e.code,
            name: cleanBasicName(e.name) || 'Freezer',
            count: 1,
          });
        }
      });

    const sortedFreezerGroups = Array.from(freezerCodeMap.values()).sort(sortByCodeAsc);
    sortedFreezerGroups.forEach(g => {
      consolidadoEquipLines.push(`   • [${g.code}] ${g.name}: ${g.count} un`);
    });

    // Freezers não cadastrados (itens [NÃO-CAD] exibem a informação do patrimônio)
    if (!isRecontagem && uncatFreezers.length > 0) {
      uncatFreezers.forEach(u => {
        const c = u.code && u.code !== '0' ? u.code : 'NÃO-CAD';
        const basicName = cleanBasicName(u.name) || 'Freezer Não Cadastrado';
        if (c === 'NÃO-CAD') {
          consolidadoEquipLines.push(`   • [NÃO-CAD] Patrimônio: ${u.patrimony} - ${basicName}: 1 un`);
        } else {
          consolidadoEquipLines.push(`   • [${c}] ${basicName}: 1 un`);
        }
      });
    }

    // 2. Chopeiras oficiais agrupadas por código cadastrado (sempre no final, abaixo do último freezer)
    const chopeiraCodeMap = new Map<string, { code: string; name: string; count: number }>();
    registeredEquips
      .filter(e => e.categoryKind === 'Chopeira' && (isRecontagem ? e.status === 'em_estoque' : true) && e.code && e.code !== '0')
      .forEach(e => {
        const existing = chopeiraCodeMap.get(e.code);
        if (existing) {
          existing.count += 1;
        } else {
          chopeiraCodeMap.set(e.code, {
            code: e.code,
            name: cleanBasicName(e.name) || 'Chopeira',
            count: 1,
          });
        }
      });

    const sortedChopeiraGroups = Array.from(chopeiraCodeMap.values()).sort(sortByCodeAsc);
    sortedChopeiraGroups.forEach(g => {
      consolidadoEquipLines.push(`   • [${g.code}] ${g.name}: ${g.count} un`);
    });

    // Chopeiras não cadastradas (itens [NÃO-CAD] exibem a informação do patrimônio)
    if (!isRecontagem && uncatChopeiras.length > 0) {
      uncatChopeiras.forEach(u => {
        const c = u.code && u.code !== '0' ? u.code : 'NÃO-CAD';
        const basicName = cleanBasicName(u.name) || 'Chopeira Não Cadastrada';
        if (c === 'NÃO-CAD') {
          consolidadoEquipLines.push(`   • [NÃO-CAD] Patrimônio: ${u.patrimony} - ${basicName}: 1 un`);
        } else {
          consolidadoEquipLines.push(`   • [${c}] ${basicName}: 1 un`);
        }
      });
    }

    const totalEquipamentosGeral = isRecontagem
      ? registeredEquips.filter(e => e.status === 'em_estoque').length
      : registeredEquips.length + uncataloguedEquipments.length;

    if (totalEquipamentosGeral > 0) {
      lines.push(...consolidadoEquipLines);
      lines.push(`   >> TOTAL GERAL DE EQUIPAMENTOS${isRecontagem ? ' EM ESTOQUE' : ''}: ${totalEquipamentosGeral} un`);
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
 * Gera a versão HTML oficial do relatório para envio por e-mail,
 * formatado rigorosamente como PLANILHA com bordas, linhas e cabeçalhos.
 * Cabeçalho: Imagem 'GRUPO MS' ao lado esquerdo.
 * Estoque consolidado: Apresentado todo em NEGRITO e com fonte maior para destaque.
 */
export function generateStockReportHtml(params: GenerateReportParams): string {
  const {
    selectedStock,
    todayDateFormatted,
    activeUser,
    materials,
    freezers,
    equipments,
    uncataloguedEquipments = [],
    materialCounts = {},
    equipmentCounts = {},
    includeEquipmentDefects = true,
    clearCountsOnly = false,
    isRecontagem = false,
  } = params;

  const stockLabel = 
    selectedStock === 'materiais' 
      ? 'MATERIAIS' 
      : selectedStock === 'equipamentos' 
        ? 'EQUIPAMENTOS' 
        : 'MATERIAIS E EQUIPAMENTOS (CONSOLIDADO)';

  // Prioridades dos materiais
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

  const sortedMaterials = [...materials].sort((a, b) => {
    const prioA = getMaterialTypePriority(a);
    const prioB = getMaterialTypePriority(b);
    if (prioA !== prioB) return prioA - prioB;
    const nameComp = a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    if (nameComp !== 0) return nameComp;
    return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Equipamentos
  const getFreezerFullNameWithSpecs = (f: FreezerItem): string => {
    const specParts: string[] = [];
    if (f.brand) specParts.push(f.brand);
    if (f.model) specParts.push(f.model);
    const tipoLabel = f.tipo || (f.isSlim ? 'SLIM' : '');
    if (tipoLabel) specParts.push(tipoLabel);
    if (f.voltage) specParts.push(f.voltage);
    const specsStr = specParts.join(' • ');
    const baseName = (f.name || 'Freezer').trim();
    return specsStr ? `${baseName} (${specsStr})` : baseName;
  };

  const getChopeiraFullNameWithSpecs = (eq: EquipmentItem): string => {
    const specParts: string[] = [];
    specParts.push(eq.type === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras');
    if (eq.model || eq.brand) specParts.push(eq.model || eq.brand!);
    if (eq.voltage) specParts.push(eq.voltage);
    const specsStr = specParts.join(' • ');
    const baseName = (eq.name || 'Chopeira').trim();
    return specsStr ? `${baseName} (${specsStr})` : baseName;
  };

  const registeredEquips = clearCountsOnly ? [] : [
    ...freezers
      .filter(f => isRecontagem ? !!equipmentCounts[f.id]?.status : !!equipmentCounts[f.id])
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
          : (count?.status === 'danificado' && count?.damageDescription ? 'danificado' : 'disponivel');
        const damageDescription = hasBaseDefect ? f.defect : (status === 'danificado' ? count?.damageDescription : undefined);
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
      .filter(e => isRecontagem ? !!equipmentCounts[e.id]?.status : !!equipmentCounts[e.id])
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
          : (count?.status === 'danificado' && count?.damageDescription ? 'danificado' : 'disponivel');
        const damageDescription = hasBaseDefect ? e.defect : (status === 'danificado' ? count?.damageDescription : undefined);
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

  const sortByPatrimonyAsc = (a: { patrimony: string }, b: { patrimony: string }) =>
    a.patrimony.localeCompare(b.patrimony, undefined, { numeric: true, sensitivity: 'base' });

  const cleanBasicName = (name: string): string => {
    if (!name) return '';
    return name.replace(/\s*\([^)]*\)\s*$/, '').trim() || name.trim();
  };

  const sortByCodeAsc = (a: { code: string }, b: { code: string }) =>
    a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });

  // CONSTRUÇÃO DAS TABELAS EM FORMATO DE PLANILHA
  let tablesHtml = '';

  // -------------------------------------------------------------
  // 1. ESTOQUE DE MATERIAIS EM PLANILHA
  // -------------------------------------------------------------
  if (selectedStock === 'materiais' || selectedStock === 'ambos') {
    // 1. Itens Disponíveis
    const dispMatRows: Array<{ code: string; name: string; quantity: number }> = [];
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

    // 2. Itens Danificados
    const danifMatRows: Array<{ code: string; name: string; quantity: number }> = [];
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

    // 3. Vazio e Em Rota
    const vazioRotaRows: Array<{ code: string; name: string; situation: string; quantity: number }> = [];
    let subtotalMatVazioRota = 0;
    let totalCo2EmRota = 0;

    sortedMaterials.forEach(m => {
      if (m.category === 'co2') {
        const entry = materialCounts[m.id];
        totalCo2EmRota += (entry?.co2EmRota || 0);
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

    // 4. Consolidado de Materiais
    const consolidadoMatRows: Array<{ code: string; name: string; quantity: number }> = [];
    let totalGeralMateriais = 0;
    let totalCo2Consolidado = 0;
    let co2ItemCode = '49782';

    sortedMaterials.forEach(m => {
      const entry = materialCounts[m.id];
      let itemTotal = 0;

      if (m.category === 'barril') {
        itemTotal = (entry?.barrilCheio || 0) + (entry?.barrilVazio || 0) + (entry?.barrilEmRota || 0);
      } else if (m.category === 'co2' || m.code.includes('49782') || m.name.toUpperCase().includes('CILINDRO CO2')) {
        itemTotal = (entry?.co2Cheio || 0) + (entry?.co2Mexido || 0) + (entry?.co2Vazio || 0) + (entry?.co2EmRota || 0) + (entry?.disponivel || 0) + (entry?.danificado || 0);
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

    tablesHtml += `
      <div style="margin-bottom: 24px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 6px 6px 0 0; text-transform: uppercase;">
          ESTOQUE DE MATERIAIS
        </div>

        <!-- 1. DISPONÍVEIS -->
        ${dispMatRows.length > 0 ? `
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
              ${dispMatRows.map(r => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11.5px;">[${escapeHtml(r.code)}]</td>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${escapeHtml(r.name)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${r.quantity} un</td>
                </tr>
              `).join('')}
              <tr style="background-color: #f1f5f9; font-weight: bold;">
                <td colspan="2" style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right;">Subtotal Disponíveis:</td>
                <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; color: #047857;">${subtotalMatDisp} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <!-- 2. DANIFICADOS -->
        ${danifMatRows.length > 0 ? `
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
              ${danifMatRows.map(r => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #fecaca; font-family: monospace; font-size: 11.5px;">[${escapeHtml(r.code)}]</td>
                  <td style="padding: 6px 10px; border: 1px solid #fecaca;">${escapeHtml(r.name)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #fecaca; text-align: right; font-weight: 600; color: #b91c1c;">${r.quantity} un</td>
                </tr>
              `).join('')}
              <tr style="background-color: #fee2e2; font-weight: bold;">
                <td colspan="2" style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right;">Subtotal Danificados:</td>
                <td style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right; color: #b91c1c;">${subtotalMatDanif} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <!-- 3. VAZIO E EM ROTA -->
        ${vazioRotaRows.length > 0 ? `
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
              ${vazioRotaRows.map(r => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; font-family: monospace; font-size: 11.5px;">[${escapeHtml(r.code)}]</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a;">${escapeHtml(r.name)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; font-weight: 600; color: #92400e;">${escapeHtml(r.situation)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; text-align: right; font-weight: 600;">${r.quantity} un</td>
                </tr>
              `).join('')}
              <tr style="background-color: #fef3c7; font-weight: bold;">
                <td colspan="3" style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right;">Subtotal Vazio e Em Rota:</td>
                <td style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right; color: #92400e;">${subtotalMatVazioRota} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <!-- 4. ESTOQUE CONSOLIDADO (TODO EM NEGRITO COM FONTE MAIOR) -->
        ${consolidadoMatRows.length > 0 ? `
          <table width="100%" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 16px; border: 2.5px solid #059669; font-family: Arial, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <thead>
              <tr style="background-color: #065f46; color: #ffffff;">
                <th colspan="3" style="padding: 10px 14px; text-align: left; font-size: 14.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #065f46;">
                  4 ESTOQUE CONSOLIDADO: MATERIAIS
                </th>
              </tr>
              <tr style="background-color: #d1fae5; color: #064e3b; font-size: 13px; font-weight: 800; text-transform: uppercase;">
                <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left; width: 20%;">Código</th>
                <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left;">Descrição do Item</th>
                <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: right; width: 25%;">Saldo Consolidado</th>
              </tr>
            </thead>
            <tbody>
              ${consolidadoMatRows.map(r => `
                <tr style="background-color: #ffffff;">
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(r.code)}]</td>
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #0f172a;">${escapeHtml(r.name)}</td>
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 15px; font-weight: 900; color: #047857; text-align: right;">${r.quantity} un</td>
                </tr>
              `).join('')}
              <tr style="background-color: #059669; color: #ffffff;">
                <td colspan="2" style="padding: 12px 14px; border: 1.5px solid #047857; font-size: 15.5px; font-weight: 900; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">
                  TOTAL GERAL DE MATERIAIS:
                </td>
                <td style="padding: 12px 14px; border: 1.5px solid #047857; font-size: 16.5px; font-weight: 900; text-align: right;">
                  ${totalGeralMateriais} un
                </td>
              </tr>
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }

  // -------------------------------------------------------------
  // 2. ESTOQUE DE EQUIPAMENTOS EM PLANILHA
  // -------------------------------------------------------------
  if (selectedStock === 'equipamentos' || selectedStock === 'ambos') {
    if (isRecontagem) {
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

      // Consolidado Equipamentos
      const freezerCodeMap = new Map<string, { code: string; name: string; count: number }>();
      registeredEquips
        .filter(e => e.categoryKind === 'Freezer' && e.status === 'em_estoque' && e.code && e.code !== '0')
        .forEach(e => {
          const existing = freezerCodeMap.get(e.code);
          if (existing) {
            existing.count += 1;
          } else {
            freezerCodeMap.set(e.code, {
              code: e.code,
              name: cleanBasicName(e.name) || 'Freezer',
              count: 1,
            });
          }
        });
      const sortedFreezerGroups = Array.from(freezerCodeMap.values()).sort(sortByCodeAsc);

      const chopeiraCodeMap = new Map<string, { code: string; name: string; count: number }>();
      registeredEquips
        .filter(e => e.categoryKind === 'Chopeira' && e.status === 'em_estoque' && e.code && e.code !== '0')
        .forEach(e => {
          const existing = chopeiraCodeMap.get(e.code);
          if (existing) {
            existing.count += 1;
          } else {
            chopeiraCodeMap.set(e.code, {
              code: e.code,
              name: cleanBasicName(e.name) || 'Chopeira',
              count: 1,
            });
          }
        });
      const sortedChopeiraGroups = Array.from(chopeiraCodeMap.values()).sort(sortByCodeAsc);

      tablesHtml += `
        <div style="margin-bottom: 24px;">
          <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 6px 6px 0 0; text-transform: uppercase;">
            ESTOQUE DE EQUIPAMENTOS (RECONTAGEM)
          </div>

          <!-- 1. EQUIPAMENTOS EM ESTOQUE -->
          ${emEstoqueEquips.length > 0 ? `
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
                ${emEstoqueEquips.map(eq => `
                  <tr>
                    <td style="padding: 6px 10px; border: 1px solid #a7f3d0; font-family: monospace; font-size: 11.5px;">${eq.code ? `[${escapeHtml(eq.code)}]` : '-'}</td>
                    <td style="padding: 6px 10px; border: 1px solid #a7f3d0; font-weight: 700; color: #047857;">${escapeHtml(eq.patrimony)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #a7f3d0;">${escapeHtml(eq.fullNameWithSpecs)}</td>
                  </tr>
                `).join('')}
                <tr style="background-color: #d1fae5; font-weight: bold;">
                  <td colspan="2" style="padding: 7px 10px; border: 1px solid #6ee7b7; text-align: right;">Subtotal Em Estoque:</td>
                  <td style="padding: 7px 10px; border: 1px solid #6ee7b7; text-align: right; color: #047857;">${emEstoqueEquips.length} un</td>
                </tr>
              </tbody>
            </table>
          ` : ''}

          <!-- 2. EQUIPAMENTOS NÃO CONSTAM EM ESTOQUE -->
          ${naoConstaEquips.length > 0 ? `
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
                ${naoConstaEquips.map(eq => `
                  <tr>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca; font-family: monospace; font-size: 11.5px;">${eq.code ? `[${escapeHtml(eq.code)}]` : '-'}</td>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca; font-weight: 700; color: #b91c1c;">${escapeHtml(eq.patrimony)}</td>
                    <td style="padding: 6px 10px; border: 1px solid #fecaca;">${escapeHtml(eq.fullNameWithSpecs)}</td>
                  </tr>
                `).join('')}
                <tr style="background-color: #fee2e2; font-weight: bold;">
                  <td colspan="2" style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right;">Subtotal Não Constam em Estoque:</td>
                  <td style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right; color: #b91c1c;">${naoConstaEquips.length} un</td>
                </tr>
              </tbody>
            </table>
          ` : ''}

          <!-- 4. ESTOQUE CONSOLIDADO EQUIPAMENTOS -->
          ${emEstoqueEquips.length > 0 ? `
            <table width="100%" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 16px; border: 2.5px solid #059669; font-family: Arial, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
              <thead>
                <tr style="background-color: #065f46; color: #ffffff;">
                  <th colspan="3" style="padding: 10px 14px; text-align: left; font-size: 14.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #065f46;">
                    4 ESTOQUE CONSOLIDADO: EQUIPAMENTOS EM ESTOQUE
                  </th>
                </tr>
                <tr style="background-color: #d1fae5; color: #064e3b; font-size: 13px; font-weight: 800; text-transform: uppercase;">
                  <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left; width: 20%;">Código</th>
                  <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left;">Descrição Básica</th>
                  <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: right; width: 25%;">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${sortedFreezerGroups.map(g => `
                  <tr style="background-color: #ffffff;">
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(g.code)}]</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #0f172a;">${escapeHtml(g.name)}</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 15px; font-weight: 900; color: #047857; text-align: right;">${g.count} un</td>
                  </tr>
                `).join('')}
                ${sortedChopeiraGroups.map(g => `
                  <tr style="background-color: #ffffff;">
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(g.code)}]</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #0f172a;">${escapeHtml(g.name)}</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 15px; font-weight: 900; color: #047857; text-align: right;">${g.count} un</td>
                  </tr>
                `).join('')}
                <tr style="background-color: #059669; color: #ffffff;">
                  <td colspan="2" style="padding: 12px 14px; border: 1.5px solid #047857; font-size: 15.5px; font-weight: 900; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">
                    TOTAL GERAL DE EQUIPAMENTOS EM ESTOQUE:
                  </td>
                  <td style="padding: 12px 14px; border: 1.5px solid #047857; font-size: 16.5px; font-weight: 900; text-align: right;">
                    ${emEstoqueEquips.length} un
                  </td>
                </tr>
              </tbody>
            </table>
          ` : ''}
        </div>
      `;
    } else {
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

      // Não cadastrados
      type UncatHtmlRow = {
        code: string;
        patrimony: string;
        name: string;
        fullNameWithSpecs: string;
        damageDescription?: string;
        observations?: string;
      };

      const uncatRowsRaw: UncatHtmlRow[] = [
        ...registeredEquips
          .filter(e => !e.code || e.code === '0')
          .map(e => ({
            code: e.code || '0',
            patrimony: e.patrimony,
            name: e.name,
            fullNameWithSpecs: e.fullNameWithSpecs,
            damageDescription: e.damageDescription,
            observations: e.observations,
          })),
        ...uncataloguedEquipments.map(u => ({
          code: 'NÃO-CAD',
          patrimony: u.patrimony,
          name: 'Equipamento Encontrado Fora da Base',
          fullNameWithSpecs: 'Equipamento Encontrado Fora da Base',
          damageDescription: u.damageDescription,
          observations: u.observations,
        }))
      ];

      const uncatEquips = uncatRowsRaw.sort(sortByPatrimonyAsc);

      // Consolidado Equipamentos
      const freezerCodeMap = new Map<string, { code: string; name: string; count: number }>();
      registeredEquips
        .filter(e => e.categoryKind === 'Freezer' && e.code && e.code !== '0')
        .forEach(e => {
          const existing = freezerCodeMap.get(e.code);
          if (existing) {
            existing.count += 1;
          } else {
            freezerCodeMap.set(e.code, {
              code: e.code,
              name: cleanBasicName(e.name) || 'Freezer',
              count: 1,
            });
          }
        });
      const sortedFreezerGroups = Array.from(freezerCodeMap.values()).sort(sortByCodeAsc);

      const chopeiraCodeMap = new Map<string, { code: string; name: string; count: number }>();
      registeredEquips
        .filter(e => e.categoryKind === 'Chopeira' && e.code && e.code !== '0')
        .forEach(e => {
          const existing = chopeiraCodeMap.get(e.code);
          if (existing) {
            existing.count += 1;
          } else {
            chopeiraCodeMap.set(e.code, {
              code: e.code,
              name: cleanBasicName(e.name) || 'Chopeira',
              count: 1,
            });
          }
        });
      const sortedChopeiraGroups = Array.from(chopeiraCodeMap.values()).sort(sortByCodeAsc);

      const totalEquipamentosGeral = registeredEquips.length + uncataloguedEquipments.length;

    tablesHtml += `
      <div style="margin-bottom: 24px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 10px 14px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; border-radius: 6px 6px 0 0; text-transform: uppercase;">
          ESTOQUE DE EQUIPAMENTOS
        </div>

        <!-- 1. DISPONÍVEIS -->
        ${dispEquips.length > 0 ? `
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
              ${dispEquips.map(eq => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 11.5px;">${eq.code ? `[${escapeHtml(eq.code)}]` : '-'}</td>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-weight: 700; color: #047857;">${escapeHtml(eq.patrimony)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${escapeHtml(eq.fullNameWithSpecs)}</td>
                  ${includeEquipmentDefects ? `<td style="padding: 6px 10px; border: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${escapeHtml(eq.observations || '-')}</td>` : ''}
                </tr>
              `).join('')}
              <tr style="background-color: #f1f5f9; font-weight: bold;">
                <td colspan="${includeEquipmentDefects ? '3' : '2'}" style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right;">Subtotal Disponíveis:</td>
                <td style="padding: 7px 10px; border: 1px solid #cbd5e1; text-align: right; color: #047857;">${dispEquips.length} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <!-- 2. DANIFICADOS -->
        ${danifEquips.length > 0 ? `
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
              ${danifEquips.map(eq => `
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
                <td style="padding: 7px 10px; border: 1px solid #fca5a5; text-align: right; color: #b91c1c;">${danifEquips.length} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <!-- 3. NÃO CADASTRADOS -->
        ${uncatEquips.length > 0 ? `
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
              ${uncatEquips.map(u => `
                <tr>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; font-family: monospace; font-size: 11.5px; font-weight: 700;">[${escapeHtml(u.code)}]</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a; font-weight: 700; color: #92400e;">${escapeHtml(u.patrimony)}</td>
                  <td style="padding: 6px 10px; border: 1px solid #fde68a;">${escapeHtml(u.fullNameWithSpecs)}</td>
                  ${includeEquipmentDefects ? `
                    <td style="padding: 6px 10px; border: 1px solid #fde68a; font-weight: 600; color: #b91c1c;">${escapeHtml(u.damageDescription || '-')}</td>
                    <td style="padding: 6px 10px; border: 1px solid #fde68a; font-size: 11px; color: #475569;">${escapeHtml(u.observations || '-')}</td>
                  ` : ''}
                </tr>
              `).join('')}
              <tr style="background-color: #fef3c7; font-weight: bold;">
                <td colspan="${includeEquipmentDefects ? '4' : '2'}" style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right;">Subtotal Não Cadastrados:</td>
                <td style="padding: 7px 10px; border: 1px solid #fcd34d; text-align: right; color: #92400e;">${uncatEquips.length} un</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <!-- 4. ESTOQUE CONSOLIDADO EQUIPAMENTOS (TODO EM NEGRITO COM FONTE MAIOR) -->
        ${totalEquipamentosGeral > 0 ? `
          <table width="100%" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 16px; border: 2.5px solid #059669; font-family: Arial, sans-serif; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
            <thead>
              <tr style="background-color: #065f46; color: #ffffff;">
                <th colspan="3" style="padding: 10px 14px; text-align: left; font-size: 14.5px; font-weight: 900; text-transform: uppercase; border: 1px solid #065f46;">
                  4 ESTOQUE CONSOLIDADO: EQUIPAMENTOS
                </th>
              </tr>
              <tr style="background-color: #d1fae5; color: #064e3b; font-size: 13px; font-weight: 800; text-transform: uppercase;">
                <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left; width: 20%;">Código</th>
                <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: left;">Descrição Básica</th>
                <th style="padding: 9px 12px; border: 1.5px solid #a7f3d0; text-align: right; width: 25%;">Quantidade</th>
              </tr>
            </thead>
            <tbody>
              <!-- Freezers oficiais -->
              ${sortedFreezerGroups.map(g => `
                <tr style="background-color: #ffffff;">
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(g.code)}]</td>
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #0f172a;">${escapeHtml(g.name)}</td>
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 15px; font-weight: 900; color: #047857; text-align: right;">${g.count} un</td>
                </tr>
              `).join('')}

              <!-- Freezers não cadastrados -->
              ${uncatRowsRaw.filter(u => !u.name.toLowerCase().includes('chopeira') && !(u.observations || '').toLowerCase().includes('chopeira')).map(u => {
                const isNaoCad = !u.code || u.code === '0' || u.code === 'NÃO-CAD';
                const label = isNaoCad ? `Patrimônio: ${u.patrimony} - ${cleanBasicName(u.name) || 'Freezer Não Cadastrado'}` : cleanBasicName(u.name);
                return `
                  <tr style="background-color: #ffffff;">
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(isNaoCad ? 'NÃO-CAD' : u.code)}]</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #0f172a;">${escapeHtml(label)}</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 15px; font-weight: 900; color: #047857; text-align: right;">1 un</td>
                  </tr>
                `;
              }).join('')}

              <!-- Chopeiras oficiais -->
              ${sortedChopeiraGroups.map(g => `
                <tr style="background-color: #ffffff;">
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(g.code)}]</td>
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #0f172a;">${escapeHtml(g.name)}</td>
                  <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 15px; font-weight: 900; color: #047857; text-align: right;">${g.count} un</td>
                </tr>
              `).join('')}

              <!-- Chopeiras não cadastradas -->
              ${uncatRowsRaw.filter(u => u.name.toLowerCase().includes('chopeira') || (u.observations || '').toLowerCase().includes('chopeira')).map(u => {
                const isNaoCad = !u.code || u.code === '0' || u.code === 'NÃO-CAD';
                const label = isNaoCad ? `Patrimônio: ${u.patrimony} - ${cleanBasicName(u.name) || 'Chopeira Não Cadastrada'}` : cleanBasicName(u.name);
                return `
                  <tr style="background-color: #ffffff;">
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #065f46; font-family: monospace;">[${escapeHtml(isNaoCad ? 'NÃO-CAD' : u.code)}]</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 14.5px; font-weight: 800; color: #0f172a;">${escapeHtml(label)}</td>
                    <td style="padding: 9px 12px; border: 1.5px solid #a7f3d0; font-size: 15px; font-weight: 900; color: #047857; text-align: right;">1 un</td>
                  </tr>
                `;
              }).join('')}

              <tr style="background-color: #059669; color: #ffffff;">
                <td colspan="2" style="padding: 12px 14px; border: 1.5px solid #047857; font-size: 15.5px; font-weight: 900; text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">
                  TOTAL GERAL DE EQUIPAMENTOS:
                </td>
                <td style="padding: 12px 14px; border: 1.5px solid #047857; font-size: 16.5px; font-weight: 900; text-align: right;">
                  ${totalEquipamentosGeral} un
                </td>
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
          <div style="font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${params.isRecontagem ? 'RELATÓRIO DE RECONTAGEM DE ESTOQUE' : 'CONTAGEM DE ESTOQUE'}</div>
          <div style="font-size: 13px; color: #475569; margin-top: 3px;">Gestão de Materiais &amp; Equipamentos</div>
          <div style="font-size: 13px; color: #059669; font-weight: 700; margin-top: 6px;">Data da ${params.isRecontagem ? 'Recontagem' : 'Contagem'}: ${escapeHtml(todayDateFormatted)}</div>
          ${params.branch ? `<div style="font-size: 12px; color: #b45309; font-weight: 800; margin-top: 2px;">Base / Unidade: <strong>${escapeHtml(params.branch)}</strong></div>` : ''}
          ${activeUser ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">Conferente: <strong>${escapeHtml(activeUser.name)}</strong></div>` : ''}
          <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Estoque: <strong>${escapeHtml(stockLabel)}</strong></div>
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
