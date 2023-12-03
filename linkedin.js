import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ChatPromptTemplate } from "langchain/prompts";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { JsonOutputToolsParser } from "langchain/output_parsers";
import axios from 'axios';
import cheerio from 'cheerio';
import puppeteer from 'puppeteer';
import fs from 'fs';

const EMAIL_SELECTOR = '#username';
const PASSWORD_SELECTOR = '#password';
const SUBMIT_SELECTOR = '#organic-div > form > div.login__form_action_container > button';
const LINKEDIN_LOGIN_URL = 'https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin';
const EXTRACTION_TEMPLATE = `Extract and save the relevant entities mentioned \
in the following passage together with their properties.

If a property is not present and is not required in the function parameters, do not include it in the output.`;

const prompt = ChatPromptTemplate.fromMessages([
  ["system", EXTRACTION_TEMPLATE],
  ["human", "{input}"],
]);

const person = z.object({
  name: z.string().describe("The person's name"),
  description: z.string().describe("The person's job description"),
});

const model = new ChatOpenAI({
  modelName: "gpt-3.5-turbo-1106",
  temperature: 0,
}).bind({
  tools: [
    {
      type: "function",
      function: {
        name: "person",
        description: "A person",
        parameters: zodToJsonSchema(person),
      },
    },
  ],
});

const parser = new JsonOutputToolsParser();
const chain = prompt.pipe(model).pipe(parser);


// parse linkedin page
const fetchLinkedInPage = async (url) => {
    puppeteer.launch({ headless: false })
    .then(async (browser) => {
        let page = await browser.newPage()
        page.setViewport({ width: 1366, height: 768 });
        await page.goto(LINKEDIN_LOGIN_URL, { waitUntil: 'domcontentloaded' })
        await page.click(EMAIL_SELECTOR)
        await page.keyboard.type('2943..lin@gmail.com');
        await page.click(PASSWORD_SELECTOR);
        await page.keyboard.type('12345678');
        await page.click(SUBMIT_SELECTOR);
        await page.waitForNavigation();
        await page.goto(url, { waitUntil: 'domcontentloaded' })
            .then(() => {
                const content = page.content();
                content
                    .then(async (success) => {
                        const $ = cheerio.load(success)
                        fs.writeFileSync('test.txt', $('.pv-top-card').text())
                        const res = await chain.invoke({
                          input: $('.pv-top-card').text(),
                        });
                        console.log('extract from profile', res);
                    })
                    .catch((err) => {
                        console.log(err);
                    })
            })
        await page.waitForNavigation();
    })
    .catch((err) => {
        console.log(" CAUGHT WITH AN ERROR ", err);
    })
    .finally(() => {
        console.log("Done");
    })
    // console.log(profileCard.html());
  };

fetchLinkedInPage('https://www.linkedin.com/in/jessieyang15/');
