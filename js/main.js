// ================================================
// GESTAO v3.0 - MAIN.JS
// Login + CRUD + Segurança
// ================================================

const API = 'https://script.google.com/macros/s/AKfycbx1if5kO7BQCvu1onniW5gjWKj5yCqzOopgYISOOiKBD4CDdugTsc_PYN4JfI_zCzk/exec';

// Estado global
const S = {
  email: localStorage.getItem('email') || '',
  senha: sessionStorage.getItem('senha') || '',
  userId: localStorage.getItem('userId') || '',
  role: localStorage.getItem('role') || '',
  hhId: localStorage.getItem('hhId') || '',
  orgId: localStorage.getItem('orgId') || '',
  items: [],
  households: [],
  permissions: []
};

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

function showLogin() {
  $('loginScreen').classList.remove('hidden');
  $('registerScreen').classList.add('hidden');
  $('appScreen').classList.add('hidden');
}

function showRegister() {
  $('loginScreen').classList.add('hidden');
  $('registerScreen').classList.remove('hidden');
}

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
    S.role = d.user.role;
    S.orgId = d.user.org_id;
    S.permissions = d.user.permissions || [];

    localStorage.setItem('email', email);
    localStorage.setItem('userId', S.userId);
    localStorage.setItem('role', S.role);
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
    $('accRole').textContent = d.user.role.toUpperCase();
    const av = $('avBtn');
    av.textContent = d.user.nome.charAt(0).toUpperCase();

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
    S.orgId = d.user.org_id;

    localStorage.setItem('email', email);
    localStorage.setItem('userId', S.userId);
    localStorage.setItem('role', S.role);
    localStorage.setItem('orgId', S.orgId);
    sessionStorage.setItem('senha', senha);

    initSecurity(d.user, d.access_token || '', d.refresh_token || '');

    $('loginScreen').classList.add('hidden');
    $('registerScreen').classList.add('hidden');
    $('appScreen').classList.remove('hidden');

    $('accName').textContent = d.user.nome;
    $('accRole').textContent = d.user.role.toUpperCase();
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
  $('householdsView').classList.remove('hidden');
  $('mainView').classList.add('hidden');
  renderHouseholds();
}

function showMain() {
  $('householdsView').classList.add('hidden');
  $('mainView').classList.remove('hidden');
}

function renderHouseholds() {
  const list = $('hhList');
  list.innerHTML = S.households.map(hh => `
    <div class="hh-card" onclick="selectHousehold('${hh.household_id}', '${hh.nome}')">
      <div>
        <p class="hh-name">${hh.nome}</p>
        <p class="hh-meta">Clique para selecionar</p>
      </div>
      <span>→</span>
    </div>
  `).join('');
}

function selectHousehold(hhId, nome) {
  S.hhId = String(hhId);
  localStorage.setItem('hhId', S.hhId);
  $('hhBtn').textContent = nome;
  showMain();
  loadItems();
  toast(`Loja: ${nome}`, 'success');
}

// ========== ITEMS ==========
async function loadItems() {
  try {
    const d = await jsonp(`${API}?action=getItems&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    S.items = d.items || [];
    renderItems();
  } catch (err) {
    toast('Erro ao carregar itens', 'danger');
  }
}

function renderItems() {
  const content = $('content');
  if (!S.items.length) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p class="empty-text">Nenhum item ainda</p></div>';
    return;
  }

  content.innerHTML = '<ul class="items">' + S.items.map(item => `
    <li class="item ${item.status === 'sim' ? 'checked' : ''}">
      <div class="item-check" onclick="toggleItem('${item.item_id}')">
        ${item.status === 'sim' ? '✓' : ''}
      </div>
      <div class="item-info">
        <p class="item-name">${item.nome_item}</p>
        <p class="item-meta">${item.quantidade} ${item.unidade} • ${item.emoji || ''} ${item.categoria}</p>
      </div>
      <div class="item-actions">
        <button class="item-action del" onclick="deleteItem('${item.item_id}')">🗑️</button>
      </div>
    </li>
  `).join('') + '</ul>';
}

// ========== ADD ITEM ==========
function openAddItem() {
  loadCategories();
  $('addItemModal').classList.remove('hidden');
}

function closeAddItem() {
  $('addItemModal').classList.add('hidden');
  $('addItemForm').reset();
}

async function loadCategories() {
  try {
    const d = await jsonp(`${API}?action=getCategories&org_id=${encodeURIComponent(S.orgId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);
    if (d.error || !d.categories) return;
    
    const catDiv = document.createElement('div');
    catDiv.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px';
    
    const generalBtn = document.createElement('button');
    generalBtn.textContent = 'Geral';
    generalBtn.type = 'button';
    generalBtn.style.cssText = 'padding:8px 12px;border:2px solid #E7E8E6;background:white;border-radius:8px;cursor:pointer;font-size:13px';
    generalBtn.dataset.cat = '';
    generalBtn.dataset.emoji = '';
    generalBtn.onclick = () => selectCategory(generalBtn);
    catDiv.appendChild(generalBtn);
    
    d.categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.innerHTML = `${cat.emoji || ''} ${cat.nome}`;
      btn.type = 'button';
      btn.style.cssText = 'padding:8px 12px;border:2px solid #E7E8E6;background:white;border-radius:8px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:4px';
      btn.dataset.cat = cat.nome;
      btn.dataset.emoji = cat.emoji || '';
      btn.onclick = () => selectCategory(btn);
      catDiv.appendChild(btn);
    });
    
    const oldSelect = $('itemCat').parentElement;
    oldSelect.replaceChild(catDiv, $('itemCat'));
    
    // Selecionar Geral por padrão
    generalBtn.style.borderColor = '#16A34A';
    generalBtn.style.color = '#16A34A';
    generalBtn.dataset.selected = 'true';
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
  const cat = selectedBtn ? selectedBtn.dataset.cat : 'geral';

  if (!nome) {
    toast('Nome obrigatório', 'danger');
    return;
  }

  toast('Adicionando...', 'loading');

  try {
    const d = await jsonp(`${API}?action=addItem&nome_item=${encodeURIComponent(nome)}&quantidade=${qty}&unidade=${unit}&categoria=${cat}&household_id=${encodeURIComponent(S.hhId)}&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`);

    if (d.error) {
      toast(d.error, 'danger');
      return;
    }

    closeAddItem();
    loadItems();
    toast('✓ Item adicionado', 'success');
  } catch (err) {
    toast('Erro ao adicionar', 'danger');
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

// ========== MODAL CONTROLS ==========
function closeSettings() {
  $('settingsModal').classList.add('hidden');
}

$('settingsBtn').addEventListener('click', () => {
  $('settingsModal').classList.remove('hidden');
});

$('fab').addEventListener('click', openAddItem);

$('avBtn').addEventListener('click', () => {
  $('accMenu').classList.toggle('hidden');
});

// ========== INIT ==========
if (S.email && S.senha) {
  $('loginScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');
  
  jsonp(`${API}?action=login&email=${encodeURIComponent(S.email)}&senha=${encodeURIComponent(S.senha)}`).then(d => {
    if (d.error || d.needsPassword) {
      showLogin();
      return;
    }

    initSecurity(d.user, d.access_token || '', d.refresh_token || '');

    $('accName').textContent = d.user.nome;
    $('accRole').textContent = d.user.role.toUpperCase();
    $('avBtn').textContent = d.user.nome.charAt(0).toUpperCase();

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
