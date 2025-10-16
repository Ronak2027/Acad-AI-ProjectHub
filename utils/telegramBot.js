const TelegramBot = require('node-telegram-bot-api');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// A basic model for general conversations
const chatModel = genAI.getGenerativeModel({ model: "gemini-pro" });

const setupTelegramBot = () => {
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Welcome to Acad AI ProjectHub Bot! How can I help you today?');
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id, `Here are the commands you can use:
/start - Start the bot
/help - Get help
(More commands to be added later for tasks, projects, etc.)`);
  });

  // Enhanced handler for 'pending tasks'
  bot.onText(/pending tasks/, async (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Please wait while I fetch your pending tasks...');

    // IMPORTANT: In a real application, you would link the Telegram user ID (msg.from.id) to your
    // application's User ID to fetch personalized data. For this example, we'll just get a generic set of tasks.
    try {
      // This is a placeholder for fetching tasks from your backend.
      // In a real scenario, you'd make an authenticated API call here.
      const mockTasks = [
        { name: "Complete frontend login page", status: "in-progress", dueDate: "2025-10-10" },
        { name: "Setup MongoDB connection", status: "completed", dueDate: "2025-09-15" },
        { name: "Implement AI task planning endpoint", status: "in-progress", dueDate: "2025-09-25" },
        { name: "Write documentation for API", status: "pending", dueDate: "2025-10-01" },
      ];

      const prompt = `Given the following tasks: ${JSON.stringify(mockTasks)}. Provide a concise summary of the user's pending and in-progress tasks, highlighting due dates. Respond in a friendly tone.`;

      const result = await chatModel.generateContent(prompt);
      const response = await result.response;
      const aiSummary = response.text().trim();

      bot.sendMessage(chatId, aiSummary);

    } catch (error) {
      console.error('Error fetching or summarizing tasks for Telegram bot:', error);
      bot.sendMessage(chatId, 'Sorry, I couldn\'t fetch tasks at this moment. Please try again later or check the web platform.');
    }
  });

  // Placeholder for 'submit task'
  bot.onText(/submit task/, (msg) => {
    bot.sendMessage(msg.chat.id, 'To submit a task, please use the web platform for file uploads. (This feature is under development)');
  });

  // General AI response for other messages
  bot.on('message', async (msg) => {
    if (msg.text && !msg.text.startsWith('/') && !msg.text.match(/pending tasks/i) && !msg.text.match(/submit task/i)) {
      const chatId = msg.chat.id;
      try {
        const prompt = `You are a helpful project management assistant. User query: "${msg.text}". Provide a concise and relevant answer.`;
        const result = await chatModel.generateContent(prompt);
        const response = await result.response;
        const aiResponse = response.text().trim();
        bot.sendMessage(chatId, aiResponse);
      } catch (error) {
        console.error('Error generating AI response for general message:', error);
        bot.sendMessage(chatId, 'Sorry, I couldn\'t process your request. Please try again later.');
      }
    }
  });

  console.log('Telegram Bot started with AI capabilities...');
};

module.exports = setupTelegramBot;
