
import React, { useState } from 'react';
import { 
  Layers, 
  Zap, 
  Edit3, 
  Share2, 
  Users, 
  Settings, 
  LogOut,
  Smartphone,
  Maximize2,
  MapPin,
  ChevronDown,
  RotateCcw,
  Lock
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { AppBrandIcon } from './AppBrandIcons';

export type MainTab = 
  | 'materiais' 
  | 'equipamentos' 
  | 'recontagem'
  | 'cadastros' 
  | 'exportar' 
  | 'usuarios'
  | 'opcoes_envio';

interface NavigationProps {
  activeTab: MainTab;
  onChangeTab: (tab: MainTab) => void;
  isPhoneFrame: boolean;
  onTogglePhoneFrame: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  isPhoneFrame,
  onTogglePhoneFrame,
}) => {
  const {
    activeUser,
    isMaster,
    logout,
    todayDateFormatted,
    activeBranch,
    setActiveBranch,
    recontagemSelectedCount,
    isReportSent,
    recontagemUnlocked,
    isRecontagemTabsBlockedForContador
  } = useInventory();
  const [isBranchMenuOpen, setIsBranchMenuOpen] = useState(false);

  // Para Usuários Master: Exibe todos os 6 botões (Materiais, Equipamentos, Recontagem, Cadastros, Exportar, Usuários)
  // Para Usuários Contadores: Exibe Materiais, Equipamentos, (Recontagem caso liberada/haja itens a recontar) e Exportar
  const tabs = [
    { id: 'materiais' as MainTab, label: 'Materiais', icon: Layers, badge: undefined as number | undefined },
    { id: 'equipamentos' as MainTab, label: 'Equipamentos', icon: Zap, badge: undefined as number | undefined },
    ...(isMaster
      ? [{ id: 'recontagem' as MainTab, label: 'Recontagem', icon: RotateCcw, badge: recontagemSelectedCount > 0 ? recontagemSelectedCount : undefined }]
      : (recontagemSelectedCount > 0 || recontagemUnlocked || (isReportSent && recontagemUnlocked))
        ? [{ id: 'recontagem' as MainTab, label: 'Recontagem', icon: RotateCcw, badge: recontagemSelectedCount > 0 ? recontagemSelectedCount : undefined }]
        : []
    ),
    ...(isMaster ? [{ id: 'cadastros' as MainTab, label: 'Cadastros', icon: Edit3, badge: undefined as number | undefined }] : []),
    { id: 'exportar' as MainTab, label: 'Exportar', icon: Share2, badge: undefined as number | undefined },
    ...(isMaster ? [{ id: 'usuarios' as MainTab, label: 'Usuários', icon: Users, badge: undefined as number | undefined }] : []),
  ];

  const isTabLockedForContador = (tabId: MainTab) => {
    if (isMaster || !isRecontagemTabsBlockedForContador) return false;
    return tabId === 'materiais' || tabId === 'equipamentos' || tabId === 'exportar';
  };

  const handleTabClick = (tab: typeof tabs[0]) => {
    if (isTabLockedForContador(tab.id)) {
      return;
    }
    onChangeTab(tab.id);
  };

  const handleLogout = () => {
    logout();
  };

  // Determina se deve exibir o ícone do app no cabeçalho (oculto nas telas de contagem de materiais e equipamentos conforme solicitado)
  const showBrandIconInHeader = activeTab !== 'materiais' && activeTab !== 'equipamentos';
  const iconBrandType = 'full';

  return (
    <>
      {/* Top Header com Fundo Branco */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          
          {/* Ícone dinâmico do app */}
          {showBrandIconInHeader && (
            <div className="shrink-0 hidden xs:block">
              <AppBrandIcon type={iconBrandType} size="sm" className="border border-slate-200 shadow-xs" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 uppercase truncate">
              CONTAGEM DE ESTOQUE
            </h1>
            {activeUser ? (
              <div className="flex items-center gap-1.5 text-[10px] leading-tight flex-wrap">
                <span className="text-slate-700 font-semibold truncate max-w-[100px] xs:max-w-[130px] sm:max-w-[160px]">
                  {activeUser.name}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border shrink-0 ${
                  activeUser.roleLevel === 'master'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  {activeUser.roleLevel === 'master' ? 'Master' : 'Contador'}
                </span>

                {/* Base Ativa: PAULO AFONSO ou DELMIRO (Oculto na tela Usuários pois as configurações servem para ambas as bases) */}
                {activeTab !== 'usuarios' && (
                  isMaster ? (
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={() => setIsBranchMenuOpen(prev => !prev)}
                        className="px-1.5 py-0.5 rounded text-[9px] font-black border shrink-0 bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300 flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                        title="Clique para alternar a base de estoque ativa"
                      >
                        <MapPin className="w-2.5 h-2.5 text-amber-700" />
                        <span>{activeBranch}</span>
                        <ChevronDown className="w-2.5 h-2.5 text-amber-800" />
                      </button>
                      {isBranchMenuOpen && (
                        <div className="absolute left-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[125px] text-xs font-bold animate-in fade-in">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveBranch('PAULO AFONSO');
                              setIsBranchMenuOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 hover:bg-amber-50 flex items-center justify-between text-[10px] ${
                              activeBranch === 'PAULO AFONSO' ? 'text-amber-900 font-black bg-amber-50/70' : 'text-slate-700'
                            }`}
                          >
                            <span>PAULO AFONSO</span>
                            {activeBranch === 'PAULO AFONSO' && <span>✓</span>}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveBranch('DELMIRO');
                              setIsBranchMenuOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 hover:bg-amber-50 flex items-center justify-between text-[10px] ${
                              activeBranch === 'DELMIRO' ? 'text-amber-900 font-black bg-amber-50/70' : 'text-slate-700'
                            }`}
                          >
                            <span>DELMIRO</span>
                            {activeBranch === 'DELMIRO' && <span>✓</span>}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black border shrink-0 bg-amber-50 text-amber-900 border-amber-300 flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5 text-amber-700" />
                      <span>{activeBranch}</span>
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 truncate">Gestão de Materiais & Equipamentos</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* EXIGÊNCIA: Mover o campo "Data:" para o lado esquerdo do botão "Sair" */}
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shrink-0 shadow-2xs">
            <span className="text-slate-500 font-medium">Data:</span>
            <span className="font-mono text-slate-900 font-extrabold">{todayDateFormatted}</span>
          </div>
          
          {/* Botão de Trocar / Sair da Conta (compacto e discreto para não sobrepor títulos no mobile) */}
          {activeUser && (
            <button
              onClick={handleLogout}
              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 flex items-center gap-1 border border-rose-200 transition-all active:scale-95 shadow-xs text-[10px] font-bold shrink-0 cursor-pointer"
              title="Sair / Trocar Usuário (retorna para o login salvando todos os dados)"
            >
              <LogOut className="w-3 h-3 text-rose-600 shrink-0" />
              <span className="hidden sm:inline">Sair / Trocar</span>
              <span className="sm:hidden text-[10px]">Sair</span>
            </button>
          )}

          {/* Phone Frame Toggle for Desktop */}
          <button
            onClick={onTogglePhoneFrame}
            className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200 px-2 py-1.5 rounded-xl transition-colors"
            title={isPhoneFrame ? "Expandir tela" : "Modo celular"}
          >
            {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5 text-amber-600" />}
          </button>
        </div>
      </header>

      {/* Bottom Navigation Bar com Fundo Branco */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200 pb-safe shadow-lg">
        <div className={`max-w-md mx-auto grid ${tabs.length === 6 ? 'grid-cols-6' : tabs.length === 5 ? 'grid-cols-5' : tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'} px-1 py-1.5`}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isLocked = isTabLockedForContador(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                disabled={isLocked}
                onClick={() => handleTabClick(tab)}
                title={isLocked ? 'Bloqueado durante a recontagem até o usuário Master zerar a contagem' : tab.label}
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all relative ${
                  isLocked
                    ? 'text-slate-300 opacity-55 cursor-not-allowed'
                    : isActive
                      ? tab.id === 'materiais'
                        ? 'text-amber-600 font-bold scale-105'
                        : tab.id === 'equipamentos'
                          ? 'text-cyan-600 font-bold scale-105'
                          : tab.id === 'recontagem'
                            ? 'text-rose-600 font-bold scale-105'
                            : tab.id === 'cadastros'
                              ? 'text-purple-600 font-bold scale-105'
                              : tab.id === 'exportar'
                                ? 'text-emerald-600 font-bold scale-105'
                                : 'text-indigo-600 font-bold scale-105'
                      : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                  {isLocked ? (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-slate-500 text-white rounded-full flex items-center justify-center shadow-xs">
                      <Lock className="w-2 h-2" />
                    </span>
                  ) : tab.badge !== undefined ? (
                    <span className="absolute -top-1.5 -right-2 px-1 py-0.2 bg-rose-600 text-white rounded-full text-[8px] font-black leading-tight shadow-xs">
                      {tab.badge}
                    </span>
                  ) : null}
                </div>

                <span className="text-[9.5px] mt-1 tracking-tight truncate w-full text-center">
                  {tab.label}
                </span>

                {isActive && (
                  <span className={`w-1.5 h-1.5 rounded-full absolute bottom-0.5 ${
                    tab.id === 'materiais' 
                      ? 'bg-amber-600' 
                      : tab.id === 'equipamentos' 
                        ? 'bg-cyan-600' 
                        : tab.id === 'recontagem'
                          ? 'bg-rose-600'
                          : tab.id === 'cadastros'
                            ? 'bg-purple-600'
                            : tab.id === 'exportar'
                              ? 'bg-emerald-600'
                              : 'bg-indigo-600'
                  }`}></span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
