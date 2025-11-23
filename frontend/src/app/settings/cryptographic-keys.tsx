import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Key, Copy, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSettingsQuery } from '@/entities/settings'
import type { ProjectSettings } from '@/entities/settings'

interface CryptographicKeysProps {
  settings: ProjectSettings
  isSaving: boolean
}

export default function CryptographicKeys({ settings, isSaving }: CryptographicKeysProps) {
  const { toast } = useToast()
  const { regenerateKeys } = useSettingsQuery()
  const [regenerating, setRegenerating] = useState<string | null>(null)

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${type} copied`)
  }

  const handleRegenerate = async (keyType: 'aes' | 'rsa' | 'all') => {
    setRegenerating(keyType)
    try {
      await regenerateKeys(keyType)
      toast.success('Keys regenerated successfully')
    } catch (error) {
      toast.error('Failed to regenerate keys')
    } finally {
      setRegenerating(null)
    }
  }

  const keys = settings.encryption_keys

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 sm:pb-6">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base sm:text-lg">Cryptographic Keys</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Encryption keys for data protection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 flex-1 pt-0">
        {}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium">AES Key</span>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(keys.aes_key, 'AES Key')}
                disabled={isSaving}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRegenerate('aes')}
                disabled={isSaving || regenerating === 'aes'}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              >
                <RotateCcw className={`h-3 w-3 ${regenerating === 'aes' ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border/50">
            <code className="text-[10px] sm:text-xs font-mono text-muted-foreground break-all">
              {keys.aes_key}
            </code>
          </div>
        </div>

        {}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs sm:text-sm font-medium">Public Key</span>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(keys.public_key, 'Public Key')}
                disabled={isSaving}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRegenerate('rsa')}
                disabled={isSaving || regenerating === 'rsa'}
                className="h-7 w-7 sm:h-8 sm:w-8 p-0"
              >
                <RotateCcw className={`h-3 w-3 ${regenerating === 'rsa' ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-muted/30 border border-border/50">
            <code className="text-[10px] sm:text-xs font-mono text-muted-foreground break-all">
              {keys.public_key}
            </code>
          </div>
        </div>

        {}
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRegenerate('all')}
            disabled={isSaving || !!regenerating}
            className="w-full text-xs sm:text-sm"
          >
            <RotateCcw className={`h-3 w-3 mr-2 ${regenerating === 'all' ? 'animate-spin' : ''}`} />
            Regenerate All Keys
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
