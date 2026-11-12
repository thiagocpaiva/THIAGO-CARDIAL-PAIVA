
import { 
  MaterialItem, 
  FreezerItem, 
  EquipmentItem, 
  SystemLog, 
  StockUser,
  EmailSettings,
  ServerEmailConfig
} from '../types/inventory';

export const INITIAL_MATERIALS: MaterialItem[] = [];

export const INITIAL_FREEZERS: FreezerItem[] = [];

export const INITIAL_EQUIPMENTS: EquipmentItem[] = [];

export const INITIAL_SERVER_EMAIL_CONFIG: ServerEmailConfig = {
  senderEmail: 'thiago.paiva@grupo.ms',
  senderName: 'CONTAGEM DE ESTOQUE - Oficial',
  smtpHost: 'smtp.grupo.ms',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: 'thiago.paiva@grupo.ms',
  smtpPass: '',
  popHost: 'pop.grupo.ms',
  popPort: 995,
  popSecure: true,
  popUser: 'thiago.paiva@grupo.ms',
  communicationStatus: 'E-mail: Ok',
  statusMessage: 'Comunicação estabelecida com smtp.grupo.ms:587 / pop.grupo.ms:995.',
  testedAt: '09/10/2026',
};

export const INITIAL_USERS: StockUser[] = [
  {
    id: 'usr-master-1',
    registration: '1001',
    name: 'Administrador Master',
    password: 'admin',
    roleLevel: 'master',
    status: 'ativo',
    createdAt: 'Sistema - 08/10/2026 às 08:00',
  },
  {
    id: 'usr-contador-1',
    registration: '2001',
    name: 'Carlos Conferente',
    password: '1234',
    roleLevel: 'contador',
    branch: 'PAULO AFONSO',
    status: 'ativo',
    createdAt: 'Administrador Master - 08/10/2026 às 08:30',
  },
  {
    id: 'usr-contador-2',
    registration: '2002',
    name: 'Pedro Conferente',
    password: '1234',
    roleLevel: 'contador',
    branch: 'DELMIRO',
    status: 'ativo',
    createdAt: 'Administrador Master - 08/10/2026 às 08:35',
  }
];

export const INITIAL_EMAIL_SETTINGS: EmailSettings = {
  emails: ['thiago.paiva@grupo.ms'],
  defaultEmail: 'thiago.paiva@grupo.ms',
};

export const INITIAL_LOGS: SystemLog[] = [];
