/**
 * permissions.js
 * Controle de acesso baseado em papéis (RBAC)
 */

class PermissionManager {
  constructor(user = null) {
    this.user = user;
    this.permissions = this.loadPermissions(user);
  }

  /**
   * Carregar permissões do usuário
   */
  loadPermissions(user) {
    if (!user) return {};

    const defaultPermissions = {
      owner: [
        'add_item', 'toggle_item', 'delete_item',
        'invite_member', 'edit_member', 'delete_member',
        'view_all_lojas', 'manage_lojas', 'view_members',
        'manage_subscription', 'view_audit_log'
      ],
      admin: [
        'add_item', 'toggle_item', 'delete_item',
        'invite_member', 'edit_member', 'delete_member',
        'view_all_lojas', 'view_members'
      ],
      gerente: [
        'add_item', 'toggle_item', 'delete_item',
        'invite_member', 'view_members'
      ],
      membro: [
        'add_item', 'toggle_item'
      ]
    };

    const role = user.role || 'membro';
    let perms = defaultPermissions[role] || defaultPermissions.membro;

    // Sobrescrever com permissões customizadas se existirem
    if (user.permissions && typeof user.permissions === 'string') {
      const customPerms = user.permissions.split(',').map(p => p.trim()).filter(Boolean);
      if (customPerms.length > 0) {
        perms = customPerms;
      }
    }

    return perms;
  }

  /**
   * Verificar se usuário tem permissão
   */
  can(permission) {
    if (!this.user) return false;
    if (this.user.role === 'owner') return true;
    return this.permissions.includes(permission);
  }

  /**
   * Verificar se usuário tem acesso ao módulo
   */
  hasModuleAccess(moduleName) {
    if (!this.user) return false;
    
    const modules = this.user.accessible_modules || [];
    if (!Array.isArray(modules)) return false;

    const module = modules.find(m => m.name === moduleName);
    if (!module) return false;

    // Verificar se está ativo
    if (module.status !== 'active') return false;

    // Verificar expiração
    if (module.expiry_date) {
      const expiry = new Date(module.expiry_date);
      if (expiry < new Date()) return false;
    }

    return true;
  }

  /**
   * Verificar se assinatura está ativa
   */
  isSubscriptionActive() {
    if (!this.user) return false;
    
    const status = this.user.subscription_status || 'active';
    if (status !== 'active') return false;

    // Verificar expiração
    if (this.user.subscription_expiry) {
      const expiry = new Date(this.user.subscription_expiry);
      if (expiry < new Date()) return false;
    }

    return true;
  }

  /**
   * Obter módulos acessíveis
   */
  getAccessibleModules() {
    if (!this.user || !this.user.accessible_modules) return [];
    
    const modules = Array.isArray(this.user.accessible_modules) 
      ? this.user.accessible_modules 
      : [];

    return modules.filter(m => 
      m.status === 'active' && 
      (!m.expiry_date || new Date(m.expiry_date) > new Date())
    );
  }

  /**
   * Obter lista completa de permissões
   */
  getPermissions() {
    return this.permissions;
  }

  /**
   * Atualizar usuário
   */
  setUser(user) {
    this.user = user;
    this.permissions = this.loadPermissions(user);
  }

  /**
   * Verificar múltiplas permissões (AND)
   */
  canAll(permissionArray) {
    return permissionArray.every(perm => this.can(perm));
  }

  /**
   * Verificar se tem qualquer permissão (OR)
   */
  canAny(permissionArray) {
    return permissionArray.some(perm => this.can(perm));
  }

  /**
   * Limpar
   */
  clear() {
    this.user = null;
    this.permissions = {};
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PermissionManager;
}
