// ================================================
// GESTAO v3.0 - MAIN.JS
// Login + CRUD + Segurança
// ================================================

const API = 'https://script.google.com/macros/s/AKfycbwI9Z0vGVkddzLd6DOrE4DGtdw-sTcwlMfGcldJR42txmRVVrhVcXrEakPn4-Ujfr0/exec';

// Estado global
const S = {
  email: localStorage.getItem('email') || '',
  senha: sessionStorage.getItem('senha') || '',
  userId: localStorage.getItem('userId') || '',
  nome: localStorage.getItem('nome') || '',
  foto: localStorage.getItem('foto') || '',
  role: localStorage.getItem('role') || '',
  groupName: localStorage.getItem('groupName') || '',
  hhId: localStorage.getItem('hhId') || '',
  orgId: localStorage.getItem('orgId') || '',
  items: [],
  households: [],
  permissions: [],
  statusFilter: 'todos',
  groupByCategory: false,
  searchTerm: '',
  isLoadingItems: false,
  orgLogo: localStorage.getItem('orgLogo') || ''
};

// Renderizar logo da empresa no header
function renderOrgLogo() {
  const el = document.getElementById('orgLogo');
  if (!el) return;
  if (S.orgLogo && String(S.orgLogo).startsWith('data:image')) {
    el.textContent = '';
    el.style.backgroundImage = `url('${S.orgLogo}')`;
  } else {
    el.style.backgroundImage = '';
    el.textContent = '🏢';
  }
}

// ========== THEME ==========
function initTheme() {
  const savedTheme = localStorage.getItem('gestao-theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('gestao-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('gestao-theme', 'light');
  }
  updateThemeBtn();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  setTheme(isDark ? 'light' : 'dark');
}

function updateThemeBtn() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const icon = isDark ? '☀️' : '🌙';
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = icon;
  const authBtn = document.getElementById('themeToggleAuth');
  if (authBtn) authBtn.innerHTML = icon;
}

// Inicializar tema
initTheme();

// Restaurar nome da loja se houver hhId salvo
const savedHouseholdName = localStorage.getItem('householdName');
const savedHhId = localStorage.getItem('hhId');
if (savedHhId && savedHouseholdName) {
  $('appTitle').textContent = savedHouseholdName;
}

// ========== FIM THEME ==========

// ========== SEGURANÇA V3.0 ==========
let appSecurity = null;

function initSecurity(user, accessToken, refreshToken) {
  const sessionManager = new SessionManager({
    sessionTimeout: 15 * 60 * 1000,
    onSessionExpire: () => {
      toast('Sessão expirada. Faça login novamente.', 'danger');
      setTimeout(() => window.location.href = '/', 2000);
    },
    onSessionWarning: (info) => {
      toast(info.message, 'warning');
    }
  });

  const permissionManager = new PermissionManager(user);
  const authMiddleware = new AuthMiddleware(sessionManager);
  const permissionMiddleware = new PermissionMiddleware(permissionManager);
  const rateLimiter = new RateLimiter({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000
  });

  sessionManager.saveSession(user, accessToken, refreshToken);

  appSecurity = {
    sessionManager,
    permissionManager,
    authMiddleware,
    permissionMiddleware,
    rateLimiter
  };

  window.app = appSecurity;
}
// ========== FIM SEGURANÇA V3.0 ==========

function $(id) { return document.getElementById(id); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(msg, type = 'info') {
  const t = $('toast');
  t.textContent = msg;
  t.className = type;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function jsonp(url) {
  return fetch(url).then(r => r.json());
}

// Para payloads grandes (ex: imagens base64) que estouram o limite de URL do GET
function postData(action, params) {
  const form = new URLSearchParams();
  form.append('action', action);
  for (const key in params) {
    form.append(key, params[key]);
  }
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  }).then(r => r.json());
}

function showLogin() {
  $('loginScreen').classList.remove('hidden');
  $('registerScreen').classList.add('hidden');
  $('appScreen').classList.add('hidden');
}

function showRegister() {
  $('loginScreen').classList.add('hidden');
  $('registerScreen').classList.remove('hidden');
}

// ========== RECUPERAÇÃO DE SENHA ==========
function openForgotPassword() {
  $('forgotEmail').value = $('loginEmail').value.trim();
  $('forgotMsg').style.display = 'none';
  $('forgotSubmitBtn').disabled = false;
  $('forgotSubmitBtn').textContent = 'Enviar link';
  $('forgotModal').classList.remove('hidden');
}

function closeForgotPassword() {
  $('forgotModal').classList.add('hidden');
}

async function submitForgotPassword() {
  const email = $('forgotEmail').value.trim();
  if (!email) { toast('Informe seu e-mail', 'danger'); return; }

  const btn = $('forgotSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const d = await jsonp(`${API}?action=requestPasswordReset&email=${encodeURIComponent(email)}`);
    if (d.error) {
      toast(d.error, 'danger');
      btn.disabled = false;
      btn.textContent = 'Enviar link';
      return;
    }
    btn.textContent = '✓ Enviado';
    const msg = $('forgotMsg');
    msg.style.display = 'block';
    msg.innerHTML = '✓ E-mail enviado!<br><span style="font-size:12px">Verifique sua caixa de entrada ou spam. O link expira em 1 hora.</span>';
  } catch (err) {
    toast('Erro ao enviar e-mail', 'danger');
    btn.disabled = false;
    btn.textContent = 'Enviar link';
  }
}

// Modal de nova senha (acessado via link ?reset=TOKEN)
let resetToken = '';

function openResetModal(token) {
  resetToken = token;
  $('resetNewPass').value = '';
  $('resetConfirmPass').value = '';
  $('resetModal').classList.remove('hidden');
}

function closeResetModal() {
  $('resetModal').classList.add('hidden');
  // Limpar o ?reset= da URL
  if (window.history.replaceState) {
    const url = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, url);
  }
}

async function submitResetPassword() {
  const novaSenha = $('resetNewPass').value;
  const confirma = $('resetConfirmPass').value;

  if (novaSenha.length < 6) { toast('Mínimo 6 caracteres', 'danger'); return; }
  if (novaSenha !== confirma) { toast('Senhas não conferem', 'danger'); return; }

  toast('Redefinindo...', 'loading');
  try {
    const d = await jsonp(`${API}?action=resetPassword&token=${encodeURIComponent(resetToken)}&nova_senha=${encodeURIComponent(novaSenha)}`);
    if (d.error) { toast(d.error, 'danger'); return; }
    closeResetModal();
    toast('✓ Senha redefinida! Faça login.', 'success');
  } catch (err) {
    toast('Erro ao redefinir senha', 'danger');
  }
}

// Detectar ?reset=TOKEN na URL ao carregar
(function checkResetToken() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('reset');
  if (token) {
    showLogin();
    setTimeout(() => openResetModal(token), 300);
  }
})();

// ========== LOGIN ==========
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('loginEmail').value.trim();
  const senha = $('loginSenha').value;

  if (!email || !senha) {
    toast('E-mail e senha obrigatórios', 'danger');
    return;
  }

  toast('Entrando...', 'loading');

  try {
    const d = await jsonp(`${API}?action=login&email=${encodeURIComponent(email)}&senha=${encodeURIComponent(senha)}`);

    if (d.error) {
      toast(d.error, 'danger');
      return;
    }

    if (d.needsPassword) {
      toast('Defina sua senha', 'warning');
      return;
    }

    // Salvar dados
    S.email = email;
    S.senha = senha;
    S.userId = String(d.user.user_id);
    S.nome = d.user.nome || '';
    S.foto = d.user.foto_base64 || '';
    S.role = d.user.role;
    S.groupName = d.user.group_name || '';
    S.orgId = d.user.org_id;
    S.permissions = d.user.permissions || [];

    localStorage.setItem('email', email);
    localStorage.setItem('userId', S.userId);
    localStorage.setItem('nome', S.nome);
    localStorage.setItem('foto', S.foto);
    localStorage.setItem('role', S.role);
    localStorage.setItem('groupName', S.groupName);
    localStorage.setItem('orgId', S.orgId);
    sessionStorage.setItem('senha', senha);

    // ========== INICIALIZAR SEGURANÇA V3.0 ==========
    initSecurity(d.user, d.access_token, d.refresh_token);
    // ================================================

    // Limpar form
    $('addItemForm').reset();

    // UI
    $('loginScreen').classList.add('hidden');
    $('registerScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');

    // Atualizar perfil
    $('accName').textContent = d.user.nome;
    $('accRole').textContent = (d.user.group_name || d.user.role || 'Membro').toUpperCase();
    renderAvatar(d.user.nome, d.user.foto_base64);

    // Logo da organização
    S.orgLogo = d.org_logo || '';
    localStorage.setItem('orgLogo', S.orgLogo);
    renderOrgLogo();

    // Mostrar households ou main
    if (d.households && d.households.length > 0) {
      S.households = d.households;
      $('householdsView').classList.remove('hidden');
      $('mainView').classList.add('hidden');
      renderHouseholds();
    } else if (d.user.household_id) {
      S.hhId = String(d.user.household_id);
      localStorage.setItem('hhId', S.hhId);
      $('householdsView').classList.add('hidden');
      $('mainView').classList.remove('hidden');
      loadItems();
    }

    toast('✓ Bem-vindo!', 'success');
  } catch (err) {
    toast('Erro ao entrar', 'danger');
  }
});

