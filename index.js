// Bibliotecas necessárias
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;

// Token do bot
const token = '8105537723:AAHx2dnfypfyFhnYFccBkTFX2ezGmqp4N10';
const bot = new TelegramBot(token, { polling: true });

console.log("✅ Bot iniciado. Aguardando mensagens...");

bot.on('polling_error', (error) => {
  console.error("❌ Erro no polling:", error.message);
});

// Tratamento das mensagens recebidas
bot.on('message', async (msg) => {
  if (msg.from.is_bot) return; // Ignorar mensagens do próprio bot

  const chatId = msg.chat.id;
  const texto = msg.text;

  console.log(`📩 Mensagem recebida no chat ${chatId}:`, texto);

  if (!texto) {
    bot.sendMessage(chatId, '🚫 Envie um link válido do YouTube.');
    return;
  }

  // Verifica se é um link do YouTube
  if (texto.includes('youtube.com') || texto.includes('youtu.be')) {
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

// Tratamento dos cliques nos botões inline
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const [opcao, link] = query.data.split('|');

  console.log(`🔘 Botão clicado: ${opcao} - Link: ${link}`);

  if (!link) {
    bot.sendMessage(chatId, '🚫 Nenhum link encontrado. Envie um link primeiro.');
    return;
  }

  const loadingMessage = await bot.sendMessage(chatId, `🔄 Iniciando download de ${opcao.toUpperCase()}...`);

  try {
    const ytDlpPath = path.resolve(__dirname, 'yt-dlp'); // Caminho local do binário

    // Teste se o binário existe
    if (!fs.existsSync(ytDlpPath)) {
      throw new Error(`❌ Binário yt-dlp não encontrado em: ${ytDlpPath}`);
    }

    const ytDlpWrap = new YTDlpWrap(ytDlpPath); // Use o caminho local
    const extensao = opcao === 'audio' ? 'mp3' : 'mp4';
    const fileName = `download_${Date.now()}.${extensao}`;
    const filePath = path.resolve(__dirname, fileName);

    console.log("📁 Caminho do arquivo:", filePath);

    // Remove arquivo temporário antigo, se existir
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🧹 Arquivo antigo removido");
    }

    // Argumentos para o yt-dlp
    let args = [
      link,
      '-o', filePath
    ];

    if (opcao === 'audio') {
      args = args.concat([
        '-f', 'bestaudio',
        '--extract-audio',
        '--audio-format', 'mp3'
      ]);
    } else {
      args = args.concat([
        '-f', 'bestvideo+bestaudio',
        '--merge-output-format', 'mp4'
      ]);
    }

    console.log("⚙️ Executando comando:", ['yt-dlp', ...args].join(' '));

    // Executar o download
    await ytDlpWrap.exec(args);

    // Verificar se o arquivo foi criado
    if (!fs.existsSync(filePath)) {
      throw new Error("❌ O arquivo não foi baixado corretamente.");
    }

    // Verificar tamanho do arquivo (limite do Telegram é 49MB)
    const stats = fs.statSync(filePath);
    const maxSize = 49 * 1024 * 1024; // 49 MB

    if (stats.size > maxSize) {
      bot.sendMessage(chatId, "⚠️ O arquivo é maior do que o limite permitido pelo Telegram (49MB).");
      fs.unlinkSync(filePath);
      await bot.deleteMessage(chatId, loadingMessage.message_id);
      return;
    }

    // Enviar o arquivo para o usuário
    console.log(`📤 Enviando ${opcao} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    if (opcao === 'video') {
      await bot.sendVideo(chatId, filePath);
    } else {
      await bot.sendAudio(chatId, filePath);
    }

    // Limpeza final
    fs.unlinkSync(filePath);
    console.log("🧹 Arquivo temporário excluído");

    await bot.deleteMessage(chatId, loadingMessage.message_id);

  } catch (error) {
    console.error("💥 Erro no processo de download:", error.message || error);
    bot.sendMessage(chatId, "❌ Ocorreu um erro ao processar o download.");
    try {
      await bot.deleteMessage(chatId, loadingMessage.message_id);
    } catch (e) {
      console.warn("⚠️ Não foi possível deletar a mensagem de carregamento:", e.message);
    }
  }
});