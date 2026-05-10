import { Crown, Sparkles, Zap, Check, ArrowRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

interface PlanFeature {
  text: string
  included: boolean
}

const FREE_PLAN: PlanFeature[] = [
  { text: 'Up to 10 code reviews per month', included: true },
  { text: 'Basic issue detection', included: true },
  { text: '50 snippets', included: true },
  { text: 'Single user', included: true },
  { text: 'Team collaboration', included: false },
  { text: 'Priority support', included: false },
]

const PREMIUM_PLAN: PlanFeature[] = [
  { text: 'Unlimited code reviews', included: true },
  { text: 'Advanced issue detection', included: true },
  { text: 'Unlimited snippets & collections', included: true },
  { text: 'Team collaboration', included: true },
  { text: 'Priority support', included: true },
  { text: 'Early access to new features', included: true },
]

export default function UpgradePage() {
  const { user } = useAuth()
  const isPremium = user?.role === 'PREMIUM' || user?.role === 'ADMIN'

  function handleUpgrade() {
    toast.info('Premium purchase flow coming soon!')
  }

  return (
    <div className="p-8 w-full max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Upgrade Plan</h1>
        <p className="text-muted-foreground">Choose the plan that fits your needs.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Free Plan */}
        <Card className="relative flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Zap className="h-5 w-5 text-muted-foreground" />
              Free
            </CardTitle>
            <CardDescription>For getting started</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div>
              <span className="text-4xl font-bold text-foreground">$0</span>
              <span className="text-muted-foreground ml-1">/forever</span>
            </div>
            <ul className="space-y-3">
              {FREE_PLAN.map((feature) => (
                <li key={feature.text} className="flex items-start gap-3 text-sm">
                  {feature.included ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  ) : (
                    <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border border-muted-foreground/30" />
                  )}
                  <span className={feature.included ? 'text-foreground' : 'text-muted-foreground'}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {!isPremium ? (
              <Badge variant="secondary" className="w-full justify-center py-1.5 text-sm">
                Current Plan
              </Badge>
            ) : (
              <Badge variant="outline" className="w-full justify-center py-1.5 text-sm">
                Available
              </Badge>
            )}
          </CardFooter>
        </Card>

        {/* Premium Plan */}
        <Card className="relative flex flex-col border-primary/50 shadow-lg">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge variant="default" className="px-4 py-1 text-xs gap-1">
              <Crown className="h-3 w-3" />
              POPULAR
            </Badge>
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Premium
            </CardTitle>
            <CardDescription>For professionals &amp; teams</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div>
              <span className="text-4xl font-bold text-foreground">$20</span>
              <span className="text-muted-foreground ml-1">/year</span>
            </div>
            <ul className="space-y-3">
              {PREMIUM_PLAN.map((feature) => (
                <li key={feature.text} className="flex items-start gap-3 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-foreground">{feature.text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            {isPremium ? (
              <Badge variant="success" className="w-full justify-center py-1.5 text-sm gap-1">
                <Crown className="h-3.5 w-3.5" />
                Current Plan
              </Badge>
            ) : (
              <Button className="w-full gap-2" onClick={handleUpgrade}>
                Upgrade Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
