
import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  MaterialItem,
  FreezerItem,
  EquipmentItem,
  SystemLog,
  StockUser,
  MaterialDailyEntry,
  EquipmentDailyEntry,
  UncataloguedEquipment,
  LastCountBackup,
  EmailSettings,
  ServerEmailConfig,
  CloneGroupTarget,
  ContadorSession,
  CountStartedBy,
  UnitBranch,
  REAL_BRANCHES,
  TEST_BRANCHES,
  ALL_BRANCHES,
  CORINGA_REGISTRATION,
  isTestBranch,
  toTestBranch,
  isCoringaUser
} from '../types/inventory';
import {
  INITIAL_MATERIALS,
  INITIAL_FREEZERS,
  INITIAL_EQUIPMENTS,
  INITIAL_LOGS,
  INITIAL_USERS,
  CORINGA_USER,
  INITIAL_EMAIL_SETTINGS,
  INITIAL_SERVER_EMAIL_CONFIG
} from '../data/initialData';
import { getTodayKey, formatDateBR } from '../utils/dateUtils';
import {
  fetchBranchData,
  fetchUsersFromFirestore,
  pushBranchToFirestore,
  pushUsersToFirestore,
  isQuotaExceededError,
  BranchSyncPayload
} from '../services/firebaseSyncService';

interface InventoryContextType {
  materials: MaterialItem[];
  freezers: FreezerItem[];
  equipments: EquipmentItem[];
  users: StockUser[];
  activeUser: StockUser | null;
  emailSettings: EmailSettings;
  serverEmailConfig: ServerEmailConfig;
  logs: SystemLog[];

  // Gestão de Base por Unidade (PAULO AFONSO e DELMIRO)
  activeBranch: UnitBranch;
  setActiveBranch: (branch: UnitBranch) => void;
  isCountAlreadyZero: (scope?: 'materiais' | 'equipamentos' | 'ambos') => boolean;

  // Permissões e Controle de Concorrência
  isMaster: boolean;
  isCoringa: boolean;
  recloneTestBasesFromApp: () => void;
  activeContadorSession: ContadorSession | null;
  isContadorActive: boolean;
  clearContadorSession: (targetBranchChoice?: UnitBranch) => void;

  // Estado e Regras de Contagem Concorrente
  countStartedBy: CountStartedBy | null;
  recontagemTargetContador: CountStartedBy | null;
  isReportSent: boolean;
  recontagemUnlocked: boolean;
  isCountInProgress: boolean;
  isAnyBaseCountInProgress: boolean;
  canActiveUserCount: boolean;
  canActiveUserRecount: boolean;
  isRecontagemTabsBlockedForContador: boolean;
  cantCountReason: string | null;
  markCountAsSent: (branch?: UnitBranch) => Promise<{ synced: boolean; message?: string }>;
  releaseRecontagemForContador: (targetContador?: StockUser | null) => Promise<{ success: boolean; message: string }>;
  revokeRecontagemForContador: () => Promise<{ success: boolean; message: string }>;
  markRecountAsSent: () => Promise<{ synced: boolean; message?: string }>;
  cancelRecontagemByContador: () => Promise<{ synced: boolean; message: string }>;
  systemNotice: string | null;
  setSystemNotice: (msg: string | null) => void;

  // Sincronização Manual com Firebase (Apenas Master na tela Cadastros)
  syncMasterDataToFirebase: () => Promise<{ success: boolean; message: string }>;
  hasPendingMasterSync: boolean;
  lastFirebaseSyncAt: string | null;

  // Contagem Diária do Dia Atual
  todayKey: string;
  todayDateFormatted: string;
  materialCounts: Record<string, MaterialDailyEntry>;
  equipmentCounts: Record<string, EquipmentDailyEntry>;
  uncataloguedEquipments: UncataloguedEquipment[];
  lastCountBackup: LastCountBackup | null;

  // Atualização em tempo real (salvamento automático imediato)
  updateMaterialCount: (itemId: string, data: Partial<MaterialDailyEntry>) => void;
  updateEquipmentCount: (itemId: string, data: Partial<EquipmentDailyEntry>) => void;
  removeEquipmentCount: (itemId: string) => void;

  // Equipamentos encontrados não cadastrados na base
  addUncataloguedEquipment: (item: Omit<UncataloguedEquipment, 'id' | 'createdAt'>) => void;
  updateUncataloguedEquipment: (item: UncataloguedEquipment) => void;
  deleteUncataloguedEquipment: (id: string) => void;
  deleteUnregisteredItemEntireHistory: (patrimony: string, itemId?: string) => void;

  // Ações de Gestão de Contagem (Apenas Master)
  cloneLastMaterialCount: () => boolean;
  cloneLastEquipmentCount: () => boolean;
  cloneSelectiveCount: (target: CloneGroupTarget) => { success: boolean; message: string };
  resetAllTodayCountsByMaster: (scope?: 'materiais' | 'equipamentos' | 'ambos') => void;

  // Autenticação / Login
  verifyCredentials: (registration: string, password: string) => Promise<{ success: boolean; message?: string; user?: StockUser }>;
  login: (registration: string, password: string, branchChoice?: UnitBranch, skipUsersRefresh?: boolean) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  setActiveUser: (user: StockUser | null) => void;

  // Gestão de MATERIAIS
  addMaterial: (item: Omit<MaterialItem, 'id' | 'createdAt'>) => void;
  updateMaterial: (item: MaterialItem) => void;
  deleteMaterial: (id: string) => void;

  // Gestão de FREEZERS
  addFreezer: (item: Omit<FreezerItem, 'id' | 'createdAt'>) => FreezerItem | undefined;
  updateFreezer: (item: FreezerItem) => void;
  deleteFreezer: (id: string) => void;

  // Gestão de EQUIPAMENTOS (Chopeiras Elétricas)
  addEquipment: (item: Omit<EquipmentItem, 'id' | 'createdAt'>) => EquipmentItem | undefined;
  updateEquipment: (item: EquipmentItem) => void;
  deleteEquipment: (id: string) => void;

  // Importação e Exportação Base de Itens
  importBaseItems: (
    data: { materials?: MaterialItem[]; freezers?: FreezerItem[]; equipments?: EquipmentItem[] },
    mode?: 'replace' | 'append',
    targetStock?: 'materiais' | 'equipamentos' | 'ambos',
    targetBranch?: UnitBranch
  ) => { materialsAdded: number; freezersAdded: number; equipmentsAdded: number; message: string };

  // Gestão de USUÁRIOS
  addUser: (user: Omit<StockUser, 'id' | 'createdAt'>) => void;
  updateUser: (user: StockUser) => void;
  deleteUser: (id: string) => void;

  // Opções de Envio / E-mails & Servidor Padrão
  updateEmailSettings: (settings: EmailSettings) => void;
  updateServerEmailConfig: (config: ServerEmailConfig) => void;
  recipientsText: string;
  updateRecipientsText: (text: string) => void;
  defaultSenderEmail: string;
  addEmail: (email: string) => void;
  removeEmail: (email: string) => void;
  setDefaultEmail: (email: string) => void;

  // Utilitários
  addLog: (log: Omit<SystemLog, 'id' | 'timestamp'>) => void;
  clearAllData: () => void;
  clearSelectedData: (stock: 'materiais' | 'equipamentos' | 'ambos', branchTarget?: UnitBranch | 'AMBAS') => { success: boolean; message?: string };

  // Prévia e Preservação da Contagem
  frozenReportText: string | null;
  setFrozenReportText: (text: string | null) => void;

  // Lembrete Master de Materiais sem Código
  emptyMaterialCodesAlert: string | null;
  setEmptyMaterialCodesAlert: (alert: string | null) => void;

  // Modo Celular / Padrão de Exibição
  isPhoneFrame: boolean;
  setIsPhoneFrame: (val: boolean) => void;

  // Recontagem de Estoque (Isolada por Base)
  recontagemSelectedIds: Record<string, boolean>;
  recontagemMaterialCounts: Record<string, MaterialDailyEntry>;
  recontagemEquipmentCounts: Record<string, EquipmentDailyEntry>;
  toggleRecontagemItem: (id: string) => void;
  setRecontagemItem: (id: string, selected: boolean) => void;
  selectAllRecontagem: (type: 'materiais' | 'equipamentos' | 'all') => void;
  clearAllRecontagem: () => void;
  updateRecontagemMaterialCount: (itemId: string, data: Partial<MaterialDailyEntry>) => void;
  updateRecontagemEquipmentCount: (itemId: string, data: Partial<EquipmentDailyEntry>) => void;
  recontagemSelectedCount: number;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const getBranchStorageKey = (branch: UnitBranch, subKey: string) => {
  switch (branch) {
    case 'PAULO AFONSO':
      return `choppstock_pa_${subKey}`;
    case 'DELMIRO':
      return `choppstock_del_${subKey}`;
    case 'PAULO AFONSO (TESTE)':
      return `choppstock_test_pa_${subKey}`;
    case 'DELMIRO (TESTE)':
      return `choppstock_test_del_${subKey}`;
    default:
      return `choppstock_pa_${subKey}`;
  }
};

const normalizeProductionBranch = (branch?: string | null): 'PAULO AFONSO' | 'DELMIRO' => {
  const clean = (branch || '').trim().toUpperCase();
  if (clean.startsWith('DELMIRO')) return 'DELMIRO';
  return 'PAULO AFONSO';
};

const TEST_USERS_STORAGE_KEY = 'choppstock_test_users_v1';
const TEST_BASES_CLONED_KEY = 'choppstock_test_bases_cloned_v1';

const ensureCoringaUser = (list: StockUser[]): StockUser[] => {
  const valid = Array.isArray(list) ? list.filter(u => u && u.registration) : [];
  const hasCoringa = valid.some(u => isCoringaUser(u));
  if (hasCoringa) {
    return valid.map(u =>
      isCoringaUser(u)
        ? {
            ...CORINGA_USER,
            ...u,
            id: CORINGA_USER.id,
            registration: CORINGA_REGISTRATION,
            name: 'CORINGA',
            password: '',
            roleLevel: 'contador',
            branch: 'PAULO AFONSO (TESTE)',
            status: 'ativo',
            isTestUser: true,
          }
        : u
    );
  }
  return [...valid, CORINGA_USER];
};

const hasMaterialEntryQuantity = (m?: Partial<MaterialDailyEntry> | null): boolean => {
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

const STORAGE_KEYS = {
  MATERIALS: 'choppstock_materials_v8',
  FREEZERS: 'choppstock_freezers_v8',
  EQUIPMENTS: 'choppstock_equipments_v8',
  USERS: 'choppstock_users_v8',
  ACTIVE_USER: 'choppstock_active_user_v8',
  ACTIVE_CONTADOR_SESSION: 'choppstock_active_contador_session_v1',
  EMAIL_SETTINGS: 'choppstock_emails_v8',
  SERVER_EMAIL_CONFIG: 'choppstock_server_email_config_v2',
  RECIPIENTS_TEXT: 'choppstock_recipients_text_v9',
  CALENDAR_DAY: 'choppstock_calendar_day_v8',
  TODAY_MATERIAL_COUNTS: 'choppstock_today_materials_v8',
  TODAY_EQUIPMENT_COUNTS: 'choppstock_today_equipments_v8',
  TODAY_UNCATALOGUED_EQUIPMENTS: 'choppstock_today_uncatalogued_v8',
  LAST_COUNT_BACKUP: 'choppstock_last_count_backup_v8',
  LOGS: 'choppstock_logs_v8',
  FROZEN_REPORT: 'choppstock_frozen_report_v1',
};

// Carrega ou clona os dados da base existente para assegurar total independência e dados clonados inicialmente
const loadInitialBranchData = <T,>(branch: UnitBranch, subKey: string, fallback: T, legacyKeys: string[] = []): T => {
  const branchKey = getBranchStorageKey(branch, subKey);
  const saved = localStorage.getItem(branchKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {}
  }
  // Se ainda não existir nesta base, tenta clonar de chaves legadas/existentes
  for (const k of legacyKeys) {
    const leg = localStorage.getItem(k);
    if (leg) {
      try {
        const parsed = JSON.parse(leg);
        if (parsed !== null && parsed !== undefined) {
          localStorage.setItem(branchKey, JSON.stringify(parsed));
          return parsed;
        }
      } catch {}
    }
  }
  if (fallback !== undefined && fallback !== null) {
    localStorage.setItem(branchKey, JSON.stringify(fallback));
  }
  return fallback;
};

// Limpeza de inicialização: garante que nenhum item comece com "Recontar" selecionado nem com botões marcados
const RECONTAGEM_STORAGE_RESET_KEY = 'choppstock_recontagem_unselected_v2';
if (typeof window !== 'undefined') {
  if (!localStorage.getItem(RECONTAGEM_STORAGE_RESET_KEY)) {
    localStorage.setItem(RECONTAGEM_STORAGE_RESET_KEY, 'true');
    const branches: UnitBranch[] = ['PAULO AFONSO', 'DELMIRO'];
    branches.forEach(b => {
      localStorage.setItem(getBranchStorageKey(b, 'recontagem_selected_ids'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(b, 'recontagem_material_counts'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(b, 'recontagem_equipment_counts'), JSON.stringify({}));
    });
  }
}

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const currentTodayKey = getTodayKey();

  // EXIGÊNCIA: Bases independentes PAULO AFONSO e DELMIRO (+ Bases de Teste isoladas para CORINGA)
  const [activeBranch, setActiveBranchState] = useState<UnitBranch>(() => {
    const savedUser = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    const savedBranch = localStorage.getItem('choppstock_active_branch') as UnitBranch | null;
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser) as StockUser;
        if (u && isCoringaUser(u)) {
          if (savedBranch === 'DELMIRO (TESTE)' || savedBranch === 'PAULO AFONSO (TESTE)') {
            return savedBranch;
          }
          return 'PAULO AFONSO (TESTE)';
        }
        if (u && u.roleLevel === 'contador' && (u.branch === 'PAULO AFONSO' || u.branch === 'DELMIRO')) {
          return u.branch;
        }
      } catch {}
    }
    if (savedBranch === 'DELMIRO' || savedBranch === 'PAULO AFONSO') return savedBranch;
    return 'PAULO AFONSO';
  });

  const isSwitchingBranchRef = useRef(false);
  const activeBranchRef = useRef<UnitBranch>(activeBranch);
  useEffect(() => {
    activeBranchRef.current = activeBranch;
  }, [activeBranch]);

