/**
 * encryption.js
 * Utilitários de criptografia básica para frontend
 * NOTA: Para produção, usar biblioteca como TweetNaCl.js
 */

class Encryption {
  /**
   * Criptografar com Base64 (básico)
   */
  static encryptBasic(text) {
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch (e) {
      console.error('Erro ao criptografar:', e);
      return null;
    }
  }

  /**
   * Descriptografar Base64
   */
  static decryptBasic(encrypted) {
    try {
      return decodeURIComponent(escape(atob(encrypted)));
    } catch (e) {
      console.error('Erro ao descriptografar:', e);
      return null;
    }
  }

  /**
   * Criptografar senha com XOR + Base64 (adicionado)
   * NOTA: Usar HTTPS sempre! Isso é apenas obfuscar, não segurança real
   */
  static encryptPassword(password, key = 'multicasas2024') {
    try {
      let encrypted = '';
      for (let i = 0; i < password.length; i++) {
        encrypted += String.fromCharCode(
          password.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return btoa(encrypted);
    } catch (e) {
      console.error('Erro ao criptografar senha:', e);
      return null;
    }
  }

  /**
   * Descriptografar senha
   */
  static decryptPassword(encrypted, key = 'multicasas2024') {
    try {
      const decoded = atob(encrypted);
      let decrypted = '';
      for (let i = 0; i < decoded.length; i++) {
        decrypted += String.fromCharCode(
          decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return decrypted;
    } catch (e) {
      console.error('Erro ao descriptografar senha:', e);
      return null;
    }
  }

  /**
   * Gerar hash simples (MD5-like, apenas para integridade)
   * NOTA: Para autenticação real, usar bcrypt ou argon2 no backend
   */
  static simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converter para 32-bit inteiro
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Gerar token aleatório
   */
  static generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Mascarar dados sensíveis (email, etc)
   */
  static maskSensitive(text, visibleChars = 2) {
    if (!text) return '';
    if (text.length <= visibleChars) return text;
    
    const visible = text.substring(0, visibleChars);
    const masked = '*'.repeat(text.length - visibleChars);
    return visible + masked;
  }

  /**
   * Criptografar dados estruturados (objetos)
   */
  static encryptObject(obj) {
    try {
      const json = JSON.stringify(obj);
      return this.encryptBasic(json);
    } catch (e) {
      console.error('Erro ao criptografar objeto:', e);
      return null;
    }
  }

  /**
   * Descriptografar dados estruturados
   */
  static decryptObject(encrypted) {
    try {
      const json = this.decryptBasic(encrypted);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      console.error('Erro ao descriptografar objeto:', e);
      return null;
    }
  }

  /**
   * Validar força da senha
   */
  static validatePasswordStrength(password) {
    const checks = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      numbers: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;

    return {
      isValid: score >= 3,
      score: score,
      checks: checks,
      strength: score <= 1 ? 'fraca' : score <= 3 ? 'media' : 'forte'
    };
  }
}

// Exportar
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Encryption;
}
