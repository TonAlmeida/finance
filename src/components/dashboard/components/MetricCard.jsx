// components/MetricCard.jsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export default function MetricCard({ 
  title, 
  value, 
  icon: Icon, 
  subtitle, 
  progressValue, 
  progressColor,
  valueColor = 'text-white'
}) {
  return (
    <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-xl">
      <CardHeader className="pb-3">
        <CardDescription className="text-slate-200 flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {title}
        </CardDescription>
        <CardTitle className={`text-2xl font-bold ${valueColor}`}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-slate-300 text-sm">
          {subtitle}
        </div>
        {progressValue !== undefined && (
          <Progress 
            value={progressValue} 
            className="mt-2 h-2 bg-slate-700/50" 
            indicatorclassname={progressColor}
          />
        )}
      </CardContent>
    </Card>
  );
}