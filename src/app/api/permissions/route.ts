import { NextResponse } from 'next/server';
import { enforceApiSecurity, sanitizeInput } from '@/lib/security-shield';
import {
  readUnifiedStore,
  upsertAdminPermission,
  syncBulkAdminPermissions,
  deleteTeacherFromStore,
} from '@/lib/server-store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 180 });
  if (blocked) return blocked;

  const state = await readUnifiedStore();
  return NextResponse.json(
    {
      success: true,
      rev: state.rev,
      permissions: state.permissions,
      users: state.users,
      deletedEmails: state.deletedEmails,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}

export async function POST(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 90 });
  if (blocked) return blocked;

  try {
    const rawBody = await req.json();
    const body = sanitizeInput(rawBody);
    const { email, permissions, displayName, bulk, bulkUsers, bulkDeleted } = body;

    let state;
    if (bulk && typeof bulk === 'object') {
      state = await syncBulkAdminPermissions(bulk, bulkUsers, bulkDeleted);
    } else if (email && permissions) {
      state = await upsertAdminPermission(String(email), permissions, displayName);
    } else {
      state = await readUnifiedStore(true);
    }

    return NextResponse.json(
      {
        success: true,
        rev: state.rev,
        permissions: state.permissions,
        users: state.users,
        deletedEmails: state.deletedEmails,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi cập nhật quyền' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 60 });
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || '';
    const id = searchParams.get('id') || '';

    const state = await deleteTeacherFromStore(id || email, email);
    return NextResponse.json(
      {
        success: true,
        rev: state.rev,
        permissions: state.permissions,
        users: state.users,
        deletedEmails: state.deletedEmails,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
