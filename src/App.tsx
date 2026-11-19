
import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Navigation, MainTab } from './components/Navigation';

import { LoginView } from './components/views/LoginView';
import { MateriaisView } from './components/views/MateriaisView';
import { EquipamentosView } from './components/views/EquipamentosView';
import { GestaoCadastrosView } from './components/views/GestaoCadastrosView';
import { ExportarEstoqueView } from './components/views/ExportarEstoqueView';
import { UsuariosView } from './components/views/UsuariosView';
import { OpcoesEnvioView } from './components/views/OpcoesEnvioView';
import { RecontagemView } from './components/views/RecontagemView';

import { CadastrarMaterialModal } from './components/modals/CadastrarMaterialModal';
import { CadastrarFreezerModal } from './components/modals/CadastrarFreezerModal';
import { CadastrarEquipamentoModal } from './components/modals/CadastrarEquipamentoModal';

import { MaterialItem, MaterialCategory, FreezerItem, EquipmentItem } from './types/inventory';
import { Wifi, Battery, Signal, Lock, AlertTriangle, Check, X, RefreshCw, ShieldCheck } from 'lucide-react';

const AppContent: React.FC = () => {
  const { 
    activeUser, 
    isMaster, 
    isCoringa,
    recloneTestBasesFromApp,
    isContadorActive, 
    activeContadorSession, 
    clearContadorSession,
    isAnyBaseCountInProgress,
    isCountInProgress,
    isReportSent,
    recontagemUnlocked,
    isRecontagemTabsBlockedForContador,
    countStartedBy,
    isPhoneFrame,
    setIsPhoneFrame,
    emptyMaterialCodesAlert,
    setEmptyMaterialCodesAlert,
    systemNotice,
    setSystemNotice
  } = useInventory();

  React.useEffect(() => {
    if (!systemNotice) return;
    const timer = setTimeout(() => setSystemNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [systemNotice, setSystemNotice]);
  
  const [activeTab, setActiveTab] = useState<MainTab>('materiais');

  // Ao logar como Contador (exceto CORINGA em modo teste) ou quando houver recontagem ativa: abre direto na tela Recontagem
  React.useEffect(() => {
    if (activeUser && activeUser.roleLevel === 'contador' && !isCoringa) {
      if (recontagemUnlocked || isRecontagemTabsBlockedForContador) {
        setActiveTab('recontagem');
      } else {
        setActiveTab('materiais');
      }
    } else if (activeUser && isCoringa) {
      setActiveTab('materiais');
    }
  }, [activeUser?.id, activeUser?.roleLevel, isCoringa, recontagemUnlocked, isRecontagemTabsBlockedForContador]);

  // Modals state: Material
  const [isCreateMaterialOpen, setIsCreateMaterialOpen] = useState(false);
  const [materialToEdit, setMaterialToEdit] = useState<MaterialItem | null>(null);
  const [defaultMaterialCat, setDefaultMaterialCat] = useState<MaterialCategory>('mesa_plastica');

  // Modals state: Freezer
  const [isCreateFreezerOpen, setIsCreateFreezerOpen] = useState(false);
  const [freezerToEdit, setFreezerToEdit] = useState<FreezerItem | null>(null);

  // Modals state: Equipamento (Chopeira Elétrica)
  const [isCreateEquipmentOpen, setIsCreateEquipmentOpen] = useState(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<EquipmentItem | null>(null);

  // Filtro inicial para a aba Cadastros
  const [cadastrosFilter, setCadastrosFilter] = useState<'all' | 'materiais' | 'freezers' | 'equipamentos' | 'nao_cadastrados'>('all');

  // Handlers for editing
  const handleOpenEditMaterial = (m: MaterialItem) => {
    setMaterialToEdit(m);
    setIsCreateMaterialOpen(true);
  };

  const handleOpenEditFreezer = (f: FreezerItem) => {
    setFreezerToEdit(f);
    setIsCreateFreezerOpen(true);
  };

  const handleOpenEditEquipment = (eq: EquipmentItem) => {
    setEquipmentToEdit(eq);
    setIsCreateEquipmentOpen(true);
  };

  // Se nenhum usuário estiver logado, exibe a tela de login obrigatória
  if (!activeUser) {
    return <LoginView />;
  }

  // Verificação de permissões: Cadastros, Usuários e Opções de Envio bloqueadas para Contador;
  // Durante recontagem para o Contador, Materiais, Equipamentos e Exportar também ficam bloqueadas até Master zerar a contagem.
  const isRestrictedTab = (!isMaster) && (
    activeTab === 'cadastros' ||
    activeTab === 'usuarios' ||
    activeTab === 'opcoes_envio' ||
    (isRecontagemTabsBlockedForContador && activeTab !== 'recontagem')
  );

  return (
    <div className={`min-h-screen bg-white text-slate-900 flex justify-center items-start ${isPhoneFrame ? 'py-4 sm:py-8 bg-slate-100' : ''}`}>
      
      {/* Mobile container */}
      <div 
        className={`w-full transition-all duration-300 flex flex-col bg-white ${
          isPhoneFrame 
            ? 'max-w-[420px] rounded-[44px] border-[6px] border-slate-300 bg-white shadow-2xl overflow-hidden min-h-[850px] relative' 
            : 'max-w-2xl min-h-screen border-x border-slate-200'
        }`}
      >
        
        {/* Smartphone simulated status bar when in phone frame */}
        {isPhoneFrame && (
          <div className="bg-white px-6 pt-3 pb-1 flex justify-between items-center text-[11px] text-slate-500 select-none border-b border-slate-100">
            <span className="font-semibold text-slate-900">09:41</span>
            <div className="w-20 h-4 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-slate-300 mr-2"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/80"></div>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <Battery className="w-3.5 h-3.5 text-emerald-600" />
            </div>
          </div>
        )}

        {/* Header Navigation */}
        <Navigation
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          isPhoneFrame={isPhoneFrame}
          onTogglePhoneFrame={() => setIsPhoneFrame(!isPhoneFrame)}
        />

        {/* View Content Area */}
        <main className="flex-1 p-3.5 sm:p-4 overflow-y-auto bg-white">
          
          {isCoringa && (
            <div className="mb-3.5 p-3 bg-indigo-50 border-2 border-indigo-300 rounded-2xl shadow-xs text-indigo-950 flex items-center justify-between gap-2.5 flex-wrap animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-indigo-950 leading-tight">
                    MODO TESTE ISOLADO • CORINGA (9999)
                  </p>
                  <p className="text-[10px] text-indigo-800 mt-0.5 leading-snug">
                    Bases teste clonadas localmente. Nenhuma ação sincroniza com o Firebase nem interfere nos usuários Master, Contadores ou bases reais.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={recloneTestBasesFromApp}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95 transition-all"
                title="Reclonar todos os dados atuais das bases reais (PAULO AFONSO e DELMIRO) para as bases teste"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reclonar Bases do App</span>
              </button>
            </div>
          )}

          {systemNotice && (
            <div className="mb-3.5 p-3 bg-emerald-50 border border-emerald-300 rounded-2xl shadow-xs text-emerald-950 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{systemNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setSystemNotice(null)}
                className="p-1 text-emerald-700 hover:text-emerald-900 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Alerta Global para Usuário Master quando há Contagem em Andamento */}
          {isMaster && isAnyBaseCountInProgress && (
            <div className="mb-3.5 p-3.5 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm text-slate-900 flex items-center justify-between gap-2.5 animate-in fade-in">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-xs">
                  <AlertTriangle className="w-4.5 h-4.5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-950 leading-tight">
                    Existe contagem em andamento.
                  </p>
                  <p className="text-[10px] text-amber-900 mt-0.5">
                    Modo somente leitura ativo: não é permitida nenhuma mudança no cadastro de Materiais, Equipamentos e Usuários, nem alteração na contagem desta base até o envio por e-mail.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 font-bold text-[10px] uppercase font-mono">
                  Bloqueado
                </span>
                {activeContadorSession && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Deseja liberar a sessão do Contador agora? Isso permitirá edições pelo Master.')) {
                        clearContadorSession();
                      }
                    }}
                    className="text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-2 py-1 rounded-xl shadow-xs cursor-pointer"
                    title="Liberar trava de sessão do Contador"
                  >
                    Liberar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bloqueio de Acesso para Usuário Contador */}
          {isRestrictedTab ? (
            <div className="text-center py-16 px-4 bg-white border border-rose-200 rounded-3xl space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <Lock className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                {isRecontagemTabsBlockedForContador ? 'Tela Bloqueada — Recontagem' : 'Acesso Restrito'}
              </h3>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                {isRecontagemTabsBlockedForContador ? (
                  <>
                    As telas <strong>Materiais</strong>, <strong>Equipamentos</strong> e <strong>Exportar</strong> ficam bloqueadas enquanto houver recontagem para você até que o usuário Master zere a contagem.
                  </>
                ) : (
                  <>
                    Esta tela está bloqueada para o nível <strong>2 - Usuário Contador</strong>. 
                    Apenas <strong>1 - Usuário Master</strong> possui permissão para acessar Cadastros, Usuários e Opções de Envio.
                  </>
                )}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab(isRecontagemTabsBlockedForContador ? 'recontagem' : 'materiais')}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {isRecontagemTabsBlockedForContador ? 'Ir para Tela de Recontagem' : 'Voltar para Contagem de Materiais'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* TELA DE CONTAGEM DE MATERIAIS */}
              {activeTab === 'materiais' && (
                <MateriaisView />
              )}

              {/* TELA DE CONTAGEM DE EQUIPAMENTOS (FREEZERS E CHOPEIRAS) */}
              {activeTab === 'equipamentos' && (
                <EquipamentosView />
              )}

              {/* TELA DE RECONTAGEM (Master para seleção, Contador para recontar) */}
              {activeTab === 'recontagem' && (
                <RecontagemView />
              )}

              {/* TELA PARA CADASTRO, EXCLUSÃO E EDIÇÃO (Apenas Master) */}
              {activeTab === 'cadastros' && (
                <GestaoCadastrosView
                  initialFilterType={cadastrosFilter}
                  onOpenCreateMaterial={() => {
                    setMaterialToEdit(null);
                    setDefaultMaterialCat('mesa_plastica');
                    setIsCreateMaterialOpen(true);
                  }}
                  onOpenCreateFreezer={() => {
                    setFreezerToEdit(null);
                    setIsCreateFreezerOpen(true);
                  }}
                  onOpenCreateEquipment={() => {
                    setEquipmentToEdit(null);
                    setIsCreateEquipmentOpen(true);
                  }}
                  onEditMaterial={handleOpenEditMaterial}
                  onEditFreezer={handleOpenEditFreezer}
                  onEditEquipment={handleOpenEditEquipment}
                />
              )}

              {/* TELA DE EXPORTAÇÃO DO ESTOQUE */}
              {activeTab === 'exportar' && (
                <ExportarEstoqueView onNavigateToOpcoesEnvio={() => setActiveTab('opcoes_envio')} />
              )}

              {/* TELA DE CADASTRO DE USUÁRIOS (Apenas Master) */}
              {activeTab === 'usuarios' && (
                <UsuariosView />
              )}

              {/* TELA DE OPÇÕES DE ENVIO / E-MAILS (Apenas Master) */}
              {activeTab === 'opcoes_envio' && (
                <OpcoesEnvioView onNavigateToExportar={() => setActiveTab('exportar')} />
              )}
            </>
          )}

        </main>

        {/* Spacer for bottom navigation */}
        <div className="h-16 shrink-0"></div>

      </div>

      {/* MODALS */}
      
      {/* Cadastrar / Editar Material */}
      <CadastrarMaterialModal
        isOpen={isCreateMaterialOpen}
        onClose={() => {
          setIsCreateMaterialOpen(false);
          setMaterialToEdit(null);
        }}
        materialToEdit={materialToEdit}
        defaultCategory={defaultMaterialCat}
      />

      {/* Cadastrar / Editar Freezer */}
      <CadastrarFreezerModal
        isOpen={isCreateFreezerOpen}
        onClose={() => {
          setIsCreateFreezerOpen(false);
          setFreezerToEdit(null);
        }}
        freezerToEdit={freezerToEdit}
      />

      {/* Cadastrar / Editar Equipamento (Chopeira Elétrica) */}
      <CadastrarEquipamentoModal
        isOpen={isCreateEquipmentOpen}
        onClose={() => {
          setIsCreateEquipmentOpen(false);
          setEquipmentToEdit(null);
        }}
        equipmentToEdit={equipmentToEdit}
      />

      {/* EXIGÊNCIA 10: Lembrete logo após ser logado com o usuário Master se houver materiais sem código */}
      {isMaster && emptyMaterialCodesAlert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-white border-2 border-amber-400 w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl text-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base uppercase">Lembrete do Sistema</h3>
                <p className="text-xs text-amber-800 font-bold">Identificação de Itens na Base</p>
              </div>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm font-semibold text-amber-950 leading-relaxed">
              {emptyMaterialCodesAlert}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEmptyMaterialCodesAlert(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmptyMaterialCodesAlert(null);
                  setCadastrosFilter('nao_cadastrados');
                  setActiveTab('cadastros');
                }}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <span>Verificar no Cadastro</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export function App() {
  return (
    <InventoryProvider>
      <AppContent />
    </InventoryProvider>
  );
}

export default App;
