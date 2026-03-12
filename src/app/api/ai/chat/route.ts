/**
 * AI Chat API
 *
 * POST - Send a message to the AI assistant and get a response
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { answerQuestion, isAIEnabled, ChatMessage } from '@/lib/ai';
import { Prisma } from '@prisma/client';
import { requireUserApi, HttpError } from '@/lib/auth/rbac';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    await requireUserApi();

    // Check if AI is enabled
    if (!isAIEnabled()) {
      return NextResponse.json(
        {
          error: 'AI features are not enabled',
          hint: 'Set OPENROUTER_API_KEY environment variable',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { message, conversationId } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get the site
    const site = await prisma.site.findFirst();
    if (!site) {
      return NextResponse.json({ error: 'No site found' }, { status: 400 });
    }

    // Get or create conversation
    let conversation;
    let conversationHistory: ChatMessage[] = [];

    if (conversationId) {
      conversation = await prisma.aIConversation.findUnique({
        where: { id: conversationId },
      });

      if (conversation) {
        // Parse existing messages
        const messages = conversation.messages as unknown as ConversationMessage[];
        conversationHistory = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
      }
    }

    // Get AI response
    const response = await answerQuestion(site.id, message, conversationHistory);

    // Build new messages array
    const newMessages: ConversationMessage[] = [
      ...((conversation?.messages as unknown as ConversationMessage[]) || []),
      {
        role: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant' as const,
        content: response,
        timestamp: new Date().toISOString(),
      },
    ];

    // Save conversation
    // For now, we'll create a new conversation each time if no ID
    // In production, you'd want to track user sessions
    if (conversation) {
      await prisma.aIConversation.update({
        where: { id: conversation.id },
        data: { messages: newMessages as unknown as Prisma.InputJsonValue },
      });
    } else {
      // Get a demo user for now
      const user = await prisma.user.findFirst();
      if (user) {
        conversation = await prisma.aIConversation.create({
          data: {
            siteId: site.id,
            userId: user.id,
            messages: newMessages as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      response,
      conversationId: conversation?.id,
      messageCount: newMessages.length,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('AI chat API error:', error);
    return NextResponse.json(
      { error: 'Chat failed', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve conversation history
export async function GET(request: NextRequest) {
  try {
    await requireUserApi();

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const conversation = await prisma.aIConversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversationId: conversation.id,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Conversation fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}
