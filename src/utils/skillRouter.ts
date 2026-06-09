import type { Skill, SkillRouterResult } from '../types';
import { loadAIProviderConfig } from './settings';

export async function classifyIntent(message: string, skills: Skill[]): Promise<SkillRouterResult> {
  if (skills.length === 0) {
    return { skillId: null, confidence: 'low' };
  }

  const aiConfig = loadAIProviderConfig();
  if (aiConfig.provider !== 'lmstudio' || !aiConfig.lmStudio.modelName) {
    return { skillId: null, confidence: 'low' };
  }

  const skillsList = skills
    .filter((s) => s.status === 'active')
    .map((s) => `- id: ${s.id}\n  name: ${s.name}\n  description: ${s.description}`)
    .join('\n');

  const systemPrompt = `You are a skill routing assistant. Your job is to classify user intent and select the most appropriate skill.

Available skills:
${skillsList}

If no skill is clearly relevant, respond with null skill_id and low confidence.

Respond with a JSON object containing:
- skill_id: the exact skill id from the available skills list, or null if no match
- confidence: "high" if the user's message clearly matches a skill, "low" otherwise

Be conservative with "high" confidence - only use it when the message clearly relates to a specific skill's domain.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: message },
  ];

  try {
    const response = await fetch(`${aiConfig.lmStudio.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: aiConfig.lmStudio.modelName,
        messages,
        temperature: 0.1,
        max_tokens: 100,
        stream: false,
      }),
    });

    if (!response.ok) {
      return { skillId: null, confidence: 'low' };
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { skillId: null, confidence: 'low' };
    }

    const jsonText = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]?.trim() ?? content;
    const parsed = JSON.parse(jsonText) as {
      skill_id?: string | null;
      confidence?: 'high' | 'low';
    };
    return {
      skillId: parsed.skill_id ?? null,
      confidence: parsed.confidence ?? 'low',
    };
  } catch {
    return { skillId: null, confidence: 'low' };
  }
}
