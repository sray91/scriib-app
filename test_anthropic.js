const { Anthropic } = require('@anthropic-ai/sdk');
require('dotenv').config({ path: '.env.local' });

async function testModel(modelName) {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    console.log(`Testing model: ${modelName}...`);

    try {
        const msg = await anthropic.messages.create({
            model: modelName,
            max_tokens: 100,
            messages: [{ role: "user", content: "Hello" }],
        });
        console.log(`SUCCESS with ${modelName}!`);
        return true;
    } catch (err) {
        console.error(`FAILED with ${modelName}: ${err.status} ${err.error?.type} ${err.error?.message}`);
        return false;
    }
}

async function runTests() {
    const models = [
        "claude-opus-4-5-20251101",
        "claude-opus-4-5"
    ];

    for (const model of models) {
        if (await testModel(model)) {
            break;
        }
    }
}

runTests();
