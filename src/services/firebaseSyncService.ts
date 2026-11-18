import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer, 
  onSnapshot 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  MaterialItem, 
  FreezerItem, 
  EquipmentItem, 
  MaterialDailyEntry, 
  EquipmentDailyEntry, 
  UncataloguedEquipment, 
  LastCountBackup, 
  ContadorSession,
  CountStartedBy,
  EmailSettings,
  ServerEmailConfig,
  StockUser, 
  UnitBranch 
} from '../types/inventory';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Testa a conexão na inicialização conforme diretriz mandatória
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Using local cache.');
    }
    return false;
  }
}
testConnection();

/**
 * Remove recursivamente todas as propriedades com valor 'undefined' de objetos e arrays
 * para que o Firestore nunca rejeite o payload com:
 * "Unsupported field value: undefined"
 */
export function removeUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return undefined as unknown as T;
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => removeUndefinedDeep(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined) {
      cleaned[k] = removeUndefinedDeep(v);
    }
  }
  return cleaned as T;
}

export interface BranchSyncPayload {
  branch: UnitBranch;
  materials?: MaterialItem[];
  freezers?: FreezerItem[];
  equipments?: EquipmentItem[];
  materialCounts?: Record<string, MaterialDailyEntry>;
  equipmentCounts?: Record<string, EquipmentDailyEntry>;
  uncataloguedEquipments?: UncataloguedEquipment[];
  lastCountBackup?: LastCountBackup | null;
  activeContadorSession?: ContadorSession | null;
  countStartedBy?: CountStartedBy | null;
  isReportSent?: boolean;
  countDate?: string;
  frozenReportText?: string | null;
  recontagemSelectedIds?: Record<string, boolean>;
  recontagemMaterialCounts?: Record<string, MaterialDailyEntry>;
  recontagemEquipmentCounts?: Record<string, EquipmentDailyEntry>;
  recontagemUnlocked?: boolean;
  recontagemTargetContador?: CountStartedBy | null;
  emailRecipients?: string;
  emailSettings?: EmailSettings;
  serverEmailConfig?: ServerEmailConfig;
  updatedAt?: string;
}

export interface AppConfigPayload {
  id: string;
  users?: StockUser[];
  updatedAt?: string;
}

export const getBranchDocId = (branch: UnitBranch): string => {
  return branch === 'PAULO AFONSO' ? 'PAULO_AFONSO' : 'DELMIRO';
};

/**
 * Busca dados da base diretamente no servidor Firestore (sem manter listener contínuo)
 */
export async function fetchBranchData(branch: UnitBranch): Promise<BranchSyncPayload | null> {
  const docId = getBranchDocId(branch);
  const docRef = doc(db, 'branches', docId);
  try {
    const snap = await getDocFromServer(docRef);
    if (snap.exists()) {
      return snap.data() as BranchSyncPayload;
    }
    return null;
  } catch (error) {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as BranchSyncPayload;
      }
      return null;
    } catch (innerError) {
      console.warn(`Erro ao buscar dados da base ${branch}:`, error, innerError);
      return null;
    }
  }
}

/**
 * Busca lista de usuários diretamente no servidor Firestore (sem manter listener contínuo)
 */
export async function fetchUsersFromFirestore(): Promise<StockUser[] | null> {
  const docRef = doc(db, 'appConfig', 'users');
  try {
    const snap = await getDocFromServer(docRef);
    if (snap.exists()) {
      const data = snap.data() as AppConfigPayload;
      if (data.users && Array.isArray(data.users)) {
        return data.users;
      }
    }
    return null;
  } catch (error) {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as AppConfigPayload;
        if (data.users && Array.isArray(data.users)) {
          return data.users;
        }
      }
      return null;
    } catch (innerError) {
      console.warn('Erro ao buscar usuários no Firestore:', error, innerError);
      return null;
    }
  }
}

/**
 * Escuta atualizações em tempo real da base especificada (PAULO AFONSO ou DELMIRO).
 * Qualquer alteração realizada em outro dispositivo, computador ou plataforma
 * é refletida imediatamente no aplicativo.
 */
export function subscribeToBranch(
  branch: UnitBranch, 
  onData: (data: BranchSyncPayload) => void,
  onError?: (error: unknown) => void,
  onInitialEmpty?: () => void
) {
  const docId = getBranchDocId(branch);
  const path = `branches/${docId}`;
  const docRef = doc(db, 'branches', docId);

  return onSnapshot(
    docRef, 
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as BranchSyncPayload;
        onData(data);
      } else {
        if (onInitialEmpty) onInitialEmpty();
      }
    }, 
    (error) => {
      console.warn(`Erro no listener da base ${branch}:`, error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

/**
 * Escuta atualizações da configuração global de usuários.
 */
export function subscribeToUsers(
  onData: (users: StockUser[]) => void,
  onError?: (error: unknown) => void,
  onInitialEmpty?: () => void
) {
  const path = 'appConfig/users';
  const docRef = doc(db, 'appConfig', 'users');

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppConfigPayload;
        if (data.users && Array.isArray(data.users)) {
          onData(data.users);
        }
      } else {
        if (onInitialEmpty) onInitialEmpty();
      }
    },
    (error) => {
      console.warn('Erro no listener de usuários:', error);
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function isQuotaExceededError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code) : '';
  return (
    code === 'resource-exhausted' ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('Quota exceeded')
  );
}

// Salva dados da base no Firestore, limpando recursivamente valores undefined
export async function pushBranchToFirestore(branch: UnitBranch, payload: Partial<BranchSyncPayload>): Promise<void> {
  const docId = getBranchDocId(branch);
  const path = `branches/${docId}`;
  try {
    const docRef = doc(db, 'branches', docId);
    const rawData = {
      ...payload,
      branch,
      updatedAt: new Date().toISOString()
    };
    const cleanedData = removeUndefinedDeep(rawData);
    if (payload.materials !== undefined) {
      await setDoc(docRef, cleanedData);
    } else {
      await setDoc(docRef, cleanedData, { merge: true });
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn(`Cota diária do Firestore excedida ao salvar ${path}. Aguardando redefinição da cota diária.`);
      throw new Error('Quota limit exceeded: Free daily write units per project exceeded.');
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Salva usuários no Firestore, limpando recursivamente valores undefined
export async function pushUsersToFirestore(users: StockUser[]): Promise<void> {
  const path = 'appConfig/users';
  try {
    const docRef = doc(db, 'appConfig', 'users');
    const cleanedUsers = removeUndefinedDeep(users);
    await setDoc(docRef, {
      id: 'users',
      users: cleanedUsers,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn(`Cota diária do Firestore excedida ao salvar ${path}. Aguardando redefinição da cota diária.`);
      throw new Error('Quota limit exceeded: Free daily write units per project exceeded.');
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
