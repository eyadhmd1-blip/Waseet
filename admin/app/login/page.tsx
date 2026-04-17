import { loginAction } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  invalid: 'اسم المستخدم أو كلمة المرور غير صحيحة',
  config:  'بيانات المدير غير مُهيأة في الخادم',
  session: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg  = error ? (ERROR_MESSAGES[error] ?? 'حدث خطأ، يرجى المحاولة مجدداً') : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F172A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      direction: 'rtl',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        padding: '0 24px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>⚡</div>
          <h1 style={{ color: '#F59E0B', fontSize: 28, fontWeight: 900, margin: 0 }}>وسيط</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 6 }}>لوحة تحكم المدير</p>
        </div>

        {/* Card */}
        <div style={{
          background: '#1E293B',
          borderRadius: 20,
          padding: 32,
          border: '1px solid #334155',
        }}>
          <h2 style={{ color: '#F1F5F9', fontSize: 20, fontWeight: 700, margin: '0 0 24px', textAlign: 'center' }}>
            تسجيل الدخول
          </h2>

          {errorMsg && (
            <div style={{
              background: '#450a0a', border: '1px solid #7f1d1d',
              borderRadius: 10, padding: '12px 14px', marginBottom: 16,
              color: '#fca5a5', fontSize: 13, textAlign: 'center',
            }}>
              {errorMsg}
            </div>
          )}

          <form action={loginAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                اسم المستخدم
              </label>
              <input
                name="username"
                type="text"
                required
                autoComplete="username"
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#F1F5F9',
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                كلمة المرور
              </label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '12px 14px',
                  color: '#F1F5F9',
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                background: '#F59E0B',
                color: '#0F172A',
                border: 'none',
                borderRadius: 12,
                padding: '14px',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: 8,
              }}
            >
              دخول ←
            </button>
          </form>
        </div>

        <p style={{ color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
          وسيط Admin v1.0 · للاستخدام الداخلي فقط
        </p>
      </div>
    </div>
  );
}
