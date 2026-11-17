
export type MaterialCategory = 
  | 'mesa_plastica'
  | 'mesa_madeira'
  | 'cadeira_plastica_com_braco'
  | 'cadeira_plastica_sem_braco'
  | 'cadeira_madeira'
  | 'caixa_termica'
  | 'barril'
  | 'co2';

export type EquipmentType = 'chopeira_1_torneira' | 'chopeira_2_torneiras';

export type ItemStatus = 'disponivel' | 'danificado';

// Cadastro de Material (Sem estoque inicial / contagem cega, sem campo nome/nomenclatura digitado manualmente)
export interface MaterialItem {
  id: string;
  code: string; // Código informado no cadastro
  name: string; // Gerado/selecionado a partir do tipo e subopção de marca
  category: MaterialCategory;
  subOption?: string; // Opção selecionada (ex: DEVASSA AMARELA, BARRIL 50L)
  description?: string;
  createdAt: string;
}

// Cadastro de Freezer (código separado do patrimônio, marca e modelo por botões)
export interface FreezerItem {
  id: string;
  code: string; // Código do Freezer
  patrimony: string; // Plaqueta de Patrimônio
  name: string; // Gerado automaticamente: Freezer [Marca] [Modelo]
  brand: 'NOVA SCHIN' | 'AMSTEL' | 'HEINEKEN' | 'DEVASSA' | 'VIVA' | string;
  model: '4 CAIXAS' | '8 CAIXAS' | string;
  tipo?: 'PADRÃO' | 'SLIM' | string; // Informa se o modelo é SLIM
  isSlim?: boolean;
  identity?: 'PORTA CEGA' | 'PORTA VIDRO' | 'JANELA VIDRO' | string; // Identidade do Freezer (IDT)
  voltage: '110V' | '220V' | 'Bivolt';
  defect?: string; // Defeito do equipamento caso o tenha, salvo na base
  observations?: string; // Observações do cadastro
  createdAt: string;
}

// Cadastro de Chopeiras Elétricas (1 Torneira ou 2 Torneiras, código e patrimônio separados, sem manual/gelo)
export interface EquipmentItem {
  id: string;
  code: string; // Código do Equipamento
  patrimony: string; // Plaqueta de Patrimônio
  name: string; // Identificação manual acrescida das seleções
  type: EquipmentType; // Chopeira de 1 Torneira ou 2 Torneiras
  brand?: string;
  model?: 'AMSTEL' | 'HEINEKEN' | 'DEVASSA' | string;
  voltage: '110V' | '220V' | 'Bivolt';
  defect?: string; // Defeito do equipamento caso o tenha, salvo na base
  observations?: string; // Observações do cadastro
  createdAt: string;
}

// Equipamentos Encontrados não cadastrados na base (apenas na contagem)
export interface UncataloguedEquipment {
  id: string;
  patrimony: string; // Patrimônio do equipamento encontrado
  observations: string; // Observações / detalhes
  status: 'disponivel' | 'danificado';
  damageDescription?: string;
  createdAt: string;
}

// 1 - Usuário Master (todas as telas) | 2 - Usuário Contador (Materiais, Equipamentos, Exportar)
export type UserAccessLevel = 'master' | 'contador';
export type UserRoleLevel = UserAccessLevel;

export interface SmtpConfig {
  host: string; // Ex: smtp.gmail.com, smtp.office365.com, smtp.grupo.ms
  port: number; // Ex: 587, 465, 25
  secure?: boolean; // SSL (true para 465, false para 587/STARTTLS)
  user?: string; // Usuário/e-mail para autenticação no servidor
  pass?: string; // Senha ou senha de app do servidor
  senderName?: string; // Nome do remetente exibido
}

// Configuração completa de servidores POP e SMTP para o e-mail de remetente padrão (Global)
export interface ServerEmailConfig {
  senderEmail: string;
  senderName: string;
  // SMTP (Envio)
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  // POP (Recepção / Validação de Caixa)
  popHost: string;
  popPort: number;
  popSecure: boolean;
  popUser: string;
  // Status de Comunicação
  communicationStatus?: 'E-mail: Ok' | 'E-mail: Erro';
  statusMessage?: string;
  testedAt?: string;
  lastTestStatus?: 'ok' | 'error';
  lastTestedAt?: string;
}

export type UnitBranch = 'PAULO AFONSO' | 'DELMIRO';

export interface StockUser {
  id: string;
  registration: string; // Matrícula que é o próprio código do usuário
  name: string;
  email?: string; // Campo opcional (não exigido no cadastro individual)
  password: string; // Senha de acesso para login
  roleLevel: UserAccessLevel; // 1-Master ou 2-Contador
  branch?: UnitBranch; // Base permitida para Contador (PAULO AFONSO ou DELMIRO). Master tem acesso a ambas.
  status: 'ativo' | 'inativo';
  createdAt: string; // Nome do Master que cadastrou + data e hora
}

// Estrutura da Contagem Diária para Materiais
export interface MaterialDailyEntry {
  itemId: string;
  // Para materiais normais (Mesas, Cadeiras, Caixas Térmicas):
  disponivel: number;
  danificado: number;
  
  // Para Barris (Cheio, Vazio, Em Rota):
  barrilCheio?: number;
  barrilVazio?: number;
  barrilEmRota?: number;

  // Para CO2 (Cheio, Mexido, Vazio, Em Rota):
  co2Cheio?: number;
  co2Mexido?: number;
  co2Vazio?: number;
  co2EmRota?: number;
}

// Estrutura da Contagem Diária para Equipamentos (Freezers e Chopeiras cadastrados)
export interface EquipmentDailyEntry {
  itemId: string;
  status?: 'disponivel' | 'danificado' | 'em_estoque' | 'nao_consta';
  damageDescription?: string;
}

// Tipos de grupos para clonagem seletiva pelo Master
export type CloneGroupTarget = 
  | 'todos' 
  | 'todos_materiais' 
  | 'todos_equipamentos' 
  | 'todos_freezers' 
  | 'todas_chopeiras'
  | 'chopeira_1_torneira'
  | 'chopeira_2_torneiras'
  | MaterialCategory;

// Backup da última contagem realizada para fins de clonagem pelo Master
export interface LastCountBackup {
  date: string; // YYYY-MM-DD
  materials: Record<string, MaterialDailyEntry>;
  equipments: Record<string, EquipmentDailyEntry>;
  uncatalogued: UncataloguedEquipment[];
  savedAt: string;
}

// Sessão de Contador ativo no aplicativo (apenas 1 Contador permitido por vez por base)
export interface ContadorSession {
  userId: string;
  userName: string;
  registration: string;
  loginTime: number;
  lastHeartbeat?: number;
}

// Registro do Contador que iniciou a contagem na base
export interface CountStartedBy {
  userId: string;
  userName: string;
  registration: string;
  startedAt: number;
}

// Configurações de Opções de Envio por E-mail
export interface EmailSettings {
  emails: string[];
  defaultEmail: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: 'inclusao' | 'edicao' | 'exclusao' | 'contagem' | 'envio';
  targetType: 'material' | 'freezer' | 'equipamento' | 'usuario' | 'contagem';
  itemCode: string;
  title: string;
  description: string;
}
