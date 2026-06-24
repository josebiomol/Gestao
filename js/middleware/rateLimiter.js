/**
 * rateLimiter.js
 * Rate limiter para proteção contra brute force
 */

class RateLimiter {
  constructor(config = {}) {
    this.maxAttempts = config.maxAttempts || 5;
    this.windowMs = config.windowMs || 15 * 60 * 1000; // 15 minutos
    this.lockoutDurationMs = config.lockoutDurationMs || 30 * 60 * 1000; // 30 minutos
    this.attempts = new Map();
    this.lockouts = new Map();
  }

  /**
   * Obter chave única para rastrear tentativas
   */
  getKey(identifier, action = 'default') {
    return `${identifier}:${action}`;
  }

  /**
   * Registrar tentativa
   */
  recordAttempt(identifier, action = 'default') {
    const key = this.getKey(identifier, action);
    const now = Date.now();

    if (!this.attempts.has(key)) {
      this.attempts.set(key, []);
    }

    const attemptsList = this.attempts.get(key);
    
    // Remover tentativas antigas
    const recentAttempts = attemptsList.filter(time => now - time < this.windowMs);
    attemptsList.length = 0;
    attemptsList.push(...recentAttempts);

    // Adicionar nova tentativa
    attemptsList.push(now);

    return {
      attempts: attemptsList.length,
      maxAttempts: this.maxAttempts,
      remainingAttempts: Math.max(0, this.maxAttempts - attemptsList.length)
    };
  }

  /**
   * Verificar se está bloqueado
   */
  isBlocked(identifier, action = 'default') {
    const lockoutKey = this.getKey(identifier, action);
    
    if (!this.lockouts.has(lockoutKey)) {
      return false;
    }

    const lockoutTime = this.lockouts.get(lockoutKey);
    const now = Date.now();

    if (now > lockoutTime) {
      // Desbloqueio automático
      this.lockouts.delete(lockoutKey);
      return false;
    }

    return true;
  }

  /**
   * Obter informações de bloqueio
   */
  getLockoutInfo(identifier, action = 'default') {
    const lockoutKey = this.getKey(identifier, action);
    
    if (!this.lockouts.has(lockoutKey)) {
      return null;
    }

    const lockoutTime = this.lockouts.get(lockoutKey);
    const now = Date.now();
    const timeRemaining = Math.max(0, lockoutTime - now);

    return {
      locked: timeRemaining > 0,
      timeRemaining: timeRemaining,
      minutesRemaining: Math.ceil(timeRemaining / 60000)
    };
  }

  /**
   * Verificar limite e bloquear se necessário
   */
  check(identifier, action = 'default') {
    // Verificar se já está bloqueado
    if (this.isBlocked(identifier, action)) {
      const lockoutInfo = this.getLockoutInfo(identifier, action);
      return {
        allowed: false,
        blocked: true,
        reason: `Muitas tentativas. Tente novamente em ${lockoutInfo.minutesRemaining} minuto(s).`,
        lockoutInfo: lockoutInfo
      };
    }

    // Registrar tentativa
    const result = this.recordAttempt(identifier, action);

    // Verificar se excedeu limite
    if (result.attempts > this.maxAttempts) {
      // Bloquear
      const lockoutKey = this.getKey(identifier, action);
      this.lockouts.set(lockoutKey, Date.now() + this.lockoutDurationMs);

      return {
        allowed: false,
        blocked: true,
        reason: `Muitas tentativas. Acesso bloqueado por ${Math.ceil(this.lockoutDurationMs / 60000)} minuto(s).`,
        lockoutInfo: this.getLockoutInfo(identifier, action)
      };
    }

    // Avisar se está se aproximando do limite
    const warning = result.remainingAttempts <= 2;

    return {
      allowed: true,
      blocked: false,
      attempts: result.attempts,
      maxAttempts: result.maxAttempts,
      remainingAttempts: result.remainingAttempts,
      warning: warning,
      warningMessage: warning ? `Atenção: ${result.remainingAttempts} tentativa(s) restante(s)` : null
    };
  }

  /**
   * Resetar tentativas para um identificador
   */
  reset(identifier, action = 'default') {
    const key = this.getKey(identifier, action);
    this.attempts.delete(key);
    this.lockouts.delete(key);
  }

  /**
   * Desbloquear manual
   */
  unlock(identifier, action = 'default') {
    const lockoutKey = this.getKey(identifier, action);
    this.lockouts.delete(lockoutKey);
  }

  /**
   * Limpar todos os dados antigos
   */
  cleanup() {
    const now = Date.now();

    // Limpar tentativas antigas
    for (const [key, attempts] of this.attempts.entries()) {
      const recentAttempts = attempts.filter(time => now - time < this.windowMs);
      
      if (recentAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        attempts.length = 0;
        attempts.push(...recentAttempts);
      }
    }

    // Limpar bloqueios expirados
    for (const [key, lockoutTime] of this.lockouts.entries()) {
      if (now > lockoutTime) {
        this.lockouts.delete(key);
      }
    }
  }

  /**
   * Obter estatísticas
   */
  getStats(identifier = null) {
    if (identifier) {
      const stats = {};
      for (const [key, attempts] of this.attempts.entries()) {
        if (key.startsWith(identifier)) {
          stats[key] = {
            attempts: attempts.length,
            locked: this.isBlocked(...key.split(':'))
          };
        }
      }
      return stats;
    }

    return {
      totalTracked: this.attempts.size,
      totalLocked: this.lockouts.size
    };
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RateLimiter;
}
