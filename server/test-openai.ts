/**
 * Test OpenAI API connection
 */
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import * as dotenv from 'dotenv';

// Load .env
dotenv.config();

async function testOpenAI() {
    console.log('🧪 Testing OpenAI API...\n');
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
    console.log('API Key prefix:', process.env.OPENAI_API_KEY?.substring(0, 10) + '...');

    try {
        console.log('\nCalling OpenAI API...');
        const result = await generateText({
            model: openai('gpt-4o'),
            prompt: 'Say hello in one word',
        });

        console.log('✅ Success!');
        console.log('Response:', result.text);
    } catch (error: any) {
        console.error('❌ Failed!');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testOpenAI();
