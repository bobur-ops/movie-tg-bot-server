const { PrismaClient } = require("@prisma/client");
const TelegramBot = require("node-telegram-bot-api");
const cors = require("cors");
require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const token = process.env["BOT_TOKEN"];
const prisma = new PrismaClient();
const webAppUrl = "https://incredible-lokum-b232b3.netlify.app/";

const bot = new TelegramBot(token, { polling: true });
const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(cors());

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "/start") {
    try {
      const alreadyExist = await prisma.user.findUnique({
        where: {
          chatId: chatId.toString(),
        },
      });

      if (!alreadyExist) {
        await prisma.user.create({
          data: {
            chatId: JSON.stringify(chatId),
            username: msg.chat.username,
          },
        });
      }

      const message = `
<b>Choose the command</b>
/my_tickets - See your  tickets

<b>Click on the button below to open the page and reserve ticket</b>
      `;

      await bot.sendMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Choose a movie", web_app: { url: webAppUrl } }],
          ],
        },
      });
    } catch (error) {
      console.log(error.message);
      await bot.sendMessage(chatId, "Something went wrong");
    }
  }

  if (text === "/my_tickets") {
    try {
      const user = await prisma.user.findUnique({
        where: {
          chatId: chatId.toString(),
        },
        include: {
          tickets: {
            select: {},
          },
        },
      });
    } catch (error) {}
  }
});

app.get("/", async (req, res) => {
  console.log("Works great");
  return res.status(200).json({ message: "Success" });
});

app.post("/book", async (req, res) => {
  const { username, date, time, img, queryId, title } = req.body;

  try {
    const user = await prisma.user.findFirst({
      where: {
        username: username,
      },
    });

    console.log(user);

    if (!user) {
      await bot.answerWebAppQuery(queryId, {
        type: "article",
        id: queryId,
        input_message_content: {
          message_text: "Something went wrong, please try to restart the bot",
        },
      });
    }

    const ticket = await prisma.ticket.create({
      data: {
        date: date,
        time: time,
        img: img,
        title: title,
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });

    const caption = `
<b>Your movie:</b>
Movie: ${title}
Date: ${date}
Time: ${time}

You can pay for ticket right here, by clicking button PAY, or you can pay on person when you come

<b>Enjoy your time!</b>
    `;

    const fileOpts = {
      filename: "image",
      contentType: "image/jpg",
      caption: caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Cancel", web_app: { url: webAppUrl } }],
          [{ text: "Pay", web_app: { url: webAppUrl } }],
        ],
      },
    };

    await bot.sendPhoto(
      user.chatId,
      Buffer.from(img.substr(22), "base64"),
      fileOpts
    );

    // bot.sendMessage(user.chatId, caption, { parse_mode: "HTML" });

    return res.status(200).json({ message: "Successfull" });
  } catch (error) {
    console.log(error.message);
    await bot.answerWebAppQuery(queryId, {
      type: "article",
      id: queryId,
      title: "Fail",
      input_message_content: {
        message_text: "Something went wrong, please try to restart the bot",
      },
    });
    return res.status(500).json({ message: "Fail" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log("server started on PORT" + PORT));
