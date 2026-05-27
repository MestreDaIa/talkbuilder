import dotenv from "dotenv";

dotenv.config();

const EVO_BASE_URL: string = process.env.EVO_BASE_URL || 'https://evo.zailom.com';
const EVO_GLOBAL_KEY: string = process.env.EVO_GLOBAL_KEY || '';

export const evolutionApi = {
  async sendText(instanceName: string, number: string, text: string) {
    console.log(`Enviando mensagem de texto para ${number} na instância ${instanceName}`);
    try {
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
      const data: any = await response.json();
      console.log("Resposta Evolution (sendText):", JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("Erro ao enviar texto via Evolution:", error);
      return { error };
    }
  },

  async sendButtons(instanceName: string, number: string, text: string, buttons: any[]) {
    console.log(`Enviando botões para ${number} na instância ${instanceName}`);
    try {
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
          buttons: buttons.map((b: any) => ({
            buttonId: b.id,
            buttonText: { displayText: b.label },
            type: 1
          }))
        })
      });
      const data: any = await response.json();
      console.log("Resposta Evolution (sendButtons):", JSON.stringify(data));
      return data;
    } catch (error) {
      console.error("Erro ao enviar botões via Evolution:", error);
      return { error };
    }
  }
};
