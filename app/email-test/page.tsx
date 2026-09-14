'use client';

import { useState } from 'react';
import { supabase } from '@/src/lib/supabaseClient';

const TEST_LEAD_ID = 'c87ce87c-c57e-4465-816a-9de8a397987a';
const TEST_EMAIL = 'jairo@ainglobal.com.br';

export default function EmailTestPage() {
  const [to, setTo] = useState(TEST_EMAIL);
  const [subject, setSubject] = useState('Teste de envio pelo MirraCRM');
  const [body, setBody] = useState(
    `Olá Jairo,

Este é um teste real de envio de e-mail diretamente pelo MirraCRM.

Se esta mensagem chegou, a integração MirraCRM + Gmail está funcionando.

Atenciosamente,
MirraCRM`
  );

  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSend() {
    setSending(true);
    setResult('');
    setSuccess(false);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          'Sessão do MirraCRM não encontrada. Faça login novamente.'
        );
      }

      const formData = new FormData();

      formData.append('accessToken', session.access_token);
      formData.append('leadId', TEST_LEAD_ID);
      formData.append('to', to.trim());
      formData.append('subject', subject.trim());
      formData.append('body', body);

      if (file) {
        formData.append('attachments', file);
      }

      const response = await fetch('/api/email/send', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            `Falha no envio. HTTP ${response.status}.`
        );
      }

      setSuccess(true);

      setResult(
        `Gmail aceitou o envio.\n\n` +
          `Status: ${data.status}\n` +
          `ID MirraCRM: ${data.messageId}\n` +
          `ID Gmail: ${data.providerMessageId}`
      );
    } catch (error: any) {
      setSuccess(false);
      setResult(
        error?.message || 'Erro inesperado durante o envio.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: '#f8fafc',
        padding: 32,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 16,
          padding: 28,
        }}
      >
        <h1 style={{ marginTop: 0 }}>
          Teste de E-mail — MirraCRM
        </h1>

        <p style={{ color: '#cbd5e1' }}>
          Ambiente develop. Este teste utiliza sua conta Gmail
          conectada ao MirraCRM.
        </p>

        <label style={{ display: 'block', marginTop: 24 }}>
          Destinatário
        </label>

        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          style={inputStyle}
        />

        <label style={{ display: 'block', marginTop: 18 }}>
          Assunto
        </label>

        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={inputStyle}
        />

        <label style={{ display: 'block', marginTop: 18 }}>
          Mensagem
        </label>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={10}
          style={{
            ...inputStyle,
            resize: 'vertical',
          }}
        />

        <label style={{ display: 'block', marginTop: 18 }}>
          Anexo opcional
        </label>

        <input
          type="file"
          onChange={(e) =>
            setFile(e.target.files?.[0] ?? null)
          }
          style={{
            display: 'block',
            marginTop: 8,
          }}
        />

        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            width: '100%',
            marginTop: 28,
            padding: '14px 18px',
            border: 0,
            borderRadius: 10,
            cursor: sending ? 'wait' : 'pointer',
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {sending ? 'Enviando...' : 'Enviar teste'}
        </button>

        {result && (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              marginTop: 24,
              padding: 16,
              borderRadius: 10,
              background: success ? '#052e16' : '#450a0a',
              overflowWrap: 'anywhere',
            }}
          >
            {success ? '✅ ' : '❌ '}
            {result}
          </pre>
        )}
      </div>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  marginTop: 8,
  padding: 12,
  borderRadius: 8,
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#f8fafc',
  fontSize: 15,
};