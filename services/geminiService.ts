
import { GoogleGenAI } from "@google/genai";
import { GameState, Player, RoleType, Language } from "../types";
import { ROLES, TEXT } from "../constants";

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateBotChatter = async (
  gameState: GameState,
  speakingBot: Player
): Promise<string> => {
  const ai = getAI();
  if (!ai) return "...";

  const lang = gameState.language;
  const roleName = ROLES[speakingBot.role].type; // Map to string key
  const isWolf = ROLES[speakingBot.role].team === 'WEREWOLVES';

  const prompt = `
    You are playing Werewolf (Social Deduction).
    Language: ${lang === 'zh' ? 'Chinese (Simplified)' : 'English'}.
    Your Name: ${speakingBot.name}.
    Your Role: ${isWolf ? 'Werewolf (pretending to be Villager)' : 'Good Role'}.
    
    Context:
    - Round: ${gameState.round}
    - Phase: Discussion
    - Alive: ${gameState.players.filter(p => p.isAlive).length}
    
    Output:
    A single short sentence (max 15 words) for the game log.
    If Chinese, be casual.
    Do not reveal you are a wolf.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.replace(/"/g, '').trim();
  } catch (error) {
    return lang === 'zh' ? "我在思考..." : "I am thinking...";
  }
};