// ========== REGISTER ==========
$('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('regEmail').value.trim();
  const nome = $('regNome').value.trim();
  const nomeOrg = $('regNomeOrg').value.trim();
  const nomeHH = $('regNomeHH').value.trim();
  const senha = $('regSenha').value;

  if (!email || !nome || !nomeOrg || !nomeHH || senha.length < 6) {
    toast('Preencha todos os campos (senha min 6 caracteres)', 'danger');
    return;
  }

  toast('Criando conta...', 'loading');

  try {
    const d = await jsonp(`${API}?action=register&email=${encodeURIComponent(email)}&novo_nome=${encodeURIComponent(nome)}&nome_org=${encodeURIComponent(nomeOrg)}&nome_household=${encodeURIComponent(nomeHH)}&nova_senha=${encodeURIComponent(senha)}`);

    if (d.error) {
      toast(d.error, 'danger');
      return;
    }

    S.email = email;
    S.senha = senha;
    S.userId = String(d.user.user_id);
    S.role = d.user.role;
    S.groupName = d.user.group_name || '';
    S.orgId = d.user.org_id;

    localStorage.setItem('email', email);
    localStorage.setItem('userId', S.userId);
    localStorage.setItem('role', S.role);
    localStorage.setItem('groupName', S.groupName);
    localStorage.setItem('orgId', S.orgId);
    sessionStorage.setItem('senha', senha);

    initSecurity(d.user, d.access_token || '', d.refresh_token || '');

    $('loginScreen').classList.add('hidden');
    $('registerScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');

    $('accName').textContent = d.user.nome;
    $('accRole').textContent = (d.user.group_name || d.user.role || 'Membro').toUpperCase();
    $('avBtn').textContent = d.user.nome.charAt(0).toUpperCase();

    $('householdsView').classList.add('hidden');
    $('mainView').classList.remove('hidden');
    loadItems();
    toast('✓ Conta criada!', 'success');
  } catch (err) {
    toast('Erro ao criar conta', 'danger');
  }
});

// ========== LOGOUT ==========
$('logoutBtn').addEventListener('click', () => {
  if (appSecurity) {
    appSecurity.sessionManager.logout();
    appSecurity.sessionManager.destroy();
  }
  
  S.email = '';
  S.senha = '';
  S.userId = '';
  S.hhId = '';
  localStorage.clear();
  sessionStorage.clear();
  showLogin();
  toast('Desconectado', 'info');
});

// ========== HOUSEHOLDS ==========
function showHouseholds() {
  // Resetar título para nome do sistema
  $('appTitle').textContent = 'Gestão';
  localStorage.removeItem('householdName'); // Limpar nome salvo
  
  console.log('Households disponíveis:', S.households);
  
  $('householdsView').classList.remove('hidden');
  $('mainView').classList.add('hidden');
  renderHouseholds();
}

