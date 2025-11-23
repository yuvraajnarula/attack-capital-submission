import { GoogleGenerativeAI } from "@google/generative-ai";
import {config} from "dotenv";

config();
const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function test() {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const result = await model.generateContent("Hello world");
  console.log(result.response.text());
}

test();
