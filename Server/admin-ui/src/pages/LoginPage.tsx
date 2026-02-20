import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Pen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { authApi } from '../lib/api';
import { useAuthStore } from '../store/auth';

const SAVED_EMAIL_KEY = 'penstream-saved-email';
const REMEMBER_EMAIL_KEY = 'penstream-remember-email';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);

  // Load saved email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(SAVED_EMAIL_KEY);
    const shouldRemember = localStorage.getItem(REMEMBER_EMAIL_KEY) === 'true';
    if (savedEmail && shouldRemember) {
      setEmail(savedEmail);
      setRememberEmail(true);
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(email, password),
    onSuccess: (data) => {
      // Save or clear email based on checkbox
      if (rememberEmail) {
        localStorage.setItem(SAVED_EMAIL_KEY, email);
        localStorage.setItem(REMEMBER_EMAIL_KEY, 'true');
      } else {
        localStorage.removeItem(SAVED_EMAIL_KEY);
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
      setAuth(data.token, data.user);
      navigate('/dashboard');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary text-primary-foreground">
              <Pen size={32} />
            </div>
          </div>
          <CardTitle className="text-2xl">NeoCAST Admin</CardTitle>
          <CardDescription>관리자 계정으로 로그인하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
            )}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                이메일
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                비밀번호
              </label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="rememberEmail"
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="rememberEmail" className="text-sm text-muted-foreground cursor-pointer">
                ID 저장하기
              </label>
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
