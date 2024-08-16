import { Configuration, OpenAIApi } from 'openai-edge'
import { openai, createOpenAI } from '@ai-sdk/openai';
import { streamText, convertToCoreMessages, Message,  } from 'ai';
import { NextResponse } from 'next/server';
import { getContext } from '@/lib/Context';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chats, messages as _messages } from '@/lib/db/schema';

// export const runtime = 'edge'

const config = new Configuration({
    apiKey: process.env.OPENAI_API_KEY!
})

const client = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    compatibility: 'strict', // strict mode, enable when using the OpenAI API
  });

export async function POST(req: Request) {
    try {
        const { messages, chatId } = await req.json()
        console.log(messages)
        
        const _chats = await db.select().from(chats).where(eq(chats.id, chatId))
        if (_chats.length != 1){
            return NextResponse.json({'error': 'Chat not found!'}, {status: 404})
        } 

        const fileKey = _chats[0].fileKey
        const lastMessage = messages[messages.length - 1]
        const context = await getContext(lastMessage.content, fileKey)
        const prompt = {
            role: "system",
            content: `AI assistant is a brand new, powerful, human-like artificial intelligence.
            The traits of AI include expert knowledge, helpfulness, cleverness, and articulateness.
            AI is a well-behaved and well-mannered individual.
            AI is always friendly, kind, and inspiring, and he is eager to provide vivid and thoughtful responses to the user.
            AI has the sum of all knowledge in their brain, and is able to accurately answer nearly any question about any topic in conversation.
            AI assistant is a big fan of Pinecone and Vercel.
            START CONTEXT BLOCK
            ${context}
            END OF CONTEXT BLOCK
            AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
            If the context does not provide the answer to question, the AI assistant will say, "I'm sorry, but I don't know the answer to that question".
            AI assistant will not apologize for previous responses, but instead will indicated new information was gained.
            AI assistant will not invent anything that is not drawn directly from the context.
            `,
          };
          
        const result = await streamText({
            model: openai('gpt-4o'),
            messages: [
                prompt,
                ...messages.filter((message: Message) => message.role === 'user')
            ],
            onFinish: async({text}) => {
                await db.insert(_messages).values({
                    chatId,
                    content: lastMessage.content,
                    role: 'user',
                  });
        
                await db.insert(_messages).values({
                    chatId,
                    content:text,
                    role: 'system'
        
                })

            }


        });



        

        


          return result.toDataStreamResponse();

    } catch (error) {
        console.error('Error:', error)
        return new Response('Error occurred while processing the request', { status: 500 })
    }
}