  // Catálogos isolados por base (clonados na primeira execução para PAULO AFONSO e DELMIRO)
  const [systemNotice, setSystemNotice] = useState<string | null>(null);

  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    return loadInitialBranchData(
      activeBranch,
      'materials',
      INITIAL_MATERIALS,
      isTestBranch(activeBranch)
        ? []
        : [STORAGE_KEYS.MATERIALS, 'choppstock_materials_v7', 'choppstock_materials_v6', 'choppstock_materials_v5', 'choppstock_materials']
    );
  });

  const [freezers, setFreezers] = useState<FreezerItem[]>(() => {
    return loadInitialBranchData(
      activeBranch,
      'freezers',
      INITIAL_FREEZERS,
      isTestBranch(activeBranch)
        ? []
        : [STORAGE_KEYS.FREEZERS, 'choppstock_freezers_v7', 'choppstock_freezers_v6', 'choppstock_freezers_v5', 'choppstock_freezers']
    );
  });

  const [equipments, setEquipments] = useState<EquipmentItem[]>(() => {
    return loadInitialBranchData(
      activeBranch,
      'equipments',
      INITIAL_EQUIPMENTS,
      isTestBranch(activeBranch)
        ? []
        : [STORAGE_KEYS.EQUIPMENTS, 'choppstock_equipments_v7', 'choppstock_equipments_v6', 'choppstock_equipments_v5', 'choppstock_equipments']
    );
  });

  const loadProductionUsersFromStorage = (): StockUser[] => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    let userList: StockUser[] = INITIAL_USERS;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) userList = parsed;
      } catch {}
    }

    let needsUpdate = false;
    userList = userList.map(u => {
      if (isCoringaUser(u)) return u;
      if (u.registration === '2001' && (!u.branch || isTestBranch(u.branch))) {
        needsUpdate = true;
        return { ...u, branch: 'PAULO AFONSO' as const };
      }
      if (u.registration === '2002' && (!u.branch || isTestBranch(u.branch))) {
        needsUpdate = true;
        return { ...u, branch: 'DELMIRO' as const };
      }
      if (u.roleLevel === 'contador') {
        const normalized = normalizeProductionBranch(u.branch);
        if (u.branch !== normalized) {
          needsUpdate = true;
          return { ...u, branch: normalized };
        }
      }
      return u;
    });

    const hasPedro = userList.some(u => u.registration === '2002');
    if (!hasPedro) {
      userList.push({
        id: 'usr-contador-2',
        registration: '2002',
        name: 'Pedro Conferente',
        password: '1234',
        roleLevel: 'contador',
        branch: 'DELMIRO',
        status: 'ativo',
        createdAt: 'Administrador Master - 08/10/2026 às 08:35',
      });
      needsUpdate = true;
    }

    const withCoringa = ensureCoringaUser(userList);
    if (needsUpdate || withCoringa.length !== userList.length) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(withCoringa));
    }
    return withCoringa;
  };

  const [users, setUsers] = useState<StockUser[]>(() => {
    try {
      const savedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
      if (savedActive) {
        const u = JSON.parse(savedActive) as StockUser;
        if (isCoringaUser(u)) {
          const savedTestUsers = localStorage.getItem(TEST_USERS_STORAGE_KEY);
          if (savedTestUsers) {
            const parsedTest = JSON.parse(savedTestUsers);
            if (Array.isArray(parsedTest) && parsedTest.length > 0) {
              return ensureCoringaUser(parsedTest);
            }
          }
        }
      }
    } catch {}
    return loadProductionUsersFromStorage();
  });

  const usersRef = useRef<StockUser[]>(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Usuário ativo da sessão
  const [activeUser, setActiveUserState] = useState<StockUser | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.id) return parsed;
      } catch {}
    }
    return null;
  });

  // Registro do Contador que iniciou a contagem na base atual
  const [countStartedBy, setCountStartedBy] = useState<CountStartedBy | null>(() => {
    return loadInitialBranchData<CountStartedBy | null>(activeBranch, 'count_started_by', null, []);
  });

  // Indicador de relatório já enviado por e-mail na base atual
  const [isReportSent, setIsReportSent] = useState<boolean>(() => {
    return loadInitialBranchData<boolean>(activeBranch, 'is_report_sent', false, []);
  });

  // Indicador de recontagem liberada pelo Master para o contador inicial ou selecionado
  const [recontagemUnlocked, setRecontagemUnlocked] = useState<boolean>(() => {
    return loadInitialBranchData<boolean>(activeBranch, 'recontagem_unlocked', false, []);
  });

  // Contador específico selecionado pelo Master (quando há contagem específica sem contagem inicial)
  const [recontagemTargetContador, setRecontagemTargetContador] = useState<CountStartedBy | null>(() => {
    return loadInitialBranchData<CountStartedBy | null>(activeBranch, 'recontagem_target_contador', null, []);
  });

  const readBranchInitialStatus = (b: UnitBranch) => {
    try {
      const storedDay = localStorage.getItem(getBranchStorageKey(b, 'calendar_day'));
      if (storedDay && storedDay !== getTodayKey()) {
        return {
          countStartedBy: null,
          recontagemTargetContador: null,
          isReportSent: false,
          recontagemUnlocked: false,
          activeContadorSession: null,
          hasCounts: false,
        };
      }
      const csbRaw = localStorage.getItem(getBranchStorageKey(b, 'count_started_by'));
      const recTargetRaw = localStorage.getItem(getBranchStorageKey(b, 'recontagem_target_contador'));
      const irsRaw = localStorage.getItem(getBranchStorageKey(b, 'is_report_sent'));
      const recUnlockedRaw = localStorage.getItem(getBranchStorageKey(b, 'recontagem_unlocked'));
      const sessRaw = localStorage.getItem(getBranchStorageKey(b, 'active_contador_session'));
      const matsRaw = localStorage.getItem(getBranchStorageKey(b, 'today_materials'));
      const eqsRaw = localStorage.getItem(getBranchStorageKey(b, 'today_equipments'));
      const uncatRaw = localStorage.getItem(getBranchStorageKey(b, 'today_uncatalogued'));

      const parsedCsb: CountStartedBy | null = csbRaw ? JSON.parse(csbRaw) : null;
      const parsedRecTarget: CountStartedBy | null = recTargetRaw ? JSON.parse(recTargetRaw) : null;
      const parsedRecUnlocked: boolean = recUnlockedRaw ? JSON.parse(recUnlockedRaw) : false;
      const parsedMats: Record<string, MaterialDailyEntry> = matsRaw ? JSON.parse(matsRaw) : {};
      const parsedEqs: Record<string, EquipmentDailyEntry> = eqsRaw ? JSON.parse(eqsRaw) : {};
      const parsedUncat: UncataloguedEquipment[] = uncatRaw ? JSON.parse(uncatRaw) : [];

      const hasCounts =
        Object.values(parsedMats).some(hasMaterialEntryQuantity) ||
        Object.keys(parsedEqs).length > 0 ||
        parsedUncat.length > 0;

      // Relatório enviado só permanece bloqueando se houver itens contados na base
      const parsedIrs: boolean = (irsRaw ? JSON.parse(irsRaw) : false) && hasCounts;

      // Mantém sessão ativa se houver contagem iniciada não enviada OU recontagem liberada ativa
      const parsedSess: ContadorSession | null =
        ((!parsedIrs && (Boolean(parsedCsb) || hasCounts)) || parsedRecUnlocked) && sessRaw
          ? JSON.parse(sessRaw)
          : null;

      return {
        countStartedBy: parsedCsb,
        recontagemTargetContador: parsedRecTarget,
        isReportSent: parsedIrs,
        recontagemUnlocked: parsedRecUnlocked,
        activeContadorSession: parsedSess,
        hasCounts,
      };
    } catch {
      return {
        countStartedBy: null,
        recontagemTargetContador: null,
        isReportSent: false,
        recontagemUnlocked: false,
        activeContadorSession: null,
        hasCounts: false,
      };
    }
  };

  // Sessão de Contador isolada por base (apenas quando há contagem iniciada ou recontagem em andamento)
  const [activeContadorSession, setActiveContadorSession] = useState<ContadorSession | null>(() => {
    return readBranchInitialStatus(activeBranch).activeContadorSession;
  });

  // Estado de todas as bases (produção + teste) para controle isolado de concorrência
  type BranchConcurrencyStatus = {
    countStartedBy: CountStartedBy | null;
    recontagemTargetContador: CountStartedBy | null;
    isReportSent: boolean;
    recontagemUnlocked: boolean;
    activeContadorSession: ContadorSession | null;
    hasCounts: boolean;
  };

  const [branchStatuses, setBranchStatuses] = useState<Record<UnitBranch, BranchConcurrencyStatus>>(() => ({
    'PAULO AFONSO': readBranchInitialStatus('PAULO AFONSO'),
    'DELMIRO': readBranchInitialStatus('DELMIRO'),
    'PAULO AFONSO (TESTE)': readBranchInitialStatus('PAULO AFONSO (TESTE)'),
    'DELMIRO (TESTE)': readBranchInitialStatus('DELMIRO (TESTE)'),
  }));

  const updateBranchStatusMap = (
    branch: UnitBranch,
    updater: BranchConcurrencyStatus | ((prev: BranchConcurrencyStatus) => BranchConcurrencyStatus)
  ) => {
    setBranchStatuses(prev => ({
      ...prev,
      [branch]: typeof updater === 'function' ? updater(prev[branch]) : updater,
    }));
  };

  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => {
    return loadInitialBranchData(
      activeBranch,
      'email_settings',
      INITIAL_EMAIL_SETTINGS,
      [STORAGE_KEYS.EMAIL_SETTINGS]
    );
  });

  const [serverEmailConfig, setServerEmailConfig] = useState<ServerEmailConfig>(() => {
    return loadInitialBranchData(
      activeBranch,
      'server_email_config',
      INITIAL_SERVER_EMAIL_CONFIG,
      [STORAGE_KEYS.SERVER_EMAIL_CONFIG]
    );
  });

  const [recipientsText, setRecipientsTextState] = useState<string>(() => {
    const branchKey = getBranchStorageKey(activeBranch, 'recipients_text');
    const saved = localStorage.getItem(branchKey);
    if (saved !== null) return saved;
    const legacy = localStorage.getItem(STORAGE_KEYS.RECIPIENTS_TEXT);
    if (legacy !== null) return legacy;
    return INITIAL_EMAIL_SETTINGS.emails.join(', ');
  });

  const updateRecipientsText = (text: string) => {
    setRecipientsTextState(text);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recipients_text'), text);
    const parsed = text
      .split(/[,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@'));
    setEmailSettings(prev => {
      const updated = {
        ...prev,
        emails: parsed,
        defaultEmail: parsed[0] || prev.defaultEmail || 'thiago.paiva@grupo.ms',
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(updated));
      return updated;
    });
    if (isMaster) markMasterChangesPending();
  };

  const defaultSenderEmail = serverEmailConfig.senderEmail || emailSettings.defaultEmail || '';

  const [logs, setLogs] = useState<SystemLog[]>(() => {
    return loadInitialBranchData(activeBranch, 'logs', INITIAL_LOGS, []);
  });

  const [lastCountBackup, setLastCountBackup] = useState<LastCountBackup | null>(() => {
    return loadInitialBranchData(activeBranch, 'last_count_backup', null, []);
  });

  const [frozenReportText, setFrozenReportTextState] = useState<string | null>(() => {
    return localStorage.getItem(getBranchStorageKey(activeBranch, 'frozen_report'));
  });

  const setFrozenReportText = (text: string | null) => {
    setFrozenReportTextState(text);
    if (text) {
      localStorage.setItem(getBranchStorageKey(activeBranch, 'frozen_report'), text);
    } else {
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'frozen_report'));
    }
  };

  const [emptyMaterialCodesAlert, setEmptyMaterialCodesAlert] = useState<string | null>(null);
  const [isPhoneFrame, setIsPhoneFrame] = useState(false);

  const [todayKey, setTodayKey] = useState<string>(() => {
    const storedDay = localStorage.getItem(getBranchStorageKey(activeBranch, 'calendar_day'));
    return storedDay || currentTodayKey;
  });

  // Contagens 100% isoladas por base: nunca copiam contagens de outra base
  const [materialCounts, setMaterialCounts] = useState<Record<string, MaterialDailyEntry>>(() => {
    const storedDay = localStorage.getItem(getBranchStorageKey(activeBranch, 'calendar_day'));
    if (storedDay === currentTodayKey) {
      return loadInitialBranchData(activeBranch, 'today_materials', {}, []);
    }
    return {};
  });

  const [equipmentCounts, setEquipmentCounts] = useState<Record<string, EquipmentDailyEntry>>(() => {
    const storedDay = localStorage.getItem(getBranchStorageKey(activeBranch, 'calendar_day'));
    if (storedDay === currentTodayKey) {
      return loadInitialBranchData(activeBranch, 'today_equipments', {}, []);
    }
    return {};
  });

  const [uncataloguedEquipments, setUncataloguedEquipments] = useState<UncataloguedEquipment[]>(() => {
    const storedDay = localStorage.getItem(getBranchStorageKey(activeBranch, 'calendar_day'));
    if (storedDay === currentTodayKey) {
      return loadInitialBranchData(activeBranch, 'today_uncatalogued', [], []);
    }
    return [];
  });

  // Estados de Recontagem (100% isolados por base e limpos ao virar o dia)
  const [recontagemSelectedIds, setRecontagemSelectedIds] = useState<Record<string, boolean>>(() => {
    const storedDay = localStorage.getItem(getBranchStorageKey(activeBranch, 'calendar_day'));
    if (storedDay === currentTodayKey) {
      return loadInitialBranchData(activeBranch, 'recontagem_selected_ids', {}, []);
    }
    return {};
  });

  const [recontagemMaterialCounts, setRecontagemMaterialCounts] = useState<Record<string, MaterialDailyEntry>>(() => {
    const storedDay = localStorage.getItem(getBranchStorageKey(activeBranch, 'calendar_day'));
    if (storedDay === currentTodayKey) {
      return loadInitialBranchData(activeBranch, 'recontagem_material_counts', {}, []);
    }
    return {};
  });

  const [recontagemEquipmentCounts, setRecontagemEquipmentCounts] = useState<Record<string, EquipmentDailyEntry>>(() => {
    const storedDay = localStorage.getItem(getBranchStorageKey(activeBranch, 'calendar_day'));
    if (storedDay === currentTodayKey) {
      return loadInitialBranchData(activeBranch, 'recontagem_equipment_counts', {}, []);
    }
    return {};
  });

  // Carrega todos os estados locais da base informada para os estados ativos em tela (sem jamais herdar estado de outra base)
  const loadBranchLocalStateIntoActive = (
    branch: UnitBranch,
    todayStr: string,
    options?: { includeCatalogs?: boolean; includeConfigs?: boolean; updateStatusMap?: boolean }
  ) => {
    const includeCatalogs = options?.includeCatalogs ?? true;
    const includeConfigs = options?.includeConfigs ?? true;
    const shouldUpdateStatusMap = options?.updateStatusMap ?? true;

    const legacyMats = isTestBranch(branch) ? [] : [STORAGE_KEYS.MATERIALS];
    const legacyFrzs = isTestBranch(branch) ? [] : [STORAGE_KEYS.FREEZERS];
    const legacyEqs = isTestBranch(branch) ? [] : [STORAGE_KEYS.EQUIPMENTS];
    const legacyEmail = isTestBranch(branch) ? [] : [STORAGE_KEYS.EMAIL_SETTINGS];
    const legacySrv = isTestBranch(branch) ? [] : [STORAGE_KEYS.SERVER_EMAIL_CONFIG];

    if (includeCatalogs) {
      setMaterials(loadInitialBranchData(branch, 'materials', INITIAL_MATERIALS, legacyMats));
      setFreezers(loadInitialBranchData(branch, 'freezers', INITIAL_FREEZERS, legacyFrzs));
      setEquipments(loadInitialBranchData(branch, 'equipments', INITIAL_EQUIPMENTS, legacyEqs));
    }

    const dKey = loadInitialBranchData(branch, 'calendar_day', todayStr, []);
    const isNewDay = dKey !== todayStr;

    let backupToSet = loadInitialBranchData<LastCountBackup | null>(branch, 'last_count_backup', null, []);

    if (isNewDay) {
      try {
        const prevMat = loadInitialBranchData<Record<string, MaterialDailyEntry>>(branch, 'today_materials', {}, []);
        const prevEq = loadInitialBranchData<Record<string, EquipmentDailyEntry>>(branch, 'today_equipments', {}, []);
        const prevUncat = loadInitialBranchData<UncataloguedEquipment[]>(branch, 'today_uncatalogued', [], []);
        const hadPrev =
          Object.values(prevMat || {}).some(hasMaterialEntryQuantity) ||
          Object.keys(prevEq || {}).length > 0 ||
          (Array.isArray(prevUncat) && prevUncat.length > 0);
        if (hadPrev) {
          backupToSet = {
            date: dKey,
            materials: prevMat || {},
            equipments: prevEq || {},
            uncatalogued: Array.isArray(prevUncat) ? prevUncat : [],
            savedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          };
          localStorage.setItem(getBranchStorageKey(branch, 'last_count_backup'), JSON.stringify(backupToSet));
        }
      } catch {}

      localStorage.setItem(getBranchStorageKey(branch, 'today_materials'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(branch, 'today_equipments'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(branch, 'today_uncatalogued'), JSON.stringify([]));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_selected_ids'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_material_counts'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_equipment_counts'), JSON.stringify({}));
      localStorage.removeItem(getBranchStorageKey(branch, 'count_started_by'));
      localStorage.removeItem(getBranchStorageKey(branch, 'recontagem_target_contador'));
      localStorage.removeItem(getBranchStorageKey(branch, 'active_contador_session'));
      localStorage.setItem(getBranchStorageKey(branch, 'is_report_sent'), JSON.stringify(false));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_unlocked'), JSON.stringify(false));
      localStorage.setItem(getBranchStorageKey(branch, 'calendar_day'), todayStr);
    }

    const mCounts = isNewDay ? {} : loadInitialBranchData<Record<string, MaterialDailyEntry>>(branch, 'today_materials', {}, []);
    const eqCounts = isNewDay ? {} : loadInitialBranchData<Record<string, EquipmentDailyEntry>>(branch, 'today_equipments', {}, []);
    const uncat = isNewDay ? [] : loadInitialBranchData<UncataloguedEquipment[]>(branch, 'today_uncatalogued', [], []);
    const recSelected = isNewDay ? {} : loadInitialBranchData<Record<string, boolean>>(branch, 'recontagem_selected_ids', {}, []);
    const recMatCounts = isNewDay ? {} : loadInitialBranchData<Record<string, MaterialDailyEntry>>(branch, 'recontagem_material_counts', {}, []);
    const recEqCounts = isNewDay ? {} : loadInitialBranchData<Record<string, EquipmentDailyEntry>>(branch, 'recontagem_equipment_counts', {}, []);
    const cStarted = isNewDay ? null : loadInitialBranchData<CountStartedBy | null>(branch, 'count_started_by', null, []);
    const recTarget = isNewDay ? null : loadInitialBranchData<CountStartedBy | null>(branch, 'recontagem_target_contador', null, []);
    const rawRepSent = isNewDay ? false : loadInitialBranchData<boolean>(branch, 'is_report_sent', false, []);
    const recUnlocked = isNewDay ? false : loadInitialBranchData<boolean>(branch, 'recontagem_unlocked', false, []);

    let rawSess: ContadorSession | null = null;
    if (!isNewDay) {
      try {
        const sessStr = localStorage.getItem(getBranchStorageKey(branch, 'active_contador_session'));
        rawSess = sessStr ? JSON.parse(sessStr) : null;
      } catch {
        rawSess = null;
      }
    }

    const hasBranchCounts = !isNewDay && (
      Object.values(mCounts || {}).some(hasMaterialEntryQuantity) ||
      Object.keys(eqCounts || {}).length > 0 ||
      (Array.isArray(uncat) && uncat.length > 0)
    );
    const repSent = rawRepSent && hasBranchCounts;
    if (!isNewDay && rawRepSent && !repSent) {
      localStorage.setItem(getBranchStorageKey(branch, 'is_report_sent'), JSON.stringify(false));
    }
    const validSess = !isNewDay && ((!repSent && (Boolean(cStarted) || hasBranchCounts)) || recUnlocked) ? rawSess : null;

    if (includeConfigs) {
      const branchEmailSettings = loadInitialBranchData(branch, 'email_settings', INITIAL_EMAIL_SETTINGS, legacyEmail);
      const branchServerConfig = loadInitialBranchData(branch, 'server_email_config', INITIAL_SERVER_EMAIL_CONFIG, legacySrv);
      let branchRecipients = localStorage.getItem(getBranchStorageKey(branch, 'recipients_text'));
      if (branchRecipients === null) {
        branchRecipients = branchEmailSettings.emails.join(', ');
        localStorage.setItem(getBranchStorageKey(branch, 'recipients_text'), branchRecipients);
      }
      setEmailSettings(branchEmailSettings);
      setServerEmailConfig(branchServerConfig);
      setRecipientsTextState(branchRecipients);
    }

    const frzRep = localStorage.getItem(getBranchStorageKey(branch, 'frozen_report'));
    const lg = loadInitialBranchData(branch, 'logs', INITIAL_LOGS, []);

    setTodayKey(isNewDay ? todayStr : dKey);
    setMaterialCounts(mCounts || {});
    setEquipmentCounts(eqCounts || {});
    setUncataloguedEquipments(Array.isArray(uncat) ? uncat : []);
    setLastCountBackup(backupToSet);
    setLogs(lg);
    setFrozenReportTextState(frzRep);
    setActiveContadorSession(validSess);
    setCountStartedBy(cStarted);
    setRecontagemTargetContador(recTarget);
    setIsReportSent(repSent);
    setRecontagemUnlocked(recUnlocked);
    setRecontagemSelectedIds(recSelected || {});
    setRecontagemMaterialCounts(recMatCounts || {});
    setRecontagemEquipmentCounts(recEqCounts || {});

    const statusSnapshot: BranchConcurrencyStatus = {
      countStartedBy: cStarted,
      recontagemTargetContador: recTarget,
      isReportSent: repSent,
      recontagemUnlocked: recUnlocked,
      activeContadorSession: validSess,
      hasCounts: hasBranchCounts,
    };

    if (shouldUpdateStatusMap) {
      updateBranchStatusMap(branch, statusSnapshot);
    }

    return statusSnapshot;
  };

  // Alternar base ativa com carregamento integral isolado (apenas Master ou Coringa dentro das suas bases)
  const setActiveBranch = (newBranch: UnitBranch) => {
    const user = activeUserRef.current;
    const isCoringaUserActive = isCoringaUser(user);

    if (isCoringaUserActive) {
      if (!isTestBranch(newBranch)) return;
    } else {
      if (isTestBranch(newBranch)) return;
      // Bloqueio: Usuário Contador não pode alternar de base
      if (user?.roleLevel === 'contador' && normalizeProductionBranch(user.branch) !== newBranch) {
        return;
      }
    }

    if (newBranch === activeBranch) return;
    if (!isCoringaUserActive && user?.roleLevel === 'master') {
      const targetBranchStatus = readBranchInitialStatus(newBranch);
      const targetInProgress = targetBranchStatus.recontagemUnlocked || (
        !targetBranchStatus.isReportSent &&
        targetBranchStatus.hasCounts &&
        (Boolean(targetBranchStatus.countStartedBy) || Boolean(targetBranchStatus.activeContadorSession))
      );
      if (targetInProgress) {
        setSystemNotice(`Existe contagem em andamento na base ${newBranch}.`);
        return;
      }
    }

    isSwitchingBranchRef.current = true;
    activeBranchRef.current = newBranch;
    setActiveBranchState(newBranch);
    localStorage.setItem('choppstock_active_branch', newBranch);

    loadBranchLocalStateIntoActive(newBranch, getTodayKey(), {
      includeCatalogs: true,
      includeConfigs: true,
      updateStatusMap: true,
    });

    setTimeout(() => {
      isSwitchingBranchRef.current = false;
    }, 150);
  };

  // Bloqueio rigoroso: Usuário Contador padrão fica restrito estritamente à base cadastrada (CORINGA navega livremente nas bases teste)
  useEffect(() => {
    if (activeUser && activeUser.roleLevel === 'contador' && !isCoringaUser(activeUser)) {
      const allowedBranch = normalizeProductionBranch(activeUser.branch);
      if (activeBranch !== allowedBranch) {
        setActiveBranch(allowedBranch);
      }
    }
  }, [activeUser, activeBranch]);

  // EXIGÊNCIA: Verificar se a contagem já se encontra zerada (por tela ou globalmente)
  const isCountAlreadyZero = (scope: 'materiais' | 'equipamentos' | 'ambos' = 'ambos'): boolean => {
    const hasMats = Object.values(materialCounts).some(hasMaterialEntryQuantity);
    const hasRecMats = Object.values(recontagemMaterialCounts).some(hasMaterialEntryQuantity);
    const hasSelectedMats = materials.some(m => Boolean(recontagemSelectedIds[m.id]));

    const hasEqs = Object.keys(equipmentCounts).length > 0;
    const hasUncat = uncataloguedEquipments.length > 0;
    const hasRecEqs = Object.keys(recontagemEquipmentCounts).some(id => Boolean(recontagemEquipmentCounts[id]?.status));
    const hasSelectedEqs =
      freezers.some(f => Boolean(recontagemSelectedIds[f.id])) ||
      equipments.some(e => Boolean(recontagemSelectedIds[e.id]));

    if (scope === 'materiais') {
      return !hasMats && !hasRecMats && !hasSelectedMats;
    }
    if (scope === 'equipamentos') {
      return !hasEqs && !hasUncat && !hasRecEqs && !hasSelectedEqs;
    }
    return !hasMats && !hasEqs && !hasUncat && !hasRecMats && !hasRecEqs && !hasSelectedMats && !hasSelectedEqs && !countStartedBy && !recontagemTargetContador;
  };

  // Verificação diária por base (limpeza ao virar o dia em todas as bases, reais e teste)
  useEffect(() => {
    const checkDailyRollover = () => {
      const todayStr = getTodayKey();

      ALL_BRANCHES.forEach(b => {
        const storedDay = localStorage.getItem(getBranchStorageKey(b, 'calendar_day'));
        if (storedDay && storedDay !== todayStr) {
          const savedMat = localStorage.getItem(getBranchStorageKey(b, 'today_materials'));
          const savedEq = localStorage.getItem(getBranchStorageKey(b, 'today_equipments'));
          const savedUncat = localStorage.getItem(getBranchStorageKey(b, 'today_uncatalogued'));

          const parsedMat = savedMat ? JSON.parse(savedMat) : {};
          const parsedEq = savedEq ? JSON.parse(savedEq) : {};
          const parsedUncat = savedUncat ? JSON.parse(savedUncat) : [];

          const hasContent =
            Object.values(parsedMat as Record<string, MaterialDailyEntry>).some(hasMaterialEntryQuantity) ||
            Object.keys(parsedEq).length > 0 ||
            parsedUncat.length > 0;

          if (hasContent) {
            const backup: LastCountBackup = {
              date: storedDay,
              materials: parsedMat,
              equipments: parsedEq,
              uncatalogued: parsedUncat,
              savedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            };
            if (b === activeBranch) {
              setLastCountBackup(backup);
            }
            localStorage.setItem(getBranchStorageKey(b, 'last_count_backup'), JSON.stringify(backup));
          }

          // Limpa contagens normais da base ao virar o dia (mantendo cadastros intactos)
          localStorage.setItem(getBranchStorageKey(b, 'today_materials'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'today_equipments'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'today_uncatalogued'), JSON.stringify([]));

          // EXIGÊNCIA: Na tela Recontagem, os itens são limpos/zerados ao virar o dia
          localStorage.setItem(getBranchStorageKey(b, 'recontagem_selected_ids'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'recontagem_material_counts'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'recontagem_equipment_counts'), JSON.stringify({}));
          localStorage.removeItem(getBranchStorageKey(b, 'count_started_by'));
          localStorage.removeItem(getBranchStorageKey(b, 'recontagem_target_contador'));
          localStorage.removeItem(getBranchStorageKey(b, 'active_contador_session'));
          localStorage.setItem(getBranchStorageKey(b, 'is_report_sent'), JSON.stringify(false));
          localStorage.setItem(getBranchStorageKey(b, 'recontagem_unlocked'), JSON.stringify(false));

          localStorage.setItem(getBranchStorageKey(b, 'calendar_day'), todayStr);

          const clearedStatus = {
            countStartedBy: null,
            recontagemTargetContador: null,
            isReportSent: false,
            recontagemUnlocked: false,
            activeContadorSession: null,
            hasCounts: false,
          };
          updateBranchStatusMap(b, clearedStatus);

          // Se a base processada for a base ativa em tela, reseta os estados do React imediatamente
          if (b === activeBranch) {
            setMaterialCounts({});
            setEquipmentCounts({});
            setUncataloguedEquipments([]);
            setRecontagemSelectedIds({});
            setRecontagemMaterialCounts({});
            setRecontagemEquipmentCounts({});
            setCountStartedBy(null);
            setRecontagemTargetContador(null);
            setActiveContadorSession(null);
            setIsReportSent(false);
            setRecontagemUnlocked(false);
            setTodayKey(todayStr);
          }
        } else if (!storedDay) {
          localStorage.setItem(getBranchStorageKey(b, 'calendar_day'), todayStr);
        }
      });
    };

    checkDailyRollover();

    // Verificação periódica para virada do dia com a janela aberta
    const interval = setInterval(checkDailyRollover, 30000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkDailyRollover();
    };
    window.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [currentTodayKey, activeBranch]);

  // Persistência automática imediata no localStorage por base
  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'materials'), JSON.stringify(materials));
  }, [materials, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'freezers'), JSON.stringify(freezers));
  }, [freezers, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'equipments'), JSON.stringify(equipments));
  }, [equipments, activeBranch]);

  useEffect(() => {
    if (isCoringaUser(activeUserRef.current)) {
      localStorage.setItem(TEST_USERS_STORAGE_KEY, JSON.stringify(users));
    } else {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(ensureCoringaUser(users)));
    }
  }, [users]);

  useEffect(() => {
    if (activeUser) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(activeUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    }
  }, [activeUser]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(emailSettings));
  }, [emailSettings, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'server_email_config'), JSON.stringify(serverEmailConfig));
  }, [serverEmailConfig, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recipients_text'), recipientsText);
  }, [recipientsText, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify(materialCounts));
  }, [materialCounts, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(equipmentCounts));
  }, [equipmentCounts, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(uncataloguedEquipments));
  }, [uncataloguedEquipments, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    if (lastCountBackup) {
      localStorage.setItem(getBranchStorageKey(activeBranch, 'last_count_backup'), JSON.stringify(lastCountBackup));
    }
  }, [lastCountBackup, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'logs'), JSON.stringify(logs));
  }, [logs, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify(recontagemSelectedIds));
  }, [recontagemSelectedIds, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify(recontagemMaterialCounts));
  }, [recontagemMaterialCounts, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify(recontagemEquipmentCounts));
  }, [recontagemEquipmentCounts, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    if (countStartedBy) {
      localStorage.setItem(getBranchStorageKey(activeBranch, 'count_started_by'), JSON.stringify(countStartedBy));
    } else {
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'count_started_by'));
    }
  }, [countStartedBy, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'is_report_sent'), JSON.stringify(isReportSent));
  }, [isReportSent, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_unlocked'), JSON.stringify(recontagemUnlocked));
  }, [recontagemUnlocked, activeBranch]);

  useEffect(() => {
    if (isSwitchingBranchRef.current) return;
    if (recontagemTargetContador) {
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_target_contador'), JSON.stringify(recontagemTargetContador));
    } else {
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'recontagem_target_contador'));
    }
  }, [recontagemTargetContador, activeBranch]);

  // --- CONTROLE DE SINCRONIZAÇÃO COM O FIREBASE FIRESTORE ---
  // EXIGÊNCIA: A comunicação com o Firebase só ocorre:
  // 1. Automaticamente ao logar no app (atualizando dados das respectivas bases) e carga inicial no boot;
  // 2. Para o usuário Master, apenas ao pressionar o botão "Sincronizar Dados" na tela Cadastros (apenas da base ativa);
  // 3. Para o usuário Contador, apenas após o envio do estoque/recontagem por e-mail.
  const [pendingSyncPA, setPendingSyncPA] = useState<boolean>(() => {
    return localStorage.getItem(getBranchStorageKey('PAULO AFONSO', 'pending_master_sync')) === 'true'
      || localStorage.getItem('choppstock_pending_master_sync') === 'true';
  });
  const [pendingSyncDEL, setPendingSyncDEL] = useState<boolean>(() => {
    return localStorage.getItem(getBranchStorageKey('DELMIRO', 'pending_master_sync')) === 'true'
      || localStorage.getItem('choppstock_pending_master_sync') === 'true';
  });
  const [pendingUsersSync, setPendingUsersSync] = useState<boolean>(() => {
    return localStorage.getItem('choppstock_pending_users_sync') === 'true'
      || localStorage.getItem('choppstock_pending_master_sync') === 'true';
  });

  const hasPendingMasterSync = isCoringaUser(activeUser) || isTestBranch(activeBranch)
    ? false
    : (activeBranch === 'PAULO AFONSO' ? pendingSyncPA : pendingSyncDEL) || pendingUsersSync;

  const [lastFirebaseSyncAt, setLastFirebaseSyncAt] = useState<string | null>(() => {
    return localStorage.getItem('choppstock_last_firebase_sync_at');
  });

  const markMasterChangesPending = (target?: UnitBranch | 'AMBAS' | 'USERS') => {
    // Modo Teste (CORINGA / bases teste) nunca marca nem sincroniza pendências com Firebase
    if (isCoringaUser(activeUserRef.current) || isTestBranch(activeBranchRef.current)) {
      return;
    }
    if (target === 'USERS') {
      setPendingUsersSync(true);
      localStorage.setItem('choppstock_pending_users_sync', 'true');
      return;
    }
    const branchesToMark: UnitBranch[] =
      target === 'AMBAS' ? [...REAL_BRANCHES] : [target || activeBranchRef.current];
    branchesToMark.forEach(b => {
      if (isTestBranch(b)) return;
      localStorage.setItem(getBranchStorageKey(b, 'pending_master_sync'), 'true');
      if (b === 'PAULO AFONSO') {
        setPendingSyncPA(true);
      } else if (b === 'DELMIRO') {
        setPendingSyncDEL(true);
      }
    });
  };

  const activeUserRef = useRef<StockUser | null>(activeUser);
  useEffect(() => {
    activeUserRef.current = activeUser;
  }, [activeUser]);

  const countStartedByRef = useRef<CountStartedBy | null>(countStartedBy);
  useEffect(() => {
    countStartedByRef.current = countStartedBy;
  }, [countStartedBy]);

  const isReportSentRef = useRef<boolean>(isReportSent);
  useEffect(() => {
    isReportSentRef.current = isReportSent;
  }, [isReportSent]);

  // Aplica os dados buscados do Firestore para uma base respeitando virada de dia e preservando contagem ativa se solicitado
  const applyRemoteBranchData = (
    branch: UnitBranch,
    remote: BranchSyncPayload,
    todayStr: string,
    options?: { preserveLocalUnsentCounts?: boolean; applyToActiveState?: boolean }
  ) => {
    const isPreviousDay = Boolean(remote.countDate && remote.countDate !== todayStr);

    const effMaterials = Array.isArray(remote.materials) ? remote.materials : undefined;
    const effFreezers = Array.isArray(remote.freezers) ? remote.freezers : undefined;
    const effEquipments = Array.isArray(remote.equipments) ? remote.equipments : undefined;

    const effCountStartedBy = isPreviousDay ? null : (remote.countStartedBy || null);
    const effRecTargetContador = isPreviousDay ? null : (remote.recontagemTargetContador || null);
    const effRecUnlocked = isPreviousDay ? false : !!remote.recontagemUnlocked;
    const effMatCounts = isPreviousDay ? {} : (remote.materialCounts || {});
    const effEqCounts = isPreviousDay ? {} : (remote.equipmentCounts || {});
    const effUncat = isPreviousDay ? [] : (Array.isArray(remote.uncataloguedEquipments) ? remote.uncataloguedEquipments : []);
    const effRecSelected = isPreviousDay ? {} : (remote.recontagemSelectedIds || {});
    const effRecMat = isPreviousDay ? {} : (remote.recontagemMaterialCounts || {});
    const effRecEq = isPreviousDay ? {} : (remote.recontagemEquipmentCounts || {});
    const effFrozen: string | null = null;

    let effBackup = remote.lastCountBackup !== undefined ? remote.lastCountBackup : undefined;
    if (isPreviousDay) {
      const hadPrevCounts =
        (remote.materialCounts && Object.values(remote.materialCounts).some(hasMaterialEntryQuantity)) ||
        (remote.equipmentCounts && Object.keys(remote.equipmentCounts).length > 0) ||
        (Array.isArray(remote.uncataloguedEquipments) && remote.uncataloguedEquipments.length > 0);
      if (hadPrevCounts) {
        effBackup = {
          date: remote.countDate || todayStr,
          materials: remote.materialCounts || {},
          equipments: remote.equipmentCounts || {},
          uncatalogued: Array.isArray(remote.uncataloguedEquipments) ? remote.uncataloguedEquipments : [],
          savedAt: remote.updatedAt ? new Date(remote.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '23:59',
        };
      }
    }

    const hasCounts =
      Object.values(effMatCounts).some(hasMaterialEntryQuantity) ||
      Object.keys(effEqCounts).length > 0 ||
      effUncat.length > 0;
    const effIsReportSent = isPreviousDay ? false : (!!remote.isReportSent && hasCounts);

    // A sessão só permanece ativa se houver contagem efetivamente iniciada não enviada OU recontagem liberada ativa
    const effSession = (isPreviousDay || (!effRecUnlocked && (effIsReportSent || (!effCountStartedBy && !hasCounts))))
      ? null
      : (remote.activeContadorSession || null);

    const statusObj = {
      countStartedBy: effCountStartedBy,
      recontagemTargetContador: effRecTargetContador,
      isReportSent: effIsReportSent,
      recontagemUnlocked: effRecUnlocked,
      activeContadorSession: effSession,
      hasCounts,
    };

    const preserveCounts = !!options?.preserveLocalUnsentCounts;
    updateBranchStatusMap(branch, preserveCounts ? readBranchInitialStatus(branch) : statusObj);

    // Salva cadastros permanentes e destinatários no localStorage da respectiva base
    if (effMaterials) {
      localStorage.setItem(getBranchStorageKey(branch, 'materials'), JSON.stringify(effMaterials));
    }
    if (effFreezers) {
      localStorage.setItem(getBranchStorageKey(branch, 'freezers'), JSON.stringify(effFreezers));
    }
    if (effEquipments) {
      localStorage.setItem(getBranchStorageKey(branch, 'equipments'), JSON.stringify(effEquipments));
    }
    if (remote.emailRecipients !== undefined) {
      localStorage.setItem(getBranchStorageKey(branch, 'recipients_text'), remote.emailRecipients);
    }
    if (remote.emailSettings) {
      localStorage.setItem(getBranchStorageKey(branch, 'email_settings'), JSON.stringify(remote.emailSettings));
    }
    if (remote.serverEmailConfig) {
      localStorage.setItem(getBranchStorageKey(branch, 'server_email_config'), JSON.stringify(remote.serverEmailConfig));
    }
    if (effBackup !== undefined) {
      if (effBackup) {
        localStorage.setItem(getBranchStorageKey(branch, 'last_count_backup'), JSON.stringify(effBackup));
      } else {
        localStorage.removeItem(getBranchStorageKey(branch, 'last_count_backup'));
      }
    }

    if (!preserveCounts) {
      localStorage.setItem(getBranchStorageKey(branch, 'today_materials'), JSON.stringify(effMatCounts));
      localStorage.setItem(getBranchStorageKey(branch, 'today_equipments'), JSON.stringify(effEqCounts));
      localStorage.setItem(getBranchStorageKey(branch, 'today_uncatalogued'), JSON.stringify(effUncat));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_selected_ids'), JSON.stringify(effRecSelected));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_material_counts'), JSON.stringify(effRecMat));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_equipment_counts'), JSON.stringify(effRecEq));
      localStorage.setItem(getBranchStorageKey(branch, 'is_report_sent'), JSON.stringify(effIsReportSent));
      localStorage.setItem(getBranchStorageKey(branch, 'recontagem_unlocked'), JSON.stringify(effRecUnlocked));
      localStorage.setItem(getBranchStorageKey(branch, 'calendar_day'), todayStr);

      if (effSession) {
        localStorage.setItem(getBranchStorageKey(branch, 'active_contador_session'), JSON.stringify(effSession));
      } else {
        localStorage.removeItem(getBranchStorageKey(branch, 'active_contador_session'));
      }
      if (effCountStartedBy) {
        localStorage.setItem(getBranchStorageKey(branch, 'count_started_by'), JSON.stringify(effCountStartedBy));
      } else {
        localStorage.removeItem(getBranchStorageKey(branch, 'count_started_by'));
      }
      if (effRecTargetContador) {
        localStorage.setItem(getBranchStorageKey(branch, 'recontagem_target_contador'), JSON.stringify(effRecTargetContador));
      } else {
        localStorage.removeItem(getBranchStorageKey(branch, 'recontagem_target_contador'));
      }
      if (effFrozen) {
        localStorage.setItem(getBranchStorageKey(branch, 'frozen_report'), effFrozen);
      } else {
        localStorage.removeItem(getBranchStorageKey(branch, 'frozen_report'));
      }
    }

    // Atualiza estados em tela se for a base alvo
    if (options?.applyToActiveState || branch === activeBranchRef.current) {
      if (effMaterials) setMaterials(effMaterials);
      if (effFreezers) setFreezers(effFreezers);
      if (effEquipments) setEquipments(effEquipments);
      if (remote.emailRecipients !== undefined) setRecipientsTextState(remote.emailRecipients);
      if (remote.emailSettings) setEmailSettings(remote.emailSettings);
      if (remote.serverEmailConfig) setServerEmailConfig(remote.serverEmailConfig);
      if (effBackup !== undefined) setLastCountBackup(effBackup);

      if (!preserveCounts) {
        setMaterialCounts(effMatCounts);
        setEquipmentCounts(effEqCounts);
        setUncataloguedEquipments(effUncat);
        setRecontagemSelectedIds(effRecSelected);
        setRecontagemMaterialCounts(effRecMat);
        setRecontagemEquipmentCounts(effRecEq);
        setActiveContadorSession(effSession);
        setCountStartedBy(effCountStartedBy);
        setRecontagemTargetContador(effRecTargetContador);
        setIsReportSent(effIsReportSent);
        setRecontagemUnlocked(effRecUnlocked);
        setFrozenReportTextState(effFrozen);
        setTodayKey(todayStr);
      } else {
        loadBranchLocalStateIntoActive(branch, todayStr, {
          includeCatalogs: !effMaterials || !effFreezers || !effEquipments,
          includeConfigs: remote.emailRecipients === undefined && !remote.emailSettings && !remote.serverEmailConfig,
          updateStatusMap: true,
        });
      }
    }

    return preserveCounts ? readBranchInitialStatus(branch) : statusObj;
  };

  // Busca única apenas de perfis ao abrir a tela de login deslogado (dados das bases são baixados somente ao logar no app)
  useEffect(() => {
    if (activeUserRef.current) return;

    let cancelled = false;
    const initUsersOnLoginScreen = async () => {
      const remoteUsers = await fetchUsersFromFirestore();
      if (cancelled || activeUserRef.current) return;

      if (remoteUsers && remoteUsers.length > 0) {
        const syncedList = ensureCoringaUser(remoteUsers);
        usersRef.current = syncedList;
        setUsers(syncedList);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(syncedList));
      }
    };

    initUsersOnLoginScreen();
    return () => {
      cancelled = true;
    };
  }, []);

  const addLog = (logData: Omit<SystemLog, 'id' | 'timestamp'>) => {
    const now = new Date();
    const formatted = `${formatDateBR(todayKey)} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    const counterStamp = activeUser ? ` [Resp: ${activeUser.name}]` : '';
    const newLog: SystemLog = {
      ...logData,
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      title: `${logData.title}${counterStamp}`,
      timestamp: formatted,
    };
    setLogs(prev => {
      const updated = [newLog, ...prev.slice(0, 49)];
      localStorage.setItem(getBranchStorageKey(activeBranch, 'logs'), JSON.stringify(updated));
      return updated;
    });
  };

  // Nível de Acesso (CORINGA 9999 possui acesso total igual Master somente nas bases teste, sem Firebase)
  const isCoringa = isCoringaUser(activeUser);
  const isMaster = !!activeUser && (activeUser.roleLevel === 'master' || isCoringa);

  // Controle de Contador ativo na base atual (ignora sessões para CORINGA em modo teste)
  const isContadorActive = !isCoringa && !!activeContadorSession && activeContadorSession.userId !== activeUser?.id;

  // Verificação de itens contados hoje na base atual
  const hasCurrentBranchCounts = useMemo(() => {
    const hasMats = Object.values(materialCounts).some(hasMaterialEntryQuantity);
    const hasEqs = Object.keys(equipmentCounts).length > 0;
    const hasUncat = uncataloguedEquipments.length > 0;
    return hasMats || hasEqs || hasUncat;
  }, [materialCounts, equipmentCounts, uncataloguedEquipments]);

  // Contagem ou recontagem em andamento na base ativa (derivado estritamente do estado ao vivo da base ativa)
  const isCountInProgress = useMemo(() => {
    if (isCoringa || isTestBranch(activeBranch)) return false;
    if (recontagemUnlocked) return true;
    if (isReportSent) return false;
    return hasCurrentBranchCounts && (Boolean(countStartedBy) || Boolean(activeContadorSession));
  }, [isCoringa, activeBranch, recontagemUnlocked, isReportSent, hasCurrentBranchCounts, countStartedBy, activeContadorSession]);

  const checkBranchInProgress = (b: UnitBranch): boolean => {
    if (b === activeBranch) return isCountInProgress;
    const st = branchStatuses[b];
    if (!st) return false;
    if (st.recontagemUnlocked) return true;
    if (st.isReportSent) return false;
    return st.hasCounts && (!!st.countStartedBy || !!st.activeContadorSession);
  };

  // Contagem ou recontagem em andamento por base
  const isCountInProgressPA = useMemo(() => checkBranchInProgress('PAULO AFONSO'), [activeBranch, isCountInProgress, branchStatuses]);
  const isCountInProgressDEL = useMemo(() => checkBranchInProgress('DELMIRO'), [activeBranch, isCountInProgress, branchStatuses]);

  // Bloqueio isolado por base: contagem/recontagem em uma base bloqueia somente os usuários daquela base
  const isAnyBaseCountInProgress = isCountInProgress;

  // Permissão do usuário ativo para realizar contagens normais (Materiais / Equipamentos) na base atual
  const canActiveUserCount = useMemo(() => {
    if (!activeUser) return false;
    if (isCoringa) return true;

    // Master: se houver contagem ou recontagem em andamento, Master não pode realizar alteração na contagem
    if (activeUser.roleLevel === 'master') {
      if (isCountInProgress) return false;
      return true;
    }

    // Usuário Contador: se houver recontagem para ele, telas Materiais, Equipamentos e Exportar ficam bloqueadas até o Master zerar a contagem
    if (recontagemUnlocked || isReportSent || Boolean(recontagemTargetContador)) {
      return false;
    }

    // "Somente o contador que iniciou a contagem, poderá dar continuidade ou modificar a contagem iniciada, isso para as duas bases."
    if (countStartedBy && countStartedBy.userId !== activeUser.id) {
      return false;
    }

    return true;
  }, [activeUser, isCoringa, isCountInProgress, recontagemUnlocked, isReportSent, recontagemTargetContador, countStartedBy]);

  // Bloqueio específico para edição na tela Recontagem
  const canActiveUserRecount = useMemo(() => {
    if (!activeUser) return false;
    if (isCoringa) return true;
    if (activeUser.roleLevel === 'master') {
      // Master só pode visualizar/pré-editar fora de contagem/recontagem em andamento
      return !isAnyBaseCountInProgress && !recontagemUnlocked;
    }
    if (!recontagemUnlocked) return false;
    const authorized = recontagemTargetContador || countStartedBy;
    if (authorized) {
      const matchesId = authorized.userId === activeUser.id;
      const matchesReg = Boolean(
        authorized.registration &&
        authorized.registration.toUpperCase() === activeUser.registration.toUpperCase()
      );
      if (!matchesId && !matchesReg) return false;
    }
    return true;
  }, [activeUser, isCoringa, isAnyBaseCountInProgress, recontagemUnlocked, recontagemTargetContador, countStartedBy]);

  const cantCountReason = useMemo(() => {
    if (canActiveUserCount) return null;
    if (!activeUser) return 'Faça login para realizar contagens.';
    if (activeUser.roleLevel === 'master' && isCountInProgress) {
      return 'Existe contagem em andamento.';
    }
    if (recontagemUnlocked) {
      return 'Recontagem em andamento. Realize a contagem dos itens na tela Recontagem.';
    }
    if (isReportSent) {
      return 'Estoque já enviado por e-mail. Não é permitido alterar a contagem em andamento nem realizar contagens até que a contagem seja zerada pelo usuário Master.';
    }
    if (recontagemTargetContador && recontagemTargetContador.userId !== activeUser.id) {
      return `Recontagem direcionada ao contador ${recontagemTargetContador.userName} (Matrícula: ${recontagemTargetContador.registration}).`;
    }
    if (countStartedBy && countStartedBy.userId !== activeUser.id) {
      return `A contagem foi iniciada pelo contador ${countStartedBy.userName} (Matrícula: ${countStartedBy.registration}). Somente ele pode dar continuidade ou modificar a contagem iniciada.`;
    }
    return 'Existe contagem em andamento.';
  }, [canActiveUserCount, activeUser, isCountInProgress, recontagemUnlocked, isReportSent, recontagemTargetContador, countStartedBy]);

  // Transmissão de sincronização em segundo plano (nunca dispara quando em Modo Teste CORINGA ou bases teste)
  const broadcastSync = (actionType: string) => {
    if (isCoringaUser(activeUserRef.current) || isTestBranch(activeBranchRef.current)) {
      return;
    }
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('choppstock_realtime_sync_v1');
        bc.postMessage({ type: actionType, branch: activeBranchRef.current, timestamp: Date.now() });
        bc.close();
      }
    } catch {}
  };

  // Sincronização em segundo plano sem perder dados que estão sendo digitados nem mudar de tela
  const handleBackgroundSync = () => {
    try {
      if (isSwitchingBranchRef.current) return;
      const curBranch = activeBranchRef.current;
      const todayStr = getTodayKey();
      const storedDay = localStorage.getItem(getBranchStorageKey(curBranch, 'calendar_day'));
      const isRolledOver = Boolean(storedDay && storedDay !== todayStr);

      if (isRolledOver) {
        setMaterialCounts({});
        setEquipmentCounts({});
        setUncataloguedEquipments([]);
        setRecontagemSelectedIds({});
        setRecontagemMaterialCounts({});
        setRecontagemEquipmentCounts({});
        setFrozenReportTextState(null);
      } else {
        const storedMat = localStorage.getItem(getBranchStorageKey(curBranch, 'today_materials'));
        try { setMaterialCounts(storedMat ? JSON.parse(storedMat) : {}); } catch {}
        const storedEq = localStorage.getItem(getBranchStorageKey(curBranch, 'today_equipments'));
        try { setEquipmentCounts(storedEq ? JSON.parse(storedEq) : {}); } catch {}
        const storedUncat = localStorage.getItem(getBranchStorageKey(curBranch, 'today_uncatalogued'));
        try { setUncataloguedEquipments(storedUncat ? JSON.parse(storedUncat) : []); } catch {}
        const storedRecSelected = localStorage.getItem(getBranchStorageKey(curBranch, 'recontagem_selected_ids'));
        try { setRecontagemSelectedIds(storedRecSelected ? JSON.parse(storedRecSelected) : {}); } catch {}
        const storedRecMat = localStorage.getItem(getBranchStorageKey(curBranch, 'recontagem_material_counts'));
        try { setRecontagemMaterialCounts(storedRecMat ? JSON.parse(storedRecMat) : {}); } catch {}
        const storedRecEq = localStorage.getItem(getBranchStorageKey(curBranch, 'recontagem_equipment_counts'));
        try { setRecontagemEquipmentCounts(storedRecEq ? JSON.parse(storedRecEq) : {}); } catch {}
        const storedFrozen = localStorage.getItem(getBranchStorageKey(curBranch, 'frozen_report'));
        setFrozenReportTextState(storedFrozen);
      }

      const statusCur = readBranchInitialStatus(curBranch);
      setActiveContadorSession(statusCur.activeContadorSession);
      setCountStartedBy(statusCur.countStartedBy);
      setRecontagemTargetContador(statusCur.recontagemTargetContador);
      setIsReportSent(statusCur.isReportSent);
      setRecontagemUnlocked(statusCur.recontagemUnlocked);
      setBranchStatuses({
        'PAULO AFONSO': readBranchInitialStatus('PAULO AFONSO'),
        'DELMIRO': readBranchInitialStatus('DELMIRO'),
        'PAULO AFONSO (TESTE)': readBranchInitialStatus('PAULO AFONSO (TESTE)'),
        'DELMIRO (TESTE)': readBranchInitialStatus('DELMIRO (TESTE)'),
      });

      const storedMaterials = localStorage.getItem(getBranchStorageKey(curBranch, 'materials'));
      if (storedMaterials) {
        try { setMaterials(JSON.parse(storedMaterials)); } catch {}
      }
      const storedFreezers = localStorage.getItem(getBranchStorageKey(curBranch, 'freezers'));
      if (storedFreezers) {
        try { setFreezers(JSON.parse(storedFreezers)); } catch {}
      }
      const storedEquips = localStorage.getItem(getBranchStorageKey(curBranch, 'equipments'));
      if (storedEquips) {
        try { setEquipments(JSON.parse(storedEquips)); } catch {}
      }
      const isCoringaActive = isCoringaUser(activeUserRef.current);
      const storedUsers = localStorage.getItem(isCoringaActive ? TEST_USERS_STORAGE_KEY : STORAGE_KEYS.USERS);
      if (storedUsers) {
        try {
          const parsedUsers = ensureCoringaUser(JSON.parse(storedUsers));
          usersRef.current = parsedUsers;
          setUsers(parsedUsers);
        } catch {}
      }
      const storedServerEmail = localStorage.getItem(getBranchStorageKey(curBranch, 'server_email_config'));
      if (storedServerEmail) {
        try { setServerEmailConfig(JSON.parse(storedServerEmail)); } catch {}
      }
      const storedEmailSettings = localStorage.getItem(getBranchStorageKey(curBranch, 'email_settings'));
      if (storedEmailSettings) {
        try { setEmailSettings(JSON.parse(storedEmailSettings)); } catch {}
      }
      const storedRecipients = localStorage.getItem(getBranchStorageKey(curBranch, 'recipients_text'));
      if (storedRecipients !== null) {
        setRecipientsTextState(storedRecipients);
      }
    } catch {}
  };

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('choppstock_realtime_sync_v1');
        bc.onmessage = (event: MessageEvent) => {
          if (isCoringaUser(activeUserRef.current) || isTestBranch(activeBranchRef.current)) {
            return;
          }
          if (event.data?.branch && event.data.branch !== activeBranchRef.current) {
            return;
          }
          handleBackgroundSync();
        };
      }
    } catch {}

    const onStorage = (event: StorageEvent) => {
      const cur = activeBranchRef.current;
      if (isTestBranch(cur)) {
        if (event.key && !event.key.startsWith('choppstock_test_')) {
          return;
        }
      } else {
        if (event.key && event.key.startsWith('choppstock_test_')) {
          return;
        }
        const otherPrefix = cur === 'PAULO AFONSO' ? 'choppstock_del_' : 'choppstock_pa_';
        if (event.key && event.key.startsWith(otherPrefix)) {
          return;
        }
      }
      handleBackgroundSync();
    };

    window.addEventListener('storage', onStorage);
    const interval = setInterval(handleBackgroundSync, 3000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  // Inicia a marcação de contagem iniciada apenas ao inserir a primeira quantidade em um item pelo contador (nunca para CORINGA)
  const ensureCountStarted = () => {
    if (!activeUser || activeUser.roleLevel !== 'contador' || isCoringaUser(activeUser)) return;

    let startedVal = countStartedBy;
    let sessionVal = activeContadorSession;
    let changed = false;

    if (!startedVal) {
      startedVal = {
        userId: activeUser.id,
        userName: activeUser.name,
        registration: activeUser.registration,
        startedAt: Date.now(),
      };
      setCountStartedBy(startedVal);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'count_started_by'), JSON.stringify(startedVal));
      changed = true;
    }

    if (!sessionVal || sessionVal.userId !== activeUser.id) {
      sessionVal = {
        userId: activeUser.id,
        userName: activeUser.name,
        registration: activeUser.registration,
        loginTime: sessionVal?.loginTime || Date.now(),
        lastHeartbeat: Date.now(),
      };
      setActiveContadorSession(sessionVal);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'active_contador_session'), JSON.stringify(sessionVal));
      changed = true;
    }

    updateBranchStatusMap(activeBranch, prev => ({
      ...prev,
      countStartedBy: startedVal,
      activeContadorSession: sessionVal,
      hasCounts: true,
    }));

    if (changed) {
      broadcastSync('COUNT_STARTED');
    }
  };

  // Se todas as quantidades/itens forem zerados ou removidos antes do envio do e-mail, desfaz o bloqueio de contagem iniciada
  const clearCountStartedIfEmpty = () => {
    if (isReportSent || recontagemUnlocked) return;
    const hadLock = Boolean(countStartedBy) || Boolean(activeContadorSession);
    if (countStartedBy) {
      setCountStartedBy(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'count_started_by'));
    }
    if (activeContadorSession) {
      setActiveContadorSession(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'active_contador_session'));
    }
    const emptyStatus = {
      countStartedBy: null,
      recontagemTargetContador: recontagemTargetContador,
      isReportSent: false,
      recontagemUnlocked: false,
      activeContadorSession: null,
      hasCounts: false,
    };
    updateBranchStatusMap(activeBranch, emptyStatus);
    if (hadLock) {
      broadcastSync('COUNT_CLEARED');
    }
  };

  // --- ATUALIZAÇÕES DA CONTAGEM DIÁRIA (SALVAMENTO AUTOMÁTICO) ---
  const updateMaterialCount = (itemId: string, data: Partial<MaterialDailyEntry>) => {
    if (!canActiveUserCount) return;

    const currentEntry = materialCounts[itemId] || {
      itemId,
      disponivel: 0,
      danificado: 0,
      barrilCheio: 0,
      barrilVazio: 0,
      barrilEmRota: 0,
      co2Cheio: 0,
      co2Mexido: 0,
      co2Vazio: 0,
      co2EmRota: 0,
    };
    const updatedMap = {
      ...materialCounts,
      [itemId]: {
        ...currentEntry,
        ...data,
      },
    };
    const willHaveAnyCount =
      Object.values(updatedMap).some(hasMaterialEntryQuantity) ||
      Object.keys(equipmentCounts).length > 0 ||
      uncataloguedEquipments.length > 0;

    if (willHaveAnyCount) {
      ensureCountStarted();
    } else {
      clearCountStartedIfEmpty();
    }

    // EXIGÊNCIA: O campo "PRÉVIA DO RELATÓRIO" só será atualizado automaticamente caso seja modificado na contagem da tela Materiais
    if (frozenReportText) {
      setFrozenReportText(null);
    }

    setMaterialCounts(prev => {
      const current = prev[itemId] || {
        itemId,
        disponivel: 0,
        danificado: 0,
        barrilCheio: 0,
        barrilVazio: 0,
        barrilEmRota: 0,
        co2Cheio: 0,
        co2Mexido: 0,
        co2Vazio: 0,
        co2EmRota: 0,
      };
      const updated = {
        ...prev,
        [itemId]: {
          ...current,
          ...data,
        }
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify(updated));
      broadcastSync('COUNT_UPDATED');
      return updated;
    });
  };

  const updateEquipmentCount = (itemId: string, data: Partial<EquipmentDailyEntry>) => {
    if (!canActiveUserCount) return;
    ensureCountStarted();

    if (frozenReportText) {
      setFrozenReportText(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'frozen_report'));
    }

    setEquipmentCounts(prev => {
      const current = prev[itemId] || {
        itemId,
        status: 'disponivel',
      };
      const updated = {
        ...prev,
        [itemId]: {
          ...current,
          ...data,
        }
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
      broadcastSync('COUNT_UPDATED');
      return updated;
    });
  };

  const removeEquipmentCount = (itemId: string) => {
    if (!canActiveUserCount) return;

    // EXIGÊNCIA: O campo "PRÉVIA DO RELATÓRIO" só será atualizado automaticamente caso seja excluído algum item contado da tela Equipamentos
    if (frozenReportText) {
      setFrozenReportText(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'frozen_report'));
    }

    const nextEq = { ...equipmentCounts };
    delete nextEq[itemId];
    const willHaveAnyCount =
      Object.values(materialCounts).some(hasMaterialEntryQuantity) ||
      Object.keys(nextEq).length > 0 ||
      uncataloguedEquipments.length > 0;
    if (!willHaveAnyCount) {
      clearCountStartedIfEmpty();
    }

    setEquipmentCounts(prev => {
      const copy = { ...prev };
      delete copy[itemId];
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(copy));
      broadcastSync('COUNT_UPDATED');
      return copy;
    });
  };

  // --- EQUIPAMENTOS ENCONTRADOS NÃO CADASTRADOS NA BASE ---
  const addUncataloguedEquipment = (itemData: Omit<UncataloguedEquipment, 'id' | 'createdAt'>) => {
    if (!canActiveUserCount) return;
    ensureCountStarted();

    const newItem: UncataloguedEquipment = {
      ...itemData,
      id: 'uncat-' + Date.now(),
      createdAt: formatDateBR(todayKey),
    };
    setUncataloguedEquipments(prev => {
      const updated = [newItem, ...prev];
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(updated));
      broadcastSync('COUNT_UPDATED');
      return updated;
    });
    addLog({
      type: 'contagem',
      targetType: 'equipamento',
      itemCode: newItem.patrimony,
      title: `Equipamento Não Cadastrado Adicionado: [${newItem.patrimony}]`,
      description: `Patrimônio ${newItem.patrimony} registrado na contagem. Obs: ${newItem.observations}`
    });
  };

  const updateUncataloguedEquipment = (updatedItem: UncataloguedEquipment) => {
    if (!canActiveUserCount) return;
    ensureCountStarted();

    setUncataloguedEquipments(prev => {
      const updated = prev.map(item => item.id === updatedItem.id ? updatedItem : item);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(updated));
      broadcastSync('COUNT_UPDATED');
      return updated;
    });
  };

  const deleteUncataloguedEquipment = (id: string) => {
    if (!canActiveUserCount) return;

    if (frozenReportText) {
      setFrozenReportText(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'frozen_report'));
    }

    const nextUncat = uncataloguedEquipments.filter(item => item.id !== id);
    const willHaveAnyCount =
      Object.values(materialCounts).some(hasMaterialEntryQuantity) ||
      Object.keys(equipmentCounts).length > 0 ||
      nextUncat.length > 0;
    if (!willHaveAnyCount) {
      clearCountStartedIfEmpty();
    }

    setUncataloguedEquipments(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(updated));
      broadcastSync('COUNT_UPDATED');
      return updated;
    });
  };

  const deleteUnregisteredItemEntireHistory = (patrimony: string, itemId?: string) => {
    if (frozenReportText) {
      setFrozenReportText(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'frozen_report'));
    }
    const cleanPat = patrimony.trim().toUpperCase();
    const patDigits = cleanPat.replace(/\D/g, '');

    const matchesPat = (pat?: string) => {
      if (!pat) return false;
      const pClean = pat.trim().toUpperCase();
      if (pClean === cleanPat) return true;
      if (patDigits.length >= 3 && pClean.replace(/\D/g, '') === patDigits) return true;
      return false;
    };

    const isUnregisteredCode = (code?: string) =>
      !code || code.trim() === '' || code.trim() === '0' || code.trim().toUpperCase() === 'PROV' || code.trim().toUpperCase().startsWith('PROV-');

    // 1. Remove de uncataloguedEquipments
    setUncataloguedEquipments(prev => {
      const updated = prev.filter(item =>
        !matchesPat(item.patrimony) && (!itemId || item.id !== itemId)
      );
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(updated));
      return updated;
    });

    // 2. Remove de freezers se for item não cadastrado previamente (código '0', vazio ou provisório)
    let removedFreezerIds: string[] = [];
    setFreezers(prev => {
      const toRemove = prev.filter(f =>
        isUnregisteredCode(f.code) && (matchesPat(f.patrimony) || (itemId && f.id === itemId))
      );
      removedFreezerIds = toRemove.map(f => f.id);
      if (toRemove.length > 0) {
        const idsSet = new Set(removedFreezerIds);
        const updated = prev.filter(f => !idsSet.has(f.id));
        localStorage.setItem(getBranchStorageKey(activeBranch, 'freezers'), JSON.stringify(updated));
        return updated;
      }
      return prev;
    });

    // 3. Remove de equipments se for item não cadastrado previamente (código '0', vazio ou provisório)
    let removedEquipIds: string[] = [];
    setEquipments(prev => {
      const toRemove = prev.filter(e =>
        isUnregisteredCode(e.code) && (matchesPat(e.patrimony) || (itemId && e.id === itemId))
      );
      removedEquipIds = toRemove.map(e => e.id);
      if (toRemove.length > 0) {
        const idsSet = new Set(removedEquipIds);
        const updated = prev.filter(e => !idsSet.has(e.id));
        localStorage.setItem(getBranchStorageKey(activeBranch, 'equipments'), JSON.stringify(updated));
        return updated;
      }
      return prev;
    });

    // 4. Remove de equipmentCounts e verifica se ainda restam contagens
    const nextEqCounts = { ...equipmentCounts };
    if (itemId) delete nextEqCounts[itemId];
    removedFreezerIds.forEach(id => delete nextEqCounts[id]);
    removedEquipIds.forEach(id => delete nextEqCounts[id]);

    const nextUncat = uncataloguedEquipments.filter(item =>
      !matchesPat(item.patrimony) && (!itemId || item.id !== itemId)
    );
    const willHaveAnyCount =
      Object.values(materialCounts).some(hasMaterialEntryQuantity) ||
      Object.keys(nextEqCounts).length > 0 ||
      nextUncat.length > 0;

    setEquipmentCounts(prev => {
      const updated = { ...prev };
      if (itemId) delete updated[itemId];
      removedFreezerIds.forEach(id => delete updated[id]);
      removedEquipIds.forEach(id => delete updated[id]);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
      return updated;
    });

    if (!willHaveAnyCount) {
      clearCountStartedIfEmpty();
    }

    if (isMaster) markMasterChangesPending();
    broadcastSync('BASE_UPDATED');
    broadcastSync('COUNT_UPDATED');
  };

  // --- CLONAR ÚLTIMA CONTAGEM (APENAS USUÁRIO MASTER) ---
  const cloneLastMaterialCount = (): boolean => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) return false;

    if (!lastCountBackup || !lastCountBackup.materials || Object.keys(lastCountBackup.materials).length === 0) {
      return false;
    }
    setMaterialCounts({ ...lastCountBackup.materials });
    localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify(lastCountBackup.materials));
    broadcastSync('COUNT_UPDATED');
    addLog({
      type: 'contagem',
      targetType: 'contagem',
      itemCode: 'CLONE-MAT',
      title: 'Contagem de Materiais Clonada pelo Master',
      description: `Valores clonados da contagem do dia ${formatDateBR(lastCountBackup.date)}.`
    });
    return true;
  };

  const cloneLastEquipmentCount = (): boolean => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) return false;

    if (!lastCountBackup) return false;
    const hasEquips = lastCountBackup.equipments && Object.keys(lastCountBackup.equipments).length > 0;
    const hasUncat = lastCountBackup.uncatalogued && lastCountBackup.uncatalogued.length > 0;
    if (!hasEquips && !hasUncat) return false;

    if (hasEquips) {
      setEquipmentCounts({ ...lastCountBackup.equipments });
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(lastCountBackup.equipments));
    }
    if (hasUncat) {
      setUncataloguedEquipments([...lastCountBackup.uncatalogued]);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(lastCountBackup.uncatalogued));
    }
    broadcastSync('COUNT_UPDATED');

    addLog({
      type: 'contagem',
      targetType: 'contagem',
      itemCode: 'CLONE-EQ',
      title: 'Contagem de Equipamentos Clonada pelo Master',
      description: `Valores clonados da contagem do dia ${formatDateBR(lastCountBackup.date)}.`
    });
    return true;
  };

  // --- CLONAGEM SELETIVA POR GRUPO / TIPO (APENAS USUÁRIO MASTER) ---
  const cloneSelectiveCount = (target: CloneGroupTarget): { success: boolean; message: string } => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) {
      return { success: false, message: 'Existe contagem em andamento.' };
    }

    if (!lastCountBackup) {
      return { success: false, message: 'Nenhuma contagem anterior salva no backup para clonar.' };
    }

    if (target === 'todos') {
      let count = 0;
      if (lastCountBackup.materials) {
        setMaterialCounts(prev => {
          const updated = { ...prev, ...lastCountBackup.materials };
          localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify(updated));
          return updated;
        });
        count += Object.keys(lastCountBackup.materials).length;
      }
      if (lastCountBackup.equipments) {
        setEquipmentCounts(prev => {
          const updated = { ...prev, ...lastCountBackup.equipments };
          localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
          return updated;
        });
        count += Object.keys(lastCountBackup.equipments).length;
      }
      if (lastCountBackup.uncatalogued) {
        setUncataloguedEquipments([...lastCountBackup.uncatalogued]);
        localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(lastCountBackup.uncatalogued));
        count += lastCountBackup.uncatalogued.length;
      }
      broadcastSync('COUNT_UPDATED');
      addLog({
        type: 'contagem',
        targetType: 'contagem',
        itemCode: 'CLONE-TODOS',
        title: 'Todos os Estoques Clonados pelo Master',
        description: `Total de ${count} itens restaurados da última contagem.`
      });
      return { success: true, message: `Todos os estoques clonados com sucesso (${count} itens restaurados)!` };
    }

    if (target === 'todos_materiais') {
      if (!lastCountBackup.materials || Object.keys(lastCountBackup.materials).length === 0) {
        return { success: false, message: 'Nenhum material registrado na última contagem para clonar.' };
      }
      setMaterialCounts(prev => {
        const updated = { ...prev, ...lastCountBackup.materials };
        localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify(updated));
        return updated;
      });
      broadcastSync('COUNT_UPDATED');
      return { success: true, message: `Todo o estoque de materiais clonado com sucesso (${Object.keys(lastCountBackup.materials).length} itens)!` };
    }

    if (target === 'todos_equipamentos') {
      const hasEq = lastCountBackup.equipments && Object.keys(lastCountBackup.equipments).length > 0;
      const hasUn = lastCountBackup.uncatalogued && lastCountBackup.uncatalogued.length > 0;
      if (!hasEq && !hasUn) {
        return { success: false, message: 'Nenhum equipamento registrado na última contagem para clonar.' };
      }
      if (hasEq) setEquipmentCounts(prev => {
        const updated = { ...prev, ...lastCountBackup.equipments };
        localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
        return updated;
      });
      if (hasUn) {
        setUncataloguedEquipments([...lastCountBackup.uncatalogued]);
        localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(lastCountBackup.uncatalogued));
      }
      broadcastSync('COUNT_UPDATED');
      return { success: true, message: 'Todo o estoque de equipamentos (Freezers + Chopeiras) clonado com sucesso!' };
    }

    if (target === 'todos_freezers') {
      const freezerIds = new Set(freezers.map(f => f.id));
      const backupEq = lastCountBackup.equipments || {};
      const newEqCounts: Record<string, EquipmentDailyEntry> = {};
      let count = 0;
      Object.keys(backupEq).forEach(id => {
        if (freezerIds.has(id)) {
          newEqCounts[id] = backupEq[id];
          count++;
        }
      });
      if (count === 0) {
        return { success: false, message: 'Nenhum freezer registrado na última contagem para clonar.' };
      }
      setEquipmentCounts(prev => {
        const updated = { ...prev, ...newEqCounts };
        localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
        return updated;
      });
      broadcastSync('COUNT_UPDATED');
      return { success: true, message: `Todo o estoque de freezers clonado com sucesso (${count} freezers)!` };
    }

    if (target === 'todas_chopeiras') {
      const chopeiraIds = new Set(equipments.map(e => e.id));
      const backupEq = lastCountBackup.equipments || {};
      const newEqCounts: Record<string, EquipmentDailyEntry> = {};
      let count = 0;
      Object.keys(backupEq).forEach(id => {
        if (chopeiraIds.has(id)) {
          newEqCounts[id] = backupEq[id];
          count++;
        }
      });
      if (count === 0) {
        return { success: false, message: 'Nenhuma chopeira elétrica registrada na última contagem para clonar.' };
      }
      setEquipmentCounts(prev => {
        const updated = { ...prev, ...newEqCounts };
        localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
        return updated;
      });
      broadcastSync('COUNT_UPDATED');
      return { success: true, message: `Todo o estoque de chopeiras elétricas clonado com sucesso (${count} chopeiras)!` };
    }

    if (target === 'chopeira_1_torneira' || target === 'chopeira_2_torneiras') {
      const filtered = equipments.filter(e => e.type === target);
      const filteredIds = new Set(filtered.map(e => e.id));
      const backupEq = lastCountBackup.equipments || {};
      const newEqCounts: Record<string, EquipmentDailyEntry> = {};
      let count = 0;
      Object.keys(backupEq).forEach(id => {
        if (filteredIds.has(id)) {
          newEqCounts[id] = backupEq[id];
          count++;
        }
      });
      if (count === 0) {
        return { success: false, message: `Nenhuma chopeira (${target === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras'}) registrada na contagem anterior para clonar.` };
      }
      setEquipmentCounts(prev => {
        const updated = { ...prev, ...newEqCounts };
        localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
        return updated;
      });
      broadcastSync('COUNT_UPDATED');
      return { success: true, message: `Chopeiras (${target === 'chopeira_1_torneira' ? '1 Torneira' : '2 Torneiras'}) clonadas com sucesso (${count} itens)!` };
    }

    // Clonagem por categoria específica de material
    const catMaterials = materials.filter(m => m.category === target);
    const catIds = new Set(catMaterials.map(m => m.id));
    const backupMat = lastCountBackup.materials || {};
    const newMatCounts: Record<string, MaterialDailyEntry> = {};
    let count = 0;
    Object.keys(backupMat).forEach(id => {
      if (catIds.has(id)) {
        newMatCounts[id] = backupMat[id];
        count++;
      }
    });

    if (count === 0) {
      return { success: false, message: 'Nenhum item desta categoria registrado na última contagem para clonar.' };
    }
    setMaterialCounts(prev => {
      const updated = { ...prev, ...newMatCounts };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify(updated));
      return updated;
    });
    broadcastSync('COUNT_UPDATED');
    return { success: true, message: `Itens do grupo clonados com sucesso (${count} itens atualizados)!` };
  };

  // --- ZERAR CONTAGEM POR TELA OU INTEGRALMENTE (APENAS MASTER) ---
  const resetAllTodayCountsByMaster = (scope: 'materiais' | 'equipamentos' | 'ambos' = 'ambos') => {
    // Enquanto houver contagem ou recontagem em andamento não enviada, Master não pode zerar
    if ((isCountInProgress && !isReportSent) || recontagemUnlocked) {
      alert('Existe contagem em andamento.');
      return;
    }

    const materialIdSet = new Set(materials.map(m => m.id));
    const equipIdSet = new Set([...freezers.map(f => f.id), ...equipments.map(e => e.id)]);

    // Backup preservando dados da outra categoria quando a zeragem for específica de uma tela
    const hasMatData = Object.keys(materialCounts).length > 0;
    const hasEqData = Object.keys(equipmentCounts).length > 0 || uncataloguedEquipments.length > 0;

    if (
      (scope === 'ambos' && (hasMatData || hasEqData)) ||
      (scope === 'materiais' && hasMatData) ||
      (scope === 'equipamentos' && hasEqData)
    ) {
      const backup: LastCountBackup = {
        date: todayKey,
        materials: scope === 'equipamentos' ? (lastCountBackup?.materials || { ...materialCounts }) : { ...materialCounts },
        equipments: scope === 'materiais' ? (lastCountBackup?.equipments || { ...equipmentCounts }) : { ...equipmentCounts },
        uncatalogued: scope === 'materiais' ? (lastCountBackup?.uncatalogued || [...uncataloguedEquipments]) : [...uncataloguedEquipments],
        savedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setLastCountBackup(backup);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'last_count_backup'), JSON.stringify(backup));
    }

    // Limpa prévia congelada para que a Prévia do Relatório seja atualizada automaticamente
    if (frozenReportText !== null) {
      setFrozenReportText(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'frozen_report'));
    }

    // Calcula estados remanescentes dependendo do escopo
    const nextMaterialCounts = scope === 'equipamentos' ? materialCounts : {};
    const nextEquipmentCounts = scope === 'materiais' ? equipmentCounts : {};
    const nextUncatalogued = scope === 'materiais' ? uncataloguedEquipments : [];

    const nextRecMaterialCounts = scope === 'equipamentos' ? recontagemMaterialCounts : {};
    const nextRecEquipmentCounts = scope === 'materiais' ? recontagemEquipmentCounts : {};

    let nextRecSelectedIds: Record<string, boolean> = {};
    if (scope !== 'ambos') {
      Object.keys(recontagemSelectedIds).forEach(id => {
        if (!recontagemSelectedIds[id]) return;
        if (scope === 'materiais' && materialIdSet.has(id)) return;
        if (scope === 'equipamentos' && equipIdSet.has(id)) return;
        nextRecSelectedIds[id] = true;
      });
    }

    if (scope === 'materiais' || scope === 'ambos') {
      setMaterialCounts({});
      setRecontagemMaterialCounts({});
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify({}));
    }

    if (scope === 'equipamentos' || scope === 'ambos') {
      setEquipmentCounts({});
      setUncataloguedEquipments([]);
      setRecontagemEquipmentCounts({});
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify([]));
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify({}));
    }

    setRecontagemSelectedIds(nextRecSelectedIds);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify(nextRecSelectedIds));

    // Verifica se ainda restam contagens ou itens selecionados para recontagem na outra tela
    const remainingHasMats = Object.values(nextMaterialCounts).some(hasMaterialEntryQuantity);
    const remainingHasEqs = Object.keys(nextEquipmentCounts).length > 0 || nextUncatalogued.length > 0;
    const remainingHasRecMats = Object.values(nextRecMaterialCounts).some(hasMaterialEntryQuantity);
    const remainingHasRecEqs = Object.keys(nextRecEquipmentCounts).some(id => Boolean(nextRecEquipmentCounts[id]?.status));
    const remainingHasRecIds = Object.keys(nextRecSelectedIds).some(id => Boolean(nextRecSelectedIds[id]));
    const stillHasAnyCountData = remainingHasMats || remainingHasEqs || remainingHasRecMats || remainingHasRecEqs || remainingHasRecIds;

    if (!stillHasAnyCountData) {
      setCountStartedBy(null);
      setRecontagemTargetContador(null);
      setActiveContadorSession(null);
      setIsReportSent(false);
      setRecontagemUnlocked(false);

      const clearedStatus = {
        countStartedBy: null,
        recontagemTargetContador: null,
        isReportSent: false,
        recontagemUnlocked: false,
        activeContadorSession: null,
        hasCounts: false,
      };
      updateBranchStatusMap(activeBranch, clearedStatus);

      localStorage.removeItem(getBranchStorageKey(activeBranch, 'count_started_by'));
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'recontagem_target_contador'));
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'active_contador_session'));
      localStorage.setItem(getBranchStorageKey(activeBranch, 'is_report_sent'), JSON.stringify(false));
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_unlocked'), JSON.stringify(false));
    } else {
      const updatedBranchHasCounts = remainingHasMats || remainingHasEqs;
      updateBranchStatusMap(activeBranch, prev => ({
        ...prev,
        hasCounts: updatedBranchHasCounts,
      }));
    }

    markMasterChangesPending();
    broadcastSync('COUNT_UPDATED');
    broadcastSync('RECONTAGEM_UPDATED');
    broadcastSync('COUNT_RESET');

    const scopeLabel = scope === 'materiais' ? 'Materiais' : scope === 'equipamentos' ? 'Equipamentos' : 'Materiais e Equipamentos';
    addLog({
      type: 'contagem',
      targetType: 'contagem',
      itemCode: 'ZERAR-CONTAGENS',
      title: `Contagem de ${scopeLabel} Zerada [${activeBranch}]`,
      description: `Contagem de ${scopeLabel} zerada localmente na base ${activeBranch}. Clique em "Sincronizar Dados" na tela Cadastros para enviar ao Firebase.`
    });
  };

  // Helper para montar payload completo da base ativa no Firestore
  const buildActiveBranchSyncPayload = (
    targetBranch: UnitBranch,
    overrides?: Partial<BranchSyncPayload>
  ): Partial<BranchSyncPayload> => {
    const todayStr = getTodayKey();
    return {
      branch: targetBranch,
      materials,
      freezers,
      equipments,
      materialCounts,
      equipmentCounts,
      uncataloguedEquipments,
      lastCountBackup,
      activeContadorSession,
      countStartedBy,
      recontagemTargetContador,
      isReportSent,
      recontagemUnlocked,
      countDate: todayStr,
      frozenReportText,
      recontagemSelectedIds,
      recontagemMaterialCounts,
      recontagemEquipmentCounts,
      emailRecipients: recipientsText,
      emailSettings,
      serverEmailConfig,
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  };

  // Marca envio do estoque por e-mail para sincronizar todas as informações e liberar acesso total ao Master
  const markCountAsSent = async (targetBranchChoice?: UnitBranch): Promise<{ synced: boolean; message?: string }> => {
    const branchToMark = targetBranchChoice || activeBranch;
    const todayStr = getTodayKey();
    const isIsolatedTest = isCoringa || isTestBranch(branchToMark);

    if (branchToMark === activeBranch) {
      const shouldLockSent = !isIsolatedTest && hasCurrentBranchCounts;
      setIsReportSent(shouldLockSent);
      localStorage.setItem(getBranchStorageKey(branchToMark, 'is_report_sent'), JSON.stringify(shouldLockSent));
      setRecontagemUnlocked(false);
      setActiveContadorSession(null);
      localStorage.setItem(getBranchStorageKey(branchToMark, 'recontagem_unlocked'), JSON.stringify(false));
      localStorage.removeItem(getBranchStorageKey(branchToMark, 'active_contador_session'));
      updateBranchStatusMap(branchToMark, {
        countStartedBy,
        recontagemTargetContador,
        isReportSent: shouldLockSent,
        recontagemUnlocked: false,
        activeContadorSession: null,
        hasCounts: hasCurrentBranchCounts,
      });
    }

    if (isIsolatedTest) {
      addLog({
        type: 'envio',
        targetType: 'contagem',
        itemCode: 'EMAIL-TESTE',
        title: `Envio Simulado em Modo Teste [${branchToMark}]`,
        description: `Relatório preparado localmente na base de teste ${branchToMark} (sem sincronismo com Firebase e sem interferir nas bases reais).`,
      });
      return {
        synced: true,
        message: `Modo Teste (${branchToMark}): e-mail preparado localmente sem sincronismo com o Firebase.`,
      };
    }

    // EXIGÊNCIA: Somente quando o contador enviar o e-mail do relatório da contagem é que todas as informações
    // do dispositivo atual serão sincronizadas para o Firebase e aos demais usuários ao abrir em qualquer plataforma, computador, celular ou aba
    let synced = false;
    let errorMsg: string | undefined;
    try {
      const hasCountsForRemote = branchToMark === activeBranch ? hasCurrentBranchCounts : true;
      await pushBranchToFirestore(branchToMark, buildActiveBranchSyncPayload(branchToMark, {
        activeContadorSession: null,
        isReportSent: hasCountsForRemote,
        recontagemUnlocked: false,
        countDate: todayStr,
      }));
      const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastFirebaseSyncAt(syncTime);
      localStorage.setItem('choppstock_last_firebase_sync_at', syncTime);
      synced = true;
    } catch (err) {
      console.warn('Erro ao sincronizar envio do relatório com o Firestore:', err);
      errorMsg = isQuotaExceededError(err)
        ? 'Limite diário de gravações gratuitas do Firebase atingido; o relatório foi salvo localmente e o cliente de e-mail será aberto.'
        : 'Não foi possível sincronizar com o Firebase agora, mas os dados foram salvos localmente.';
    }

    broadcastSync('REPORT_SENT');
    addLog({
      type: 'envio',
      targetType: 'contagem',
      itemCode: 'EMAIL-SENT',
      title: `Estoque Enviado por E-mail [${branchToMark}]`,
      description: `Relatório de estoque enviado por e-mail na base ${branchToMark}. Todas as informações foram sincronizadas com o Firebase e o acesso total foi liberado para o usuário Master.`
    });

    return { synced, message: errorMsg };
  };

  // EXIGÊNCIA: Na tela Recontagem, do usuário Master, botão para liberação da recontagem ao contador inicial ou selecionado (em ambas as bases)
  const releaseRecontagemForContador = async (
    targetContador?: StockUser | null
  ): Promise<{ success: boolean; message: string }> => {
    if (!isMaster) {
      return { success: false, message: 'Apenas o usuário Master pode liberar a recontagem.' };
    }
    if (!isCoringa && (recontagemUnlocked || isAnyBaseCountInProgress)) {
      return { success: false, message: 'Existe contagem em andamento.' };
    }
    if (recontagemSelectedCount === 0) {
      return { success: false, message: 'Selecione ao menos 1 item antes de liberar a recontagem para o contador.' };
    }

    const effTargetContador: CountStartedBy | null = targetContador
      ? {
          userId: targetContador.id,
          userName: targetContador.name,
          registration: targetContador.registration,
          startedAt: Date.now(),
        }
      : countStartedBy || recontagemTargetContador;

    if (!effTargetContador) {
      return { success: false, message: 'Selecione um usuário contador da base para liberar a recontagem.' };
    }

    const branchToRelease = activeBranchRef.current;
    setRecontagemUnlocked(true);
    setRecontagemTargetContador(effTargetContador);
    localStorage.setItem(getBranchStorageKey(branchToRelease, 'recontagem_unlocked'), JSON.stringify(true));
    localStorage.setItem(getBranchStorageKey(branchToRelease, 'recontagem_target_contador'), JSON.stringify(effTargetContador));

    updateBranchStatusMap(branchToRelease, prev => ({
      ...prev,
      recontagemTargetContador: effTargetContador,
      recontagemUnlocked: true,
    }));

    if (isCoringa || isTestBranch(branchToRelease)) {
      const initiatorLabel = `${effTargetContador.userName} (Matrícula: ${effTargetContador.registration})`;
      addLog({
        type: 'contagem',
        targetType: 'contagem',
        itemCode: 'RECOUNT-TEST',
        title: `Recontagem Liberada em Modo Teste [${branchToRelease}]`,
        description: `Simulação local de liberação de ${recontagemSelectedCount} item(ns) para ${initiatorLabel} (sem sincronismo Firebase).`,
      });
      return {
        success: true,
        message: `Modo Teste: Recontagem liberada localmente na base ${branchToRelease} para ${initiatorLabel} (sem Firebase).`,
      };
    }

    try {
      await pushBranchToFirestore(
        branchToRelease,
        buildActiveBranchSyncPayload(branchToRelease, {
          recontagemUnlocked: true,
          recontagemTargetContador: effTargetContador,
          activeContadorSession: null,
        })
      );
      const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastFirebaseSyncAt(syncTime);
      localStorage.setItem('choppstock_last_firebase_sync_at', syncTime);
      broadcastSync('RECONTAGEM_UPDATED');

      const initiatorLabel = `${effTargetContador.userName} (Matrícula: ${effTargetContador.registration})`;

      addLog({
        type: 'contagem',
        targetType: 'contagem',
        itemCode: 'RECOUNT-RELEASE',
        title: `Recontagem Liberada [${branchToRelease}]`,
        description: `Recontagem de ${recontagemSelectedCount} item(ns) liberada pelo Master e sincronizada para ${initiatorLabel}.`,
      });

      return {
        success: true,
        message: `Recontagem liberada e sincronizada para ${initiatorLabel} na base ${branchToRelease}!`,
      };
    } catch (err) {
      console.warn('Erro ao liberar recontagem no Firestore:', err);
      broadcastSync('RECONTAGEM_UPDATED');
      return {
        success: true,
        message: isQuotaExceededError(err)
          ? `Recontagem liberada localmente na base ${branchToRelease} (cota diária do Firebase atingida).`
          : `Recontagem liberada localmente na base ${branchToRelease}, mas houve falha ao sincronizar com o Firebase.`,
      };
    }
  };

  const revokeRecontagemForContador = async (): Promise<{ success: boolean; message: string }> => {
    if (!isMaster) {
      return { success: false, message: 'Apenas o usuário Master pode bloquear a recontagem.' };
    }
    if (!isCoringa && recontagemUnlocked) {
      return { success: false, message: 'Existe contagem em andamento.' };
    }
    const branchToLock = activeBranchRef.current;
    setRecontagemUnlocked(false);
    localStorage.setItem(getBranchStorageKey(branchToLock, 'recontagem_unlocked'), JSON.stringify(false));

    updateBranchStatusMap(branchToLock, prev => ({
      ...prev,
      recontagemUnlocked: false,
    }));

    if (isCoringa || isTestBranch(branchToLock)) {
      return {
        success: true,
        message: `Modo Teste: Liberação de recontagem encerrada localmente na base ${branchToLock}.`,
      };
    }

    try {
      await pushBranchToFirestore(
        branchToLock,
        buildActiveBranchSyncPayload(branchToLock, {
          recontagemUnlocked: false,
        })
      );
      const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastFirebaseSyncAt(syncTime);
      localStorage.setItem('choppstock_last_firebase_sync_at', syncTime);
      broadcastSync('RECONTAGEM_UPDATED');
      return {
        success: true,
        message: `Liberação da recontagem bloqueada na base ${branchToLock}.`,
      };
    } catch {
      broadcastSync('RECONTAGEM_UPDATED');
      return {
        success: true,
        message: `Liberação da recontagem bloqueada localmente na base ${branchToLock}.`,
      };
    }
  };

  // Marca envio da recontagem por e-mail pelo Contador e sincroniza resultados com Firestore
  const markRecountAsSent = async (): Promise<{ synced: boolean; message?: string }> => {
    const branchToMark = activeBranchRef.current;
    const isIsolatedTest = isCoringa || isTestBranch(branchToMark);
    setRecontagemUnlocked(false);
    if (!isIsolatedTest) {
      setIsReportSent(true);
      localStorage.setItem(getBranchStorageKey(branchToMark, 'is_report_sent'), JSON.stringify(true));
    }
    setActiveContadorSession(null);
    localStorage.setItem(getBranchStorageKey(branchToMark, 'recontagem_unlocked'), JSON.stringify(false));
    localStorage.removeItem(getBranchStorageKey(branchToMark, 'active_contador_session'));

    updateBranchStatusMap(branchToMark, prev => ({
      ...prev,
      isReportSent: !isIsolatedTest,
      recontagemUnlocked: false,
      activeContadorSession: null,
    }));

    if (isIsolatedTest) {
      return {
        synced: true,
        message: `Modo Teste: Relatório da recontagem preparado localmente na base ${branchToMark} (sem Firebase).`,
      };
    }

    let synced = false;
    let errorMsg: string | undefined;
    try {
      await pushBranchToFirestore(
        branchToMark,
        buildActiveBranchSyncPayload(branchToMark, {
          isReportSent: true,
          recontagemUnlocked: false,
          activeContadorSession: null,
        })
      );
      const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastFirebaseSyncAt(syncTime);
      localStorage.setItem('choppstock_last_firebase_sync_at', syncTime);
      synced = true;
    } catch (err) {
      console.warn('Erro ao sincronizar envio da recontagem com o Firestore:', err);
      errorMsg = isQuotaExceededError(err)
        ? 'Limite diário de gravações gratuitas do Firebase atingido; a recontagem foi salva localmente.'
        : 'Não foi possível sincronizar a recontagem com o Firebase agora, mas os dados foram salvos localmente.';
    }

    broadcastSync('RECONTAGEM_UPDATED');
    addLog({
      type: 'envio',
      targetType: 'contagem',
      itemCode: 'RECOUNT-EMAIL-SENT',
      title: `Recontagem Enviada por E-mail [${branchToMark}]`,
      description: `Relatório da recontagem enviado por e-mail na base ${branchToMark} e sincronizado com o Firebase.`,
    });

    return { synced, message: errorMsg };
  };

  // Cancela a recontagem ativa pelo usuário Contador, excluindo a recontagem do mesmo e liberando o acesso ao usuário Master
  const cancelRecontagemByContador = async (): Promise<{ synced: boolean; message: string }> => {
    if (!activeUser || activeUser.roleLevel !== 'contador') {
      return { synced: false, message: 'Apenas o usuário Contador pode cancelar a recontagem ativa.' };
    }
    if (!recontagemUnlocked || !canActiveUserRecount) {
      return { synced: false, message: 'Não há recontagem ativa para este contador.' };
    }

    const branchToCancel = activeBranchRef.current;

    setRecontagemSelectedIds({});
    setRecontagemMaterialCounts({});
    setRecontagemEquipmentCounts({});
    setRecontagemTargetContador(null);
    setRecontagemUnlocked(false);
    setActiveContadorSession(null);

    localStorage.setItem(getBranchStorageKey(branchToCancel, 'recontagem_selected_ids'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(branchToCancel, 'recontagem_material_counts'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(branchToCancel, 'recontagem_equipment_counts'), JSON.stringify({}));
    localStorage.removeItem(getBranchStorageKey(branchToCancel, 'recontagem_target_contador'));
    localStorage.setItem(getBranchStorageKey(branchToCancel, 'recontagem_unlocked'), JSON.stringify(false));
    localStorage.removeItem(getBranchStorageKey(branchToCancel, 'active_contador_session'));

    updateBranchStatusMap(branchToCancel, prev => ({
      ...prev,
      recontagemTargetContador: null,
      recontagemUnlocked: false,
      activeContadorSession: null,
    }));

    if (isCoringa || isTestBranch(branchToCancel)) {
      const localMsg = `Modo Teste: Recontagem cancelada localmente na base ${branchToCancel}.`;
      setSystemNotice(localMsg);
      return { synced: true, message: localMsg };
    }

    let synced = false;
    let message = `Recontagem cancelada na base ${branchToCancel}. O acesso foi liberado novamente para o usuário Master.`;
    try {
      await pushBranchToFirestore(
        branchToCancel,
        buildActiveBranchSyncPayload(branchToCancel, {
          recontagemSelectedIds: {},
          recontagemMaterialCounts: {},
          recontagemEquipmentCounts: {},
          recontagemTargetContador: null,
          recontagemUnlocked: false,
          activeContadorSession: null,
        })
      );
      const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastFirebaseSyncAt(syncTime);
      localStorage.setItem('choppstock_last_firebase_sync_at', syncTime);
      synced = true;
    } catch (err) {
      console.warn('Erro ao sincronizar cancelamento da recontagem com o Firestore:', err);
      message = isQuotaExceededError(err)
        ? `Recontagem cancelada localmente na base ${branchToCancel} (cota diária do Firebase atingida).`
        : `Recontagem cancelada localmente na base ${branchToCancel}, mas houve falha ao sincronizar com o Firebase.`;
    }

    broadcastSync('RECONTAGEM_UPDATED');
    setSystemNotice(message);
    addLog({
      type: 'exclusao',
      targetType: 'contagem',
      itemCode: 'RECOUNT-CANCEL',
      title: `Recontagem Cancelada pelo Contador [${branchToCancel}]`,
      description: `Recontagem cancelada pelo contador ${activeUser.name} (${activeUser.registration}) na base ${branchToCancel}. Acesso liberado novamente ao usuário Master.`,
    });

    return { synced, message };
  };

  // --- SINCRONIZAÇÃO MANUAL DO USUÁRIO MASTER (BOTÃO NA TELA CADASTROS - APENAS BASE LOGADA) ---
  const syncMasterDataToFirebase = async (): Promise<{ success: boolean; message: string }> => {
    if (!isMaster) {
      return { success: false, message: 'Apenas o usuário Master pode sincronizar os dados.' };
    }
    const targetBranch = activeBranchRef.current;
    if (isCoringa || isTestBranch(targetBranch)) {
      return {
        success: true,
        message: 'Modo Teste (CORINGA): nenhum sincronismo realizado com o Firebase. As alterações permanecem apenas nas bases teste locais.',
      };
    }
    if (isAnyBaseCountInProgress) {
      return { success: false, message: 'Existe contagem em andamento.' };
    }

    try {
      setFrozenReportText(null);
      localStorage.removeItem(getBranchStorageKey(targetBranch, 'frozen_report'));
      const payload = buildActiveBranchSyncPayload(targetBranch, { frozenReportText: null });
      const tasks: Promise<void>[] = [pushBranchToFirestore(targetBranch, payload)];
      if (pendingUsersSync) {
        tasks.push(pushUsersToFirestore(users));
      }

      await Promise.all(tasks);

      const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      localStorage.removeItem(getBranchStorageKey(targetBranch, 'pending_master_sync'));
      localStorage.removeItem('choppstock_pending_master_sync');
      if (targetBranch === 'PAULO AFONSO') {
        setPendingSyncPA(false);
      } else {
        setPendingSyncDEL(false);
      }
      if (pendingUsersSync) {
        setPendingUsersSync(false);
        localStorage.removeItem('choppstock_pending_users_sync');
      }
      setLastFirebaseSyncAt(syncTime);
      localStorage.setItem('choppstock_last_firebase_sync_at', syncTime);

      addLog({
        type: 'inclusao',
        targetType: 'contagem',
        itemCode: 'FIREBASE-SYNC',
        title: `Sincronização da Base [${targetBranch}] Realizada pelo Master`,
        description: `Dados da base ${targetBranch}${pendingUsersSync ? ' e Usuários' : ''} sincronizados com o Firestore às ${syncTime}.`
      });

      return {
        success: true,
        message: `Dados da base ${targetBranch} sincronizados com o Firebase!`
      };
    } catch (error) {
      console.error('Erro na sincronização manual Master:', error);
      if (isQuotaExceededError(error)) {
        return {
          success: false,
          message: 'Limite diário de gravações gratuitas do Firebase Firestore atingido (Quota exceeded). A cota será redefinida automaticamente amanhã; os dados seguem salvos localmente.'
        };
      }
      return {
        success: false,
        message: `Erro ao sincronizar dados da base ${targetBranch} com o Firebase. Verifique sua conexão e tente novamente.`
      };
    }
  };

  // --- CLONAGEM DAS BASES REAIS PARA AS BASES DE TESTE ISOLADAS (CORINGA) ---
  const cloneRealBasesToTestBases = (forceReclone: boolean = false) => {
    if (!forceReclone && localStorage.getItem(TEST_BASES_CLONED_KEY) === 'true') {
      const hasPaTest = localStorage.getItem(getBranchStorageKey('PAULO AFONSO (TESTE)', 'materials')) !== null;
      const hasDelTest = localStorage.getItem(getBranchStorageKey('DELMIRO (TESTE)', 'materials')) !== null;
      if (hasPaTest && hasDelTest && localStorage.getItem(TEST_USERS_STORAGE_KEY) !== null) {
        return;
      }
    }

    const branchPairs: Array<{ real: UnitBranch; test: UnitBranch }> = [
      { real: 'PAULO AFONSO', test: 'PAULO AFONSO (TESTE)' },
      { real: 'DELMIRO', test: 'DELMIRO (TESTE)' },
    ];

    const keysToClone: Array<{ subKey: string; fallback: unknown; legacyKeys?: string[] }> = [
      { subKey: 'materials', fallback: INITIAL_MATERIALS, legacyKeys: [STORAGE_KEYS.MATERIALS] },
      { subKey: 'freezers', fallback: INITIAL_FREEZERS, legacyKeys: [STORAGE_KEYS.FREEZERS] },
      { subKey: 'equipments', fallback: INITIAL_EQUIPMENTS, legacyKeys: [STORAGE_KEYS.EQUIPMENTS] },
      { subKey: 'email_settings', fallback: INITIAL_EMAIL_SETTINGS, legacyKeys: [STORAGE_KEYS.EMAIL_SETTINGS] },
      { subKey: 'server_email_config', fallback: INITIAL_SERVER_EMAIL_CONFIG, legacyKeys: [STORAGE_KEYS.SERVER_EMAIL_CONFIG] },
      { subKey: 'last_count_backup', fallback: null },
      { subKey: 'logs', fallback: INITIAL_LOGS },
      { subKey: 'today_materials', fallback: {} },
      { subKey: 'today_equipments', fallback: {} },
      { subKey: 'today_uncatalogued', fallback: [] },
      { subKey: 'recontagem_selected_ids', fallback: {} },
      { subKey: 'recontagem_material_counts', fallback: {} },
      { subKey: 'recontagem_equipment_counts', fallback: {} },
    ];

    branchPairs.forEach(({ real, test }) => {
      keysToClone.forEach(({ subKey, fallback, legacyKeys }) => {
        const realData = loadInitialBranchData(real, subKey, fallback, legacyKeys || []);
        localStorage.setItem(getBranchStorageKey(test, subKey), JSON.stringify(realData));
      });

      const realRecipients = localStorage.getItem(getBranchStorageKey(real, 'recipients_text'));
      if (realRecipients !== null) {
        localStorage.setItem(getBranchStorageKey(test, 'recipients_text'), realRecipients);
      } else {
        const realEmails = loadInitialBranchData(real, 'email_settings', INITIAL_EMAIL_SETTINGS, [STORAGE_KEYS.EMAIL_SETTINGS]);
        localStorage.setItem(getBranchStorageKey(test, 'recipients_text'), (realEmails.emails || []).join(', '));
      }

      const realCalDay = localStorage.getItem(getBranchStorageKey(real, 'calendar_day')) || getTodayKey();
      localStorage.setItem(getBranchStorageKey(test, 'calendar_day'), realCalDay);

      // Bases de teste sempre iniciam sem travas ou sessões da produção
      localStorage.removeItem(getBranchStorageKey(test, 'active_contador_session'));
      localStorage.removeItem(getBranchStorageKey(test, 'count_started_by'));
      localStorage.removeItem(getBranchStorageKey(test, 'recontagem_target_contador'));
      localStorage.removeItem(getBranchStorageKey(test, 'frozen_report'));
      localStorage.removeItem(getBranchStorageKey(test, 'pending_master_sync'));
      localStorage.setItem(getBranchStorageKey(test, 'is_report_sent'), JSON.stringify(false));
      localStorage.setItem(getBranchStorageKey(test, 'recontagem_unlocked'), JSON.stringify(false));
    });

    const prodUsers = loadProductionUsersFromStorage();
    const clonedTestUsers = ensureCoringaUser(prodUsers).map(u => {
      if (isCoringaUser(u)) return CORINGA_USER;
      if (u.roleLevel === 'contador' && u.branch) {
        return { ...u, branch: toTestBranch(u.branch) };
      }
      return u;
    });
    localStorage.setItem(TEST_USERS_STORAGE_KEY, JSON.stringify(clonedTestUsers));
    localStorage.setItem(TEST_BASES_CLONED_KEY, 'true');

    setBranchStatuses(prev => ({
      ...prev,
      'PAULO AFONSO (TESTE)': readBranchInitialStatus('PAULO AFONSO (TESTE)'),
      'DELMIRO (TESTE)': readBranchInitialStatus('DELMIRO (TESTE)'),
    }));
  };

  const recloneTestBasesFromApp = () => {
    cloneRealBasesToTestBases(true);

    const curBranch = isTestBranch(activeBranchRef.current) ? activeBranchRef.current : 'PAULO AFONSO (TESTE)';
    const dKey = getTodayKey();
    isSwitchingBranchRef.current = true;
    activeBranchRef.current = curBranch;
    setActiveBranchState(curBranch);

    setMaterials(loadInitialBranchData(curBranch, 'materials', INITIAL_MATERIALS, []));
    setFreezers(loadInitialBranchData(curBranch, 'freezers', INITIAL_FREEZERS, []));
    setEquipments(loadInitialBranchData(curBranch, 'equipments', INITIAL_EQUIPMENTS, []));
    setMaterialCounts(loadInitialBranchData(curBranch, 'today_materials', {}, []));
    setEquipmentCounts(loadInitialBranchData(curBranch, 'today_equipments', {}, []));
    setUncataloguedEquipments(loadInitialBranchData(curBranch, 'today_uncatalogued', [], []));
    setRecontagemSelectedIds(loadInitialBranchData(curBranch, 'recontagem_selected_ids', {}, []));
    setRecontagemMaterialCounts(loadInitialBranchData(curBranch, 'recontagem_material_counts', {}, []));
    setRecontagemEquipmentCounts(loadInitialBranchData(curBranch, 'recontagem_equipment_counts', {}, []));
    setLastCountBackup(loadInitialBranchData(curBranch, 'last_count_backup', null, []));
    setLogs(loadInitialBranchData(curBranch, 'logs', INITIAL_LOGS, []));
    const clonedEmail = loadInitialBranchData(curBranch, 'email_settings', INITIAL_EMAIL_SETTINGS, []);
    setEmailSettings(clonedEmail);
    setServerEmailConfig(loadInitialBranchData(curBranch, 'server_email_config', INITIAL_SERVER_EMAIL_CONFIG, []));
    setRecipientsTextState(localStorage.getItem(getBranchStorageKey(curBranch, 'recipients_text')) ?? clonedEmail.emails.join(', '));
    setCountStartedBy(null);
    setRecontagemTargetContador(null);
    setActiveContadorSession(null);
    setIsReportSent(false);
    setRecontagemUnlocked(false);
    setFrozenReportTextState(null);
    setTodayKey(dKey);

    try {
      const savedTestUsers = localStorage.getItem(TEST_USERS_STORAGE_KEY);
      if (savedTestUsers) {
        setUsers(ensureCoringaUser(JSON.parse(savedTestUsers)));
      }
    } catch {}

    setTimeout(() => {
      isSwitchingBranchRef.current = false;
    }, 50);

    setSystemNotice('Bases de teste reclonadas a partir das bases reais do app (PAULO AFONSO e DELMIRO) — 100% local e sem Firebase.');
  };

  // --- VALIDAÇÃO DE CREDENCIAIS NA TELA DE LOGIN (ANTES DA SELEÇÃO DA BASE DO MASTER) ---
  const verifyCredentials = async (
    registration: string,
    password: string
  ): Promise<{ success: boolean; message?: string; user?: StockUser }> => {
    const cleanReg = registration.trim().toUpperCase();
    const cleanPass = password.trim();

    if (!cleanReg) {
      return { success: false, message: 'Por favor, informe a matrícula do usuário.' };
    }

    // CORINGA (9999): validação estritamente local, sem nenhuma consulta ao Firebase
    if (cleanReg === CORINGA_REGISTRATION) {
      return { success: true, user: CORINGA_USER };
    }

    const remoteUsers = await fetchUsersFromFirestore();
    const effectiveUsers = ensureCoringaUser(remoteUsers && remoteUsers.length > 0 ? remoteUsers : usersRef.current);
    usersRef.current = effectiveUsers;
    if (remoteUsers && remoteUsers.length > 0) {
      setUsers(effectiveUsers);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(effectiveUsers));
    }

    const user = effectiveUsers.find(u => u.registration.toUpperCase() === cleanReg);
    if (!user) {
      return { success: false, message: 'Matrícula não encontrada.' };
    }

    if (user.status !== 'ativo') {
      return { success: false, message: 'Usuário inativo. Contate o Administrador Master.' };
    }

    if (user.roleLevel === 'master') {
      if (!cleanPass) {
        return { success: false, message: 'Por favor, digite a senha de acesso do Usuário Master.' };
      }
      if (user.password !== cleanPass) {
        return { success: false, message: 'Senha incorreta para Usuário Master.' };
      }
    }

    return { success: true, user };
  };

  // --- AUTENTICAÇÃO / LOGIN (BUSCA AUTOMÁTICA ÚNICA NO FIREBASE AO LOGAR; EXCETO CORINGA QUE É 100% LOCAL) ---
  const login = async (
    registration: string,
    password: string,
    branchChoice?: UnitBranch,
    skipUsersRefresh: boolean = false
  ): Promise<{ success: boolean; message?: string }> => {
    const cleanReg = registration.trim().toUpperCase();
    const cleanPass = password.trim();
    const todayStr = getTodayKey();

    // FLUXO ISOLADO DO USUÁRIO TESTE CORINGA (9999):
    // - Acesso total equivalente ao Master nas bases teste clonadas
    // - ZERO sincronismo com Firebase e ZERO interferência nos usuários e bases reais
    if (cleanReg === CORINGA_REGISTRATION) {
      cloneRealBasesToTestBases(false);

      const targetTestBranch: UnitBranch =
        branchChoice && isTestBranch(branchChoice) ? branchChoice : 'PAULO AFONSO (TESTE)';

      isSwitchingBranchRef.current = true;
      activeBranchRef.current = targetTestBranch;
      setActiveBranchState(targetTestBranch);
      localStorage.setItem('choppstock_active_branch', targetTestBranch);

      let testUsersList: StockUser[] = [CORINGA_USER];
      try {
        const rawTestUsers = localStorage.getItem(TEST_USERS_STORAGE_KEY);
        if (rawTestUsers) {
          testUsersList = ensureCoringaUser(JSON.parse(rawTestUsers));
        }
      } catch {}

      const dKey = loadInitialBranchData(targetTestBranch, 'calendar_day', todayStr, []);
      const isNewDay = dKey !== todayStr;
      if (isNewDay) {
        localStorage.setItem(getBranchStorageKey(targetTestBranch, 'calendar_day'), todayStr);
      }

      setUsers(testUsersList);
      setMaterials(loadInitialBranchData(targetTestBranch, 'materials', INITIAL_MATERIALS, []));
      setFreezers(loadInitialBranchData(targetTestBranch, 'freezers', INITIAL_FREEZERS, []));
      setEquipments(loadInitialBranchData(targetTestBranch, 'equipments', INITIAL_EQUIPMENTS, []));
      setMaterialCounts(isNewDay ? {} : loadInitialBranchData(targetTestBranch, 'today_materials', {}, []));
      setEquipmentCounts(isNewDay ? {} : loadInitialBranchData(targetTestBranch, 'today_equipments', {}, []));
      setUncataloguedEquipments(isNewDay ? [] : loadInitialBranchData(targetTestBranch, 'today_uncatalogued', [], []));
      setRecontagemSelectedIds(isNewDay ? {} : loadInitialBranchData(targetTestBranch, 'recontagem_selected_ids', {}, []));
      setRecontagemMaterialCounts(isNewDay ? {} : loadInitialBranchData(targetTestBranch, 'recontagem_material_counts', {}, []));
      setRecontagemEquipmentCounts(isNewDay ? {} : loadInitialBranchData(targetTestBranch, 'recontagem_equipment_counts', {}, []));
      setLastCountBackup(loadInitialBranchData(targetTestBranch, 'last_count_backup', null, []));
      setLogs(loadInitialBranchData(targetTestBranch, 'logs', INITIAL_LOGS, []));

      const testEmail = loadInitialBranchData(targetTestBranch, 'email_settings', INITIAL_EMAIL_SETTINGS, []);
      const testServer = loadInitialBranchData(targetTestBranch, 'server_email_config', INITIAL_SERVER_EMAIL_CONFIG, []);
      const testRecipients = localStorage.getItem(getBranchStorageKey(targetTestBranch, 'recipients_text')) ?? testEmail.emails.join(', ');

      setEmailSettings(testEmail);
      setServerEmailConfig(testServer);
      setRecipientsTextState(testRecipients);
      setCountStartedBy(null);
      setRecontagemTargetContador(null);
      setActiveContadorSession(null);
      setIsReportSent(false);
      setRecontagemUnlocked(false);
      setFrozenReportTextState(localStorage.getItem(getBranchStorageKey(targetTestBranch, 'frozen_report')));
      setTodayKey(todayStr);
      setEmptyMaterialCodesAlert(null);

      setActiveUserState(CORINGA_USER);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(CORINGA_USER));

      setTimeout(() => {
        isSwitchingBranchRef.current = false;
      }, 50);

      setSystemNotice('Modo Teste Isolado (CORINGA - 9999) ativo nas bases teste clonadas. Nenhuma ação interfere no Firebase ou usuários reais.');
      return { success: true };
    }

    // 1. Atualiza a lista de usuários ao tentar logar e valida credenciais antes de baixar as bases
    let effectiveUsers = ensureCoringaUser(usersRef.current);
    if (!skipUsersRefresh) {
      const remoteUsers = await fetchUsersFromFirestore();
      if (remoteUsers && remoteUsers.length > 0) {
        effectiveUsers = ensureCoringaUser(remoteUsers);
        usersRef.current = effectiveUsers;
        setUsers(effectiveUsers);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(effectiveUsers));
      }
    }

    const user = effectiveUsers.find(u => u.registration.toUpperCase() === cleanReg);
    if (!user) {
      return { success: false, message: 'Matrícula não encontrada.' };
    }

    if (user.status !== 'ativo') {
      return { success: false, message: 'Usuário inativo. Contate o Administrador Master.' };
    }

    // EXIGÊNCIA: Usuários Contador não têm senha, acesso somente digitando a matrícula.
    // Apenas para usuários Master exige verificação de senha!
    if (user.roleLevel === 'master') {
      if (!cleanPass) {
        return { success: false, message: 'Por favor, digite a senha de acesso do Usuário Master.' };
      }
      if (user.password !== cleanPass) {
        return { success: false, message: 'Senha incorreta para Usuário Master.' };
      }
    }

    // EXIGÊNCIA: Master escolhe a base ao logar (PAULO AFONSO ou DELMIRO) e acessa ambas as bases.
    // Usuários Contadores têm acesso estritamente à base selecionada no seu cadastro.
    const candidateBranch = branchChoice && !isTestBranch(branchChoice) ? branchChoice : activeBranch;
    const safeMasterBranch: UnitBranch = isTestBranch(candidateBranch) ? 'PAULO AFONSO' : candidateBranch;
    const targetBranch: UnitBranch = user.roleLevel === 'contador'
      ? normalizeProductionBranch(user.branch)
      : safeMasterBranch;

    // 2. Ao logar, busca do Firebase apenas os dados da(s) respectiva(s) base(s) de acesso do usuário
    let remotePA: BranchSyncPayload | null = null;
    let remoteDEL: BranchSyncPayload | null = null;
    if (user.roleLevel === 'master') {
      [remotePA, remoteDEL] = await Promise.all([
        fetchBranchData('PAULO AFONSO'),
        fetchBranchData('DELMIRO'),
      ]);
    } else if (targetBranch === 'PAULO AFONSO') {
      remotePA = await fetchBranchData('PAULO AFONSO');
    } else {
      remoteDEL = await fetchBranchData('DELMIRO');
    }

    const getLocalDateKeyFromIso = (iso?: string) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Helper para verificar status atualizado de contagem e sessão por base (com validação de virada de dia)
    const evaluateBranchStatus = (b: UnitBranch, remote: BranchSyncPayload | null) => {
      let remoteStarted: CountStartedBy | null = null;
      let remoteRecTarget: CountStartedBy | null = null;
      let remoteReportSent = false;
      let remoteRecontagemUnlocked = false;
      let remoteSession: ContadorSession | null = null;
      let remoteHasCounts = false;

      if (remote) {
        const remoteDay = remote.countDate || getLocalDateKeyFromIso(remote.updatedAt);
        const isPrevDay = Boolean(remoteDay && remoteDay !== todayStr);
        if (!isPrevDay) {
          remoteStarted = remote.countStartedBy || null;
          remoteRecTarget = remote.recontagemTargetContador || null;
          remoteReportSent = !!remote.isReportSent;
          remoteRecontagemUnlocked = !!remote.recontagemUnlocked;
          remoteSession = remote.activeContadorSession || null;
          remoteHasCounts = Boolean(
            (remote.materialCounts && Object.values(remote.materialCounts).some(hasMaterialEntryQuantity)) ||
            (remote.equipmentCounts && Object.keys(remote.equipmentCounts).length > 0) ||
            (Array.isArray(remote.uncataloguedEquipments) && remote.uncataloguedEquipments.length > 0)
          );
        }
      }

      let localStarted: CountStartedBy | null = null;
      let localRecTarget: CountStartedBy | null = null;
      let localReportSent = false;
      let localRecontagemUnlocked = false;
      let localSession: ContadorSession | null = null;
      let localHasCounts = false;
      let localHasUnsentCounts = false;

      try {
        const localDay = localStorage.getItem(getBranchStorageKey(b, 'calendar_day'));
        const isLocalToday = !localDay || localDay === todayStr;
        if (isLocalToday) {
          const sStarted = localStorage.getItem(getBranchStorageKey(b, 'count_started_by'));
          if (sStarted) localStarted = JSON.parse(sStarted);
          const sRecTarget = localStorage.getItem(getBranchStorageKey(b, 'recontagem_target_contador'));
          if (sRecTarget) localRecTarget = JSON.parse(sRecTarget);
          const sSent = localStorage.getItem(getBranchStorageKey(b, 'is_report_sent'));
          if (sSent) localReportSent = JSON.parse(sSent);
          const sRecUnlocked = localStorage.getItem(getBranchStorageKey(b, 'recontagem_unlocked'));
          if (sRecUnlocked) localRecontagemUnlocked = JSON.parse(sRecUnlocked);
          const sSess = localStorage.getItem(getBranchStorageKey(b, 'active_contador_session'));
          if (sSess) localSession = JSON.parse(sSess);
          const sMat = localStorage.getItem(getBranchStorageKey(b, 'today_materials'));
          const sEq = localStorage.getItem(getBranchStorageKey(b, 'today_equipments'));
          const sUnc = localStorage.getItem(getBranchStorageKey(b, 'today_uncatalogued'));
          if (
            (sMat && Object.values(JSON.parse(sMat) as Record<string, MaterialDailyEntry>).some(hasMaterialEntryQuantity)) ||
            (sEq && Object.keys(JSON.parse(sEq)).length > 0) ||
            (sUnc && JSON.parse(sUnc).length > 0)
          ) {
            localHasCounts = true;
          }
          if (!localReportSent && localHasCounts) {
            localHasUnsentCounts = true;
          }
        }
      } catch {}

      const recTargetContadorVal = remote !== null ? remoteRecTarget : localRecTarget;
      const recontagemUnlockedVal = remote !== null ? remoteRecontagemUnlocked : localRecontagemUnlocked;
      const rawIsReportSentVal = remote !== null ? remoteReportSent : localReportSent;
      const hasCountsVal = remote !== null
        ? (remoteHasCounts || (!rawIsReportSentVal && localHasUnsentCounts))
        : localHasCounts;

      // Só considera relatório enviado/bloqueado se realmente existirem itens contados na base
      const isReportSentVal = rawIsReportSentVal && hasCountsVal;
      const rawCountStartedBy = remote !== null
        ? (remoteStarted || (!isReportSentVal && localHasUnsentCounts ? localStarted : null))
        : localStarted;

      // A contagem só é considerada iniciada quando houver pelo menos 1 quantidade/item inserido
      const countStartedByVal = (hasCountsVal || isReportSentVal) ? rawCountStartedBy : null;
      const activeSessionVal = (!recontagemUnlockedVal && (isReportSentVal || !hasCountsVal || !countStartedByVal))
        ? null
        : (remote !== null
            ? (remoteSession || (!isReportSentVal && localHasUnsentCounts ? localSession : null))
            : localSession);

      const isCountInProgressVal =
        recontagemUnlockedVal ||
        (hasCountsVal && (Boolean(countStartedByVal) || Boolean(activeSessionVal)) && !isReportSentVal);

      return {
        countStartedBy: countStartedByVal,
        recontagemTargetContador: recTargetContadorVal,
        isReportSent: isReportSentVal,
        recontagemUnlocked: recontagemUnlockedVal,
        activeSession: activeSessionVal,
        hasCounts: hasCountsVal,
        isCountInProgress: isCountInProgressVal,
        preserveLocalUnsentCounts: !isReportSentVal && localHasUnsentCounts,
      };
    };

    const statusPA = evaluateBranchStatus('PAULO AFONSO', remotePA);
    const statusDEL = evaluateBranchStatus('DELMIRO', remoteDEL);

    // EXIGÊNCIA: O bloqueio de acesso vale somente para usuários da mesma base; contagem/recontagem em uma base não bloqueia a outra
    if (user.roleLevel === 'master') {
      const targetStatus = targetBranch === 'PAULO AFONSO' ? statusPA : statusDEL;
      if (targetStatus.isCountInProgress || targetStatus.recontagemUnlocked) {
        return {
          success: false,
          message: 'Existe contagem em andamento.'
        };
      }
    }

    if (user.roleLevel === 'contador') {
      const targetStatus = targetBranch === 'PAULO AFONSO' ? statusPA : statusDEL;
      const authorizedRecountContador = targetStatus.recontagemTargetContador || targetStatus.countStartedBy;
      const matchesAuthorizedRecount = Boolean(
        authorizedRecountContador &&
        (authorizedRecountContador.userId === user.id ||
          (authorizedRecountContador.registration && authorizedRecountContador.registration.toUpperCase() === cleanReg))
      );

      // Se houver recontagem liberada ativa na base: SOMENTE o contador inicial/selecionado tem acesso até o envio da recontagem
      if (targetStatus.recontagemUnlocked) {
        if (!matchesAuthorizedRecount) {
          return {
            success: false,
            message: 'Existe recontagem em andamento direcionada a outro contador.'
          };
        }
      } else {
        // Sem recontagem liberada: se o relatório com itens contados já foi enviado, bloqueia todos os contadores até o Master zerar a contagem
        if (targetStatus.isReportSent) {
          return {
            success: false,
            message: 'A contagem de hoje já foi enviada por e-mail. Aguarde o usuário Master zerar e sincronizar a contagem para iniciar uma nova.'
          };
        }

        // Se outro contador já iniciou contagem hoje (primeira quantidade inserida), bloqueia demais contadores
        if (targetStatus.countStartedBy) {
          const isInitiator = targetStatus.countStartedBy.userId === user.id ||
            (targetStatus.countStartedBy.registration && targetStatus.countStartedBy.registration.toUpperCase() === cleanReg);
          if (!isInitiator) {
            return {
              success: false,
              message: `A contagem já foi iniciada pelo contador ${targetStatus.countStartedBy.userName} (Matrícula: ${targetStatus.countStartedBy.registration}).`
            };
          }
        }
      }

      // Bloqueia outro contador se houver sessão ativa em andamento (contagem inicial ou recontagem)
      const isSameSessionUser = Boolean(
        targetStatus.activeSession &&
        (targetStatus.activeSession.userId === user.id ||
          (targetStatus.activeSession.registration &&
            targetStatus.activeSession.registration.toUpperCase() === cleanReg))
      );
      if (targetStatus.isCountInProgress && targetStatus.activeSession && targetStatus.activeSession.userId && !isSameSessionUser) {
        const isRecent = !targetStatus.activeSession.lastHeartbeat || (Date.now() - targetStatus.activeSession.lastHeartbeat < 12 * 60 * 60 * 1000);
        if (isRecent) {
          return {
            success: false,
            message: 'Existe contagem em andamento.'
          };
        }
      }
    }

    // Atualiza os dados das respectivas bases de acesso com os dados mais recentes buscados do Firestore
    isSwitchingBranchRef.current = true;
    activeBranchRef.current = targetBranch;
    setActiveBranchState(targetBranch);
    localStorage.setItem('choppstock_active_branch', targetBranch);

    if (remotePA && (user.roleLevel === 'master' || targetBranch === 'PAULO AFONSO')) {
      applyRemoteBranchData('PAULO AFONSO', remotePA, todayStr, {
        preserveLocalUnsentCounts: statusPA.preserveLocalUnsentCounts,
        applyToActiveState: targetBranch === 'PAULO AFONSO',
      });
    }
    if (remoteDEL && (user.roleLevel === 'master' || targetBranch === 'DELMIRO')) {
      applyRemoteBranchData('DELMIRO', remoteDEL, todayStr, {
        preserveLocalUnsentCounts: statusDEL.preserveLocalUnsentCounts,
        applyToActiveState: targetBranch === 'DELMIRO',
      });
    }

    // Garante carregamento local completo da base alvo (especialmente se remote for nulo),
    // impedindo que estados residuais da base anterior permaneçam ativos em tela
    const activeRemote = targetBranch === 'PAULO AFONSO' ? remotePA : remoteDEL;
    if (!activeRemote) {
      loadBranchLocalStateIntoActive(targetBranch, todayStr, {
        includeCatalogs: true,
        includeConfigs: true,
        updateStatusMap: true,
      });
    } else {
      setLogs(loadInitialBranchData(targetBranch, 'logs', INITIAL_LOGS, []));
      const branchEmailSettings = activeRemote.emailSettings || loadInitialBranchData(targetBranch, 'email_settings', INITIAL_EMAIL_SETTINGS, [STORAGE_KEYS.EMAIL_SETTINGS]);
      const branchServerConfig = activeRemote.serverEmailConfig || loadInitialBranchData(targetBranch, 'server_email_config', INITIAL_SERVER_EMAIL_CONFIG, [STORAGE_KEYS.SERVER_EMAIL_CONFIG]);
      const branchRecipients = activeRemote.emailRecipients ?? (localStorage.getItem(getBranchStorageKey(targetBranch, 'recipients_text')) ?? branchEmailSettings.emails.join(', '));
      setEmailSettings(branchEmailSettings);
      setServerEmailConfig(branchServerConfig);
      setRecipientsTextState(branchRecipients);
    }

    if (user.roleLevel === 'master') {
      const otherBranch: UnitBranch = targetBranch === 'PAULO AFONSO' ? 'DELMIRO' : 'PAULO AFONSO';
      const otherRemote = otherBranch === 'PAULO AFONSO' ? remotePA : remoteDEL;
      if (!otherRemote) {
        updateBranchStatusMap(otherBranch, readBranchInitialStatus(otherBranch));
      }
    }

    if (user.roleLevel === 'contador') {
      const targetStatus = targetBranch === 'PAULO AFONSO' ? statusPA : statusDEL;
      if (targetStatus.isCountInProgress || targetStatus.recontagemUnlocked) {
        // Contador retomando contagem já iniciada ou realizando recontagem liberada
        const resumedSession: ContadorSession = {
          userId: user.id,
          userName: user.name,
          registration: user.registration,
          loginTime: targetStatus.activeSession?.loginTime || Date.now(),
          lastHeartbeat: Date.now(),
        };
        setActiveContadorSession(resumedSession);
        localStorage.setItem(getBranchStorageKey(targetBranch, 'active_contador_session'), JSON.stringify(resumedSession));
        updateBranchStatusMap(targetBranch, prev => ({ ...prev, activeContadorSession: resumedSession }));
      } else {
        // Enquanto nada foi inserido, não ativa sessão bloqueadora nem envia ao Firebase
        setActiveContadorSession(null);
        localStorage.removeItem(getBranchStorageKey(targetBranch, 'active_contador_session'));
        updateBranchStatusMap(targetBranch, prev => ({ ...prev, activeContadorSession: null, countStartedBy: null, hasCounts: false }));
      }
      broadcastSync('SESSION_UPDATE');
    }

    const syncTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    localStorage.removeItem('choppstock_pending_master_sync');
    if (user.roleLevel === 'master') {
      setPendingSyncPA(false);
      setPendingSyncDEL(false);
      setPendingUsersSync(false);
      localStorage.removeItem(getBranchStorageKey('PAULO AFONSO', 'pending_master_sync'));
      localStorage.removeItem(getBranchStorageKey('DELMIRO', 'pending_master_sync'));
      localStorage.removeItem('choppstock_pending_users_sync');
    } else {
      localStorage.removeItem(getBranchStorageKey(targetBranch, 'pending_master_sync'));
      if (targetBranch === 'PAULO AFONSO') {
        setPendingSyncPA(false);
      } else {
        setPendingSyncDEL(false);
      }
    }
    setLastFirebaseSyncAt(syncTime);
    localStorage.setItem('choppstock_last_firebase_sync_at', syncTime);

    setActiveUserState(user);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));

    setTimeout(() => {
      isSwitchingBranchRef.current = false;
    }, 150);

    addLog({
      type: 'contagem',
      targetType: 'usuario',
      itemCode: user.registration,
      title: `Login Realizado: ${user.name} [Base: ${targetBranch}]`,
      description: `Acesso iniciado como ${user.roleLevel === 'master' ? '1 - Master' : '2 - Contador'} na base ${targetBranch} com dados sincronizados do Firebase.`
    });

    // EXIGÊNCIA: Ao logar com o usuário Master, caso tenha equipamentos com código vazio no cadastro da base,
    // exibir janela de aviso com a informação: "Existe(m) equipamento(s) sem código(s) no cadastro, favor verificar."
    if (user.roleLevel === 'master') {
      const isUnregCode = (c?: string) => !c || c.trim() === '' || c.trim() === '0' || c.toUpperCase() === 'PROV' || c.toUpperCase().startsWith('PROV-');
      const branchFrzs = loadInitialBranchData(targetBranch, 'freezers', INITIAL_FREEZERS, [STORAGE_KEYS.FREEZERS]);
      const branchEqs = loadInitialBranchData(targetBranch, 'equipments', INITIAL_EQUIPMENTS, [STORAGE_KEYS.EQUIPMENTS]);
      const hasEmptyEquipCode = branchFrzs.some(f => isUnregCode(f.code)) || branchEqs.some(e => isUnregCode(e.code));
      if (hasEmptyEquipCode) {
        setEmptyMaterialCodesAlert('Existe(m) equipamento(s) sem código(s) no cadastro, favor verificar.');
      } else {
        setEmptyMaterialCodesAlert(null);
      }
    } else {
      setEmptyMaterialCodesAlert(null);
    }

    return { success: true };
  };

  const logout = () => {
    const wasCoringa = isCoringaUser(activeUser);
    if (!wasCoringa && activeUser?.roleLevel === 'contador') {
      setActiveContadorSession(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'active_contador_session'));
      updateBranchStatusMap(activeBranch, prev => ({ ...prev, activeContadorSession: null }));
      broadcastSync('SESSION_UPDATE');
    }
    setSystemNotice(null);
    setEmptyMaterialCodesAlert(null);
    setActiveUserState(null);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    if (wasCoringa) {
      // Restaura lista de usuários reais e base real padrão ao sair do modo Coringa
      const prodUsers = loadProductionUsersFromStorage();
      usersRef.current = prodUsers;
      setUsers(prodUsers);
      activeBranchRef.current = 'PAULO AFONSO';
      setActiveBranchState('PAULO AFONSO');
      localStorage.setItem('choppstock_active_branch', 'PAULO AFONSO');
    }
  };

  const clearContadorSession = (targetBranchChoice?: UnitBranch) => {
    const b = targetBranchChoice || activeBranch;
    setActiveContadorSession(null);
    localStorage.removeItem(getBranchStorageKey(b, 'active_contador_session'));
    updateBranchStatusMap(b, prev => ({ ...prev, activeContadorSession: null }));
    if (isMaster) markMasterChangesPending();
    broadcastSync('SESSION_UPDATE');
  };

  const setActiveUser = (user: StockUser | null) => {
    setActiveUserState(user);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    }
  };

  // --- CRUD MATERIAIS ---
  const addMaterial = (itemData: Omit<MaterialItem, 'id' | 'createdAt'>) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const newMat: MaterialItem = {
      ...itemData,
      id: 'mat-' + Date.now(),
      createdAt: formatDateBR(todayKey),
    };
    setMaterials(prev => {
      const updated = [newMat, ...prev];
      localStorage.setItem(getBranchStorageKey(activeBranch, 'materials'), JSON.stringify(updated));
      if (isMaster) markMasterChangesPending();
      broadcastSync('BASE_UPDATED');
      return updated;
    });
    addLog({
      type: 'inclusao',
      targetType: 'material',
      itemCode: newMat.code,
      title: `Material Cadastrado: [${newMat.code}]`,
      description: `${newMat.name} incluído no catálogo.`
    });
  };

  const updateMaterial = (updatedItem: MaterialItem) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    setMaterials(prev => {
      const updated = prev.map(m => m.id === updatedItem.id ? updatedItem : m);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'materials'), JSON.stringify(updated));
      if (isMaster) markMasterChangesPending();
      broadcastSync('BASE_UPDATED');
      return updated;
    });
    addLog({
      type: 'edicao',
      targetType: 'material',
      itemCode: updatedItem.code,
      title: `Material Editado: [${updatedItem.code}]`,
      description: `Cadastro de ${updatedItem.name} atualizado.`
    });
  };

  const deleteMaterial = (id: string) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const item = materials.find(m => m.id === id);

    // 1. Remove de materials da base estritamente pelo id único
    setMaterials(prev => {
      const updated = prev.filter(m => m.id !== id);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'materials'), JSON.stringify(updated));
      return updated;
    });

    // 2. Limpa contagem desse item
    setMaterialCounts(prev => {
      const updated = { ...prev };
      delete updated[id];
      if (item) delete updated[item.id];
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify(updated));
      return updated;
    });

    // 3. Limpa logs referentes a esse item
    if (item) {
      setLogs(prev => {
        const updated = prev.filter(l =>
          l.itemCode !== item.id &&
          !l.description.includes(item.name)
        );
        localStorage.setItem(getBranchStorageKey(activeBranch, 'logs'), JSON.stringify(updated));
        return updated;
      });
    }

    if (isMaster) markMasterChangesPending();
    broadcastSync('BASE_UPDATED');
    broadcastSync('ALL_SYNC');
  };

  // --- CRUD FREEZERS ---
  const addFreezer = (itemData: Omit<FreezerItem, 'id' | 'createdAt'>) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const newFrz: FreezerItem = {
      ...itemData,
      id: 'frz-' + Date.now(),
      createdAt: formatDateBR(todayKey),
    };
    setFreezers(prev => {
      const updated = [newFrz, ...prev];
      localStorage.setItem(getBranchStorageKey(activeBranch, 'freezers'), JSON.stringify(updated));
      if (isMaster) markMasterChangesPending();
      broadcastSync('BASE_UPDATED');
      return updated;
    });
    addLog({
      type: 'inclusao',
      targetType: 'freezer',
      itemCode: newFrz.code,
      title: `Freezer Cadastrado: [${newFrz.code}]`,
      description: `${newFrz.name} (Patrimônio: ${newFrz.patrimony}) adicionado ao catálogo.`
    });
    return newFrz;
  };

  const updateFreezer = (updatedItem: FreezerItem) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    setFreezers(prev => {
      const updated = prev.map(f => f.id === updatedItem.id ? updatedItem : f);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'freezers'), JSON.stringify(updated));
      if (isMaster) markMasterChangesPending();
      broadcastSync('BASE_UPDATED');
      return updated;
    });

    // Se o item possuir contagem ativa, sincroniza o status com o defeito atualizado
    setEquipmentCounts(prev => {
      if (!prev[updatedItem.id]) return prev;
      const updated = {
        ...prev,
        [updatedItem.id]: {
          ...prev[updatedItem.id],
          status: updatedItem.defect?.trim() ? ('danificado' as const) : ('disponivel' as const),
          damageDescription: updatedItem.defect?.trim() || undefined,
        }
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
      return updated;
    });

    addLog({
      type: 'edicao',
      targetType: 'freezer',
      itemCode: updatedItem.code,
      title: `Freezer Editado: [${updatedItem.code}]`,
      description: `Dados de ${updatedItem.name} atualizados.`
    });
  };

  const deleteFreezer = (id: string) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const item = freezers.find(f => f.id === id);

    // 1. Remove de freezers da base estritamente pelo ID
    setFreezers(prev => {
      const updated = prev.filter(f => f.id !== id);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'freezers'), JSON.stringify(updated));
      return updated;
    });

    // 2. Limpa qualquer contagem desse item
    setEquipmentCounts(prev => {
      const updated = { ...prev };
      delete updated[id];
      if (item) {
        delete updated[item.id];
        delete updated[item.patrimony];
      }
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
      return updated;
    });

    // 3. Remove de uncatalogued caso existisse
    setUncataloguedEquipments(prev => {
      const updated = prev.filter(u => u.id !== id && (!item || u.patrimony.toUpperCase() !== item.patrimony.toUpperCase()));
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(updated));
      return updated;
    });

    // 4. Limpa histórico de logs desse item
    if (item) {
      setLogs(prev => {
        const updated = prev.filter(l =>
          !l.description.includes(item.patrimony)
        );
        localStorage.setItem(getBranchStorageKey(activeBranch, 'logs'), JSON.stringify(updated));
        return updated;
      });
    }

    if (isMaster) markMasterChangesPending();
    broadcastSync('BASE_UPDATED');
    broadcastSync('ALL_SYNC');
  };

  // --- CRUD EQUIPAMENTOS (CHOPEIRAS) ---
  const addEquipment = (itemData: Omit<EquipmentItem, 'id' | 'createdAt'>) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const newEq: EquipmentItem = {
      ...itemData,
      id: 'eq-' + Date.now(),
      createdAt: formatDateBR(todayKey),
    };
    setEquipments(prev => {
      const updated = [newEq, ...prev];
      localStorage.setItem(getBranchStorageKey(activeBranch, 'equipments'), JSON.stringify(updated));
      if (isMaster) markMasterChangesPending();
      broadcastSync('BASE_UPDATED');
      return updated;
    });
    addLog({
      type: 'inclusao',
      targetType: 'equipamento',
      itemCode: newEq.code,
      title: `Chopeira Cadastrada: [${newEq.code}]`,
      description: `${newEq.name} (Patrimônio: ${newEq.patrimony}) adicionada ao catálogo.`
    });
    return newEq;
  };

  const updateEquipment = (updatedItem: EquipmentItem) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    setEquipments(prev => {
      const updated = prev.map(e => e.id === updatedItem.id ? updatedItem : e);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'equipments'), JSON.stringify(updated));
      if (isMaster) markMasterChangesPending();
      broadcastSync('BASE_UPDATED');
      return updated;
    });

    // Se o item possuir contagem ativa, sincroniza o status com o defeito atualizado
    setEquipmentCounts(prev => {
      if (!prev[updatedItem.id]) return prev;
      const updated = {
        ...prev,
        [updatedItem.id]: {
          ...prev[updatedItem.id],
          status: updatedItem.defect?.trim() ? ('danificado' as const) : ('disponivel' as const),
          damageDescription: updatedItem.defect?.trim() || undefined,
        }
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
      return updated;
    });

    addLog({
      type: 'edicao',
      targetType: 'equipamento',
      itemCode: updatedItem.code,
      title: `Chopeira Editada: [${updatedItem.code}]`,
      description: `Dados de ${updatedItem.name} atualizados.`
    });
  };

  const deleteEquipment = (id: string) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const item = equipments.find(e => e.id === id);

    // 1. Remove de equipments da base estritamente pelo ID
    setEquipments(prev => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'equipments'), JSON.stringify(updated));
      return updated;
    });

    // 2. Limpa qualquer contagem desse item
    setEquipmentCounts(prev => {
      const updated = { ...prev };
      delete updated[id];
      if (item) {
        delete updated[item.id];
        delete updated[item.patrimony];
      }
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
      return updated;
    });

    // 3. Remove de uncatalogued caso existisse
    setUncataloguedEquipments(prev => {
      const updated = prev.filter(u => u.id !== id && (!item || u.patrimony.toUpperCase() !== item.patrimony.toUpperCase()));
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify(updated));
      return updated;
    });

    // 4. Limpa histórico de logs
    if (item) {
      setLogs(prev => {
        const updated = prev.filter(l =>
          !l.description.includes(item.patrimony)
        );
        localStorage.setItem(getBranchStorageKey(activeBranch, 'logs'), JSON.stringify(updated));
        return updated;
      });
    }

    if (isMaster) markMasterChangesPending();
    broadcastSync('BASE_UPDATED');
    broadcastSync('ALL_SYNC');
  };

  // --- CRUD USUÁRIOS (COM SENHA PERSISTIDA E ISOLAMENTO NO MODO TESTE CORINGA) ---
  const addUser = (userData: Omit<StockUser, 'id' | 'createdAt'>) => {
    if (isCoringa) return;
    if (isMaster && isAnyBaseCountInProgress) return;

    const now = new Date();
    const dateFormatted = formatDateBR(todayKey);
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const masterName = activeUser?.name || 'Administrador Master';
    const createdAtStr = `${masterName} - ${dateFormatted} às ${timeFormatted}`;

    const safeUserData = isCoringa
      ? {
          ...userData,
          branch: userData.roleLevel === 'contador' ? toTestBranch(userData.branch) : undefined,
        }
      : {
          ...userData,
          branch: userData.roleLevel === 'contador' ? normalizeProductionBranch(userData.branch) : undefined,
        };

    const newUser: StockUser = {
      ...safeUserData,
      id: 'usr-' + Date.now(),
      createdAt: createdAtStr,
    };
    setUsers(prev => {
      const updated = [newUser, ...prev];
      usersRef.current = updated;
      localStorage.setItem(isCoringa ? TEST_USERS_STORAGE_KEY : STORAGE_KEYS.USERS, JSON.stringify(updated));
      if (isMaster) markMasterChangesPending('USERS');
      broadcastSync('USERS_UPDATED');
      return updated;
    });
    addLog({
      type: 'inclusao',
      targetType: 'usuario',
      itemCode: newUser.registration,
      title: `Usuário Cadastrado: [${newUser.registration}]`,
      description: `${newUser.name} (${newUser.roleLevel === 'master' ? '1-Master' : '2-Contador'}) cadastrado por ${masterName}.`
    });
  };

  const updateUser = (updatedUser: StockUser) => {
    if (isMaster && isAnyBaseCountInProgress) return;
    if (isCoringaUser(updatedUser)) return; // Protege o usuário sistema CORINGA contra edição

    const normalizedUser = isCoringa
      ? {
          ...updatedUser,
          branch: updatedUser.roleLevel === 'contador' ? toTestBranch(updatedUser.branch) : undefined,
        }
      : {
          ...updatedUser,
          branch: updatedUser.roleLevel === 'contador' ? normalizeProductionBranch(updatedUser.branch) : undefined,
        };

    setUsers(prev => {
      const updated = prev.map(u => u.id === normalizedUser.id ? normalizedUser : u);
      usersRef.current = updated;
      localStorage.setItem(isCoringa ? TEST_USERS_STORAGE_KEY : STORAGE_KEYS.USERS, JSON.stringify(updated));
      if (isMaster) markMasterChangesPending('USERS');
      broadcastSync('USERS_UPDATED');
      return updated;
    });
    if (activeUser && activeUser.id === normalizedUser.id) {
      setActiveUserState(normalizedUser);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(normalizedUser));
    }
    addLog({
      type: 'edicao',
      targetType: 'usuario',
      itemCode: normalizedUser.registration,
      title: `Usuário Editado: [${normalizedUser.registration}]`,
      description: `Dados de ${normalizedUser.name} atualizados.`
    });
  };

  const deleteUser = (id: string) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const user = users.find(u => u.id === id);
    if (!user || isCoringaUser(user)) return;

    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem(isCoringa ? TEST_USERS_STORAGE_KEY : STORAGE_KEYS.USERS, JSON.stringify(updated));
      if (isMaster) markMasterChangesPending('USERS');
      broadcastSync('USERS_UPDATED');
      return updated;
    });

    if (activeUser && activeUser.id === id) {
      setActiveUserState(null);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
    }

    if (activeContadorSession && (activeContadorSession.userId === id || activeContadorSession.registration === user.registration)) {
      setActiveContadorSession(null);
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_CONTADOR_SESSION);
      broadcastSync('SESSION_UPDATE');
    }

    // Limpa quaisquer sessões do usuário apenas nas respectivas bases (nunca toca bases reais em Modo Teste)
    const branchesToClean = isCoringa ? TEST_BRANCHES : REAL_BRANCHES;
    branchesToClean.forEach(b => {
      const branchSessionKey = getBranchStorageKey(b, 'active_contador_session');
      try {
        const stored = localStorage.getItem(branchSessionKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.userId === id || parsed.registration === user.registration)) {
            localStorage.removeItem(branchSessionKey);
          }
        }
      } catch {}
    });

    addLog({
      type: 'exclusao',
      targetType: 'usuario',
      itemCode: user.registration,
      title: `Usuário Excluído: [${user.registration}]`,
      description: `${user.name} removido do sistema com todas as suas informações.`
    });
  };

  // --- OPÇÕES DE ENVIO / E-MAILS (100% INDEPENDENTES POR BASE) ---
  const updateEmailSettings = (settings: EmailSettings) => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) return;

    setEmailSettings(settings);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(settings));
    if (isMaster) markMasterChangesPending();
    broadcastSync('EMAIL_UPDATED');
    addLog({
      type: 'edicao',
      targetType: 'contagem',
      itemCode: 'EMAIL-CFG',
      title: `Configurações de E-mail Atualizadas [${activeBranch}]`,
      description: `E-mail padrão: ${settings.defaultEmail}. Total: ${settings.emails.length}. Base: ${activeBranch}`
    });
  };

  const addEmail = (email: string) => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) return;

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || emailSettings.emails.includes(trimmed)) return;
    const newEmails = [...emailSettings.emails, trimmed];
    const newSettings = {
      emails: newEmails,
      defaultEmail: emailSettings.defaultEmail || trimmed,
    };
    setEmailSettings(newSettings);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(newSettings));
    const newRecipientsText = newEmails.join(', ');
    setRecipientsTextState(newRecipientsText);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recipients_text'), newRecipientsText);
    if (isMaster) markMasterChangesPending();
    broadcastSync('EMAIL_UPDATED');
  };

  const removeEmail = (email: string) => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) return;

    const filtered = emailSettings.emails.filter(e => e !== email);
    const newDefault = emailSettings.defaultEmail === email
      ? (filtered.length > 0 ? filtered[0] : '')
      : emailSettings.defaultEmail;
    const newSettings = {
      emails: filtered,
      defaultEmail: newDefault,
    };
    setEmailSettings(newSettings);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(newSettings));
    const newRecipientsText = filtered.join(', ');
    setRecipientsTextState(newRecipientsText);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recipients_text'), newRecipientsText);
    if (isMaster) markMasterChangesPending();
    broadcastSync('EMAIL_UPDATED');
  };

  const setDefaultEmail = (email: string) => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) return;

    setEmailSettings(prev => {
      const updated = {
        ...prev,
        defaultEmail: email,
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(updated));
      return updated;
    });

    setServerEmailConfig(prev => {
      const updated = {
        ...prev,
        senderEmail: email,
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'server_email_config'), JSON.stringify(updated));
      return updated;
    });

    if (isMaster) markMasterChangesPending();
    broadcastSync('EMAIL_UPDATED');
  };

  const updateServerEmailConfig = (config: ServerEmailConfig) => {
    if (isMaster && (isContadorActive || isAnyBaseCountInProgress)) return;

    setServerEmailConfig(config);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'server_email_config'), JSON.stringify(config));

    // Sincroniza também com o defaultEmail das configurações de email da base ativa
    if (config.senderEmail !== undefined) {
      setEmailSettings(prev => {
        const updated = {
          ...prev,
          defaultEmail: config.senderEmail,
        };
        localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(updated));
        return updated;
      });
    }

    if (isMaster) markMasterChangesPending();
    broadcastSync('EMAIL_UPDATED');
    addLog({
      type: 'edicao',
      targetType: 'contagem',
      itemCode: 'SRV-CFG',
      title: `Configurações de E-mail do Servidor Atualizadas [${activeBranch}]`,
      description: `Remetente padrão: ${config.senderEmail} (${config.smtpHost}:${config.smtpPort} / ${config.popHost}:${config.popPort}). Status: ${config.communicationStatus || 'Ok'}. Base: ${activeBranch}`
    });
  };

  // Importação em massa de itens na base (Substituir ou Acrescentar conforme escolha)
  const importBaseItems = (
    data: { materials?: MaterialItem[]; freezers?: FreezerItem[]; equipments?: EquipmentItem[] },
    mode: 'replace' | 'append' = 'replace',
    targetStock?: 'materiais' | 'equipamentos' | 'ambos',
    targetBranch?: UnitBranch
  ) => {
    const rawBranch = targetBranch || activeBranch;
    const branchToUse = isCoringa ? toTestBranch(rawBranch) : rawBranch;
    const isTargetBranchInProgress = !isCoringa && checkBranchInProgress(branchToUse);
    if (isMaster && isTargetBranchInProgress) {
      return { materialsAdded: 0, freezersAdded: 0, equipmentsAdded: 0, message: 'Existe contagem em andamento.' };
    }

    if (branchToUse !== activeBranch) {
      setActiveBranch(branchToUse);
    }

    const incomingMaterials = data.materials ? [...data.materials] : [];
    const incomingFreezers = data.freezers ? [...data.freezers] : [];
    const incomingEquipments = data.equipments ? [...data.equipments] : [];

    const hasMaterials = incomingMaterials.length > 0;
    const hasEquipments = incomingFreezers.length > 0 || incomingEquipments.length > 0;

    const effectiveStock: 'materiais' | 'equipamentos' | 'ambos' = targetStock
      || (hasMaterials && hasEquipments ? 'ambos' : hasMaterials ? 'materiais' : 'equipamentos');

    let finalMaterials: MaterialItem[] = branchToUse === activeBranch ? [...materials] : loadInitialBranchData<MaterialItem[]>(branchToUse, 'materials', []);
    let finalFreezers: FreezerItem[] = branchToUse === activeBranch ? [...freezers] : loadInitialBranchData<FreezerItem[]>(branchToUse, 'freezers', []);
    let finalEquipments: EquipmentItem[] = branchToUse === activeBranch ? [...equipments] : loadInitialBranchData<EquipmentItem[]>(branchToUse, 'equipments', []);

    if (mode === 'replace') {
      // EXIGÊNCIA 7: caso seja selecionado o botão "SUBSTITUIR A BASE", toda o cadastro da base do tipo de estoque selecionado será limpo, adicionando todas as informações novas do arquivo importado.
      if (effectiveStock === 'materiais' || effectiveStock === 'ambos') {
        finalMaterials = incomingMaterials;
        setMaterialCounts({});
        localStorage.removeItem(getBranchStorageKey(branchToUse, 'today_materials'));
      }
      if (effectiveStock === 'equipamentos' || effectiveStock === 'ambos') {
        finalFreezers = incomingFreezers;
        finalEquipments = incomingEquipments;
        setEquipmentCounts({});
        setUncataloguedEquipments([]);
        localStorage.removeItem(getBranchStorageKey(branchToUse, 'today_equipments'));
        localStorage.removeItem(getBranchStorageKey(branchToUse, 'today_uncatalogued'));
      }
      const remainingMats = (effectiveStock === 'materiais' || effectiveStock === 'ambos')
        ? false
        : Object.values(materialCounts).some(hasMaterialEntryQuantity);
      const remainingEqs = (effectiveStock === 'equipamentos' || effectiveStock === 'ambos')
        ? false
        : (Object.keys(equipmentCounts).length > 0 || uncataloguedEquipments.length > 0);
      if (!remainingMats && !remainingEqs) {
        setCountStartedBy(null);
        setRecontagemTargetContador(null);
        setActiveContadorSession(null);
        setIsReportSent(false);
        setRecontagemUnlocked(false);
        localStorage.removeItem(getBranchStorageKey(branchToUse, 'count_started_by'));
        localStorage.removeItem(getBranchStorageKey(branchToUse, 'recontagem_target_contador'));
        localStorage.removeItem(getBranchStorageKey(branchToUse, 'active_contador_session'));
        localStorage.setItem(getBranchStorageKey(branchToUse, 'is_report_sent'), JSON.stringify(false));
        localStorage.setItem(getBranchStorageKey(branchToUse, 'recontagem_unlocked'), JSON.stringify(false));
        updateBranchStatusMap(branchToUse, {
          countStartedBy: null,
          recontagemTargetContador: null,
          isReportSent: false,
          recontagemUnlocked: false,
          activeContadorSession: null,
          hasCounts: false,
        });
      }
    } else {
      // mode === 'append'
      if (effectiveStock === 'materiais' || effectiveStock === 'ambos') {
        // EXIGÊNCIA: Aceitar cadastro de materiais com códigos iguais na base
        const key = (m: MaterialItem) => `${(m.code || '').trim().toUpperCase()}|${(m.name || '').trim().toUpperCase()}|${(m.subOption || '').trim().toUpperCase()}`;
        const existingKeys = new Set(finalMaterials.map(key));
        const toAdd = incomingMaterials.filter(m => !existingKeys.has(key(m)));
        finalMaterials = [...finalMaterials, ...toAdd];
      }

      if (effectiveStock === 'equipamentos' || effectiveStock === 'ambos') {
        const frzMap = new Map<string, FreezerItem>();
        finalFreezers.forEach(f => frzMap.set(f.patrimony.toUpperCase().trim(), f));
        incomingFreezers.forEach(f => {
          frzMap.set(f.patrimony.toUpperCase().trim(), f);
        });
        finalFreezers = Array.from(frzMap.values());

        const eqMap = new Map<string, EquipmentItem>();
        finalEquipments.forEach(eq => eqMap.set(eq.patrimony.toUpperCase().trim(), eq));
        incomingEquipments.forEach(eq => {
          eqMap.set(eq.patrimony.toUpperCase().trim(), eq);
        });
        finalEquipments = Array.from(eqMap.values());
      }
    }

    setMaterials(finalMaterials);
    setFreezers(finalFreezers);
    setEquipments(finalEquipments);

    localStorage.setItem(getBranchStorageKey(branchToUse, 'materials'), JSON.stringify(finalMaterials));
    localStorage.setItem(getBranchStorageKey(branchToUse, 'freezers'), JSON.stringify(finalFreezers));
    localStorage.setItem(getBranchStorageKey(branchToUse, 'equipments'), JSON.stringify(finalEquipments));
    if (isMaster) markMasterChangesPending(branchToUse);
    broadcastSync('BASE_UPDATED');

    const mCount = incomingMaterials.length;
    const fCount = incomingFreezers.length;
    const eqCount = incomingEquipments.length;

    addLog({
      type: 'inclusao',
      targetType: effectiveStock === 'materiais' ? 'material' : 'equipamento',
      itemCode: 'IMPORT',
      title: mode === 'replace' ? 'Importação e Substituição da Base' : 'Importação e Acréscimo à Base',
      description: mode === 'replace'
        ? `Base de ${effectiveStock} substituída com sucesso pelo arquivo importado (${finalMaterials.length} materiais, ${finalFreezers.length} freezers, ${finalEquipments.length} chopeiras).`
        : `Itens acrescentados à base de ${effectiveStock}: ${mCount} materiais, ${fCount} freezers e ${eqCount} chopeiras processados.`,
    });

    const summaryMsg = mode === 'replace'
      ? `Base de ${effectiveStock} substituída com sucesso: ${finalMaterials.length} materiais, ${finalFreezers.length} freezers e ${finalEquipments.length} chopeiras cadastrados.`
      : `Base de ${effectiveStock} enriquecida com sucesso! Total atual: ${finalMaterials.length} materiais, ${finalFreezers.length} freezers e ${finalEquipments.length} chopeiras.`;

    return { materialsAdded: mCount, freezersAdded: fCount, equipmentsAdded: eqCount, message: summaryMsg };
  };

  const clearSelectedData = (
    stock: 'materiais' | 'equipamentos' | 'ambos',
    branchTarget: UnitBranch | 'AMBAS' = activeBranch
  ): { success: boolean; message?: string } => {
    if (isMaster && !isCoringa) {
      const blocked = branchTarget === 'AMBAS'
        ? (isCountInProgressPA || isCountInProgressDEL)
        : checkBranchInProgress(branchTarget);
      if (blocked) {
        return { success: false, message: 'Existe contagem em andamento.' };
      }
    }

    const effectiveBranchList: UnitBranch[] = branchTarget === 'AMBAS'
      ? (isCoringa ? [...TEST_BRANCHES] : [...REAL_BRANCHES])
      : [isCoringa ? toTestBranch(branchTarget) : branchTarget];

    effectiveBranchList.forEach(branch => {
      // Garantia extra: CORINGA jamais altera bases reais
      if (isCoringa && !isTestBranch(branch)) return;

      // Remove prévia congelada para que a Prévia do Relatório atualize automaticamente
      localStorage.removeItem(getBranchStorageKey(branch, 'frozen_report'));
      if (branch === activeBranch) {
        setFrozenReportText(null);
      }

      if (stock === 'materiais' || stock === 'ambos') {
        localStorage.setItem(getBranchStorageKey(branch, 'materials'), JSON.stringify([]));
        if (branch === activeBranch) {
          setMaterials([]);
        }
      }

      if (stock === 'equipamentos' || stock === 'ambos') {
        localStorage.setItem(getBranchStorageKey(branch, 'freezers'), JSON.stringify([]));
        localStorage.setItem(getBranchStorageKey(branch, 'equipments'), JSON.stringify([]));
        localStorage.setItem(getBranchStorageKey(branch, 'today_uncatalogued'), JSON.stringify([]));
        if (branch === activeBranch) {
          setFreezers([]);
          setEquipments([]);
          setUncataloguedEquipments([]);
        }
      }
    });

    const stockLabel =
      stock === 'materiais'
        ? 'Materiais'
        : stock === 'equipamentos'
          ? 'Equipamentos'
          : 'Materiais e Equipamentos';
    const branchLabel = branchTarget === 'AMBAS'
      ? (isCoringa ? 'PAULO AFONSO (TESTE) e DELMIRO (TESTE)' : 'PAULO AFONSO e DELMIRO')
      : (isCoringa ? toTestBranch(branchTarget) : branchTarget);

    addLog({
      type: 'exclusao',
      targetType: stock === 'materiais' ? 'material' : stock === 'equipamentos' ? 'equipamento' : 'contagem',
      itemCode: 'ZERAR',
      title: `Cadastros Zerados (${stockLabel})`,
      description: `Cadastro de ${stockLabel} zerado na base ${branchLabel}.`,
    });

    if (isMaster) markMasterChangesPending(branchTarget);
    broadcastSync('BASE_UPDATED');
    return { success: true };
  };

  const clearAllData = () => {
    clearSelectedData('ambos', activeBranch);
  };

  // --- GESTÃO DE RECONTAGEM (100% INDEPENDENTE POR BASE) ---
  const toggleRecontagemItem = (id: string) => {
    if (isMaster && (recontagemUnlocked || isAnyBaseCountInProgress)) return;
    setRecontagemSelectedIds(prev => {
      const isNowSelected = !prev[id];
      const updated = { ...prev, [id]: isNowSelected };
      if (!isNowSelected) {
        delete updated[id];
        setRecontagemEquipmentCounts(eqPrev => {
          const eqUpdated = { ...eqPrev };
          delete eqUpdated[id];
          localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify(eqUpdated));
          return eqUpdated;
        });
        setRecontagemMaterialCounts(mPrev => {
          const mUpdated = { ...mPrev };
          delete mUpdated[id];
          localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify(mUpdated));
          return mUpdated;
        });
      } else {
        // EXIGÊNCIA: Quando selecionado para recontagem, NENHUM dos 2 botões de equipamento pode aparecer já selecionado
        setRecontagemEquipmentCounts(eqPrev => {
          const eqUpdated = { ...eqPrev };
          if (eqUpdated[id]) {
            delete (eqUpdated[id] as any).status;
            delete (eqUpdated[id] as any).damageDescription;
          }
          localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify(eqUpdated));
          return eqUpdated;
        });
      }
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify(updated));
      broadcastSync('RECONTAGEM_UPDATED');
      return updated;
    });
  };

  const setRecontagemItem = (id: string, selected: boolean) => {
    if (isMaster && (recontagemUnlocked || isAnyBaseCountInProgress)) return;
    setRecontagemSelectedIds(prev => {
      const updated = { ...prev };
      if (selected) {
        updated[id] = true;
        setRecontagemEquipmentCounts(eqPrev => {
          const eqUpdated = { ...eqPrev };
          if (eqUpdated[id]) {
            delete (eqUpdated[id] as any).status;
            delete (eqUpdated[id] as any).damageDescription;
          }
          localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify(eqUpdated));
          return eqUpdated;
        });
      } else {
        delete updated[id];
        setRecontagemEquipmentCounts(eqPrev => {
          const eqUpdated = { ...eqPrev };
          delete eqUpdated[id];
          localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify(eqUpdated));
          return eqUpdated;
        });
        setRecontagemMaterialCounts(mPrev => {
          const mUpdated = { ...mPrev };
          delete mUpdated[id];
          localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify(mUpdated));
          return mUpdated;
        });
      }
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify(updated));
      broadcastSync('RECONTAGEM_UPDATED');
      return updated;
    });
  };

  const selectAllRecontagem = (type: 'materiais' | 'equipamentos' | 'all') => {
    if (isMaster && (recontagemUnlocked || isAnyBaseCountInProgress)) return;
    setRecontagemSelectedIds(prev => {
      const updated = { ...prev };
      if (type === 'materiais' || type === 'all') {
        materials.forEach(m => {
          const count = materialCounts[m.id];
          const hasCount = count && (
            (count.disponivel || 0) > 0 ||
            (count.danificado || 0) > 0 ||
            (count.barrilCheio || 0) > 0 ||
            (count.barrilVazio || 0) > 0 ||
            (count.barrilEmRota || 0) > 0 ||
            (count.co2Cheio || 0) > 0 ||
            (count.co2Mexido || 0) > 0 ||
            (count.co2Vazio || 0) > 0 ||
            (count.co2EmRota || 0) > 0
          );
          if (hasCount) {
            updated[m.id] = true;
          }
        });
      }
      if (type === 'equipamentos' || type === 'all') {
        freezers.forEach(f => {
          if (equipmentCounts[f.id]?.status) {
            updated[f.id] = true;
          }
        });
        equipments.forEach(eq => {
          if (equipmentCounts[eq.id]?.status) {
            updated[eq.id] = true;
          }
        });
      }
      // Garante que nenhum equipamento selecionado venha com botões pré-marcados
      setRecontagemEquipmentCounts(eqPrev => {
        const eqUpdated = { ...eqPrev };
        Object.keys(updated).forEach(id => {
          if (eqUpdated[id]) {
            delete (eqUpdated[id] as any).status;
            delete (eqUpdated[id] as any).damageDescription;
          }
        });
        localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify(eqUpdated));
        return eqUpdated;
      });

      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify(updated));
      broadcastSync('RECONTAGEM_UPDATED');
      return updated;
    });
  };

  const clearAllRecontagem = () => {
    if (isMaster && (recontagemUnlocked || isAnyBaseCountInProgress)) return;
    setRecontagemSelectedIds({});
    setRecontagemMaterialCounts({});
    setRecontagemEquipmentCounts({});
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify({}));
    broadcastSync('RECONTAGEM_UPDATED');
  };

  const updateRecontagemMaterialCount = (itemId: string, data: Partial<MaterialDailyEntry>) => {
    if (!canActiveUserRecount) return;
    setRecontagemMaterialCounts(prev => {
      const current = prev[itemId] || { itemId, disponivel: 0, danificado: 0 };
      const updated = {
        ...prev,
        [itemId]: { ...current, ...data, itemId }
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify(updated));
      broadcastSync('RECONTAGEM_COUNT_UPDATED');
      return updated;
    });
  };

  const updateRecontagemEquipmentCount = (itemId: string, data: Partial<EquipmentDailyEntry>) => {
    if (!canActiveUserRecount) return;
    setRecontagemEquipmentCounts(prev => {
      const current = prev[itemId] || { itemId };
      const merged: EquipmentDailyEntry = { ...current, ...data, itemId };
      // Permite desselecionar botão (remover status)
      if (data.status === undefined) {
        delete (merged as any).status;
      }
      const updated = {
        ...prev,
        [itemId]: merged
      };
      localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify(updated));
      broadcastSync('RECONTAGEM_COUNT_UPDATED');
      return updated;
    });
  };

  // Total de itens selecionados para recontagem (inclui contados e demais itens não contados selecionados)
  const recontagemSelectedCount = useMemo(() => {
    let count = 0;
    materials.forEach(m => {
      if (recontagemSelectedIds[m.id]) {
        count++;
      }
    });
    freezers.forEach(f => {
      if (recontagemSelectedIds[f.id]) {
        count++;
      }
    });
    equipments.forEach(eq => {
      if (recontagemSelectedIds[eq.id]) {
        count++;
      }
    });
    return count;
  }, [materials, freezers, equipments, recontagemSelectedIds]);

  // Bloqueio das demais telas (Materiais, Equipamentos e Exportar) para o Contador enquanto houver recontagem até Master zerar a contagem (nunca para CORINGA)
  const isRecontagemTabsBlockedForContador = useMemo(() => {
    if (!activeUser || activeUser.roleLevel !== 'contador' || isCoringaUser(activeUser)) return false;
    if (recontagemUnlocked) return true;
    const hasRecCounts =
      Object.values(recontagemMaterialCounts).some(hasMaterialEntryQuantity) ||
      Object.keys(recontagemEquipmentCounts).some(id => Boolean(recontagemEquipmentCounts[id]?.status));
    if (recontagemSelectedCount > 0 && (isReportSent || Boolean(recontagemTargetContador) || hasRecCounts)) {
      return true;
    }
    return false;
  }, [activeUser, recontagemUnlocked, recontagemSelectedCount, isReportSent, recontagemTargetContador, recontagemMaterialCounts, recontagemEquipmentCounts]);

  return (
    <InventoryContext.Provider
      value={{
        materials,
        freezers,
        equipments,
        users,
        activeUser,
        activeBranch,
        setActiveBranch,
        isCountAlreadyZero,
        emailSettings,
        serverEmailConfig,
        logs,
        isMaster,
        isCoringa,
        recloneTestBasesFromApp,
        activeContadorSession,
        isContadorActive,
        clearContadorSession,
        countStartedBy,
        recontagemTargetContador,
        isReportSent,
        recontagemUnlocked,
        isCountInProgress,
        isAnyBaseCountInProgress,
        canActiveUserCount,
        canActiveUserRecount,
        isRecontagemTabsBlockedForContador,
        cantCountReason,
        markCountAsSent,
        releaseRecontagemForContador,
        revokeRecontagemForContador,
        markRecountAsSent,
        cancelRecontagemByContador,
        systemNotice,
        setSystemNotice,
        syncMasterDataToFirebase,
        hasPendingMasterSync,
        lastFirebaseSyncAt,
        todayKey,
        todayDateFormatted: formatDateBR(todayKey),
        materialCounts,
        equipmentCounts,
        uncataloguedEquipments,
        lastCountBackup,
        frozenReportText,
        setFrozenReportText,
        emptyMaterialCodesAlert,
        setEmptyMaterialCodesAlert,
        isPhoneFrame,
        setIsPhoneFrame,
        updateMaterialCount,
        updateEquipmentCount,
        removeEquipmentCount,
        addUncataloguedEquipment,
        updateUncataloguedEquipment,
        deleteUncataloguedEquipment,
        deleteUnregisteredItemEntireHistory,
        cloneLastMaterialCount,
        cloneLastEquipmentCount,
        cloneSelectiveCount,
        resetAllTodayCountsByMaster,
        verifyCredentials,
        login,
        logout,
        setActiveUser,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        addFreezer,
        updateFreezer,
        deleteFreezer,
        addEquipment,
        updateEquipment,
        deleteEquipment,
        importBaseItems,
        addUser,
        updateUser,
        deleteUser,
        updateEmailSettings,
        updateServerEmailConfig,
        recipientsText,
        updateRecipientsText,
        defaultSenderEmail,
        addEmail,
        removeEmail,
        setDefaultEmail,
        addLog,
        clearAllData,
        clearSelectedData,
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
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory deve ser usado dentro de um InventoryProvider');
  }
  return context;
};
