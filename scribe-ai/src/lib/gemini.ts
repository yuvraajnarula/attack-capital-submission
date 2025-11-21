import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
      }
    });

    const prompt = `Transcribe the following audio accurately. Include speaker diarization if multiple speakers are detected. Format with timestamps every 30 seconds.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: 'audio/webm',
          data: base64Audio
        }
      }
    ]);

    return result.response.text();
  } catch (error) {
    console.error('Transcription error:', error);
    throw error;
  }
};

export const generateSummary = async (transcript: string): Promise<string> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Summarize this meeting transcript into key points, action items, and decisions. Be concise but comprehensive.

  Transcript: ${transcript}

  Format:
  ## Key Points
  - 
  
  ## Action Items
  - 
  
  ## Decisions Made
  - `;

  const result = await model.generateContent(prompt);
  return result.response.text();
};