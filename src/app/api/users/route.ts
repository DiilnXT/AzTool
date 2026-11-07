import { NextResponse } from 'next/server';
import { enforceApiSecurity, sanitizeInput } from '@/lib/security-shield';
import {
  readUnifiedStore,
  upsertAdminPermission,
  recordTeacherLogin,
  deleteTeacherFromStore,
  SUPER_ADMIN_EMAIL,
} from '@/lib/server-store';

export async function GET(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 180 });
  if (blocked) return blocked;

  const state = await readUnifiedStore();
  return NextResponse.json(
    {
      success: true,
      rev: state.rev,
      count: state.users.length,
      users: state.users,
      permissions: state.permissions,
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
    const { action, user, email, displayName, photoURL, permissions } = body;

    const targetEmail = ((user?.email || email) as string)?.trim().toLowerCase();
    if (!targetEmail) {
      return NextResponse.json({ success: false, error: 'Email là bắt buộc' }, { status: 400 });
    }

    if (action === 'login' || (user && permissions === undefined)) {
      const { state, user: loggedInUser } = await recordTeacherLogin({
        email: targetEmail,
        displayName: displayName || user?.displayName,
        photoURL: photoURL || user?.photoURL,
        id: user?.id,
      });

      return NextResponse.json(
        {
          success: true,
          rev: state.rev,
          user: loggedInUser,
          count: state.users.length,
          users: state.users,
          permissions: state.permissions,
          deletedEmails: state.deletedEmails,
        },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    const state = await upsertAdminPermission(
      targetEmail,
      permissions || {},
      displayName || user?.displayName,
      photoURL || user?.photoURL
    );

    return NextResponse.json(
      {
        success: true,
        rev: state.rev,
        count: state.users.length,
        users: state.users,
        permissions: state.permissions,
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

export async function DELETE(req: Request) {
  const blocked = enforceApiSecurity(req, { maxRequests: 60 });
  if (blocked) return blocked;

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email')?.toLowerCase() || '';
    const id = searchParams.get('id') || '';

    if (email && email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa Admin tối thượng' },
        { status: 400 }
      );
    }

    const state = await deleteTeacherFromStore(id || email, email);

    return NextResponse.json(
      {
        success: true,
        rev: state.rev,
        count: state.users.length,
        users: state.users,
        permissions: state.permissions,
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
