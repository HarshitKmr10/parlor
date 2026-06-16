import { NextResponse, NextRequest } from 'next/server';
import axios from 'axios';

export async function GET(req: NextRequest) {
  try {
    // ServiceNow credentials
    const username = 'yatish@futurepath.ai';
    const password = 'Best@123';
    const instanceName = 'dev209832';

    if (!username || !password || !instanceName) {
      return NextResponse.json(
        { error: 'ServiceNow configuration is missing' },
        { status: 500 },
      );
    }

    const baseUrl = `https://${instanceName}.service-now.com/api/now/table`;
    const AUTH_TOKEN = `Basic ${Buffer.from(`${username}:${password}`).toString(
      'base64',
    )}`;

    // Fetch KB collections
    const kbCollectionsResponse = await axios.get(
      `${baseUrl}/kb_knowledge_base`,
      {
        headers: {
          Accept: 'application/json',
          Authorization: AUTH_TOKEN,
          'Content-Type': 'application/json',
        },
      },
    );

    const kbCollections = kbCollectionsResponse.data.result;

    // Create a map of knowledge base IDs to their titles
    const kbBasesMap = kbCollections.reduce((acc, kb) => {
      acc[kb.sys_id] = kb.title;
      return acc;
    }, {});

    // Fetch KB articles
    const kbArticlesResponse = await axios.get(`${baseUrl}/kb_knowledge`, {
      headers: {
        Accept: 'application/json',
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
      params: {
        sysparm_fields:
          'sys_id,number,short_description,kb_knowledge_base,workflow_state,sys_created_on',
        sysparm_limit: 1000, // Adjust this number based on your needs
      },
    });

    const kbArticles = kbArticlesResponse.data.result;

    // Process articles and count documents for each collection
    const groupedArticles = {};
    const processedArticles = kbArticles.map((article) => {
      const collectionId = article.kb_knowledge_base.value;
      if (!groupedArticles[collectionId]) {
        groupedArticles[collectionId] = [];
      }
      groupedArticles[collectionId].push(article);

      return {
        sys_id: article.sys_id,
        title: article.short_description,
        number: article.number,
        collection_id: collectionId,
        collection: kbBasesMap[collectionId] || 'Unknown',
        upload_date: article.sys_created_on,
        status: article.workflow_state,
      };
    });

    // Add document count to collections
    const kbCollectionsWithCounts = kbCollections.map((collection) => ({
      ...collection,
      document_count: (groupedArticles[collection.sys_id] || []).length,
    }));

    return NextResponse.json({
      success: true,
      kbCollections: kbCollectionsWithCounts,
      kbArticles: processedArticles,
    });
  } catch (error) {
    console.error('Failed to fetch KB data:', error);

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error?.message || error.message;

      return NextResponse.json(
        {
          error: 'Failed to fetch KB data',
          details: message,
          statusCode: status,
        },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: 'Internal Server Error',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
