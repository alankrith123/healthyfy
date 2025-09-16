'use server';

/**
 * @fileOverview This file defines a Genkit flow to match a patient to a suitable medical specialist based on their symptoms.
 *
 * - matchSpecialist - A function that takes patient symptoms as input and returns the name of a suitable medical specialist.
 * - MatchSpecialistInput - The input type for the matchSpecialist function, defining the expected format for patient symptoms.
 * - MatchSpecialistOutput - The output type for the matchSpecialist function, defining the expected format for the specialist recommendation.
 */

import { z } from 'zod';
import { ai } from '../genkit';

const MatchSpecialistInputSchema = z.object({
  symptoms: z.string(),
});

const MatchSpecialistOutputSchema = z.object({
  specialist: z.string(),
  doctorResponse: z.string(),
});

export type MatchSpecialistInput = z.infer<typeof MatchSpecialistInputSchema>;
export type MatchSpecialistOutput = z.infer<typeof MatchSpecialistOutputSchema>;

export async function matchSpecialist(input: MatchSpecialistInput): Promise<MatchSpecialistOutput> {
  const apiKey = process.env.GOOGLE_API_KEY;

  console.log('🔑 API Key available:', !!apiKey);
  console.log('📝 Input symptoms:', input.symptoms);

  // Call Google AI API (example using fetch; replace endpoint and payload as needed)
  const prompt = `You are an expert medical doctor. A patient will describe their symptoms.\n\n1. Identify the most suitable type of doctor (e.g., Cardiologist, Dermatologist, General Physician) for the symptoms.\n2. As that doctor, provide advice or next steps based on the symptoms.\n3. End your response with: 'Do you have any more questions?'\n\nPatient symptoms: ${input.symptoms}\n\nRespond in this JSON format: {"specialist": "<doctor type>", "doctorResponse": "<doctor's advice ending with 'Do you have any more questions?'>"}`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    console.log('🌐 Response status:', response.status);
    
    const data = await response.json();
    console.log('📦 Full API Response:', JSON.stringify(data, null, 2));
    
    // Extract the model's reply (adjust as needed for actual API response structure)
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('📄 Extracted text:', text);
    
    // Clean up markdown formatting if present
    let cleanText = text;
    if (text.includes('```json')) {
      // Extract JSON from markdown code blocks
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        cleanText = jsonMatch[1].trim();
        console.log('🧹 Cleaned JSON text:', cleanText);
      }
    }
    
    // Try to parse the JSON from the model's response
    let specialist = 'General Physician';
    let doctorResponse = 'Please consult a general physician. Do you have any more questions?';
    try {
      const parsed = JSON.parse(cleanText);
      specialist = parsed.specialist || specialist;
      doctorResponse = parsed.doctorResponse || doctorResponse;
      console.log('✅ Successfully parsed JSON:', { specialist, doctorResponse });
    } catch (e) {
      console.log('❌ JSON parse error:', e instanceof Error ? e.message : 'Unknown error');
      console.log('🔍 Attempted to parse:', cleanText);
      // fallback: use raw text if not valid JSON
      doctorResponse = text || doctorResponse;
    }
    return { specialist, doctorResponse };
  } catch (error) {
    console.error('🚨 API call error:', error);
    return { 
      specialist: 'General Physician', 
      doctorResponse: 'Unable to analyze symptoms at this time. Please consult a general physician. Do you have any more questions?' 
    };
  }
}

const prompt = ai.definePrompt({
  name: 'matchSpecialistPrompt',
  input: {schema: MatchSpecialistInputSchema},
  output: {schema: MatchSpecialistOutputSchema},
  prompt: `You are an AI medical assistant. A patient will describe their symptoms, and you will provide the single most suitable medical specialist for them to see.

Symptoms: {{{symptoms}}}

Specialist: `,
});

const matchSpecialistFlow = ai.defineFlow(
  {
    name: 'matchSpecialistFlow',
    inputSchema: MatchSpecialistInputSchema,
    outputSchema: MatchSpecialistOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
