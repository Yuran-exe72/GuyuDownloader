//Bibliotecas necessárias
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');



const token = '8105537723:AAHx2dnfypfyFhnYFccBkTFX2ezGmqp4N10';
const bot = new TelegramBot(token, { polling: true });

// Objeto para armazenar o link temporário de cada usuário
const estadoUsuario = {};

// Quando o bot recebe uma mensagem
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  // Verifica se a mensagem contém link do YouTube
  if (texto && (texto.includes('youtube.com') || texto.includes('youtu.be'))) {
    // Salva o link na memória temporária
    estadoUsuario[chatId] = texto;

    // Envia as opções para o usuário escolher
    const opcoes = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎞 Baixar Vídeo', callback_data: 'video' }],
          [{ text: '🎵 Baixar Áudio (MP3)', callback_data: 'audio' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Escolha o formato de download:', opcoes);
  } else {
    bot.sendMessage(chatId, '🚫 Por favor, envie um link válido do YouTube.');
  }
});

// Quando o usuário clica no botão
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const opcao = query.data;
  const link = estadoUsuario[chatId];

  if (!link) {
    bot.sendMessage(chatId, '🚫 Nenhum link encontrado. Envie um link primeiro.');
    return;
  }

  bot.sendMessage(chatId, `🔄 Iniciando download de ${opcao.toUpperCase()}...`);

  // Comando para pegar o título do vídeo do YouTube
  const getTitleCommand = `yt-dlp.exe --get-title ${link}`;

  exec(getTitleCommand, (err, stdout, stderr) => {
    if (err) {
      console.error('❌ Erro ao pegar título:', err);
      bot.sendMessage(chatId, '❌ Erro ao pegar o título do vídeo.');
      return;
    }

    // Pega o título e remove espaços extras
    let titulo = stdout.trim();

    // Sanitiza o título para remover caracteres inválidos para nomes de arquivo
    titulo = titulo.replace(/[\/\\?%*:|"<>]/g, '-');

    // Define a extensão de acordo com a opção escolhida
    const extensao = opcao === 'audio' ? 'mp3' : 'mp4';

    // Cria o nome do arquivo com o título e timestamp para evitar duplicidade
    const fileName = `${titulo}_${Date.now()}.${extensao}`;

    // Caminho absoluto do arquivo
    const filePath = path.resolve(__dirname, fileName);

    // Monta o comando yt-dlp com o nome do arquivo correto
    let comando = '';
    if (opcao === 'video') {
      comando = `yt-dlp.exe -f mp4 -o "${filePath}" ${link}`;
    } else if (opcao === 'audio') {
      comando = `yt-dlp.exe -f bestaudio -x --audio-format mp3 -o "${filePath}" ${link}`;
    }

    // Executa o download
    exec(comando, async (error, stdout2, stderr2) => {
      if (error) {
        console.error('❌ Erro ao baixar:', error);
        bot.sendMessage(chatId, `❌ Erro ao baixar: ${error.message}`);
        return;
      }

      // Verifica tamanho do arquivo
      const stats = fs.statSync(filePath);
      const maxSize = 49 * 1024 * 1024; // 49MB

      if (stats.size > maxSize) {
        bot.sendMessage(chatId, "⚠️ O arquivo é maior do que o limite permitido pelo Telegram (49MB).");
        fs.unlinkSync(filePath);
        return;
      }

      // Envia o arquivo conforme opção
      if (opcao === 'video') {
        await bot.sendVideo(chatId, filePath);
      } else if (opcao === 'audio') {
        await bot.sendAudio(chatId, filePath);
      }

      // Apaga arquivo local depois do envio
      fs.unlinkSync(filePath);
    });
  });
});
