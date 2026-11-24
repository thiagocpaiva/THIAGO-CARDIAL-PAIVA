
import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Edit3,
  Trash2,
  Search,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  MapPin
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { StockUser, UserRoleLevel, UnitBranch, getSelectableBranches, isCoringaUser, toTestBranch } from '../../types/inventory';

export const UsuariosView: React.FC = () => {
  const {
    users,
    addUser,
    updateUser,
    deleteUser,
    activeUser,
    isMaster,
    isCoringa,
    isContadorActive,
    isAnyBaseCountInProgress
  } = useInventory();

  const selectableBranches = getSelectableBranches(isCoringa);

  const [toastMsg, setToastMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const showToast = (text: string, ok: boolean) => {
    setToastMsg({ text, ok });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Estados da Lista e Modal de Usuários
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | UserRoleLevel>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<StockUser | null>(null);

  // Form de Cadastro / Edição do Usuário
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [roleLevel, setRoleLevel] = useState<UserRoleLevel>('contador');
  const [branch, setBranch] = useState<UnitBranch>(selectableBranches[0]);
  const [status, setStatus] = useState<'ativo' | 'inativo'>('ativo');
  const [errorMsg, setErrorMsg] = useState('');

  const handleOpenCreate = () => {
    if (isCoringa) {
      showToast('Inclusão de novos usuários desabilitada para o contador CORINGA.', false);
      return;
    }
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.', false);
      return;
    }
    setUserToEdit(null);
    setName('');
    setRegistration('');
    setPassword('');
    setShowPassword(false);
    setRoleLevel('contador');
    setBranch(selectableBranches[0]);
    setStatus('ativo');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: StockUser) => {
    if (isCoringa || isCoringaUser(user)) {
      showToast('O usuário CORINGA (9999) é protegido e não pode ser editado.', false);
      return;
    }
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.', false);
      return;
    }
    setUserToEdit(user);
    setName(user.name);
    setRegistration(user.registration);
    setPassword(user.password || '');
    setShowPassword(false);
    setRoleLevel(user.roleLevel);
    const resolvedBranch = user.branch
      ? (isCoringa
          ? toTestBranch(user.branch)
          : (user.branch === 'DELMIRO' || user.branch === 'DELMIRO (TESTE)' ? 'DELMIRO' : 'PAULO AFONSO'))
      : selectableBranches[0];
    setBranch(resolvedBranch);
    setStatus(user.status);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCoringa) return;
    setErrorMsg('');

    const trimmedName = name.trim();
    const trimmedRegistration = registration.trim().toUpperCase();
    const trimmedPassword = password.trim();

    if (!trimmedName) {
      setErrorMsg('Informe o nome completo do usuário.');
      return;
    }

    if (!trimmedRegistration) {
      setErrorMsg('Informe a matrícula do usuário.');
      return;
    }

    // EXIGÊNCIA: Usuários Contador não têm senha, acesso apenas com a matrícula!
    // Apenas Master exige senha
    if (roleLevel === 'master' && !trimmedPassword) {
      setErrorMsg('Informe a senha de acesso para o Usuário Master.');
      return;
    }

    // Validação de unicidade da matrícula
    const exists = users.some(
      u => u.registration.toUpperCase() === trimmedRegistration && u.id !== userToEdit?.id
    );
    if (exists) {
      setErrorMsg(`Já existe um usuário cadastrado com a matrícula ${trimmedRegistration}.`);
      return;
    }

    const finalPassword = roleLevel === 'master' ? trimmedPassword : '';
    const userBranch = roleLevel === 'contador' ? branch : undefined;

    if (userToEdit) {
      updateUser({
        ...userToEdit,
        name: trimmedName,
        registration: trimmedRegistration,
        password: finalPassword,
        roleLevel,
        branch: userBranch,
        status,
      });
      showToast('Usuário atualizado com sucesso!', true);
    } else {
      addUser({
        name: trimmedName,
        registration: trimmedRegistration,
        password: finalPassword,
        roleLevel,
        branch: userBranch,
        status,
      });
      showToast('Usuário cadastrado com sucesso!', true);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, userName: string) => {
    const targetUser = users.find(u => u.id === id);
    if (isCoringaUser(targetUser)) {
      showToast('O usuário CORINGA (9999) é protegido pelo sistema.', false);
      return;
    }
    if (isMaster && (isAnyBaseCountInProgress || isContadorActive)) {
      showToast('Existe contagem em andamento.', false);
      return;
    }
    deleteUser(id);
    showToast(`Usuário "${userName}" e todas as suas informações foram excluídos com sucesso.`, true);
  };

  // No modo CORINGA, exibe exclusivamente as informações do usuário CORINGA
  const baseUsers = isCoringa ? users.filter(u => isCoringaUser(u)) : users;

  // EXIGÊNCIA 7: Ordenar os usuários cadastrados no App, por ordem crescente de matrícula e por ordem de nível de acesso, começando pelos usuários Master
  const filteredUsers = baseUsers
    .filter(u => {
      if (isCoringa) return true;
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.registration.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLevel = levelFilter === 'all' || u.roleLevel === levelFilter;
      return matchesSearch && matchesLevel;
    })
    .sort((a, b) => {
      if (a.roleLevel === 'master' && b.roleLevel !== 'master') return -1;
      if (a.roleLevel !== 'master' && b.roleLevel === 'master') return 1;
      return a.registration.localeCompare(b.registration, undefined, { numeric: true, sensitivity: 'base' });
    });

  const formatUserCreatedAt = (raw: string) => {
    if (!raw) return 'Não registrado';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return raw;
    const [year, month, day] = raw.trim().split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-4 pb-12 bg-white">

      {/* Alerta de Contador Ativo */}
      {isMaster && isContadorActive && (
        <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-2xl text-amber-950 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Existe usuário realizando contagem no momento.</span>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 max-w-sm p-3 rounded-2xl shadow-xl text-xs flex items-center gap-2 border animate-in fade-in duration-200 ${
          toastMsg.ok
            ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
            : 'bg-rose-50 text-rose-950 border-rose-300'
        }`}>
          {toastMsg.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
          <span className="font-medium">{toastMsg.text}</span>
        </div>
      )}

      {/* Alerta de Contagem em Andamento para Master */}
      {isMaster && isAnyBaseCountInProgress && (
        <div className="p-3.5 bg-amber-50 border-2 border-amber-400 rounded-2xl shadow-sm text-slate-900 flex items-center gap-3 animate-in fade-in">
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-xs">
            <AlertCircle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-950 leading-tight">
              Existe contagem em andamento.
            </p>
            <p className="text-[11px] text-amber-900 mt-0.5">
              O cadastro de Usuários está em modo somente leitura enquanto houver contagem em andamento na base ativa até o envio do estoque por e-mail.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>{isCoringa ? 'Dados do Usuário (CORINGA)' : 'Gestão de Usuários'}</span>
          </h2>
        </div>

        {!isCoringa && (
          <button
            onClick={handleOpenCreate}
            disabled={isMaster && (isAnyBaseCountInProgress || isContadorActive)}
            title={isMaster && (isAnyBaseCountInProgress || isContadorActive) ? 'Existe contagem em andamento.' : undefined}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Novo Usuário</span>
          </button>
        )}
      </div>

      {isCoringa && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl text-amber-950 text-xs flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span className="font-semibold">
            No modo de testes <strong>CORINGA</strong>, apenas os dados do usuário CORINGA são exibidos. Inclusão de novos usuários e edição estão desabilitadas.
          </span>
        </div>
      )}

      {/* =========================================================================
          LISTA E GESTÃO DE USUÁRIOS
          ========================================================================= */}
      <div className="space-y-2.5">

        {/* Filtros e Busca (ocultos no modo CORINGA, pois exibe somente o usuário CORINGA) */}
        {!isCoringa && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por matrícula ou nome..."
                className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div className="flex gap-1.5 text-xs">
              <button
                onClick={() => setLevelFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                  levelFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Todos ({users.length})
              </button>
              <button
                onClick={() => setLevelFilter('master')}
                className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                  levelFilter === 'master'
                    ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                    : 'bg-white border-slate-200 text-purple-700 hover:bg-slate-50'
                }`}
              >
                1 - Master ({users.filter(u => u.roleLevel === 'master').length})
              </button>
              <button
                onClick={() => setLevelFilter('contador')}
                className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                  levelFilter === 'contador'
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                    : 'bg-white border-slate-200 text-indigo-700 hover:bg-slate-50'
                }`}
              >
                2 - Contador ({users.filter(u => u.roleLevel === 'contador').length})
              </button>
            </div>
          </div>
        )}

        {/* Lista de Usuários */}
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
              Nenhum usuário encontrado.
            </div>
          ) : (
            filteredUsers.map(user => {
              const isLoggedUser = activeUser?.id === user.id;
              const isCoringaCard = isCoringaUser(user);

              return (
                <div
                  key={user.id}
                  className={`border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-all shadow-xs ${
                    isCoringaCard
                      ? 'bg-amber-50/40 border-amber-300 hover:border-amber-400'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        MATRÍCULA: {user.registration}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        isCoringaCard
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : user.roleLevel === 'master'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {isCoringaCard
                          ? '2 - Contador • Acesso Total (Teste)'
                          : user.roleLevel === 'master'
                            ? '1 - Master (Exige Senha)'
                            : '2 - Contador (Sem Senha)'}
                      </span>
                      {isCoringaCard ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-900 border-indigo-200">
                          Modo Teste Isolado (Sem Firebase)
                        </span>
                      ) : user.roleLevel === 'contador' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-900 border-amber-300">
                          Base: {user.branch || 'PAULO AFONSO'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-800 border-slate-300">
                          Acesso: {selectableBranches.join(' e ')}
                        </span>
                      )}
                      {isLoggedUser && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                          Sessão Ativa
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm mt-1 truncate">
                      {user.name}
                    </h4>

                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      {isCoringaCard ? (
                        <span className="text-indigo-800 font-semibold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" />
                          Acesso total nas bases teste clonadas (sem senha, sem Firebase e sem interferência na produção)
                        </span>
                      ) : user.roleLevel === 'master' ? (
                        <span className="flex items-center gap-1 font-mono text-slate-700">
                          <Lock className="w-3 h-3 text-purple-500" />
                          Senha: <span className="text-purple-800 font-bold">{user.password}</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Acesso somente à base {user.branch || 'PAULO AFONSO'} (sem senha)
                        </span>
                      )}
                      <span>•</span>
                      <span>Criado em: <strong className="text-slate-700">{formatUserCreatedAt(user.createdAt)}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isCoringaCard ? (
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                        Protegido
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                          title="Editar usuário"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={isLoggedUser && users.length === 1}
                          className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-40 cursor-pointer"
                          title="Excluir usuário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {/* =========================================================================
          MODAL DE CADASTRO / EDIÇÃO DE USUÁRIO
          ========================================================================= */}
      {!isCoringa && isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl text-slate-900">

            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {userToEdit ? 'Editar Usuário' : 'Novo Usuário'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Defina matrícula, nome e nível de acesso
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200/70 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Matrícula (código do usuário) */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Matrícula do Usuário (Código de Login) *
                </label>
                <input
                  type="text"
                  value={registration}
                  onChange={e => setRegistration(e.target.value.toUpperCase())}
                  placeholder="Ex: 1001, 2005"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              {/* Nome Completo */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Carlos Conferente"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Nível de Acesso */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nível de Acesso às Telas *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoleLevel('master')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      roleLevel === 'master'
                        ? 'bg-purple-50 border-purple-400 text-purple-900 font-bold ring-2 ring-purple-300/40'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="font-black">1 - Usuário Master</div>
                    <div className="text-[10px] text-purple-700 mt-0.5">Exige senha de acesso</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoleLevel('contador')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      roleLevel === 'contador'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold ring-2 ring-emerald-300/40'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="font-black">2 - Usuário Contador</div>
                    <div className="text-[10px] text-emerald-700 mt-0.5">Sem senha (apenas matrícula)</div>
                  </button>
                </div>
              </div>

              {/* Senha de Acesso: Apenas para Master! Contador NÃO usa senha */}
              {roleLevel === 'master' ? (
                <div>
                  <label className="text-xs font-bold text-purple-900 block mb-1">
                    Senha de Acesso (Obrigatória para Master) *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Digite a senha para o Administrador Master"
                      required
                      className="w-full bg-purple-50/50 border border-purple-200 rounded-xl pl-3 pr-10 py-2 text-xs text-slate-900 placeholder-purple-400 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-purple-400 hover:text-purple-700 absolute right-3 top-2.5 p-0.5 cursor-pointer"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Usuários <strong>Contador</strong> não possuem senha. O acesso ao aplicativo será realizado somente digitando a Matrícula.</span>
                  </div>

                  {/* EXIGÊNCIA 6: Seleção da base permitida com botões PAULO AFONSO e DELMIRO */}
                  <div className="space-y-1.5 animate-in fade-in duration-150">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      <span>Base de Acesso do Contador *</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Permitir acesso à contagem referente à base selecionada:
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      {selectableBranches.map((branchOpt, idx) => (
                        <button
                          key={branchOpt}
                          type="button"
                          onClick={() => setBranch(branchOpt)}
                          className={`p-2.5 rounded-xl border text-center text-xs font-black transition-all cursor-pointer ${
                            branch === branchOpt
                              ? idx === 0
                                ? 'bg-amber-500 text-slate-950 border-amber-400 ring-2 ring-amber-300 shadow-xs scale-[1.02]'
                                : 'bg-slate-900 text-white border-slate-800 ring-2 ring-slate-400 shadow-xs scale-[1.02]'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {branchOpt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Status do Usuário *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('ativo')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      status === 'ativo'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Ativo
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('inativo')}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      status === 'inativo'
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Inativo
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{userToEdit ? 'Salvar Alterações' : 'Cadastrar Usuário'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
