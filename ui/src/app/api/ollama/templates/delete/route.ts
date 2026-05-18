import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const templatesDir = path.resolve(process.cwd(), '..', 'prompt_templates');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename } = body;
    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    // Security: prevent path traversal
    const safeName = path.basename(filename);
    if (safeName !== filename || !filename.endsWith('.json')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(templatesDir, safeName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
