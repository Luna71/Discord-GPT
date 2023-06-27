import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from "openai";
dotenv.config();

const ownerId = 113905448221933573;
const configuration = new Configuration({
    organization: process.env.OPENAI_ORG,
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const whiteListEnable = false;
const whiteList = ["300617495038132235", "584070402679111682"];
const blackList = ["529526805523071027, 1110090947041181697"];

const walkReplyChain = async function(message) {
    let chain = "";
    let node = message;
    while (true) {
        if (!node.reference) 
            break;
        
        const nextNode = await node.fetchReference();
        const nodeUser = nextNode.author.nickname;
        const nodeContent = nextNode.content;
        chain += `${nodeUser}: ${nodeContent} \n`;
        node = nextNode;
    }
    return chain;
}

const gptRespondToMessage = async function(message, initialPrompt) {
    const questionReference = message.reference;
    const messageSplit = message.content.substring(message.content.indexOf(" ") + 1);

    message.react("✅");

    let questionBuild = `${initialPrompt}\n`;
    const replyChain = await walkReplyChain(message);
    questionBuild += replyChain;
    questionBuild += messageSplit;
    const chatCompletion = await openai.createChatCompletion({
        model: "gpt-4",
        messages: [{role: "user", content: questionBuild}],
        max_tokens: 4000,
    });
    const finalMessage = chatCompletion.data.choices[0].message.content.replace("Luna:", "");
    if (questionReference) {
        const ref = await message.fetchReference();
        await ref.reply(finalMessage);
    } else {
        await message.reply(finalMessage);
    }
}

let killswitch = false;
const init = async function() {
    const client = new Client({ intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ] });

    client.on('ready', async () => {
      console.log(`Logged in as ${client.user.tag}`);
    });
    
    client.on('messageCreate', async (message) => {
      const owner = message.author.id == ownerId;

      if (message.author.id == client.user.id)
        return;

      if (killswitch && !owner)
        return;
        
      if (message.channelId != "993879786546003969" && !owner && !whiteList)
        return;

      if (whiteListEnable && !owner && !whiteList.includes(message.author.id))
        return;

      if (blackList.includes(message.author.id))
        return;

      try{
        const reference = message.reference && await message.fetchReference();
        if (message.content.startsWith(";luna") || message.mentions.has(client.user) || (reference && reference.author.id == client.user.id)) {
            // gptRespondToMessage(message, `The following question is in relation to the programming language Luau in the Roblox game engine.
            // If the question is asking you to provide code, please provide the least amount of context as possible, and just post your response as code.
            // The question is posted in a chat channel with multiple users, you are the user "Luna".`)
            gptRespondToMessage(message, `The following question is in relation to the programming language Luau in the Roblox game engine.
            You must not give any code examples, except for showing simple concepts, you must not post edits of other peoples code, you must instead describe the problem and tell them how to fix it themselves. You may post resources and explanations of issues and fixes.
            Do not attempt to fix code provided, only provide solutions in the form of giving them information, explanations and resources.
            The question is posted in a chat channel with multiple users, you are the user "Luna".`)      
        } 
        if (message.content.startsWith(";gpt")) {
            gptRespondToMessage(message, "");
        } 

        if (!owner)
            return;
        
        if (message.content.startsWith(";blacklist")) {
            const split = message.content.split(";blacklist ")[1];
            blackList.push(split);
        }

        if (message.content.startsWith(";whitelist")) {
            const split = message.content.split(";whitelist ")[1];
            whiteList.push(split);
        }

        if (message.content.startsWith(";off")) {
            killswitch = true;
        }
        
        if (message.content.startsWith(";on")) {
            killswitch = false;
        }
      }
      catch(err){
        console.log(err)
      }}
    )
    
    client.login(process.env.BOT_TOKEN).catch(err => console.log(`Fail to login token`));
  }
init();