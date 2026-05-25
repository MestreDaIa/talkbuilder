/**
 * Evolution API Service
 * Responsável pela comunicação com a VPS do cliente
 */

const EVO_BASE_URL = 'https://evo.zailom.com';
const EVO_GLOBAL_KEY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const evoApi = {
  async fetchInstances() {
    const response = await fetch(`${EVO_BASE_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    if (!response.ok) return [];
    return response.json();
  },

  /**
   * Cria uma nova instância na Evolution API
   */
  async createInstance(instanceName: string) {
    try {
      // Primeiro tenta verificar se já existe
      const checkResponse = await fetch(`${EVO_BASE_URL}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: { 'apikey': EVO_GLOBAL_KEY }
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        // Se a instância já existe, retornamos os dados dela
        return {
          instance: {
            instanceName,
            status: checkData.instance?.state || 'disconnected',
            apikey: EVO_GLOBAL_KEY
          },
          alreadyExists: true
        };
      }

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
        console.error('Erro Evolution API (Create):', data);
        // Se retornar que já existe por erro 403/400, tentamos retornar sucesso simulado
        if (response.status === 403 || response.status === 400 || data.message?.includes('exists')) {
           return {
            instance: { instanceName, apikey: EVO_GLOBAL_KEY },
            alreadyExists: true
           };
        }
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
  },

  /**
   * Configura webhook da instância para receber mensagens recebidas
   */
  async setWebhook(instanceName: string, webhookUrl: string) {
    const response = await fetch(`${EVO_BASE_URL}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY,
      },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Erro ao configurar webhook');
    }
    return response.json();
  },

  async getWebhook(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/webhook/find/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    if (!response.ok) return null;
    return response.json();
  },

  async sendText(instanceName: string, number: string, text: string) {
    const response = await fetch(`${EVO_BASE_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY,
      },
      body: JSON.stringify({ number, text }),
    });
    return response.ok;
  },
};
