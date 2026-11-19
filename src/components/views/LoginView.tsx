
import React, { useState, useEffect, useRef } from 'react';
import { Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, MapPin } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { AppBrandIcon } from '../AppBrandIcons';
import { GrupoMSBrand } from '../common/GrupoMSBrand';
import { UnitBranch, isCoringaUser } from '../../types/inventory';

export const LoginView: React.FC = () => {
  const { users, verifyCredentials, login } = useInventory();

  const [registration, setRegistration] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [pendingMaster, setPendingMaster] = useState<{ registration: string; pass: string; name: string } | null>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Procura o usuário em tempo real conforme a matrícula é digitada
  const cleanReg = registration.trim().toUpperCase();
  const matchedUser = cleanReg 
    ? users.find(u => u.registration.toUpperCase() === cleanReg)
    : null;

  const isMasterUser = matchedUser?.roleLevel === 'master';
  const isCoringaMatch = isCoringaUser(matchedUser);

  // Na tela de login, ao digitar a matricula e for de um usuário master, o cursor já irá ficar no campo da senha aguardando a digitação
  useEffect(() => {
    if (isMasterUser) {
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isMasterUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;
    setErrorMessage('');

    if (!cleanReg) {
      setErrorMessage('Por favor, informe a matrícula do usuário.');
      return;
    }

    if (isMasterUser && !password.trim()) {
      setErrorMessage('Por favor, digite a senha de acesso do Usuário Master.');
      passwordInputRef.current?.focus();
      return;
    }

    // Valida matrícula, status e senha (inclusive contra o Firebase) NA TELA DE LOGIN antes de avançar para seleção de base
    setIsLoggingIn(true);
    try {
      const check = await verifyCredentials(cleanReg, password);
      if (!check.success || !check.user) {
        setErrorMessage(check.message || 'Erro ao validar credenciais.');
        return;
      }

      if (check.user.roleLevel === 'master') {
        setPendingMaster({
          registration: cleanReg,
          pass: password.trim(),
          name: check.user.name,
        });
        return;
      }

      // Usuário Contador autentica e sincroniza diretamente
      const result = await login(cleanReg, password, undefined, true);
      if (!result.success) {
        setErrorMessage(result.message || 'Erro ao realizar login.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSelectBranch = async (branch: UnitBranch) => {
    if (!pendingMaster || isLoggingIn) return;
    setErrorMessage('');
    setIsLoggingIn(true);
    try {
      const result = await login(pendingMaster.registration, pendingMaster.pass, branch);
      if (!result.success) {
        const msg = result.message || 'Erro ao realizar login.';
        setErrorMessage(msg);
        // Se for erro de credencial/status retorna ao login; se for bloqueio de uma base específica permite escolher a outra base
        if (!msg.includes('contagem em andamento')) {
          setPendingMaster(null);
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  // EXIGÊNCIA 4: Tela com dois botões "PAULO AFONSO" e "DELMIRO" para o Master escolher a base
  if (pendingMaster) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4 selection:bg-amber-200">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-center space-y-3">
            {/* Logomarca oficial Grupo MS fiel ao arquivo anexado */}
            <div className="flex justify-center">
              <GrupoMSBrand size="lg" align="center" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                CONTAGEM DE ESTOQUE
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Gestão de Materiais & Equipamentos
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-slate-100 pb-3 text-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{pendingMaster.name} (Master)</span>
              </span>
              <h2 className="text-sm font-extrabold text-slate-900">
                Selecione a Base de Estoque
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Escolha qual unidade você deseja acessar:
              </p>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                disabled={isLoggingIn}
                onClick={() => handleSelectBranch('PAULO AFONSO')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-black text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-amber-400"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/30 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-slate-950" />
                  </div>
                  <span className="text-base tracking-wide">{isLoggingIn ? 'SINCRONIZANDO...' : 'PAULO AFONSO'}</span>
                </div>
                <ArrowRight className="w-5 h-5 stroke-[3]" />
              </button>

              <button
                type="button"
                disabled={isLoggingIn}
                onClick={() => handleSelectBranch('DELMIRO')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 disabled:opacity-60 text-white font-black text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-between cursor-pointer border border-slate-700"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="text-base tracking-wide">{isLoggingIn ? 'SINCRONIZANDO...' : 'DELMIRO'}</span>
                </div>
                <ArrowRight className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            <div className="pt-2 text-center border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setPendingMaster(null);
                  setPassword('');
                  setErrorMessage('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
              >
                ← Voltar para identificação
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4 selection:bg-amber-200">
      <div className="w-full max-w-sm space-y-4">
        
        {/* Header Oficial Grupo MS com fidelidade à imagem, forma e tipografia */}
        <div className="text-center space-y-3">
          {/* Logomarca oficial Grupo MS fiel ao arquivo anexado */}
          <div className="flex justify-center pt-1">
            <GrupoMSBrand size="hero" align="center" />
          </div>

          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
              CONTAGEM DE ESTOQUE
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Gestão de Materiais & Equipamentos
            </p>
          </div>

          {/* Composição visual dos itens de estoque */}
          <div className="flex justify-center pt-0.5">
            <AppBrandIcon type="full" size="hero" showNames={true} className="border-2 border-slate-200 shadow-xs p-2.5 bg-slate-50/50" />
          </div>
        </div>

        {/* Card de Login com Fundo Branco */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-amber-500" />
                <span>Identificação do Usuário</span>
              </h2>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Campo 1: Matrícula (apenas números) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Matrícula do Usuário:
                </label>
                
                {/* Nome do usuário identificado */}
                {matchedUser ? (
                  <span className={`text-[11px] font-bold flex items-center gap-1 px-2.5 py-0.5 rounded-full border truncate max-w-[170px] ${
                    isCoringaMatch
                      ? 'bg-amber-50 text-amber-900 border-amber-300'
                      : isMasterUser 
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`} title={matchedUser.name}>
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{matchedUser.name}</span>
                  </span>
                ) : cleanReg.length >= 2 ? (
                  <span className="text-[10px] text-slate-400 italic">
                    Não localizado
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={registration}
                  onChange={e => {
                    const onlyNums = e.target.value.replace(/\D/g, '');
                    setRegistration(onlyNums);
                    setErrorMessage('');
                  }}
                  placeholder=""
                  required
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-300 rounded-2xl pl-10 pr-3 py-3 text-sm text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:bg-white uppercase transition-all"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>

              {matchedUser && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600 pl-1">
                  <span>Nível:</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    isCoringaMatch
                      ? 'bg-amber-100 text-amber-950'
                      : isMasterUser 
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {isCoringaMatch
                      ? '2 - Contador (Modo Teste Total • Sem Firebase)'
                      : isMasterUser
                        ? '1 - Master (Exige Senha)'
                        : '2 - Contador (Acesso Direto sem Senha)'}
                  </span>
                </div>
              )}
            </div>

            {/* Campo 2: Senha de Acesso (OCULTO para Contador, só aparece quando a matrícula for de Master) */}
            {isMasterUser && (
              <div className="animate-in fade-in duration-200 space-y-1">
                <label className="text-xs font-bold text-purple-900 flex items-center justify-between">
                  <span>Senha de Acesso (Usuário Master) *</span>
                  <span className="text-[10px] font-normal text-purple-600">Obrigatória para Master</span>
                </label>
                <div className="relative">
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Digite a senha do Administrador Master"
                    required
                    className="w-full bg-purple-50/50 border border-purple-200 rounded-2xl pl-10 pr-10 py-3 text-sm text-slate-900 placeholder-purple-300 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:bg-white transition-all"
                  />
                  <Lock className="w-4 h-4 text-purple-400 absolute left-3.5 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-purple-400 hover:text-purple-700 absolute right-3.5 top-3.5 p-0.5 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Botão Entrar */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-black text-sm rounded-2xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer"
            >
              <span>
                {isLoggingIn
                  ? (isCoringaMatch ? 'Abrindo Modo Teste...' : 'Sincronizando e entrando...')
                  : isCoringaMatch
                    ? 'Acessar Modo Teste (Coringa)'
                    : (matchedUser && !isMasterUser ? 'Acessar como Contador' : 'Entrar no Sistema')}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>

          </form>

        </div>

      </div>
    </div>
  );
};
