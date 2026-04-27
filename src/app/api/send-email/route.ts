import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    // Escape HTML for shell
    const escaped = html.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');

    // Send email using the existing script with --body-html
    const scriptPath = '/Users/ava/.openclaw/workspace/send-email.sh';
    const command = `${scriptPath} --to "${to}" --subject "${subject}" --body-html "${escaped}"`;

    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large HTML
    });

    if (stderr && !stderr.includes('message_id')) {
      console.error('Email script stderr');
    }

    return NextResponse.json({ success: true, output: stdout });
  } catch (error: any) {
    console.error('Email sending error');
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
