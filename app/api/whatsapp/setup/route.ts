import {
  NextRequest,
  NextResponse,
} from 'next/server';

import {
  assertWhatsAppEnvironment,
  getAdminSupabase,
  getRequesterContext,
} from '@/src/lib/whatsapp/server';

export async function POST(
  request: NextRequest
) {
  try {
    const requester =
      await getRequesterContext(
        request
      );

    if (!requester) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Sessão inválida.',
        },
        { status: 401 }
      );
    }

    if (
      requester.role !== 'owner' &&
      requester.role !== 'admin'
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Apenas owner ou admin pode configurar o WhatsApp.',
        },
        { status: 403 }
      );
    }

    const env =
      assertWhatsAppEnvironment();

    const admin =
      getAdminSupabase();

    const {
      data,
      error,
    } = await admin
      .from('whatsapp_accounts')
      .upsert(
        {
          scope_key:
            requester.scopeKey,

          waba_id:
            env.wabaId,

          phone_number_id:
            env.phoneNumberId,

          status: 'active',

          created_by_user_id:
            requester.userId,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            'phone_number_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error(
        'Erro setup WhatsApp:',
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      account: data,
    });
  } catch (error: any) {
    console.error(
      'Erro inesperado setup WhatsApp:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'Erro inesperado.',
      },
      { status: 500 }
    );
  }
}