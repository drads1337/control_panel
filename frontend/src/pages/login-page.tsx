import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLoginForm } from '@/features/auth/hooks/use-login-form'
import { useAuthContext } from '@/app/providers/auth-provider'
import PixelSnow from '@/features/auth/components/PixelSnow'
import { Key, User, Lock, ArrowRight, Plus, Clock, Shield, UserCheck } from 'lucide-react'
import { Checkbox, Input, Button } from '@/shared/ui/components'

const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isInitialized } = useAuthContext()
  const [rememberMe, setRememberMe] = useState(false)
  const {
    formData,
    errors,
    isLoading,
    error,
    handleInputChange,
    handleSubmit
  } = useLoginForm()

  // Redirect to dashboard page after successful login
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, isInitialized, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background-dark text-text-primary-dark antialiased w-full">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <PixelSnow
          color="#E2E8F0"
          flakeSize={0.012}
          minFlakeSize={1.2}
          pixelResolution={280}
          speed={1.2}
          depthFade={12}
          farPlane={25}
          brightness={0.6}
          gamma={0.5}
          density={0.2}
          variant="chip"
          direction={90}
          className="opacity-25"
        />
      </div>
      
      <div className="w-full max-w-md p-4 relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-surface-dark border border-border-dark mb-4 shadow-glow">
            <Key className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-wide text-primary">ACCESS CONTROL</h1>
          <p className="mt-2 text-xs text-text-secondary-dark uppercase tracking-widest font-mono-numbers">Restricted Area // Authorization Required</p>
        </div>
        
        <div className="bg-surface-dark/50 backdrop-blur-md border border-border-dark p-6 rounded-lg shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-danger/10 border border-danger/20 text-danger text-xs p-3 rounded">
                {error}
              </div>
            )}
            
            <div className="space-y-2 group">
              <label className="block text-[10px] font-bold uppercase text-text-secondary-dark tracking-widest group-focus-within:text-primary transition-colors" htmlFor="username">
                Identity
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <User className="h-5 w-5 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                </div>
                <Input 
                  autoComplete="username" 
                  className="pl-10 pr-3 py-2.5 h-auto text-sm bg-background-dark border-border-dark text-text-primary-dark placeholder-text-secondary-dark/50 focus:ring-primary focus:border-primary font-mono-numbers tracking-tight" 
                  id="username" 
                  name="username" 
                  placeholder="USR-ID-0000" 
                  type="text" 
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                />
              </div>
              {errors.username && (
                <p className="text-[10px] text-danger mt-1">{errors.username}</p>
              )}
            </div>
            
            <div className="space-y-2 group">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold uppercase text-text-secondary-dark tracking-widest group-focus-within:text-primary transition-colors" htmlFor="password">
                  Credentials
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <Lock className="h-5 w-5 text-text-secondary-dark group-focus-within:text-primary transition-colors" />
                </div>
                <Input 
                  autoComplete="current-password" 
                  className="pl-10 pr-3 py-2.5 h-auto text-sm bg-background-dark border-border-dark text-text-primary-dark placeholder-text-secondary-dark/50 focus:ring-primary focus:border-primary font-mono-numbers tracking-tight" 
                  id="password" 
                  name="password" 
                  placeholder="••••••••••••" 
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                />
              </div>
              {errors.password && (
                <p className="text-[10px] text-danger mt-1">{errors.password}</p>
              )}
            </div>
            
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="remember-me" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  className="h-3.5 w-3.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-background-dark"
                  style={{
                    borderColor: 'var(--color-border-dark)',
                    backgroundColor: rememberMe ? 'var(--color-primary)' : 'var(--color-background-dark)',
                    borderWidth: '1px'
                  } as React.CSSProperties}
                />
                <label className="block text-[11px] text-text-secondary-dark hover:text-text-primary-dark cursor-pointer transition-colors" htmlFor="remember-me">
                  Persist Session
                </label>
              </div>
              <div className="text-[11px]">
                <a className="font-medium text-text-secondary-dark hover:text-primary transition-colors flex items-center gap-1 group" href="#">
                  Recover Access
                  <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </a>
              </div>
            </div>
            
            <Button 
              className="w-full justify-center py-2.5 px-4 border-transparent bg-primary text-background-dark text-xs font-bold uppercase tracking-widest hover:bg-[#CBD5E1] focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-surface-dark shadow-glow hover:shadow-glow-focus mt-2"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Initializing...' : 'Initialize Session'}
            </Button>
          </form>
          
          <div className="mt-6 pt-4 border-t border-border-dark flex items-center justify-between">
            <p className="text-[10px] text-text-secondary-dark">
              NO ACCOUNT?
            </p>
            <a className="text-[10px] font-bold text-primary hover:text-white uppercase tracking-wider flex items-center gap-1" href="#">
              Request Provisioning
              <Plus className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        
        <div className="mt-6 text-center space-y-2">
          <div className="flex justify-center items-center gap-6 opacity-40 hover:opacity-100 transition-opacity duration-500">
            <Clock className="h-5 w-5 text-text-secondary-dark" title="Secure Connection" />
            <Shield className="h-5 w-5 text-text-secondary-dark" title="Encryption Active" />
            <UserCheck className="h-5 w-5 text-text-secondary-dark" title="Verified System" />
          </div>
          <p className="text-[10px] text-inactive-dark font-mono-numbers mt-3 tracking-widest">
            SYSTEM_ID: YMPHE66H64 // V.1.0.0-BETA
          </p>
        </div>
      </div>
    </div>
  )
}

export default LoginPage