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
const whiteList = ["300617495038132235", "584070402679111682", "246296808601419776"];
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

const gptRespondToMessage = async function(client, message, initialPrompt) {
    const questionReference = message.reference;
    const messageSplit = message.content.substring(message.content.indexOf(" ") + 1);

    const reaction = await message.react("<:loading:1123229018116853791>");

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

    const bufferLength = 1900
    let bufferLocation = bufferLength;
    let messageBuffer = finalMessage.substring(0, bufferLocation);
    while (messageBuffer.length > 0) {
    if (questionReference) {
	const ref = await message.fetchReference();
	await ref.reply(messageBuffer);
    } else {
	await message.reply(messageBuffer);
    }
        const oldLocation = bufferLocation;
	bufferLocation += 1900;
	messageBuffer = finalMessage.substring(oldLocation, bufferLocation);	
    }
    await reaction.users.remove(client.user);
    await message.react("<:check:1095091343551909950>");
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

      if (whiteListEnable && !owner && !whiteList.includes(message.author.id))
        return;

      if (blackList.includes(message.author.id))
        return;

      try{
        const reference = message.reference && await message.fetchReference();
        if (message.content.startsWith(";gpt") && (owner || whiteList.includes(message.author.id))) {
            gptRespondToMessage(client, message, "");
        } 
        else if (message.content.startsWith(";luna") || message.mentions.has(client.user) || (reference && reference.author.id == client.user.id)) {
const prompt1 = `The following question is in relation to the programming language Luau in the Roblox game engine. 
When people ask you to fix code, you should not fix their code for them, when you want to write code to show how to fix an issue, instead write example code showing the issue which does not use their variable names, and write the least amount of code possible to showcase the fix.
Provide resources to accompany explanations where possible
The question is posted in a chat channel with multiple users, you are the user "Luna".`
	    const prompt2 = `The following question is in relation to the programming language Luau in the Roblox game engine. 
When people ask you to fix code, you should not fix their code for them, when you want to write code to show how to fix an issue, instead write example code showing the issue which does not use their variable names, and write the least amount of code possible to showcase the fix.
When people ask you to make something, or how to make something, split the problem up into different concepts, and provide explanations for how to solve each part of the problem, rather than a full solution.
Provide resources to accompany explanations where possible
The question is posted in a chat channel with multiple users, you are the user "Luna".`;
            gptRespondToMessage(client, message, prompt2)      
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
