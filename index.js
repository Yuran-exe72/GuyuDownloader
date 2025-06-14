// Bibliotecas necessárias
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;


const token = '8105537723:AAHx2dnfypfyFhnYFccBkTFX2ezGmqp4N10';
const bot = new TelegramBot(token, { polling: true });

// Quando o bot recebe uma mensagem
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const texto = msg.text;

  // Verifica se a mensagem contém link do YouTube
  if (texto && (texto.includes('youtube.com') || texto.includes('youtu.be'))) {
    const opcoes = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎞 Baixar Vídeo', callback_data: `video|${texto}` }],
          [{ text: '🎵 Baixar Áudio (MP3)', callback_data: `audio|${texto}` }]
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
  const [opcao, link] = query.data.split('|');

  if (!link) {
    bot.sendMessage(chatId, '🚫 Nenhum link encontrado. Envie um link primeiro.');
    return;
  }

  // Desabilitar os botões
  const loadingMessage = await bot.sendMessage(chatId, `🔄 Iniciando download de ${opcao.toUpperCase()}...`);

  try {
    const ytDlpWrap = new YTDlpWrap();
    const extensao = opcao === 'audio' ? 'mp3' : 'mp4';
    const fileName = `download_${Date.now()}.${extensao}`;
    const filePath = path.resolve(__dirname, fileName);

    const args = [
      link,
      '-o', filePath
    ];

    if (opcao === 'audio') {
      args.push('-f', 'bestaudio');
      args.push('--extract-audio');
      args.push('--audio-format', 'mp3');
    } else {
      args.push('-f', 'bestvideo+bestaudio');
      args.push('--merge-output-format', 'mp4');
    }

    await ytDlpWrap.exec(args);

    const stats = fs.statSync(filePath);
    const maxSize = 49 * 1024 * 1024; // 49MB

    if (stats.size > maxSize) {
      bot.sendMessage(chatId, "⚠️ O arquivo é maior do que o limite permitido pelo Telegram (49MB).");
      fs.unlinkSync(filePath);
      return;
    }

    if (opcao === 'video') {
      await bot.sendVideo(chatId, filePath);
    } else {
      await bot.sendAudio(chatId, filePath);
    }

    fs.unlinkSync(filePath);
    await bot.deleteMessage(chatId, loadingMessage.message_id); // Remove a mensagem de carregamento

  } catch (error) {
    console.error("Erro ao baixar:", error);
    bot.sendMessage(chatId, "❌ Ocorreu um erro ao processar o download.");
    await bot.deleteMessage(chatId, loadingMessage.message_id); // Remove a mensagem de carregamento
  }
});
