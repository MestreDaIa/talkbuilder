/**
 * Evolution API Service
 * Responsável pela comunicação com a VPS do cliente
 */

const EVO_BASE_URL = 'https://evo.zailom.com';
const EVO_GLOBAL_KEY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export const evoApi = {
  /**
   * Lista todas as instâncias existentes na Evolution API
   */
  async fetchInstances() {
    const response = await fetch(`${EVO_BASE_URL}/instance/fetchInstances`, {
      method: 'GET',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    if (!response.ok) return [];
    return response.json();
  },

  /**
   * Configura webhook da instância
   */
  async setWebhook(instanceName: string, webhookData: {
    enabled: boolean;
    url: string;
    byEvents: boolean;
    base64: boolean;
    events: string[];
  }) {
    const response = await fetch(`${EVO_BASE_URL}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY,
      },
      body: JSON.stringify({
        webhook: webhookData
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Erro ao configurar webhook');
    }
    return response.json();
  },

  /**
   * Atualiza as configurações da instância
   */
  async setSettings(instanceName: string, settings: {
    reject_call?: boolean;
    msg_call?: string;
    groups_ignore?: boolean;
    always_online?: boolean;
    read_messages?: boolean;
    sync_full_history?: boolean;
    read_status?: boolean;
  }) {
    const response = await fetch(`${EVO_BASE_URL}/settings/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY,
      },
      body: JSON.stringify({
        rejectCall: !!settings.reject_call,
        msgCall: settings.msg_call || "",
        groupsIgnore: !!settings.groups_ignore,
        alwaysOnline: !!settings.always_online,
        readMessages: !!settings.read_messages,
        readStatus: !!settings.read_status,
        syncFullHistory: !!settings.sync_full_history,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || data.error || 'Erro ao atualizar configurações');
    }
    return response.json();
  },

  /**
   * Busca as configurações específicas de uma instância
   */
  async fetchSettings(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/settings/find/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    if (!response.ok) return null;
    return response.json();
  },

  /**
   * Busca as configurações de webhook de uma instância
   */
  async fetchWebhook(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/webhook/find/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    if (!response.ok) return null;
    return response.json();
  },

  /**
   * Busca as configurações atuais da instância
   */
  async fetchInstance(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/instance/fetchInstances?instanceName=${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    if (!response.ok) return null;
    const instances = await response.json();
    return Array.isArray(instances) ? instances.find((i: any) => i.instanceName === instanceName) : instances;
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
   * Envia mensagem de texto
   */
  async sendText(instanceName: string, number: string, text: string) {
    const response = await fetch(`${EVO_BASE_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY
      },
      body: JSON.stringify({
        number,
        text,
        linkPreview: false
      })
    });
    return response.json();
  },

  /**
   * Envia mensagem com botões
   */
  async sendButtons(instanceName: string, number: string, text: string, buttons: any[]) {
    const response = await fetch(`${EVO_BASE_URL}/message/sendButtons/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY
      },
      body: JSON.stringify({
        number,
        title: "Opções",
        description: text,
        footer: "Bot",
        buttons: buttons.map(b => ({
          buttonId: b.id,
          buttonText: { displayText: b.label },
          type: 1
        }))
      })
    });
    return response.json();
  },

  /**
   * Evolution Bot Settings
   */
  async fetchEvolutionBot(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/evolutionBot/find/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    if (!response.ok) return null;
    return response.json();
  },

  async setEvolutionBot(instanceName: string, data: any) {
    // Normalize ignoreJids to array (Evolution API expects array)
    const ignoreJidsArr = Array.isArray(data.ignoreJids)
      ? data.ignoreJids
      : typeof data.ignoreJids === 'string' && data.ignoreJids.trim()
        ? data.ignoreJids.split(',').map((s: string) => s.trim()).filter(Boolean)
        : [];

    const payload: any = {
      enabled: !!data.enabled,
      description: data.description || 'Evolution Bot',
      apiUrl: data.apiUrl || '',
      apiKey: data.apiKey || '',
      triggerType: data.triggerType || 'keyword',
      triggerOperator: data.triggerOperator || 'contains',
      triggerValue: data.triggerValue ?? data.triggerKeyword ?? '',
      expire: Number(data.expire) || 0,
      keywordFinish: data.keywordFinish || '',
      delayMessage: Number(data.delayMessage) || 0,
      unknownMessage: data.unknownMessage || '',
      listeningFromMe: !!data.listeningFromMe,
      stopBotFromMe: !!data.stopBotFromMe,
      keepOpen: !!data.keepOpen,
      debounceTime: Number(data.debounceTime) || 0,
      splitMessages: !!data.splitMessages,
      timePerChar: Number(data.timePerChar) || 0,
      ignoreJids: ignoreJidsArr,
    };

    // Evolution API expects lowercase enum values for triggerType/triggerOperator
    payload.triggerType = String(payload.triggerType).toLowerCase();
    payload.triggerOperator = String(payload.triggerOperator).toLowerCase();

    // Required: when triggerType is 'all', triggerOperator/triggerValue shouldn't be required
    if (payload.triggerType === 'all' || payload.triggerType === 'none') {
      delete payload.triggerOperator;
      delete payload.triggerValue;
    }

    const response = await fetch(`${EVO_BASE_URL}/evolutionBot/create/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVO_GLOBAL_KEY,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Evolution Bot error:', errorData);
      const msg = errorData?.response?.message || errorData?.message || errorData?.error;
      const msgStr = Array.isArray(msg) ? msg.join(', ') : (typeof msg === 'string' ? msg : JSON.stringify(errorData));
      throw new Error(msgStr || 'Erro ao salvar Evolution Bot');
    }
    return response.json();
  },

  async deleteEvolutionBot(instanceName: string) {
    const response = await fetch(`${EVO_BASE_URL}/evolutionBot/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': EVO_GLOBAL_KEY },
    });
    return response.ok;
  }
};
