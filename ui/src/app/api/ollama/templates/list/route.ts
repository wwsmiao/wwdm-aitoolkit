import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const templatesDir = path.resolve(process.cwd(), '..', 'prompt_templates');

export async function GET() {
  try {
    if (!fs.existsSync(templatesDir)) {
      return NextResponse.json({ templates: [] });
    }
    const files = fs.readdirSync(templatesDir);
    const templates: { name: string; description: string; filename: string; prompt: string }[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(templatesDir, file);
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        templates.push({
          name: content.name || file,
          description: content.description || '',
          filename: file,
          prompt: content.prompt || '',
        });
      } catch (e) {
        // skip invalid json
      }
    }
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Error listing templates:', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}
