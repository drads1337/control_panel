import React, { useCallback } from "react"
import { AlertCircle, Loader2, ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { useRegisterForm } from "@/hooks/use-register-form"
import { usePerformanceDetection } from "@/hooks/use-performance-detection"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

const FaultyTerminal = React.lazy(() => import("@/app/shared/faulty-terminal"))

function SignUpFormComponent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const {
    formData,
    errors,
    isLoading,
    error,
    handleInputChange,
    handleSubmit,
  } = useRegisterForm()

  const { recommendedSettings } = usePerformanceDetection()

  const handleBackToLogin = useCallback(() => {
    navigate('/login')
  }, [navigate])

  const handleSignInClick = useCallback(() => {
    navigate('/login')
  }, [navigate])

  const handleInviteCodeClick = useCallback(() => {
    navigate('/signup-invite')
  }, [navigate])

  return (
    <motion.div 
      className={cn("flex flex-col gap-6", className)} 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
    >
      <Card className="@container/card overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <motion.form 
            className="p-6 md:p-8" 
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex flex-col gap-4">
              {/* Header Section */}
              <div className="flex flex-col space-y-2">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors self-start mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to login
                </button>
                
                <div className="flex flex-col items-center text-center">
                  <h1 className="text-2xl font-bold">Create account</h1>
                  <p className="text-muted-foreground text-balance">
                    Sign up with your email to get started
                  </p>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Username */}
              <div className="grid gap-2">
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

              {/* Email */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className={errors.email ? "border-red-500" : ""}
                  disabled={isLoading}
                  required
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Project Name */}
              <div className="grid gap-2">
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

              {/* Password */}
              <div className="grid gap-2">
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

              {/* Confirm Password */}
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className={errors.confirmPassword ? "border-red-500" : ""}
                  disabled={isLoading}
                  required 
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full mt-2" 
                disabled={isLoading}
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

              {/* Footer Links */}
              <div className="flex flex-col items-center gap-1 text-center text-sm mt-2">
                <div>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="underline underline-offset-4 hover:text-primary bg-transparent border-none p-0 cursor-pointer"
                    onClick={handleSignInClick}
                  >
                    Sign in
                  </button>
                </div>
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-4 hover:text-primary bg-transparent border-none p-0 cursor-pointer text-xs"
                  onClick={handleInviteCodeClick}
                >
                  Have an invite code?
                </button>
              </div>
            </div>
          </motion.form>

          {/* Terminal Section */}
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
    </motion.div>
  )
}

export const SignUpForm = React.memo(SignUpFormComponent)