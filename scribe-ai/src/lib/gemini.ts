import { GoogleGenerativeAI } from '@google/generative-ai';

// Validate API key on initialization
if (!process.env.GEMINI_API_KEY) {
    console.error(' GEMINI_API_KEY is not set in environment variables!');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
        console.log(' Starting transcription...');
        console.log('   Blob size:', audioBlob.size, 'bytes');
        console.log('   Blob type:', audioBlob.type);

        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not configured. Please add it to your .env file');
        }

        if (audioBlob.size === 0) {
            throw new Error('Audio blob is empty - no data to transcribe');
        }

        // Convert blob to base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');

        console.log(' Converted to base64, length:', base64Audio.length);

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
        });

        const prompt = `Transcribe the following audio accurately. 

Instructions:
- Transcribe all spoken words exactly as they are said
- Include proper punctuation and capitalization
- If multiple speakers, indicate speaker changes
- Format the output as clean, readable text
- If you detect timestamps or time markers, include them

Provide only the transcription, no additional commentary.`;

        console.log(' Calling Gemini API...');

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: 'audio/webm',
                    data: base64Audio
                },
            },
        ]);

        const response = await result.response;
        const transcription = response.text();
        
        console.log('Transcription received');
        console.log('   Length:', transcription.length, 'characters');
        console.log('   Preview:', transcription.substring(0, 100) + '...');
        
        return transcription;

    } catch (error: any) {
        console.error(' Gemini transcription error:');
        console.error('   Error type:', error?.constructor?.name);
        console.error('   Error message:', error?.message);
        
        if (error?.message?.includes('API key')) {
            console.error('     Invalid API key! Check your GEMINI_API_KEY in .env');
            throw new Error('Invalid Gemini API key. Please verify your API key at https://makersuite.google.com/app/apikey');
        }
        
        if (error?.message?.includes('quota')) {
            console.error('    API quota exceeded!');
            throw new Error('Gemini API quota exceeded. Please check your usage at https://console.cloud.google.com');
        }

        if (error?.message?.includes('ENOTFOUND') || error?.message?.includes('network')) {
            console.error('   Network error!');
            throw new Error('Cannot connect to Gemini API. Check your internet connection.');
        }

        console.error('   Full error:', error);
        throw new Error(`Transcription failed: ${error?.message || 'Unknown error'}`);
    }
};

export const generateSummary = async (transcript: string): Promise<string> => {
    try {
        console.log('Starting summary generation...');
        console.log('   Transcript length:', transcript.length, 'characters');

        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        if (!transcript || transcript.trim().length === 0) {
            throw new Error('Transcript is empty - nothing to summarize');
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
        });

        const prompt = `Analyze and summarize the following transcript.

Transcript:
${transcript}

Please provide a structured summary with:

## Overview
[2-3 sentence overview of what was discussed]

## Key Points
- [Main point 1]
- [Main point 2]
- [Main point 3]
[Continue as needed]

## Action Items
- [Any tasks, decisions, or follow-ups mentioned]
[If none, write "No specific action items mentioned"]

## Important Details
- [Any significant numbers, dates, names, or specific information]
[If none, write "No critical details to highlight"]

Keep it concise but comprehensive.`;

        console.log('Calling Gemini API for summary...');

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summary = response.text();

        console.log(' Summary generated');
        console.log('   Length:', summary.length, 'characters');
        console.log('   Preview:', summary.substring(0, 100) + '...');

        return summary;

    } catch (error: any) {
        console.error('Gemini summary error:');
        console.error('   Error type:', error?.constructor?.name);
        console.error('   Error message:', error?.message);
        
        if (error?.message?.includes('API key')) {
            throw new Error('Invalid Gemini API key');
        }
        
        if (error?.message?.includes('quota')) {
            throw new Error('Gemini API quota exceeded');
        }

        console.error('   Full error:', error);
        throw new Error(`Summary generation failed: ${error?.message || 'Unknown error'}`);
    }
};