
import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  Snowflake,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Trash2,
  Check,
  Tag,
  Beer,
  Clock,
  X,
  AlertOctagon,
  AlertCircle,
  Search,
  Plus,
  Wrench
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { FreezerItem, EquipmentItem, UncataloguedEquipment } from '../../types/inventory';
import { ModalClonarUltima } from '../modals/ModalClonarUltima';
import { CadastrarFreezerModal } from '../modals/CadastrarFreezerModal';
import { CadastrarEquipamentoModal } from '../modals/CadastrarEquipamentoModal';
import { DefeitosModal } from '../modals/DefeitosModal';
import { AppBrandIcon } from '../AppBrandIcons';
import { EquipmentTypeFigure } from '../EquipmentTypeIcons';

export const EquipamentosView: React.FC = () => {
  const {
    freezers,
    equipments,
    equipmentCounts,
    uncataloguedEquipments,
    updateEquipmentCount,
    removeEquipmentCount,
    addUncataloguedEquipment,
    deleteUncataloguedEquipment,
    deleteUnregisteredItemEntireHistory,
    deleteFreezer,
    deleteEquipment,
    resetAllTodayCountsByMaster,
    isCountAlreadyZero,
    todayDateFormatted,
    activeUser,
    isMaster,
    isContadorActive
  } = useInventory();

  // Filtro de conferência (Todos | Freezers | Chopeiras | Não Cadastrados)
  const [typeFilter, setTypeFilter] = useState<'all' | 'freezer' | 'chopeira' | 'nao_cadastrado'>('all');

  // Feedback e Toasts
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [alreadyZeroOpen, setAlreadyZeroOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  const handleResetButtonClick = () => {
    // EXIGÊNCIA 2: ao precionar o botão "Zerar Contagens" e a contagem já tiver sido zerada, informar "Contagem já zerada"
    if (isCountAlreadyZero()) {
      setAlreadyZeroOpen(true);
      return;
    }
    setConfirmResetOpen(true);
  };

  // Campo principal de digitação de patrimônio para contagem normal
  const [patrimonyInput, setPatrimonyInput] = useState('');
  const [patrimonyInputError, setPatrimonyInputError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Modal para inserir patrimônio de equipamento DANIFICADO
  const [isDamagedModalOpen, setIsDamagedModalOpen] = useState(false);
  const [damagedPatrimony, setDamagedPatrimony] = useState('');
  const [damageDescription, setDamageDescription] = useState('');
  const [damagedModalError, setDamagedModalError] = useState('');

  // Modal de ativo não cadastrado na base (Pergunta se o cadastro será de Freezer ou Chopeira)
  const [isChoiceModalOpen, setIsChoiceModalOpen] = useState(false);
  const [unregisteredPatrimony, setUnregisteredPatrimony] = useState('');
  const [isPendingDamagedRegistration, setIsPendingDamagedRegistration] = useState(false);
  const [pendingDamagedDesc, setPendingDamagedDesc] = useState('');

  // Modais de Cadastro de Freezer e Chopeira
  const [isCadastrarFreezerOpen, setIsCadastrarFreezerOpen] = useState(false);
  const [isCadastrarChopeiraOpen, setIsCadastrarChopeiraOpen] = useState(false);

  // Modal para Gerenciar / Editar defeitos dos equipamentos
  const [isDefeitosModalOpen, setIsDefeitosModalOpen] = useState(false);
  const [isNoEquipmentsModalOpen, setIsNoEquipmentsModalOpen] = useState(false);

  // Modal para registrar equipamento encontrado fora da base quando não localizado
  const [isUncatPromptOpen, setIsUncatPromptOpen] = useState(false);
  const [pendingUncatPatrimony, setPendingUncatPatrimony] = useState('');
  const [pendingUncatObservations, setPendingUncatObservations] = useState('');
  const [pendingUncatIsDamaged, setPendingUncatIsDamaged] = useState(false);
  const [pendingUncatDamageDesc, setPendingUncatDamageDesc] = useState('');

  const showFeedback = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setFeedbackMessage({ type, text });
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 4000);
  };

  const handleResetAllToday = () => {
    resetAllTodayCountsByMaster();
    setConfirmResetOpen(false);
    showFeedback('🗑️ Base da contagem de hoje foi zerada para todos os usuários!', 'warning');
  };

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Localizar equipamento na base ESTRITAMENTE pelo campo patrimônio (e não pelo código)
  // EXIGÊNCIA: Na tela Equipamentos, ao digitar o patrimônio, puxar do cadastro as informações do item pelo campo patrimônio e não pelo código do item.
  // -------------------------------------------------------------------------
  const findItemInBase = (query: string): { item: FreezerItem | EquipmentItem; kind: 'freezer' | 'chopeira' } | null => {
    const clean = query.trim().toUpperCase();
    if (!clean) return null;

    // Busca exata por patrimônio
    const freezerByPat = freezers.find(f => f.patrimony.toUpperCase() === clean);
    if (freezerByPat) return { item: freezerByPat, kind: 'freezer' };

    const equipByPat = equipments.find(e => e.patrimony.toUpperCase() === clean);
    if (equipByPat) return { item: equipByPat, kind: 'chopeira' };

    // Busca apenas números da plaqueta (caso usuário digite só os números sem PAT-)
    const numbersOnly = clean.replace(/\D/g, '');
    if (numbersOnly.length >= 2) {
      const fByNum = freezers.find(f => f.patrimony.replace(/\D/g, '') === numbersOnly);
      if (fByNum) return { item: fByNum, kind: 'freezer' };

      const eByNum = equipments.find(e => e.patrimony.replace(/\D/g, '') === numbersOnly);
      if (eByNum) return { item: eByNum, kind: 'chopeira' };
    }

    return null;
  };

  // -------------------------------------------------------------------------
  // 1. Inserir Patrimônio Normal (Equipamento Disponível)
  // O app puxa da base as informações completas e adiciona à contagem
  // -------------------------------------------------------------------------
  const handleCountNormalPatrimony = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPatrimonyInputError('');
    const cleanPat = patrimonyInput.trim().toUpperCase();
    if (!cleanPat) return;

    if (isMaster && isContadorActive) {
      showFeedback('Existe usuário realizando contagem no momento.', 'warning');
      setPatrimonyInputError('Existe usuário realizando contagem no momento.');
      return;
    }

    // 1. Verificar se já foi contado em uncataloguedEquipments
    const uncatFound = uncataloguedEquipments.find(u => u.patrimony.toUpperCase() === cleanPat);
    if (uncatFound) {
      setPatrimonyInputError('Patrimônio já contado.');
      showFeedback('Patrimônio já contado.', 'warning');
      return;
    }

    const found = findItemInBase(cleanPat);

    if (found) {
      const { item, kind } = found;
      const existingCount = equipmentCounts[item.id];

      // EXIGÊNCIA: Na tela de CONTAGEM DE ESTOQUE, no campo para digitar o patrimônio,
      // ao inserir um patrimônio já contado, aparecer a mensagem "Patrimônio já contado."
      if (existingCount) {
        setPatrimonyInputError('Patrimônio já contado.');
        showFeedback('Patrimônio já contado.', 'warning');
        return;
      }

      // Se o equipamento tiver defeito cadastrado na base, puxa o defeito e registra como Danificado
      const hasDefect = Boolean((item as any).defect && (item as any).defect.trim());
      const kindName = kind === 'freezer' ? 'Freezer' : 'Chopeira';
      const codeStr = item.code && item.code.trim() ? `[${item.code}] ` : '';

      if (hasDefect) {
        updateEquipmentCount(item.id, {
          status: 'danificado',
          damageDescription: (item as any).defect
        });
        showFeedback(`⚠️ ${codeStr}Patrimônio: ${item.patrimony} - ${item.name} (${kindName}) puxado da base como Danificado: ${(item as any).defect}!`, 'warning');
      } else {
        updateEquipmentCount(item.id, {
          status: 'disponivel',
          damageDescription: undefined
        });
        showFeedback(`✅ ${codeStr}Patrimônio: ${item.patrimony} - ${item.name} (${kindName}) contado como Disponível!`, 'success');
      }

      setPatrimonyInput('');
      setPatrimonyInputError('');
      inputRef.current?.focus();
    } else {
      // Ao inserir um patrimônio na contagem e o mesmo não estiver cadastrado na base, aparecerá uma mensagem de observação que o ativo não está cadastrado na base e abrirá uma janela para cadastro do mesmo, perguntando primeiro se o cadastro será de Freezer ou Chopeira e ao selecionar, abrirá a tela de cadastro referente a escolha.
      setUnregisteredPatrimony(cleanPat);
      setIsPendingDamagedRegistration(false);
      setPendingDamagedDesc('');
      showFeedback(`Observação: O ativo "${cleanPat}" não está cadastrado na base de dados.`, 'warning');
      setIsChoiceModalOpen(true);
    }
  };

  // -------------------------------------------------------------------------
  // 2. Inserir Patrimônio DANIFICADO (via botão dedicado solicitado pelo usuário)
  // -------------------------------------------------------------------------
  const handleSubmitDamaged = (e: React.FormEvent) => {
    e.preventDefault();
    setDamagedModalError('');

    if (isMaster && isContadorActive) {
      setDamagedModalError('Existe usuário realizando contagem no momento.');
      showFeedback('Existe usuário realizando contagem no momento.', 'warning');
      return;
    }

    const cleanPat = damagedPatrimony.trim().toUpperCase();
    if (!cleanPat) {
      setDamagedModalError('Informe a plaqueta de patrimônio do equipamento danificado.');
      return;
    }

    // EXIGÊNCIA: Na tela de CONTAGEM DE ESTOQUE, no campo para digitar o equipamento danificado,
    // ao inserir um patrimônio já contado, aparecer a mensagem "Patrimônio já contado."
    const uncatFound = uncataloguedEquipments.find(u => u.patrimony.toUpperCase() === cleanPat);
    if (uncatFound) {
      setDamagedModalError('Patrimônio já contado.');
      showFeedback('Patrimônio já contado.', 'warning');
      return;
    }

    const found = findItemInBase(cleanPat);

    if (found) {
      const { item } = found;
      const existingCount = equipmentCounts[item.id];

      if (existingCount) {
        setDamagedModalError('Patrimônio já contado.');
        showFeedback('Patrimônio já contado.', 'warning');
        return;
      }

      const defDesc = damageDescription.trim() || 'Avaria identificada na contagem';
      updateEquipmentCount(item.id, {
        status: 'danificado',
        damageDescription: defDesc,
      });

      showFeedback(`⚠️ [${item.code}] Patrimônio: ${item.patrimony} - ${item.name} registrado como DANIFICADO (Defeito: ${defDesc})!`, 'warning');
      setIsDamagedModalOpen(false);
      setDamagedPatrimony('');
      setDamageDescription('');
      inputRef.current?.focus();
    } else {
      // Ao inserir um patrimônio na contagem e o mesmo não estiver cadastrado na base, aparecerá uma mensagem de observação que o ativo não está cadastrado na base e abrirá uma janela para cadastro do mesmo
      const defDesc = damageDescription.trim() || 'Avaria identificada';
      setUnregisteredPatrimony(cleanPat);
      setIsPendingDamagedRegistration(true);
      setPendingDamagedDesc(defDesc);
      setIsDamagedModalOpen(false);
      setDamagedPatrimony('');
      setDamageDescription('');
      showFeedback(`Observação: O ativo "${cleanPat}" não está cadastrado na base de dados.`, 'warning');
      setIsChoiceModalOpen(true);
    }
  };

  // Callback ao cadastrar novo Freezer através do fluxo de ativo não cadastrado
  const handleFreezerCreated = (newFreezer: FreezerItem) => {
    setIsCadastrarFreezerOpen(false);
    const hasDefect = Boolean(newFreezer.defect && newFreezer.defect.trim());
    const codeStr = newFreezer.code && newFreezer.code.trim() ? `[${newFreezer.code}] ` : '';

    if (hasDefect || isPendingDamagedRegistration) {
      const def = newFreezer.defect || pendingDamagedDesc || 'Avaria identificada';
      updateEquipmentCount(newFreezer.id, {
        status: 'danificado',
        damageDescription: def,
      });
      showFeedback(`⚠️ Freezer ${codeStr}Patrimônio: ${newFreezer.patrimony} cadastrado na base e registrado como DANIFICADO (${def})!`, 'warning');
    } else {
      updateEquipmentCount(newFreezer.id, {
        status: 'disponivel',
      });
      showFeedback(`✅ Freezer ${codeStr}Patrimônio: ${newFreezer.patrimony} - ${newFreezer.name} cadastrado na base e contado como Disponível!`, 'success');
    }
    setPatrimonyInput('');
    setIsPendingDamagedRegistration(false);
    setPendingDamagedDesc('');
  };

  // Callback ao cadastrar nova Chopeira através do fluxo de ativo não cadastrado
  const handleChopeiraCreated = (newEquip: EquipmentItem) => {
    setIsCadastrarChopeiraOpen(false);
    const hasDefect = Boolean(newEquip.defect && newEquip.defect.trim());
    const codeStr = newEquip.code && newEquip.code.trim() ? `[${newEquip.code}] ` : '';

    if (hasDefect || isPendingDamagedRegistration) {
      const def = newEquip.defect || pendingDamagedDesc || 'Avaria identificada';
      updateEquipmentCount(newEquip.id, {
        status: 'danificado',
        damageDescription: def,
      });
      showFeedback(`⚠️ Chopeira ${codeStr}Patrimônio: ${newEquip.patrimony} cadastrada na base e registrada como DANIFICADA (${def})!`, 'warning');
    } else {
      updateEquipmentCount(newEquip.id, {
        status: 'disponivel',
      });
      showFeedback(`✅ Chopeira ${codeStr}Patrimônio: ${newEquip.patrimony} - ${newEquip.name} cadastrada na base e contada como Disponível!`, 'success');
    }
    setPatrimonyInput('');
    setIsPendingDamagedRegistration(false);
    setPendingDamagedDesc('');
  };

  // -------------------------------------------------------------------------
  // Confirmar registro de equipamento não cadastrado
  // -------------------------------------------------------------------------
  const handleConfirmUncat = (e: React.FormEvent) => {
    e.preventDefault();
    const pat = pendingUncatPatrimony.trim().toUpperCase();
    if (!pat) return;

    addUncataloguedEquipment({
      patrimony: pat,
      observations: pendingUncatObservations.trim() || 'Equipamento encontrado fora da base',
      status: pendingUncatIsDamaged ? 'danificado' : 'disponivel',
      damageDescription: pendingUncatIsDamaged ? (pendingUncatDamageDesc.trim() || 'Danificado') : undefined,
    });

    showFeedback(`Patrimônio ${pat} adicionado aos Equipamentos Não Cadastrados (${pendingUncatIsDamaged ? 'Danificado' : 'Disponível'})!`, 'success');
    setIsUncatPromptOpen(false);
    setPatrimonyInput('');
    inputRef.current?.focus();
  };

  // -------------------------------------------------------------------------
  // PREPARAÇÃO DOS DADOS LISTADOS:
  // Puxa as informações completas da base e monta as listas
  // ordenadas por ordem crescente de patrimônio
  // -------------------------------------------------------------------------

  // Equipamentos contados na base
  type CountedDisplayItem = {
    id: string;
    code: string;
    patrimony: string;
    name: string;
    kind: 'freezer' | 'chopeira';
    specs: string;
    status: 'disponivel' | 'danificado';
    damageDescription?: string;
  };

  // Unifica todos os itens cadastrados que possuem registro de contagem
  const countedList: CountedDisplayItem[] = [];

  freezers.forEach(f => {
    const entry = equipmentCounts[f.id];
    if (entry) {
      countedList.push({
        id: f.id,
        code: f.code,
        patrimony: f.patrimony,
        name: f.name,
        kind: 'freezer',
        specs: `${f.brand} • ${f.model} • ${f.voltage}`,
        status: entry.status === 'danificado' || f.defect ? 'danificado' : 'disponivel',
        damageDescription: entry.damageDescription || f.defect,
      });
    }
  });

  equipments.forEach(eq => {
    const entry = equipmentCounts[eq.id];
    if (entry) {
      countedList.push({
        id: eq.id,
        code: eq.code,
        patrimony: eq.patrimony,
        name: eq.name,
        kind: 'chopeira',
        specs: `${eq.type === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras'} • ${eq.brand} • ${eq.voltage}`,
        status: entry.status === 'danificado' || eq.defect ? 'danificado' : 'disponivel',
        damageDescription: entry.damageDescription || eq.defect,
      });
    }
  });

  // Separar itens com código oficial dos que foram cadastrados na contagem (código '0' ou sem código)
  const isOfficialCode = (code?: string) => Boolean(code && code.trim() && code.trim() !== '0');

  // Filtra por tipo de equipamento caso o usuário selecione um botão de filtro
  const filteredCounted = countedList.filter(item => {
    if (typeFilter === 'freezer' && item.kind !== 'freezer') return false;
    if (typeFilter === 'chopeira' && item.kind !== 'chopeira') return false;
    if (typeFilter === 'nao_cadastrado') return false;
    return true;
  });

  // Ordenação por ordem crescente de patrimônio (numérica e alfanumérica)
  const sortByPatrimony = <T extends { patrimony: string }>(arr: T[]): T[] => {
    return [...arr].sort((a, b) =>
      a.patrimony.localeCompare(b.patrimony, undefined, { numeric: true, sensitivity: 'base' })
    );
  };

  // 1. Lista de Disponíveis (todos os equipamentos cadastrados e contados como disponíveis)
  const disponiveisList = sortByPatrimony(
    filteredCounted.filter(item => item.status === 'disponivel')
  );

  // 2. Lista de Danificados (todos os equipamentos cadastrados e contados como danificados)
  const danificadosList = sortByPatrimony(
    filteredCounted.filter(item => item.status === 'danificado')
  );

  // 3. Lista de Equipamentos Não Cadastrados (encontrados na contagem)
  // Reúne uncataloguedEquipments e os patrimônios digitados na contagem que não estavam cadastrados na base (código '0')
  type UnregisteredDisplayItem = {
    id: string;
    patrimony: string;
    name: string;
    specs?: string;
    status: 'disponivel' | 'danificado';
    damageDescription?: string;
    observations?: string;
    origin: 'uncat' | 'freezer' | 'chopeira';
  };

  const uncataloguedCombined: UnregisteredDisplayItem[] = [
    ...uncataloguedEquipments.map(u => ({
      id: u.id,
      patrimony: u.patrimony,
      name: 'Equipamento Encontrado Fora da Base',
      status: u.status,
      damageDescription: u.damageDescription,
      observations: u.observations,
      origin: 'uncat' as const,
    })),
    ...countedList
      .filter(item => !isOfficialCode(item.code))
      .map(item => ({
        id: item.id,
        patrimony: item.patrimony,
        name: item.name,
        specs: item.specs,
        status: item.status,
        damageDescription: item.damageDescription,
        origin: item.kind as ('freezer' | 'chopeira'),
      })),
  ];

  const sortedUncatalogued = sortByPatrimony(uncataloguedCombined);

  // Itens não cadastrados a exibir de acordo com o filtro selecionado
  const displayedUncatalogued = sortedUncatalogued.filter(u => {
    if (typeFilter === 'all' || typeFilter === 'nao_cadastrado') return true;
    if (typeFilter === 'freezer') return u.origin === 'freezer';
    if (typeFilter === 'chopeira') return u.origin === 'chopeira';
    return true;
  });

  // Ao excluir manualmente o patrimônio do campo "LISTA DE EQUIPAMENTOS CONTADOS:",
  // todo o histórico dele é excluído e limpo do app, como se nunca tivesse sido digitado,
  // isso tanto para Master quanto para Contador, apenas para patrimônios não cadastrados previamente na base.
  const handleDeleteUnregisteredItem = (patrimony: string, itemId: string) => {
    deleteUnregisteredItemEntireHistory(patrimony, itemId);
    showFeedback(`Patrimônio ${patrimony} excluído da contagem e da base "Não Cadastrados".`, 'warning');
  };

  // TOTAIS PARA OS BOTÕES DO CAMPO "FILTRAR E CONFERIR POR TIPO DE EQUIPAMENTO"
  let freezersDisp = 0;
  let freezersDanif = 0;
  freezers.filter(f => isOfficialCode(f.code)).forEach(f => {
    const entry = equipmentCounts[f.id];
    if (entry) {
      if (entry.status === 'danificado') freezersDanif++;
      else freezersDisp++;
    }
  });

  let chopeirasDisp = 0;
  let chopeirasDanif = 0;
  equipments.filter(e => isOfficialCode(e.code)).forEach(eq => {
    const entry = equipmentCounts[eq.id];
    if (entry) {
      if (entry.status === 'danificado') chopeirasDanif++;
      else chopeirasDisp++;
    }
  });

  const uncatDisp = sortedUncatalogued.filter(u => u.status === 'disponivel').length;
  const uncatDanif = sortedUncatalogued.filter(u => u.status === 'danificado').length;
  const totalCounted = disponiveisList.length + danificadosList.length + sortedUncatalogued.length;

  // EXIGÊNCIA 14: Na tela Equipamentos, os botões do campo "Filtrar e Conferir por Tipo de Equipamento:",
  // tem que está ativos de acordo com os itens contados no momento em que a tela é exibida,
  // caso a base esteja zerada, mostrará apenas o botão "Todos (0) Total: 0 un".
  const isBaseEmpty = freezers.length === 0 && equipments.length === 0 && sortedUncatalogued.length === 0;
  const hasFreezersCounted = (freezersDisp + freezersDanif) > 0;
  const hasChopeirasCounted = (chopeirasDisp + chopeirasDanif) > 0;
  const hasUncatCounted = sortedUncatalogued.length > 0;

  useEffect(() => {
    if (typeFilter === 'freezer' && !hasFreezersCounted) setTypeFilter('all');
    if (typeFilter === 'chopeira' && !hasChopeirasCounted) setTypeFilter('all');
    if (typeFilter === 'nao_cadastrado' && !hasUncatCounted) setTypeFilter('all');
  }, [hasFreezersCounted, hasChopeirasCounted, hasUncatCounted, typeFilter]);

  // Ao clicar no botão "Editar defeitos dos equipamentos":
  // Caso não tenha nenhum equipamento cadastrado na base, aparecer janela com a mensagem "Não existe equipamento cadastrado.", caso tenha, abrir a tela "Gestão e Edição de Defeitos dos Equipamentos"
  const handleOpenDefeitosModal = () => {
    const isBaseEmptyCheck = freezers.length === 0 && equipments.length === 0;

    if (isBaseEmptyCheck) {
      setIsNoEquipmentsModalOpen(true);
      return;
    }
    setIsDefeitosModalOpen(true);
  };

  return (
    <div className="space-y-3.5 pb-12 bg-white">

      {/* Header com a imagem do item referente ao estoque de equipamentos */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <AppBrandIcon type="equipamentos" size="sm" className="border border-cyan-200 shadow-xs" />
            <span>Contagem de Equipamentos</span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botão Clonar Última (Apenas Usuário Master) */}
          {isMaster && (
            <button
              onClick={() => setIsCloneModalOpen(true)}
              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Clonar última contagem por grupo ou estoque (Exclusivo Master)"
            >
              <Copy className="w-3.5 h-3.5 text-amber-600" />
              <span>Clonar Última</span>
            </button>
          )}

          {/* Botão Zerar Contagens (Apenas Usuário Master) */}
          {isMaster && (
            <button
              onClick={handleResetButtonClick}
              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs active:scale-95 transition-all cursor-pointer"
              title="Zerar base de contagem para todos os usuários"
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
            <span>Zerar contagem de materiais e equipamentos de hoje?</span>
          </div>
          <p className="text-slate-600 text-[11px]">
            Esta ação zerará a contagem para <strong>todos os usuários</strong>. A última contagem fica salva no backup para clonagem.
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
              Sim, Zerar Toda a Contagem
            </button>
          </div>
        </div>
      )}

      {/* Toast / Mensagem de Feedback */}
      {feedbackMessage && (
        <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-xs border animate-in fade-in duration-150 ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
            : feedbackMessage.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Indicador de Salvamento Automático */}
      <div className="bg-white border border-slate-200 px-3.5 py-2.5 rounded-xl shadow-xs text-xs">
        <div className="flex items-center gap-2 text-cyan-800 font-bold">
          <CheckCircle2 className="w-4 h-4 text-cyan-600 shrink-0" />
          <span>Contagem salva automaticamente ao digitar.</span>
        </div>
      </div>

      {/* =========================================================================
          CONTADORES DO CAMPO "FILTRAR E CONFERIR POR TIPO DE MATERIAL / EQUIPAMENTO"
          Fontes e tamanhos dos botões aumentados para todos os tipos de usuários
          ========================================================================= */}
      <div className="space-y-2">
        <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider block">
          Filtrar e Conferir por Tipo de Equipamento:
        </span>

        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar text-sm">
          {/* Botão Todos */}
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-4 py-2.5 rounded-xl font-black whitespace-nowrap transition-all border shadow-xs cursor-pointer flex items-center gap-2 ${
              typeFilter === 'all'
                ? 'bg-cyan-600 text-white border-cyan-500 font-black ring-2 ring-cyan-300/40'
                : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <EquipmentTypeFigure type="all" size="sm" />
            <span className="text-sm">Todos ({isBaseEmpty ? 0 : totalCounted})</span>
            <span className="ml-2 px-2 py-0.5 rounded-md bg-white/20 text-xs font-mono font-bold">
              Total: {isBaseEmpty ? '0 un' : `${totalCounted} un`}
            </span>
          </button>

          {/* EXIGÊNCIA 14: Os botões do campo "Filtrar e Conferir por Tipo de Equipamento:", tem que está ativos de acordo com os itens contados no momento em que a tela é exibida. Caso a base esteja zerada, mostrará apenas o botão "Todos (0) Total: 0 un". */}
          {!isBaseEmpty && hasFreezersCounted && (
            <button
              onClick={() => setTypeFilter('freezer')}
              className={`px-4 py-2.5 rounded-xl whitespace-nowrap transition-all border flex items-center gap-2.5 shadow-xs cursor-pointer ${
                typeFilter === 'freezer'
                  ? 'bg-sky-50 text-sky-950 border-sky-400 font-bold ring-2 ring-sky-300/50'
                  : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {/* Figura fiel ao nome do item */}
              <div className="shrink-0">
                <EquipmentTypeFigure type="freezer" size="md" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm">Freezers</span>
                  <span className="text-xs font-mono font-bold text-slate-500">({freezersDisp + freezersDanif})</span>
                </div>
                <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5 mt-0.5">
                  <span className="text-emerald-700 font-bold">Disp: {freezersDisp}</span>
                  <span>•</span>
                  <span className="text-rose-700 font-bold">Danif: {freezersDanif}</span>
                </div>
              </div>
            </button>
          )}

          {!isBaseEmpty && hasChopeirasCounted && (
            <button
              onClick={() => setTypeFilter('chopeira')}
              className={`px-4 py-2.5 rounded-xl whitespace-nowrap transition-all border flex items-center gap-2.5 shadow-xs cursor-pointer ${
                typeFilter === 'chopeira'
                  ? 'bg-purple-50 text-purple-950 border-purple-400 font-bold ring-2 ring-purple-300/50'
                  : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {/* Figura fiel ao nome do item */}
              <div className="shrink-0">
                <EquipmentTypeFigure type="chopeira" size="md" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm">Chopeiras</span>
                  <span className="text-xs font-mono font-bold text-slate-500">({chopeirasDisp + chopeirasDanif})</span>
                </div>
                <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5 mt-0.5">
                  <span className="text-emerald-700 font-bold">Disp: {chopeirasDisp}</span>
                  <span>•</span>
                  <span className="text-rose-700 font-bold">Danif: {chopeirasDanif}</span>
                </div>
              </div>
            </button>
          )}

          {!isBaseEmpty && hasUncatCounted && (
            <button
              onClick={() => setTypeFilter('nao_cadastrado')}
              className={`px-4 py-2.5 rounded-xl whitespace-nowrap transition-all border flex items-center gap-2.5 shadow-xs cursor-pointer ${
                typeFilter === 'nao_cadastrado'
                  ? 'bg-amber-50 text-amber-950 border-amber-400 font-bold ring-2 ring-amber-300/50'
                  : 'bg-white border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {/* Figura fiel ao nome do item */}
              <div className="shrink-0">
                <EquipmentTypeFigure type="nao_cadastrado" size="md" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm">Não Cadastrados</span>
                  <span className="text-xs font-mono font-bold text-slate-500">({sortedUncatalogued.length})</span>
                </div>
                <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1.5 mt-0.5">
                  <span className="text-emerald-700 font-bold">Disp: {uncatDisp}</span>
                  <span>•</span>
                  <span className="text-rose-700 font-bold">Danif: {uncatDanif}</span>
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* =========================================================================
          CAMPO DISPONÍVEL APENAS PARA DIGITAR O PATRIMÔNIO DO EQUIPAMENTO
          E BOTÃO PARA INSERIR PATRIMÔNIO DOS EQUIPAMENTOS DANIFICADOS
          ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <label className="text-xs sm:text-sm font-black text-slate-900 block">
              Digitar Plaqueta de Patrimônio do Equipamento:
            </label>
          </div>

          {/* EXIGÊNCIA 16: Ao clicar no botão "Editar defeitos dos equipamento", caso o cadastro da base esteja vazia, ou sem defeito cadastrado, nada fazer, informando por mensagem na tela que "Não existe(m) defeito(s) no cadastro para ser editado." */}
          <button
            type="button"
            onClick={handleOpenDefeitosModal}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Editar defeitos dos equipamentos cadastrados"
          >
            <Wrench className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Editar defeitos dos equipamentos</span>
          </button>
        </div>

        {/* Formulário de inserção rápida por patrimônio (apenas números) */}
        <form onSubmit={handleCountNormalPatrimony} className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={isMaster && isContadorActive}
              value={patrimonyInput}
              onChange={e => {
                const onlyNums = e.target.value.replace(/\D/g, '');
                setPatrimonyInput(onlyNums);
                setPatrimonyInputError('');
              }}
              autoFocus
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all disabled:opacity-60"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          <button
            type="submit"
            disabled={isMaster && isContadorActive}
            className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Contar</span>
          </button>
        </form>

        {/* EXIGÊNCIA: no campo "Digitar Plaqueta de Patrimônio do Equipamento:", ao digitar o patrimônio,
            mostrar abaixo a prévia das informações do cadastro referente ao patrimônio digitado, com o defeito caso o tenha.
            Caso não tenha o cadastro do patrimônio digitado, aparecer apenas a informação: "Patrimônio não cadastrado." */}
        {patrimonyInput.trim().length > 0 && (
          <div className="pt-1 animate-in fade-in duration-150">
            {findItemInBase(patrimonyInput.trim()) ? (() => {
              const preview = findItemInBase(patrimonyInput.trim())!;
              const isAlreadyCounted = Boolean(equipmentCounts[preview.item.id]);
              return (
                <div className="p-3 bg-cyan-50/80 border border-cyan-200 rounded-2xl space-y-2 text-xs text-slate-900 shadow-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap font-mono">
                      <span className="font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-200">
                        [{preview.item.code || 'S/CÓD'}]
                      </span>
                      <span className="font-black text-cyan-950 bg-cyan-100/70 px-2 py-0.5 rounded">
                        Patrimônio: {preview.item.patrimony}
                      </span>
                      <span className="font-bold text-slate-800">
                        {preview.item.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-cyan-800 uppercase px-2 py-0.5 bg-white rounded border border-cyan-200 font-mono">
                      {preview.kind === 'freezer' ? 'Freezer' : 'Chopeira'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-600 font-mono flex items-center gap-2 flex-wrap">
                    <span>Marca: <strong>{preview.item.brand}</strong></span>
                    <span>•</span>
                    <span>Voltagem: <strong>{preview.item.voltage}</strong></span>
                    {(preview.item as any).model && (
                      <>
                        <span>•</span>
                        <span>Modelo: <strong>{(preview.item as any).model}</strong></span>
                      </>
                    )}
                    {isAlreadyCounted && (
                      <>
                        <span>•</span>
                        <span className="text-amber-800 font-bold bg-amber-100/80 px-1.5 py-0.2 rounded">
                          Já contado hoje
                        </span>
                      </>
                    )}
                  </div>

                  {/* Defeito caso o tenha */}
                  {preview.item.defect ? (
                    <div className="p-2 rounded-xl bg-rose-100/80 border border-rose-200 text-rose-950 text-xs font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span className="font-bold text-rose-900">Defeito:</span>
                      <span className="font-semibold">{preview.item.defect}</span>
                    </div>
                  ) : (
                    <div className="text-emerald-700 text-[11px] font-bold flex items-center gap-1.5 pt-0.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                      <span>Equipamento sem defeito cadastrado</span>
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Patrimônio não cadastrado.</span>
              </div>
            )}
          </div>
        )}

        {/* Mensagem quando patrimônio já foi contado */}
        {patrimonyInputError && (
          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{patrimonyInputError}</span>
          </div>
        )}
      </div>

      {/* =========================================================================
          LISTA DE EQUIPAMENTOS PARECIDA COM A LISTA DE ENVIO:
          - Ordem crescente de patrimônio
          - Todas as informações em uma só linha por equipamento
          - Sem botões ou imagens
          - Separadamente por ordem crescente: Disponíveis, Danificados e Não Cadastrados
          ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">

        <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700">
            LISTA DE EQUIPAMENTOS CONTADOS:
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
            {totalCounted} equipamento(s) no total
          </span>
        </div>

        {/* 1. SEÇÃO DE EQUIPAMENTOS DISPONÍVEIS (Apenas Cadastrados) */}
        {(typeFilter === 'all' || typeFilter === 'freezer' || typeFilter === 'chopeira') && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>1 ITENS DISPONÍVEIS:</span>
                <span className="font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded border border-emerald-200">
                  {disponiveisList.length} un
                </span>
              </h3>
            </div>

            {disponiveisList.length === 0 ? null : (
              <div className="space-y-1">
                {disponiveisList.map(eq => (
                  <div
                    key={eq.id}
                    className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-slate-900 font-mono text-xs transition-colors group space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate flex-1">
                        {eq.code && eq.code.trim() ? (
                          <span className="font-bold text-slate-900">• [{eq.code}] </span>
                        ) : (
                          <span className="font-bold text-slate-900">• </span>
                        )}
                        <span className="font-bold text-cyan-950">Patrimônio: {eq.patrimony}</span>{' '}
                        <span>- {eq.name}</span>{' '}
                        <span className="text-slate-500">({eq.specs})</span>{' '}
                        <span className="font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded text-[10px]">
                          : 1 un - Disponível
                        </span>
                      </div>

                      {/* Ação discreta de remoção caso digitado errado */}
                      <button
                        type="button"
                        onClick={() => {
                          removeEquipmentCount(eq.id);
                          const codeStr = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
                          showFeedback(`Equipamento ${codeStr}Patrimônio ${eq.patrimony} removido da contagem.`, 'warning');
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
                        title="Remover da contagem de hoje"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Defeito mostrado abaixo da linha do item contado */}
                    {eq.damageDescription && (
                      <div className="pl-3 py-1 px-2.5 rounded-lg bg-rose-100/70 border border-rose-200 text-rose-950 text-xs font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="font-bold text-rose-900">Defeito:</span>
                        <span className="font-semibold">{eq.damageDescription}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-right text-[11px] font-mono font-bold text-emerald-800 pr-2 pt-0.5">
                  &gt;&gt; Subtotal Disponíveis: {disponiveisList.length} un
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. SEÇÃO DE EQUIPAMENTOS DANIFICADOS (Apenas Cadastrados) */}
        {(typeFilter === 'all' || typeFilter === 'freezer' || typeFilter === 'chopeira') && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>2 ITENS DANIFICADOS:</span>
                <span className="font-mono text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.2 rounded border border-rose-200">
                  {danificadosList.length} un
                </span>
              </h3>
            </div>

            {danificadosList.length === 0 ? null : (
              <div className="space-y-1">
                {danificadosList.map(eq => (
                  <div
                    key={eq.id}
                    className="py-2 px-3 rounded-xl bg-rose-50/60 hover:bg-rose-50 border border-rose-200 text-slate-900 font-mono text-xs transition-colors group space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate flex-1">
                        {eq.code && eq.code.trim() ? (
                          <span className="font-bold text-slate-900">• [{eq.code}] </span>
                        ) : (
                          <span className="font-bold text-slate-900">• </span>
                        )}
                        <span className="font-bold text-rose-950">Patrimônio: {eq.patrimony}</span>{' '}
                        <span>- {eq.name}</span>{' '}
                        <span className="text-slate-500">({eq.specs})</span>{' '}
                        <span className="font-bold text-rose-800 bg-rose-100 px-1.5 py-0.2 rounded text-[10px]">
                          : 1 un - Danificado
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          removeEquipmentCount(eq.id);
                          const codeStr = eq.code && eq.code.trim() ? `[${eq.code}] ` : '';
                          showFeedback(`Equipamento ${codeStr}Patrimônio ${eq.patrimony} removido da contagem.`, 'warning');
                        }}
                        className="p-1 text-slate-400 hover:text-rose-700 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
                        title="Remover da contagem de hoje"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Defeito mostrado abaixo da linha do item contado */}
                    {eq.damageDescription && (
                      <div className="pl-3 py-1 px-2.5 rounded-lg bg-rose-100/70 border border-rose-200 text-rose-950 text-xs font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="font-bold text-rose-900">Defeito:</span>
                        <span className="font-semibold">{eq.damageDescription}</span>
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-right text-[11px] font-mono font-bold text-rose-800 pr-2 pt-0.5">
                  &gt;&gt; Subtotal Danificados: {danificadosList.length} un
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. SEÇÃO DE EQUIPAMENTOS NÃO CADASTRADOS (Encontrados fora da base) */}
        {(typeFilter === 'all' || typeFilter === 'nao_cadastrado' || displayedUncatalogued.length > 0) && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <span>3 EQUIPAMENTOS NÃO CADASTRADOS (ENCONTRADOS NA CONTAGEM):</span>
                <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.2 rounded border border-amber-200">
                  {displayedUncatalogued.length} un
                </span>
              </h3>
            </div>

            {displayedUncatalogued.length === 0 ? null : (
              <div className="space-y-1">
                {displayedUncatalogued.map(u => (
                  <div
                    key={u.id}
                    className="py-2 px-3 rounded-xl bg-amber-50/50 hover:bg-amber-50 border border-amber-200 text-slate-900 font-mono text-xs transition-colors group space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate flex-1">
                        <span className="font-bold text-amber-900">• [NÃO-CAD]</span>{' '}
                        <span className="font-bold text-amber-950">Patrimônio: {u.patrimony}</span>{' '}
                        <span>- {u.name || 'Equipamento Encontrado Fora da Base'}</span>{' '}
                        {u.specs && <span className="text-slate-500">({u.specs})</span>}{' '}
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          u.status === 'disponivel'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          : 1 un ({u.status === 'disponivel' ? 'Disponível' : 'Danificado'})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteUnregisteredItem(u.patrimony, u.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-700 rounded-lg hover:bg-white transition-colors cursor-pointer shrink-0"
                        title="Excluir equipamento encontrado"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Defeito mostrado abaixo da linha do item contado */}
                    {u.damageDescription && (
                      <div className="pl-3 py-1 px-2.5 rounded-lg bg-rose-100/70 border border-rose-200 text-rose-950 text-xs font-medium flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span className="font-bold text-rose-900">Defeito:</span>
                        <span className="font-semibold">{u.damageDescription}</span>
                      </div>
                    )}

                    {u.observations && (
                      <div className="pl-3 text-[11px] text-slate-600">
                        Obs: {u.observations}
                      </div>
                    )}
                  </div>
                ))}
                <div className="text-right text-[11px] font-mono font-bold text-amber-800 pr-2 pt-0.5">
                  &gt;&gt; Subtotal Não Cadastrados: {displayedUncatalogued.length} un
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* =========================================================================
          MODAL DEDICADO: INSERIR EQUIPAMENTO DANIFICADO
          (Criado conforme solicitação do usuário)
          ========================================================================= */}
      {isDamagedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 text-slate-900">

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertOctagon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Inserir Equipamento Danificado
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    O app puxa as informações da base e registra como danificado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDamagedModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {damagedModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{damagedModalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitDamaged} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Plaqueta de Patrimônio do Equipamento *
                </label>
                <input
                  type="text"
                  value={damagedPatrimony}
                  onChange={e => {
                    setDamagedPatrimony(e.target.value.toUpperCase());
                    setDamagedModalError('');
                  }}
                  placeholder="Ex: PAT-100235 ou PAT-200552..."
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-rose-500 uppercase focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Descrição do Defeito / Avaria (Opcional)
                </label>
                <input
                  type="text"
                  value={damageDescription}
                  onChange={e => setDamageDescription(e.target.value)}
                  placeholder="Ex: Não gela, motor queimado, torneira quebrada, gabinete amassado..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsDamagedModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Registrar como Danificado</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================================================
          PROMPT / MODAL: PATRIMÔNIO NÃO ENCONTRADO NA BASE
          ========================================================================= */}
      {isUncatPromptOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 text-slate-900">

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Tag className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Patrimônio Fora da Base
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    O patrimônio {pendingUncatPatrimony} não foi localizado no catálogo da base
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUncatPromptOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmUncat} className="space-y-3.5">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <span className="font-bold block">Registrar como Equipamento Encontrado Fora da Base?</span>
                <p className="text-[11px] text-slate-600">
                  Ele será listado no relatório de envio oficial e zerado automaticamente na virada do dia para cadastramento manual posterior.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Observações do Equipamento Encontrado
                </label>
                <input
                  type="text"
                  value={pendingUncatObservations}
                  onChange={e => setPendingUncatObservations(e.target.value)}
                  placeholder="Ex: Encontrado no pátio 2, sem adesivo..."
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pendingUncatIsDamaged}
                    onChange={e => setPendingUncatIsDamaged(e.target.checked)}
                    className="w-4 h-4 rounded text-rose-600"
                  />
                  <span>Equipamento está DANIFICADO</span>
                </label>
              </div>

              {pendingUncatIsDamaged && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Defeito / Avaria
                  </label>
                  <input
                    type="text"
                    value={pendingUncatDamageDesc}
                    onChange={e => setPendingUncatDamageDesc(e.target.value)}
                    placeholder="Ex: Não gela, motor queimado..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-rose-500 focus:bg-white"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUncatPromptOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Adicionar à Contagem</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DE ESCOLHA: ATIVO NÃO CADASTRADO NA BASE (FREEZER OU CHOPEIRA)
          Ao inserir um patrimônio na contagem e o mesmo não estiver cadastrado na base,
          aparecerá uma mensagem de observação que o ativo não está cadastrado na base
          e abrirá uma janela para cadastro do mesmo, perguntando primeiro se o cadastro
          será de Freezer ou Chopeira e ao selecionar, abrirá a tela de cadastro referente a escolha.
          ========================================================================= */}
      {isChoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 text-slate-900">

            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Ativo Não Cadastrado na Base
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Patrimônio: <strong className="font-mono text-amber-900">{unregisteredPatrimony}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChoiceModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Observação: Este ativo não está cadastrado na base!</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Escolha abaixo, qual categoria que esse patrimônio pertence:
              </p>
            </div>

            {/* As duas opções solicitadas pelo usuário: Freezer ou Chopeira */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Botão 1: Freezer */}
              <button
                type="button"
                onClick={() => {
                  setIsChoiceModalOpen(false);
                  setIsCadastrarFreezerOpen(true);
                }}
                className="p-4 rounded-2xl border-2 border-sky-200 bg-sky-50/70 hover:bg-sky-100 hover:border-sky-400 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform">
                  <Snowflake className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">Freezer</span>
                  <span className="text-[10px] text-sky-800 block">4 Caixas, 8 Caixas...</span>
                </div>
              </button>

              {/* Botão 2: Chopeira */}
              <button
                type="button"
                onClick={() => {
                  setIsChoiceModalOpen(false);
                  setIsCadastrarChopeiraOpen(true);
                }}
                className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/70 hover:bg-amber-100 hover:border-amber-400 text-left transition-all active:scale-95 flex flex-col justify-between group cursor-pointer shadow-xs"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center mb-3 shadow-sm group-hover:scale-105 transition-transform">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 block">Chopeira</span>
                  <span className="text-[10px] text-amber-900 block">1 ou 2 Torneiras...</span>
                </div>
              </button>
            </div>

            {/* Lembrete atualizado */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
              <span className="text-amber-500 font-bold shrink-0">📌</span>
              <span>
                <strong>Lembrete:</strong> Lembre-se de solicitar o(s) cadastro(s) do(s) código(s) do(s) equipamento(s) encontrado(s) na contagem.
              </span>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsChoiceModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Cadastro de Freezer acionado pelo fluxo */}
      <CadastrarFreezerModal
        isOpen={isCadastrarFreezerOpen}
        onClose={() => setIsCadastrarFreezerOpen(false)}
        onBack={() => {
          setIsCadastrarFreezerOpen(false);
          setIsChoiceModalOpen(true);
        }}
        isFromCount={true}
        initialPatrimony={unregisteredPatrimony}
        onSuccessCreated={handleFreezerCreated}
      />

      {/* Modal de Cadastro de Chopeira acionado pelo fluxo */}
      <CadastrarEquipamentoModal
        isOpen={isCadastrarChopeiraOpen}
        onClose={() => setIsCadastrarChopeiraOpen(false)}
        onBack={() => {
          setIsCadastrarChopeiraOpen(false);
          setIsChoiceModalOpen(true);
        }}
        isFromCount={true}
        initialPatrimony={unregisteredPatrimony}
        onSuccessCreated={handleChopeiraCreated}
      />

      {/* Modal para Editar / Gerenciar Defeitos dos Equipamentos */}
      <DefeitosModal
        isOpen={isDefeitosModalOpen}
        onClose={() => setIsDefeitosModalOpen(false)}
      />

      {/* Modal Clonar Última (Apenas Master) */}
      <ModalClonarUltima
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        onCloned={msg => showFeedback(msg, 'success')}
      />

      {/* Janela Modal: Não existe equipamento cadastrado */}
      {isNoEquipmentsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Aviso do Sistema</h3>
                <p className="text-xs text-amber-700 font-semibold">Gestão de Equipamentos</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 font-bold leading-relaxed">
              Não existe equipamento cadastrado.
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNoEquipmentsModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