async function loadAndShowHouseholds() {
  // Recarregar lojas da API antes de mostrar
  try {
    const d = await jsonp(`${API}?action=getHouseholds&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d && d.households) {
      S.households = d.households;
      console.log('Lojas recarregadas:', S.households);
    }
  } catch (err) {
    console.log('Erro ao recarregar lojas:', err);
  }
  
  showHouseholds();
}

function showMain() {
  $('householdsView').classList.add('hidden');
  $('mainView').classList.remove('hidden');
}

function renderHouseholds() {
  const list = $('hhList');
  
  // Mostrar botão criar se tiver permissão
  const canManage = (S.role === 'owner' || (S.groupName && S.groupName.toLowerCase() === 'diretor')) || (S.permissions || []).includes('manage_lojas');
  const createBtn = $('createHHBtn');
  if (createBtn) createBtn.style.display = canManage ? 'block' : 'none';
  
  if (!S.households || S.households.length === 0) {
    console.log('Nenhuma loja disponível');
    list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-secondary)">Nenhuma loja disponível</p>';
    return;
  }
  
  list.innerHTML = S.households.map(hh => {
    const nomeEsc = String(hh.nome).replace(/'/g, "\\'");
    const actions = canManage ? `
      <div class="hh-actions" onclick="event.stopPropagation()">
        <button class="hh-icon" onclick="openEditHousehold('${hh.household_id}', '${nomeEsc}')" title="Editar">✏️</button>
        <button class="hh-icon" onclick="deleteHousehold('${hh.household_id}', '${nomeEsc}')" title="Excluir">✕</button>
      </div>` : '<span>→</span>';
    return `
    <div class="hh-card" onclick="selectHousehold('${hh.household_id}', '${nomeEsc}')">
      <div>
        <p class="hh-name">${hh.nome}</p>
        <p class="hh-meta">Clique para entrar</p>
      </div>
      ${actions}
    </div>`;
  }).join('');
}

// ========== CRIAR / EDITAR / EXCLUIR LOJA ==========
function openCreateHousehold() {
  const nome = prompt('Nome da nova casa / loja:');
  if (nome === null) return;
  const nomeTrim = nome.trim();
  if (!nomeTrim) { toast('Nome obrigatório', 'danger'); return; }
  createHousehold(nomeTrim);
}

async function createHousehold(nome) {
  toast('Criando...', 'loading');
  try {
    const d = await jsonp(`${API}?action=createHousehold&nome=${encodeURIComponent(nome)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d.error) { toast(d.error, 'danger'); return; }
    // Adicionar à lista local
    S.households.push({ household_id: d.household_id, nome: d.nome, org_id: S.orgId });
    renderHouseholds();
    toast('✓ Loja criada', 'success');
  } catch (err) {
    toast('Erro ao criar loja', 'danger');
  }
}

function openEditHousehold(hhId, nomeAtual) {
  const nome = prompt('Novo nome da loja:', nomeAtual);
  if (nome === null) return;
  const nomeTrim = nome.trim();
  if (!nomeTrim) { toast('Nome obrigatório', 'danger'); return; }
  updateHousehold(hhId, nomeTrim);
}

async function updateHousehold(hhId, nome) {
  toast('Salvando...', 'loading');
  try {
    const d = await jsonp(`${API}?action=updateHousehold&household_id_target=${encodeURIComponent(hhId)}&nome=${encodeURIComponent(nome)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d.error) { toast(d.error, 'danger'); return; }
    // Atualizar lista local
    const hh = S.households.find(h => String(h.household_id) === String(hhId));
    if (hh) hh.nome = nome;
    renderHouseholds();
    toast('✓ Loja atualizada', 'success');
  } catch (err) {
    toast('Erro ao atualizar', 'danger');
  }
}

async function deleteHousehold(hhId, nome) {
  if (!confirm(`Excluir a loja "${nome}"?\n\nATENÇÃO: Todos os itens e membros vinculados a ela serão apagados permanentemente.`)) return;
  toast('Excluindo...', 'loading');
  try {
    const d = await jsonp(`${API}?action=deleteHousehold&household_id_target=${encodeURIComponent(hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d.error) { toast(d.error, 'danger'); return; }
    // Remover da lista local
    S.households = S.households.filter(h => String(h.household_id) !== String(hhId));
    renderHouseholds();
    toast('✓ Loja excluída', 'success');
  } catch (err) {
    toast('Erro ao excluir', 'danger');
  }
}

function selectHousehold(hhId, nome) {
  S.hhId = String(hhId);
  localStorage.setItem('hhId', S.hhId);
  localStorage.setItem('householdName', nome);
  
  // Atualizar título
  $('appTitle').textContent = nome;
  
  // Limpar items antigos E renderizar tela vazia IMEDIATAMENTE
  S.items = [];
  S.isLoadingItems = true; // Ativar indicador de carregamento
  S.statusFilter = 'todos'; // Reset filtro também
  S.searchTerm = ''; // Reset busca
  $('searchInput').value = '';
  $('searchClear').style.display = 'none';
  
  showMain();
  renderItems(); // Renderizar tela de carregamento
  
  // Depois carregar dados da nova loja
  loadItems();
  toast(`Loja: ${nome}`, 'success');
}

// ========== AGRUPAMENTO POR CATEGORIA ==========
function toggleGroupByCategory() {
  S.groupByCategory = !S.groupByCategory;
  const btn = document.getElementById('groupToggle');
  if (btn) {
    btn.classList.toggle('active', S.groupByCategory);
  }
  renderItems();
}
// ========== FIM AGRUPAMENTO ==========
function initStatusFilters() {
  const container = document.getElementById('statusFilters');
  if (!container) return;
  
  container.innerHTML = '';
  
  const statuses = [
    { key: 'todos', label: 'Todos', count: 0 },
    { key: 'pendente', label: 'Pendentes', count: 0 },
    { key: 'sim', label: 'Comprados', count: 0 }
  ];
  
  // Contar itens por status
  statuses[0].count = S.items.length;
  statuses[1].count = S.items.filter(i => i.status === 'pendente').length;
  statuses[2].count = S.items.filter(i => i.status === 'sim').length;
  
  statuses.forEach(status => {
    const btn = document.createElement('button');
    btn.innerHTML = `${status.label} <strong>${status.count}</strong>`;
    btn.className = 'status-filter-btn' + (S.statusFilter === status.key ? ' active' : '');
    btn.dataset.status = status.key;
    btn.onclick = () => setStatusFilter(status.key);
    container.appendChild(btn);
  });
}

function setStatusFilter(status) {
  S.statusFilter = status;
  initStatusFilters();
  renderItems();
}

// ========== FIM FILTROS DE STATUS ==========
async function loadItems() {
  try {
    const d = await jsonp(`${API}?action=getItems&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d.error) {
      S.isLoadingItems = false;
      toast(d.error, 'danger');
      renderItems();
      return;
    }
    S.items = d.items || [];
    S.isLoadingItems = false;
    renderItems();
  } catch (err) {
    S.isLoadingItems = false;
    toast('Erro ao carregar itens', 'danger');
    renderItems();
  }
}

function renderItems() {
  const content = $('content');
  
  // Se está carregando, mostrar indicador
  if (S.isLoadingItems) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><p class="empty-text">Carregando itens...</p></div>';
    initStatusFilters();
    return;
  }
  
  if (!S.items || S.items.length === 0) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p class="empty-text">Nenhum item ainda</p></div>';
    initStatusFilters();
    return;
  }

  const isSelectMode = document.querySelector('[data-select-mode]')?.getAttribute('data-select-mode') === 'true';
  
  // Filtrar itens por status
  let filteredItems = S.items;
  if (S.statusFilter === 'pendente') {
    filteredItems = S.items.filter(i => i.status === 'pendente');
  } else if (S.statusFilter === 'sim') {
    filteredItems = S.items.filter(i => i.status === 'sim');
  }

  // Filtrar por busca (nome ou categoria)
  if (S.searchTerm) {
    const termo = S.searchTerm.toLowerCase();
    filteredItems = filteredItems.filter(i =>
      String(i.nome_item || '').toLowerCase().includes(termo) ||
      String(i.categoria || '').toLowerCase().includes(termo)
    );
  }

  if (!filteredItems.length) {
    const msg = S.searchTerm ? 'Nenhum item encontrado' : 'Nenhum item nessa categoria';
    content.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><p class="empty-text">${msg}</p></div>`;
    initStatusFilters();
    return;
  }

  let html = '';
  
  // Se agrupado por categoria
  if (S.groupByCategory) {
    const grouped = {};
    filteredItems.forEach(item => {
      const cat = item.categoria || 'Sem categoria';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    
    Object.keys(grouped).sort().forEach(categoria => {
      html += `<div style="margin-top:20px"><h3 style="margin:0 0 12px 0;font-size:12px;font-weight:700;color:var(--text-soft);text-transform:uppercase">${categoria}</h3>`;
      html += '<ul class="items" style="margin:0">';
      
      grouped[categoria].forEach(item => {
        if (isSelectMode) {
          html += `
            <li class="item ${item.status === 'sim' ? 'checked' : ''}" style="display:flex;align-items:center;gap:8px">
              <input type="checkbox" class="item-select" data-id="${item.item_id}" onchange="console.log('checkbox changed')" style="width:20px;height:20px;cursor:pointer;flex-shrink:0">
              <div class="item-info" style="flex:1">
                <p class="item-name" style="margin:0">${item.nome_item}</p>
                <p class="item-meta" style="margin:2px 0 0">${item.quantidade} ${item.unidade}</p>
              </div>
            </li>
          `;
        } else {
          html += `
            <li class="item ${item.status === 'sim' ? 'checked' : ''}">
              <div class="item-check" onclick="toggleItem('${item.item_id}')">
                ${item.status === 'sim' ? '✓' : ''}
              </div>
              <div class="item-info">
                <p class="item-name">${item.nome_item}</p>
                <p class="item-meta">${item.quantidade} ${item.unidade}</p>
              </div>
              <div class="item-actions">
                <button class="item-action edit" onclick="openEditItem('${item.item_id}')">✏️</button>
                <button class="item-action del" onclick="deleteItem('${item.item_id}')">🗑️</button>
              </div>
            </li>
          `;
        }
      });
      
      html += '</ul></div>';
    });
  } else {
    // Sem agrupamento
    html = '<ul class="items">';
    
    filteredItems.forEach(item => {
      if (isSelectMode) {
        html += `
          <li class="item ${item.status === 'sim' ? 'checked' : ''}" style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" class="item-select" data-id="${item.item_id}" onchange="console.log('checkbox changed')" style="width:20px;height:20px;cursor:pointer;flex-shrink:0">
            <div class="item-info" style="flex:1">
              <p class="item-name" style="margin:0">${item.nome_item}</p>
              <p class="item-meta" style="margin:2px 0 0">${item.quantidade} ${item.unidade} • ${item.emoji || ''} ${item.categoria}</p>
            </div>
          </li>
        `;
      } else {
        html += `
          <li class="item ${item.status === 'sim' ? 'checked' : ''}">
            <div class="item-check" onclick="toggleItem('${item.item_id}')">
              ${item.status === 'sim' ? '✓' : ''}
            </div>
            <div class="item-info">
              <p class="item-name">${item.nome_item}</p>
              <p class="item-meta">${item.quantidade} ${item.unidade} • ${item.emoji || ''} ${item.categoria}</p>
            </div>
            <div class="item-actions">
              <button class="item-action edit" onclick="openEditItem('${item.item_id}')">✏️</button>
              <button class="item-action del" onclick="deleteItem('${item.item_id}')">🗑️</button>
            </div>
          </li>
        `;
      }
    });
    
    html += '</ul>';
  }
  
  content.innerHTML = html;
  initStatusFilters();
}

function updateEditButton() {
  const selected = document.querySelectorAll('.item-select:checked').length;
  const editBtn = document.querySelector('[data-edit-btn]');
  if (editBtn) {
    editBtn.style.display = selected > 0 ? 'block' : 'none';
  }
}

// ========== ADD ITEM ==========
function openAddItem() {
  $('addItemModal').dataset.editItemId = '';
  document.querySelector('#addItemModal .modal-title').textContent = 'Novo Item';
  $('addItemModal').querySelector('button[type="submit"]').textContent = 'Adicionar';
  $('addItemForm').reset();
  loadCategories();
  $('addItemModal').classList.remove('hidden');
}

function openEditItem(itemId) {
  const item = S.items.find(i => String(i.item_id) === String(itemId));
  if (!item) { toast('Item não encontrado', 'danger'); return; }

  $('addItemModal').dataset.editItemId = itemId;
  document.querySelector('#addItemModal .modal-title').textContent = 'Editar Item';
  $('addItemModal').querySelector('button[type="submit"]').textContent = 'Salvar';

  $('itemNome').value = item.nome_item || '';
  $('itemQtd').value = item.quantidade || '1';
  $('itemUnit').value = item.unidade || 'un';

  // Carregar categorias e pré-selecionar a do item
  loadCategories(item.categoria);

  $('addItemModal').classList.remove('hidden');
}

function closeAddItem() {
  $('addItemModal').classList.add('hidden');
  $('addItemModal').dataset.editItemId = '';
  $('addItemForm').reset();
}

async function loadCategories(selectedCat) {
  try {
    const d = await jsonp(`${API}?action=getCategories&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d.error || !d.categories) return;
    
    const catDiv = document.createElement('div');
    catDiv.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:8px';
    
    const generalBtn = document.createElement('button');
    generalBtn.textContent = 'Geral';
    generalBtn.type = 'button';
    generalBtn.style.cssText = 'padding:6px 8px;border:2px solid #E7E8E6;background:white;border-radius:8px;cursor:pointer;font-size:12px;flex:0 1 calc(33.333% - 5px);text-align:center';
    generalBtn.dataset.cat = '';
    generalBtn.dataset.emoji = '';
    generalBtn.onclick = () => selectCategory(generalBtn);
    catDiv.appendChild(generalBtn);
    
    d.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.innerHTML = `${cat.emoji || ''}<br>${cat.nome}`;
      btn.type = 'button';
      btn.style.cssText = 'padding:6px 8px;border:2px solid #E7E8E6;background:white;border-radius:8px;cursor:pointer;font-size:11px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex:0 1 calc(33.333% - 5px);text-align:center;line-height:1.2';
      btn.dataset.cat = cat.nome;
      btn.dataset.emoji = cat.emoji || '';
      btn.onclick = () => selectCategory(btn);
      catDiv.appendChild(btn);
    });
    
    const oldEl = $('itemCat') || document.querySelector('#addItemForm .item-cat-buttons');
    if (oldEl) {
      catDiv.className = 'item-cat-buttons';
      oldEl.parentElement.replaceChild(catDiv, oldEl);
    }
    
    // Selecionar a categoria correta (a do item em edição, ou Geral)
    let target = generalBtn;
    if (selectedCat) {
      const match = Array.from(catDiv.querySelectorAll('button')).find(b => b.dataset.cat === selectedCat);
      if (match) target = match;
    }
    selectCategory(target);
  } catch (err) {
    console.log('Erro ao carregar categorias');
  }
}

function selectCategory(btn) {
  // Limpar anterior
  const btns = btn.parentElement.querySelectorAll('button');
  btns.forEach(b => {
    b.style.borderColor = '#E7E8E6';
    b.style.color = 'inherit';
    b.dataset.selected = 'false';
  });
  
  // Selecionar novo
  btn.style.borderColor = '#16A34A';
  btn.style.color = '#16A34A';
  btn.dataset.selected = 'true';
}

$('addItemForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // ========== SEGURANÇA V3.0 (LEVE) ==========
  if (appSecurity) {
    const limitCheck = appSecurity.rateLimiter.check(S.email, 'add_item');
    if (!limitCheck.allowed) {
      toast(limitCheck.reason, 'danger');
      return;
    }
  }
  // ====================================

  const nome = $('itemNome').value.trim();
  const qty = $('itemQtd').value || '1';
  const unit = $('itemUnit').value || 'un';
  
  // Pegar categoria do botão selecionado
  const selectedBtn = document.querySelector('button[data-selected="true"]');
  const cat = selectedBtn ? selectedBtn.dataset.cat : '';

  if (!nome) {
    toast('Nome obrigatório', 'danger');
    return;
  }

  const editItemId = $('addItemModal').dataset.editItemId || '';

  toast(editItemId ? 'Salvando...' : 'Adicionando...', 'loading');

  try {
    let url;
    if (editItemId) {
      url = `${API}?action=editItem&item_id=${encodeURIComponent(editItemId)}&nome_item=${encodeURIComponent(nome)}&quantidade=${qty}&unidade=${unit}&categoria=${encodeURIComponent(cat)}&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`;
    } else {
      url = `${API}?action=addItem&nome_item=${encodeURIComponent(nome)}&quantidade=${qty}&unidade=${unit}&categoria=${encodeURIComponent(cat)}&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`;
    }

    const d = await jsonp(url);

    if (d.error) {
      toast(d.error, 'danger');
      return;
    }

    closeAddItem();
    loadItems();
    toast(editItemId ? '✓ Item atualizado' : '✓ Item adicionado', 'success');
  } catch (err) {
    toast(editItemId ? 'Erro ao salvar' : 'Erro ao adicionar', 'danger');
  }
});

// ========== TOGGLE ITEM ==========
async function toggleItem(itemId) {
  const item = S.items.find(i => String(i.item_id) === String(itemId));
  if (!item) return;

  const newStatus = item.status === 'sim' ? 'não' : 'sim';

  try {
    const d = await jsonp(`${API}?action=updateItem&item_id=${itemId}&comprado=${newStatus === 'sim'}&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);

    if (d.error) {
      toast(d.error, 'danger');
      return;
    }

    item.status = newStatus;
    renderItems();
  } catch (err) {
    toast('Erro', 'danger');
  }
}

// ========== DELETE ITEM ==========
async function deleteItem(itemId) {
  if (!confirm('Tem certeza?')) return;

  try {
    const d = await jsonp(`${API}?action=deleteItem&item_id=${itemId}&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);

    if (d.error) {
      toast(d.error, 'danger');
      return;
    }

    loadItems();
    toast('✓ Item removido', 'success');
  } catch (err) {
    toast('Erro', 'danger');
  }
}

// ========== BULK EDIT ==========
async function toggleSelectMode() {
  const mainView = $('mainView');
  const isActive = mainView.getAttribute('data-select-mode') === 'true';
  
  if (isActive) {
    // Desativar modo
    mainView.setAttribute('data-select-mode', 'false');
    const editBtn = document.querySelector('[data-edit-btn]');
    if (editBtn) editBtn.innerHTML = '✎';
    const bulkBtn = document.querySelector('[data-bulk-btn]');
    if (bulkBtn) bulkBtn.remove();
    loadItems();
  } else {
    // Ativar modo
    mainView.setAttribute('data-select-mode', 'true');
    const editBtn = document.querySelector('[data-edit-btn]');
    if (editBtn) editBtn.innerHTML = '✕';
    
    // Adicionar botão "Mudar categoria"
    const filterRow = document.querySelector('.filter-row');
    if (filterRow && !filterRow.querySelector('[data-bulk-btn]')) {
      const bulkBtn = document.createElement('button');
      bulkBtn.type = 'button';
      bulkBtn.className = 'btn-p';
      bulkBtn.textContent = 'Mudar categoria';
      bulkBtn.style.cssText = 'flex:1;margin:0;';
      bulkBtn.setAttribute('data-bulk-btn', 'true');
      bulkBtn.onclick = openBulkEditModal;
      filterRow.appendChild(bulkBtn);
    }
    
    loadItems();
  }
}

async function openBulkEditModal() {
  const selected = document.querySelectorAll('.item-select:checked');
  if (selected.length === 0) {
    toast('Selecione itens', 'warning');
    return;
  }
  
  // SALVAR os IDs selecionados
  window.selectedItemIds = Array.from(selected).map(cb => cb.dataset.id);
  console.log('Itens selecionados salvos:', window.selectedItemIds);
  
  await loadBulkEditCategories();
  document.getElementById('bulkEditModal').classList.remove('hidden');
}

function closeBulkEditModal() {
  document.getElementById('bulkEditModal').classList.add('hidden');
  window.selectedItemIds = [];
}

async function loadBulkEditCategories() {
  console.log('loadBulkEditCategories chamado');
  try {
    const d = await jsonp(`${API}?action=getCategories&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    console.log('Resposta da API:', d);
    if (d.error || !d.categories) {
      console.log('Erro na resposta:', d.error);
      return;
    }
    
    const catDiv = document.querySelector('.bulk-cat-container');
    console.log('Container encontrado:', catDiv);
    if (!catDiv) {
      console.log('Container não encontrado!');
      return;
    }
    
    catDiv.innerHTML = '';
    
    // Botão Geral
    const generalBtn = document.createElement('button');
    generalBtn.textContent = 'Geral';
    generalBtn.type = 'button';
    generalBtn.dataset.cat = '';
    generalBtn.dataset.selected = 'false';
    generalBtn.style.cssText = 'padding:8px 12px;border:2px solid #E7E8E6;background:white;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.2s';
    
    generalBtn.addEventListener('click', function(e) {
      e.preventDefault();
      document.querySelectorAll('.bulk-cat-container button').forEach(b => {
        b.style.borderColor = '#E7E8E6';
        b.style.color = 'var(--text)';
        b.dataset.selected = 'false';
      });
      this.style.borderColor = '#16A34A';
      this.style.color = '#16A34A';
      this.dataset.selected = 'true';
      console.log('Categoria selecionada: Geral');
    });
    
    catDiv.appendChild(generalBtn);
    
    // Botões de categorias
    d.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.innerHTML = `${cat.emoji || ''} ${cat.nome}`;
      btn.type = 'button';
      btn.dataset.cat = cat.nome;
      btn.dataset.selected = 'false';
      btn.style.cssText = 'padding:8px 12px;border:2px solid #E7E8E6;background:white;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:4px;transition:all 0.2s';
      
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        document.querySelectorAll('.bulk-cat-container button').forEach(b => {
          b.style.borderColor = '#E7E8E6';
          b.style.color = 'var(--text)';
          b.dataset.selected = 'false';
        });
        this.style.borderColor = '#16A34A';
        this.style.color = '#16A34A';
        this.dataset.selected = 'true';
        console.log('Categoria selecionada:', cat.nome);
      });
      
      catDiv.appendChild(btn);
    });
    
    console.log('Categorias carregadas:', d.categories.length);
  } catch (err) {
    console.log('Erro ao carregar categorias:', err);
  }
}

function selectBulkCategory(btn) {
  const container = btn.parentElement;
  const btns = container.querySelectorAll('button');
  
  // Remover seleção anterior
  btns.forEach(b => {
    b.style.borderColor = '#E7E8E6';
    b.style.color = 'var(--text)';
    b.removeAttribute('data-selected');
  });
  
  // Adicionar seleção novo
  btn.style.borderColor = '#16A34A';
  btn.style.color = '#16A34A';
  btn.setAttribute('data-selected', 'true');
  
  console.log('Categoria selecionada:', btn.dataset.cat);
}

async function applyBulkEdit() {
  // Usar IDs salvos quando o modal foi aberto
  const selected = window.selectedItemIds || [];
  
  console.log('Aplicando bulk edit com itens:', selected);
  
  if (selected.length === 0) {
    toast('Selecione itens primeiro', 'warning');
    return;
  }
  
  // Procurar botão com data-selected='true'
  const selectedBtn = document.querySelector('.bulk-cat-container button[data-selected="true"]');
  
  console.log('Botão categoria encontrado:', selectedBtn);
  
  if (!selectedBtn) {
    toast('Selecione uma categoria', 'warning');
    return;
  }
  
  const newCategory = selectedBtn.dataset.cat || 'Geral';
  console.log('Enviando update:', { selected, newCategory });
  
  toast('Atualizando...', 'loading');
  
  try {
    const url = `${API}?action=updateItemsCategory&item_ids=${encodeURIComponent(JSON.stringify(selected))}&categoria=${encodeURIComponent(newCategory)}&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`;
    console.log('URL chamada:', url);
    
    const d = await jsonp(url);
    
    console.log('Resposta update:', d);
    if (d && d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    if (d && d.success) {
      toast(`✓ ${d.updated} itens atualizados`, 'success');
      closeBulkEditModal();
      toggleSelectMode();
      loadItems();
    } else {
      toast('Erro ao atualizar', 'danger');
    }
  } catch (err) {
    console.log('Erro:', err);
    toast('Erro ao atualizar', 'danger');
  }
}

$('settingsBtn').addEventListener('click', () => {
  $('settingsModal').classList.remove('hidden');
});

$('fab').addEventListener('click', openAddItem);

$('avBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  $('accMenu').classList.toggle('hidden');
});

// Fechar menu de perfil ao clicar fora
document.addEventListener('click', (e) => {
  const menu = $('accMenu');
  const avBtn = $('avBtn');
  if (menu && !menu.classList.contains('hidden')) {
    if (!menu.contains(e.target) && e.target !== avBtn) {
      menu.classList.add('hidden');
    }
  }
});

// ========== BUSCA ==========
$('searchInput')?.addEventListener('input', (e) => {
  S.searchTerm = e.target.value.trim();
  $('searchClear').style.display = S.searchTerm ? 'block' : 'none';
  renderItems();
});

$('searchClear')?.addEventListener('click', () => {
  S.searchTerm = '';
  $('searchInput').value = '';
  $('searchClear').style.display = 'none';
  renderItems();
});

// ========== AVATAR (foto ou inicial) ==========
function renderAvatar(nome, foto) {
  const av = $('avBtn');
  if (foto && String(foto).startsWith('data:image')) {
    av.textContent = '';
    av.style.backgroundImage = `url('${foto}')`;
    av.style.backgroundSize = 'cover';
    av.style.backgroundPosition = 'center';
  } else {
    av.style.backgroundImage = '';
    av.textContent = (nome || '?').charAt(0).toUpperCase();
  }
}

// ========== EDITAR MEUS DADOS ==========
$('profileBtn').addEventListener('click', () => {
  $('accMenu').classList.add('hidden');
  openMyDataModal();
});

function openMyDataModal() {
  $('myDataName').value = S.nome || '';
  $('myDataPassword').value = '';
  $('myDataPasswordConfirm').value = '';
  $('myDataPhoto').value = '';
  // Preview da foto atual
  const preview = $('myDataPhotoPreview');
  if (S.foto && String(S.foto).startsWith('data:image')) {
    preview.style.backgroundImage = `url('${S.foto}')`;
    preview.textContent = '';
  } else {
    preview.style.backgroundImage = '';
    preview.textContent = (S.nome || '?').charAt(0).toUpperCase();
  }
  // Guardar foto nova temporária (null = não mudou)
  $('myDataModal').dataset.newPhoto = '';
  $('myDataModal').dataset.newLogo = '';
  $('myDataModal').dataset.removeLogo = '';

  // Seção de logo da empresa: só para owner e diretor
  const logoSection = $('orgLogoSection');
  if (S.role === 'owner' || (S.groupName && S.groupName.toLowerCase() === 'diretor')) {
    logoSection.style.display = 'block';
    $('orgLogoInput').value = '';
    const logoPreview = $('orgLogoPreview');
    const hasLogo = S.orgLogo && String(S.orgLogo).startsWith('data:image');
    if (hasLogo) {
      logoPreview.style.backgroundImage = `url('${S.orgLogo}')`;
      logoPreview.textContent = '';
    } else {
      logoPreview.style.backgroundImage = '';
      logoPreview.textContent = '🏢';
    }
    // Botão remover só aparece se já existe logo
    $('orgLogoRemoveBtn').style.display = hasLogo ? 'block' : 'none';
  } else {
    logoSection.style.display = 'none';
  }

  $('myDataModal').classList.remove('hidden');
}

function closeMyDataModal() {
  $('myDataModal').classList.add('hidden');
}

// Marcar logo para remoção (volta ao ícone padrão ao salvar)
function removeOrgLogo() {
  $('myDataModal').dataset.removeLogo = 'true';
  $('myDataModal').dataset.newLogo = '';
  $('orgLogoInput').value = '';
  const preview = $('orgLogoPreview');
  preview.style.backgroundImage = '';
  preview.textContent = '🏢';
  $('orgLogoRemoveBtn').style.display = 'none';
  toast('Logo será removida ao salvar', 'loading');
}

// Processar upload de foto com compressão
$('myDataPhoto')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Imagem muito grande (máx 5MB)', 'danger');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Redimensionar para máx 200x200 e comprimir
      const canvas = document.createElement('canvas');
      const maxSize = 200;
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
      } else {
        if (height > maxSize) { width = width * maxSize / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const base64 = canvas.toDataURL('image/jpeg', 0.7);
      $('myDataModal').dataset.newPhoto = base64;
      // Atualizar preview
      const preview = $('myDataPhotoPreview');
      preview.style.backgroundImage = `url('${base64}')`;
      preview.textContent = '';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

// Processar upload da LOGO da empresa, garantindo que caiba no limite do Sheets (50K chars/célula)
$('orgLogoInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Imagem muito grande (máx 5MB)', 'danger');
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const LIMITE = 45000; // margem de segurança do limite de 50K da célula

      // Tentar tamanhos decrescentes até caber no limite
      function gerar(maxSize, quality) {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) { height = height * maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width = width * maxSize / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        // Fundo branco (JPEG não tem transparência) para logos com fundo transparente
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return canvas.toDataURL('image/jpeg', quality);
      }

      // Reduzir progressivamente até caber
      const tentativas = [
        [400, 0.85], [350, 0.8], [300, 0.75], [250, 0.7],
        [200, 0.65], [180, 0.6], [150, 0.55], [120, 0.5]
      ];
      let base64 = null;
      for (const [size, q] of tentativas) {
        const candidato = gerar(size, q);
        if (candidato.length <= LIMITE) { base64 = candidato; break; }
      }
      if (!base64) {
        // Última tentativa bem pequena
        base64 = gerar(100, 0.4);
        if (base64.length > LIMITE) {
          toast('Imagem muito complexa. Tente uma logo mais simples.', 'danger');
          e.target.value = '';
          return;
        }
      }

      $('myDataModal').dataset.newLogo = base64;
      $('myDataModal').dataset.removeLogo = '';
      const preview = $('orgLogoPreview');
      preview.style.backgroundImage = `url('${base64}')`;
      preview.textContent = '';
      $('orgLogoRemoveBtn').style.display = 'block';
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

async function saveMyData() {
  const nome = $('myDataName').value.trim();
  const senha = $('myDataPassword').value;
  const senhaConfirm = $('myDataPasswordConfirm').value;
  const newPhoto = $('myDataModal').dataset.newPhoto || '';

  if (!nome) { toast('Nome é obrigatório', 'danger'); return; }
  if (senha) {
    if (senha.length < 6) { toast('Senha mínima 6 caracteres', 'danger'); return; }
    if (senha !== senhaConfirm) { toast('Senhas não conferem', 'danger'); return; }
  }

  toast('Salvando...', 'loading');
  try {
    // Perfil pessoal via POST (foto base64 pode ser grande)
    const profileParams = {
      user_id: S.userId,
      nome: nome,
      email_auth: S.email,
      senha_auth: S.senha
    };
    if (senha) profileParams.nova_senha = senha;
    if (newPhoto) profileParams.foto_base64 = newPhoto;

    const d = await postData('updateMyProfile', profileParams);

    if (d.error) { toast(d.error, 'danger'); return; }

    // Atualizar estado local
    S.nome = nome;
    localStorage.setItem('nome', nome);
    if (newPhoto) {
      S.foto = newPhoto;
      localStorage.setItem('foto', newPhoto);
    }
    if (senha) {
      S.senha = senha;
      sessionStorage.setItem('senha', senha);
    }

    // Atualizar UI
    $('accName').textContent = nome;
    renderAvatar(nome, S.foto);

    // Salvar/remover logo da empresa (só owner)
    const newLogo = $('myDataModal').dataset.newLogo || '';
    const removeLogo = $('myDataModal').dataset.removeLogo === 'true';
    if ((S.role === 'owner' || (S.groupName && S.groupName.toLowerCase() === 'diretor')) && (newLogo || removeLogo)) {
      const logoValue = removeLogo ? '' : newLogo;
      const dLogo = await postData('updateOrgLogo', {
        logo_base64: logoValue,
        email_auth: S.email,
        senha_auth: S.senha
      });
      if (dLogo.error) {
        toast('Dados salvos, mas erro na logo: ' + dLogo.error, 'danger');
      } else {
        S.orgLogo = logoValue;
        localStorage.setItem('orgLogo', logoValue);
        renderOrgLogo();
      }
    }

    closeMyDataModal();
    toast('✓ Dados atualizados', 'success');
  } catch (err) {
    toast('Erro ao salvar', 'danger');
  }
}

function initBulkEditUI() {
  // Criar modal se não existir
  if (!document.getElementById('bulkEditModal')) {
    const modal = document.createElement('div');
    modal.id = 'bulkEditModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" onclick="closeBulkEditModal()">✕</button>
        <h2 class="modal-title">Mudar categoria</h2>
        <p style="font-size:13px;color:var(--text-soft);margin:8px 0">Selecione a nova categoria:</p>
        <div class="bulk-cat-container" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"></div>
        <div class="modal-actions">
          <button type="button" class="btn-p" onclick="applyBulkEdit()">Mudar</button>
          <button type="button" class="btn-sec" onclick="closeBulkEditModal()">Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  
  // Criar botão editar se não existir
  const filterRow = document.querySelector('.filter-row');
  if (filterRow && !filterRow.querySelector('[data-edit-btn]')) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'icon-btn';
    editBtn.innerHTML = '✎';
    editBtn.title = 'Modo seleção';
    editBtn.setAttribute('data-edit-btn', 'true');
    editBtn.onclick = toggleSelectMode;
    filterRow.appendChild(editBtn);
  }
}

// Inicializar UI ao carregar
// ========== SETTINGS / CONFIGURAÇÕES ==========
async function openSettings() {
  $('settingsModal').classList.remove('hidden');
  switchSettingsTab('usuarios');
  // Garantir que S.households esteja completo (para o seletor de lojas no cadastro de membros)
  try {
    const d = await jsonp(`${API}?action=getHouseholds&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d && d.households) S.households = d.households;
  } catch (err) {}
}

function closeSettings() {
  $('settingsModal').classList.add('hidden');
}

function switchSettingsTab(tabName) {
  // Esconder todas as abas
  document.querySelectorAll('.settings-tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.settings-tab').forEach(el => el.classList.remove('active'));
  
  // Mostrar aba selecionada
  const tabEl = document.getElementById(`tab-${tabName}`);
  if (tabEl) {
    tabEl.classList.remove('hidden');
  }
  
  // Marcar botão como ativo
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  // Carregar conteúdo
  if (tabName === 'usuarios') {
    loadUsersList();
  } else if (tabName === 'grupos') {
    loadGroupsList();
  } else if (tabName === 'categorias') {
    loadCategoriesList();
  }
}

function openNewUserModal() {
  $('newUserModal').classList.remove('hidden');
  $('newUserModal').dataset.editUserId = '';
  
  // Resetar título, botão e dropdown
  document.querySelector('#newUserModal .modal-title').textContent = 'Convidar membro';
  $('userModalSaveBtn').textContent = 'Convidar membro';
  $('newUserGroup').value = '';
  
  // Desmarcar permissões
  document.querySelectorAll('.user-permission').forEach(cb => cb.checked = false);
  
  renderAccessibleHouseholds();
  renderAccessScheduleTable();
  loadGroupsForSelect();
}

function closeNewUserModal() {
  $('newUserModal').classList.add('hidden');
  document.getElementById('newUserForm').reset();
  $('newUserModal').dataset.editUserId = '';
  
  // Resetar title e botão
  document.querySelector('#newUserModal .modal-title').textContent = 'Convidar membro';
  $('userModalSaveBtn').textContent = 'Convidar membro';
  
  // Desmarcar permissões
  document.querySelectorAll('.user-permission').forEach(cb => cb.checked = false);
}

function loadGroupsForSelect() {
  // Carregar grupos para dropdown - RETORNA PROMISE
  return jsonp(`${API}?action=getGroups&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`)
    .then(d => {
      if (d.error) {
        console.error('Erro ao carregar grupos:', d.error);
        return;
      }
      
      const select = $('newUserGroup');
      const currentValue = select.value;
      
      // Limpar opções existentes (mantém a primeira)
      while (select.options.length > 1) {
        select.remove(1);
      }
      
      // Adicionar grupos
      if (d.groups && d.groups.length > 0) {
        d.groups.forEach(group => {
          const option = document.createElement('option');
          option.value = group.group_id;
          option.textContent = `${group.nome} (${(group.permissions || '').split(',').filter(p => p.trim()).length} perms)`;
          select.appendChild(option);
        });
      }
      
      // Restaurar valor anterior
      select.value = currentValue;
    })
    .catch(err => console.error('Erro:', err));
}

// Event listener para auto-marcar permissões ao selecionar grupo
$('newUserGroup')?.addEventListener('change', function() {
  if (!this.value) {
    // Nenhum grupo selecionado - desmarcar tudo
    document.querySelectorAll('.user-permission').forEach(cb => cb.checked = false);
    return;
  }
  
  // Buscar dados do grupo
  jsonp(`${API}?action=getGroups&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`)
    .then(d => {
      if (d.error || !d.groups) return;
      
      const selectedGroup = d.groups.find(g => String(g.group_id) === String(this.value));
      if (!selectedGroup) return;
      
      // Desmarcar tudo
      document.querySelectorAll('.user-permission').forEach(cb => cb.checked = false);
      
      // Marcar permissões do grupo
      const perms = (selectedGroup.permissions || '').split(',').map(p => p.trim()).filter(p => p);
      perms.forEach(perm => {
        const checkbox = document.getElementById(`perm-${perm}`);
        if (checkbox) checkbox.checked = true;
      });
    })
    .catch(err => console.error('Erro:', err));
});

function renderAccessibleHouseholds() {
  const container = $('accessibleHouseholdsList');
  container.innerHTML = '';
  
  if (!S.households || S.households.length === 0) return;
  
  S.households.forEach((hh, idx) => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:6px;cursor:pointer';
    label.innerHTML = `
      <input type="checkbox" name="accessible_hh" value="${hh.household_id}" ${idx === 0 ? 'checked' : ''}>
      <span style="font-size:13px">${hh.nome}</span>
    `;
    container.appendChild(label);
  });
}

function renderAccessScheduleTable() {
  const container = $('accessScheduleTable');
  container.innerHTML = '';
  
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  
  dias.forEach(dia => {
    const row = document.createElement('div');
    row.className = 'schedule-row';
    row.innerHTML = `
      <label style="margin:0;padding:0;display:flex;align-items:center;gap:6px;min-width:90px">
        <input type="checkbox" class="schedule-checkbox" data-dia="${dia}" ${dia !== 'Domingo' && dia !== 'Sábado' ? 'checked' : ''}>
        <span style="font-size:13px;font-weight:600">${dia}</span>
      </label>
      <input type="time" class="schedule-time" data-dia="${dia}" data-type="start" value="08:00" disabled>
      <input type="time" class="schedule-time" data-dia="${dia}" data-type="end" value="18:00" disabled>
    `;
    
    const checkbox = row.querySelector('.schedule-checkbox');
    const times = row.querySelectorAll('.schedule-time');
    
    // Sincronizar estado inicial: se já vem marcado, habilitar os campos
    times.forEach(t => t.disabled = !checkbox.checked);
    
    checkbox.addEventListener('change', (e) => {
      times.forEach(t => t.disabled = !e.target.checked);
    });
    
    container.appendChild(row);
  });
}

async function saveNewUser() {
  const nome = $('newUserName').value.trim();
  const novoEmail = $('newUserEmail').value.trim();
  const novaSenha = $('newUserPassword').value;
  const group_id = $('newUserGroup').value || '';
  const editUserId = $('newUserModal').dataset.editUserId || '';
  
  console.log('DEBUG saveNewUser: nome=', nome, 'email=', novoEmail, 'group_id=', group_id, 'editUserId=', editUserId);
  
  // Validações
  if (!nome || !novoEmail) {
    toast('Nome e email são obrigatórios', 'warning');
    return;
  }
  
  // Se é novo usuário, senha é obrigatória
  if (!editUserId && !novaSenha) {
    toast('Senha é obrigatória para novo usuário', 'warning');
    return;
  }
  
  // Se há senha, validar mínimo de 6 caracteres
  if (novaSenha && novaSenha.length < 6) {
    toast('Senha deve ter mínimo 6 caracteres', 'warning');
    return;
  }
  
  // Coletar permissões
  const permissions = [];
  document.querySelectorAll('.user-permission:checked').forEach(cb => {
    const id = cb.id.replace('perm-', '');
    permissions.push(id);
  });
  
  // Coletar lojas acessíveis
  const accessible_hh = [];
  document.querySelectorAll('input[name="accessible_hh"]:checked').forEach(cb => {
    accessible_hh.push(cb.value);
  });
  
  // Coletar horários
  const access_schedule = {};
  document.querySelectorAll('.schedule-checkbox').forEach(cb => {
    const dia = cb.dataset.dia;
    access_schedule[dia.toLowerCase()] = {
      enabled: cb.checked,
      start: cb.checked ? document.querySelector(`input[data-dia="${dia}"][data-type="start"]`).value : null,
      end: cb.checked ? document.querySelector(`input[data-dia="${dia}"][data-type="end"]`).value : null
    };
  });
  
  toast(editUserId ? 'Atualizando membro...' : 'Convidando membro...', 'loading');
  
  try {
    let d;
    
    if (editUserId) {
      // EDITAR usuário - senha opcional
      const params = {
        user_id: editUserId,
        nome: nome,
        email_novo: novoEmail,
        role: 'membro',
        group_id: group_id,
        permissions: permissions.join(','),
        accessible_households: accessible_hh.join(','),
        access_schedule: JSON.stringify(access_schedule),
        email_auth: S.email,
        senha_auth: S.senha
      };
      if (novaSenha) params.senha_nova = novaSenha;
      console.log('DEBUG updateUser params:', params);
      d = await postData('updateUser', params);
    } else {
      // NOVO usuário - senha obrigatória
      const params = {
        nome: nome,
        email: novoEmail,
        senha: novaSenha,
        group_id: group_id,
        permissions: permissions.join(','),
        accessible_households: accessible_hh.join(','),
        access_schedule: JSON.stringify(access_schedule),
        household_id: S.hhId,
        email_auth: S.email,
        senha_auth: S.senha
      };
      console.log('DEBUG addUser params:', params);
      d = await postData('addUser', params);
    }
    
    console.log('DEBUG saveNewUser resposta:', d);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    if (d.success) {
      toast(`✓ Membro ${editUserId ? 'atualizado' : 'convidado'} com sucesso`, 'success');
      closeNewUserModal();
      loadUsersList();
    }
  } catch (err) {
    console.error('Erro ao chamar API:', err);
    toast(`Erro ao ${editUserId ? 'atualizar' : 'convidar'} membro`, 'danger');
  }
}

async function loadUsersList() {
  const container = $('usersList');
  container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Carregando...</p>';
  
  try {
    const d = await jsonp(`${API}?action=getUsers&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    
    if (d.error) {
      container.innerHTML = `<p style="color:var(--danger);font-size:13px">${d.error}</p>`;
      return;
    }
    
    if (!d.users || d.users.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Nenhum colaborador ainda</p>';
      return;
    }
    
    container.innerHTML = d.users.map(user => `
      <div class="user-card">
        <div class="user-card-info">
          <div class="user-card-name">👤 ${user.nome}</div>
          <div class="user-card-role">${user.group_name || user.role || 'Membro'}</div>
        </div>
        <div class="user-card-actions">
          <button class="user-card-btn" onclick="editUser('${user.user_id}')">✏️ Editar</button>
          <button class="user-card-btn" onclick="deleteUser('${user.user_id}')">🗑️</button>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    container.innerHTML = '<p style="color:var(--danger);font-size:13px">Erro ao carregar</p>';
  }
}

async function editUser(userId) {
  console.log('DEBUG editUser: S.email=', S.email, 'S.senha=', S.senha ? '***' : 'VAZIO');
  
  try {
    // Buscar dados do usuário
    const d = await jsonp(`${API}?action=getUserById&user_id=${encodeURIComponent(userId)}&email_auth=${encodeURIComponent(S.email)}&senha_auth=${encodeURIComponent(S.senha)}`);
    
    console.log('DEBUG getUserById resposta:', d);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    const user = d.user;
    console.log('DEBUG user dados:', user);
    
    // Abrir modal com dados
    $('newUserModal').classList.remove('hidden');
    $('newUserModal').dataset.editUserId = userId;
    
    // Atualizar título e botão
    document.querySelector('#newUserModal .modal-title').textContent = 'Editar Colaborador';
    $('userModalSaveBtn').textContent = 'Alterar dados';
    
    // Preencher campos
    $('newUserName').value = user.nome || '';
    $('newUserEmail').value = user.email || '';
    $('newUserPassword').value = ''; // Deixar vazio - senha opcional
    
    // Carregar grupos e selecionar o do usuário
    await loadGroupsForSelect();
    console.log('DEBUG group_id do usuário (tipo):', typeof user.group_id, 'valor:', user.group_id);
    
    // Agora setar o valor (sem setTimeout)
    const groupIdStr = String(user.group_id || '');
    $('newUserGroup').value = groupIdStr;
    console.log('DEBUG dropdown value setado para:', groupIdStr, 'options:', Array.from($('newUserGroup').options).map(o => o.value));
    
    // Desmarcar e marcar permissões
    document.querySelectorAll('.user-permission').forEach(cb => {
      const perm = cb.id.replace('perm-', '');
      cb.checked = (user.permissions || '').includes(perm);
    });
    
    // Lojas acessíveis - RENDERIZAR PRIMEIRO
    renderAccessibleHouseholds();
    
    let accessibleList = [];
    if (user.accessible_households) {
      if (typeof user.accessible_households === 'string') {
        accessibleList = user.accessible_households.split(',').map(h => h.trim()).filter(h => h);
      } else if (Array.isArray(user.accessible_households)) {
        accessibleList = user.accessible_households;
      }
    }
    document.querySelectorAll('input[name="accessible_hh"]').forEach(cb => {
      cb.checked = accessibleList.includes(String(cb.value));
    });
    
    // Horários - RENDERIZAR TABELA PRIMEIRO, depois preencher
    renderAccessScheduleTable();
    
    let schedule = {};
    try {
      schedule = JSON.parse(user.access_schedule || '{}');
    } catch (e) {}
    
    const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    dias.forEach(dia => {
      const diaCap = dia.charAt(0).toUpperCase() + dia.slice(1);
      const checkbox = document.querySelector(`input.schedule-checkbox[data-dia="${diaCap}"]`);
      const startInput = document.querySelector(`input.schedule-time[data-dia="${diaCap}"][data-type="start"]`);
      const endInput = document.querySelector(`input.schedule-time[data-dia="${diaCap}"][data-type="end"]`);
      
      if (checkbox && startInput && endInput) {
        if (schedule[dia]) {
          checkbox.checked = schedule[dia].enabled;
          if (schedule[dia].start) startInput.value = schedule[dia].start;
          if (schedule[dia].end) endInput.value = schedule[dia].end;
          startInput.disabled = !schedule[dia].enabled;
          endInput.disabled = !schedule[dia].enabled;
        } else {
          checkbox.checked = false;
          startInput.disabled = true;
          endInput.disabled = true;
        }
      }
    });
    
  } catch (err) {
    console.error('Erro:', err);
    toast('Erro ao carregar dados do usuário', 'danger');
  }
}

async function deleteUser(userId) {
  if (!confirm('Deseja deletar este colaborador?')) return;
  
  toast('Deletando...', 'loading');
  try {
    const d = await jsonp(`${API}?action=deleteUser&user_id=${encodeURIComponent(userId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    toast('✓ Colaborador removido', 'success');
    loadUsersList();
  } catch (err) {
    toast('Erro ao deletar', 'danger');
  }
}

function loadGroupsList() {
  toast('Carregando grupos...', 'loading');
  const container = $('groupsList');
  container.innerHTML = '';
  
  loadGroupsData();
}

async function loadGroupsData() {
  const container = $('groupsList');
  
  try {
    const d = await jsonp(`${API}?action=getGroups&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    
    console.log('Grupos carregados:', d);
    
    if (d.error) {
      container.innerHTML = `<p style="color:var(--danger);font-size:13px">${d.error}</p>`;
      return;
    }
    
    if (!d.groups || d.groups.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Nenhum grupo ainda</p>';
      return;
    }
    
    container.innerHTML = d.groups.map(group => {
      const perms = (group.permissions || '').split(',').filter(p => p.trim());
      return `
        <div class="user-card">
          <div class="user-card-info">
            <div class="user-card-name">👤 ${group.nome}</div>
            <div class="user-card-role">${perms.length} permissões</div>
          </div>
          <div class="user-card-actions">
            <button class="user-card-btn" onclick="editGroup('${group.group_id}', '${group.nome}', '${(group.permissions || '').replace(/'/g, '&#39;')}')">✏️ Editar</button>
            <button class="user-card-btn" onclick="deleteGroup('${group.group_id}')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
    
    toast('✓ Grupos carregados', 'success');
  } catch (err) {
    console.error('Erro ao carregar grupos:', err);
    container.innerHTML = '<p style="color:var(--danger);font-size:13px">Erro ao carregar</p>';
  }
}

function openNewGroupModal() {
  $('groupModalTitle').textContent = 'Novo Grupo';
  $('groupSaveBtn').textContent = 'Salvar';
  $('newGroupModal').classList.remove('hidden');
  $('newGroupForm').reset();
  document.getElementById('newGroupModal').dataset.groupId = '';
}

function closeNewGroupModal() {
  $('newGroupModal').classList.add('hidden');
  document.getElementById('newGroupForm').reset();
}

function editGroup(groupId, nome, permissions) {
  $('groupModalTitle').textContent = 'Editar Grupo';
  $('groupSaveBtn').textContent = 'Atualizar';
  $('newGroupModal').classList.remove('hidden');
  
  $('newGroupName').value = nome;
  document.getElementById('newGroupModal').dataset.groupId = groupId;
  
  // Desmarcar todos
  document.querySelectorAll('.group-permission').forEach(cb => cb.checked = false);
  
  // Marcar as permissões do grupo
  if (permissions) {
    const perms = permissions.split(',').map(p => p.trim());
    perms.forEach(perm => {
      const checkbox = document.getElementById(`groupPerm-${perm}`);
      if (checkbox) checkbox.checked = true;
    });
  }
}

async function saveNewGroup() {
  const nome = $('newGroupName').value.trim();
  const groupId = document.getElementById('newGroupModal').dataset.groupId;
  
  if (!nome) {
    toast('Nome do grupo obrigatório', 'warning');
    return;
  }
  
  // Coletar permissões
  const permissions = [];
  document.querySelectorAll('.group-permission:checked').forEach(cb => {
    const id = cb.id.replace('groupPerm-', '');
    permissions.push(id);
  });
  
  toast(groupId ? 'Atualizando...' : 'Salvando...', 'loading');
  
  try {
    const action = groupId ? 'updateGroup' : 'addGroup';
    const params = groupId ? `&group_id=${encodeURIComponent(groupId)}` : '';
    
    const d = await jsonp(`${API}?action=${action}&nome=${encodeURIComponent(nome)}&permissions=${encodeURIComponent(permissions.join(','))}&org_id=${encodeURIComponent(S.orgId)}${params}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    
    console.log('Resposta saveGroup:', d);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    toast(groupId ? '✓ Grupo atualizado' : '✓ Grupo criado', 'success');
    closeNewGroupModal();
    loadGroupsData();
  } catch (err) {
    console.error('Erro:', err);
    toast('Erro ao salvar grupo', 'danger');
  }
}

async function deleteGroup(groupId) {
  if (!confirm('Deseja deletar este grupo?')) return;
  
  toast('Deletando...', 'loading');
  
  try {
    const d = await jsonp(`${API}?action=deleteGroup&group_id=${encodeURIComponent(groupId)}&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    
    console.log('Resposta deleteGroup:', d);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    toast('✓ Grupo removido', 'success');
    loadGroupsData();
  } catch (err) {
    console.error('Erro:', err);
    toast('Erro ao deletar grupo', 'danger');
  }
}

function loadCategoriesList() {
  const container = $('categoriesList');
  container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Carregando...</p>';
  loadCategoriesData();
}

async function loadCategoriesData() {
  const container = $('categoriesList');
  
  try {
    const d = await jsonp(`${API}?action=getCategories&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    
    console.log('Categorias carregadas:', d);
    
    if (d.error) {
      container.innerHTML = `<p style="color:var(--danger);font-size:13px">${d.error}</p>`;
      return;
    }
    
    if (!d.categories || d.categories.length === 0) {
      container.innerHTML = '<p style="color:var(--text-secondary);font-size:13px">Nenhuma categoria ainda</p>';
      return;
    }
    
    container.innerHTML = d.categories.map(cat => `
      <div style="padding:12px;border:1px solid var(--border);border-radius:6px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:16px;margin-bottom:4px">${cat.emoji || '📁'} <strong>${cat.nome}</strong></div>
          <div style="font-size:12px;color:var(--text-secondary)">
            Fundo: ${cat.cor_bg || '#FFF'} | Texto: ${cat.cor_text || '#000'}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="user-card-btn" onclick="editCategory('${cat.category_id}', '${cat.nome}', '${cat.emoji || ''}', '${cat.cor_bg || '#FFF'}', '${cat.cor_text || '#000'}')">✏️ Editar</button>
          <button class="user-card-btn" onclick="deleteCategory('${cat.category_id}')">🗑️</button>
        </div>
      </div>
    `).join('');
    
  } catch (err) {
    console.error('Erro ao carregar categorias:', err);
    container.innerHTML = '<p style="color:var(--danger);font-size:13px">Erro ao carregar</p>';
  }
}

function openNewCategoryModal() {
  $('categoryModalTitle').textContent = 'Nova Categoria';
  document.getElementById('newCategoryForm').reset();
  $('newCatBgColor').value = '#FF6B6B';
  $('newCatBgColorPicker').value = '#FF6B6B';
  $('newCatTextColor').value = '#FFFFFF';
  $('newCatTextColorPicker').value = '#FFFFFF';
  $('newCategoryModal').dataset.editId = '';
  updateCategoryPreview();
  renderEmojiPicker();
  $('newCategoryModal').classList.remove('hidden');
}

function closeNewCategoryModal() {
  $('newCategoryModal').classList.add('hidden');
  document.getElementById('newCategoryForm').reset();
  closeEmojiPicker();
}

function openEmojiPicker() {
  const picker = $('emojiPickerContainer');
  picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

function closeEmojiPicker() {
  $('emojiPickerContainer').style.display = 'none';
}

function renderEmojiPicker() {
  const emojis = ['🍎', '🥕', '🥬', '🍌', '🍊', '🥛', '🧀', '🥚', '🍗', '🥩', '🥐', '🍞', '🥫', '🧂', '🌶️', '🧅', '🥒', '🥔', '🍠', '🌽', '🥦', '🥬', '🍍', '🍓', '🍒', '🍑', '🥑', '🍅', '🥒', '🌶️'];
  const grid = $('emojiGrid');
  grid.innerHTML = emojis.map(emoji => `
    <button type="button" onclick="selectEmoji('${emoji}')" style="padding:8px;background:var(--bg-hover);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-size:20px;transition:all 0.2s">
      ${emoji}
    </button>
  `).join('');
}

function selectEmoji(emoji) {
  $('newCatEmoji').value = emoji;
  closeEmojiPicker();
  updateCategoryPreview();
}

function updateCategoryPreview() {
  const emoji = $('newCatEmoji').value || '📁';
  const nome = $('newCatName').value || 'Categoria';
  const bgColor = $('newCatBgColor').value || '#FF6B6B';
  const textColor = $('newCatTextColor').value || '#FFFFFF';
  
  const preview = $('catPreview');
  preview.textContent = `${emoji} ${nome}`;
  preview.style.backgroundColor = bgColor;
  preview.style.color = textColor;
}

// Sincronizar inputs de cor
$('newCatBgColor')?.addEventListener('input', function() {
  $('newCatBgColorPicker').value = this.value;
  updateCategoryPreview();
});

$('newCatBgColorPicker')?.addEventListener('input', function() {
  $('newCatBgColor').value = this.value.toUpperCase();
  updateCategoryPreview();
});

$('newCatTextColor')?.addEventListener('input', function() {
  $('newCatTextColorPicker').value = this.value;
  updateCategoryPreview();
});

$('newCatTextColorPicker')?.addEventListener('input', function() {
  $('newCatTextColor').value = this.value.toUpperCase();
  updateCategoryPreview();
});

$('newCatName')?.addEventListener('input', updateCategoryPreview);
$('newCatEmoji')?.addEventListener('input', updateCategoryPreview);

async function saveNewCategory() {
  const nome = $('newCatName').value.trim();
  const emoji = $('newCatEmoji').value || '📁';
  const cor_bg = $('newCatBgColor').value || '#FF6B6B';
  const cor_text = $('newCatTextColor').value || '#FFFFFF';
  const editId = $('newCategoryModal').dataset.editId || '';
  
  if (!nome) {
    toast('Nome da categoria é obrigatório', 'warning');
    return;
  }
  
  toast(editId ? 'Atualizando categoria...' : 'Criando categoria...', 'loading');
  
  try {
    const action = editId ? 'updateCategory' : 'addCategory';
    const url = editId
      ? `${API}?action=${action}&category_id=${encodeURIComponent(editId)}&nome=${encodeURIComponent(nome)}&emoji=${encodeURIComponent(emoji)}&cor_bg=${encodeURIComponent(cor_bg)}&cor_text=${encodeURIComponent(cor_text)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`
      : `${API}?action=${action}&nome=${encodeURIComponent(nome)}&emoji=${encodeURIComponent(emoji)}&cor_bg=${encodeURIComponent(cor_bg)}&cor_text=${encodeURIComponent(cor_text)}&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`;
    
    const d = await jsonp(url);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    toast(`✓ Categoria ${editId ? 'atualizada' : 'criada'} com sucesso`, 'success');
    closeNewCategoryModal();
    loadCategoriesList();
  } catch (err) {
    console.error('Erro:', err);
    toast('Erro ao salvar categoria', 'danger');
  }
}

function editCategory(categoryId, nome, emoji, cor_bg, cor_text) {
  $('categoryModalTitle').textContent = 'Editar Categoria';
  $('newCatName').value = nome;
  $('newCatEmoji').value = emoji;
  $('newCatBgColor').value = cor_bg;
  $('newCatBgColorPicker').value = cor_bg;
  $('newCatTextColor').value = cor_text;
  $('newCatTextColorPicker').value = cor_text;
  $('newCategoryModal').dataset.editId = categoryId;
  updateCategoryPreview();
  renderEmojiPicker();
  $('newCategoryModal').classList.remove('hidden');
}

async function deleteCategory(categoryId) {
  if (!confirm('Deseja deletar esta categoria?')) {
    return;
  }
  
  toast('Deletando categoria...', 'loading');
  
  try {
    const d = await jsonp(`${API}?action=deleteCategory&category_id=${encodeURIComponent(categoryId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    toast('✓ Categoria deletada', 'success');
    loadCategoriesList();
  } catch (err) {
    console.error('Erro:', err);
    toast('Erro ao deletar categoria', 'danger');
  }
}

// ========== EVENTOS ==========
$('settingsBtn').addEventListener('click', openSettings);

initBulkEditUI();
if (S.email && S.senha) {
  $('loginScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  $('accMenu').classList.add('hidden');
  
  jsonp(`${API}?action=login&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`).then(d => {
    if (d.error || d.needsPassword) {
      showLogin();
      return;
    }

    initSecurity(d.user, d.access_token || '', d.refresh_token || '');

    S.nome = d.user.nome || '';
    S.foto = d.user.foto_base64 || '';
    S.groupName = d.user.group_name || '';
    localStorage.setItem('nome', S.nome);
    localStorage.setItem('foto', S.foto);
    localStorage.setItem('groupName', S.groupName);

    $('accName').textContent = d.user.nome;
    $('accRole').textContent = (d.user.group_name || d.user.role || 'Membro').toUpperCase();
    renderAvatar(d.user.nome, d.user.foto_base64);

    // Logo da organização
    S.orgLogo = d.org_logo || '';
    localStorage.setItem('orgLogo', S.orgLogo);
    renderOrgLogo();

    if (S.hhId) {
      $('householdsView').classList.add('hidden');
      $('mainView').classList.remove('hidden');
      loadItems();
    } else if (d.households && d.households.length > 0) {
      S.households = d.households;
      $('householdsView').classList.remove('hidden');
      $('mainView').classList.add('hidden');
      renderHouseholds();
    }
  }).catch(() => showLogin());
} else {
  showLogin();
}
