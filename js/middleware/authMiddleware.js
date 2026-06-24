/**
 * authMiddleware.js
 * Middleware para verificar autenticação
 */

class AuthMiddleware {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * Verificar se usuário está autenticado
   * Se não, redirecionar para login
   */
  requireAuth(callback) {
    return (args) => {
      if (!this.sessionManager.isAuthenticated()) {
        console.warn('Acesso negado: não autenticado');
        window.location.href = '/?action=login';
        return false;
      }
      return callback(args);
    };
  }

  /**
   * Verificar token de acesso válido
   */
  validateToken(token) {
    if (!token) return false;
    
    const parts = String(token).split('_');
    if (parts.length !== 2) return false;
    
    const expiryTime = parseInt(parts[1]);
    return expiryTime > Date.now();
  }

  /**
   * Validar sessão antes de requisição
   */
  async validateSession() {
    const session = this.sessionManager.getSession();
    
    if (!session) {
      return { valid: false, reason: 'Sem sessão' };
    }

    if (!this.validateToken(session.accessToken)) {
      // Token expirou, tentar refresh
      return { valid: false, reason: 'Token expirado', needsRefresh: true };
    }

    return { valid: true };
  }

  /**
   * Interceptador de requisições HTTP
   * Adiciona token ao header Authorization
   */
  attachAuthHeader(requestInit = {}) {
    const token = this.sessionManager.getAccessToken();
    
    if (!token) {
      throw new Error('Token não disponível');
    }

    return {
      ...requestInit,
      headers: {
        ...requestInit.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
  }

  /**
   * Fazer requisição autenticada
   */
  async authenticatedFetch(url, options = {}) {
    try {
      const config = this.attachAuthHeader(options);
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token inválido, fazer logout
        this.sessionManager.logout();
        window.location.href = '/?action=login';
        return null;
      }

      return response;
    } catch (error) {
      console.error('Erro em requisição autenticada:', error);
      throw error;
    }
  }

  /**
   * Wrapper para GET autenticado
   */
  async get(url) {
    return this.authenticatedFetch(url, { method: 'GET' });
  }

  /**
   * Wrapper para POST autenticado
   */
  async post(url, data) {
    return this.authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Verificar se token está próximo de expirar
   */
  isTokenExpiringSoon(minutesBefore = 5) {
    const token = this.sessionManager.getAccessToken();
    if (!token) return true;

    const parts = String(token).split('_');
    if (parts.length !== 2) return true;

    const expiryTime = parseInt(parts[1]);
    const nowPlus = Date.now() + (minutesBefore * 60 * 1000);
    
    return expiryTime < nowPlus;
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthMiddleware;
}
