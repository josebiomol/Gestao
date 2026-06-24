/**
 * permissionMiddleware.js
 * Middleware para verificar permissões (RBAC)
 */

class PermissionMiddleware {
  constructor(permissionManager) {
    this.permissionManager = permissionManager;
  }

  /**
   * Exigir permissão específica
   */
  require(permission, onDenied = null) {
    return (callback) => {
      return (args) => {
        if (!this.permissionManager.can(permission)) {
          console.warn(`Acesso negado: permissão '${permission}' requerida`);
          
          if (onDenied) {
            onDenied({
              permission: permission,
              message: `Você não tem permissão para isso: ${permission}`
            });
          }
          
          return false;
        }
        
        return callback(args);
      };
    };
  }

  /**
   * Exigir múltiplas permissões (AND)
   */
  requireAll(permissions, onDenied = null) {
    return (callback) => {
      return (args) => {
        if (!this.permissionManager.canAll(permissions)) {
          console.warn(`Acesso negado: permissões requeridas: ${permissions.join(', ')}`);
          
          if (onDenied) {
            onDenied({
              permissions: permissions,
              message: `Você precisa de todas estas permissões: ${permissions.join(', ')}`
            });
          }
          
          return false;
        }
        
        return callback(args);
      };
    };
  }

  /**
   * Exigir qualquer uma das permissões (OR)
   */
  requireAny(permissions, onDenied = null) {
    return (callback) => {
      return (args) => {
        if (!this.permissionManager.canAny(permissions)) {
          console.warn(`Acesso negado: uma destas permissões é requerida: ${permissions.join(', ')}`);
          
          if (onDenied) {
            onDenied({
              permissions: permissions,
              message: `Você precisa de uma destas permissões: ${permissions.join(', ')}`
            });
          }
          
          return false;
        }
        
        return callback(args);
      };
    };
  }

  /**
   * Exigir acesso a módulo
   */
  requireModule(moduleName, onDenied = null) {
    return (callback) => {
      return (args) => {
        if (!this.permissionManager.hasModuleAccess(moduleName)) {
          console.warn(`Acesso negado ao módulo: ${moduleName}`);
          
          if (onDenied) {
            onDenied({
              module: moduleName,
              message: `Você não tem acesso ao módulo: ${moduleName}`
            });
          }
          
          return false;
        }
        
        return callback(args);
      };
    };
  }

  /**
   * Exigir assinatura ativa
   */
  requireSubscription(onDenied = null) {
    return (callback) => {
      return (args) => {
        if (!this.permissionManager.isSubscriptionActive()) {
          console.warn('Acesso negado: assinatura inativa ou expirada');
          
          if (onDenied) {
            onDenied({
              message: 'Sua assinatura está inativa ou expirada. Por favor, renove.'
            });
          }
          
          return false;
        }
        
        return callback(args);
      };
    };
  }

  /**
   * Wrapper para controlar acesso a elementos HTML
   */
  showIfCan(element, permission) {
    if (!element) return false;
    
    const canAccess = this.permissionManager.can(permission);
    
    if (canAccess) {
      element.style.display = '';
      return true;
    } else {
      element.style.display = 'none';
      return false;
    }
  }

  /**
   * Desabilitar elemento se sem permissão
   */
  disableIfCannot(element, permission) {
    if (!element) return false;
    
    const canAccess = this.permissionManager.can(permission);
    
    if (!canAccess) {
      element.disabled = true;
      element.title = `Você não tem permissão para isso: ${permission}`;
      element.style.opacity = '0.5';
      element.style.cursor = 'not-allowed';
      return false;
    } else {
      element.disabled = false;
      element.style.opacity = '1';
      element.style.cursor = 'pointer';
      return true;
    }
  }

  /**
   * Verificar acesso a botão/ação
   */
  isActionAllowed(action) {
    const permissionMap = {
      'add_item': 'add_item',
      'edit_item': 'toggle_item',
      'delete_item': 'delete_item',
      'add_user': 'invite_member',
      'edit_user': 'edit_member',
      'delete_user': 'delete_member',
      'manage_lojas': 'manage_lojas',
      'view_audit': 'view_audit_log'
    };

    const permission = permissionMap[action];
    if (!permission) return true; // Se não mapeado, permitir
    
    return this.permissionManager.can(permission);
  }

  /**
   * Atualizar permissionManager
   */
  setUser(user) {
    this.permissionManager.setUser(user);
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PermissionMiddleware;
}
