import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../hooks/useApi';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

export function Login({ isRegister = false }: { isRegister?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');

  const { login } = useAuth();
  const { fetchWithAuth, isLoading, error } = useApi();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const data = isRegister
        ? { email, password, name, businessName, city }
        : { email, password };

      const response = await fetchWithAuth(endpoint, {
        method: 'POST',
        data
      });

      if (response.success) {
        login(response.data.token, response.data.businessUser, response.data.business);

        if (isRegister || !response.data.business.onboardingCompleted) {
          navigate('/onboarding');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Auth error', err);
    }
  };

  // Skip the API call for demo purposes if desired (can implement a bypass here if needed)

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">B</div>
          <div className="auth-logo-text">BusinessOS</div>
        </div>
        
        <h1 className="auth-title">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="auth-subtitle">
          {isRegister ? 'Start managing your business intelligently.' : 'Log in to your command center.'}
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="badge badge-error p-3 w-full text-center block">
              {error}
            </div>
          )}

          {isRegister && (
            <>
              <Input
                label="Your Name"
                placeholder="Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Business Name"
                placeholder="Shree Ganesh Stores"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
              <Input
                label="City"
                placeholder="Mumbai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </>
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="rahul@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button 
            type="submit" 
            variant="accent" 
            size="lg" 
            isLoading={isLoading}
          >
            {isRegister ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="auth-footer">
          {isRegister ? (
            <>Already have an account? <Link to="/login">Sign In</Link></>
          ) : (
            <>Don't have an account? <Link to="/register">Create Account</Link></>
          )}
        </div>
      </div>
    </div>
  );
}
