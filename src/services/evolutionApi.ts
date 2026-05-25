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
    try {
      const response = await fetch(`${EVO_BASE_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVO_GLOBAL_KEY
        },
        body: JSON.stringify({
          instanceName,
          token: '', 
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Erro Evolution API:', data);
        throw new Error(data.message || data.error || 'Erro ao criar instância');
      }
      
      return data;
    } catch (error) {
      console.error('Erro na requisição createInstance:', error);
      throw error;
    }
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
