
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
  UnitBranch
} from '../types/inventory';
import {
  INITIAL_MATERIALS,
  INITIAL_FREEZERS,
  INITIAL_EQUIPMENTS,
  INITIAL_LOGS,
  INITIAL_USERS,
  INITIAL_EMAIL_SETTINGS,
  INITIAL_SERVER_EMAIL_CONFIG
} from '../data/initialData';
import { getTodayKey, formatDateBR } from '../utils/dateUtils';
import { generateStockReportText } from '../utils/reportGenerator';
import {
  subscribeToBranch,
  subscribeToUsers,
  pushBranchToFirestore,
  pushUsersToFirestore
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
  isCountAlreadyZero: () => boolean;

  // Permissões e Controle de Concorrência
  isMaster: boolean;
  activeContadorSession: ContadorSession | null;
  isContadorActive: boolean;
  clearContadorSession: (targetBranchChoice?: UnitBranch) => void;

  // Estado e Regras de Contagem Concorrente
  countStartedBy: CountStartedBy | null;
  isReportSent: boolean;
  isCountInProgress: boolean;
  isAnyBaseCountInProgress: boolean;
  canActiveUserCount: boolean;
  cantCountReason: string | null;
  markCountAsSent: (branch?: UnitBranch) => void;

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
  resetAllTodayCountsByMaster: () => void;

  // Autenticação / Login
  login: (registration: string, password: string, branchChoice?: UnitBranch) => { success: boolean; message?: string };
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
  const code = branch === 'PAULO AFONSO' ? 'pa' : 'del';
  return `choppstock_${code}_${subKey}`;
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

  // EXIGÊNCIA: Bases independentes PAULO AFONSO e DELMIRO
  const [activeBranch, setActiveBranchState] = useState<UnitBranch>(() => {
    // Se houver usuário ativo que é contador, a base dele SEMPRE tem precedência
    const savedUser = localStorage.getItem(STORAGE_KEYS.ACTIVE_USER);
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && u.roleLevel === 'contador' && (u.branch === 'PAULO AFONSO' || u.branch === 'DELMIRO')) {
          return u.branch;
        }
      } catch {}
    }
    const saved = localStorage.getItem('choppstock_active_branch');
    if (saved === 'DELMIRO' || saved === 'PAULO AFONSO') return saved;
    return 'PAULO AFONSO';
  });

  const isSwitchingBranchRef = useRef(false);
  const activeBranchRef = useRef<UnitBranch>(activeBranch);
  useEffect(() => {
    activeBranchRef.current = activeBranch;
  }, [activeBranch]);

  // Catálogos isolados por base (clonados na primeira execução para PAULO AFONSO e DELMIRO)
  const [materials, setMaterials] = useState<MaterialItem[]>(() => {
    return loadInitialBranchData(
      activeBranch,
      'materials',
      INITIAL_MATERIALS,
      [STORAGE_KEYS.MATERIALS, 'choppstock_materials_v7', 'choppstock_materials_v6', 'choppstock_materials_v5', 'choppstock_materials']
    );
  });

  const [freezers, setFreezers] = useState<FreezerItem[]>(() => {
    return loadInitialBranchData(
      activeBranch,
      'freezers',
      INITIAL_FREEZERS,
      [STORAGE_KEYS.FREEZERS, 'choppstock_freezers_v7', 'choppstock_freezers_v6', 'choppstock_freezers_v5', 'choppstock_freezers']
    );
  });

  const [equipments, setEquipments] = useState<EquipmentItem[]>(() => {
    return loadInitialBranchData(
      activeBranch,
      'equipments',
      INITIAL_EQUIPMENTS,
      [STORAGE_KEYS.EQUIPMENTS, 'choppstock_equipments_v7', 'choppstock_equipments_v6', 'choppstock_equipments_v5', 'choppstock_equipments']
    );
  });

  const [users, setUsers] = useState<StockUser[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    let userList: StockUser[] = INITIAL_USERS;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) userList = parsed;
      } catch {}
    }

    // Configura Carlos para PAULO AFONSO e Pedro para DELMIRO
    let needsUpdate = false;
    userList = userList.map(u => {
      if (u.registration === '2001' && !u.branch) {
        needsUpdate = true;
        return { ...u, branch: 'PAULO AFONSO' as const };
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

    if (needsUpdate) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(userList));
    }
    return userList;
  });

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

  // Sessão de Contador isolada por base
  const [activeContadorSession, setActiveContadorSession] = useState<ContadorSession | null>(() => {
    const saved = localStorage.getItem(getBranchStorageKey(activeBranch, 'active_contador_session')) || localStorage.getItem(STORAGE_KEYS.ACTIVE_CONTADOR_SESSION);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.userId) return parsed;
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

  // Estado em tempo real das duas bases para controle de concorrência global (nas duas bases)
  const [branchStatusPA, setBranchStatusPA] = useState<{
    countStartedBy: CountStartedBy | null;
    isReportSent: boolean;
    activeContadorSession: ContadorSession | null;
    hasCounts: boolean;
  }>(() => {
    const csb = localStorage.getItem(getBranchStorageKey('PAULO AFONSO', 'count_started_by'));
    const irs = localStorage.getItem(getBranchStorageKey('PAULO AFONSO', 'is_report_sent'));
    const sess = localStorage.getItem(getBranchStorageKey('PAULO AFONSO', 'active_contador_session'));
    const mats = localStorage.getItem(getBranchStorageKey('PAULO AFONSO', 'today_materials'));
    const eqs = localStorage.getItem(getBranchStorageKey('PAULO AFONSO', 'today_equipments'));
    const parsedMats = mats ? JSON.parse(mats) : {};
    const parsedEqs = eqs ? JSON.parse(eqs) : {};
    const hasCounts = Object.keys(parsedMats).length > 0 || Object.keys(parsedEqs).length > 0;
    return {
      countStartedBy: csb ? JSON.parse(csb) : null,
      isReportSent: irs ? JSON.parse(irs) : false,
      activeContadorSession: sess ? JSON.parse(sess) : null,
      hasCounts,
    };
  });

  const [branchStatusDEL, setBranchStatusDEL] = useState<{
    countStartedBy: CountStartedBy | null;
    isReportSent: boolean;
    activeContadorSession: ContadorSession | null;
    hasCounts: boolean;
  }>(() => {
    const csb = localStorage.getItem(getBranchStorageKey('DELMIRO', 'count_started_by'));
    const irs = localStorage.getItem(getBranchStorageKey('DELMIRO', 'is_report_sent'));
    const sess = localStorage.getItem(getBranchStorageKey('DELMIRO', 'active_contador_session'));
    const mats = localStorage.getItem(getBranchStorageKey('DELMIRO', 'today_materials'));
    const eqs = localStorage.getItem(getBranchStorageKey('DELMIRO', 'today_equipments'));
    const parsedMats = mats ? JSON.parse(mats) : {};
    const parsedEqs = eqs ? JSON.parse(eqs) : {};
    const hasCounts = Object.keys(parsedMats).length > 0 || Object.keys(parsedEqs).length > 0;
    return {
      countStartedBy: csb ? JSON.parse(csb) : null,
      isReportSent: irs ? JSON.parse(irs) : false,
      activeContadorSession: sess ? JSON.parse(sess) : null,
      hasCounts,
    };
  });

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

  // Alternar base ativa com carregamento integral isolado (apenas Master)
  const setActiveBranch = (newBranch: UnitBranch) => {
    // Bloqueio: Usuário Contador não pode alternar de base
    if (activeUser?.roleLevel === 'contador' && newBranch !== activeUser.branch) {
      return;
    }
    if (newBranch === activeBranch) return;
    isSwitchingBranchRef.current = true;
    activeBranchRef.current = newBranch;
    setActiveBranchState(newBranch);
    localStorage.setItem('choppstock_active_branch', newBranch);

    const mats = loadInitialBranchData(newBranch, 'materials', INITIAL_MATERIALS, [STORAGE_KEYS.MATERIALS]);
    const frzs = loadInitialBranchData(newBranch, 'freezers', INITIAL_FREEZERS, [STORAGE_KEYS.FREEZERS]);
    const eqs = loadInitialBranchData(newBranch, 'equipments', INITIAL_EQUIPMENTS, [STORAGE_KEYS.EQUIPMENTS]);
    const dKey = loadInitialBranchData(newBranch, 'calendar_day', currentTodayKey, []);
    const mCounts = loadInitialBranchData(newBranch, 'today_materials', {}, []);
    const eqCounts = loadInitialBranchData(newBranch, 'today_equipments', {}, []);
    const uncat = loadInitialBranchData(newBranch, 'today_uncatalogued', [], []);
    const bkp = loadInitialBranchData(newBranch, 'last_count_backup', null, []);
    const lg = loadInitialBranchData(newBranch, 'logs', INITIAL_LOGS, []);
    const frzRep = localStorage.getItem(getBranchStorageKey(newBranch, 'frozen_report'));
    const sessStr = localStorage.getItem(getBranchStorageKey(newBranch, 'active_contador_session'));
    const sess = sessStr ? JSON.parse(sessStr) : null;

    // Configurações e destinatários de e-mail independentes por base
    const branchEmailSettings = loadInitialBranchData(newBranch, 'email_settings', INITIAL_EMAIL_SETTINGS, [STORAGE_KEYS.EMAIL_SETTINGS]);
    const branchServerConfig = loadInitialBranchData(newBranch, 'server_email_config', INITIAL_SERVER_EMAIL_CONFIG, [STORAGE_KEYS.SERVER_EMAIL_CONFIG]);
    let branchRecipients = localStorage.getItem(getBranchStorageKey(newBranch, 'recipients_text'));
    if (branchRecipients === null) {
      branchRecipients = branchEmailSettings.emails.join(', ');
      localStorage.setItem(getBranchStorageKey(newBranch, 'recipients_text'), branchRecipients);
    }

    // Carrega dados de recontagem da nova base (somente do dia atual)
    const isNewDay = dKey !== currentTodayKey;
    const recSelected = isNewDay ? {} : loadInitialBranchData(newBranch, 'recontagem_selected_ids', {}, []);
    const recMatCounts = isNewDay ? {} : loadInitialBranchData(newBranch, 'recontagem_material_counts', {}, []);
    const recEqCounts = isNewDay ? {} : loadInitialBranchData(newBranch, 'recontagem_equipment_counts', {}, []);

    if (isNewDay) {
      localStorage.setItem(getBranchStorageKey(newBranch, 'today_materials'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(newBranch, 'today_equipments'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(newBranch, 'today_uncatalogued'), JSON.stringify([]));
      localStorage.setItem(getBranchStorageKey(newBranch, 'recontagem_selected_ids'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(newBranch, 'recontagem_material_counts'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(newBranch, 'recontagem_equipment_counts'), JSON.stringify({}));
      localStorage.setItem(getBranchStorageKey(newBranch, 'calendar_day'), currentTodayKey);
    }

    const cStarted = loadInitialBranchData<CountStartedBy | null>(newBranch, 'count_started_by', null, []);
    const repSent = loadInitialBranchData<boolean>(newBranch, 'is_report_sent', false, []);

    setMaterials(mats);
    setFreezers(frzs);
    setEquipments(eqs);
    setTodayKey(isNewDay ? currentTodayKey : dKey);
    setMaterialCounts(isNewDay ? {} : mCounts);
    setEquipmentCounts(isNewDay ? {} : eqCounts);
    setUncataloguedEquipments(isNewDay ? [] : uncat);
    setLastCountBackup(bkp);
    setLogs(lg);
    setFrozenReportTextState(frzRep);
    setActiveContadorSession(sess);
    setCountStartedBy(cStarted);
    setIsReportSent(repSent);
    setEmailSettings(branchEmailSettings);
    setServerEmailConfig(branchServerConfig);
    setRecipientsTextState(branchRecipients);
    setRecontagemSelectedIds(recSelected);
    setRecontagemMaterialCounts(recMatCounts);
    setRecontagemEquipmentCounts(recEqCounts);

    setTimeout(() => {
      isSwitchingBranchRef.current = false;
    }, 50);
  };

  // Bloqueio rigoroso: Usuário Contador fica restrito estritamente à base cadastrada
  useEffect(() => {
    if (activeUser && activeUser.roleLevel === 'contador' && activeUser.branch) {
      if (activeBranch !== activeUser.branch) {
        setActiveBranch(activeUser.branch);
      }
    }
  }, [activeUser, activeBranch]);

  // EXIGÊNCIA: Verificar se a contagem já se encontra zerada
  const isCountAlreadyZero = (): boolean => {
    const hasMats = Object.values(materialCounts).some(m =>
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
    const hasEqs = Object.keys(equipmentCounts).length > 0;
    const hasUncat = uncataloguedEquipments.length > 0;
    return !hasMats && !hasEqs && !hasUncat && !countStartedBy;
  };

  // Verificação diária por base (limpeza ao virar o dia em ambas as bases, incluindo recontagem)
  useEffect(() => {
    const branches: UnitBranch[] = ['PAULO AFONSO', 'DELMIRO'];

    const checkDailyRollover = () => {
      const todayStr = getTodayKey();

      branches.forEach(b => {
        const storedDay = localStorage.getItem(getBranchStorageKey(b, 'calendar_day'));
        if (storedDay && storedDay !== todayStr) {
          const savedMat = localStorage.getItem(getBranchStorageKey(b, 'today_materials'));
          const savedEq = localStorage.getItem(getBranchStorageKey(b, 'today_equipments'));
          const savedUncat = localStorage.getItem(getBranchStorageKey(b, 'today_uncatalogued'));

          const parsedMat = savedMat ? JSON.parse(savedMat) : {};
          const parsedEq = savedEq ? JSON.parse(savedEq) : {};
          const parsedUncat = savedUncat ? JSON.parse(savedUncat) : [];

          const hasContent =
            Object.keys(parsedMat).length > 0 ||
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

          // Limpa contagens normais da base ao virar o dia
          localStorage.setItem(getBranchStorageKey(b, 'today_materials'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'today_equipments'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'today_uncatalogued'), JSON.stringify([]));

          // EXIGÊNCIA: Na tela Recontagem, os itens são limpos/zerados ao virar o dia, das duas bases
          localStorage.setItem(getBranchStorageKey(b, 'recontagem_selected_ids'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'recontagem_material_counts'), JSON.stringify({}));
          localStorage.setItem(getBranchStorageKey(b, 'recontagem_equipment_counts'), JSON.stringify({}));
          localStorage.removeItem(getBranchStorageKey(b, 'count_started_by'));
          localStorage.setItem(getBranchStorageKey(b, 'is_report_sent'), JSON.stringify(false));

          localStorage.setItem(getBranchStorageKey(b, 'calendar_day'), todayStr);

          // Se a base processada for a base ativa em tela, reseta os estados do React imediatamente
          if (b === activeBranch) {
            setMaterialCounts({});
            setEquipmentCounts({});
            setUncataloguedEquipments([]);
            setRecontagemSelectedIds({});
            setRecontagemMaterialCounts({});
            setRecontagemEquipmentCounts({});
            setCountStartedBy(null);
            setIsReportSent(false);
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
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
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

  // --- SINCRONIZAÇÃO EM TEMPO REAL COM O FIREBASE FIRESTORE ---
  const isRemoteSyncRef = useRef(false);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRemoteUsersRef = useRef(false);
  const syncUsersTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 1. Escuta dados em tempo real do Firestore para PAULO AFONSO e DELMIRO
  useEffect(() => {
    const unsubPA = subscribeToBranch(
      'PAULO AFONSO',
      (remote) => {
        if (!remote) return;
        const hasCounts = (remote.materialCounts && Object.keys(remote.materialCounts).length > 0) ||
                          (remote.equipmentCounts && Object.keys(remote.equipmentCounts).length > 0) ||
                          (remote.uncataloguedEquipments && remote.uncataloguedEquipments.length > 0);
        setBranchStatusPA({
          countStartedBy: remote.countStartedBy || null,
          isReportSent: !!remote.isReportSent,
          activeContadorSession: remote.activeContadorSession || null,
          hasCounts: !!hasCounts
        });

        if (activeBranchRef.current === 'PAULO AFONSO') {
          isRemoteSyncRef.current = true;
          try {
            // Cadastros são permanentes e sempre sincronizados em tempo real
            if (remote.materials && Array.isArray(remote.materials)) {
              setMaterials(remote.materials);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'materials'), JSON.stringify(remote.materials));
            }
            if (remote.freezers && Array.isArray(remote.freezers)) {
              setFreezers(remote.freezers);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'freezers'), JSON.stringify(remote.freezers));
            }
            if (remote.equipments && Array.isArray(remote.equipments)) {
              setEquipments(remote.equipments);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'equipments'), JSON.stringify(remote.equipments));
            }

            // Não sobrescrever contagens locais se este dispositivo for o contador que está contando ativamente
            const isLocalActivelyCounting = activeUserRef.current?.roleLevel === 'contador' && countStartedByRef.current && !isReportSentRef.current;
            if (!isLocalActivelyCounting) {
              if (remote.materialCounts) {
                setMaterialCounts(remote.materialCounts);
                localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'today_materials'), JSON.stringify(remote.materialCounts));
              }
              if (remote.equipmentCounts) {
                setEquipmentCounts(remote.equipmentCounts);
                localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'today_equipments'), JSON.stringify(remote.equipmentCounts));
              }
              if (remote.uncataloguedEquipments && Array.isArray(remote.uncataloguedEquipments)) {
                setUncataloguedEquipments(remote.uncataloguedEquipments);
                localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'today_uncatalogued'), JSON.stringify(remote.uncataloguedEquipments));
              }
            }
            if (remote.lastCountBackup !== undefined) {
              setLastCountBackup(remote.lastCountBackup);
              if (remote.lastCountBackup) {
                localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'last_count_backup'), JSON.stringify(remote.lastCountBackup));
              }
            }
            if (remote.activeContadorSession !== undefined) {
              setActiveContadorSession(remote.activeContadorSession);
              if (remote.activeContadorSession) {
                localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'active_contador_session'), JSON.stringify(remote.activeContadorSession));
              } else {
                localStorage.removeItem(getBranchStorageKey('PAULO AFONSO', 'active_contador_session'));
              }
            }
            if (remote.countStartedBy !== undefined) {
              setCountStartedBy(remote.countStartedBy);
              if (remote.countStartedBy) {
                localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'count_started_by'), JSON.stringify(remote.countStartedBy));
              } else {
                localStorage.removeItem(getBranchStorageKey('PAULO AFONSO', 'count_started_by'));
              }
            }
            if (remote.isReportSent !== undefined) {
              setIsReportSent(!!remote.isReportSent);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'is_report_sent'), JSON.stringify(!!remote.isReportSent));
            }
            if (remote.frozenReportText !== undefined) {
              setFrozenReportTextState(remote.frozenReportText);
              if (remote.frozenReportText) {
                localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'frozen_report'), remote.frozenReportText);
              } else {
                localStorage.removeItem(getBranchStorageKey('PAULO AFONSO', 'frozen_report'));
              }
            }
            if (remote.recontagemSelectedIds) {
              setRecontagemSelectedIds(remote.recontagemSelectedIds);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'recontagem_selected_ids'), JSON.stringify(remote.recontagemSelectedIds));
            }
            if (remote.recontagemMaterialCounts) {
              setRecontagemMaterialCounts(remote.recontagemMaterialCounts);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'recontagem_material_counts'), JSON.stringify(remote.recontagemMaterialCounts));
            }
            if (remote.recontagemEquipmentCounts) {
              setRecontagemEquipmentCounts(remote.recontagemEquipmentCounts);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'recontagem_equipment_counts'), JSON.stringify(remote.recontagemEquipmentCounts));
            }
            if (remote.emailRecipients) {
              setRecipientsTextState(remote.emailRecipients);
              localStorage.setItem(getBranchStorageKey('PAULO AFONSO', 'recipients_text'), remote.emailRecipients);
            }
          } finally {
            setTimeout(() => {
              isRemoteSyncRef.current = false;
            }, 150);
          }
        }
      },
      undefined,
      () => {
        if (activeBranchRef.current === 'PAULO AFONSO') {
          pushBranchToFirestore('PAULO AFONSO', {
            materials,
            freezers,
            equipments,
            materialCounts,
            equipmentCounts,
            uncataloguedEquipments,
            lastCountBackup,
            activeContadorSession,
            countStartedBy,
            isReportSent,
            frozenReportText,
            recontagemSelectedIds,
            recontagemMaterialCounts,
            recontagemEquipmentCounts,
            emailRecipients: recipientsText,
          }).catch(err => console.warn('Erro ao inicializar PAULO AFONSO no Firestore:', err));
        }
      }
    );

    const unsubDEL = subscribeToBranch(
      'DELMIRO',
      (remote) => {
        if (!remote) return;
        const hasCounts = (remote.materialCounts && Object.keys(remote.materialCounts).length > 0) ||
                          (remote.equipmentCounts && Object.keys(remote.equipmentCounts).length > 0) ||
                          (remote.uncataloguedEquipments && remote.uncataloguedEquipments.length > 0);
        setBranchStatusDEL({
          countStartedBy: remote.countStartedBy || null,
          isReportSent: !!remote.isReportSent,
          activeContadorSession: remote.activeContadorSession || null,
          hasCounts: !!hasCounts
        });

        if (activeBranchRef.current === 'DELMIRO') {
          isRemoteSyncRef.current = true;
          try {
            if (remote.materials && Array.isArray(remote.materials)) {
              setMaterials(remote.materials);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'materials'), JSON.stringify(remote.materials));
            }
            if (remote.freezers && Array.isArray(remote.freezers)) {
              setFreezers(remote.freezers);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'freezers'), JSON.stringify(remote.freezers));
            }
            if (remote.equipments && Array.isArray(remote.equipments)) {
              setEquipments(remote.equipments);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'equipments'), JSON.stringify(remote.equipments));
            }
            // Não sobrescrever contagens locais se este dispositivo for o contador que está contando ativamente
            const isLocalActivelyCounting = activeUserRef.current?.roleLevel === 'contador' && countStartedByRef.current && !isReportSentRef.current;
            if (!isLocalActivelyCounting) {
              if (remote.materialCounts) {
                setMaterialCounts(remote.materialCounts);
                localStorage.setItem(getBranchStorageKey('DELMIRO', 'today_materials'), JSON.stringify(remote.materialCounts));
              }
              if (remote.equipmentCounts) {
                setEquipmentCounts(remote.equipmentCounts);
                localStorage.setItem(getBranchStorageKey('DELMIRO', 'today_equipments'), JSON.stringify(remote.equipmentCounts));
              }
              if (remote.uncataloguedEquipments && Array.isArray(remote.uncataloguedEquipments)) {
                setUncataloguedEquipments(remote.uncataloguedEquipments);
                localStorage.setItem(getBranchStorageKey('DELMIRO', 'today_uncatalogued'), JSON.stringify(remote.uncataloguedEquipments));
              }
            }
            if (remote.lastCountBackup !== undefined) {
              setLastCountBackup(remote.lastCountBackup);
              if (remote.lastCountBackup) {
                localStorage.setItem(getBranchStorageKey('DELMIRO', 'last_count_backup'), JSON.stringify(remote.lastCountBackup));
              }
            }
            if (remote.activeContadorSession !== undefined) {
              setActiveContadorSession(remote.activeContadorSession);
              if (remote.activeContadorSession) {
                localStorage.setItem(getBranchStorageKey('DELMIRO', 'active_contador_session'), JSON.stringify(remote.activeContadorSession));
              } else {
                localStorage.removeItem(getBranchStorageKey('DELMIRO', 'active_contador_session'));
              }
            }
            if (remote.countStartedBy !== undefined) {
              setCountStartedBy(remote.countStartedBy);
              if (remote.countStartedBy) {
                localStorage.setItem(getBranchStorageKey('DELMIRO', 'count_started_by'), JSON.stringify(remote.countStartedBy));
              } else {
                localStorage.removeItem(getBranchStorageKey('DELMIRO', 'count_started_by'));
              }
            }
            if (remote.isReportSent !== undefined) {
              setIsReportSent(!!remote.isReportSent);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'is_report_sent'), JSON.stringify(!!remote.isReportSent));
            }
            if (remote.frozenReportText !== undefined) {
              setFrozenReportTextState(remote.frozenReportText);
              if (remote.frozenReportText) {
                localStorage.setItem(getBranchStorageKey('DELMIRO', 'frozen_report'), remote.frozenReportText);
              } else {
                localStorage.removeItem(getBranchStorageKey('DELMIRO', 'frozen_report'));
              }
            }
            if (remote.recontagemSelectedIds) {
              setRecontagemSelectedIds(remote.recontagemSelectedIds);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'recontagem_selected_ids'), JSON.stringify(remote.recontagemSelectedIds));
            }
            if (remote.recontagemMaterialCounts) {
              setRecontagemMaterialCounts(remote.recontagemMaterialCounts);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'recontagem_material_counts'), JSON.stringify(remote.recontagemMaterialCounts));
            }
            if (remote.recontagemEquipmentCounts) {
              setRecontagemEquipmentCounts(remote.recontagemEquipmentCounts);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'recontagem_equipment_counts'), JSON.stringify(remote.recontagemEquipmentCounts));
            }
            if (remote.emailRecipients) {
              setRecipientsTextState(remote.emailRecipients);
              localStorage.setItem(getBranchStorageKey('DELMIRO', 'recipients_text'), remote.emailRecipients);
            }
          } finally {
            setTimeout(() => {
              isRemoteSyncRef.current = false;
            }, 150);
          }
        }
      },
      undefined,
      () => {
        if (activeBranchRef.current === 'DELMIRO') {
          pushBranchToFirestore('DELMIRO', {
            materials,
            freezers,
            equipments,
            materialCounts,
            equipmentCounts,
            uncataloguedEquipments,
            lastCountBackup,
            activeContadorSession,
            countStartedBy,
            isReportSent,
            frozenReportText,
            recontagemSelectedIds,
            recontagemMaterialCounts,
            recontagemEquipmentCounts,
            emailRecipients: recipientsText,
          }).catch(err => console.warn('Erro ao inicializar DELMIRO no Firestore:', err));
        }
      }
    );

    return () => {
      unsubPA();
      unsubDEL();
    };
  }, []);

  // 2. Escuta lista de usuários em tempo real do Firestore
  useEffect(() => {
    const unsubscribe = subscribeToUsers(
      (remoteUsers) => {
        if (!remoteUsers || remoteUsers.length === 0) return;
        isRemoteUsersRef.current = true;
        try {
          setUsers(remoteUsers);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remoteUsers));
        } finally {
          setTimeout(() => {
            isRemoteUsersRef.current = false;
          }, 150);
        }
      },
      undefined,
      () => {
        pushUsersToFirestore(users).catch(err => console.warn('Erro ao inicializar usuários no Firestore:', err));
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Sincronização automática para o Firestore ao alterar dados da base local
  useEffect(() => {
    if (isRemoteSyncRef.current || isSwitchingBranchRef.current) return;

    // EXIGÊNCIA: Não permitir que o app fique atualizando em segundo plano e nem se comunicando com firebase ao iniciar uma contagem,
    // somente quando o contador enviar o e-mail do relatório da contagem é que todas as informações do dispositivo atual serão sincronizadas.
    if (activeUser?.roleLevel === 'contador' && countStartedBy && !isReportSent) {
      return;
    }

    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      pushBranchToFirestore(activeBranch, {
        materials,
        freezers,
        equipments,
        materialCounts,
        equipmentCounts,
        uncataloguedEquipments,
        lastCountBackup,
        activeContadorSession,
        countStartedBy,
        isReportSent,
        frozenReportText,
        recontagemSelectedIds,
        recontagemMaterialCounts,
        recontagemEquipmentCounts,
        emailRecipients: recipientsText,
      }).catch(err => console.warn('Erro ao sincronizar com Firestore:', err));
    }, 400);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [
    materials,
    freezers,
    equipments,
    materialCounts,
    equipmentCounts,
    uncataloguedEquipments,
    lastCountBackup,
    activeContadorSession,
    countStartedBy,
    isReportSent,
    frozenReportText,
    recontagemSelectedIds,
    recontagemMaterialCounts,
    recontagemEquipmentCounts,
    recipientsText,
    activeBranch,
    activeUser,
  ]);

  // 4. Sincronização de usuários para o Firestore
  useEffect(() => {
    if (isRemoteUsersRef.current) return;
    if (syncUsersTimeoutRef.current) clearTimeout(syncUsersTimeoutRef.current);
    syncUsersTimeoutRef.current = setTimeout(() => {
      pushUsersToFirestore(users).catch(err => console.warn('Erro ao sincronizar usuários com Firestore:', err));
    }, 400);

    return () => {
      if (syncUsersTimeoutRef.current) clearTimeout(syncUsersTimeoutRef.current);
    };
  }, [users]);

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

  // Nível de Acesso
  const isMaster = !!activeUser && activeUser.roleLevel === 'master';

  // Controle de Contador ativo na base atual
  const isContadorActive = !!activeContadorSession && activeContadorSession.userId !== activeUser?.id;

  // Verificação de itens contados hoje na base atual
  const hasCurrentBranchCounts = useMemo(() => {
    const hasMats = Object.values(materialCounts).some(m =>
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
    const hasEqs = Object.keys(equipmentCounts).length > 0;
    const hasUncat = uncataloguedEquipments.length > 0;
    return hasMats || hasEqs || hasUncat;
  }, [materialCounts, equipmentCounts, uncataloguedEquipments]);

  // Contagem em andamento na base PAULO AFONSO
  const isCountInProgressPA = useMemo(() => {
    if (branchStatusPA.isReportSent) return false;
    return !!branchStatusPA.countStartedBy || (branchStatusPA.hasCounts && !!branchStatusPA.activeContadorSession);
  }, [branchStatusPA]);

  // Contagem em andamento na base DELMIRO
  const isCountInProgressDEL = useMemo(() => {
    if (branchStatusDEL.isReportSent) return false;
    return !!branchStatusDEL.countStartedBy || (branchStatusDEL.hasCounts && !!branchStatusDEL.activeContadorSession);
  }, [branchStatusDEL]);

  // Contagem em andamento na base ativa
  const isCountInProgress = activeBranch === 'PAULO AFONSO' ? isCountInProgressPA : isCountInProgressDEL;

  // "quando algum contador iniciar a contagem no app, o usuário master poderá logar no app, mas não poderá realizar nenhuma mudança no cadastro de Materiais, Equipamentos e Usuários, também não poderá realizar mudança na contagem já iniciada, aparecendo a mensagem: 'Existe contagem em andamento.', nas duas bases."
  const isAnyBaseCountInProgress = isCountInProgressPA || isCountInProgressDEL;

  // Permissão do usuário ativo para realizar contagens na base atual
  const canActiveUserCount = useMemo(() => {
    if (!activeUser) return false;

    // Master: se houver contagem em andamento, Master não pode realizar alteração na contagem
    if (activeUser.roleLevel === 'master') {
      if (isCountInProgress) return false;
      return true;
    }

    // Usuário Contador:
    // "Somente após o envio do estoque por e-mail é que o acesso total das funcionalidades do app será liberado para o usuário Master, os demais usuário contadores poderão logar no app, mas não poderão alterar a contagem em andamento e nem realizar contagens, nas duas bases."
    if (isReportSent) {
      return false;
    }

    // "Somente o contador que iniciou a contagem, poderá dar continuidade ou modificar a contagem iniciada, isso para as duas bases."
    if (countStartedBy && countStartedBy.userId !== activeUser.id) {
      return false;
    }

    return true;
  }, [activeUser, isCountInProgress, isReportSent, countStartedBy]);

  const cantCountReason = useMemo(() => {
    if (canActiveUserCount) return null;
    if (!activeUser) return 'Faça login para realizar contagens.';
    if (activeUser.roleLevel === 'master' && isCountInProgress) {
      return 'Existe contagem em andamento.';
    }
    if (isReportSent) {
      return 'Estoque já enviado por e-mail. Não é permitido alterar a contagem em andamento nem realizar contagens até que a contagem seja zerada pelo usuário Master.';
    }
    if (countStartedBy && countStartedBy.userId !== activeUser.id) {
      return `A contagem foi iniciada pelo contador ${countStartedBy.userName} (Matrícula: ${countStartedBy.registration}). Somente ele pode dar continuidade ou modificar a contagem iniciada.`;
    }
    return 'Existe contagem em andamento.';
  }, [canActiveUserCount, activeUser, isCountInProgress, isReportSent, countStartedBy]);

  // Heartbeat do contador logado para liberar sessão se desconectar
  useEffect(() => {
    if (!activeUser || activeUser.roleLevel !== 'contador') return;

    const interval = setInterval(() => {
      const curBranch = activeBranchRef.current;
      const heartbeat = Date.now();
      setActiveContadorSession(prev => {
        if (!prev) return null;
        const updated = { ...prev, lastHeartbeat: heartbeat };
        localStorage.setItem(getBranchStorageKey(curBranch, 'active_contador_session'), JSON.stringify(updated));
        pushBranchToFirestore(curBranch, { activeContadorSession: updated });
        return updated;
      });
    }, 20000);

    const handleBeforeUnload = () => {
      const curBranch = activeBranchRef.current;
      pushBranchToFirestore(curBranch, { activeContadorSession: null });
      localStorage.removeItem(getBranchStorageKey(curBranch, 'active_contador_session'));
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeUser]);

  // Transmissão de sincronização em segundo plano
  const broadcastSync = (actionType: string) => {
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
      const storedMat = localStorage.getItem(getBranchStorageKey(curBranch, 'today_materials'));
      if (storedMat) {
        try { setMaterialCounts(JSON.parse(storedMat)); } catch {}
      }
      const storedEq = localStorage.getItem(getBranchStorageKey(curBranch, 'today_equipments'));
      if (storedEq) {
        try { setEquipmentCounts(JSON.parse(storedEq)); } catch {}
      }
      const storedUncat = localStorage.getItem(getBranchStorageKey(curBranch, 'today_uncatalogued'));
      if (storedUncat) {
        try { setUncataloguedEquipments(JSON.parse(storedUncat)); } catch {}
      }
      const storedSession = localStorage.getItem(getBranchStorageKey(curBranch, 'active_contador_session'));
      if (storedSession) {
        try { setActiveContadorSession(JSON.parse(storedSession)); } catch {}
      } else {
        setActiveContadorSession(null);
      }
      const storedCountStartedBy = localStorage.getItem(getBranchStorageKey(curBranch, 'count_started_by'));
      if (storedCountStartedBy) {
        try { setCountStartedBy(JSON.parse(storedCountStartedBy)); } catch {}
      } else {
        setCountStartedBy(null);
      }
      const storedReportSent = localStorage.getItem(getBranchStorageKey(curBranch, 'is_report_sent'));
      if (storedReportSent) {
        try { setIsReportSent(JSON.parse(storedReportSent)); } catch {}
      } else {
        setIsReportSent(false);
      }
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
      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (storedUsers) {
        try { setUsers(JSON.parse(storedUsers)); } catch {}
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
      const storedRecSelected = localStorage.getItem(getBranchStorageKey(curBranch, 'recontagem_selected_ids'));
      if (storedRecSelected) {
        try { setRecontagemSelectedIds(JSON.parse(storedRecSelected)); } catch {}
      }
      const storedRecMat = localStorage.getItem(getBranchStorageKey(curBranch, 'recontagem_material_counts'));
      if (storedRecMat) {
        try { setRecontagemMaterialCounts(JSON.parse(storedRecMat)); } catch {}
      }
      const storedRecEq = localStorage.getItem(getBranchStorageKey(curBranch, 'recontagem_equipment_counts'));
      if (storedRecEq) {
        try { setRecontagemEquipmentCounts(JSON.parse(storedRecEq)); } catch {}
      }
    } catch {}
  };

  useEffect(() => {
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('choppstock_realtime_sync_v1');
        bc.onmessage = (event: MessageEvent) => {
          if (event.data?.branch && event.data.branch !== activeBranchRef.current) {
            return;
          }
          handleBackgroundSync();
        };
      }
    } catch {}

    const onStorage = (event: StorageEvent) => {
      const cur = activeBranchRef.current;
      const otherPrefix = cur === 'PAULO AFONSO' ? 'choppstock_del_' : 'choppstock_pa_';
      if (event.key && event.key.startsWith(otherPrefix)) {
        return;
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

  // Inicia a marcação de contagem iniciada pelo contador ativo
  const ensureCountStarted = () => {
    if (activeUser && activeUser.roleLevel === 'contador' && !countStartedBy) {
      const newStarted: CountStartedBy = {
        userId: activeUser.id,
        userName: activeUser.name,
        registration: activeUser.registration,
        startedAt: Date.now(),
      };
      setCountStartedBy(newStarted);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'count_started_by'), JSON.stringify(newStarted));
      pushBranchToFirestore(activeBranch, { countStartedBy: newStarted });
      broadcastSync('COUNT_STARTED');
    }
  };

  // --- ATUALIZAÇÕES DA CONTAGEM DIÁRIA (SALVAMENTO AUTOMÁTICO) ---
  const updateMaterialCount = (itemId: string, data: Partial<MaterialDailyEntry>) => {
    if (!canActiveUserCount) return;
    ensureCountStarted();

    // EXIGÊNCIA: O campo "PRÉVIA DO RELATÓRIO" só será atualizado automaticamente caso seja modificado na contagem da tela Materiais
    if (frozenReportText) {
      setFrozenReportText(null);
      localStorage.removeItem('frozen_report_text');
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

    // 4. Remove de equipmentCounts
    setEquipmentCounts(prev => {
      const updated = { ...prev };
      if (itemId) delete updated[itemId];
      removedFreezerIds.forEach(id => delete updated[id]);
      removedEquipIds.forEach(id => delete updated[id]);
      // Remove também por patrimônio se algum count estiver indexado
      localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify(updated));
      return updated;
    });

    broadcastSync('BASE_UPDATED');
    broadcastSync('COUNT_UPDATED');
  };

  // --- CLONAR ÚLTIMA CONTAGEM (APENAS USUÁRIO MASTER) ---
  const cloneLastMaterialCount = (): boolean => {
    if (isMaster && isContadorActive) return false;

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
    if (isMaster && isContadorActive) return false;

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
    if (isMaster && isContadorActive) {
      return { success: false, message: 'Existe usuário realizando contagem no momento.' };
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

  // --- ZERAR BASE DE TODA A CONTAGEM DO DIA (APENAS MASTER) ---
  const resetAllTodayCountsByMaster = () => {
    // "quando algum contador iniciar a contagem no app, o usuário master poderá logar no app, mas não poderá realizar nenhuma mudança no cadastro de Materiais, Equipamentos e Usuários, também não poderá realizar mudança na contagem já iniciada, aparecendo a mensagem: 'Existe contagem em andamento.', nas duas bases."
    // "Somente após o envio do estoque por e-mail é que o acesso total das funcionalidades do app será liberado para o usuário Master"
    if (isCountInProgress && !isReportSent) {
      alert('Existe contagem em andamento.');
      return;
    }

    // Guarda o estado atual no backup para não perder caso queira clonar
    const hasData =
      Object.keys(materialCounts).length > 0 ||
      Object.keys(equipmentCounts).length > 0 ||
      uncataloguedEquipments.length > 0;

    if (hasData) {
      const backup: LastCountBackup = {
        date: todayKey,
        materials: { ...materialCounts },
        equipments: { ...equipmentCounts },
        uncatalogued: [...uncataloguedEquipments],
        savedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };
      setLastCountBackup(backup);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'last_count_backup'), JSON.stringify(backup));
    }

    // EXIGÊNCIA: Ao clicar no botão "Zerar Dia", o relatório do campo "PRÉVIA DO RELATÓRIO" não irá ser alterado.
    if (!frozenReportText) {
      const currentReport = generateStockReportText({
        selectedStock: 'ambos',
        todayDateFormatted: formatDateBR(todayKey),
        activeUser,
        defaultSenderEmail,
        recipients: emailSettings.emails,
        materials,
        freezers,
        equipments,
        uncataloguedEquipments,
        materialCounts,
        equipmentCounts,
        includeEquipmentDefects: false,
        isMobile: isPhoneFrame,
      });
      setFrozenReportText(currentReport);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'frozen_report'), currentReport);
    }

    setMaterialCounts({});
    setEquipmentCounts({});
    setUncataloguedEquipments([]);
    setRecontagemSelectedIds({});
    setRecontagemMaterialCounts({});
    setRecontagemEquipmentCounts({});
    setCountStartedBy(null);
    setIsReportSent(false);

    localStorage.setItem(getBranchStorageKey(activeBranch, 'today_materials'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'today_equipments'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'), JSON.stringify([]));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify({}));
    localStorage.removeItem(getBranchStorageKey(activeBranch, 'count_started_by'));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'is_report_sent'), JSON.stringify(false));

    pushBranchToFirestore(activeBranch, {
      materialCounts: {},
      equipmentCounts: {},
      uncataloguedEquipments: [],
      recontagemSelectedIds: {},
      recontagemMaterialCounts: {},
      recontagemEquipmentCounts: {},
      countStartedBy: null,
      isReportSent: false,
    });

    broadcastSync('COUNT_UPDATED');
    broadcastSync('RECONTAGEM_UPDATED');
    broadcastSync('COUNT_RESET');

    addLog({
      type: 'contagem',
      targetType: 'contagem',
      itemCode: 'ZERAR-CONTAGENS',
      title: `Contagens Zeradas na Base [${activeBranch}] pelo Master`,
      description: `Todas as contagens de materiais e equipamentos do dia foram zeradas para a base ${activeBranch}. Os demais contadores estão liberados para iniciar contagem.`
    });
  };

  // Marca envio do estoque por e-mail para sincronizar todas as informações e liberar acesso total ao Master
  const markCountAsSent = (targetBranchChoice?: UnitBranch) => {
    const branchToMark = targetBranchChoice || activeBranch;
    if (branchToMark === activeBranch) {
      setIsReportSent(true);
      localStorage.setItem(getBranchStorageKey(branchToMark, 'is_report_sent'), JSON.stringify(true));
    }

    // EXIGÊNCIA: Somente quando o contador enviar o e-mail do relatório da contagem é que todas as informações
    // do dispositivo atual serão sincronizadas para o Firebase e aos demais usuários ao abrir em qualquer plataforma, computador, celular ou aba
    pushBranchToFirestore(branchToMark, {
      materials,
      freezers,
      equipments,
      materialCounts,
      equipmentCounts,
      uncataloguedEquipments,
      lastCountBackup,
      activeContadorSession,
      countStartedBy,
      isReportSent: true,
      frozenReportText,
      recontagemSelectedIds,
      recontagemMaterialCounts,
      recontagemEquipmentCounts,
      emailRecipients: recipientsText,
      updatedAt: new Date().toISOString(),
    }).catch(err => console.warn('Erro ao sincronizar envio do relatório com o Firestore:', err));

    broadcastSync('REPORT_SENT');
    addLog({
      type: 'envio',
      targetType: 'contagem',
      itemCode: 'EMAIL-SENT',
      title: `Estoque Enviado por E-mail [${branchToMark}]`,
      description: `Relatório de estoque enviado por e-mail na base ${branchToMark}. Todas as informações foram sincronizadas com o Firebase e o acesso total foi liberado para o usuário Master.`
    });
  };

  // --- AUTENTICAÇÃO / LOGIN ---
  const login = (registration: string, password: string, branchChoice?: UnitBranch): { success: boolean; message?: string } => {
    const cleanReg = registration.trim().toUpperCase();
    const cleanPass = password.trim();

    const user = users.find(u => u.registration.toUpperCase() === cleanReg);
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

    // Helper para verificar status em tempo real de contagem e sessão por base
    const getBaseStatus = (b: UnitBranch) => {
      const remote = b === 'PAULO AFONSO' ? branchStatusPA : branchStatusDEL;
      let localStarted: CountStartedBy | null = null;
      let localReportSent = false;
      let localSession: ContadorSession | null = null;
      let localHasCounts = false;
      try {
        const sStarted = localStorage.getItem(getBranchStorageKey(b, 'count_started_by'));
        if (sStarted) localStarted = JSON.parse(sStarted);
        const sSent = localStorage.getItem(getBranchStorageKey(b, 'is_report_sent'));
        if (sSent) localReportSent = JSON.parse(sSent);
        const sSess = localStorage.getItem(getBranchStorageKey(b, 'active_contador_session'));
        if (sSess) localSession = JSON.parse(sSess);
        const sMat = localStorage.getItem(getBranchStorageKey(b, 'today_materials'));
        const sEq = localStorage.getItem(getBranchStorageKey(b, 'today_equipments'));
        const sUnc = localStorage.getItem(getBranchStorageKey(b, 'today_uncatalogued'));
        if ((sMat && Object.keys(JSON.parse(sMat)).length > 0) ||
            (sEq && Object.keys(JSON.parse(sEq)).length > 0) ||
            (sUnc && JSON.parse(sUnc).length > 0)) {
          localHasCounts = true;
        }
      } catch {}

      const countStartedBy = remote.countStartedBy || localStarted;
      const isReportSent = remote.isReportSent || localReportSent;
      const activeSession = remote.activeContadorSession || localSession;
      const hasCounts = remote.hasCounts || localHasCounts;

      // Existe contagem em andamento se foi iniciada por um contador ou possui contagens ativas e o relatório por e-mail AINDA NÃO foi enviado
      const isCountInProgress = (Boolean(countStartedBy) || hasCounts || Boolean(activeSession)) && !isReportSent;

      return {
        countStartedBy,
        isReportSent,
        activeSession,
        hasCounts,
        isCountInProgress,
      };
    };

    const statusPA = getBaseStatus('PAULO AFONSO');
    const statusDEL = getBaseStatus('DELMIRO');

    // EXIGÊNCIA: Permitir apenas 1 usuário contador logado por vez no app, em cada base, informando aos demais que tentar logar: "Existe contagem em andamento.".
    // Os usuários Master também não poderão logar no app, aparecendo a mensagem: "Existe contagem em andamento.", isso para as duas bases.
    // Somente após o envio do estoque por e-mail pelo usuário contador que estiver realizando a contagem no momento é que o acesso total das funcionalidades do app serão liberados para os usuários Master.
    if (user.roleLevel === 'master') {
      if (statusPA.isCountInProgress || statusDEL.isCountInProgress) {
        return {
          success: false,
          message: 'Existe contagem em andamento.'
        };
      }
    }

    // EXIGÊNCIA: Master escolhe a base ao logar (PAULO AFONSO ou DELMIRO).
    // Usuários Contadores têm acesso estritamente à base selecionada no seu cadastro (Carlos -> PAULO AFONSO, Pedro -> DELMIRO).
    const targetBranch: UnitBranch = user.roleLevel === 'contador'
      ? (user.branch || 'PAULO AFONSO')
      : (branchChoice || activeBranch || 'PAULO AFONSO');

    if (user.roleLevel === 'contador') {
      const targetStatus = targetBranch === 'PAULO AFONSO' ? statusPA : statusDEL;

      // EXIGÊNCIA: Somente após o envio do estoque por e-mail pelo usuário contador é que o acesso é liberado para o Master.
      // Os demais usuários contadores ainda não poderão logar no app, nas duas bases.
      // Somente após as contagens serem zeradas pelo usuário Master, ou mudar o dia é que os demais contadores poderão logar e iniciar uma nova contagem.
      if (targetStatus.isReportSent) {
        return {
          success: false,
          message: 'Existe contagem em andamento.'
        };
      }

      // EXIGÊNCIA: Somente o contador que iniciou a contagem, poderá logar no app e dar continuidade a contagem iniciada no dia, isso para as duas bases.
      if (targetStatus.countStartedBy) {
        const isInitiator = targetStatus.countStartedBy.userId === user.id ||
          (targetStatus.countStartedBy.registration && targetStatus.countStartedBy.registration.toUpperCase() === cleanReg);
        if (!isInitiator) {
          return {
            success: false,
            message: 'Existe contagem em andamento.'
          };
        }
      }

      // EXIGÊNCIA: Permitir apenas 1 usuário contador logado por vez no app, em cada base,
      // informando aos demais que tentar logar: "Existe contagem em andamento."
      if (targetStatus.activeSession && targetStatus.activeSession.userId && targetStatus.activeSession.userId !== user.id) {
        const isRecent = !targetStatus.activeSession.lastHeartbeat || (Date.now() - targetStatus.activeSession.lastHeartbeat < 12 * 60 * 60 * 1000);
        if (isRecent) {
          return {
            success: false,
            message: 'Existe contagem em andamento.'
          };
        }
      }

      const newSession: ContadorSession = {
        userId: user.id,
        userName: user.name,
        registration: user.registration,
        loginTime: Date.now(),
        lastHeartbeat: Date.now(),
      };
      setActiveContadorSession(newSession);
      localStorage.setItem(getBranchStorageKey(targetBranch, 'active_contador_session'), JSON.stringify(newSession));
      pushBranchToFirestore(targetBranch, { activeContadorSession: newSession });
      broadcastSync('SESSION_UPDATE');
    }

    if (targetBranch !== activeBranch) {
      setActiveBranch(targetBranch);
    }

    setActiveUserState(user);
    localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(user));

    addLog({
      type: 'contagem',
      targetType: 'usuario',
      itemCode: user.registration,
      title: `Login Realizado: ${user.name} [Base: ${targetBranch}]`,
      description: `Acesso iniciado como ${user.roleLevel === 'master' ? '1 - Master' : '2 - Contador'} na base ${targetBranch}.`
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
    if (activeUser?.roleLevel === 'contador') {
      setActiveContadorSession(null);
      localStorage.removeItem(getBranchStorageKey(activeBranch, 'active_contador_session'));
      pushBranchToFirestore(activeBranch, { activeContadorSession: null });
      broadcastSync('SESSION_UPDATE');
    }
    setActiveUserState(null);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER);
  };

  const clearContadorSession = (targetBranchChoice?: UnitBranch) => {
    const b = targetBranchChoice || activeBranch;
    setActiveContadorSession(null);
    localStorage.removeItem(getBranchStorageKey(b, 'active_contador_session'));
    pushBranchToFirestore(b, { activeContadorSession: null });
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
      pushBranchToFirestore(activeBranch, { materials: updated });
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
      pushBranchToFirestore(activeBranch, { materials: updated });
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
      pushBranchToFirestore(activeBranch, { materials: updated });
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
      pushBranchToFirestore(activeBranch, { freezers: updated });
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
      pushBranchToFirestore(activeBranch, { freezers: updated });
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
      pushBranchToFirestore(activeBranch, { freezers: updated });
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
      pushBranchToFirestore(activeBranch, { equipments: updated });
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
      pushBranchToFirestore(activeBranch, { equipments: updated });
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
      pushBranchToFirestore(activeBranch, { equipments: updated });
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

    broadcastSync('BASE_UPDATED');
    broadcastSync('ALL_SYNC');
  };

  // --- CRUD USUÁRIOS (COM SENHA PERSISTIDA) ---
  const addUser = (userData: Omit<StockUser, 'id' | 'createdAt'>) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const now = new Date();
    const dateFormatted = formatDateBR(todayKey);
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const masterName = activeUser?.name || 'Administrador Master';
    const createdAtStr = `${masterName} - ${dateFormatted} às ${timeFormatted}`;

    const newUser: StockUser = {
      ...userData,
      id: 'usr-' + Date.now(),
      createdAt: createdAtStr,
    };
    setUsers(prev => {
      const updated = [newUser, ...prev];
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      pushUsersToFirestore(updated);
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

    setUsers(prev => {
      const updated = prev.map(u => u.id === updatedUser.id ? updatedUser : u);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      pushUsersToFirestore(updated);
      broadcastSync('USERS_UPDATED');
      return updated;
    });
    if (activeUser && activeUser.id === updatedUser.id) {
      setActiveUserState(updatedUser);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(updatedUser));
    }
    addLog({
      type: 'edicao',
      targetType: 'usuario',
      itemCode: updatedUser.registration,
      title: `Usuário Editado: [${updatedUser.registration}]`,
      description: `Dados de ${updatedUser.name} atualizados.`
    });
  };

  const deleteUser = (id: string) => {
    if (isMaster && isAnyBaseCountInProgress) return;

    const user = users.find(u => u.id === id);
    if (!user) return;

    setUsers(prev => {
      const updated = prev.filter(u => u.id !== id);
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(updated));
      pushUsersToFirestore(updated);
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

    // Limpa quaisquer sessões do usuário em ambas as bases
    (['PAULO AFONSO', 'DELMIRO'] as UnitBranch[]).forEach(b => {
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
    if (isMaster && isContadorActive) return;

    setEmailSettings(settings);
    localStorage.setItem(getBranchStorageKey(activeBranch, 'email_settings'), JSON.stringify(settings));
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
    if (isMaster && isContadorActive) return;

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
    broadcastSync('EMAIL_UPDATED');
  };

  const removeEmail = (email: string) => {
    if (isMaster && isContadorActive) return;

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
    broadcastSync('EMAIL_UPDATED');
  };

  const setDefaultEmail = (email: string) => {
    if (isMaster && isContadorActive) return;

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

    broadcastSync('EMAIL_UPDATED');
  };

  const updateServerEmailConfig = (config: ServerEmailConfig) => {
    if (isMaster && isContadorActive) return;

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
    if (isMaster && isAnyBaseCountInProgress) {
      return { materialsAdded: 0, freezersAdded: 0, equipmentsAdded: 0, message: 'Existe contagem em andamento.' };
    }

    const branchToUse = targetBranch || activeBranch;
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
    pushBranchToFirestore(branchToUse, {
      materials: finalMaterials,
      freezers: finalFreezers,
      equipments: finalEquipments
    });
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

  const clearAllData = () => {
    if (isMaster && isAnyBaseCountInProgress) return;

    // EXIGÊNCIA: Na tela Cadastros, ao clicar o botão "Zerar Todos os Cadastros",
    // manter as informações no campo "PRÉVIA DO RELATÓRIO" caso tenha alguma informação de contagens.
    const hasAnyCounts =
      Object.keys(materialCounts).length > 0 ||
      Object.keys(equipmentCounts).length > 0 ||
      uncataloguedEquipments.length > 0;

    if (hasAnyCounts) {
      const generated = generateStockReportText({
        selectedStock: 'ambos',
        todayDateFormatted: formatDateBR(todayKey),
        activeUser,
        defaultSenderEmail,
        recipients: emailSettings.emails,
        materials,
        freezers,
        equipments,
        uncataloguedEquipments,
        materialCounts,
        equipmentCounts,
        includeEquipmentDefects: true,
      });
      setFrozenReportText(generated);
      localStorage.setItem(getBranchStorageKey(activeBranch, 'frozen_report'), generated);
    }

    // EXIGÊNCIA 3: Na tela Cadastro, ao pressionar o botão "Zerar Todos os Cadastros", limpar também os equipamentos contados que não estão cadastrados na base ativa.
    setMaterials([]);
    setFreezers([]);
    setEquipments([]);
    setUncataloguedEquipments([]);
    localStorage.removeItem(getBranchStorageKey(activeBranch, 'materials'));
    localStorage.removeItem(getBranchStorageKey(activeBranch, 'freezers'));
    localStorage.removeItem(getBranchStorageKey(activeBranch, 'equipments'));
    localStorage.removeItem(getBranchStorageKey(activeBranch, 'today_uncatalogued'));

    pushBranchToFirestore(activeBranch, {
      materials: [],
      freezers: [],
      equipments: [],
      uncataloguedEquipments: []
    });

    broadcastSync('BASE_UPDATED');
  };

  // --- GESTÃO DE RECONTAGEM (100% INDEPENDENTE POR BASE) ---
  const toggleRecontagemItem = (id: string) => {
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
    setRecontagemSelectedIds({});
    setRecontagemMaterialCounts({});
    setRecontagemEquipmentCounts({});
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_selected_ids'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_material_counts'), JSON.stringify({}));
    localStorage.setItem(getBranchStorageKey(activeBranch, 'recontagem_equipment_counts'), JSON.stringify({}));
    broadcastSync('RECONTAGEM_UPDATED');
  };

  const updateRecontagemMaterialCount = (itemId: string, data: Partial<MaterialDailyEntry>) => {
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

  // Total de itens selecionados e que de fato possuem contagem inserida hoje
  const recontagemSelectedCount = useMemo(() => {
    let count = 0;
    materials.forEach(m => {
      const c = materialCounts[m.id];
      const hasCount = c && (
        (c.disponivel || 0) > 0 ||
        (c.danificado || 0) > 0 ||
        (c.barrilCheio || 0) > 0 ||
        (c.barrilVazio || 0) > 0 ||
        (c.barrilEmRota || 0) > 0 ||
        (c.co2Cheio || 0) > 0 ||
        (c.co2Mexido || 0) > 0 ||
        (c.co2Vazio || 0) > 0 ||
        (c.co2EmRota || 0) > 0
      );
      if (recontagemSelectedIds[m.id] && hasCount) {
        count++;
      }
    });
    freezers.forEach(f => {
      if (recontagemSelectedIds[f.id] && equipmentCounts[f.id]?.status) {
        count++;
      }
    });
    equipments.forEach(eq => {
      if (recontagemSelectedIds[eq.id] && equipmentCounts[eq.id]?.status) {
        count++;
      }
    });
    return count;
  }, [materials, freezers, equipments, recontagemSelectedIds, materialCounts, equipmentCounts]);

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
        activeContadorSession,
        isContadorActive,
        clearContadorSession,
        countStartedBy,
        isReportSent,
        isCountInProgress,
        isAnyBaseCountInProgress,
        canActiveUserCount,
        cantCountReason,
        markCountAsSent,
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
