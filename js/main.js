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
  permissions: [],
  statusFilter: 'todos',
  groupByCategory: false
};

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
  const btn = document.getElementById('themeBtn');
  if (btn) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark ? '☀️' : '🌙';
  }
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
  
  if (!S.households || S.households.length === 0) {
    console.log('Nenhuma loja disponível');
    list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-secondary)">Nenhuma loja disponível</p>';
    return;
  }
  
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
  localStorage.setItem('householdName', nome); // Guardar nome da loja
  
  // Atualizar título do app com nome da loja
  $('appTitle').textContent = nome;
  
  // Limpar items antigos ANTES de carregar
  S.items = [];
  
  showMain();
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

  if (!filteredItems.length) {
    content.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><p class="empty-text">Nenhum item nessa categoria</p></div>';
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

$('avBtn').addEventListener('click', () => {
  $('accMenu').classList.toggle('hidden');
});

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
function openSettings() {
  $('settingsModal').classList.remove('hidden');
  switchSettingsTab('usuarios');
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
  renderAccessibleHouseholds();
  renderAccessScheduleTable();
  loadGroupsForSelect();
}

function closeNewUserModal() {
  $('newUserModal').classList.add('hidden');
  document.getElementById('newUserForm').reset();
}

function loadGroupsForSelect() {
  // Carregar grupos para dropdown
  // TODO: implementar depois
}

function renderAccessibleHouseholds() {
  const container = $('accessibleHouseholdsList');
  container.innerHTML = '';
  
  if (!S.households || S.households.length === 0) return;
  
  S.households.forEach((hh, idx) => {
    const isFirst = idx === 0;
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--border);border-radius:6px;cursor:pointer';
    label.innerHTML = `
      <input type="checkbox" name="accessible_hh" value="${hh.household_id}" ${isFirst ? 'checked' : ''} data-primary="${isFirst}">
      <span style="font-size:13px">${hh.nome}${isFirst ? ' (principal)' : ''}</span>
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
      <label style="margin:0;padding:0">
        <input type="checkbox" class="schedule-checkbox" data-dia="${dia}" ${dia !== 'Domingo' && dia !== 'Sábado' ? 'checked' : ''}>
      </label>
      <span style="font-size:13px;font-weight:600;min-width:70px">${dia}</span>
      <input type="time" class="schedule-time" data-dia="${dia}" data-type="start" value="08:00" disabled style="font-size:12px">
      <input type="time" class="schedule-time" data-dia="${dia}" data-type="end" value="18:00" disabled style="font-size:12px">
    `;
    
    const checkbox = row.querySelector('.schedule-checkbox');
    const times = row.querySelectorAll('.schedule-time');
    
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
  
  if (!nome || !novoEmail || !novaSenha) {
    toast('Preencha todos os campos', 'warning');
    return;
  }
  
  if (novaSenha.length < 6) {
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
  
  toast('Convidando membro...', 'loading');
  
  try {
    // Usar nomes diferentes para não confundir
    const url = `${API}?action=addUser&nome=${encodeURIComponent(nome)}&email=${encodeURIComponent(novoEmail)}&senha=${encodeURIComponent(novaSenha)}&group_id=${encodeURIComponent(group_id)}&permissions=${encodeURIComponent(permissions.join(','))}&accessible_households=${encodeURIComponent(accessible_hh.join(','))}&access_schedule=${encodeURIComponent(JSON.stringify(access_schedule))}&household_id=${encodeURIComponent(S.hhId)}`;
    
    console.log('Chamando API com dados do novo usuário:');
    console.log('Nome:', nome);
    console.log('Email novo:', novoEmail);
    console.log('Auth user:', S.email);
    
    // Passar email e senha de autenticação no jsonp
    const fullUrl = `${url}&email_auth=${encodeURIComponent(S.email)}&senha_auth=${encodeURIComponent(S.senha)}`;
    
    const d = await jsonp(fullUrl);
    
    console.log('Resposta do addUser:', d);
    
    if (d.error) {
      toast(d.error, 'danger');
      return;
    }
    
    if (d.success) {
      toast('✓ Membro convidado com sucesso', 'success');
      closeNewUserModal();
      loadUsersList();
    }
  } catch (err) {
    console.error('Erro ao chamar API:', err);
    toast('Erro ao convidar membro', 'danger');
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
          <div class="user-card-role">${user.role || 'Membro'}</div>
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

function editUser(userId) {
  toast('Edição em desenvolvimento', 'info');
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
  toast('Grupos em desenvolvimento', 'info');
}

function openNewGroupModal() {
  toast('Criar grupos em desenvolvimento', 'info');
}

function loadCategoriesList() {
  toast('Categorias em desenvolvimento', 'info');
}

function openNewCategoryModal() {
  toast('Criar categorias em desenvolvimento', 'info');
}

// ========== EVENTOS ==========
$('settingsBtn').addEventListener('click', openSettings);

initBulkEditUI();
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
