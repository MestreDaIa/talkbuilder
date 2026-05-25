/**
 * Evolution API Service
 * Responsável pela comunicação com a VPS do cliente
 */

const EVO_BASE_URL = 'https://evo.zailom.com';
const EVO_GLOBAL_KEY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const evoApi = {
  /**
   * Cria uma nova instância na Evolution API
   */
  async createInstance(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY
      },
      body: JSON.stringify({
        instanceName,
        token: '', // Deixa vazio para gerar automaticamente ou defina um
        qrcode: true,
        number: '',
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao criar instância');
    }
    
    return response.json();
  },

  /**
   * Obtém o QR Code de uma instância
   */
  async getQrCode(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVO_GLOBAL_KEY
      }
    });
    
    if (!response.ok) return null;
    return response.json();
  },

  /**
   * Verifica o status da instância
   */
  async getInstanceStatus(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': EVO_GLOBAL_KEY
      }
    });
    
    if (!response.ok) return null;
    return response.json();
  },

  /**
   * Remove uma instância
   */
  async logoutInstance(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': EVO_GLOBAL_KEY
      }
    });
    
    return response.ok;
  },

  async deleteInstance(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': EVO_GLOBAL_KEY
      }
    });
    
    return response.ok;
  }
};
