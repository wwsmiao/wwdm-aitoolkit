import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const templatesDir = path.resolve(process.cwd(), '..', 'prompt_templates');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, prompt } = body;
    if (!name || !prompt) {
      return NextResponse.json({ error: 'Name and prompt are required' }, { status: 400 });
    }

    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    // Generate filename from name
    let filename = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.json';
    if (!filename || filename === '.json') {
      filename = 'template_' + Date.now() + '.json';
    }

    const filePath = path.join(templatesDir, filename);

    // Check for duplicate
    if (fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'A template with this name already exists' }, { status: 409 });
    }

    const data = { name, description: description || '', prompt };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');

    return NextResponse.json({ success: true, filename, template: data });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
