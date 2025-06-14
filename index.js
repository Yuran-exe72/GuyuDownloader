  const loadingMessage = await bot.sendMessage(chatId, `🔄 Iniciando download de ${opcao.toUpperCase()}...`);

  try {
    const ytDlpWrap = new YTDlpWrap();  // NÃO precisa informar o binário local
    const extensao = opcao === 'audio' ? 'mp3' : 'mp4';
    const fileName = `download_${Date.now()}.${extensao}`;
    const filePath = path.resolve(__dirname, fileName);

    console.log("📁 Caminho do arquivo:", filePath);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🧹 Arquivo antigo removido");
    }

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
    await ytDlpWrap.exec(args);

    if (!fs.existsSync(filePath)) {
      throw new Error("❌ O arquivo não foi baixado corretamente.");
    }

    const stats = fs.statSync(filePath);
    const maxSize = 49 * 1024 * 1024;

    if (stats.size > maxSize) {
      bot.sendMessage(chatId, "⚠️ O arquivo é maior do que o limite permitido pelo Telegram (49MB).");
      fs.unlinkSync(filePath);
      await bot.deleteMessage(chatId, loadingMessage.message_id);
      return;
    }

    if (opcao === 'video') {
      await bot.sendVideo(chatId, filePath);
    } else {
      await bot.sendAudio(chatId, filePath);
    }

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
