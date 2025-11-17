import React, { useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2, ArrowLeft } from "lucide-react"
import { useSignUpForm } from "@/hooks/use-signup-form"
import { useNavigate } from "react-router-dom"
import { usePerformanceDetection } from "@/hooks/use-performance-detection"
// Lazy load heavy FaultyTerminal component to improve initial load time
const FaultyTerminal = React.lazy(() => import("@/app/shared/faulty-terminal"))
import type { Project } from '@/entities/project';
import type { User } from '@/entities/user';

interface SignUpFormProps {
  className?: string
}

function SignUpFormComponent({
  className,
  ...props
}: SignUpFormProps) {
  const navigate = useNavigate()
  const {
    formData,
    errors,
    isLoading,
    error,
    inviteCodeInfo,
    handleInputChange,
    handleSubmit,
    clearErrors,
    checkInviteCode,
    setInviteCodeInfo
  } = useSignUpForm()
  
  const { recommendedSettings } = usePerformanceDetection()

  const handleBackToLogin = useCallback(() => {
    navigate('/login')
  }, [navigate])

  const handleInviteCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    handleInputChange('inviteCode', value)
    
    // Проверяем invite код при каждом изменении
    if (value.trim()) {
      checkInviteCode(value)
    } else {
      // Очищаем информацию о коде если поле пустое
      setInviteCodeInfo(null)
    }
  }, [handleInputChange, checkInviteCode, setInviteCodeInfo])

  const handleSignInClick = useCallback(() => {
    navigate('/login')
  }, [navigate])

  const handleTermsClick = useCallback(() => {
    // TODO: Navigate to Terms of Service
    console.log('Terms of Service clicked');
  }, [])

  const handlePrivacyClick = useCallback(() => {
    // TODO: Navigate to Privacy Policy
    console.log('Privacy Policy clicked');
  }, [])

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="@container/card overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {/* Back button */}
              <button
                type="button"
                onClick={handleBackToLogin}
                className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </button>

              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Create account</h1>
                <p className="text-muted-foreground text-balance">
                  Sign up with your invite code to join the platform
                </p>
              </div>

              {/* General error */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Invite Code field */}
              <div className="grid gap-3">
                <Label htmlFor="inviteCode">Invite Code *</Label>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="Enter your invite code"
                  value={formData.inviteCode}
                  onChange={handleInviteCodeChange}
                  className={errors.inviteCode ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                />
                {errors.inviteCode && (
                  <p className="text-sm text-red-500">{errors.inviteCode}</p>
                )}
                {inviteCodeInfo && (
                  <div className="text-sm text-muted-foreground">
                    {inviteCodeInfo.code_type === 'project_invite' ? (
                      <span className="text-green-600">✓ Project invite code</span>
                    ) : (
                      <span className="text-blue-600">✓ User invite code for {inviteCodeInfo.role} role</span>
                    )}
                  </div>
                )}

              </div>

              {/* Project Name field - only shown for project invite codes that need it */}
              {inviteCodeInfo?.code_type === 'project_invite' && inviteCodeInfo.requires_project_name && (
                <div className="grid gap-3">
                  <Label htmlFor="projectName">Project Name *</Label>
                  <Input
                    id="projectName"
                    type="text"
                    placeholder="Enter project name"
                    value={formData.projectName}
                    onChange={(e) => handleInputChange('projectName', e.target.value)}
                    className={errors.projectName ? "border-red-500" : ""}
                    disabled={isLoading}
                    required
                  />
                  {errors.projectName && (
                    <p className="text-sm text-red-500">{errors.projectName}</p>
                  )}
                </div>
              )}

              {/* Username field */}
              <div className="grid gap-3">
                <Label htmlFor="username">Username *</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  className={errors.username ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                />
                {errors.username && (
                  <p className="text-sm text-red-500">{errors.username}</p>
                )}
              </div>


              {/* Password field */}
              <div className="grid gap-3">
                <Label htmlFor="password">Password *</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className={errors.password ? "border-red-500" : ""}
                  disabled={isLoading}
                  required 
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || !inviteCodeInfo}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>

              <div className="text-center text-sm">
                Already have an account?{" "}
                <button
                  type="button"
                  className="underline underline-offset-4 hover:text-primary bg-transparent border-none p-0 cursor-pointer"
                  onClick={handleSignInClick}
                >
                  Sign in
                </button>
              </div>
            </div>
          </form>

          <div className="bg-muted relative hidden md:block">
            <div className="absolute inset-0">
              <React.Suspense fallback={<div className="w-full h-full bg-muted" />}>
                <FaultyTerminal 
                  scale={1.2}
                  gridMul={[2, 1]}
                  digitSize={1.3}
                  timeScale={0.4}
                  scanlineIntensity={0.2}
                  glitchAmount={1.1}
                  flickerAmount={0.8}
                  noiseAmp={0.8}
                  chromaticAberration={0.1}
                  dither={0.3}
                  curvature={0.15}
                  tint="#4f46e5"
                  mouseReact={true}
                  mouseStrength={0.3}
                  pageLoadAnimation={true}
                  brightness={1.1}
                  className="w-full h-full"
                  lowPowerMode={recommendedSettings.lowPowerMode}
                  maxFPS={recommendedSettings.maxFPS}
                  adaptiveQuality={recommendedSettings.adaptiveQuality}
                />
              </React.Suspense>
            </div>
          </div>
        </CardContent>
      </Card>

     
    </div>
  )
}

// Мемоизируем компонент для предотвращения лишних перерендеров
export const SignUpForm = React.memo(SignUpFormComponent) 